// js/auth_global.js

// Assegura que o cliente Supabase está carregado antes de qualquer coisa
if (typeof supabase === 'undefined') {
    console.error("ERRO CRÍTICO: Supabase client não definido. auth_global.js não pode operar.");
    // Poderia tentar carregar supabaseClient.js dinamicamente ou mostrar um erro fatal.
}

/**
 * Verifica o estado da sessão atual e atualiza a UI.
 * Chama showPagePrincipal('dashboard') ou showPagePrincipal('login').
 * @returns {Promise<boolean>} True se autenticado, false caso contrário.
 */
async function checkAuthStatus() {
    console.log("auth_global.js: Verificando estado da autenticação...");
    if (!supabase) {
        console.error("checkAuthStatus: Supabase client não disponível.");
        if (typeof window.showPagePrincipal === 'function') window.showPagePrincipal('login');
        return false;
    }

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error("Erro ao obter sessão:", error.message);
        if (typeof window.showPagePrincipal === 'function') window.showPagePrincipal('login');
        return false;
    }

    if (session && session.user) {
        console.log("Sessão ativa encontrada para:", session.user.email);
        // Buscar perfil do utilizador da tabela 'profiles'
        const { data: userProfile, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, username, role, parque_associado_id, cidades_associadas, parques_associados_ids') // Adicionar mais campos se necessário para claims/lógica
            .eq('id', session.user.id)
            .single();

        if (profileError) {
            console.error("Erro ao buscar perfil do utilizador:", profileError.message);
            // Continuar mesmo sem perfil? Ou forçar logout? Por agora, continua mas sem dados de perfil.
            localStorage.setItem('userProfile', JSON.stringify({ id: session.user.id, email: session.user.email })); // Guardar dados mínimos
        } else if (userProfile) {
            localStorage.setItem('userProfile', JSON.stringify(userProfile));
            console.log("Perfil do utilizador carregado:", userProfile);
        } else {
            console.warn("Nenhum perfil encontrado para o utilizador na tabela 'profiles'.");
            localStorage.setItem('userProfile', JSON.stringify({ id: session.user.id, email: session.user.email }));
        }
        
        // Atualizar JWT claims (idealmente feito por um Auth Hook no Supabase)
        // Se não tiver um Auth Hook, esta atualização manual de metadata pode não ser suficiente para RLS baseadas em claims em tempo real.
        // A Edge Function que me enviaste é a forma correta de popular os claims no token.
        // Esta parte é mais para garantir que `app_metadata` está atualizado se o hook não estiver a funcionar ou para referência.
        if (userProfile && supabase.auth.updateUser) { // updateUser pode não estar disponível em todas as versões/contextos do SDK diretamente
             try {
                await supabase.auth.updateUser({ 
                    data: { // app_metadata
                        user_role: userProfile.role, 
                        user_cities: userProfile.cidades_associadas, // Certificar que estes campos existem em 'profiles'
                        user_parques_ids: userProfile.parques_associados_ids 
                    }
                });
                console.log("Metadados do utilizador atualizados (tentativa).");
             } catch (updateError) {
                console.warn("Aviso ao tentar atualizar metadados do utilizador (pode ser normal se não houver alterações):", updateError.message);
             }
        }


        if (typeof window.showPagePrincipal === 'function') window.showPagePrincipal('dashboard');
        return true;
    } else {
        console.log("Nenhuma sessão ativa.");
        localStorage.removeItem('userProfile');
        if (typeof window.showPagePrincipal === 'function') window.showPagePrincipal('login');
        return false;
    }
}

/**
 * Tenta autenticar o utilizador com email e password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<boolean>} True em sucesso, false em falha.
 */
async function signInUser(email, password) {
    console.log("auth_global.js: Tentando login para:", email);
    if (!supabase) {
        console.error("signInUser: Supabase client não disponível.");
        return false;
    }
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            console.error("Erro no login:", error.message);
            return false;
        }

        if (data.user) {
            console.log("Login bem-sucedido para:", data.user.email);
            // Após o login, checkAuthStatus será chamado (ou já foi pelo listener onAuthStateChange)
            // para buscar o perfil e atualizar a UI.
            await checkAuthStatus(); // Força a atualização do perfil e UI
            return true;
        }
        return false;
    } catch (e) {
        console.error("Exceção no login:", e);
        return false;
    }
}

/**
 * Faz logout do utilizador atual.
 */
async function handleLogoutGlobal() {
    console.log("auth_global.js: Efetuando logout...");
    if (!supabase) {
        console.error("handleLogoutGlobal: Supabase client não disponível.");
        return;
    }
    const { error } = await supabase.auth.signOut();
    localStorage.removeItem('userProfile');
    localStorage.removeItem('parqueSelecionadoMultipark'); // Limpar parque selecionado
    if (error) {
        console.error("Erro ao fazer logout:", error.message);
        alert("Erro ao fazer logout: " + error.message);
    } else {
        console.log("Logout bem-sucedido.");
        if (typeof window.showPagePrincipal === 'function') window.showPagePrincipal('login');
    }
}

// Listener para mudanças no estado de autenticação (opcional, mas útil)
// O checkAuthStatus no carregamento da página geralmente é suficiente para SPAs simples.
if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
        console.log("auth_global.js: Evento onAuthStateChange:", event);
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (session && session.user) {
                checkAuthStatus(); // Atualiza perfil e UI
            }
        } else if (event === 'SIGNED_OUT') {
            handleLogoutGlobal(); // Assegura que a UI é atualizada para login
        }
    });
}

// Expor funções globalmente se app_principal.js não as importar como módulos
window.checkAuthStatus = checkAuthStatus;
window.signInUser = signInUser;
window.handleLogoutGlobal = handleLogoutGlobal;

console.log("auth_global.js carregado.");

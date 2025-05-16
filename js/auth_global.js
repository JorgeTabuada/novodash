// js/auth_global.js

// Assegura que o cliente Supabase está carregado antes de qualquer coisa
if (typeof window.getSupabaseClient !== 'function') {
    console.error("ERRO CRÍTICO: Função getSupabaseClient não definida. auth_global.js não pode operar.");
    // Poderia tentar carregar supabaseClient.js dinamicamente ou mostrar um erro fatal.
}

// Obter o cliente Supabase de forma segura
function getSupabase() {
    return window.getSupabaseClient ? window.getSupabaseClient() : null;
}

/**
 * Verifica o estado da sessão atual e atualiza a UI.
 * Chama showPagePrincipal('dashboard') ou showPagePrincipal('login').
 * @returns {Promise<boolean>} True se autenticado, false caso contrário.
 */
async function checkAuthStatus() {
    console.log("auth_global.js: Verificando estado da autenticação...");
    const supabase = getSupabase();
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
        try {
            // Primeiro, verificar quais colunas existem na tabela profiles
            const { data: profileColumns, error: columnsError } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .eq('id', session.user.id)
                .single();
                
            if (columnsError) {
                console.error("Erro ao buscar colunas básicas do perfil:", columnsError.message);
                // Continuar mesmo sem perfil, com dados mínimos
                localStorage.setItem('userProfile', JSON.stringify({ 
                    id: session.user.id, 
                    email: session.user.email,
                    role: 'default' // Role padrão para garantir acesso mínimo
                }));
            } else if (profileColumns) {
                // Perfil encontrado com colunas básicas
                const userProfile = {
                    id: profileColumns.id,
                    full_name: profileColumns.full_name || '',
                    role: profileColumns.role || 'default',
                    email: session.user.email
                };
                
                // Tentar buscar colunas adicionais se existirem
                try {
                    const { data: additionalData } = await supabase
                        .from('profiles')
                        .select('parque_associado_id, cidades_associadas, parques_associados_ids')
                        .eq('id', session.user.id)
                        .single();
                        
                    if (additionalData) {
                        // Adicionar apenas as propriedades que existem
                        if (additionalData.parque_associado_id !== undefined) {
                            userProfile.parque_associado_id = additionalData.parque_associado_id;
                        }
                        if (additionalData.cidades_associadas !== undefined) {
                            userProfile.cidades_associadas = additionalData.cidades_associadas;
                        }
                        if (additionalData.parques_associados_ids !== undefined) {
                            userProfile.parques_associados_ids = additionalData.parques_associados_ids;
                        }
                    }
                } catch (additionalError) {
                    console.warn("Aviso: Algumas colunas adicionais podem não existir na tabela profiles:", additionalError.message);
                }
                
                localStorage.setItem('userProfile', JSON.stringify(userProfile));
                console.log("Perfil do utilizador carregado:", userProfile);
                
                // Atualizar JWT claims se possível
                if (supabase.auth.updateUser) {
                    try {
                        const metadata = { user_role: userProfile.role };
                        
                        // Adicionar metadados adicionais apenas se existirem
                        if (userProfile.cidades_associadas) {
                            metadata.user_cities = userProfile.cidades_associadas;
                        }
                        if (userProfile.parques_associados_ids) {
                            metadata.user_parques_ids = userProfile.parques_associados_ids;
                        }
                        
                        await supabase.auth.updateUser({ data: metadata });
                        console.log("Metadados do utilizador atualizados.");
                    } catch (updateError) {
                        console.warn("Aviso ao tentar atualizar metadados do utilizador:", updateError.message);
                    }
                }
            } else {
                console.warn("Nenhum perfil encontrado para o utilizador na tabela 'profiles'.");
                localStorage.setItem('userProfile', JSON.stringify({ 
                    id: session.user.id, 
                    email: session.user.email,
                    role: 'default' // Role padrão para garantir acesso mínimo
                }));
            }
        } catch (e) {
            console.error("Erro ao processar perfil do utilizador:", e.message);
            localStorage.setItem('userProfile', JSON.stringify({ 
                id: session.user.id, 
                email: session.user.email,
                role: 'default'
            }));
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
    const supabase = getSupabase();
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
    const supabase = getSupabase();
    if (!supabase) {
        console.error("handleLogoutGlobal: Supabase client não disponível.");
        return;
    }
    const { error } = await supabase.auth.signOut();
    localStorage.removeItem('userProfile');
    localStorage.removeItem('parqueSelecionadoMultipark'); // Limpar parque selecionado
    localStorage.removeItem('parqueSelecionadoMultiparkId'); // Limpar ID do parque selecionado
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
document.addEventListener('DOMContentLoaded', () => {
    const supabase = getSupabase();
    if (supabase && supabase.auth) {
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
});

// Expor funções globalmente se app_principal.js não as importar como módulos
window.checkAuthStatus = checkAuthStatus;
window.signInUser = signInUser;
window.handleLogoutGlobal = handleLogoutGlobal;

console.log("auth_global.js carregado.");

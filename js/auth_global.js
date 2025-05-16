// auth_global.js - Funções de autenticação globais para todas as páginas (REVISTO v12 - Compatibilidade com Supabase 2.x)

// Função para obter o cliente Supabase
function getSupabase() {
    if (typeof window.getSupabaseClient !== 'function') {
        console.error("ERRO CRÍTICO: Função getSupabaseClient não definida. auth_global.js não pode operar.");
        return null;
    }
    return window.getSupabaseClient();
}

// Verificar estado da autenticação
window.checkAuthStatus = async function() {
    console.log("auth_global.js: Verificando estado da autenticação...");
    
    const supabase = getSupabase();
    if (!supabase) {
        console.error("checkAuthStatus: Supabase client não disponível.");
        window.showPagePrincipal('login');
        return false;
    }

    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error("Erro ao verificar sessão:", error.message);
            window.showPagePrincipal('login');
            return false;
        }
        
        if (!session) {
            console.log("Nenhuma sessão ativa.");
            window.showPagePrincipal('login');
            return false;
        }

        console.log("Sessão ativa encontrada para:", session.user.email);
        
        // Buscar perfil do utilizador
        try {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, role, email')
                .eq('id', session.user.id)
                .single();
                
            if (profileError) {
                console.error("Erro ao buscar perfil do utilizador:", profileError.message);
            } else if (profile) {
                // Armazenar perfil no localStorage para uso em toda a aplicação
                localStorage.setItem('userProfile', JSON.stringify({
                    id: profile.id,
                    full_name: profile.full_name || session.user.email?.split('@')[0] || 'Utilizador',
                    role: profile.role || 'default',
                    email: profile.email || session.user.email
                }));
            } else {
                // Se não encontrar perfil, criar um básico com os dados da sessão
                localStorage.setItem('userProfile', JSON.stringify({
                    id: session.user.id,
                    full_name: session.user.email?.split('@')[0] || 'Utilizador',
                    role: 'default',
                    email: session.user.email
                }));
                console.log("Perfil não encontrado, usando dados básicos da sessão.");
            }
        } catch (e) {
            console.error("Erro ao processar perfil:", e);
            // Garantir que há pelo menos um perfil básico
            localStorage.setItem('userProfile', JSON.stringify({
                id: session.user.id,
                full_name: session.user.email?.split('@')[0] || 'Utilizador',
                role: 'default',
                email: session.user.email
            }));
        }
        
        window.showPagePrincipal('dashboard');
        return true;
    } catch (e) {
        console.error("Erro ao verificar autenticação:", e);
        window.showPagePrincipal('login');
        return false;
    }
}

// Login de utilizador
window.signInUser = async function(email, password) {
    console.log("auth_global.js: Tentando login para:", email);
    
    const supabase = getSupabase();
    if (!supabase) {
        console.error("signInUser: Supabase client não disponível.");
        return false;
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            console.error("Erro no login:", error.message);
            return false;
        }
        
        console.log("Login bem-sucedido para:", email);
        
        // Verificar autenticação para carregar perfil e mostrar dashboard
        await window.checkAuthStatus();
        return true;
    } catch (e) {
        console.error("Erro ao processar login:", e);
        return false;
    }
}

// Logout de utilizador
window.handleLogoutGlobal = async function() {
    const supabase = getSupabase();
    if (!supabase) {
        console.error("handleLogoutGlobal: Supabase client não disponível.");
        localStorage.clear();
        window.showPagePrincipal('login');
        return;
    }

    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Erro ao fazer logout:", error.message);
        }
    } catch (e) {
        console.error("Erro ao processar logout:", e);
    }
    
    // Limpar dados locais e mostrar tela de login
    localStorage.clear();
    window.showPagePrincipal('login');
}

// Configurar listener para mudanças de autenticação
try {
    const supabase = getSupabase();
    if (supabase) {
        supabase.auth.onAuthStateChange((event, session) => {
            console.log("auth_global.js: Evento onAuthStateChange:", event);
            
            if (event === 'SIGNED_OUT') {
                localStorage.clear();
                window.showPagePrincipal('login');
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                window.checkAuthStatus();
            }
        });
    }
} catch (e) {
    console.error("Erro ao configurar listener de autenticação:", e);
}

console.log("auth_global.js carregado.");

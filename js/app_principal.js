// js/app_principal.js - Lógica para index.html (Login, Dashboard e Navegação) (REVISTO v13 - Restauração de layout e funcionalidades)

document.addEventListener('DOMContentLoaded', () => {
    console.log("app_principal.js: DOMContentLoaded acionado.");

    const loginPageEl = document.getElementById('loginPagePrincipal');
    const dashboardPageEl = document.getElementById('dashboardPagePrincipal');
    const loginFormEl = document.getElementById('loginFormPrincipal');
    const loginErrorMessageEl = document.getElementById('loginErrorMessagePrincipal');
    const userNamePrincipalEl = document.getElementById('userNamePrincipal');
    const parkSelectorPrincipalEl = document.getElementById('parkSelectorPrincipal');
    const logoutButtonEl = document.getElementById('logoutButtonPrincipal');
    const dashboardGridPrincipalEl = document.getElementById('dashboardGridPrincipal');

    if (!loginPageEl) console.error("ERRO CRÍTICO app_principal: Elemento 'loginPagePrincipal' não encontrado!");
    if (!dashboardPageEl) console.error("ERRO CRÍTICO app_principal: Elemento 'dashboardPagePrincipal' não encontrado!");
    if (typeof window.getSupabaseClient !== 'function') console.error("ERRO CRÍTICO app_principal: Função getSupabaseClient não definida!");

    // Mapeamento entre IDs das subaplicações e nomes reais dos ficheiros HTML
    const fileNameMapping = {
        'reservas': 'reservas_v2.html',
        'recolhas': 'recolhas_v2.html',
        'entregas': 'entregas_v2.html',
        'cancelamentos': 'cancelamentos_v2.html',
        'caixa_multipark': 'Caixa Multipark.html',
        'fecho_caixa': 'fecho_caixa_v2.html',
        'confirmacao_caixa': 'confirmacao_caixa_v2.html',
        'perdidos_achados': 'perdidos_achados.html',
        'formacao_apoio': 'formacao_apoio.html',
        'gestao_utilizadores': 'gestao_utilizadores.html',
        'gestao_parques': 'gestao_parques.html',
        'relatorios': 'relatorios.html',
        'estatisticas': 'estatisticas.html',
        'configuracoes': 'configuracoes.html',
        'manutencao': 'manutencao.html',
        'gestao_veiculos': 'gestao_veiculos.html',
        'gestao_clientes': 'gestao_clientes.html',
        'gestao_contratos': 'gestao_contratos.html',
        'gestao_faturas': 'gestao_faturas.html',
        'gestao_pagamentos': 'gestao_pagamentos.html',
        'gestao_reclamacoes': 'gestao_reclamacoes.html',
        'gestao_eventos': 'gestao_eventos.html',
        'gestao_promocoes': 'gestao_promocoes.html',
        'gestao_tarifas': 'gestao_tarifas.html'
    };

    // Definição das Subaplicações (lista completa conforme documento original)
    const subApplications = [
        { id: 'reservas', name: 'Reservas', category: 'Operacional' },
        { id: 'recolhas', name: 'Recolhas', category: 'Operacional' },
        { id: 'entregas', name: 'Entregas', category: 'Operacional' },
        { id: 'cancelamentos', name: 'Cancelamentos', category: 'Operacional' },
        { id: 'caixa_multipark', name: 'Caixa Multipark', category: 'Operacional' },
        { id: 'fecho_caixa', name: 'Fecho de Caixa', category: 'Operacional' },
        { id: 'confirmacao_caixa', name: 'Confirmação de Caixa', category: 'Operacional' },
        { id: 'perdidos_achados', name: 'Perdidos e Achados', category: 'Suporte' },
        { id: 'formacao_apoio', name: 'Formação e Apoio', category: 'Suporte' },
        { id: 'gestao_utilizadores', name: 'Gestão de Utilizadores', category: 'Administração' },
        { id: 'gestao_parques', name: 'Gestão de Parques', category: 'Administração' },
        { id: 'relatorios', name: 'Relatórios', category: 'Análise' },
        { id: 'estatisticas', name: 'Estatísticas', category: 'Análise' },
        { id: 'configuracoes', name: 'Configurações', category: 'Sistema' },
        { id: 'manutencao', name: 'Manutenção', category: 'Sistema' },
        { id: 'gestao_veiculos', name: 'Gestão de Veículos', category: 'Operacional' },
        { id: 'gestao_clientes', name: 'Gestão de Clientes', category: 'Operacional' },
        { id: 'gestao_contratos', name: 'Gestão de Contratos', category: 'Operacional' },
        { id: 'gestao_faturas', name: 'Gestão de Faturas', category: 'Financeiro' },
        { id: 'gestao_pagamentos', name: 'Gestão de Pagamentos', category: 'Financeiro' },
        { id: 'gestao_reclamacoes', name: 'Gestão de Reclamações', category: 'Suporte' },
        { id: 'gestao_eventos', name: 'Gestão de Eventos', category: 'Operacional' },
        { id: 'gestao_promocoes', name: 'Gestão de Promoções', category: 'Marketing' },
        { id: 'gestao_tarifas', name: 'Gestão de Tarifas', category: 'Financeiro' }
    ];

    // Lista completa de IDs de todas as subaplicações para facilitar a criação das listas de permissões
    const allAppIds = subApplications.map(app => app.id);

    // ##################################################################################
    // # PERMISSÕES DE ACESSO ÀS SUBAPLICAÇÕES POR ROLE                               #
    // # Simplificado para garantir acesso a todas as subaplicações disponíveis        #
    // ##################################################################################
    const permissoesPorRole = {
        'super_admin': allAppIds, // Vê tudo
        'super admin': allAppIds, // Vê tudo (versão com espaço)
        'admin': allAppIds,
        'supervisor': allAppIds,
        'back_office': allAppIds,
        'front_office': allAppIds,
        'team_leader': allAppIds,
        'user': allAppIds,
        'operador_caixa': allAppIds,
        'default': allAppIds // Todos os utilizadores veem todas as subaplicações disponíveis
    };

    window.showPagePrincipal = function(pageToShow) {
        console.log("app_principal.js: showPagePrincipal chamada com:", pageToShow);
        if (loginPageEl) loginPageEl.classList.add('hidden');
        if (dashboardPageEl) dashboardPageEl.classList.add('hidden');
        
        if (pageToShow === 'login' && loginPageEl) {
            loginPageEl.classList.remove('hidden');
        } else if (pageToShow === 'dashboard' && dashboardPageEl) {
            dashboardPageEl.classList.remove('hidden');
        } else {
            console.warn("showPagePrincipal: Página desconhecida ou elemento não encontrado:", pageToShow);
            if(loginPageEl) loginPageEl.classList.remove('hidden');
        }
    }

    function renderDashboardButtons() {
        if (!dashboardGridPrincipalEl) {
            console.error("Elemento dashboardGridPrincipal não encontrado para renderizar botões.");
            return;
        }
        dashboardGridPrincipalEl.innerHTML = ''; 
        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        const userRole = userProfile?.role || 'default';

        console.log("Renderizando botões para o role:", userRole);

        // Mostrar todas as subaplicações disponíveis, independentemente do role
        const appsFiltradas = subApplications;

        if (appsFiltradas.length === 0) {
            dashboardGridPrincipalEl.innerHTML = '<p class="text-center text-gray-500 col-span-full">Não há subaplicações disponíveis.</p>';
        }

        appsFiltradas.sort((a, b) => a.name.localeCompare(b.name)).forEach(app => {
            const button = document.createElement('button');
            button.className = 'subapp-button-principal';
            button.dataset.appId = app.id;
            button.innerHTML = `<span>${app.name.toUpperCase()}</span>`; 
            
            button.addEventListener('click', () => {
                // Usar o mapeamento para encontrar o nome correto do ficheiro HTML
                const fileName = fileNameMapping[app.id] || `${app.id}.html`;
                window.location.href = fileName;
            });
            dashboardGridPrincipalEl.appendChild(button);
        });
    }

    window.updateDashboardHeader = async function() {
        const userProfileData = JSON.parse(localStorage.getItem('userProfile') || '{}');
        
        let userName = 'Utilizador';
        if (userProfileData) {
            userName = userProfileData.full_name || userProfileData.username || userProfileData.email?.split('@')[0] || 'Utilizador';
        }
        
        if (userNamePrincipalEl) userNamePrincipalEl.textContent = userName.toUpperCase();

        if (parkSelectorPrincipalEl) {
            try {
                const supabase = window.getSupabaseClient ? window.getSupabaseClient() : null;
                if (!supabase) {
                    console.error("updateDashboardHeader: Supabase client não disponível.");
                    return;
                }
                
                // Verificar se a tabela 'parques' existe
                const { data: parques, error } = await supabase.from('parques').select('id_pk, nome_parque, cidade').eq('ativo', true).order('nome_parque');
                
                if (error) {
                    console.error("Erro ao carregar parques para o seletor:", error);
                    // Adicionar opção padrão se não conseguir carregar parques
                    parkSelectorPrincipalEl.innerHTML = '';
                    const defaultOption = document.createElement('option');
                    defaultOption.value = "default";
                    defaultOption.textContent = "PARQUE PADRÃO";
                    parkSelectorPrincipalEl.appendChild(defaultOption);
                } else if (parques && parques.length > 0) {
                    parkSelectorPrincipalEl.innerHTML = ''; 
                    parques.forEach(parque => {
                        const option = document.createElement('option');
                        option.value = parque.id_pk; 
                        option.textContent = `${parque.nome_parque.toUpperCase()} (${parque.cidade || 'N/A'})`;
                        parkSelectorPrincipalEl.appendChild(option);
                    });
                } else {
                    // Nenhum parque encontrado ou tabela vazia
                    parkSelectorPrincipalEl.innerHTML = '';
                    const defaultOption = document.createElement('option');
                    defaultOption.value = "default";
                    defaultOption.textContent = "NENHUM PARQUE DISPONÍVEL";
                    parkSelectorPrincipalEl.appendChild(defaultOption);
                }

                const storedParkId = localStorage.getItem('parqueSelecionadoMultiparkId');
                const userAssociatedParkId = userProfileData?.parque_associado_id;

                if (storedParkId && parkSelectorPrincipalEl.querySelector(`option[value="${storedParkId}"]`)) {
                    parkSelectorPrincipalEl.value = storedParkId;
                } else if (userAssociatedParkId && parkSelectorPrincipalEl.querySelector(`option[value="${userAssociatedParkId}"]`)) {
                    parkSelectorPrincipalEl.value = userAssociatedParkId;
                    localStorage.setItem('parqueSelecionadoMultiparkId', userAssociatedParkId);
                } else if (parkSelectorPrincipalEl.options.length > 0) {
                    parkSelectorPrincipalEl.value = parkSelectorPrincipalEl.options[0].value;
                    localStorage.setItem('parqueSelecionadoMultiparkId', parkSelectorPrincipalEl.options[0].value);
                }
                
                // Adicionar opção "TODOS OS PARQUES" para super_admin
                const existingAllParksOption = parkSelectorPrincipalEl.querySelector('option[value="todos"]');
                const isSuperAdmin = userProfileData?.role === 'super_admin' || userProfileData?.role === 'super admin';
                
                if (isSuperAdmin) {
                    if (!existingAllParksOption) {
                        const allParksOption = document.createElement('option');
                        allParksOption.value = "todos"; 
                        allParksOption.textContent = "TODOS OS PARQUES";
                        parkSelectorPrincipalEl.appendChild(allParksOption); 
                    }
                } else {
                    if (existingAllParksOption) existingAllParksOption.remove();
                }
            } catch (e) {
                console.error("Erro ao atualizar seletor de parques:", e);
                // Garantir que há pelo menos uma opção no seletor
                if (parkSelectorPrincipalEl.options.length === 0) {
                    const defaultOption = document.createElement('option');
                    defaultOption.value = "default";
                    defaultOption.textContent = "PARQUE PADRÃO";
                    parkSelectorPrincipalEl.appendChild(defaultOption);
                }
            }
        }
    }

    if (loginFormEl) {
        loginFormEl.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('emailPrincipal').value;
            const password = document.getElementById('passwordPrincipal').value;
            
            if (loginErrorMessageEl) {
                loginErrorMessageEl.classList.add('hidden');
                loginErrorMessageEl.textContent = '';
            }

            if (typeof window.signInUser === 'function') { 
                const success = await window.signInUser(email, password);
                if (success) {
                    await window.updateDashboardHeader(); 
                    renderDashboardButtons(); 
                } else {
                    if (loginErrorMessageEl) {
                        loginErrorMessageEl.textContent = "Email ou palavra-passe inválidos. Tente novamente.";
                        loginErrorMessageEl.classList.remove('hidden');
                    }
                }
            } else {
                console.error("Função signInUser não definida em auth_global.js.");
                if (loginErrorMessageEl) {
                    loginErrorMessageEl.textContent = "Erro no sistema de login. Contacte o suporte.";
                    loginErrorMessageEl.classList.remove('hidden');
                }
            }
        });
    }

    if (logoutButtonEl) {
        logoutButtonEl.addEventListener('click', async () => {
            console.log("Botão de logout clicado");
            if (typeof window.handleLogoutGlobal === 'function') { 
                await window.handleLogoutGlobal();
            } else {
                console.error("Função handleLogoutGlobal não definida em auth_global.js.");
                localStorage.clear(); 
                if(typeof window.showPagePrincipal === 'function') window.showPagePrincipal('login');
            }
        });
    }
    
    if (parkSelectorPrincipalEl) {
        parkSelectorPrincipalEl.addEventListener('change', (event) => {
            const selectedParkId = event.target.value;
            localStorage.setItem('parqueSelecionadoMultiparkId', selectedParkId);
            console.log("Parque selecionado (ID) alterado para:", selectedParkId);
            const parkChangedEvent = new CustomEvent('parkChanged', { detail: { parqueId: selectedParkId } });
            window.dispatchEvent(parkChangedEvent);
            console.log("Evento parkChanged disparado.");
        });
    }

    async function initPrincipalPage() {
        console.log("app_principal.js: initPrincipalPage chamada.");
        if (typeof window.checkAuthStatus === 'function') { 
            const isAuthenticated = await window.checkAuthStatus(); 
            if (isAuthenticated) {
                await window.updateDashboardHeader(); 
                renderDashboardButtons(); 
            }
        } else {
            console.error("initPrincipalPage: função checkAuthStatus não encontrada em auth_global.js!");
            if(typeof window.showPagePrincipal === 'function') window.showPagePrincipal('login'); 
        }
    }
    
    // Inicializar a página após um pequeno atraso para garantir que todos os scripts foram carregados
    setTimeout(() => {
        initPrincipalPage();
    }, 100);
});

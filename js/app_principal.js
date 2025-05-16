// js/app_principal.js - Lógica para index.html (Login, Dashboard e Navegação) (REVISTO v11 - Compatibilidade com Supabase)

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

    // Definição das Subaplicações (IDs devem corresponder aos nomes dos ficheiros HTML)
    const subApplications = [
        { id: 'reservas', name: 'Reservas', category: 'Operacional' },
        { id: 'recolhas', name: 'Recolhas', category: 'Operacional' },
        { id: 'entregas', name: 'Entregas', category: 'Operacional' },
        { id: 'cancelamentos', name: 'Cancelamentos', category: 'Operacional' },
        { id: 'caixa_multipark', name: 'Caixa Multipark', category: 'Operacional' },
        { id: 'fecho_caixa', name: 'Fecho de Caixa', category: 'Operacional' },
        { id: 'confirmacao_caixa', name: 'Confirmação de Caixa', category: 'Operacional' },
        { id: 'marketing', name: 'Marketing', category: 'Análises' },
        { id: 'relatorios', name: 'Relatórios', category: 'Análises' },
        { id: 'produtividade_condutores', name: 'Produtividade Condutores', category: 'Análises' },
        { id: 'comportamentos', name: 'Comportamentos', category: 'Análises' },
        { id: 'mapa_ocupacao', name: 'Mapa de Ocupação', category: 'Análises' },
        { id: 'bi_interno', name: 'BI Interno', category: 'Análises' },
        { id: 'despesas', name: 'Despesas', category: 'Gestão' },
        { id: 'faturacao', name: 'Faturação', category: 'Gestão' },
        { id: 'recursos_humanos', name: 'Recursos Humanos', category: 'Gestão' },
        { id: 'projetos', name: 'Projetos', category: 'Gestão' },
        { id: 'tarefas', name: 'Tarefas', category: 'Gestão' },
        { id: 'formacao_apoio', name: 'Formação e Apoio', category: 'Suporte' },
        { id: 'perdidos_achados', name: 'Perdidos e Achados', category: 'Suporte' },
        { id: 'comentarios_reclamacoes', name: 'Comentários e Reclamações', category: 'Suporte' },
        { id: 'auditorias_internas', name: 'Auditorias Internas', category: 'Suporte' },
        { id: 'acessos_alteracoes', name: 'Acessos e Alterações', category: 'Administração' }
    ];

    // Lista completa de IDs de todas as subaplicações para facilitar a criação das listas de permissões
    const allAppIds = subApplications.map(app => app.id);

    // ##################################################################################
    // # PERMISSÕES DE ACESSO ÀS SUBAPLICAÇÕES POR ROLE                               #
    // # Ajustado conforme as tuas últimas indicações.                                #
    // ##################################################################################
    const permissoesPorRole = {
        'super_admin': allAppIds, // Vê tudo
        'super admin': allAppIds, // Vê tudo (versão com espaço)

        'admin': allAppIds.filter(id => ![
            'bi_interno', 
            'comportamentos', 
            'relatorios', 
            'marketing'
        ].includes(id)),

        'supervisor': allAppIds.filter(id => ![
            'bi_interno', 
            'comportamentos', 
            'relatorios', 
            'marketing', 
            'perdidos_achados', 
            'confirmacao_caixa'
        ].includes(id)),

        'back_office': [ // Não vê o que o admin não vê, e tem a sua própria lista.
            // O que o admin vê, MENOS o que o back_office especificamente não vê ou o que é adicionado.
            // Baseado na tua descrição: "o back Office ... não veem as mesmas coisas que o admin vêem"
            // E "o backoffice v e não veem faturação" - interpretei como "o backoffice vê X, e também vê faturação, mas não vê Y (que admin não vê)".
            // Vamos construir a lista do back_office com base no que o admin vê, e depois ajustar.
            // Admin não vê: 'bi_interno', 'comportamentos', 'relatorios', 'marketing'.
            // Back office também não vê estes.
            // Back office VÊ: 'perdidos_achados', 'confirmacao_caixa', 'faturacao'.
            // (Estes já estão na lista do admin, exceto os que o admin não vê)
            // Para ser diferente do admin, o back_office teria que ter MENOS acesso a algumas coisas que o admin tem,
            // ou acesso a coisas que o admin não tem (o que não é o caso aqui, pois as restrições são as mesmas).
            // A forma mais clara é listar explicitamente o que o back_office vê, garantindo que não inclui os proibidos.
            'reservas', 'recolhas', 'entregas', 'cancelamentos', 'caixa_multipark', 'fecho_caixa', 'confirmacao_caixa',
            'despesas', 'faturacao', 'recursos_humanos', 'projetos', 'tarefas', 'formacao_apoio',
            'perdidos_achados', 'comentarios_reclamacoes', 'auditorias_internas', 'acessos_alteracoes',
            'mapa_ocupacao', 'produtividade_condutores' // Adicionando alguns que o admin vê e que podem ser relevantes para BO. Ajustar.
        ].filter(id => !['bi_interno', 'comportamentos', 'relatorios', 'marketing'].includes(id)),


        'front_office': [
            // Não vê o que o admin não vê.
            // Vê 'perdidos_achados'.
            // NÃO VÊ 'confirmacao_caixa'.
            'reservas', 'recolhas', 'entregas', 'cancelamentos', 'caixa_multipark', 'fecho_caixa',
            /* 'confirmacao_caixa', -- Removido conforme indicação */
            'despesas', /* 'faturacao', -- Front office normalmente não faz faturação completa, mas pode consultar. Ajustar. */
            'projetos', 'tarefas', 'formacao_apoio', 'perdidos_achados', 'comentarios_reclamacoes',
            'auditorias_internas', 'mapa_ocupacao'
             // 'acessos_alteracoes' e 'recursos_humanos' tipicamente não são para front_office.
        ].filter(id => !['bi_interno', 'comportamentos', 'relatorios', 'marketing', 'confirmacao_caixa', 'faturacao', 'recursos_humanos', 'acessos_alteracoes'].includes(id)),
        // Lista final para front_office (após filtro):
        // 'reservas', 'recolhas', 'entregas', 'cancelamentos', 'caixa_multipark', 'fecho_caixa',
        // 'despesas', 'projetos', 'tarefas', 'formacao_apoio', 'perdidos_achados', 'comentarios_reclamacoes',
        // 'auditorias_internas', 'mapa_ocupacao'


        'team_leader': [
            'recolhas', 'entregas', 'despesas', 'faturacao', // "fatura semanal" mapeada para 'faturacao'
            'projetos', 'tarefas', 'reservas', 'cancelamentos', 'caixa_multipark',
            'formacao_apoio', 'comentarios_reclamacoes'
        ],

        'user': [ // Role mais básico
            'recolhas', 'entregas', 'reservas', 'tarefas', 'projetos', 'formacao_apoio'
        ],
        
        'operador_caixa': [ // Mantendo o exemplo anterior, mas ajustando se necessário
            'caixa_multipark', 'fecho_caixa', 'confirmacao_caixa', 'reservas' // 'reservas_consulta_simples' mudado para 'reservas'
        ],
        
        'default': ['formacao_apoio'] // O que um role desconhecido ou sem permissões específicas vê
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

        const idsAppsPermitidas = permissoesPorRole[userRole] || permissoesPorRole['default'] || [];
        const appsFiltradas = subApplications.filter(app => idsAppsPermitidas.includes(app.id));

        if (appsFiltradas.length === 0) {
            dashboardGridPrincipalEl.innerHTML = '<p class="text-center text-gray-500 col-span-full">Não tem permissão para aceder a nenhuma subaplicação.</p>';
        }

        appsFiltradas.sort((a, b) => a.name.localeCompare(b.name)).forEach(app => {
            const button = document.createElement('button');
            button.className = 'subapp-button-principal';
            button.dataset.appId = app.id;
            button.innerHTML = `<span>${app.name.toUpperCase()}</span>`; 
            
            button.addEventListener('click', () => {
                window.location.href = `${app.id}.html`;
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

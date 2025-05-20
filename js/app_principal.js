// js/app_principal.js - Lógica para index.html (Login, Dashboard e Navegação) (REVISTO v14 - Correção do seletor de parques)

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
        'reservas': 'reservas.html',
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

        // Organizar aplicações por categoria
        const categorias = {
            'Operacional': [],
            'Gestão': [],
            'Administração e Suporte': [],
            'Análises': []
        };

        // Mapear categorias originais para as categorias do layout
        const mapeamentoCategorias = {
            'Operacional': 'Operacional',
            'Suporte': 'Administração e Suporte',
            'Administração': 'Administração e Suporte',
            'Análise': 'Análises',
            'Sistema': 'Administração e Suporte',
            'Financeiro': 'Gestão',
            'Marketing': 'Gestão'
        };

        // Distribuir aplicações nas categorias
        subApplications.forEach(app => {
            const categoriaOriginal = app.category;
            const categoriaFinal = mapeamentoCategorias[categoriaOriginal] || 'Operacional';
            
            if (categorias[categoriaFinal]) {
                categorias[categoriaFinal].push(app);
            } else {
                categorias['Operacional'].push(app);
            }
        });

        // Criar seções para cada categoria
        Object.keys(categorias).forEach(categoria => {
            const apps = categorias[categoria];
            if (apps.length === 0) return;

            // Criar cabeçalho da categoria
            const categoriaHeader = document.createElement('div');
            categoriaHeader.className = 'categoria-header';
            categoriaHeader.style.width = '100%';
            categoriaHeader.style.borderBottom = '2px solid #0A2B5C';
            categoriaHeader.style.marginBottom = '1rem';
            categoriaHeader.style.paddingBottom = '0.5rem';
            categoriaHeader.style.fontSize = '1.25rem';
            categoriaHeader.style.fontWeight = 'bold';
            categoriaHeader.style.color = '#0A2B5C';
            categoriaHeader.textContent = categoria;
            dashboardGridPrincipalEl.appendChild(categoriaHeader);

            // Criar container para os botões desta categoria
            const categoriaBotoes = document.createElement('div');
            categoriaBotoes.className = 'categoria-botoes';
            categoriaBotoes.style.display = 'grid';
            categoriaBotoes.style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
            categoriaBotoes.style.gap = '1rem';
            categoriaBotoes.style.marginBottom = '2rem';
            categoriaBotoes.style.width = '100%';

            // Adicionar botões da categoria
            apps.sort((a, b) => a.name.localeCompare(b.name)).forEach(app => {
                const button = document.createElement('button');
                button.className = 'subapp-button-principal';
                button.dataset.appId = app.id;
                button.innerHTML = `<span>${app.name.toUpperCase()}</span>`; 
                
                button.addEventListener('click', () => {
                    // Usar o mapeamento para encontrar o nome correto do ficheiro HTML
                    const fileName = fileNameMapping[app.id] || `${app.id}.html`;
                    window.location.href = fileName;
                });
                categoriaBotoes.appendChild(button);
            });

            dashboardGridPrincipalEl.appendChild(categoriaBotoes);
        });
    }

    // Função para carregar os parques do Supabase com múltiplas tentativas e fallback
    async function carregarParques() {
        try {
            console.log("Iniciando carregamento de parques...");
            
            // Verificar se o cliente Supabase está disponível
            if (!window.getSupabaseClient) {
                console.error("Cliente Supabase não disponível");
                return;
            }
            
            const supabase = window.getSupabaseClient();
            if (!supabase) {
                console.error("Falha ao obter cliente Supabase");
                return;
            }
            
            // Obter o seletor de parques
            const parkSelector = document.getElementById('parkSelectorPrincipal');
            if (!parkSelector) {
                console.error("Seletor de parques não encontrado");
                return;
            }
            
            // Limpar opções existentes
            parkSelector.innerHTML = '';
            
            // Adicionar opção de carregamento
            const loadingOption = document.createElement('option');
            loadingOption.textContent = 'Carregando parques...';
            parkSelector.appendChild(loadingOption);
            
            // Tentativa 1: Buscar parques da tabela 'parques' com campos id_pk, nome_parque, cidade
            let { data: parques, error } = await supabase
                .from('parques')
                .select('id_pk, nome_parque, cidade')
                .eq('ativo', true)
                .order('nome_parque');
            
            if (error || !parques || parques.length === 0) {
                console.log("Tentativa 1 falhou, tentando estrutura alternativa...");
                
                // Tentativa 2: Buscar parques da tabela 'parques' com campos id, nome, cidade
                ({ data: parques, error } = await supabase
                    .from('parques')
                    .select('id, nome, cidade')
                    .order('nome'));
                
                if (error || !parques || parques.length === 0) {
                    console.log("Tentativa 2 falhou, tentando tabela alternativa...");
                    
                    // Tentativa 3: Buscar parques da tabela 'parks'
                    ({ data: parques, error } = await supabase
                        .from('parks')
                        .select('id, name, city')
                        .order('name'));
                    
                    if (error || !parques || parques.length === 0) {
                        console.log("Todas as tentativas de busca falharam, usando fallback manual");
                        
                        // Fallback: Adicionar parques manualmente
                        parkSelector.innerHTML = '';
                        
                        const cidadesParques = [
                            { cidade: 'Lisboa', parques: ['Airpark Lisboa', 'Redpark Lisboa', 'Skypark Lisboa'] },
                            { cidade: 'Porto', parques: ['Airpark Porto', 'Redpark Porto', 'Skypark Porto'] },
                            { cidade: 'Faro', parques: ['Airpark Faro', 'Redpark Faro', 'Skypark Faro'] }
                        ];
                        
                        cidadesParques.forEach(cp => {
                            const optgroup = document.createElement('optgroup');
                            optgroup.label = cp.cidade;
                            
                            cp.parques.forEach((parque, index) => {
                                const option = document.createElement('option');
                                option.value = `${cp.cidade.toLowerCase()}_${index}`;
                                option.textContent = parque;
                                optgroup.appendChild(option);
                            });
                            
                            parkSelector.appendChild(optgroup);
                        });
                        
                        return;
                    } else {
                        // Adaptar dados da tabela 'parks'
                        parques = parques.map(p => ({
                            id: p.id,
                            nome: p.name,
                            cidade: p.city
                        }));
                    }
                } else {
                    // Adaptar dados da tabela 'parques' com campos id, nome, cidade
                    parques = parques.map(p => ({
                        id: p.id,
                        nome: p.nome,
                        cidade: p.cidade
                    }));
                }
            } else {
                // Adaptar dados da tabela 'parques' com campos id_pk, nome_parque, cidade
                parques = parques.map(p => ({
                    id: p.id_pk,
                    nome: p.nome_parque,
                    cidade: p.cidade
                }));
            }
            
            // Renderizar parques no seletor
            if (parques && parques.length > 0) {
                renderizarParques(parques);
            } else {
                console.warn("Nenhum parque encontrado na base de dados");
                
                // Adicionar parques manualmente como fallback
                parkSelector.innerHTML = '';
                
                const cidadesParques = [
                    { cidade: 'Lisboa', parques: ['Airpark Lisboa', 'Redpark Lisboa', 'Skypark Lisboa'] },
                    { cidade: 'Porto', parques: ['Airpark Porto', 'Redpark Porto', 'Skypark Porto'] },
                    { cidade: 'Faro', parques: ['Airpark Faro', 'Redpark Faro', 'Skypark Faro'] }
                ];
                
                cidadesParques.forEach(cp => {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = cp.cidade;
                    
                    cp.parques.forEach((parque, index) => {
                        const option = document.createElement('option');
                        option.value = `${cp.cidade.toLowerCase()}_${index}`;
                        option.textContent = parque;
                        optgroup.appendChild(option);
                    });
                    
                    parkSelector.appendChild(optgroup);
                });
            }
        } catch (error) {
            console.error("Erro ao carregar parques:", error);
            
            // Adicionar opção de erro
            const parkSelector = document.getElementById('parkSelectorPrincipal');
            if (parkSelector) {
                parkSelector.innerHTML = '';
                const errorOption = document.createElement('option');
                errorOption.textContent = 'Erro ao carregar parques';
                parkSelector.appendChild(errorOption);
            }
        }
    }

    // Função para renderizar os parques no seletor
    function renderizarParques(parques) {
        const parkSelector = document.getElementById('parkSelectorPrincipal');
        if (!parkSelector) return;
        
        // Limpar opções existentes
        parkSelector.innerHTML = '';
        
        // Agrupar parques por cidade
        const parquesPorCidade = {};
        parques.forEach(parque => {
            const cidade = parque.cidade || 'Sem Cidade';
            if (!parquesPorCidade[cidade]) {
                parquesPorCidade[cidade] = [];
            }
            parquesPorCidade[cidade].push(parque);
        });
        
        // Adicionar parques agrupados por cidade
        Object.keys(parquesPorCidade).forEach(cidade => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = cidade;
            
            parquesPorCidade[cidade].forEach(parque => {
                const option = document.createElement('option');
                option.value = parque.id;
                option.textContent = parque.nome;
                optgroup.appendChild(option);
            });
            
            parkSelector.appendChild(optgroup);
        });
        
        // Adicionar opção "TODOS OS PARQUES" para super_admin
        const userProfileData = JSON.parse(localStorage.getItem('userProfile') || '{}');
        const isSuperAdmin = userProfileData?.role === 'super_admin' || userProfileData?.role === 'super admin';
        
        if (isSuperAdmin) {
            const allParksOption = document.createElement('option');
            allParksOption.value = "todos"; 
            allParksOption.textContent = "TODOS OS PARQUES";
            parkSelector.appendChild(allParksOption);
        }
        
        // Selecionar parque armazenado ou primeiro disponível
        const storedParkId = localStorage.getItem('parqueSelecionadoMultiparkId');
        const userAssociatedParkId = userProfileData?.parque_associado_id;

        if (storedParkId && parkSelector.querySelector(`option[value="${storedParkId}"]`)) {
            parkSelector.value = storedParkId;
        } else if (userAssociatedParkId && parkSelector.querySelector(`option[value="${userAssociatedParkId}"]`)) {
            parkSelector.value = userAssociatedParkId;
            localStorage.setItem('parqueSelecionadoMultiparkId', userAssociatedParkId);
        } else if (parkSelector.options.length > 0) {
            parkSelector.value = parkSelector.options[0].value;
            localStorage.setItem('parqueSelecionadoMultiparkId', parkSelector.options[0].value);
        }
    }

    window.updateDashboardHeader = async function() {
        const userProfileData = JSON.parse(localStorage.getItem('userProfile') || '{}');
        
        let userName = 'Utilizador';
        if (userProfileData) {
            userName = userProfileData.full_name || userProfileData.username || userProfileData.email?.split('@')[0] || 'Utilizador';
        }
        
        if (userNamePrincipalEl) userNamePrincipalEl.textContent = userName.toUpperCase();

        if (parkSelectorPrincipalEl) {
            await carregarParques();
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
    setTimeout(initPrincipalPage, 100);
});

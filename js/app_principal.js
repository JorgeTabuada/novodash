// js/app_principal.js - Lógica para index.html (Login, Dashboard e Navegação) (REVISTO v15 - Correção do layout, utilizador e parques)

document.addEventListener('DOMContentLoaded', () => {
    console.log("app_principal.js: DOMContentLoaded acionado.");

    const loginPageEl = document.getElementById('loginPagePrincipal');
    const dashboardPageEl = document.getElementById('dashboardPagePrincipal');
    const loginFormEl = document.getElementById('loginFormPrincipal');
    const loginErrorMessageEl = document.getElementById('loginErrorMessagePrincipal');
    const userNamePrincipalEl = document.getElementById('userNamePrincipal');
    const parkSelectorPrincipalEl = document.getElementById('parkSelectorPrincipal');
    const logoutButtonEl = document.getElementById('logoutButtonPrincipal');
    const logoutButtonFooterEl = document.getElementById('logoutButtonFooter');

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
        'gestao_tarifas': 'gestao_tarifas.html',
        'despesas': 'despesas.html',
        'faturacao': 'faturacao.html',
        'horarios_ordenados': 'horarios_ordenados.html',
        'projetos': 'projetos.html',
        'tarefas': 'tarefas.html',
        'acessos_alteracoes': 'acessos_alteracoes.html',
        'auditorias_internas': 'auditorias_internas.html',
        'comentarios_reclamacoes': 'comentarios_reclamacoes.html',
        'bi_interno': 'bi_interno.html',
        'comportamentos': 'comportamentos.html',
        'mapa_ocupacao': 'mapa_ocupacao.html',
        'marketing': 'marketing.html',
        'produtividade_condutores': 'produtividade_condutores.html'
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
                        
                        // Adicionar opção Lisboa como padrão
                        const lisbonOption = document.createElement('option');
                        lisbonOption.value = "lisboa";
                        lisbonOption.textContent = "LISBOA";
                        parkSelector.appendChild(lisbonOption);
                        
                        // Adicionar outras cidades
                        const portoOption = document.createElement('option');
                        portoOption.value = "porto";
                        portoOption.textContent = "PORTO";
                        parkSelector.appendChild(portoOption);
                        
                        const faroOption = document.createElement('option');
                        faroOption.value = "faro";
                        faroOption.textContent = "FARO";
                        parkSelector.appendChild(faroOption);
                        
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
                
                // Adicionar opção Lisboa como padrão
                const lisbonOption = document.createElement('option');
                lisbonOption.value = "lisboa";
                lisbonOption.textContent = "LISBOA";
                parkSelector.appendChild(lisbonOption);
                
                // Adicionar outras cidades
                const portoOption = document.createElement('option');
                portoOption.value = "porto";
                portoOption.textContent = "PORTO";
                parkSelector.appendChild(portoOption);
                
                const faroOption = document.createElement('option');
                faroOption.value = "faro";
                faroOption.textContent = "FARO";
                parkSelector.appendChild(faroOption);
            }
        } catch (error) {
            console.error("Erro ao carregar parques:", error);
            
            // Adicionar opção de erro
            const parkSelector = document.getElementById('parkSelectorPrincipal');
            if (parkSelector) {
                parkSelector.innerHTML = '';
                // Adicionar opção Lisboa como padrão mesmo em caso de erro
                const lisbonOption = document.createElement('option');
                lisbonOption.value = "lisboa";
                lisbonOption.textContent = "LISBOA";
                parkSelector.appendChild(lisbonOption);
            }
        }
    }

    // Função para renderizar os parques no seletor
    function renderizarParques(parques) {
        const parkSelector = document.getElementById('parkSelectorPrincipal');
        if (!parkSelector) return;
        
        // Limpar opções existentes
        parkSelector.innerHTML = '';
        
        // Verificar se temos parques de Lisboa, Porto e Faro
        const cidadesDesejadas = ['Lisboa', 'Porto', 'Faro'];
        const cidadesEncontradas = new Set(parques.map(p => p.cidade));
        
        // Se não temos todas as cidades desejadas, usar fallback
        if (!cidadesDesejadas.every(cidade => cidadesEncontradas.has(cidade))) {
            // Adicionar opção Lisboa como padrão
            const lisbonOption = document.createElement('option');
            lisbonOption.value = "lisboa";
            lisbonOption.textContent = "LISBOA";
            parkSelector.appendChild(lisbonOption);
            
            // Adicionar outras cidades
            const portoOption = document.createElement('option');
            portoOption.value = "porto";
            portoOption.textContent = "PORTO";
            parkSelector.appendChild(portoOption);
            
            const faroOption = document.createElement('option');
            faroOption.value = "faro";
            faroOption.textContent = "FARO";
            parkSelector.appendChild(faroOption);
            
            return;
        }
        
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
        cidadesDesejadas.forEach(cidade => {
            if (parquesPorCidade[cidade] && parquesPorCidade[cidade].length > 0) {
                const option = document.createElement('option');
                option.value = cidade.toLowerCase();
                option.textContent = cidade.toUpperCase();
                parkSelector.appendChild(option);
            }
        });
        
        // Selecionar Lisboa por padrão
        if (parkSelector.options.length > 0) {
            const lisbonIndex = Array.from(parkSelector.options).findIndex(opt => 
                opt.textContent.toUpperCase() === 'LISBOA');
            
            if (lisbonIndex >= 0) {
                parkSelector.selectedIndex = lisbonIndex;
            } else {
                parkSelector.selectedIndex = 0;
            }
        }
    }

    window.updateDashboardHeader = async function() {
        const userProfileData = JSON.parse(localStorage.getItem('userProfile') || '{}');
        
        // Definir nome do utilizador
        let userName = 'JORGE.G.TABUADA!';
        if (userProfileData && userProfileData.email) {
            userName = userProfileData.full_name || 
                       userProfileData.username || 
                       userProfileData.email.split('@')[0] || 
                       'JORGE.G.TABUADA!';
            
            // Garantir que o nome está em maiúsculas e tem o formato correto
            userName = userName.toUpperCase() + '!';
        }
        
        if (userNamePrincipalEl) userNamePrincipalEl.textContent = userName;

        // Carregar parques
        if (parkSelectorPrincipalEl) {
            await carregarParques();
        }
    }

    // Configurar eventos de clique para todos os botões de subaplicação
    function configurarBotoesSubaplicacoes() {
        const botoes = document.querySelectorAll('.subapp-button-principal');
        botoes.forEach(botao => {
            botao.addEventListener('click', () => {
                const appId = botao.getAttribute('data-app-id');
                if (appId) {
                    const fileName = fileNameMapping[appId] || `${appId}.html`;
                    window.location.href = fileName;
                }
            });
        });
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
                    configurarBotoesSubaplicacoes();
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

    // Configurar botão de logout no cabeçalho
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
    
    // Configurar botão de logout no rodapé
    if (logoutButtonFooterEl) {
        logoutButtonFooterEl.addEventListener('click', async () => {
            console.log("Botão de logout do rodapé clicado");
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
                configurarBotoesSubaplicacoes();
            }
        } else {
            console.error("initPrincipalPage: função checkAuthStatus não encontrada em auth_global.js!");
            if(typeof window.showPagePrincipal === 'function') window.showPagePrincipal('login'); 
        }
    }
    
    // Inicializar a página após um pequeno atraso para garantir que todos os scripts foram carregados
    setTimeout(initPrincipalPage, 100);
});

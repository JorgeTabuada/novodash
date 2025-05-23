// js/marketing.js - Lógica para a Subaplicação de Análise de Marketing

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Marketing.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnMarketing');
    const fileGoogleAdsEl = document.getElementById('mktFileGoogleAds');
    const fileFacebookAdsEl = document.getElementById('mktFileFacebookAds');
    const fileGAEl = document.getElementById('mktFileGA');
    const fileInternoEl = document.getElementById('mktFileInterno');
    const processarImportacaoBtnEl = document.getElementById('mktProcessarImportacaoBtn');
    const importStatusEl = document.getElementById('mktImportStatus');
    const loadingImportSpinnerEl = document.getElementById('loadingMktImportSpinner');

    const periodoRangeEl = document.getElementById('mktPeriodoRange');
    const filtroParqueEl = document.getElementById('mktFiltroParque');
    const filtroCampanhaAdsEl = document.getElementById('mktFiltroCampanhaAds');
    const aplicarFiltrosBtnEl = document.getElementById('mktAplicarFiltrosBtn');
    const loadingDashboardSpinnerEl = document.getElementById('loadingMktDashboardSpinner');
    const resultadosSecaoEl = document.getElementById('mktResultadosSecao');

    // KPIs
    const kpiTotalReservasEl = document.getElementById('kpiMktTotalReservas');
    const kpiTotalAdSpendEl = document.getElementById('kpiMktTotalAdSpend');
    const kpiFaturacaoPotencialEl = document.getElementById('kpiMktFaturacaoPotencial');
    const kpiPercAdSpendEl = document.getElementById('kpiMktPercAdSpend');
    const kpiPMRGeralEl = document.getElementById('kpiMktPMRGeral');
    const kpiCMRGeralEl = document.getElementById('kpiMktCMRGeral');
    const kpiPMRTelefoneEl = document.getElementById('kpiMktPMRTelefone');
    const kpiCMRTelefoneEl = document.getElementById('kpiMktCMRTelefone');

    // Gráficos
    const chartReservasVsAdSpendEl = document.getElementById('mktChartReservasVsAdSpend');
    const chartReservasPorCampanhaEl = document.getElementById('mktChartReservasPorCampanha');
    const chartValorPorCampanhaEl = document.getElementById('mktChartValorPorCampanha');
    const chartTelefonePorUserEl = document.getElementById('mktChartTelefonePorUser');

    // Tabela
    const campanhasTableBodyEl = document.getElementById('mktCampanhasTableBody');
    const campanhasNenhumaMsgEl = document.getElementById('mktCampanhasNenhumaMsg');
    
    let fpDateRangeMarketing; // Flatpickr instance

    // --- Instâncias dos Gráficos ---
    let graficoReservasVsAdSpend, graficoReservasPorCampanha, graficoValorPorCampanha, graficoTelefonePorUser;
    
    // --- Estado da Aplicação ---
    let dadosGastosAdsImportados = [];
    let dadosGAImportados = [];
    let dadosInternosImportados = [];
    let listaParquesMkt = [];
    let listaCampanhasAdsMkt = []; // Para popular filtro de campanhas

    // --- Funções Auxiliares ---
    function mostrarSpinner(id, show = true) { document.getElementById(id)?.classList.toggle('hidden', !show); }
    function formatarMoeda(valor) { return parseFloat(valor || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }
    function formatarPercentagem(valor) { return `${(parseFloat(valor || 0) * 100).toFixed(1)}%`; }


    // --- Carregar Dados para Filtros ---
    async function carregarFiltrosMarketing() {
        const { data: parquesData, error: parquesError } = await supabase.from('parques').select('id, nome').order('nome');
        if (parquesError) console.error("Erro ao carregar parques para Marketing:", parquesError);
        else {
            listaParquesMkt = parquesData || [];
            filtroParqueEl.innerHTML = '<option value="">Todos os Parques</option>';
            listaParquesMkt.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.nome;
                filtroParqueEl.appendChild(opt);
            });
        }

        // Carregar campanhas distintas da tabela marketing_gastos_ads
        const { data: campanhasData, error: campanhasError } = await supabase.rpc('get_distinct_marketing_campaign_names'); // Criar esta RPC
        if (campanhasError) console.error("Erro ao carregar nomes de campanhas:", campanhasError);
        else {
            listaCampanhasAdsMkt = campanhasData ? campanhasData.map(c => c.nome_campanha_plataforma) : [];
            filtroCampanhaAdsEl.innerHTML = '<option value="">Todas as Campanhas</option>';
            listaCampanhasAdsMkt.forEach(nomeCampanha => {
                if(nomeCampanha) {
                    const opt = document.createElement('option');
                    opt.value = nomeCampanha;
                    opt.textContent = nomeCampanha;
                    filtroCampanhaAdsEl.appendChild(opt);
                }
            });
        }


        fpDateRangeMarketing = flatpickr(periodoRangeEl, {
            mode: "range", dateFormat: "Y-m-d",
            defaultDate: [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()], // Mês atual
            locale: { /* ... (configuração de locale pt) ... */ }
        });
    }

    // --- Lógica de Importação de Ficheiros ---
    processarImportacaoBtnEl.addEventListener('click', async () => {
        mostrarSpinner('loadingMktImportSpinner', true);
        importStatusEl.textContent = "A iniciar processamento dos ficheiros...";
        let statusMessages = [];

        // Processar Google Ads
        if (fileGoogleAdsEl.files[0]) {
            try {
                const data = JSON.parse(await fileGoogleAdsEl.files[0].text()); // Ou XLSX se for excel
                // TODO: Mapear colunas e inserir em `marketing_gastos_ads`
                // Ex: const gastosGoogle = data.map(row => ({ data_gasto: row.Day, plataforma: 'Google Ads', nome_campanha_plataforma: row.Campaign, valor_gasto: parseFloat(row.Cost) ... }));
                // const { error } = await supabase.from('marketing_gastos_ads').insert(gastosGoogle);
                // if (error) throw error;
                statusMessages.push("Ficheiro Google Ads processado (simulado).");
            } catch (e) { statusMessages.push(`Erro Google Ads: ${e.message}`); }
        }
        // Processar Facebook Ads (similar)
        // Processar Google Analytics (similar, para `marketing_dados_ga`)
        // Processar Ficheiro Interno (similar)
        
        await new Promise(r => setTimeout(r, 500)); // Simular
        
        importStatusEl.innerHTML = statusMessages.length > 0 ? statusMessages.join('<br>') : "Nenhum ficheiro selecionado para processar.";
        mostrarSpinner('loadingMktImportSpinner', false);
        await carregarFiltrosMarketing(); // Recarregar campanhas para o filtro
    });


    // --- Lógica do Dashboard de Marketing ---
    async function atualizarDashboardMarketing() {
        mostrarSpinner('loadingMktDashboardSpinner', true);
        resultadosSecaoEl.classList.add('opacity-50');

        const selectedDates = fpDateRangeMarketing.selectedDates;
        const dataInicio = selectedDates.length > 0 ? selectedDates[0].toISOString().split('T')[0] : null;
        const dataFim = selectedDates.length > 1 ? selectedDates[1].toISOString().split('T')[0] : (selectedDates.length > 0 ? selectedDates[0].toISOString().split('T')[0] : null);
        const parqueIdFiltro = filtroParqueEl.value || null;
        const campanhaAdsFiltro = filtroCampanhaAdsEl.value || null;

        console.log("Filtros Marketing:", { dataInicio, dataFim, parqueIdFiltro, campanhaAdsFiltro });

        try {
            // 1. Chamar RPC principal para os KPIs e dados dos gráficos
            const { data: biData, error: biError } = await supabase.rpc('get_marketing_dashboard_data', {
                p_data_inicio: dataInicio,
                p_data_fim: dataFim,
                p_parque_id: parqueIdFiltro,
                p_nome_campanha_ads: campanhaAdsFiltro
            });
            if (biError) throw biError;

            if (biData) {
                // Preencher KPIs
                kpiTotalReservasEl.textContent = biData.kpi_total_reservas || 0;
                kpiTotalAdSpendEl.textContent = formatarMoeda(biData.kpi_total_ad_spend);
                kpiFaturacaoPotencialEl.textContent = formatarMoeda(biData.kpi_faturacao_potencial);
                const percAdSpend = (biData.kpi_faturacao_potencial > 0 && biData.kpi_total_ad_spend > 0) ? (biData.kpi_total_ad_spend / biData.kpi_faturacao_potencial) : 0;
                kpiPercAdSpendEl.textContent = formatarPercentagem(percAdSpend);
                kpiPercAdSpendEl.className = `kpi-card-value ${percAdSpend > 0.2 ? 'kpi-alert' : ''}`;
                
                kpiPMRGeralEl.textContent = formatarMoeda(biData.kpi_pmr_geral);
                kpiCMRGeralEl.textContent = formatarMoeda(biData.kpi_cmr_geral);
                kpiPMRTelefoneEl.textContent = formatarMoeda(biData.kpi_pmr_telefone); // Assumindo que a RPC calcula isto
                kpiCMRTelefoneEl.textContent = formatarMoeda(biData.kpi_cmr_telefone); // Assumindo que a RPC calcula isto

                // Atualizar Gráficos
                if (graficoReservasVsAdSpend) {
                    graficoReservasVsAdSpend.data.labels = biData.chart_reservas_vs_adspend?.labels || [];
                    graficoReservasVsAdSpend.data.datasets[0].data = biData.chart_reservas_vs_adspend?.data_reservas || []; // Reservas
                    graficoReservasVsAdSpend.data.datasets[1].data = biData.chart_reservas_vs_adspend?.data_adspend || []; // Ad Spend
                    graficoReservasVsAdSpend.update();
                }
                if (graficoReservasPorCampanha) {
                    graficoReservasPorCampanha.data.labels = biData.chart_reservas_por_campanha?.labels || [];
                    graficoReservasPorCampanha.data.datasets[0].data = biData.chart_reservas_por_campanha?.data_contagem || [];
                    graficoReservasPorCampanha.update();
                }
                if (graficoValorPorCampanha) {
                    graficoValorPorCampanha.data.labels = biData.chart_valor_por_campanha?.labels || [];
                    graficoValorPorCampanha.data.datasets[0].data = biData.chart_valor_por_campanha?.data_valor || [];
                    graficoValorPorCampanha.update();
                }
                if (graficoTelefonePorUser) {
                    graficoTelefonePorUser.data.labels = biData.chart_telefone_por_user?.labels || [];
                    graficoTelefonePorUser.data.datasets[0].data = biData.chart_telefone_por_user?.data_contagem || [];
                    graficoTelefonePorUser.update();
                }
                
                // Atualizar Tabela Detalhada de Campanhas
                renderTabelaCampanhas(biData.tabela_detalhe_campanhas || []);
            }

        } catch (error) {
            console.error("Erro ao atualizar dashboard Marketing:", error);
            alert(`Erro ao carregar dados do BI de Marketing: ${error.message}`);
        } finally {
            mostrarSpinner('loadingMktDashboardSpinner', false);
            resultadosSecaoEl.classList.remove('opacity-50');
        }
    }
    
    // --- Funções de Renderização de Gráficos ---
    function setupGraficosMarketing() {
        if (chartReservasVsAdSpendEl) {
            const ctx = chartReservasVsAdSpendEl.getContext('2d');
            graficoReservasVsAdSpend = new Chart(ctx, {
                type: 'bar',
                data: { labels: [], datasets: [
                    { label: 'Nº Reservas', data: [], backgroundColor: 'rgba(54, 162, 235, 0.7)', yAxisID: 'yReservas' },
                    { label: 'Ad Spend (€)', data: [], backgroundColor: 'rgba(255, 99, 132, 0.7)', yAxisID: 'yAdSpend', type: 'line' }
                ]},
                options: { responsive: true, scales: { 
                    yReservas: { type: 'linear', display: true, position: 'left', beginAtZero: true, title: {display: true, text: 'Nº Reservas'} },
                    yAdSpend: { type: 'linear', display: true, position: 'right', beginAtZero: true, title: {display: true, text: 'Ad Spend (€)'}, grid: { drawOnChartArea: false } }
                }}
            });
        }
        if (chartReservasPorCampanhaEl) {
            const ctx = chartReservasPorCampanhaEl.getContext('2d');
            graficoReservasPorCampanha = new Chart(ctx, {
                type: 'bar', data: { labels: [], datasets: [{ label: 'Nº Reservas', data: [], backgroundColor: 'rgba(75, 192, 192, 0.7)' }] },
                options: { responsive: true, indexAxis: 'y', scales: { x: { beginAtZero: true } } }
            });
        }
         if (chartValorPorCampanhaEl) {
            const ctx = chartValorPorCampanhaEl.getContext('2d');
            graficoValorPorCampanha = new Chart(ctx, {
                type: 'bar', data: { labels: [], datasets: [{ label: 'Valor Reservas (€)', data: [], backgroundColor: 'rgba(153, 102, 255, 0.7)' }] },
                options: { responsive: true, indexAxis: 'y', scales: { x: { beginAtZero: true } } }
            });
        }
        if (chartTelefonePorUserEl) {
            const ctx = chartTelefonePorUserEl.getContext('2d');
            graficoTelefonePorUser = new Chart(ctx, {
                type: 'pie', data: { labels: [], datasets: [{ data: [], backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'] }] },
                options: { responsive: true, plugins: { legend: {position: 'bottom'} } }
            });
        }
    }
    
    // --- Renderizar Tabela Detalhada de Campanhas ---
    function renderTabelaCampanhas(campanhas) {
        campanhasTableBodyEl.innerHTML = '';
        if (!campanhas || campanhas.length === 0) {
            campanhasNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        campanhasNenhumaMsgEl.classList.add('hidden');
        campanhas.forEach(camp => {
            const tr = document.createElement('tr');
            const custoPorReserva = (camp.num_reservas > 0 && camp.gasto_total > 0) ? (camp.gasto_total / camp.num_reservas) : 0;
            const roas = (camp.valor_reservas > 0 && camp.gasto_total > 0) ? (camp.valor_reservas / camp.gasto_total) : 0;
            tr.innerHTML = `
                <td>${camp.nome_campanha_plataforma}</td>
                <td>${camp.plataforma}</td>
                <td>${camp.parque_nome || 'Todos'}</td>
                <td>${formatarMoeda(camp.gasto_total)}</td>
                <td>${camp.num_reservas || 0}</td>
                <td>${formatarMoeda(camp.valor_reservas)}</td>
                <td>${formatarMoeda(custoPorReserva)}</td>
                <td>${roas.toFixed(2)}</td>
            `;
            campanhasTableBodyEl.appendChild(tr);
        });
    }

    // --- Event Listeners ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (aplicarFiltrosBtnEl) aplicarFiltrosBtnEl.addEventListener('click', atualizarDashboardMarketing);

    // --- Inicialização da Página ---
    async function initMarketingPage() {
        if (!userProfile || (userProfile.role !== 'super_admin' && userProfile.role !== 'admin' && userProfile.role !== 'marketing_user')) { // Ajustar roles com acesso
            alert("Não tem permissão para aceder a este módulo.");
            window.location.href = 'index.html';
            return;
        }
        setupGraficosMarketing();
        await carregarFiltrosMarketing();
        await atualizarDashboardMarketing(); // Carregar com filtros padrão
        console.log("Subaplicação de Marketing inicializada.");
    }

    initMarketingPage();
});

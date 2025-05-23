// js/bi_interno.js - Lógica para a Subaplicação de Business Intelligence

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para BI Interno.");
        return;
    }
    checkAuthStatus(); // Protege a página

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnBI');
    const periodoRangeEl = document.getElementById('biPeriodoRange');
    const filtroParqueEl = document.getElementById('biFiltroParque');
    const filtroCondutorEl = document.getElementById('biFiltroCondutor');
    const aplicarFiltrosBtnEl = document.getElementById('biAplicarFiltrosBtn');
    const loadingSpinnerEl = document.getElementById('loadingBISpinner');
    const resultadosSecaoEl = document.getElementById('biResultadosSecao');

    // KPIs
    const kpiReceitaTotalEl = document.getElementById('kpiReceitaTotal');
    const kpiDespesasTotalEl = document.getElementById('kpiDespesasTotal');
    const kpiLucroTotalEl = document.getElementById('kpiLucroTotal');
    const kpiTotalReservasEl = document.getElementById('kpiTotalReservas');
    const kpiTaxaOcupacaoEl = document.getElementById('kpiTaxaOcupacao');
    const kpiTaxaCancelamentoEl = document.getElementById('kpiTaxaCancelamento');
    // Elementos de comparação (ex: kpiReceitaCompEl) podem ser adicionados se a lógica de período anterior for implementada

    // Gráficos
    const chartReceitaParqueEl = document.getElementById('biChartReceitaParque');
    const chartDespesasTipoEl = document.getElementById('biChartDespesasTipo');
    const chartEvolucaoReceitaEl = document.getElementById('biChartEvolucaoReceita');
    const chartReservasOrigemEl = document.getElementById('biChartReservasOrigem');
    const chartTopCondutoresEl = document.getElementById('biChartTopCondutores');

    let fpDateRange; // Instância do Flatpickr

    // --- Instâncias dos Gráficos ---
    let graficoReceitaParque, graficoDespesasTipo, graficoEvolucaoReceita, graficoReservasOrigem, graficoTopCondutores;

    // --- Funções Auxiliares ---
    function mostrarSpinner(show = true) { 
        if(loadingSpinnerEl) loadingSpinnerEl.style.display = show ? 'block' : 'none'; 
    }
    function formatarMoeda(valor) { return parseFloat(valor || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }

    // --- Carregar Dados para Filtros ---
    async function carregarFiltrosIniciais() {
        // Carregar Parques
        const { data: parquesData, error: parquesError } = await supabase.from('parques').select('id, nome').order('nome');
        if (parquesError) console.error("Erro ao carregar parques para BI:", parquesError);
        else {
            (parquesData || []).forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.nome;
                filtroParqueEl.appendChild(opt);
            });
        }
        // Carregar Condutores (profiles com role relevante)
        const { data: condutoresData, error: condutoresError } = await supabase.from('profiles')
            .select('id, full_name, username')
            // .in('role', ['condutor_recolhas', 'condutor_entregas']) // Ajustar roles
            .order('full_name');
        if (condutoresError) console.error("Erro ao carregar condutores para BI:", condutoresError);
        else {
            (condutoresData || []).forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.full_name || c.username;
                filtroCondutorEl.appendChild(opt);
            });
        }

        // Inicializar Date Range Picker com Flatpickr
        fpDateRange = flatpickr(periodoRangeEl, {
            mode: "range",
            dateFormat: "Y-m-d",
            defaultDate: [new Date(new Date().setDate(1)), new Date()], // Mês atual por defeito
            locale: {
                firstDayOfWeek: 1, 
                weekdays: { shorthand: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], longhand: ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"] },
                months: { shorthand: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"], longhand: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"] },
            }
        });
    }

    // --- Lógica de Atualização do Dashboard ---
    async function atualizarDashboardBI() {
        mostrarSpinner(true);
        if(resultadosSecaoEl) resultadosSecaoEl.classList.add('opacity-50'); // Feedback visual

        const selectedDates = fpDateRange.selectedDates;
        const dataInicio = selectedDates.length > 0 ? selectedDates[0].toISOString().split('T')[0] : null;
        const dataFim = selectedDates.length > 1 ? selectedDates[1].toISOString().split('T')[0] : (selectedDates.length > 0 ? selectedDates[0].toISOString().split('T')[0] : null);
        
        const parquesSelecionadosIds = Array.from(filtroParqueEl.selectedOptions).map(opt => opt.value);
        const condutorSelecionadoId = filtroCondutorEl.value;

        console.log("Filtros BI:", { dataInicio, dataFim, parquesSelecionadosIds, condutorSelecionadoId });

        try {
            // 1. Chamar RPC para KPIs Financeiros e Operacionais básicos
            // Assegure-se que esta RPC 'get_bi_kpis_gerais' existe no seu Supabase
            const { data: kpiData, error: kpiError } = await supabase.rpc('get_bi_kpis_gerais', {
                p_data_inicio: dataInicio,
                p_data_fim: dataFim,
                p_parque_ids: parquesSelecionadosIds.length > 0 ? parquesSelecionadosIds : null,
                p_condutor_id: condutorSelecionadoId || null
            });
            if (kpiError) throw kpiError;

            if (kpiData && kpiData.length > 0) { // RPCs podem retornar array com um objeto
                const kpis = kpiData[0]; // Assumindo que retorna um array com um objeto
                if(kpiReceitaTotalEl) kpiReceitaTotalEl.textContent = formatarMoeda(kpis.total_receita_bruta);
                if(kpiDespesasTotalEl) kpiDespesasTotalEl.textContent = formatarMoeda(kpis.total_despesas);
                if(kpiLucroTotalEl) kpiLucroTotalEl.textContent = formatarMoeda(kpis.total_lucro);
                if(kpiTotalReservasEl) kpiTotalReservasEl.textContent = kpis.total_reservas_validas || 0;
                if(kpiTaxaCancelamentoEl) kpiTaxaCancelamentoEl.textContent = `${(kpis.taxa_cancelamento || 0).toFixed(1)}%`;
                if(kpiTaxaOcupacaoEl) kpiTaxaOcupacaoEl.textContent = `${(kpis.taxa_ocupacao_media || 0).toFixed(1)}% (Exemplo)`;
            } else {
                console.warn("RPC 'get_bi_kpis_gerais' não retornou dados ou formato inesperado.");
                // Limpar KPIs se não houver dados
                if(kpiReceitaTotalEl) kpiReceitaTotalEl.textContent = formatarMoeda(0);
                if(kpiDespesasTotalEl) kpiDespesasTotalEl.textContent = formatarMoeda(0);
                if(kpiLucroTotalEl) kpiLucroTotalEl.textContent = formatarMoeda(0);
                if(kpiTotalReservasEl) kpiTotalReservasEl.textContent = 0;
                if(kpiTaxaCancelamentoEl) kpiTaxaCancelamentoEl.textContent = '0.0%';
                if(kpiTaxaOcupacaoEl) kpiTaxaOcupacaoEl.textContent = '0.0% (Exemplo)';
            }

            // 2. Chamar RPC para Receita por Parque
            const { data: receitaParqueData, error: receitaParqueError } = await supabase.rpc('get_bi_receita_por_parque', {
                p_data_inicio: dataInicio, p_data_fim: dataFim, p_parque_ids: parquesSelecionadosIds.length > 0 ? parquesSelecionadosIds : null
            });
            if (receitaParqueError) throw receitaParqueError;
            atualizarGraficoReceitaParque(receitaParqueData || []);

            // 3. Chamar RPC para Despesas por Tipo
            const { data: despesasTipoData, error: despesasTipoError } = await supabase.rpc('get_bi_despesas_por_tipo', {
                p_data_inicio: dataInicio, p_data_fim: dataFim, p_parque_ids: parquesSelecionadosIds.length > 0 ? parquesSelecionadosIds : null
            });
            if (despesasTipoError) throw despesasTipoError;
            atualizarGraficoDespesasTipo(despesasTipoData || []);
            
            // 4. Chamar RPC para Evolução da Receita Mensal
            const { data: evolReceitaData, error: evolReceitaError } = await supabase.rpc('get_bi_evolucao_receita_mensal', {
                p_data_inicio: dataInicio, p_data_fim: dataFim, p_parque_ids: parquesSelecionadosIds.length > 0 ? parquesSelecionadosIds : null
            });
            if(evolReceitaError) throw evolReceitaError;
            atualizarGraficoEvolucaoReceita(evolReceitaData || []);

            // 5. Chamar RPC para Reservas por Origem
            const { data: reservasOrigemData, error: reservasOrigemError } = await supabase.rpc('get_bi_reservas_por_origem', {
                 p_data_inicio: dataInicio, p_data_fim: dataFim, p_parque_ids: parquesSelecionadosIds.length > 0 ? parquesSelecionadosIds : null
            });
            if(reservasOrigemError) throw reservasOrigemError;
            atualizarGraficoReservasOrigem(reservasOrigemData || []);

            // 6. Chamar RPC para Top Condutores (Nº Serviços)
            const { data: topCondutoresData, error: topCondutoresError } = await supabase.rpc('get_bi_top_condutores_servicos', {
                 p_data_inicio: dataInicio, p_data_fim: dataFim, p_parque_ids: parquesSelecionadosIds.length > 0 ? parquesSelecionadosIds : null
            });
            if(topCondutoresError) throw topCondutoresError;
            atualizarGraficoTopCondutores(topCondutoresData || []);


        } catch (error) {
            console.error("Erro ao atualizar dashboard BI:", error);
            alert(`Erro ao carregar dados do BI: ${error.message}`);
        } finally {
            mostrarSpinner(false);
            if(resultadosSecaoEl) resultadosSecaoEl.classList.remove('opacity-50');
        }
    }

    // --- Funções de Atualização dos Gráficos ---
    function atualizarGraficoReceitaParque(data) { 
        if (!chartReceitaParqueEl) return;
        if (!graficoReceitaParque) {
            const ctx = chartReceitaParqueEl.getContext('2d');
            graficoReceitaParque = new Chart(ctx, {
                type: 'bar',
                data: { labels: [], datasets: [{ label: 'Receita (€)', data: [], backgroundColor: 'rgba(54, 162, 235, 0.7)' }] },
                options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { callback: value => formatarMoeda(value) } } } }
            });
        }
        graficoReceitaParque.data.labels = data.map(d => d.parque_nome);
        graficoReceitaParque.data.datasets[0].data = data.map(d => d.total_receita);
        graficoReceitaParque.update();
    }

    function atualizarGraficoDespesasTipo(data) { 
        if (!chartDespesasTipoEl) return;
         if (!graficoDespesasTipo) {
            const ctx = chartDespesasTipoEl.getContext('2d');
            graficoDespesasTipo = new Chart(ctx, {
                type: 'pie',
                data: { labels: [], datasets: [{ data: [], backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7E57C2', '#FFEE58', '#66BB6A'] }] }, // Mais cores
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });
        }
        graficoDespesasTipo.data.labels = data.map(d => d.tipo_despesa);
        graficoDespesasTipo.data.datasets[0].data = data.map(d => d.total_valor);
        graficoDespesasTipo.update();
    }
    
    function atualizarGraficoEvolucaoReceita(data) { 
        if (!chartEvolucaoReceitaEl) return;
        if (!graficoEvolucaoReceita) {
            const ctx = chartEvolucaoReceitaEl.getContext('2d');
            graficoEvolucaoReceita = new Chart(ctx, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Receita Mensal (€)', data: [], borderColor: '#0A2B5C', backgroundColor: 'rgba(10, 43, 92, 0.1)', fill: true, tension: 0.1 }] },
                options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { callback: value => formatarMoeda(value) } } } }
            });
        }
        graficoEvolucaoReceita.data.labels = data.map(d => d.mes_ano_label); // A RPC deve fornecer este label formatado
        graficoEvolucaoReceita.data.datasets[0].data = data.map(d => d.total_receita_mes);
        graficoEvolucaoReceita.update();
    }

    function atualizarGraficoReservasOrigem(data) { 
        if (!chartReservasOrigemEl) return;
        if (!graficoReservasOrigem) {
            const ctx = chartReservasOrigemEl.getContext('2d');
            graficoReservasOrigem = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: [], datasets: [{ data: [], backgroundColor: ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#6366f1'] }] },
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });
        }
        graficoReservasOrigem.data.labels = data.map(d => d.origem_reserva || 'Desconhecida');
        graficoReservasOrigem.data.datasets[0].data = data.map(d => d.count_reservas);
        graficoReservasOrigem.update();
    }

    function atualizarGraficoTopCondutores(data) { 
         if (!chartTopCondutoresEl) return;
         if (!graficoTopCondutores) {
            const ctx = chartTopCondutoresEl.getContext('2d');
            graficoTopCondutores = new Chart(ctx, {
                type: 'bar',
                data: { labels: [], datasets: [{ label: 'Nº de Serviços (Recolhas/Entregas)', data: [], backgroundColor: 'rgba(22, 163, 74, 0.7)' }] },
                options: { indexAxis: 'y', responsive: true, scales: { x: { beginAtZero: true, ticks: { stepSize: 1} } } }
            });
        }
        graficoTopCondutores.data.labels = data.map(d => d.condutor_nome);
        graficoTopCondutores.data.datasets[0].data = data.map(d => d.total_servicos);
        graficoTopCondutores.update();
    }


    // --- Event Listeners ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (aplicarFiltrosBtnEl) aplicarFiltrosBtnEl.addEventListener('click', atualizarDashboardBI);

    // --- Inicialização da Página ---
    async function initBIPage() {
        if (!userProfile) { 
            alert("Perfil do utilizador não carregado. Por favor, tente fazer login novamente."); 
            window.location.href = 'index.html'; // Redireciona para o login
            return;
        }
        // Ajustar roles que podem aceder ao BI Interno
        if (userProfile.role !== 'super_admin' && userProfile.role !== 'admin' && userProfile.role !== 'gestor_parque') { // Exemplo de roles
            alert("Não tem permissão para aceder a este módulo de Business Intelligence.");
            window.location.href = 'index.html'; // Redireciona para o dashboard principal
            return;
        }
        await carregarFiltrosIniciais();
        await atualizarDashboardBI(); // Carregar com filtros padrão
        console.log("Subaplicação BI Interno inicializada.");
    }

    initBIPage();
});

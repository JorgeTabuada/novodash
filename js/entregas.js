// js/entregas.js - Lógica para a Subaplicação de Dashboard de Entregas

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Entregas.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const dashboardFiltroDataInicioEl = document.getElementById('entDashboardFiltroDataInicio');
    const dashboardFiltroDataFimEl = document.getElementById('entDashboardFiltroDataFim');
    const dashboardFiltroPeriodoEl = document.getElementById('entDashboardFiltroPeriodo');
    const dashboardFiltroParqueEl = document.getElementById('entDashboardFiltroParque');
    const aplicarFiltrosDashboardBtnEl = document.getElementById('entAplicarFiltrosDashboardBtn');

    const statTotalEntregasEl = document.getElementById('statTotalEntregas');
    const statTotalEntregasPeriodoEl = document.getElementById('statTotalEntregasPeriodo');
    const statEntregasVsPrevistasEl = document.getElementById('statEntregasVsPrevistas');
    const statEntregasVsPrevistasPeriodoEl = document.getElementById('statEntregasVsPrevistasPeriodo');
    const statValorTotalEntregueEl = document.getElementById('statValorTotalEntregue');
    const statValorTotalEntreguePeriodoEl = document.getElementById('statValorTotalEntreguePeriodo');
    const statMediaEntregasDiaEl = document.getElementById('statMediaEntregasDia');
    const statMediaEntregasDiaPeriodoEl = document.getElementById('statMediaEntregasDiaPeriodo');

    const dashboardDataHoraInputEl = document.getElementById('entDashboardDataHoraInput');
    const dashboardDataHoraDisplayEl = document.getElementById('entDashboardDataHoraDisplay');
    const chartEntregasPorHoraEl = document.getElementById('chartEntregasPorHora');
    const chartEntregasMetodoPagamentoEl = document.getElementById('chartEntregasMetodoPagamento');
    const calendarioEntregasContainerEl = document.getElementById('calendarioEntregasContainer');

    const filtroMatriculaListaEl = document.getElementById('entFiltroMatriculaLista');
    const filtroDataSaidaRealListaEl = document.getElementById('entFiltroDataSaidaRealLista');
    const filtroCondutorListaEl = document.getElementById('entFiltroCondutorLista'); // Para condutor de entrega
    const aplicarFiltrosListaBtnEl = document.getElementById('entAplicarFiltrosListaBtn');
    const entregasTableBodyEl = document.getElementById('entregasTableBody');
    const entregasNenhumaMsgEl = document.getElementById('entregasNenhumaMsg');
    const entregasPaginacaoEl = document.getElementById('entregasPaginacao');
    const loadingEntregasTableSpinnerEl = document.getElementById('loadingEntregasTableSpinner');
    
    const exportarListaBtnEl = document.getElementById('entExportarListaBtn');
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnEntregas');

    // --- Estado da Aplicação ---
    let todasAsEntregasGeral = [];
    let paginaAtualEntregasLista = 1;
    const itensPorPaginaEntregasLista = 15;
    let listaCondutoresEntrega = [];

    // --- Configuração de Gráficos ---
    let graficoEntregasPorHora, graficoEntregasMetodoPagamento;

    function setupGraficosEntregas() {
        if (chartEntregasPorHoraEl) {
            const ctxHora = chartEntregasPorHoraEl.getContext('2d');
            if (graficoEntregasPorHora) graficoEntregasPorHora.destroy();
            graficoEntregasPorHora = new Chart(ctxHora, {
                type: 'bar', data: { labels: [], datasets: [{ label: 'Nº de Entregas', data: [], backgroundColor: 'rgba(13, 148, 136, 0.7)', borderColor: 'rgba(13, 148, 136, 1)' }] }, // Teal color
                options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
            });
        }
        if (chartEntregasMetodoPagamentoEl) {
            const ctxMetodo = chartEntregasMetodoPagamentoEl.getContext('2d');
            if (graficoEntregasMetodoPagamento) graficoEntregasMetodoPagamento.destroy();
            graficoEntregasMetodoPagamento = new Chart(ctxMetodo, {
                type: 'pie', data: { labels: [], datasets: [{ data: [], backgroundColor: ['#28a745', '#007bff', '#ffc107', '#6f42c1', '#fd7e14'] }] }, // Green, Blue, Yellow, Purple, Orange
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });
        }
    }
    
    // --- Funções Auxiliares ---
    function formatarDataHora(dataISO) { /* ... */ return dataISO ? new Date(dataISO).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'; }
    function formatarMoeda(valor) { /* ... */ return parseFloat(valor || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }
    function mostrarSpinner(id) { document.getElementById(id)?.classList.remove('hidden'); }
    function esconderSpinner(id) { document.getElementById(id)?.classList.add('hidden'); }

    // --- Carregar Condutores (de entrega) para Filtros ---
    async function carregarCondutoresDeEntrega() {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, full_name')
            // .eq('role', 'condutor_entrega') // Ajustar role se aplicável
            .order('full_name', { ascending: true });

        if (error) {
            console.error("Erro ao carregar condutores de entrega:", error);
            return;
        }
        listaCondutoresEntrega = data || [];
        // Popular select de condutores na lista
        const condutorListaSelect = filtroCondutorListaEl;
        if (condutorListaSelect) {
            const primeiraOpcao = condutorListaSelect.options[0];
            condutorListaSelect.innerHTML = '';
            if (primeiraOpcao) condutorListaSelect.appendChild(primeiraOpcao);
            listaCondutoresEntrega.forEach(cond => {
                const option = document.createElement('option');
                option.value = cond.id;
                option.textContent = cond.full_name || cond.username || cond.id;
                condutorListaSelect.appendChild(option);
            });
        }
    }

    // --- Lógica do Dashboard de Entregas ---
    async function carregarDadosDashboardEntregas() {
        const dataInicio = dashboardFiltroDataInicioEl.value;
        const dataFim = dashboardFiltroDataFimEl.value;
        const periodoSelecionado = dashboardFiltroPeriodoEl.value;
        const parqueFiltro = dashboardFiltroParqueEl.value;

        let filtroDataInicio, filtroDataFim;
        const hoje = new Date(); hoje.setHours(0,0,0,0);

        switch(periodoSelecionado) {
            case 'hoje': /* ... */ filtroDataInicio = new Date(hoje); filtroDataFim = new Date(hoje); filtroDataFim.setHours(23,59,59,999); break;
            case 'mes_atual': /* ... */ filtroDataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1); filtroDataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0); filtroDataFim.setHours(23,59,59,999); break;
            default: /* ... */ filtroDataInicio = dataInicio ? new Date(dataInicio) : null; if(filtroDataInicio) filtroDataInicio.setHours(0,0,0,0); filtroDataFim = dataFim ? new Date(dataFim) : null; if(filtroDataFim) filtroDataFim.setHours(23,59,59,999); break;
        }
        
        const periodoTexto = filtroDataInicio && filtroDataFim ?
            `${formatarDataHora(filtroDataInicio).split(' ')[0]} - ${formatarDataHora(filtroDataFim).split(' ')[0]}` :
            'Todo o período';
        
        [statTotalEntregasPeriodoEl, statEntregasVsPrevistasPeriodoEl, statValorTotalEntreguePeriodoEl, statMediaEntregasDiaPeriodoEl]
            .forEach(el => el.textContent = periodoTexto);

        // TODO: Chamar Supabase RPC para obter estatísticas de entregas
        // Ex: supabase.rpc('get_entregas_dashboard_stats', { data_inicio, data_fim, parque_filtro })
        // Esta RPC precisaria:
        // 1. Contar total de reservas com `data_saida_prevista` no período (para "previstas").
        // 2. Contar total de entregas (`estado_reserva` = 'Entregue' E `data_saida_real` no período).
        // 3. Somar `preco_final_pago` das entregas.
        // 4. Calcular média de entregas/dia.
        // 5. Agrupar por método de pagamento, por hora.

        // Simulação:
        const totalEntregasSimulado = Math.floor(Math.random() * 180);
        const totalPrevistasSimulado = totalEntregasSimulado + Math.floor(Math.random() * 20);
        statTotalEntregasEl.textContent = totalEntregasSimulado;
        statEntregasVsPrevistasEl.textContent = `${totalEntregasSimulado} / ${totalPrevistasSimulado}`;
        statValorTotalEntregueEl.textContent = formatarMoeda(totalEntregasSimulado * (Math.random() * 25 + 15));
        const numDias = filtroDataInicio && filtroDataFim ? ((filtroDataFim - filtroDataInicio) / (1000 * 60 * 60 * 24)) + 1 : 30;
        statMediaEntregasDiaEl.textContent = (totalEntregasSimulado / (numDias > 0 ? numDias : 1)).toFixed(1);

        // Gráfico Métodos de Pagamento (simulado)
        const labelsMetodos = ['Numerário', 'Multibanco', 'MBWay', 'Online'];
        const dataMetodos = labelsMetodos.map(() => Math.floor(Math.random() * 500));
        if (graficoEntregasMetodoPagamento) {
            graficoEntregasMetodoPagamento.data.labels = labelsMetodos;
            graficoEntregasMetodoPagamento.data.datasets[0].data = dataMetodos;
            graficoEntregasMetodoPagamento.update();
        }
        
        atualizarGraficoEntregasPorHora();
        // TODO: Atualizar calendário (requer biblioteca e lógica específica)
        if(calendarioEntregasContainerEl) calendarioEntregasContainerEl.innerHTML = `<p>Calendário de Entregas para ${periodoTexto} (a implementar).</p>`;
    }

    function atualizarGraficoEntregasPorHora() {
        const diaSelecionado = dashboardDataHoraInputEl.value;
        if (diaSelecionado) {
            dashboardDataHoraDisplayEl.textContent = new Date(diaSelecionado + 'T00:00:00').toLocaleDateString('pt-PT');
            // TODO: Chamar Supabase para obter contagens de entregas por hora
            // Simulação:
            const horas = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
            const contagens = horas.map(() => Math.floor(Math.random() * 7));
             if (graficoEntregasPorHora) {
                graficoEntregasPorHora.data.labels = horas;
                graficoEntregasPorHora.data.datasets[0].data = contagens;
                graficoEntregasPorHora.update();
            }
        } else {
            dashboardDataHoraDisplayEl.textContent = 'selecione um dia';
            if (graficoEntregasPorHora) {
                graficoEntregasPorHora.data.labels = [];
                graficoEntregasPorHora.data.datasets[0].data = [];
                graficoEntregasPorHora.update();
            }
        }
    }

    // --- Lógica da Lista de Entregas ---
    async function carregarEntregasDaLista(pagina = 1) {
        paginaAtualEntregasLista = pagina;
        mostrarSpinner('loadingEntregasTableSpinner');
        entregasTableBodyEl.innerHTML = '';
        entregasNenhumaMsgEl.classList.add('hidden');

        let query = supabase
            .from('reservas')
            .select(`
                id, booking_id, matricula, alocation, nome_cliente, data_saida_prevista, data_saida_real,
                preco_final_pago, metodo_pagamento_final, parque,
                condutor_entrega:profiles!reservas_condutor_entrega_id_fkey (id, username, full_name)
            `, { count: 'exact' })
            .in('estado_reserva', ['Entregue', 'ValidadaFinanceiramente', 'Concluída']); // Estados que significam entrega feita

        // Aplicar filtros da lista
        if (filtroMatriculaListaEl.value) query = query.ilike('matricula', `%${filtroMatriculaListaEl.value}%`);
        if (filtroDataSaidaRealListaEl.value) query = query.gte('data_saida_real', filtroDataSaidaRealListaEl.value + 'T00:00:00');
        if (filtroCondutorListaEl.value) query = query.eq('condutor_entrega_id', filtroCondutorListaEl.value);
        if (dashboardFiltroParqueEl.value) query = query.eq('parque', dashboardFiltroParqueEl.value); // Usar filtro de parque do dashboard aqui também
        
        const offset = (pagina - 1) * itensPorPaginaEntregasLista;
        query = query.order('data_saida_real', { ascending: false }).range(offset, offset + itensPorPaginaEntregasLista - 1);

        const { data, error, count } = await query;

        esconderSpinner('loadingEntregasTableSpinner');
        if (error) {
            console.error('Erro ao carregar entregas:', error);
            entregasNenhumaMsgEl.textContent = `Erro ao carregar dados: ${error.message}`;
            entregasNenhumaMsgEl.classList.remove('hidden');
            return;
        }

        todasAsEntregasGeral = data || [];
        renderEntregasTable(todasAsEntregasGeral);
        renderPaginacaoEntregasLista(count);
    }

    function renderEntregasTable(entregas) {
        entregasTableBodyEl.innerHTML = '';
        if (!entregas || entregas.length === 0) {
            entregasNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        entregasNenhumaMsgEl.classList.add('hidden');

        entregas.forEach(ent => {
            const tr = document.createElement('tr');
            const nomeCondutor = ent.condutor_entrega ? (ent.condutor_entrega.full_name || ent.condutor_entrega.username) : 'N/A';
            tr.innerHTML = `
                <td>${ent.booking_id || 'N/A'}</td>
                <td>${ent.matricula || 'N/A'}</td>
                <td>${ent.alocation || 'N/A'}</td>
                <td>${ent.nome_cliente || 'N/A'}</td>
                <td>${formatarDataHora(ent.data_saida_prevista)}</td>
                <td>${formatarDataHora(ent.data_saida_real)}</td>
                <td>${nomeCondutor}</td>
                <td>${formatarMoeda(ent.preco_final_pago)}</td>
                <td>${ent.metodo_pagamento_final || 'N/A'}</td>
                <td>${ent.parque || 'N/A'}</td>
                <td class="actions-cell">
                    <button class="action-button text-xs !p-1" data-id="${ent.id}">Ver Detalhes</button>
                </td>
            `;
            entregasTableBodyEl.appendChild(tr);
        });
    }

    function renderPaginacaoEntregasLista(totalItens) {
        entregasPaginacaoEl.innerHTML = '';
        if (!totalItens || totalItens <= itensPorPaginaEntregasLista) return;
        const totalPaginas = Math.ceil(totalItens / itensPorPaginaEntregasLista);
        for (let i = 1; i <= totalPaginas; i++) {
            const btnPagina = document.createElement('button');
            btnPagina.textContent = i;
            btnPagina.className = `action-button text-sm !p-2 mx-1 ${i === paginaAtualEntregasLista ? 'bg-teal-700' : 'bg-teal-500 hover:bg-teal-600'}`;
            btnPagina.addEventListener('click', () => carregarEntregasDaLista(i));
            entregasPaginacaoEl.appendChild(btnPagina);
        }
    }
    
    // --- Exportar Lista de Entregas ---
    function exportarEntregasParaCSV() {
        if (todasAsEntregasGeral.length === 0) {
            alert("Não há dados de entregas para exportar.");
            return;
        }
        const dataParaExportar = todasAsEntregasGeral.map(ent => ({
            "Booking ID": ent.booking_id || '', "Matrícula": ent.matricula || '', "Alocation": ent.alocation || '',
            "Cliente": ent.nome_cliente || '', "Data Saída Prev.": formatarDataHora(ent.data_saida_prevista),
            "Data Saída Real": formatarDataHora(ent.data_saida_real),
            "Condutor Entrega": ent.condutor_entrega ? (ent.condutor_entrega.full_name || ent.condutor_entrega.username) : '',
            "Valor Pago (€)": ent.preco_final_pago !== null ? ent.preco_final_pago : '',
            "Método Pag.": ent.metodo_pagamento_final || '', "Parque": ent.parque || ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataParaExportar);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Entregas");
        XLSX.writeFile(workbook, `entregas_multipark_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    // --- Event Listeners ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (aplicarFiltrosDashboardBtnEl) aplicarFiltrosDashboardBtnEl.addEventListener('click', carregarDadosDashboardEntregas);
    if (dashboardDataHoraInputEl) dashboardDataHoraInputEl.addEventListener('change', atualizarGraficoEntregasPorHora);
     if (dashboardFiltroPeriodoEl) {
         dashboardFiltroPeriodoEl.addEventListener('change', () => {
            const personalizado = dashboardFiltroPeriodoEl.value === 'personalizado';
            dashboardFiltroDataInicioEl.disabled = !personalizado;
            dashboardFiltroDataFimEl.disabled = !personalizado;
            if (!personalizado) carregarDadosDashboardEntregas();
        });
    }
    if (aplicarFiltrosListaBtnEl) aplicarFiltrosListaBtnEl.addEventListener('click', () => carregarEntregasDaLista(1));
    if (exportarListaBtnEl) exportarListaBtnEl.addEventListener('click', exportarEntregasParaCSV);

    entregasTableBodyEl.addEventListener('click', (event) => {
        const targetButton = event.target.closest('button');
        if (!targetButton) return;
        const reservaId = targetButton.dataset.id;
        if (targetButton.textContent.toLowerCase().includes('ver detalhes') && reservaId) {
            // TODO: Implementar modal de detalhes da reserva/entrega, se necessário
            alert(`Ver detalhes da entrega/reserva ID: ${reservaId} (funcionalidade a implementar)`);
        }
    });

    // --- Inicialização da Página de Entregas ---
    async function initEntregasPage() {
        await carregarCondutoresDeEntrega();
        setupGraficosEntregas();
        
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dashboardFiltroDataInicioEl.valueAsDate = primeiroDiaMes;
        dashboardFiltroDataFimEl.valueAsDate = hoje; // Até hoje
        dashboardFiltroPeriodoEl.value = 'mes_atual';
        dashboardFiltroDataInicioEl.disabled = true;
        dashboardFiltroDataFimEl.disabled = true;

        await carregarDadosDashboardEntregas();
        await carregarEntregasDaLista();
        console.log("Subaplicação de Entregas inicializada.");
    }

    initEntregasPage();
});

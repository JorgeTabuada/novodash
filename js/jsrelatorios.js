// js/relatorios.js - Lógica para a Subaplicação de Relatórios Comparativos

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Relatórios.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnRelatorios');
    const tipoComparacaoEl = document.getElementById('relTipoComparacao');
    const anosContainerEl = document.getElementById('relAnosContainer');
    const anosSelectEl = document.getElementById('relAnosSelect');
    const mesContainerEl = document.getElementById('relMesContainer');
    const mesSelectEl = document.getElementById('relMesSelect');
    const diaContainerEl = document.getElementById('relDiaContainer');
    const diaInputEl = document.getElementById('relDiaInput'); // Formato DD-MM
    const intervaloContainerEl = document.getElementById('relIntervaloContainer');
    const intervaloDatasEl = document.getElementById('relIntervaloDatas');
    const filtroParqueEl = document.getElementById('relFiltroParque');
    const gerarRelatorioBtnEl = document.getElementById('relGerarRelatorioBtn');
    
    const resultadosSecaoEl = document.getElementById('relResultadosSecao');
    const tituloResultadoEl = document.getElementById('relTituloResultado');
    const loadingSpinnerEl = document.getElementById('loadingRelatorioSpinner');
    const tableHeaderRowEl = document.getElementById('relTableHeaderRow');
    const tableBodyEl = document.getElementById('relTableBody');
    const nenhumDadoMsgEl = document.getElementById('relNenhumDadoMsg');
    const chartTitleEl = document.getElementById('relChartTitle');
    const comparativoChartEl = document.getElementById('relComparativoChart');

    let fpIntervalo; // Flatpickr para intervalo
    let tomSelectAnos; // TomSelect para anos

    // --- Estado da Aplicação ---
    let dadosRelatorioAtual = []; // Guardará os dados da RPC Supabase
    let graficoComparativo;
    const METRICAS_INFO = [ // Definir as métricas e como buscá-las/calculá-las
        { id: 'num_reservas', label: 'Nº de Reservas', format: 'integer' },
        { id: 'valor_faturado', label: 'Valor Faturado (€)', format: 'currency' },
        { id: 'custo_funcionarios', label: 'Custo Funcionários (€)', format: 'currency' },
        { id: 'custo_ads', label: 'Custo Ads (€)', format: 'currency' },
        { id: 'custo_despesas_gerais', label: 'Despesas Gerais (€)', format: 'currency' },
        { id: 'resultado_liquido', label: 'Resultado Líquido (€)', format: 'currency', isCalculated: true },
        { id: 'media_reservas_dia', label: 'Média Reservas/Dia', format: 'float' },
        { id: 'media_recolhas_dia', label: 'Média Recolhas/Dia', format: 'float' },
        { id: 'valor_medio_reserva', label: 'Valor Médio/Reserva (€)', format: 'currency' }
    ];


    // --- Funções Auxiliares ---
    function mostrarSpinner(show = true) { loadingSpinnerEl.style.display = show ? 'block' : 'none'; }
    function formatValue(value, formatType) {
        if (value === null || value === undefined) return 'N/A';
        if (formatType === 'currency') return parseFloat(value).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
        if (formatType === 'integer') return parseInt(value).toLocaleString('pt-PT');
        if (formatType === 'float') return parseFloat(value).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        return value;
    }

    // --- Configuração dos Filtros ---
    function setupFiltros() {
        // Flatpickr para intervalo
        fpIntervalo = flatpickr(intervaloDatasEl, {
            mode: "range", dateFormat: "Y-m-d",
            locale: { firstDayOfWeek: 1, /* ... (locale pt) ... */ }
        });

        // TomSelect para Anos (2016 até ano atual)
        const anoAtual = new Date().getFullYear();
        const opcoesAnos = [];
        for (let ano = 2016; ano <= anoAtual; ano++) {
            opcoesAnos.push({ value: ano.toString(), text: ano.toString() });
        }
        tomSelectAnos = new TomSelect(anosSelectEl, {
            plugins: ['remove_button'],
            create: false,
            options: opcoesAnos,
            items: [anoAtual.toString(), (anoAtual - 1).toString()] // Pré-selecionar os dois últimos anos
        });

        // Carregar Parques
        supabase.from('parques').select('id, nome').order('nome').then(({ data, error }) => {
            if (error) console.error("Erro ao carregar parques para relatórios:", error);
            else {
                (data || []).forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = p.nome;
                    filtroParqueEl.appendChild(opt);
                });
            }
        });
        
        // Lógica para mostrar/esconder filtros com base no tipo de comparação
        tipoComparacaoEl.addEventListener('change', atualizarVisibilidadeFiltros);
        atualizarVisibilidadeFiltros(); // Chamar na inicialização
    }

    function atualizarVisibilidadeFiltros() {
        const tipo = tipoComparacaoEl.value;
        anosContainerEl.classList.toggle('hidden', tipo === 'INTERVALO');
        mesContainerEl.classList.toggle('hidden', tipo !== 'MENSAL');
        diaContainerEl.classList.toggle('hidden', tipo !== 'DIARIA');
        intervaloContainerEl.classList.toggle('hidden', tipo !== 'INTERVALO');
    }

    // --- Lógica de Geração e Display do Relatório ---
    gerarRelatorioBtnEl.addEventListener('click', async () => {
        mostrarSpinner(true);
        resultadosSecaoEl.classList.add('hidden');
        tableBodyEl.innerHTML = '';
        tableHeaderRowEl.innerHTML = '<th>Métrica</th>'; // Reset header
        nenhumDadoMsgEl.classList.add('hidden');

        const tipo = tipoComparacaoEl.value;
        const anosSelecionados = tomSelectAnos.getValue().map(Number); // Array de números
        const mes = parseInt(mesSelectEl.value);
        const diaInput = diaInputEl.value; // "DD-MM"
        const [dia, mesDoDiaInput] = diaInput.split('-').map(Number);
        const intervalo = fpIntervalo.selectedDates.map(d => d.toISOString().split('T')[0]);
        const parqueId = filtroParqueEl.value || null;

        let paramsRPC = {
            p_tipo_comparacao: tipo,
            p_parque_id_filtro: parqueId
        };
        let tituloDoRelatorio = "";

        switch (tipo) {
            case 'ANUAL':
                if (anosSelecionados.length === 0) { alert("Selecione pelo menos um ano."); mostrarSpinner(false); return; }
                paramsRPC.p_lista_anos = anosSelecionados;
                tituloDoRelatorio = `Comparativo Anual (${anosSelecionados.join(', ')})`;
                break;
            case 'MENSAL':
                if (anosSelecionados.length === 0) { alert("Selecione pelo menos um ano para comparar o mês."); mostrarSpinner(false); return; }
                paramsRPC.p_mes_selecionado = mes;
                paramsRPC.p_lista_anos = anosSelecionados;
                tituloDoRelatorio = `Comparativo Mês ${mesSelectEl.options[mesSelectEl.selectedIndex].text} (${anosSelecionados.join(', ')})`;
                break;
            case 'DIARIA':
                if (!diaInput || !dia || !mesDoDiaInput) { alert("Insira um dia válido no formato DD-MM."); mostrarSpinner(false); return; }
                if (anosSelecionados.length === 0) { alert("Selecione pelo menos um ano para comparar o dia."); mostrarSpinner(false); return; }
                paramsRPC.p_dia_selecionado_str = `${String(dia).padStart(2,'0')}-${String(mesDoDiaInput).padStart(2,'0')}`; // Passar como string
                paramsRPC.p_lista_anos = anosSelecionados;
                tituloDoRelatorio = `Comparativo Dia ${diaInput} (${anosSelecionados.join(', ')})`;
                break;
            case 'INTERVALO':
                if (intervalo.length < 1) { alert("Selecione um intervalo de datas."); mostrarSpinner(false); return; }
                paramsRPC.p_data_inicio = intervalo[0];
                paramsRPC.p_data_fim = intervalo.length > 1 ? intervalo[1] : intervalo[0]; // Se só uma data, usa como início e fim
                tituloDoRelatorio = `Relatório de ${formatarData(intervalo[0])} a ${formatarData(intervalo.length > 1 ? intervalo[1] : intervalo[0])}`;
                break;
        }
        
        console.log("Chamando RPC get_relatorio_geral com:", paramsRPC);
        const { data: resultadoRPC, error } = await supabase.rpc('get_relatorio_geral', paramsRPC);
        // Esta RPC 'get_relatorio_geral' precisa ser criada no Supabase e retornar um array de objetos,
        // onde cada objeto representa um período/ano e contém todas as métricas.
        // Ex: [{ periodo_label: '2023', num_reservas: 1200, valor_faturado: 50000, ... },
        //      { periodo_label: '2024', num_reservas: 1500, valor_faturado: 65000, ... }]

        mostrarSpinner(false);
        if (error) {
            console.error("Erro ao gerar relatório:", error);
            nenhumDadoMsgEl.textContent = `Erro: ${error.message}`;
            nenhumDadoMsgEl.classList.remove('hidden');
            return;
        }

        dadosRelatorioAtual = resultadoRPC || [];
        if (dadosRelatorioAtual.length === 0) {
            nenhumDadoMsgEl.textContent = "Nenhum dado encontrado para os critérios selecionados.";
            nenhumDadoMsgEl.classList.remove('hidden');
            return;
        }
        
        resultadosSecaoEl.classList.remove('hidden');
        tituloResultadoEl.textContent = tituloDoRelatorio;
        renderTabelaRelatorio();
        // Por defeito, mostrar gráfico da primeira métrica (Nº de Reservas)
        if (METRICAS_INFO.length > 0) {
            atualizarGraficoRelatorio(METRICAS_INFO[0].id, METRICAS_INFO[0].label);
        }
    });

    function renderTabelaRelatorio() {
        // Cabeçalho da tabela (Períodos/Anos)
        dadosRelatorioAtual.forEach(periodoData => {
            const th = document.createElement('th');
            th.textContent = periodoData.periodo_label || 'Período'; // 'periodo_label' deve vir da RPC
            tableHeaderRowEl.appendChild(th);
        });

        // Linhas de Métricas
        METRICAS_INFO.forEach(metrica => {
            const tr = document.createElement('tr');
            const tdLabel = document.createElement('td');
            tdLabel.className = 'metric-label';
            tdLabel.textContent = metrica.label;
            tdLabel.addEventListener('click', () => atualizarGraficoRelatorio(metrica.id, metrica.label));
            tr.appendChild(tdLabel);

            dadosRelatorioAtual.forEach(periodoData => {
                const tdValor = document.createElement('td');
                let valor = periodoData[metrica.id]; // A RPC deve retornar os valores com a `metrica.id` como chave

                if (metrica.isCalculated && metrica.id === 'resultado_liquido') {
                    valor = (periodoData.valor_faturado || 0) - 
                            ((periodoData.custo_funcionarios || 0) + 
                             (periodoData.custo_ads || 0) + 
                             (periodoData.custo_despesas_gerais || 0));
                }
                tdValor.textContent = formatValue(valor, metrica.format);
                tr.appendChild(tdValor);
            });
            tableBodyEl.appendChild(tr);
        });
    }

    function atualizarGraficoRelatorio(metricaId, metricaLabel) {
        chartTitleEl.textContent = `Evolução: ${metricaLabel}`;
        const labels = dadosRelatorioAtual.map(d => d.periodo_label);
        const dataPoints = dadosRelatorioAtual.map(d => {
            if (metricaId === 'resultado_liquido') {
                 return (d.valor_faturado || 0) - 
                        ((d.custo_funcionarios || 0) + 
                         (d.custo_ads || 0) + 
                         (d.custo_despesas_gerais || 0));
            }
            return parseFloat(d[metricaId]) || 0;
        });

        if (graficoComparativo) {
            graficoComparativo.data.labels = labels;
            graficoComparativo.data.datasets[0].label = metricaLabel;
            graficoComparativo.data.datasets[0].data = dataPoints;
            graficoComparativo.update();
        } else {
            const ctx = comparativoChartEl.getContext('2d');
            graficoComparativo = new Chart(ctx, {
                type: 'bar', // ou 'line'
                data: {
                    labels: labels,
                    datasets: [{
                        label: metricaLabel,
                        data: dataPoints,
                        backgroundColor: 'rgba(13, 110, 253, 0.6)', // Azul
                        borderColor: 'rgba(13, 110, 253, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    }

    // --- Event Listeners ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    
    // --- Inicialização da Página ---
    async function initRelatoriosPage() {
        if (!userProfile || (userProfile.role !== 'super_admin' && userProfile.role !== 'admin')) { // Ajustar roles
            alert("Não tem permissão para aceder a este módulo.");
            window.location.href = 'index.html';
            return;
        }
        setupFiltros();
        // Por defeito, gerar relatório anual dos últimos 2 anos
        // A RPC `get_relatorio_geral` precisa ser criada no Supabase
        // await gerarRelatorioBtnEl.click(); // Descomentar após criar a RPC
        console.log("Subaplicação de Relatórios inicializada.");
    }

    initRelatoriosPage();
});

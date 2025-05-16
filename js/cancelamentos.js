// js/cancelamentos.js - Lógica para a Subaplicação de Gestão de Cancelamentos

document.addEventListener('DOMContentLoaded', () => {
    // --- Autenticação e Inicialização ---
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados corretamente para Cancelamentos.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores de Elementos DOM ---
    const importCancelamentosFileEl = document.getElementById('importCancelamentosFile');
    const cancProcessarImportacaoBtnEl = document.getElementById('cancProcessarImportacaoBtn');
    const importacaoCancelamentosStatusEl = document.getElementById('importacaoCancelamentosStatus');
    const loadingCancelamentosImportSpinnerEl = document.getElementById('loadingCancelamentosImportSpinner');

    const cancDashboardFiltroDataInicioEl = document.getElementById('cancDashboardFiltroDataInicio');
    const cancDashboardFiltroDataFimEl = document.getElementById('cancDashboardFiltroDataFim');
    const cancDashboardFiltroPeriodoEl = document.getElementById('cancDashboardFiltroPeriodo');
    const cancDashboardFiltroMotivoEl = document.getElementById('cancDashboardFiltroMotivo');
    const cancAplicarFiltrosDashboardBtnEl = document.getElementById('cancAplicarFiltrosDashboardBtn');

    const statTotalCancelamentosEl = document.getElementById('statTotalCancelamentos');
    const statTotalCancelamentosPeriodoEl = document.getElementById('statTotalCancelamentosPeriodo');
    const statPercCancelamentosEl = document.getElementById('statPercCancelamentos');
    const statPercCancelamentosPeriodoEl = document.getElementById('statPercCancelamentosPeriodo');
    const statCancelamentosSemMotivoEl = document.getElementById('statCancelamentosSemMotivo');
    const statCancelamentosSemMotivoPeriodoEl = document.getElementById('statCancelamentosSemMotivoPeriodo');
    const statValorPerdidoCancelamentosEl = document.getElementById('statValorPerdidoCancelamentos');
    const statValorPerdidoCancelamentosPeriodoEl = document.getElementById('statValorPerdidoCancelamentosPeriodo');

    const cancDashboardDataHoraInputEl = document.getElementById('cancDashboardDataHoraInput');
    const cancDashboardDataHoraDisplayEl = document.getElementById('cancDashboardDataHoraDisplay');
    const chartCancelamentosPorHoraEl = document.getElementById('chartCancelamentosPorHora');
    const chartMotivosCancelamentoEl = document.getElementById('chartMotivosCancelamento');

    const cancFiltroBookingIdListaEl = document.getElementById('cancFiltroBookingIdLista');
    const cancFiltroMatriculaListaEl = document.getElementById('cancFiltroMatriculaLista');
    const cancFiltroDataCancelamentoListaEl = document.getElementById('cancFiltroDataCancelamentoLista');
    const cancFiltroMotivoListaEl = document.getElementById('cancFiltroMotivoLista');
    const cancAplicarFiltrosListaBtnEl = document.getElementById('cancAplicarFiltrosListaBtn');
    const cancelamentosTableBodyEl = document.getElementById('cancelamentosTableBody');
    const cancelamentosNenhumaMsgEl = document.getElementById('cancelamentosNenhumaMsg');
    const cancelamentosPaginacaoEl = document.getElementById('cancelamentosPaginacao');
    const loadingCancelamentosTableSpinnerEl = document.getElementById('loadingCancelamentosTableSpinner');
    
    const cancExportarListaBtnEl = document.getElementById('cancExportarListaBtn');
    const cancAbrirModalNovoBtnEl = document.getElementById('cancAbrirModalNovoBtn');
    const voltarDashboardBtnCancelamentosEl = document.getElementById('voltarDashboardBtnCancelamentos');

    // Modal de Cancelamento
    const cancelamentoFormModalEl = document.getElementById('cancelamentoFormModal');
    const cancelamentoFormModalTitleEl = document.getElementById('cancelamentoFormModalTitle');
    const cancelamentoFormEl = document.getElementById('cancelamentoForm');
    const cancelamentoFormReservaIdEl = document.getElementById('cancelamentoFormReservaId'); // Hidden input para o ID da reserva a ser cancelada
    const cancelamentoFormBookingIdEl = document.getElementById('cancelamentoFormBookingId');
    const cancelamentoFormMatriculaEl = document.getElementById('cancelamentoFormMatricula');
    const cancelamentoFormAlocationEl = document.getElementById('cancelamentoFormAlocation');
    const dadosReservaOriginalInfoEl = document.getElementById('dadosReservaOriginalInfo');
    const infoClienteCancEl = document.getElementById('infoClienteCanc');
    const infoDatasCancEl = document.getElementById('infoDatasCanc');
    const cancelamentoFormDataEl = document.getElementById('cancelamentoFormData');
    const cancelamentoFormMotivoEl = document.getElementById('cancelamentoFormMotivo');
    const cancelamentoFormQuemCancelouEl = document.getElementById('cancelamentoFormQuemCancelou');
    const cancFecharModalBtns = document.querySelectorAll('.cancFecharModalBtn');


    // --- Estado da Aplicação ---
    let todosOsCancelamentosGeral = [];
    let paginaAtualCancelamentosLista = 1;
    const itensPorPaginaCancelamentosLista = 15;
    let motivosCancelamentoDistintos = []; // Para popular filtros e gráficos

    // --- Configuração de Gráficos ---
    let graficoCancelamentosPorHora;
    let graficoMotivosCancelamento;

    function setupGraficosCancelamentos() {
        const ctxHora = chartCancelamentosPorHoraEl.getContext('2d');
        if (graficoCancelamentosPorHora) graficoCancelamentosPorHora.destroy();
        graficoCancelamentosPorHora = new Chart(ctxHora, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Nº de Cancelamentos', data: [], backgroundColor: 'rgba(255, 99, 132, 0.7)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
        });

        const ctxMotivos = chartMotivosCancelamentoEl.getContext('2d');
        if (graficoMotivosCancelamento) graficoMotivosCancelamento.destroy();
        graficoMotivosCancelamento = new Chart(ctxMotivos, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ label: 'Motivos de Cancelamento', data: [], backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'], borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // --- Funções Auxiliares ---
    function formatarDataHora(dataISO) {
        if (!dataISO) return 'N/A';
        try { return new Date(dataISO).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }); }
        catch (e) { return dataISO; }
    }
    function formatarMoeda(valor) {
        if (valor === null || valor === undefined) return '0,00 €';
        return parseFloat(valor).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
    }
    function mostrarSpinner(spinnerId) {
        document.getElementById(spinnerId)?.classList.remove('hidden');
    }
    function esconderSpinner(spinnerId) {
        document.getElementById(spinnerId)?.classList.add('hidden');
    }

    // --- Carregar Motivos de Cancelamento para Filtros ---
    async function carregarMotivosDistintos() {
        const { data, error } = await supabase
            .from('reservas') // Ou de uma tabela específica de motivos, se existir
            .select('motivo_cancelamento')
            .not('motivo_cancelamento', 'is', null)
            .neq('motivo_cancelamento', ''); 

        if (error) {
            console.error("Erro ao carregar motivos de cancelamento:", error);
            return;
        }
        motivosCancelamentoDistintos = [...new Set(data.map(item => item.motivo_cancelamento).filter(Boolean))];
        
        // Popular select de motivos no dashboard
        const motivoDashboardSelect = cancDashboardFiltroMotivoEl;
        // Limpar opções antigas, mantendo "Todos" e "Sem Motivo"
        Array.from(motivoDashboardSelect.options).forEach(option => {
            if (option.value !== "" && option.value !== "SEM_MOTIVO") {
                option.remove();
            }
        });
        motivosCancelamentoDistintos.forEach(motivo => {
            const option = document.createElement('option');
            option.value = motivo;
            option.textContent = motivo;
            motivoDashboardSelect.appendChild(option);
        });

        // Popular select de motivos na lista
        const motivoListaSelect = cancFiltroMotivoListaEl;
        Array.from(motivoListaSelect.options).forEach(option => {
            if (option.value !== "" && option.value !== "SEM_MOTIVO_FILTRO") {
                option.remove();
            }
        });
        motivosCancelamentoDistintos.forEach(motivo => {
            const option = document.createElement('option');
            option.value = motivo;
            option.textContent = motivo;
            motivoListaSelect.appendChild(option);
        });
    }


    // --- Lógica de Importação de Ficheiro de Cancelamentos ---
    async function processarFicheiroCancelamentos() {
        const ficheiro = importCancelamentosFileEl.files[0];
        if (!ficheiro) {
            importacaoCancelamentosStatusEl.textContent = 'Por favor, selecione um ficheiro de cancelamentos.';
            importacaoCancelamentosStatusEl.className = 'mt-4 text-sm text-red-600';
            return;
        }
        importacaoCancelamentosStatusEl.textContent = 'A processar ficheiro...';
        importacaoCancelamentosStatusEl.className = 'mt-4 text-sm text-blue-600';
        mostrarSpinner('loadingCancelamentosImportSpinner');
        cancProcessarImportacaoBtnEl.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const nomePrimeiraFolha = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[nomePrimeiraFolha], { raw: false });

                if (jsonData.length === 0) throw new Error('Ficheiro vazio ou dados ilegíveis.');

                let cancelamentosProcessados = 0;
                for (const row of jsonData) {
                    // Ajustar nomes das colunas conforme o teu ficheiro de cancelamentos
                    const bookingId = row['Booking ID'] || row['booking_id'];
                    const matricula = row['Matrícula'] || row['matricula'];
                    const alocation = row['Alocation'] || row['alocation'];
                    const dataCancelamento = row['Data Cancelamento'] || row['data_cancelamento'] || new Date().toISOString();
                    const motivo = row['Motivo'] || row['motivo_cancelamento'];
                    const quemCancelou = row['Cancelado Por'] || row['quem_cancelou'] || (currentUser ? (userProfile?.full_name || currentUser.email) : 'Sistema');

                    if (!bookingId && (!matricula || !alocation)) {
                        console.warn('Linha ignorada por falta de identificador da reserva (Booking ID ou Matrícula+Alocation):', row);
                        continue;
                    }

                    // 1. Encontrar a reserva original
                    let queryReserva = supabase.from('reservas').select('id, estado_reserva');
                    if (bookingId) {
                        queryReserva = queryReserva.eq('booking_id', bookingId);
                    } else {
                        queryReserva = queryReserva.eq('matricula', matricula).eq('alocation', alocation);
                    }
                    const { data: reservaOriginal, error: erroProcura } = await queryReserva.maybeSingle();

                    if (erroProcura) {
                        console.error(`Erro ao procurar reserva ${bookingId || matricula}:`, erroProcura);
                        continue;
                    }
                    if (!reservaOriginal) {
                        console.warn(`Reserva não encontrada para cancelamento: ${bookingId || matricula}`);
                        continue; // Ou criar um registo de cancelamento órfão?
                    }
                    
                    // 2. Atualizar a reserva
                    const { error: erroUpdate } = await supabase
                        .from('reservas')
                        .update({
                            estado_reserva: 'Cancelada',
                            data_cancelamento: new Date(dataCancelamento).toISOString(),
                            motivo_cancelamento: motivo || null, // Guardar null se vazio
                            quem_cancelou: quemCancelou, // Campo novo a adicionar na tabela 'reservas'
                            user_id_last_modified: currentUser ? currentUser.id : null
                        })
                        .eq('id', reservaOriginal.id);

                    if (erroUpdate) {
                        console.error(`Erro ao atualizar reserva ${reservaOriginal.id} para cancelada:`, erroUpdate);
                    } else {
                        cancelamentosProcessados++;
                        // Log da modificação
                        await supabase.from('reservas_logs').insert({
                            reserva_id: reservaOriginal.id,
                            user_id: currentUser ? currentUser.id : null,
                            descricao_alteracao: `Reserva cancelada. Motivo: ${motivo || 'N/A'}. Por: ${quemCancelou}.`,
                            campo_alterado: 'estado_reserva;data_cancelamento;motivo_cancelamento;quem_cancelou',
                            valor_antigo: reservaOriginal.estado_reserva, // Poderia guardar mais dados antigos
                            valor_novo: 'Cancelada'
                        });
                    }
                }
                importacaoCancelamentosStatusEl.textContent = `${cancelamentosProcessados} cancelamentos processados com sucesso!`;
                importacaoCancelamentosStatusEl.className = 'mt-4 text-sm text-green-600';
                await carregarCancelamentosDaLista();
                await carregarDadosDashboardCancelamentos();
            } catch (error) {
                console.error('Erro ao processar ficheiro de cancelamentos:', error);
                importacaoCancelamentosStatusEl.textContent = `Erro: ${error.message}`;
                importacaoCancelamentosStatusEl.className = 'mt-4 text-sm text-red-600';
            } finally {
                esconderSpinner('loadingCancelamentosImportSpinner');
                cancProcessarImportacaoBtnEl.disabled = false;
                importCancelamentosFileEl.value = '';
            }
        };
        reader.readAsArrayBuffer(ficheiro);
    }

    // --- Lógica do Dashboard de Análise de Cancelamentos ---
    async function carregarDadosDashboardCancelamentos() {
        const dataInicio = cancDashboardFiltroDataInicioEl.value;
        const dataFim = cancDashboardFiltroDataFimEl.value;
        const periodoSelecionado = cancDashboardFiltroPeriodoEl.value;
        const motivoFiltro = cancDashboardFiltroMotivoEl.value;

        let filtroDataInicio, filtroDataFim;
        const hoje = new Date(); hoje.setHours(0,0,0,0);

        switch(periodoSelecionado) {
            case 'hoje':
                filtroDataInicio = new Date(hoje);
                filtroDataFim = new Date(hoje); filtroDataFim.setHours(23,59,59,999);
                break;
            // ... outros cases para período ...
            case 'mes_atual':
                filtroDataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                filtroDataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
                filtroDataFim.setHours(23,59,59,999);
                break;
            default: // Personalizado ou outros
                filtroDataInicio = dataInicio ? new Date(dataInicio) : null;
                if (filtroDataInicio) filtroDataInicio.setHours(0,0,0,0);
                filtroDataFim = dataFim ? new Date(dataFim) : null;
                if (filtroDataFim) filtroDataFim.setHours(23,59,59,999);
                break;
        }
        
        const periodoTexto = filtroDataInicio && filtroDataFim ?
            `${formatarDataHora(filtroDataInicio).split(' ')[0]} - ${formatarDataHora(filtroDataFim).split(' ')[0]}` :
            'Todo o período';
        
        // Atualizar subtextos dos cards
        [statTotalCancelamentosPeriodoEl, statPercCancelamentosPeriodoEl, statCancelamentosSemMotivoPeriodoEl, statValorPerdidoCancelamentosPeriodoEl]
            .forEach(el => el.textContent = periodoTexto);

        // TODO: Chamar Supabase RPC para obter estatísticas de cancelamentos
        // Ex: supabase.rpc('get_cancelamentos_dashboard_stats', { data_inicio, data_fim, motivo_filtro })
        // Esta função RPC precisaria:
        // 1. Contar total de reservas no período (para a percentagem).
        // 2. Contar total de cancelamentos no período (estado_reserva = 'Cancelada' E data_cancelamento dentro do período).
        // 3. Contar cancelamentos sem motivo (motivo_cancelamento IS NULL ou vazio).
        // 4. Somar valor_reserva das reservas canceladas.
        // 5. Agrupar por motivo, por hora, etc.

        // Simulação por agora:
        const totalReservasPeriodoSimulado = Math.floor(Math.random() * 200) + 50; // Evitar divisão por zero
        const totalCancelamentosSimulado = Math.floor(Math.random() * (totalReservasPeriodoSimulado / 4));
        statTotalCancelamentosEl.textContent = totalCancelamentosSimulado;
        const percCancelamentos = totalReservasPeriodoSimulado > 0 ? ((totalCancelamentosSimulado / totalReservasPeriodoSimulado) * 100).toFixed(1) : 0;
        statPercCancelamentosEl.textContent = `${percCancelamentos}%`;
        const cancelamentosSemMotivoSimulado = Math.floor(totalCancelamentosSimulado * 0.2); // 20% sem motivo
        statCancelamentosSemMotivoEl.textContent = cancelamentosSemMotivoSimulado;
        statValorPerdidoCancelamentosEl.textContent = formatarMoeda(totalCancelamentosSimulado * (Math.random() * 30 + 10)); // Valor médio entre 10-40

        // Gráfico de Motivos (simulado)
        const labelsMotivos = motivosCancelamentoDistintos.slice(0,5); // Top 5 motivos
        if (cancelamentosSemMotivoSimulado > 0 && !labelsMotivos.includes("Sem Motivo")) labelsMotivos.push("Sem Motivo");
        const dataMotivos = labelsMotivos.map(() => Math.floor(Math.random() * 20));
        graficoMotivosCancelamento.data.labels = labelsMotivos;
        graficoMotivosCancelamento.data.datasets[0].data = dataMotivos;
        graficoMotivosCancelamento.update();
        
        atualizarGraficoCancelamentosPorHora();
    }

    function atualizarGraficoCancelamentosPorHora() {
        const diaSelecionado = cancDashboardDataHoraInputEl.value;
        if (diaSelecionado) {
            cancDashboardDataHoraDisplayEl.textContent = new Date(diaSelecionado + 'T00:00:00').toLocaleDateString('pt-PT');
            // TODO: Chamar Supabase para obter contagens de cancelamentos por hora
            // Simulação:
            const horas = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
            const contagens = horas.map(() => Math.floor(Math.random() * 5));
            graficoCancelamentosPorHora.data.labels = horas;
            graficoCancelamentosPorHora.data.datasets[0].data = contagens;
            graficoCancelamentosPorHora.update();
        } else {
            cancDashboardDataHoraDisplayEl.textContent = 'selecione um dia';
            graficoCancelamentosPorHora.data.labels = [];
            graficoCancelamentosPorHora.data.datasets[0].data = [];
            graficoCancelamentosPorHora.update();
        }
    }

    // --- Lógica da Lista de Cancelamentos ---
    async function carregarCancelamentosDaLista(pagina = 1) {
        paginaAtualCancelamentosLista = pagina;
        mostrarSpinner('loadingCancelamentosTableSpinner');
        cancelamentosTableBodyEl.innerHTML = '';
        cancelamentosNenhumaMsgEl.classList.add('hidden');

        let query = supabase
            .from('reservas') // Continuamos a ler da tabela 'reservas'
            .select(`
                id, booking_id, matricula, nome_cliente, data_cancelamento, motivo_cancelamento, 
                parque, quem_cancelou,
                user_canc:profiles!reservas_user_id_last_modified_fkey (id, username, full_name)
            `, { count: 'exact' })
            .eq('estado_reserva', 'Cancelada')
            .not('data_cancelamento', 'is', null);

        // Aplicar filtros da lista
        if (cancFiltroBookingIdListaEl.value) query = query.ilike('booking_id', `%${cancFiltroBookingIdListaEl.value}%`);
        if (cancFiltroMatriculaListaEl.value) query = query.ilike('matricula', `%${cancFiltroMatriculaListaEl.value}%`);
        if (cancFiltroDataCancelamentoListaEl.value) query = query.gte('data_cancelamento', cancFiltroDataCancelamentoListaEl.value + 'T00:00:00');
        
        const motivoFiltroLista = cancFiltroMotivoListaEl.value;
        if (motivoFiltroLista) {
            if (motivoFiltroLista === 'SEM_MOTIVO_FILTRO') {
                query = query.or('motivo_cancelamento.is.null,motivo_cancelamento.eq.'); // Vazio ou Nulo
            } else {
                query = query.eq('motivo_cancelamento', motivoFiltroLista);
            }
        }
        
        const offset = (pagina - 1) * itensPorPaginaCancelamentosLista;
        query = query.order('data_cancelamento', { ascending: false }).range(offset, offset + itensPorPaginaCancelamentosLista - 1);

        const { data, error, count } = await query;

        esconderSpinner('loadingCancelamentosTableSpinner');
        if (error) {
            console.error('Erro ao carregar cancelamentos:', error);
            cancelamentosNenhumaMsgEl.textContent = `Erro ao carregar dados: ${error.message}`;
            cancelamentosNenhumaMsgEl.classList.remove('hidden');
            return;
        }

        todosOsCancelamentosGeral = data || [];
        renderCancelamentosTable(todosOsCancelamentosGeral);
        renderPaginacaoCancelamentosLista(count);
    }

    function renderCancelamentosTable(cancelamentos) {
        cancelamentosTableBodyEl.innerHTML = '';
        if (!cancelamentos || cancelamentos.length === 0) {
            cancelamentosNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        cancelamentosNenhumaMsgEl.classList.add('hidden');

        cancelamentos.forEach(canc => {
            const tr = document.createElement('tr');
            const utilizadorQueCancelou = canc.quem_cancelou || (canc.user_canc ? (canc.user_canc.full_name || canc.user_canc.username) : 'N/A');
            tr.innerHTML = `
                <td>${canc.booking_id || 'N/A'}</td>
                <td>${canc.matricula || 'N/A'}</td>
                <td>${canc.nome_cliente || 'N/A'}</td>
                <td>${formatarDataHora(canc.data_cancelamento)}</td>
                <td>${canc.motivo_cancelamento || 'Sem Motivo'}</td>
                <td>${canc.parque || 'N/A'}</td>
                <td>${utilizadorQueCancelou}</td>
                <td class="actions-cell">
                    <button class="action-button text-xs !p-1" data-id="${canc.id}">Ver Detalhes Reserva</button>
                </td>
            `;
            cancelamentosTableBodyEl.appendChild(tr);
        });
    }

    function renderPaginacaoCancelamentosLista(totalItens) {
        cancelamentosPaginacaoEl.innerHTML = '';
        if (!totalItens || totalItens <= itensPorPaginaCancelamentosLista) return;
        const totalPaginas = Math.ceil(totalItens / itensPorPaginaCancelamentosLista);
        for (let i = 1; i <= totalPaginas; i++) {
            const btnPagina = document.createElement('button');
            btnPagina.textContent = i;
            btnPagina.className = `action-button text-sm !p-2 mx-1 ${i === paginaAtualCancelamentosLista ? 'bg-red-700' : 'bg-red-500 hover:bg-red-600'}`; // Cor de perigo
            btnPagina.addEventListener('click', () => carregarCancelamentosDaLista(i));
            cancelamentosPaginacaoEl.appendChild(btnPagina);
        }
    }
    
    // --- Registar Cancelamento Manual ---
    async function abrirModalNovoCancelamento() {
        cancelamentoFormModalTitleEl.textContent = 'Registar Novo Cancelamento';
        cancelamentoFormEl.reset();
        cancelamentoFormReservaIdEl.value = ''; 
        dadosReservaOriginalInfoEl.classList.add('hidden');
        cancelamentoFormDataEl.value = new Date().toISOString().slice(0,16); // Data atual por defeito
        cancelamentoFormQuemCancelouEl.value = userProfile?.full_name || currentUser?.email || '';
        cancelamentoFormModalEl.classList.add('active');
    }
    
    async function buscarDadosReservaParaCancelar() {
        const bookingId = cancelamentoFormBookingIdEl.value;
        const matricula = cancelamentoFormMatriculaEl.value;
        const alocation = cancelamentoFormAlocationEl.value;
        dadosReservaOriginalInfoEl.classList.add('hidden');
        cancelamentoFormReservaIdEl.value = '';


        if (!bookingId && (!matricula || !alocation)) {
            alert("Por favor, forneça o Booking ID ou a Matrícula e Alocation da reserva.");
            return;
        }

        let query = supabase.from('reservas').select('id, nome_cliente, data_entrada_prevista, data_saida_prevista, estado_reserva');
        if (bookingId) {
            query = query.eq('booking_id', bookingId);
        } else {
            query = query.eq('matricula', matricula).eq('alocation', alocation);
        }
        const { data: reserva, error } = await query.maybeSingle();

        if (error) {
            alert(`Erro ao buscar reserva: ${error.message}`);
            return;
        }
        if (!reserva) {
            alert("Reserva não encontrada com os dados fornecidos.");
            return;
        }
        if (reserva.estado_reserva === 'Cancelada') {
            alert("Esta reserva já se encontra cancelada.");
            return;
        }

        cancelamentoFormReservaIdEl.value = reserva.id;
        infoClienteCancEl.textContent = reserva.nome_cliente || 'N/A';
        infoDatasCancEl.textContent = `${formatarDataHora(reserva.data_entrada_prevista)} - ${formatarDataHora(reserva.data_saida_prevista)}`;
        dadosReservaOriginalInfoEl.classList.remove('hidden');
    }
    
    // Adicionar listeners para buscar dados da reserva ao preencher os campos
    cancelamentoFormBookingIdEl.addEventListener('blur', buscarDadosReservaParaCancelar);
    cancelamentoFormAlocationEl.addEventListener('blur', buscarDadosReservaParaCancelar);


    async function submeterFormularioCancelamento(event) {
        event.preventDefault();
        const reservaIdParaCancelar = cancelamentoFormReservaIdEl.value;

        if (!reservaIdParaCancelar) {
            alert("Reserva original não identificada. Por favor, pesquise a reserva primeiro.");
            // Ou tentar buscar novamente se os campos de identificação estiverem preenchidos
            await buscarDadosReservaParaCancelar();
            if (!cancelamentoFormReservaIdEl.value) return; // Se continuou sem ID, sai
        }
        
        const dadosCancelamento = {
            estado_reserva: 'Cancelada',
            data_cancelamento: cancelamentoFormDataEl.value ? new Date(cancelamentoFormDataEl.value).toISOString() : new Date().toISOString(),
            motivo_cancelamento: cancelamentoFormMotivoEl.value || null,
            quem_cancelou: cancelamentoFormQuemCancelouEl.value || (userProfile?.full_name || currentUser?.email || 'Sistema'),
            user_id_last_modified: currentUser ? currentUser.id : null
        };

        const { data: reservaAtualizada, error } = await supabase
            .from('reservas')
            .update(dadosCancelamento)
            .eq('id', cancelamentoFormReservaIdEl.value) // Usar o ID da reserva obtido
            .select('id, booking_id, estado_reserva') // Selecionar para log
            .single();

        if (error) {
            console.error('Erro ao cancelar reserva:', error);
            alert(`Erro ao cancelar: ${error.message}`);
        } else {
            alert(`Reserva ${reservaAtualizada.booking_id} cancelada com sucesso!`);
            
            // Log da modificação
            await supabase.from('reservas_logs').insert({
                reserva_id: reservaAtualizada.id,
                user_id: currentUser ? currentUser.id : null,
                descricao_alteracao: `Reserva cancelada manualmente. Motivo: ${dadosCancelamento.motivo_cancelamento || 'N/A'}. Por: ${dadosCancelamento.quem_cancelou}.`,
                campo_alterado: 'estado_reserva;data_cancelamento;motivo_cancelamento;quem_cancelou',
                valor_novo: 'Cancelada'
            });

            cancelamentoFormModalEl.classList.remove('active');
            await carregarCancelamentosDaLista();
            await carregarDadosDashboardCancelamentos();
        }
    }
    
    // --- Exportar Lista de Cancelamentos ---
    function exportarCancelamentosParaCSV() {
        if (todosOsCancelamentosGeral.length === 0) {
            alert("Não há dados de cancelamentos para exportar.");
            return;
        }
        const dataParaExportar = todosOsCancelamentosGeral.map(canc => ({
            "Booking ID": canc.booking_id || '',
            "Matrícula": canc.matricula || '',
            "Cliente": canc.nome_cliente || '',
            "Data Cancelamento": formatarDataHora(canc.data_cancelamento),
            "Motivo": canc.motivo_cancelamento || 'Sem Motivo',
            "Parque": canc.parque || '',
            "Utilizador Cancel.": canc.quem_cancelou || (canc.user_canc ? (canc.user_canc.full_name || canc.user_canc.username) : '')
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataParaExportar);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Cancelamentos");
        XLSX.writeFile(workbook, `cancelamentos_multipark_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    // --- Event Listeners ---
    if (voltarDashboardBtnCancelamentosEl) {
        voltarDashboardBtnCancelamentosEl.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    if (cancProcessarImportacaoBtnEl) cancProcessarImportacaoBtnEl.addEventListener('click', processarFicheiroCancelamentos);
    if (cancAplicarFiltrosDashboardBtnEl) cancAplicarFiltrosDashboardBtnEl.addEventListener('click', carregarDadosDashboardCancelamentos);
    if (cancDashboardDataHoraInputEl) cancDashboardDataHoraInputEl.addEventListener('change', atualizarGraficoCancelamentosPorHora);
    if (cancDashboardFiltroPeriodoEl) {
         cancDashboardFiltroPeriodoEl.addEventListener('change', () => {
            const personalizado = cancDashboardFiltroPeriodoEl.value === 'personalizado';
            cancDashboardFiltroDataInicioEl.disabled = !personalizado;
            cancDashboardFiltroDataFimEl.disabled = !personalizado;
            if (!personalizado) carregarDadosDashboardCancelamentos();
        });
    }
    if (cancAplicarFiltrosListaBtnEl) cancAplicarFiltrosListaBtnEl.addEventListener('click', () => carregarCancelamentosDaLista(1));
    if (cancExportarListaBtnEl) cancExportarListaBtnEl.addEventListener('click', exportarCancelamentosParaCSV);
    
    if (cancAbrirModalNovoBtnEl) cancAbrirModalNovoBtnEl.addEventListener('click', abrirModalNovoCancelamento);
    cancFecharModalBtns.forEach(btn => btn.addEventListener('click', () => cancelamentoFormModalEl.classList.remove('active')));
    if (cancelamentoFormEl) cancelamentoFormEl.addEventListener('submit', submeterFormularioCancelamento);


    cancelamentosTableBodyEl.addEventListener('click', (event) => {
        const targetButton = event.target.closest('button');
        if (!targetButton) return;
        const reservaId = targetButton.dataset.id;
        if (targetButton.textContent.toLowerCase().includes('ver detalhes') && reservaId) {
            // TODO: Implementar modal de detalhes da reserva original, se necessário
            // Poderia reutilizar o modal de detalhes das Reservas, passando o ID.
            alert(`Ver detalhes da reserva ID: ${reservaId} (funcionalidade a implementar)`);
        }
    });

    // --- Inicialização da Página de Cancelamentos ---
    async function initCancelamentosPage() {
        await carregarMotivosDistintos();
        setupGraficosCancelamentos();
        
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        cancDashboardFiltroDataInicioEl.valueAsDate = primeiroDiaMes;
        cancDashboardFiltroDataFimEl.valueAsDate = ultimoDiaMes;
        cancDashboardFiltroPeriodoEl.value = 'mes_atual';
        cancDashboardFiltroDataInicioEl.disabled = true;
        cancDashboardFiltroDataFimEl.disabled = true;

        await carregarDadosDashboardCancelamentos();
        await carregarCancelamentosDaLista();
        console.log("Subaplicação de Cancelamentos inicializada.");
    }

    initCancelamentosPage();
});

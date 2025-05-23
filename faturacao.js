// js/faturacao.js - Lógica para a Subaplicação de Gestão de Faturação

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Faturação.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnFaturacao');
    
    // Dashboard
    const statFaturasEmitidasMesEl = document.getElementById('statFaturasEmitidasMes');
    const statPendentesPrazoEl = document.getElementById('statPendentesPrazo');
    const statPendentesAtrasadasEl = document.getElementById('statPendentesAtrasadas');

    // Filtros da Lista
    const filtroNomeClienteEl = document.getElementById('fatFiltroNomeCliente');
    const filtroNIFEl = document.getElementById('fatFiltroNIF');
    const filtroEstadoFaturaEl = document.getElementById('fatFiltroEstadoFatura');
    const aplicarFiltrosListaBtnEl = document.getElementById('fatAplicarFiltrosListaBtn');
    const loadingTableSpinnerEl = document.getElementById('loadingFaturacaoTableSpinner');
    const faturacaoTableBodyEl = document.getElementById('faturacaoTableBody');
    const faturacaoNenhumaMsgEl = document.getElementById('faturacaoNenhumaMsg');
    const faturacaoPaginacaoEl = document.getElementById('faturacaoPaginacao');

    // Modal Detalhes/Ações Faturação
    const detalhesModalEl = document.getElementById('faturacaoDetalhesModal');
    const modalTitleEl = document.getElementById('faturacaoModalTitle');
    const modalReservaIdEl = document.getElementById('faturacaoModalReservaId'); // Hidden input
    const modalClienteNomeEl = document.getElementById('modalClienteNome');
    const modalClienteNIFEl = document.getElementById('modalClienteNIF');
    const modalClienteMoradaEl = document.getElementById('modalClienteMorada');
    const modalClienteEmailEl = document.getElementById('modalClienteEmail');
    const modalReservaBookingIdEl = document.getElementById('modalReservaBookingId');
    const modalReservaMatriculaEl = document.getElementById('modalReservaMatricula');
    const modalReservaPeriodoEl = document.getElementById('modalReservaPeriodo');
    const modalReservaValorEl = document.getElementById('modalReservaValor');
    const modalReservaItensEl = document.getElementById('modalReservaItensFaturar');
    const modalRefExternaEl = document.getElementById('faturacaoModalRefExterna');
    const modalObsEl = document.getElementById('faturacaoModalObs');
    const marcarEmitidaBtnEl = document.getElementById('faturacaoMarcarEmitidaBtn');
    const modalStatusEl = document.getElementById('faturacaoModalStatus');
    const fecharModalBtns = document.querySelectorAll('.fatFecharModalBtn');

    // --- Estado da Aplicação ---
    let listaParaFaturarGeral = [];
    let paginaAtualLista = 1;
    const itensPorPaginaLista = 15;

    // --- Funções Auxiliares ---
    function formatarDataHora(dataISO, apenasData = false) {
        if (!dataISO) return 'N/A';
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        if (!apenasData) { options.hour = '2-digit'; options.minute = '2-digit'; }
        try { return new Date(dataISO).toLocaleString('pt-PT', options); }
        catch (e) { return dataISO; }
    }
    function formatarMoeda(valor) { return parseFloat(valor || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }
    function mostrarSpinner(id, show = true) { document.getElementById(id)?.classList.toggle('hidden', !show); }
    
    function calcularEstadoFaturacao(dataSaidaReal, estadoFaturacaoAtual) {
        if (estadoFaturacaoAtual === 'Emitida' || estadoFaturacaoAtual === 'Enviada') {
            return { texto: estadoFaturacaoAtual, classe: 'status-faturado', prioridade: 3 };
        }
        if (!dataSaidaReal) {
            return { texto: 'Aguarda Saída', classe: 'bg-gray-200 text-gray-700', prioridade: 4 };
        }
        const dataSaida = new Date(dataSaidaReal);
        const agora = new Date();
        const diffHoras = (agora - dataSaida) / (1000 * 60 * 60);

        if (diffHoras <= 48) {
            return { texto: 'Pendente (Prazo)', classe: 'status-pendente-prazo', prioridade: 1 };
        } else {
            return { texto: 'Pendente (Atrasada)', classe: 'status-pendente-atrasado', prioridade: 0 };
        }
    }

    // --- Lógica do Dashboard de Faturação ---
    async function carregarDadosDashboardFaturacao() {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59).toISOString();

        // Faturas Emitidas no Mês
        const { count: emitidasCount, error: errorEmitidas } = await supabase
            .from('reservas') // Ou tabela 'faturas'
            .select('*', { count: 'exact', head: true })
            .in('faturacao_estado', ['Emitida', 'Enviada'])
            .gte('faturacao_data_emissao', inicioMes)
            .lte('faturacao_data_emissao', fimMes);
        if (errorEmitidas) console.error("Erro dashboard (emitidas):", errorEmitidas);
        statFaturasEmitidasMesEl.textContent = emitidasCount || 0;

        // Pendentes (buscar todas as pendentes e calcular prazo no cliente)
        const { data: pendentes, error: errorPendentes } = await supabase
            .from('reservas')
            .select('data_saida_real, faturacao_estado, nif_cliente, nome_cliente') // Apenas campos necessários
            .eq('faturacao_necessaria', true) // Apenas as que precisam de fatura
            .not('faturacao_estado', 'in', '("Emitida", "Enviada")') // Que não estejam já faturadas
            .not('nif_cliente', 'is', null) // Que tenham NIF
            .not('nome_cliente', 'is', null); // E nome

        if (errorPendentes) console.error("Erro dashboard (pendentes):", errorPendentes);
        
        let pendentesPrazo = 0;
        let pendentesAtrasadas = 0;
        if (pendentes) {
            pendentes.forEach(res => {
                const estadoCalc = calcularEstadoFaturacao(res.data_saida_real, res.faturacao_estado);
                if (estadoCalc.classe === 'status-pendente-prazo') pendentesPrazo++;
                else if (estadoCalc.classe === 'status-pendente-atrasado') pendentesAtrasadas++;
            });
        }
        statPendentesPrazoEl.textContent = pendentesPrazo;
        statPendentesAtrasadasEl.textContent = pendentesAtrasadas;
    }

    // --- Lógica da Lista de Clientes/Reservas para Faturar ---
    async function carregarListaParaFaturar(pagina = 1) {
        paginaAtualLista = pagina;
        mostrarSpinner('loadingFaturacaoTableSpinner', true);
        faturacaoTableBodyEl.innerHTML = '';
        faturacaoNenhumaMsgEl.classList.add('hidden');

        let query = supabase
            .from('reservas') // Assumindo que os dados para faturação vêm das reservas
            .select(`
                id, booking_id, nome_cliente, nif_cliente, data_saida_real, 
                preco_final_pago, valor_reserva, estado_reserva, faturacao_estado, faturacao_data_emissao,
                morada_cliente, email_cliente, // Adicionar se existirem na tabela reservas ou se fizer join com clientes
                parques (nome) 
            `, { count: 'exact' })
            .eq('faturacao_necessaria', true) // Apenas as que precisam de fatura
            .not('nif_cliente', 'is', null)   // Apenas as que têm NIF
            .not('nome_cliente', 'is', null); // E nome

        // Aplicar filtros da lista
        if (filtroNomeClienteEl.value) query = query.ilike('nome_cliente', `%${filtroNomeClienteEl.value}%`);
        if (filtroNIFEl.value) query = query.ilike('nif_cliente', `%${filtroNIFEl.value}%`);
        
        const estadoFiltro = filtroEstadoFaturaEl.value;
        if (estadoFiltro) {
            if (estadoFiltro === 'Emitida') {
                query = query.in('faturacao_estado', ['Emitida', 'Enviada']);
            } else if (estadoFiltro === 'PendentePrazo') {
                // Esta lógica de filtro por prazo é mais complexa para fazer diretamente na query
                // Seria melhor filtrar no cliente após buscar todas as pendentes, ou usar uma RPC.
                // Por agora, vamos buscar todas as pendentes e filtrar no JS.
                query = query.not('faturacao_estado', 'in', '("Emitida", "Enviada")');
            } else if (estadoFiltro === 'PendenteAtrasada') {
                query = query.not('faturacao_estado', 'in', '("Emitida", "Enviada")');
            }
        }
        
        const offset = (pagina - 1) * itensPorPaginaLista;
        // Ordenar por prioridade de estado (Atrasadas primeiro, depois Prazo, depois Faturadas)
        // Esta ordenação complexa é melhor feita no cliente após o fetch, ou com uma view/RPC.
        // query = query.order('data_saida_real', { ascending: true }); // Para ver as mais antigas primeiro
        
        const { data, error, count } = await query.range(offset, offset + itensPorPaginaLista -1); // Temporariamente sem ordenação complexa

        mostrarSpinner('loadingFaturacaoTableSpinner', false);
        if (error) {
            console.error('Erro ao carregar lista para faturação:', error);
            faturacaoNenhumaMsgEl.textContent = `Erro ao carregar dados: ${error.message}`;
            faturacaoNenhumaMsgEl.classList.remove('hidden');
            return;
        }

        let itemsFiltrados = data || [];
        // Aplicar filtro de estado de prazo/atrasada no cliente se necessário
        if (estadoFiltro === 'PendentePrazo') {
            itemsFiltrados = itemsFiltrados.filter(item => calcularEstadoFaturacao(item.data_saida_real, item.faturacao_estado).classe === 'status-pendente-prazo');
        } else if (estadoFiltro === 'PendenteAtrasada') {
            itemsFiltrados = itemsFiltrados.filter(item => calcularEstadoFaturacao(item.data_saida_real, item.faturacao_estado).classe === 'status-pendente-atrasado');
        }
        
        // Ordenar no cliente pela prioridade do estado
        itemsFiltrados.sort((a,b) => {
            const estadoA = calcularEstadoFaturacao(a.data_saida_real, a.faturacao_estado).prioridade;
            const estadoB = calcularEstadoFaturacao(b.data_saida_real, b.faturacao_estado).prioridade;
            if(estadoA !== estadoB) return estadoA - estadoB;
            return new Date(a.data_saida_real) - new Date(b.data_saida_real); // Mais antigo primeiro dentro do mesmo estado
        });


        listaParaFaturarGeral = itemsFiltrados;
        renderTabelaFaturacao(listaParaFaturarGeral);
        renderPaginacaoFaturacao(count); // Idealmente, o count seria dos itemsFiltrados se o filtro de estado fosse feito no server
    }

    function renderTabelaFaturacao(items) {
        faturacaoTableBodyEl.innerHTML = '';
        if (!items || items.length === 0) {
            faturacaoNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        faturacaoNenhumaMsgEl.classList.add('hidden');

        items.forEach(item => {
            const tr = document.createElement('tr');
            const estadoInfo = calcularEstadoFaturacao(item.data_saida_real, item.faturacao_estado);
            const valorAFaturar = item.preco_final_pago !== null ? item.preco_final_pago : item.valor_reserva;

            tr.innerHTML = `
                <td>${item.nome_cliente || 'N/A'}</td>
                <td>${item.nif_cliente || 'N/A'}</td>
                <td>${item.booking_id || item.id}</td>
                <td>${formatarDataHora(item.data_saida_real, true)}</td>
                <td>${formatarMoeda(valorAFaturar)}</td>
                <td><span class="status-tag ${estadoInfo.classe}">${estadoInfo.texto}</span></td>
                <td class="actions-cell">
                    <button class="action-button text-xs !p-1 fat-detalhes-btn" data-id="${item.id}">Dados/Faturar</button>
                </td>
            `;
            faturacaoTableBodyEl.appendChild(tr);
        });
    }

    function renderPaginacaoFaturacao(totalItens) {
        faturacaoPaginacaoEl.innerHTML = '';
        if (!totalItens || totalItens <= itensPorPaginaLista) return;
        const totalPaginas = Math.ceil(totalItens / itensPorPaginaLista);
        for (let i = 1; i <= totalPaginas; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `action-button text-sm !p-2 mx-1 ${i === paginaAtualLista ? 'bg-purple-700' : 'bg-purple-500 hover:bg-purple-600'}`;
            btn.addEventListener('click', () => carregarListaParaFaturar(i));
            faturacaoPaginacaoEl.appendChild(btn);
        }
    }

    // --- Modal de Detalhes e Ações de Faturação ---
    async function abrirModalFaturacao(reservaId) {
        mostrarSpinner('loadingFaturacaoTableSpinner', true); // Reutilizar spinner
        const { data: reserva, error } = await supabase
            .from('reservas')
            .select(`*, parques(nome)`) // Adicionar morada_cliente, email_cliente se estiverem na tabela reservas
            .eq('id', reservaId)
            .single();
        mostrarSpinner('loadingFaturacaoTableSpinner', false);

        if (error || !reserva) {
            alert("Erro ao carregar detalhes da reserva para faturação.");
            console.error("Erro:", error);
            return;
        }

        modalReservaIdEl.value = reserva.id;
        modalTitleEl.textContent = `Faturar Reserva: ${reserva.booking_id || reserva.id}`;
        modalClienteNomeEl.textContent = reserva.nome_cliente || 'N/A';
        modalClienteNIFEl.textContent = reserva.nif_cliente || 'N/A';
        modalClienteMoradaEl.textContent = reserva.morada_cliente || 'Não disponível na reserva'; // Assumindo que existe
        modalClienteEmailEl.textContent = reserva.email_cliente || 'Não disponível na reserva'; // Assumindo que existe

        modalReservaBookingIdEl.textContent = reserva.booking_id || 'N/A';
        modalReservaMatriculaEl.textContent = reserva.matricula || 'N/A';
        modalReservaPeriodoEl.textContent = `${formatarDataHora(reserva.data_entrada_prevista)} - ${formatarDataHora(reserva.data_saida_real || reserva.data_saida_prevista)}`;
        const valorFinal = reserva.preco_final_pago !== null ? reserva.preco_final_pago : reserva.valor_reserva;
        modalReservaValorEl.textContent = formatarMoeda(valorFinal);
        
        // TODO: Detalhar itens a faturar se necessário (ex: múltiplos serviços na reserva)
        modalReservaItensEl.innerHTML = `<li>Serviço Principal: ${formatarMoeda(valorFinal)}</li>`;

        modalRefExternaEl.value = reserva.faturacao_referencia_externa || '';
        modalObsEl.value = reserva.faturacao_observacoes || ''; // Assumindo campo faturacao_observacoes

        marcarEmitidaBtnEl.disabled = reserva.faturacao_estado === 'Emitida' || reserva.faturacao_estado === 'Enviada';
        modalStatusEl.textContent = '';
        detalhesModalEl.classList.add('active');
    }

    async function submeterMarcarComoEmitida() {
        const reservaId = modalReservaIdEl.value;
        if (!reservaId) return;

        marcarEmitidaBtnEl.disabled = true;
        modalStatusEl.textContent = 'A atualizar...';

        const dadosUpdate = {
            faturacao_estado: 'Emitida', // Ou 'Enviada' se tiveres essa distinção
            faturacao_data_emissao: new Date().toISOString(),
            faturacao_user_id: currentUser?.id,
            faturacao_referencia_externa: modalRefExternaEl.value || null,
            faturacao_observacoes: modalObsEl.value || null // Assumindo este campo
        };

        const { error } = await supabase
            .from('reservas')
            .update(dadosUpdate)
            .eq('id', reservaId);

        if (error) {
            console.error("Erro ao marcar como faturado:", error);
            modalStatusEl.textContent = `Erro: ${error.message}`;
            marcarEmitidaBtnEl.disabled = false;
        } else {
            modalStatusEl.textContent = 'Fatura marcada como emitida com sucesso!';
            await carregarListaParaFaturar(paginaAtualLista);
            await carregarDadosDashboardFaturacao();
            setTimeout(() => detalhesModalEl.classList.remove('active'), 1500);
        }
    }

    // --- Event Listeners ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (aplicarFiltrosListaBtnEl) aplicarFiltrosListaBtnEl.addEventListener('click', () => carregarListaParaFaturar(1));
    
    faturacaoTableBodyEl.addEventListener('click', (e) => {
        const targetButton = e.target.closest('.fat-detalhes-btn');
        if (targetButton) {
            abrirModalFaturacao(targetButton.dataset.id);
        }
    });

    fecharModalBtns.forEach(btn => btn.addEventListener('click', () => detalhesModalEl.classList.remove('active')));
    if (marcarEmitidaBtnEl) marcarEmitidaBtnEl.addEventListener('click', submeterMarcarComoEmitida);

    // --- Inicialização da Página ---
    async function initFaturacaoPage() {
        // Definir data padrão para dashboard (Mês atual)
        // (Lógica de datas para filtros do dashboard pode ser adicionada aqui)
        await carregarDadosDashboardFaturacao();
        await carregarListaParaFaturar();
        console.log("Subaplicação de Faturação inicializada.");
    }

    initFaturacaoPage();
});

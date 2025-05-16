// js/fecho_caixa.js - Lógica para a Subaplicação de Fecho de Caixa

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Fecho de Caixa.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile')); // Assume que tem 'parque_id' ou 'parque_associado_id' e 'role'

    // --- Seletores de Elementos DOM ---
    const importBackOfficeFileEl = document.getElementById('importBackOfficeFile');
    const fcProcessarBackOfficeBtnEl = document.getElementById('fcProcessarBackOfficeBtn');
    const importBackOfficeStatusEl = document.getElementById('importBackOfficeStatus');
    const importOdooFileEl = document.getElementById('importOdooFile');
    const fcProcessarOdooBtnEl = document.getElementById('fcProcessarOdooBtn');
    const importOdooStatusEl = document.getElementById('importOdooStatus');
    const loadingImportSpinnerFcEl = document.getElementById('loadingImportSpinnerFc');

    const fcCondutorSelectEl = document.getElementById('fcCondutorSelect');
    const fcCarregarEntregasCondutorBtnEl = document.getElementById('fcCarregarEntregasCondutorBtn');
    const loadingEntregasSpinnerEl = document.getElementById('loadingEntregasSpinner');
    const fcEntregasCondutorTableBodyEl = document.getElementById('fcEntregasCondutorTableBody');
    const fcEntregasNenhumaMsgEl = document.getElementById('fcEntregasNenhumaMsg');

    const fcComparacaoDataEl = document.getElementById('fcComparacaoData');
    const fcIniciarComparacaoBtnEl = document.getElementById('fcIniciarComparacaoBtn');
    const loadingComparacaoSpinnerEl = document.getElementById('loadingComparacaoSpinner');
    const fcResumoComparacaoEl = document.getElementById('fcResumoComparacao');
    const fcComparacaoTableBodyEl = document.getElementById('fcComparacaoTableBody');
    const fcComparacaoNenhumaMsgEl = document.getElementById('fcComparacaoNenhumaMsg');

    const fcDashboardDataEl = document.getElementById('fcDashboardData');
    const fcAtualizarDashboardBtnEl = document.getElementById('fcAtualizarDashboardBtn');
    const statTotalNumerarioEl = document.getElementById('statTotalNumerario');
    const statTotalMultibancoEl = document.getElementById('statTotalMultibanco');
    const statTotalOutrosEl = document.getElementById('statTotalOutros');
    const statTotalGeralEl = document.getElementById('statTotalGeral');
    const statTransacoesCorrigidasEl = document.getElementById('statTransacoesCorrigidas');
    const statTotalTransacoesEl = document.getElementById('statTotalTransacoes');
    const chartMetodosPagamentoDiaEl = document.getElementById('chartMetodosPagamentoDia');

    const fcConfirmarFechoDiaBtnEl = document.getElementById('fcConfirmarFechoDiaBtn');
    const fechoDiaStatusEl = document.getElementById('fechoDiaStatus');
    const loadingFechoDiaSpinnerEl = document.getElementById('loadingFechoDiaSpinner');
    
    const voltarDashboardBtnFechoCaixaEl = document.getElementById('voltarDashboardBtnFechoCaixa');

    // Modal de Validação
    const fcValidacaoModalEl = document.getElementById('fcValidacaoModal');
    const fcValidacaoModalTitleEl = document.getElementById('fcValidacaoModalTitle');
    const fcValidacaoFormEl = document.getElementById('fcValidacaoForm');
    const fcValidacaoReservaIdEl = document.getElementById('fcValidacaoReservaId'); // Hidden input
    const modalReservaIdDisplayEl = document.getElementById('modalReservaIdDisplay');
    const modalMatriculaDisplayEl = document.getElementById('modalMatriculaDisplay');
    const modalValorPrevistoDisplayEl = document.getElementById('modalValorPrevistoDisplay');
    const fcModalValorRecebidoEl = document.getElementById('fcModalValorRecebido');
    const fcModalMetodoPagamentoEl = document.getElementById('fcModalMetodoPagamento');
    const fcModalJustificativaEl = document.getElementById('fcModalJustificativa');
    const fcFecharValidacaoModalBtns = document.querySelectorAll('.fcFecharValidacaoModalBtn');

    // --- Estado da Aplicação ---
    let odooDataGlobal = []; // Para guardar os dados do ficheiro Odoo carregado
    let entregasCondutorPendentes = []; // Entregas carregadas para o condutor selecionado
    let idSessaoCaixaAtual = null; // ID da sessão de caixa do dia (da tabela caixa_sessoes_diarias)

    // --- Configuração de Gráficos ---
    let graficoMetodosPagamentoDia;

    function setupGraficosFechoCaixa() {
        const ctxMetodos = chartMetodosPagamentoDiaEl.getContext('2d');
        if (graficoMetodosPagamentoDia) graficoMetodosPagamentoDia.destroy();
        graficoMetodosPagamentoDia = new Chart(ctxMetodos, {
            type: 'doughnut',
            data: { labels: ['Numerário', 'Multibanco', 'Outros'], datasets: [{ label: 'Distribuição por Método', data: [0,0,0], backgroundColor: ['#28a745', '#007bff', '#ffc107'], borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    // --- Funções Auxiliares ---
    function formatarMoeda(valor) {
        if (valor === null || valor === undefined) return '0,00 €';
        return parseFloat(valor).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
    }
    function mostrarSpinner(spinnerId) { document.getElementById(spinnerId)?.classList.remove('hidden'); }
    function esconderSpinner(spinnerId) { document.getElementById(spinnerId)?.classList.add('hidden'); }
    function normalizarMatricula(matricula) {
        if (!matricula) return null;
        return String(matricula).replace(/[\s\-\.]/g, '').toUpperCase();
    }

    // --- Carregar Condutores para Select ---
    async function carregarCondutoresParaSelect() {
        // Assumindo que condutores são utilizadores com um certo 'role' na tabela 'profiles'
        // ou que existe uma forma de os identificar.
        const { data, error } = await supabase
            .from('profiles') // Ajustar se o nome da tabela for diferente
            .select('id, username, full_name')
            // .eq('role', 'condutor_entrega') // Exemplo de filtro por role
            .order('full_name', { ascending: true });

        if (error) {
            console.error("Erro ao carregar condutores:", error);
            fcCondutorSelectEl.innerHTML = '<option value="">Erro ao carregar</option>';
            return;
        }
        fcCondutorSelectEl.innerHTML = '<option value="">-- Selecione um Condutor --</option>';
        (data || []).forEach(cond => {
            const option = document.createElement('option');
            option.value = cond.id;
            option.textContent = cond.full_name || cond.username || cond.id;
            fcCondutorSelectEl.appendChild(option);
        });
    }

    // --- Lógica de Importação ---
    async function processarImportacaoBackOffice() {
        const ficheiro = importBackOfficeFileEl.files[0];
        if (!ficheiro) {
            importBackOfficeStatusEl.textContent = 'Selecione um ficheiro Back Office.';
            importBackOfficeStatusEl.className = 'mt-2 text-xs text-red-600';
            return;
        }
        importBackOfficeStatusEl.textContent = 'A processar Back Office...';
        importBackOfficeStatusEl.className = 'mt-2 text-xs text-blue-600';
        mostrarSpinner('loadingImportSpinnerFc');
        fcProcessarBackOfficeBtnEl.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const nomePrimeiraFolha = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[nomePrimeiraFolha], { raw: false });

                if (jsonData.length === 0) throw new Error('Ficheiro Back Office vazio.');

                const upserts = jsonData.map(row => {
                    // Mapear colunas do Excel para a tabela 'reservas'
                    // IMPORTANTE: Ajustar os nomes das colunas do Excel!
                    const matriculaNorm = normalizarMatricula(row['Matrícula'] || row['license_plate']);
                    const alocationNorm = row['Alocation'] || row['alocation'];

                    if (!matriculaNorm || !alocationNorm) return null; // Skip se não tiver chaves

                    return {
                        // Chaves para o upsert (Supabase vai usar para encontrar ou criar)
                        matricula: matriculaNorm,
                        alocation: alocationNorm,
                        // Campos a atualizar/inserir
                        booking_id: row['Booking ID'] || row['booking_id'],
                        data_reserva: row['Data Reserva'] ? new Date(row['Data Reserva']).toISOString() : null,
                        nome_cliente: row['Cliente'] || row['nome_cliente'],
                        data_entrada_prevista: row['Entrada Prev.'] ? new Date(row['Entrada Prev.']).toISOString() : null,
                        data_saida_prevista: row['Saída Prev.'] ? new Date(row['Saída Prev.']).toISOString() : null,
                        parque: row['Parque'] || (userProfile?.parque_associado_id || null), // Assumir parque do user se não vier no ficheiro
                        valor_reserva: parseFloat(row['Valor Reserva'] || row['valor_reserva'] || 0),
                        metodo_pagamento_previsto: row['Método Pag. Previsto'] || row['metodo_pagamento_previsto'],
                        estado_reserva: row['Estado Reserva'] || 'Confirmada', // Estado inicial
                        // Adicionar mais campos do BackOffice que devam ir para 'reservas'
                        // Ex: user_id_created: currentUser?.id, // Se for uma nova reserva criada por esta importação
                    };
                }).filter(Boolean); // Remover nulos

                if (upserts.length > 0) {
                    const { error } = await supabase.from('reservas').upsert(upserts, {
                        onConflict: 'matricula,alocation', // Define as colunas para deteção de conflito
                        // ignoreDuplicates: false // Padrão é false, o que significa que vai atualizar
                    });
                    if (error) throw error;
                    importBackOfficeStatusEl.textContent = `${upserts.length} registos processados/atualizados em Reservas.`;
                    importBackOfficeStatusEl.className = 'mt-2 text-xs text-green-600';
                } else {
                    importBackOfficeStatusEl.textContent = 'Nenhum registo válido encontrado no ficheiro para processar.';
                    importBackOfficeStatusEl.className = 'mt-2 text-xs text-yellow-600';
                }
            } catch (error) {
                console.error("Erro ao processar Back Office:", error);
                importBackOfficeStatusEl.textContent = `Erro: ${error.message}`;
                importBackOfficeStatusEl.className = 'mt-2 text-xs text-red-600';
            } finally {
                esconderSpinner('loadingImportSpinnerFc');
                fcProcessarBackOfficeBtnEl.disabled = false;
                importBackOfficeFileEl.value = '';
            }
        };
        reader.readAsArrayBuffer(ficheiro);
    }

    async function carregarFicheiroOdoo() {
        const ficheiro = importOdooFileEl.files[0];
        if (!ficheiro) {
            importOdooStatusEl.textContent = 'Selecione um ficheiro Odoo.';
            importOdooStatusEl.className = 'mt-2 text-xs text-red-600';
            return;
        }
        importOdooStatusEl.textContent = 'A carregar Odoo...';
        importOdooStatusEl.className = 'mt-2 text-xs text-blue-600';
        mostrarSpinner('loadingImportSpinnerFc');
        fcProcessarOdooBtnEl.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const nomePrimeiraFolha = workbook.SheetNames[0];
                odooDataGlobal = XLSX.utils.sheet_to_json(workbook.Sheets[nomePrimeiraFolha], { raw: false });
                
                if (odooDataGlobal.length === 0) throw new Error('Ficheiro Odoo vazio.');

                importOdooStatusEl.textContent = `${odooDataGlobal.length} registos carregados do Odoo. Pronto para comparação.`;
                importOdooStatusEl.className = 'mt-2 text-xs text-green-600';
            } catch (error) {
                console.error("Erro ao carregar Odoo:", error);
                importOdooStatusEl.textContent = `Erro: ${error.message}`;
                importOdooStatusEl.className = 'mt-2 text-xs text-red-600';
                odooDataGlobal = [];
            } finally {
                esconderSpinner('loadingImportSpinnerFc');
                fcProcessarOdooBtnEl.disabled = false;
                // Não limpar o input aqui, para o caso de querer re-comparar sem re-upload
            }
        };
        reader.readAsArrayBuffer(ficheiro);
    }

    // --- Lógica de Validação de Caixa por Condutor ---
    async function carregarEntregasPendentesCondutor() {
        const condutorId = fcCondutorSelectEl.value;
        if (!condutorId) {
            alert("Selecione um condutor.");
            return;
        }
        mostrarSpinner('loadingEntregasSpinner');
        fcEntregasCondutorTableBodyEl.innerHTML = '';
        fcEntregasNenhumaMsgEl.classList.add('hidden');

        // Buscar reservas que precisam de validação de caixa para este condutor
        // Ex: estado 'Em Curso' ou 'EntreguePendenteCaixa' e com 'condutor_entrega_id' (ou similar)
        const { data, error } = await supabase
            .from('reservas')
            .select('id, booking_id, matricula, alocation, valor_reserva, metodo_pagamento_previsto, estado_reserva')
            .eq('condutor_entrega_id', condutorId) // Assumindo que 'condutor_entrega_id' foi preenchido na fase de "Entregas"
            .in('estado_reserva', ['Em Curso', 'EntreguePendenteCaixa']) // Ajustar estados conforme o teu fluxo
            .order('data_saida_prevista', { ascending: true });

        esconderSpinner('loadingEntregasSpinner');
        if (error) {
            console.error("Erro ao carregar entregas do condutor:", error);
            fcEntregasNenhumaMsgEl.textContent = "Erro ao carregar entregas.";
            fcEntregasNenhumaMsgEl.classList.remove('hidden');
            return;
        }

        entregasCondutorPendentes = data || [];
        if (entregasCondutorPendentes.length === 0) {
            fcEntregasNenhumaMsgEl.textContent = "Nenhuma entrega pendente de validação para este condutor.";
            fcEntregasNenhumaMsgEl.classList.remove('hidden');
            return;
        }

        entregasCondutorPendentes.forEach(entrega => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entrega.booking_id || entrega.id}</td>
                <td>${entrega.matricula}</td>
                <td>${entrega.alocation}</td>
                <td>${formatarMoeda(entrega.valor_reserva)}</td>
                <td>${entrega.metodo_pagamento_previsto || 'N/A'}</td>
                <td><input type="number" step="0.01" class="fc-valor-recebido w-full p-1 border rounded" value="${parseFloat(entrega.valor_reserva || 0).toFixed(2)}"></td>
                <td>
                    <select class="fc-metodo-pagamento w-full p-1 border rounded">
                        <option value="Numerário" ${entrega.metodo_pagamento_previsto === 'Numerário' ? 'selected' : ''}>Numerário</option>
                        <option value="Multibanco" ${entrega.metodo_pagamento_previsto === 'Multibanco' ? 'selected' : ''}>Multibanco</option>
                        <option value="MBWay">MBWay</option>
                        <option value="Online Confirmado">Online Confirmado</option>
                        <option value="No Pay (Campanha)">No Pay (Campanha)</option>
                        <option value="Outro">Outro</option>
                    </select>
                </td>
                <td><input type="text" class="fc-justificativa w-full p-1 border rounded" placeholder="Se houver diferença..."></td>
                <td><button class="action-button success text-xs !p-1 fc-validar-entrega-btn" data-reserva-id="${entrega.id}">Validar</button></td>
            `;
            fcEntregasCondutorTableBodyEl.appendChild(tr);
        });
    }

    async function handleValidarEntrega(event) {
        if (!event.target.classList.contains('fc-validar-entrega-btn')) return;

        const botao = event.target;
        const reservaId = botao.dataset.reservaId;
        const linha = botao.closest('tr');
        const valorRecebidoEl = linha.querySelector('.fc-valor-recebido');
        const metodoPagamentoEl = linha.querySelector('.fc-metodo-pagamento');
        const justificativaEl = linha.querySelector('.fc-justificativa');

        const valorRecebido = parseFloat(valorRecebidoEl.value);
        const metodoPagamento = metodoPagamentoEl.value;
        const justificativa = justificativaEl.value.trim();

        if (isNaN(valorRecebido)) {
            alert("Valor recebido inválido.");
            return;
        }

        const entregaOriginal = entregasCondutorPendentes.find(e => e.id === reservaId);
        if (!entregaOriginal) {
            alert("Erro: Entrega original não encontrada.");
            return;
        }

        const foiCorrigido = parseFloat(entregaOriginal.valor_reserva || 0) !== valorRecebido || entregaOriginal.metodo_pagamento_previsto !== metodoPagamento;
        if (foiCorrigido && !justificativa) {
            if (!confirm("Houve uma alteração no valor ou método de pagamento. Deseja continuar sem justificativa?")) {
                return;
            }
        }
        
        botao.textContent = 'Aguarde...';
        botao.disabled = true;

        // Obter ou criar ID da sessão de caixa do dia
        const sessaoId = await obterOuCriarSessaoCaixaDia();
        if (!sessaoId) {
            alert("Erro ao obter sessão de caixa do dia. Tente novamente.");
            botao.textContent = 'Validar';
            botao.disabled = false;
            return;
        }

        const transacaoValidada = {
            reserva_id: reservaId,
            caixa_sessao_diaria_id: sessaoId,
            user_validador_id: currentUser?.id,
            condutor_id: fcCondutorSelectEl.value, // ID do condutor que está a ser validado
            data_validacao: new Date().toISOString(),
            valor_original_reserva: entregaOriginal.valor_reserva,
            valor_corrigido_recebido: valorRecebido,
            metodo_pagamento_original: entregaOriginal.metodo_pagamento_previsto,
            metodo_pagamento_corrigido: metodoPagamento,
            diferenca_valor: valorRecebido - parseFloat(entregaOriginal.valor_reserva || 0),
            justificativa_correcao: justificativa || null,
            foi_corrigido: foiCorrigido,
            parque_id: userProfile?.parque_associado_id || null // Parque do utilizador logado
        };

        const { error: erroTransacao } = await supabase.from('caixa_transacoes_validadas').insert(transacaoValidada);

        if (erroTransacao) {
            console.error("Erro ao guardar transação validada:", erroTransacao);
            alert(`Erro ao guardar validação: ${erroTransacao.message}`);
            botao.textContent = 'Validar';
            botao.disabled = false;
            return;
        }

        // Atualizar estado da reserva original
        const { error: erroUpdateReserva } = await supabase
            .from('reservas')
            .update({
                estado_reserva: 'ValidadaFinanceiramente', // Ou 'Concluída'
                preco_final_pago: valorRecebido,
                metodo_pagamento_final: metodoPagamento,
                data_validacao_caixa: new Date().toISOString(),
                user_validador_caixa_id: currentUser?.id,
                // data_saida_real: new Date().toISOString(), // Se o fecho de caixa implicar o checkout final
            })
            .eq('id', reservaId);

        if (erroUpdateReserva) {
            console.error("Erro ao atualizar reserva original:", erroUpdateReserva);
            // Considerar rollback da transação validada ou logar a inconsistência
            alert(`Transação guardada, mas erro ao atualizar reserva: ${erroUpdateReserva.message}`);
        }
        
        // Log
         await supabase.from('reservas_logs').insert({
            reserva_id: reservaId,
            user_id: currentUser?.id,
            descricao_alteracao: `Validação de caixa. Valor: ${formatarMoeda(valorRecebido)}, Método: ${metodoPagamento}. Just: ${justificativa || 'N/A'}`,
            campo_alterado: 'estado_reserva;preco_final_pago;metodo_pagamento_final',
            valor_novo: `ValidadaFinanceiramente;${valorRecebido};${metodoPagamento}`
        });


        alert("Entrega validada com sucesso!");
        linha.remove(); // Remove da lista de pendentes na UI
        // Atualizar dashboard se estiver visível
        if (fcDashboardDataEl.value) await carregarDadosDashboardFechoCaixa();
    }
    
    // --- Sessão de Caixa Diária ---
    async function obterOuCriarSessaoCaixaDia() {
        if (idSessaoCaixaAtual) return idSessaoCaixaAtual;

        const dataSessao = fcDashboardDataEl.value || new Date().toISOString().split('T')[0];
        const parqueId = userProfile?.parque_associado_id || null; // Obter o parque do utilizador logado

        if (!parqueId) {
            console.error("Parque do utilizador não definido. Não é possível criar/obter sessão de caixa.");
            return null;
        }

        // Tentar obter sessão existente para a data e parque
        let { data: sessao, error } = await supabase
            .from('caixa_sessoes_diarias')
            .select('id, estado')
            .eq('data_sessao', dataSessao)
            .eq('parque_id', parqueId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = single row not found
            console.error("Erro ao obter sessão de caixa:", error);
            return null;
        }

        if (sessao) {
            if (sessao.estado === 'Fechada') {
                alert(`A sessão de caixa para ${dataSessao} no parque ${parqueId} já está fechada.`);
                return null; // Não permitir mais transações
            }
            idSessaoCaixaAtual = sessao.id;
            return idSessaoCaixaAtual;
        } else {
            // Criar nova sessão
            const { data: novaSessao, error: erroCriacao } = await supabase
                .from('caixa_sessoes_diarias')
                .insert({
                    data_sessao: dataSessao,
                    parque_id: parqueId,
                    estado: 'Aberta',
                    user_abertura_id: currentUser?.id // Adicionar esta coluna se quiseres rastrear quem "abriu"
                })
                .select('id')
                .single();
            
            if (erroCriacao) {
                console.error("Erro ao criar nova sessão de caixa:", erroCriacao);
                return null;
            }
            idSessaoCaixaAtual = novaSessao.id;
            return idSessaoCaixaAtual;
        }
    }


    // --- Lógica de Comparação Odoo vs Sistema ---
    async function iniciarComparacaoOdooVsSistema() {
        const dataComparacao = fcComparacaoDataEl.value;
        if (!dataComparacao) {
            alert("Selecione uma data para a comparação.");
            return;
        }
        if (odooDataGlobal.length === 0) {
            alert("Carregue primeiro o ficheiro Odoo.");
            return;
        }
        mostrarSpinner('loadingComparacaoSpinner');
        fcComparacaoTableBodyEl.innerHTML = '';
        fcComparacaoNenhumaMsgEl.classList.add('hidden');
        fcResumoComparacaoEl.textContent = '';

        // 1. Buscar transações validadas do sistema (Supabase) para a data
        const inicioDia = dataComparacao + 'T00:00:00.000Z';
        const fimDia = dataComparacao + 'T23:59:59.999Z';

        const { data: transacoesSistema, error: erroSistema } = await supabase
            .from('caixa_transacoes_validadas')
            .select(`
                valor_corrigido_recebido, 
                metodo_pagamento_corrigido,
                reservas (matricula, alocation)
            `)
            .gte('data_validacao', inicioDia)
            .lte('data_validacao', fimDia)
            .eq('parque_id', userProfile?.parque_associado_id); // Filtrar por parque

        if (erroSistema) {
            console.error("Erro ao buscar transações do sistema:", erroSistema);
            fcResumoComparacaoEl.textContent = "Erro ao buscar dados do sistema.";
            esconderSpinner('loadingComparacaoSpinner');
            return;
        }
        
        // 2. Processar e comparar
        // O ficheiro Odoo pode ter uma estrutura diferente, precisa de mapeamento
        // Esta lógica é uma simplificação e depende MUITO da estrutura do teu ficheiro Odoo
        let totalSistema = 0;
        let totalOdoo = 0;
        let divergencias = 0;
        const resultadosComparacao = [];

        const sistemaMap = new Map();
        (transacoesSistema || []).forEach(ts => {
            if (ts.reservas) { // Verifica se a relação 'reservas' existe e não é nula
                 const chave = `${normalizarMatricula(ts.reservas.matricula)}-${ts.reservas.alocation}`;
                 if (!sistemaMap.has(chave)) sistemaMap.set(chave, { valor: 0, metodos: {} });
                 sistemaMap.get(chave).valor += parseFloat(ts.valor_corrigido_recebido || 0);
                 sistemaMap.get(chave).metodos[ts.metodo_pagamento_corrigido] = (sistemaMap.get(chave).metodos[ts.metodo_pagamento_corrigido] || 0) + 1;
                 totalSistema += parseFloat(ts.valor_corrigido_recebido || 0);
            } else {
                console.warn("Transação do sistema sem dados de reserva associados:", ts);
            }
        });
        
        // ASSUMINDO que o ficheiro Odoo tem colunas 'Matrícula', 'Alocation', 'Valor Pago'
        odooDataGlobal.forEach(rowOdoo => {
            const matriculaOdoo = normalizarMatricula(rowOdoo['Matrícula'] || rowOdoo['matricula']);
            const alocationOdoo = rowOdoo['Alocation'] || rowOdoo['alocation']; // Assumindo que existe
            const valorOdoo = parseFloat(rowOdoo['Valor Pago'] || rowOdoo['valor_pago'] || 0); // Ajustar nome da coluna
            totalOdoo += valorOdoo;

            if (!matriculaOdoo || !alocationOdoo) return; // Skip se não tiver identificador

            const chave = `${matriculaOdoo}-${alocationOdoo}`;
            const transacaoSistema = sistemaMap.get(chave);
            let estado = 'OK';
            let diferenca = 0;

            if (transacaoSistema) {
                diferenca = valorOdoo - transacaoSistema.valor;
                if (Math.abs(diferenca) > 0.01) { // Considerar pequena margem para floats
                    estado = 'Divergência Valor';
                    divergencias++;
                }
                sistemaMap.delete(chave); // Remover para encontrar os que estão só no sistema
            } else {
                estado = 'Apenas no Odoo';
                diferenca = valorOdoo;
                divergencias++;
            }
            resultadosComparacao.push({ matricula: matriculaOdoo, alocation: alocationOdoo, valorSistema: transacaoSistema ? transacaoSistema.valor : 0, valorOdoo, diferenca, estado });
        });

        // Adicionar os que sobraram no sistemaMap (Apenas no Sistema)
        sistemaMap.forEach((val, key) => {
            const [matricula, alocation] = key.split('-');
            resultadosComparacao.push({ matricula, alocation, valorSistema: val.valor, valorOdoo: 0, diferenca: -val.valor, estado: 'Apenas no Sistema' });
            divergencias++;
        });

        // Renderizar tabela de comparação
        if (resultadosComparacao.length === 0) {
            fcComparacaoNenhumaMsgEl.classList.remove('hidden');
        } else {
            resultadosComparacao.forEach(res => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${res.matricula}</td>
                    <td>${res.alocation}</td>
                    <td>${formatarMoeda(res.valorSistema)}</td>
                    <td>${formatarMoeda(res.valorOdoo)}</td>
                    <td class="${res.diferenca !== 0 ? 'text-red-600 font-semibold' : ''}">${formatarMoeda(res.diferenca)}</td>
                    <td class="${res.estado !== 'OK' ? 'text-yellow-600' : 'text-green-600'}">${res.estado}</td>
                `;
                fcComparacaoTableBodyEl.appendChild(tr);
            });
        }
        fcResumoComparacaoEl.textContent = `Total Sistema: ${formatarMoeda(totalSistema)} | Total Odoo: ${formatarMoeda(totalOdoo)} | Divergências Encontradas: ${divergencias}`;
        esconderSpinner('loadingComparacaoSpinner');
    }


    // --- Lógica do Dashboard de Caixa do Dia ---
    async function carregarDadosDashboardFechoCaixa() {
        const dataSessao = fcDashboardDataEl.value || new Date().toISOString().split('T')[0];
        const parqueId = userProfile?.parque_associado_id;

        if (!parqueId) {
            alert("Parque do utilizador não definido. Não é possível carregar dashboard.");
            return;
        }
        
        // Obter ID da sessão atual ou criar uma nova (se não existir para o dia)
        const sessaoId = await obterOuCriarSessaoCaixaDia();
        if (!sessaoId) {
             // Limpar stats se não houver sessão
            statTotalNumerarioEl.textContent = formatarMoeda(0);
            statTotalMultibancoEl.textContent = formatarMoeda(0);
            statTotalOutrosEl.textContent = formatarMoeda(0);
            statTotalGeralEl.textContent = formatarMoeda(0);
            statTransacoesCorrigidasEl.textContent = '0';
            statTotalTransacoesEl.textContent = '0';
            graficoMetodosPagamentoDia.data.datasets[0].data = [0,0,0];
            graficoMetodosPagamentoDia.update();
            return;
        }


        // TODO: Chamar RPC no Supabase para agregar dados de `caixa_transacoes_validadas`
        // para a `dataSessao` e `parqueId` (ou `sessaoId`)
        // Ex: supabase.rpc('get_dashboard_caixa_dia', { p_data_sessao: dataSessao, p_parque_id: parqueId })
        // Esta RPC deve retornar:
        // - total_numerario, total_multibanco, total_outros, total_geral
        // - count_transacoes_corrigidas, count_total_transacoes

        // Simulação:
        const { data: transacoes, error } = await supabase
            .from('caixa_transacoes_validadas')
            .select('valor_corrigido_recebido, metodo_pagamento_corrigido, foi_corrigido')
            .eq('caixa_sessao_diaria_id', sessaoId); // Filtrar pela sessão atual

        if (error) {
            console.error("Erro ao carregar transações para dashboard:", error);
            return;
        }

        let totalNum = 0, totalMb = 0, totalOutros = 0, totalGeral = 0;
        let corrigidas = 0;
        (transacoes || []).forEach(t => {
            const valor = parseFloat(t.valor_corrigido_recebido || 0);
            totalGeral += valor;
            if (t.metodo_pagamento_corrigido === 'Numerário') totalNum += valor;
            else if (t.metodo_pagamento_corrigido === 'Multibanco') totalMb += valor;
            else totalOutros += valor;
            if (t.foi_corrigido) corrigidas++;
        });

        statTotalNumerarioEl.textContent = formatarMoeda(totalNum);
        statTotalMultibancoEl.textContent = formatarMoeda(totalMb);
        statTotalOutrosEl.textContent = formatarMoeda(totalOutros);
        statTotalGeralEl.textContent = formatarMoeda(totalGeral);
        statTransacoesCorrigidasEl.textContent = corrigidas;
        statTotalTransacoesEl.textContent = (transacoes || []).length;

        // Atualizar gráfico
        graficoMetodosPagamentoDia.data.datasets[0].data = [totalNum, totalMb, totalOutros];
        graficoMetodosPagamentoDia.update();
    }

    // --- Lógica de Fecho de Caixa do Dia ---
    async function confirmarFechoDia() {
        const dataSessao = fcDashboardDataEl.value || new Date().toISOString().split('T')[0];
        const parqueId = userProfile?.parque_associado_id;

        if (!idSessaoCaixaAtual) { // Se a sessão não foi obtida/criada pelo dashboard
            alert("Não há uma sessão de caixa ativa para fechar para esta data/parque. Atualize o dashboard primeiro.");
            return;
        }
        
        if (!confirm(`Tem a certeza que deseja fechar a caixa do dia ${dataSessao} para o parque ${parqueId || 'N/A'}? Esta ação não pode ser desfeita facilmente.`)) {
            return;
        }

        mostrarSpinner('loadingFechoDiaSpinner');
        fechoDiaStatusEl.textContent = 'A processar fecho do dia...';
        fcConfirmarFechoDiaBtnEl.disabled = true;

        try {
            // 1. Obter os totais finais da sessão (poderia ser uma RPC que calcula e atualiza)
            // Por agora, vamos assumir que os valores do dashboard são os finais.
            const totalNumerario = parseFloat(statTotalNumerarioEl.textContent.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
            const totalMultibanco = parseFloat(statTotalMultibancoEl.textContent.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
            const totalOutros = parseFloat(statTotalOutrosEl.textContent.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
            const totalGeral = parseFloat(statTotalGeralEl.textContent.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;


            // 2. Atualizar o registo da sessão em `caixa_sessoes_diarias`
            const { error: erroFecho } = await supabase
                .from('caixa_sessoes_diarias')
                .update({
                    estado: 'Fechada',
                    data_hora_fecho: new Date().toISOString(),
                    user_fecho_id: currentUser?.id,
                    total_numerario_apurado: totalNumerario,
                    total_multibanco_apurado: totalMultibanco,
                    total_outros_apurado: totalOutros,
                    total_geral_apurado: totalGeral,
                    // observacoes_fecho: "Fechado pelo sistema." // Adicionar campo para notas se necessário
                })
                .eq('id', idSessaoCaixaAtual)
                .eq('estado', 'Aberta'); // Só fechar se estiver aberta

            if (erroFecho) throw erroFecho;

            // 3. Exportar o relatório (adaptar `exporter.js` para ler de `caixa_transacoes_validadas` para a `idSessaoCaixaAtual`)
            // Exemplo:
            // const dadosExport = await supabase.from('caixa_transacoes_validadas').select('*, reservas(*)').eq('caixa_sessao_diaria_id', idSessaoCaixaAtual);
            // window.exporter.exportSpecificData(dadosExport.data, `fecho_caixa_${dataSessao}.xlsx`); // Função a criar no exporter

            fechoDiaStatusEl.textContent = `Caixa do dia ${dataSessao} fechada com sucesso! O relatório será gerado (funcionalidade de exportação a implementar).`;
            fechoDiaStatusEl.className = 'mt-4 text-sm text-green-600';
            idSessaoCaixaAtual = null; // Resetar ID da sessão atual
            await carregarDadosDashboardFechoCaixa(); // Atualizar dashboard (deve mostrar sessão como fechada ou vazia)

        } catch (error) {
            console.error("Erro ao fechar caixa do dia:", error);
            fechoDiaStatusEl.textContent = `Erro ao fechar caixa: ${error.message}`;
            fechoDiaStatusEl.className = 'mt-4 text-sm text-red-600';
        } finally {
            esconderSpinner('loadingFechoDiaSpinner');
            fcConfirmarFechoDiaBtnEl.disabled = false;
        }
    }


    // --- Event Listeners ---
    if (voltarDashboardBtnFechoCaixaEl) {
        voltarDashboardBtnFechoCaixaEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    }
    if (fcProcessarBackOfficeBtnEl) fcProcessarBackOfficeBtnEl.addEventListener('click', processarImportacaoBackOffice);
    if (fcProcessarOdooBtnEl) fcProcessarOdooBtnEl.addEventListener('click', carregarFicheiroOdoo);
    if (fcCarregarEntregasCondutorBtnEl) fcCarregarEntregasCondutorBtnEl.addEventListener('click', carregarEntregasPendentesCondutor);
    if (fcEntregasCondutorTableBodyEl) fcEntregasCondutorTableBodyEl.addEventListener('click', handleValidarEntrega);
    
    fcFecharValidacaoModalBtns.forEach(btn => btn.addEventListener('click', () => fcValidacaoModalEl.classList.remove('active')));
    if(fcValidacaoFormEl) fcValidacaoFormEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const reservaId = fcValidacaoReservaIdEl.value;
        // Recriar um "pseudo-evento" para a função handleValidarEntrega
        const mockButton = document.createElement('button');
        mockButton.classList.add('fc-validar-entrega-btn'); // Para ser identificado pela função
        mockButton.dataset.reservaId = reservaId;
        
        // Anexar temporariamente ao formulário ou a um elemento pai visível para que closest('tr') funcione se necessário
        // ou refatorar handleValidarEntrega para não depender tanto da estrutura do DOM do botão.
        // Por simplicidade aqui, vamos assumir que a lógica no handleValidarEntrega pode ser adaptada
        // para pegar os valores diretamente dos inputs do modal, usando fcValidacaoReservaIdEl.
        
        // A forma mais direta é chamar uma função que processe os dados do modal:
        processarValidacaoModal(reservaId);
    });

    async function processarValidacaoModal(reservaId) {
        // Esta função é chamada pelo submit do modal
        const valorRecebido = parseFloat(fcModalValorRecebidoEl.value);
        const metodoPagamento = fcModalMetodoPagamentoEl.value;
        const justificativa = fcModalJustificativaEl.value.trim();

        if (isNaN(valorRecebido)) {
            alert("Valor recebido inválido.");
            return;
        }
        // ... (restante da lógica de handleValidarEntrega, mas usando os valores do modal) ...
        const entregaOriginal = entregasCondutorPendentes.find(e => e.id === reservaId); // Precisa ter acesso a entregasCondutorPendentes
        if (!entregaOriginal) {
            alert("Erro: Entrega original não encontrada para validação do modal.");
            return;
        }
        // ... (continua a lógica de validação e chamadas Supabase como em handleValidarEntrega) ...
        
        const foiCorrigido = parseFloat(entregaOriginal.valor_reserva || 0) !== valorRecebido || entregaOriginal.metodo_pagamento_previsto !== metodoPagamento;
        if (foiCorrigido && !justificativa) {
            if (!confirm("Houve uma alteração no valor ou método de pagamento. Deseja continuar sem justificativa?")) {
                return;
            }
        }

        const sessaoId = await obterOuCriarSessaoCaixaDia();
        if (!sessaoId) {
            alert("Erro ao obter sessão de caixa do dia. Tente novamente.");
            return;
        }

        const transacaoValidada = { /* ... como em handleValidarEntrega ... */ 
            reserva_id: reservaId,
            caixa_sessao_diaria_id: sessaoId,
            user_validador_id: currentUser?.id,
            condutor_id: fcCondutorSelectEl.value,
            data_validacao: new Date().toISOString(),
            valor_original_reserva: entregaOriginal.valor_reserva,
            valor_corrigido_recebido: valorRecebido,
            metodo_pagamento_original: entregaOriginal.metodo_pagamento_previsto,
            metodo_pagamento_corrigido: metodoPagamento,
            diferenca_valor: valorRecebido - parseFloat(entregaOriginal.valor_reserva || 0),
            justificativa_correcao: justificativa || null,
            foi_corrigido: foiCorrigido,
            parque_id: userProfile?.parque_associado_id || null
        };
        
        const { error: erroTransacao } = await supabase.from('caixa_transacoes_validadas').insert(transacaoValidada);
        if (erroTransacao) { /* ... tratar erro ... */ return; }

        const { error: erroUpdateReserva } = await supabase.from('reservas').update({ /* ... */ }).eq('id', reservaId);
        if (erroUpdateReserva) { /* ... tratar erro ... */ }
        
        await supabase.from('reservas_logs').insert({ /* ... */ });


        alert("Validação confirmada via modal!");
        fcValidacaoModalEl.classList.remove('active');
        await carregarEntregasPendentesCondutor(); // Recarregar lista do condutor
        if (fcDashboardDataEl.value) await carregarDadosDashboardFechoCaixa();
    }
    
    // Abrir modal a partir da tabela de entregas (substitui a edição inline)
    fcEntregasCondutorTableBodyEl.addEventListener('click', (event) => {
        const targetButton = event.target.closest('.fc-validar-entrega-btn');
        if (!targetButton) return;

        const reservaId = targetButton.dataset.reservaId;
        const entrega = entregasCondutorPendentes.find(e => e.id === reservaId);
        if (entrega) {
            fcValidacaoReservaIdEl.value = entrega.id;
            modalReservaIdDisplayEl.textContent = entrega.booking_id || entrega.id;
            modalMatriculaDisplayEl.textContent = entrega.matricula;
            modalValorPrevistoDisplayEl.textContent = formatarMoeda(entrega.valor_reserva);
            fcModalValorRecebidoEl.value = parseFloat(entrega.valor_reserva || 0).toFixed(2);
            fcModalMetodoPagamentoEl.value = entrega.metodo_pagamento_previsto || 'Numerário';
            fcModalJustificativaEl.value = '';
            fcValidacaoModalEl.classList.add('active');
        }
    });


    if (fcIniciarComparacaoBtnEl) fcIniciarComparacaoBtnEl.addEventListener('click', iniciarComparacaoOdooVsSistema);
    if (fcAtualizarDashboardBtnEl) fcAtualizarDashboardBtnEl.addEventListener('click', carregarDadosDashboardFechoCaixa);
    if (fcConfirmarFechoDiaBtnEl) fcConfirmarFechoDiaBtnEl.addEventListener('click', confirmarFechoDia);


    // --- Inicialização da Página ---
    async function initFechoCaixaPage() {
        if (!userProfile || !userProfile.parque_associado_id) {
            alert("Perfil do utilizador ou parque associado não definido. Contacte o administrador.");
            // Desabilitar funcionalidades críticas ou redirecionar
            fcProcessarBackOfficeBtnEl.disabled = true;
            fcCarregarEntregasCondutorBtnEl.disabled = true;
            // ... etc.
            return;
        }
        
        // Definir data padrão para os dashboards e comparação (hoje)
        const hojeISO = new Date().toISOString().split('T')[0];
        fcComparacaoDataEl.value = hojeISO;
        fcDashboardDataEl.value = hojeISO;


        await carregarCondutoresParaSelect();
        setupGraficosFechoCaixa();
        await carregarDadosDashboardFechoCaixa(); // Carrega dados para a data padrão (hoje)
        
        // Verificar se há permissão para fechar caixa (exemplo, baseado em 'role')
        if (userProfile.role !== 'admin_parque' && userProfile.role !== 'super_admin') { // Ajustar roles
            document.getElementById('fcSecaoFechoDia').classList.add('hidden');
        }

        console.log("Subaplicação de Fecho de Caixa inicializada.");
    }

    initFechoCaixaPage();
});

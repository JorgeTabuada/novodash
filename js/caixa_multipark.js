// js/fecho_caixa.js - Lógica para a Subaplicação de Fecho de Caixa

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Fecho de Caixa.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));
    const parqueAtualId = localStorage.getItem('parqueSelecionadoMultiparkId');

    // --- Seletores DOM ---
    const importBackOfficeFileEl = document.getElementById('importBackOfficeFile');
    const fcProcessarBackOfficeBtnEl = document.getElementById('fcProcessarBackOfficeBtn');
    const importBackOfficeStatusEl = document.getElementById('importBackOfficeStatus');
    const importOdooFileEl = document.getElementById('importOdooFile');
    const fcCarregarOdooBtnEl = document.getElementById('fcCarregarOdooBtn'); // Corrigido ID
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
    const fcValidacaoReservaIdPkEl = document.getElementById('fcValidacaoReservaIdPk');
    const modalReservaIdDisplayEl = document.getElementById('modalReservaIdDisplay');
    const modalMatriculaDisplayEl = document.getElementById('modalMatriculaDisplay');
    const modalValorPrevistoDisplayEl = document.getElementById('modalValorPrevistoDisplay');
    const fcModalValorRecebidoEl = document.getElementById('fcModalValorRecebido');
    const fcModalMetodoPagamentoEl = document.getElementById('fcModalMetodoPagamento');
    const fcModalJustificativaEl = document.getElementById('fcModalJustificativa');
    const fcFecharValidacaoModalBtns = document.querySelectorAll('.fcFecharValidacaoModalBtn');
    const fcValidacaoStatusEl = document.getElementById('fcValidacaoStatus');


    // --- Estado da Aplicação ---
    let odooDataGlobal = []; 
    let entregasCondutorPendentesGlobal = []; 
    let idSessaoCaixaAtual = null;

    // --- Configuração de Gráficos ---
    let graficoMetodosPagamentoDia;

    function setupGraficosFechoCaixa() {
        if (!chartMetodosPagamentoDiaEl) return;
        const ctxMetodos = chartMetodosPagamentoDiaEl.getContext('2d');
        if (graficoMetodosPagamentoDia) graficoMetodosPagamentoDia.destroy();
        graficoMetodosPagamentoDia = new Chart(ctxMetodos, {
            type: 'doughnut',
            data: { 
                labels: ['Numerário', 'Multibanco', 'Outros'], 
                datasets: [{ 
                    label: 'Distribuição por Método', 
                    data: [0,0,0], 
                    backgroundColor: ['#28a745', '#007bff', '#ffc107'], 
                    borderWidth: 1 
                }] 
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    // --- Funções Auxiliares ---
    function formatarMoeda(valor) { return parseFloat(valor || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }
    function mostrarSpinner(spinnerId, show = true) { document.getElementById(spinnerId)?.classList.toggle('hidden', !show); }
    function normalizarMatricula(matricula) { return String(matricula || '').replace(/[\s\-.]/g, '').toUpperCase(); }
    function formatarDataHora(dataISO, apenasData = false) {
        if (!dataISO) return 'N/A';
        try {
            const data = new Date(dataISO);
            if (isNaN(data.getTime())) return 'Data Inválida';
            const options = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Lisbon' };
            if (!apenasData) { options.hour = '2-digit'; options.minute = '2-digit';}
            return data.toLocaleString('pt-PT', options);
        } catch (e) { return dataISO; }
    }

    // --- Carregar Condutores para Select ---
    async function carregarCondutoresParaSelect() {
        const { data, error } = await supabase.from('profiles')
            .select('id, username, full_name')
            // .in('role', ['condutor_entrega', 'team_leader']) // Ajustar roles que fazem entregas/validações
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
        mostrarSpinner('loadingImportSpinnerFc', true);
        fcProcessarBackOfficeBtnEl.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, dateNF: 'dd/mm/yyyy hh:mm' });

                if (jsonData.length === 0) throw new Error('Ficheiro Back Office vazio.');
                
                const upserts = jsonData.map(row => {
                    const matriculaNorm = normalizarMatricula(row['Matrícula'] || row['license_plate']);
                    const alocationNorm = String(row['Alocation'] || row['alocation'] || '');
                    if (!matriculaNorm || !alocationNorm) return null;
                    
                    const parseExcelDate = (excelDateStr) => { /* ... (copiar de cancelamentos.js ou similar) ... */ return null;};

                    return {
                        license_plate: matriculaNorm,
                        alocation: alocationNorm,
                        booking_id: String(row['Booking ID'] || row['booking_id'] || ''),
                        // ... outros campos da tabela 'reservas' conforme o teu ficheiro ...
                        // Ex: name_cliente, check_in, check_out, booking_price, etc.
                        // Certifica-te que os nomes das colunas no Excel (row['Nome Coluna']) estão corretos.
                        estado_reserva_atual: String(row['Estado Reserva'] || 'Confirmada'), // Default para novas
                        parque_id: parqueAtualId && parqueAtualId !== 'todos' ? parqueAtualId : (userProfile?.parque_associado_id || null),
                    };
                }).filter(Boolean);

                if (upserts.length > 0) {
                    const { error } = await supabase.from('reservas').upsert(upserts, { onConflict: 'license_plate,alocation' });
                    if (error) throw error;
                    importBackOfficeStatusEl.textContent = `${upserts.length} registos processados/atualizados em Reservas.`;
                    importBackOfficeStatusEl.className = 'mt-2 text-xs text-green-600';
                } else {
                    importBackOfficeStatusEl.textContent = 'Nenhum registo válido encontrado no ficheiro.';
                }
            } catch (error) {
                console.error("Erro ao processar Back Office:", error);
                importBackOfficeStatusEl.textContent = `Erro: ${error.message}`;
                importBackOfficeStatusEl.className = 'mt-2 text-xs text-red-600';
            } finally {
                mostrarSpinner('loadingImportSpinnerFc', false);
                fcProcessarBackOfficeBtnEl.disabled = false;
                importBackOfficeFileEl.value = '';
            }
        };
        reader.readAsArrayBuffer(ficheiro);
    }

    async function carregarFicheiroOdoo() {
        const ficheiro = importOdooFileEl.files[0];
        if (!ficheiro) { /* ... tratamento de erro ... */ return; }
        importOdooStatusEl.textContent = 'A carregar Odoo...';
        mostrarSpinner('loadingImportSpinnerFc', true);
        fcCarregarOdooBtnEl.disabled = true; // Usar o ID correto do botão
        try {
            const data = new Uint8Array(await ficheiro.arrayBuffer());
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            odooDataGlobal = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
            if (odooDataGlobal.length === 0) throw new Error('Ficheiro Odoo vazio.');
            importOdooStatusEl.textContent = `${odooDataGlobal.length} registos carregados do Odoo.`;
            importOdooStatusEl.className = 'mt-2 text-xs text-green-600';
        } catch (error) { /* ... tratamento de erro ... */ odooDataGlobal = [];
        } finally {
            mostrarSpinner('loadingImportSpinnerFc', false);
            fcCarregarOdooBtnEl.disabled = false;
        }
    }

    // --- Validação de Entregas por Condutor ---
    async function carregarEntregasPendentesCondutor() {
        const condutorId = fcCondutorSelectEl.value;
        if (!condutorId) { alert("Selecione um condutor."); return; }
        mostrarSpinner('loadingEntregasSpinner', true);
        fcEntregasCondutorTableBodyEl.innerHTML = '';
        fcEntregasNenhumaMsgEl.classList.add('hidden');

        const { data, error } = await supabase
            .from('reservas')
            .select('id_pk, booking_id, license_plate, alocation, valor_reserva, metodo_pagamento_previsto, estado_reserva_atual, name_cliente, lastname_cliente')
            .eq('user_id_condutor_entrega', condutorId) // Assumindo que a entrega já foi atribuída
            .in('estado_reserva_atual', ['Em Curso']) // Reservas que estão com o cliente, prontas para pagamento/fecho
            .order('check_out', { ascending: true }); // Ordenar por data de saída prevista

        mostrarSpinner('loadingEntregasSpinner', false);
        if (error) { /* ... tratar erro ... */ return; }

        entregasCondutorPendentesGlobal = data || [];
        if (entregasCondutorPendentesGlobal.length === 0) {
            fcEntregasNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        entregasCondutorPendentesGlobal.forEach(entrega => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entrega.booking_id || entrega.id_pk.substring(0,8)}</td>
                <td>${entrega.license_plate}</td>
                <td>${entrega.alocation}</td>
                <td>${formatarMoeda(entrega.valor_reserva)}</td>
                <td>${entrega.metodo_pagamento_previsto || 'N/A'}</td>
                <td><button class="action-button success text-xs !p-1 fc-abrir-modal-validacao-btn" data-idpk="${entrega.id_pk}">Validar Pagamento</button></td>
            `;
            fcEntregasCondutorTableBodyEl.appendChild(tr);
        });
    }
    
    fcEntregasCondutorTableBodyEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('fc-abrir-modal-validacao-btn')) {
            const idPk = e.target.dataset.idpk;
            const entrega = entregasCondutorPendentesGlobal.find(ent => ent.id_pk === idPk);
            if (entrega) {
                fcValidacaoReservaIdPkEl.value = entrega.id_pk;
                modalReservaIdDisplayEl.textContent = entrega.booking_id || entrega.alocation;
                modalMatriculaDisplayEl.textContent = entrega.license_plate;
                modalValorPrevistoDisplayEl.textContent = formatarMoeda(entrega.valor_reserva);
                fcModalValorRecebidoEl.value = parseFloat(entrega.valor_reserva || 0).toFixed(2);
                fcModalMetodoPagamentoEl.value = entrega.metodo_pagamento_previsto || 'Numerário';
                fcModalJustificativaEl.value = '';
                fcValidacaoStatusEl.textContent = '';
                fcValidacaoModalEl.classList.add('active');
            }
        }
    });

    fcValidacaoFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const reservaIdPk = fcValidacaoReservaIdPkEl.value;
        const valorRecebido = parseFloat(fcModalValorRecebidoEl.value);
        const metodoPagamento = fcModalMetodoPagamentoEl.value;
        const justificativa = fcModalJustificativaEl.value.trim();
        const entregaOriginal = entregasCondutorPendentesGlobal.find(ent => ent.id_pk === reservaIdPk);

        if (!entregaOriginal) { alert("Erro: Reserva original não encontrada."); return; }
        if (isNaN(valorRecebido)) { alert("Valor recebido inválido."); return; }

        const foiCorrigido = Math.abs(parseFloat(entregaOriginal.valor_reserva || 0) - valorRecebido) > 0.01 || 
                             (entregaOriginal.metodo_pagamento_previsto || 'Numerário') !== metodoPagamento;
        if (foiCorrigido && !justificativa) {
            if (!confirm("Houve alteração no valor ou método. Continuar sem justificativa?")) return;
        }
        
        fcValidacaoStatusEl.textContent = "A validar...";
        const sessaoId = await obterOuCriarSessaoCaixaDia();
        if (!sessaoId) { fcValidacaoStatusEl.textContent = "Erro: Não foi possível obter sessão de caixa."; return; }

        const transacao = {
            reserva_id: reservaIdPk,
            caixa_sessao_diaria_id: sessaoId,
            profile_id_validador: userProfile?.id,
            profile_id_condutor: fcCondutorSelectEl.value, // Condutor que entregou/recebeu
            data_validacao: new Date().toISOString(),
            valor_original_reserva: entregaOriginal.valor_reserva,
            valor_corrigido_recebido: valorRecebido,
            metodo_pagamento_original: entregaOriginal.metodo_pagamento_previsto,
            metodo_pagamento_corrigido: metodoPagamento,
            justificativa_correcao: justificativa || null,
            foi_corrigido: foiCorrigido,
            parque_id: parqueAtualId && parqueAtualId !== 'todos' ? parqueAtualId : (userProfile?.parque_associado_id || null)
        };

        const { error: erroTransacao } = await supabase.from('caixa_transacoes_validadas').insert(transacao);
        if (erroTransacao) { /* ... tratar erro ... */ fcValidacaoStatusEl.textContent = `Erro: ${erroTransacao.message}`; return; }

        const { error: erroUpdateReserva } = await supabase.from('reservas').update({
            estado_reserva_atual: 'ValidadaFinanceiramente', // Ou 'Concluída' se este for o último passo
            preco_final_pago_real: valorRecebido,
            payment_method_final: metodoPagamento,
            checkout_date_real: new Date().toISOString(), // Marcar saída real no momento da validação
            user_id_last_modified: currentUser.id,
            updated_at_db: new Date().toISOString()
        }).eq('id_pk', reservaIdPk);
        
        if (erroUpdateReserva) { /* ... tratar erro ... */ }
        
        fcValidacaoStatusEl.textContent = "Validação registada com sucesso!";
        // TODO: Log
        setTimeout(() => {
            fcValidacaoModalEl.classList.remove('active');
            carregarEntregasPendentesCondutor(); // Recarregar lista
            carregarDadosDashboardFechoCaixa(); // Atualizar dashboard
        }, 1500);
    });


    // --- Sessão de Caixa Diária ---
    async function obterOuCriarSessaoCaixaDia() {
        if (idSessaoCaixaAtual) return idSessaoCaixaAtual;
        const dataSessao = fcDashboardDataEl.value || new Date().toISOString().split('T')[0];
        const parqueIdOperacao = parqueAtualId && parqueAtualId !== 'todos' ? parqueAtualId : userProfile?.parque_associado_id;

        if (!parqueIdOperacao) {
            console.error("Parque de operação não definido para sessão de caixa.");
            alert("Parque de operação não definido. Selecione um parque no dashboard principal.");
            return null;
        }

        let { data: sessao, error } = await supabase
            .from('caixa_sessoes_diarias')
            .select('id, estado')
            .eq('data_sessao', dataSessao)
            .eq('parque_id', parqueIdOperacao)
            .single();

        if (error && error.code !== 'PGRST116') { /* ... tratar erro ... */ return null; }
        if (sessao) {
            if (sessao.estado === 'Fechada') {
                alert(`Sessão de caixa para ${dataSessao} já está fechada.`);
                return null;
            }
            idSessaoCaixaAtual = sessao.id;
            return idSessaoCaixaAtual;
        } else {
            const { data: novaSessao, error: erroCriacao } = await supabase
                .from('caixa_sessoes_diarias')
                .insert({ data_sessao: dataSessao, parque_id: parqueIdOperacao, estado: 'Aberta', user_id_abertura: currentUser?.id })
                .select('id').single();
            if (erroCriacao) { /* ... tratar erro ... */ return null; }
            idSessaoCaixaAtual = novaSessao.id;
            return idSessaoCaixaAtual;
        }
    }

    // --- Comparação Odoo vs Sistema ---
    async function iniciarComparacaoOdooVsSistema() { /* ... (adaptar de confirmacao_caixa.js, usando 'caixa_transacoes_validadas') ... */ }

    // --- Dashboard de Caixa do Dia ---
    async function carregarDadosDashboardFechoCaixa() {
        const dataSessao = fcDashboardDataEl.value || new Date().toISOString().split('T')[0];
        const parqueIdOperacao = parqueAtualId && parqueAtualId !== 'todos' ? parqueAtualId : userProfile?.parque_associado_id;
        if (!parqueIdOperacao) { /* ... alert ... */ return; }

        idSessaoCaixaAtual = null; // Forçar a busca da sessão para a data do dashboard
        const sessaoId = await obterOuCriarSessaoCaixaDia(); // Obtém ou cria para a data do fcDashboardDataEl

        if (!sessaoId) {
            // Limpar stats se não houver sessão (ex: sessão fechada ou erro)
            [statTotalNumerarioEl, statTotalMultibancoEl, statTotalOutrosEl, statTotalGeralEl].forEach(el => el.textContent = formatarMoeda(0));
            [statTransacoesCorrigidasEl, statTotalTransacoesEl].forEach(el => el.textContent = '0');
            if (graficoMetodosPagamentoDia) {
                graficoMetodosPagamentoDia.data.datasets[0].data = [0,0,0];
                graficoMetodosPagamentoDia.update();
            }
            return;
        }
        
        // Buscar dados agregados da tabela 'caixa_transacoes_validadas' para a SESSÃO ATUAL
        const { data: transacoes, error } = await supabase
            .from('caixa_transacoes_validadas')
            .select('valor_corrigido_recebido, metodo_pagamento_corrigido, foi_corrigido')
            .eq('caixa_sessao_diaria_id', sessaoId); // Filtrar pela sessão do dia/parque

        if (error) { console.error("Erro ao carregar transações para dashboard:", error); return; }

        let totalNum = 0, totalMb = 0, totalOutrosPag = 0, totalGeral = 0, corrigidas = 0;
        (transacoes || []).forEach(t => {
            const valor = parseFloat(t.valor_corrigido_recebido || 0);
            totalGeral += valor;
            if (t.metodo_pagamento_corrigido === 'Numerário') totalNum += valor;
            else if (t.metodo_pagamento_corrigido === 'Multibanco') totalMb += valor;
            else totalOutrosPag += valor;
            if (t.foi_corrigido) corrigidas++;
        });

        statTotalNumerarioEl.textContent = formatarMoeda(totalNum);
        statTotalMultibancoEl.textContent = formatarMoeda(totalMb);
        statTotalOutrosEl.textContent = formatarMoeda(totalOutrosPag);
        statTotalGeralEl.textContent = formatarMoeda(totalGeral);
        statTransacoesCorrigidasEl.textContent = corrigidas;
        statTotalTransacoesEl.textContent = (transacoes || []).length;

        if (graficoMetodosPagamentoDia) {
            graficoMetodosPagamentoDia.data.datasets[0].data = [totalNum, totalMb, totalOutrosPag];
            graficoMetodosPagamentoDia.update();
        }
    }

    // --- Fecho de Caixa do Dia ---
    async function confirmarFechoDia() {
        const dataSessao = fcDashboardDataEl.value || new Date().toISOString().split('T')[0]; // Usar a data do dashboard
        const sessaoIdParaFechar = idSessaoCaixaAtual; // Usar o ID da sessão carregada pelo dashboard

        if (!sessaoIdParaFechar) {
            alert("Não há uma sessão de caixa ativa carregada no dashboard para fechar.");
            return;
        }
        if (!confirm(`Tem a certeza que deseja fechar a caixa para ${dataSessao}? Esta ação não pode ser desfeita facilmente.`)) return;

        mostrarSpinner('loadingFechoDiaSpinner', true);
        fechoDiaStatusEl.textContent = 'A processar fecho do dia...';
        fcConfirmarFechoDiaBtnEl.disabled = true;

        try {
            const totalNumerario = parseFloat(statTotalNumerarioEl.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            const totalMultibanco = parseFloat(statTotalMultibancoEl.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            const totalOutros = parseFloat(statTotalOutrosEl.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            
            const { error: erroFecho } = await supabase
                .from('caixa_sessoes_diarias')
                .update({
                    estado: 'Fechada',
                    data_hora_fecho: new Date().toISOString(),
                    user_id_fecho: currentUser?.id,
                    total_numerario_apurado: totalNumerario,
                    total_multibanco_apurado: totalMultibanco,
                    total_outros_pagamentos_apurado: totalOutros,
                    // total_geral_apurado é GENERATED
                })
                .eq('id', sessaoIdParaFechar)
                .eq('estado', 'Aberta');

            if (erroFecho) throw erroFecho;
            
            // TODO: Exportar relatório da sessão fechada
            // Ex: Chamar uma função que busca todas as transações da `sessaoIdParaFechar` e gera um Excel/PDF

            fechoDiaStatusEl.textContent = `Caixa para ${dataSessao} fechada com sucesso!`;
            fechoDiaStatusEl.className = 'mt-4 text-sm text-green-600';
            idSessaoCaixaAtual = null; // Resetar para forçar recarregamento da sessão se necessário
            await carregarDadosDashboardFechoCaixa(); // Atualizar dashboard
        } catch (error) { /* ... tratar erro ... */
        } finally {
            mostrarSpinner('loadingFechoDiaSpinner', false);
            fcConfirmarFechoDiaBtnEl.disabled = false;
        }
    }

    // --- Event Listeners ---
    if (voltarDashboardBtnFechoCaixaEl) voltarDashboardBtnFechoCaixaEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (fcProcessarBackOfficeBtnEl) fcProcessarBackOfficeBtnEl.addEventListener('click', processarImportacaoBackOffice);
    if (fcCarregarOdooBtnEl) fcCarregarOdooBtnEl.addEventListener('click', carregarFicheiroOdoo);
    if (fcCarregarEntregasCondutorBtnEl) fcCarregarEntregasCondutorBtnEl.addEventListener('click', carregarEntregasPendentesCondutor);
    // O listener para os botões de validar na tabela já está configurado
    fcFecharValidacaoModalBtns.forEach(btn => btn.addEventListener('click', () => fcValidacaoModalEl.classList.remove('active')));
    if (fcIniciarComparacaoBtnEl) fcIniciarComparacaoBtnEl.addEventListener('click', iniciarComparacaoOdooVsSistema);
    if (fcAtualizarDashboardBtnEl) fcAtualizarDashboardBtnEl.addEventListener('click', carregarDadosDashboardFechoCaixa);
    if (fcConfirmarFechoDiaBtnEl) fcConfirmarFechoDiaBtnEl.addEventListener('click', confirmarFechoDia);
    
    window.addEventListener('parkChanged', () => {
        idSessaoCaixaAtual = null; // Resetar sessão ao mudar de parque
        carregarDadosDashboardFechoCaixa();
        // Limpar lista de entregas pendentes do condutor, pois o parque mudou
        fcEntregasCondutorTableBodyEl.innerHTML = '';
        fcEntregasNenhumaMsgEl.textContent = "Selecione um condutor para ver as entregas do novo parque.";
        fcEntregasNenhumaMsgEl.classList.remove('hidden');
    });

    // --- Inicialização ---
    async function initFechoCaixaPage() {
        const parqueIdOperacao = parqueAtualId && parqueAtualId !== 'todos' ? parqueAtualId : userProfile?.parque_associado_id;
        if (!parqueIdOperacao && userProfile?.role !== 'super_admin' && userProfile?.role !== 'admin') {
            alert("Selecione um parque específico no dashboard principal para usar as funcionalidades de caixa.");
            // Desabilitar botões e funcionalidades
            [fcProcessarBackOfficeBtnEl, fcCarregarOdooBtnEl, fcCarregarEntregasCondutorBtnEl, fcIniciarComparacaoBtnEl, fcAtualizarDashboardBtnEl, fcConfirmarFechoDiaBtnEl].forEach(btn => { if(btn) btn.disabled = true; });
            return;
        }
        
        fcDashboardDataEl.value = new Date().toISOString().split('T')[0];
        fcComparacaoDataEl.value = new Date().toISOString().split('T')[0];

        await carregarCondutoresParaSelect();
        setupGraficosFechoCaixa();
        await carregarDadosDashboardFechoCaixa();
        
        if (userProfile?.role !== 'admin' && userProfile?.role !== 'super_admin' && userProfile?.role !== 'supervisor') { // Ajustar roles que podem fechar caixa
            document.getElementById('fcSecaoFechoDia').classList.add('hidden');
        }
        console.log("Subaplicação Fecho de Caixa inicializada.");
    }

    initFechoCaixaPage();
});

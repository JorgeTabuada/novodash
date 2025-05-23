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

    function parseAndFormatDateForSupabase(dateInput) {
        if (!dateInput) return null;
        if (dateInput instanceof Date) {
            return dateInput.toISOString();
        }
        if (typeof dateInput === 'string') {
            let parts;
            let date;
            // Try parsing dd/mm/yyyy hh:mm
            if (dateInput.includes(' ') && dateInput.includes(':') && dateInput.includes('/')) {
                const [datePart, timePart] = dateInput.split(' ');
                const [day, month, year] = datePart.split('/');
                const [hours, minutes] = timePart.split(':');
                if (day && month && year && hours && minutes) {
                    date = new Date(year, month - 1, day, hours, minutes);
                }
            } 
            // Try parsing dd/mm/yyyy
            else if (dateInput.includes('/')) {
                parts = dateInput.split('/');
                if (parts.length === 3) {
                    const [day, month, year] = parts;
                    date = new Date(year, month - 1, day);
                }
            }

            if (date && !isNaN(date.getTime())) {
                return date.toISOString();
            }
        }
        // Try parsing if it's an Excel serial date number
        if (typeof dateInput === 'number') {
            // XLSX.SSF.parse_date_code(dateInput) might be useful if workbook object is available here
            // For now, a simple conversion assuming it's days since 1900 (Windows Excel default)
            // This is a basic approximation and might need adjustment for Mac Excel dates or timezones
            const excelEpoch = new Date(1899, 11, 30); // Excel epoch starts Dec 30, 1899 for serial 1 to be Jan 1, 1900
            const jsDate = new Date(excelEpoch.getTime() + dateInput * 24 * 60 * 60 * 1000);
            if (!isNaN(jsDate.getTime())) {
                 // Adjust for timezone offset to keep the date as it was in Excel
                const timezoneOffsetMinutes = jsDate.getTimezoneOffset();
                jsDate.setMinutes(jsDate.getMinutes() - timezoneOffsetMinutes);
                return jsDate.toISOString();
            }
        }
        console.warn('Could not parse date:', dateInput);
        return null; // Return null if parsing fails
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

                if (jsonData.length === 0) throw new Error('Ficheiro Back Office vazio ou mal formatado.');
                
                const upserts = jsonData.map(row => {
                    const matriculaNorm = normalizarMatricula(row['Matrícula'] || row['license_plate']); // Maps from 'Matrícula' or 'license_plate'
                    const alocationNorm = String(row['Alocation'] || row['alocation'] || ''); // Maps from 'Alocation' or 'alocation'
                    if (!matriculaNorm || !alocationNorm) return null;
                    
                    // Exemplo de como usar para campos de data (substituir 'Excel Coluna CheckIn' etc. pelos nomes reais):
                    // const checkInDate = parseAndFormatDateForSupabase(row['Excel Coluna CheckIn']);
                    // const checkOutDate = parseAndFormatDateForSupabase(row['Excel Coluna CheckOut']);

                    return {
                        license_plate: matriculaNorm,
                        alocation: alocationNorm,
                        booking_id: String(row['Booking ID'] || row['booking_id'] || ''), // Maps from 'Booking ID' or 'booking_id' column in Excel
                        // ... outros campos da tabela 'reservas' conforme o teu ficheiro ...
                        // Ex: name_cliente: String(row['Nome Cliente'] || ''),
                        // Ex: check_in: checkInDate,
                        // Ex: check_out: checkOutDate,
                        // Example for numeric fields (replace with actual column names and uncomment):
                        // valor_reserva: parseFloat(String(row['Valor Reserva Excel'] || '0').replace(',', '.')),
                        // preco_booking: parseFloat(String(row['Preco Booking Excel'] || '0').replace(',', '.')),
                        // taxas_aeroporto: parseFloat(String(row['Taxas Aeroporto Excel'] || '0').replace(',', '.')),
                        // Certifica-te que os nomes das colunas no Excel (row['Nome Coluna']) estão corretos.
                        estado_reserva_atual: String(row['Estado Reserva'] || 'Confirmada'), // Default para novas, maps from 'Estado Reserva'
                        parque_id: parqueAtualId && parqueAtualId !== 'todos' ? parqueAtualId : (userProfile?.parque_associado_id || null),
                    };
                }).filter(Boolean);

                if (upserts.length > 0) {
                    const { error } = await supabase.from('reservas').upsert(upserts, { onConflict: 'license_plate,alocation' });
                    if (error) {
                        console.error('Supabase upsert error:', error);
                        throw new Error(`Erro ao gravar dados no Supabase: ${error.message}`);
                    }
                    importBackOfficeStatusEl.textContent = `${upserts.length} registos processados/atualizados em Reservas.`;
                    importBackOfficeStatusEl.className = 'mt-2 text-xs text-green-600';
                } else {
                    importBackOfficeStatusEl.textContent = 'Nenhum registo válido encontrado no ficheiro. Verifique os nomes das colunas e os dados.';
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
        if (!ficheiro) { 
            importOdooStatusEl.textContent = 'Selecione um ficheiro Odoo.';
            importOdooStatusEl.className = 'mt-2 text-xs text-red-600';
            return; 
        }
        importOdooStatusEl.textContent = 'A carregar Odoo...';
        mostrarSpinner('loadingImportSpinnerFc', true);
        fcCarregarOdooBtnEl.disabled = true; // Usar o ID correto do botão
        try {
            const data = new Uint8Array(await ficheiro.arrayBuffer());
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            odooDataGlobal = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
            if (odooDataGlobal.length === 0) throw new Error('Ficheiro Odoo vazio ou mal formatado.');
            importOdooStatusEl.textContent = `${odooDataGlobal.length} registos carregados do Odoo.`;
            importOdooStatusEl.className = 'mt-2 text-xs text-green-600';
        } catch (error) {
            console.error("Erro ao carregar ficheiro Odoo:", error);
            importOdooStatusEl.textContent = `Erro: ${error.message}`;
            importOdooStatusEl.className = 'mt-2 text-xs text-red-600';
            odooDataGlobal = [];
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
        
        if (isNaN(valorRecebido) || valorRecebido < 0) { 
            alert("Valor recebido inválido. Por favor, insira um número positivo."); 
            fcValidacaoStatusEl.textContent = "Erro: Valor recebido inválido."; 
            return; 
        }

        const metodoPagamento = fcModalMetodoPagamentoEl.value;
        const justificativa = fcModalJustificativaEl.value.trim();
        const entregaOriginal = entregasCondutorPendentesGlobal.find(ent => ent.id_pk === reservaIdPk);

        if (!entregaOriginal) { alert("Erro: Reserva original não encontrada."); return; }
        // A validação isNaN(valorRecebido) já foi feita acima.

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
    async function iniciarComparacaoOdooVsSistema() {
        // --- IMPORTANT: User Configuration for Odoo Column Names ---
        // The user MUST ensure these constants match the exact column names in their Odoo Excel export.
        const NOME_COLUNA_MATRICULA_ODOO = 'MatriculaOdoo'; // Example: Replace 'MatriculaOdoo' with the actual column name for License Plate in Odoo file
        const NOME_COLUNA_ALOCACAO_ODOO = 'AlocacaoOdoo';   // Example: Replace 'AlocacaoOdoo' with the actual column name for Allocation/Booking ID in Odoo file
        const NOME_COLUNA_VALOR_ODOO = 'ValorOdoo';         // Example: Replace 'ValorOdoo' with the actual column name for the monetary Value in Odoo file
        // --- End of User Configuration ---

        const dataComparacao = fcComparacaoDataEl.value;
        if (!dataComparacao) {
            alert("Selecione uma data para a comparação.");
            return;
        }

        const parqueIdOperacao = parqueAtualId && parqueAtualId !== 'todos' ? parqueAtualId : userProfile?.parque_associado_id;
        if (!parqueIdOperacao && userProfile?.role !== 'super_admin' && userProfile?.role !== 'admin') {
            alert("Selecione um parque específico no dashboard principal para realizar a comparação.");
            return;
        }

        if (!odooDataGlobal || odooDataGlobal.length === 0) {
            alert("Dados Odoo não carregados. Importe o ficheiro Odoo primeiro.");
            return;
        }

        mostrarSpinner('loadingComparacaoSpinnerEl', true);
        fcComparacaoTableBodyEl.innerHTML = '';
        fcResumoComparacaoEl.innerHTML = '';
        fcComparacaoNenhumaMsgEl.classList.add('hidden');
        fcResumoComparacaoEl.className = 'mt-4 text-sm p-3 bg-gray-50 rounded-md border'; // Reset class

        try {
            // Fetch validated reservations from Supabase for the selected date and park
            // IMPORTANT: Date filtering in Supabase.
            // The .eq('checkout_date_real', dataComparacao) assumes 'checkout_date_real' is a DATE type field.
            // If 'checkout_date_real' is a TIMESTAMP, this direct equality might not work as expected due to time components.
            // A more robust approach for TIMESTAMP fields would be to filter for a date range:
            // .gte('checkout_date_real', `${dataComparacao}T00:00:00.000Z`)
            // .lt('checkout_date_real', `${dataComparacao}T23:59:59.999Z`)
            // Or use a database function (RPC) to cast the timestamp to a date on the server side.
            // For this implementation, we proceed with direct equality, assuming 'checkout_date_real' or similar field is suitable.
            const { data: reservasValidadas, error: erroReservas } = await supabase
                .from('reservas')
                .select('license_plate, alocation, preco_final_pago_real, booking_id, id_pk')
                .eq('parque_id', parqueIdOperacao)
                .eq('checkout_date_real', dataComparacao) // This is the simplified date comparison. Review comment above.
                .eq('estado_reserva_atual', 'ValidadaFinanceiramente');

            if (erroReservas) {
                throw new Error(`Erro ao buscar dados do sistema: ${erroReservas.message}`);
            }

            const comparisonResults = [];
            const matchedOdooIndices = new Set();

            let totalSistema = 0, totalOdoo = 0, correspondidos = 0, comDiferenca = 0, apenasSistema = 0, apenasOdoo = 0;

            // Iterate through system data (Supabase reservations)
            (reservasValidadas || []).forEach(reserva => {
                totalSistema++;
                const systemMatricula = normalizarMatricula(reserva.license_plate);
                const systemAlocation = String(reserva.alocation || '').trim().toUpperCase();
                const systemValor = parseFloat(reserva.preco_final_pago_real || 0);
                let systemRecordMatched = false;

                for (let i = 0; i < odooDataGlobal.length; i++) {
                    const odooRow = odooDataGlobal[i];
                    const odooMatricula = normalizarMatricula(odooRow[NOME_COLUNA_MATRICULA_ODOO]);
                    const odooAlocation = String(odooRow[NOME_COLUNA_ALOCACAO_ODOO] || '').trim().toUpperCase();

                    if (systemMatricula === odooMatricula && systemAlocation === odooAlocation) {
                        const odooValueStr = odooRow[NOME_COLUNA_VALOR_ODOO];
                        const odooValor = odooValueStr ? parseFloat(String(odooValueStr).replace(',', '.')) : 0;
                        const diferenca = systemValor - odooValor;
                        const estado = Math.abs(diferenca) < 0.01 ? "Correspondido" : "Diferença";

                        if (estado === "Correspondido") correspondidos++;
                        else comDiferenca++;
                        
                        comparisonResults.push({
                            matricula: systemMatricula,
                            alocation: systemAlocation,
                            valorSistema: systemValor,
                            valorOdoo: odooValor,
                            diferenca: diferenca,
                            estado: estado
                        });
                        matchedOdooIndices.add(i);
                        systemRecordMatched = true;
                        break; 
                    }
                }

                if (!systemRecordMatched) {
                    apenasSistema++;
                    comparisonResults.push({
                        matricula: systemMatricula,
                        alocation: systemAlocation,
                        valorSistema: systemValor,
                        valorOdoo: 0, // Or null/N/A
                        diferenca: systemValor,
                        estado: "Sistema Apenas"
                    });
                }
            });

            // Iterate through Odoo data to find records not matched with system data
            for (let i = 0; i < odooDataGlobal.length; i++) {
                totalOdoo++; // This counts all Odoo records
                if (!matchedOdooIndices.has(i)) {
                    apenasOdoo++;
                    const odooRow = odooDataGlobal[i];
                    const odooValueStrOnly = odooRow[NOME_COLUNA_VALOR_ODOO];
                    const valorOdooCurrent = odooValueStrOnly ? parseFloat(String(odooValueStrOnly).replace(',', '.')) : 0;
                    comparisonResults.push({
                        matricula: normalizarMatricula(odooRow[NOME_COLUNA_MATRICULA_ODOO]),
                        alocation: String(odooRow[NOME_COLUNA_ALOCACAO_ODOO] || '').trim().toUpperCase(),
                        valorSistema: 0, // Or null/N/A
                        valorOdoo: valorOdooCurrent,
                        diferenca: -valorOdooCurrent,
                        estado: "Odoo Apenas"
                    });
                }
            }
             // Correct totalOdoo if it was not incremented in the loop above (e.g. odooDataGlobal was empty initially but populated later - though current logic loads it before)
            if (odooDataGlobal.length > 0 && totalOdoo === 0) totalOdoo = odooDataGlobal.length;


            if (comparisonResults.length === 0) {
                fcComparacaoNenhumaMsgEl.classList.remove('hidden');
            } else {
                comparisonResults.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.matricula || 'N/A'}</td>
                        <td>${item.alocation || 'N/A'}</td>
                        <td>${formatarMoeda(item.valorSistema)}</td>
                        <td>${formatarMoeda(item.valorOdoo)}</td>
                        <td class="${Math.abs(item.diferenca) >= 0.01 ? 'font-bold text-red-600' : ''}">${formatarMoeda(item.diferenca)}</td>
                        <td class="${item.estado === 'Diferença' ? 'text-red-600' : (item.estado === 'Sistema Apenas' || item.estado === 'Odoo Apenas' ? 'text-orange-600' : 'text-green-600')}">${item.estado}</td>
                    `;
                    fcComparacaoTableBodyEl.appendChild(tr);
                });
            }

            fcResumoComparacaoEl.innerHTML = `
                <strong>Resumo da Comparação para ${dataComparacao}:</strong><br>
                - Total Registos Sistema (Multipark): ${totalSistema}<br>
                - Total Registos Ficheiro Odoo: ${odooDataGlobal.length} <br> 
                - Correspondidos: <span class="text-green-600">${correspondidos}</span><br>
                - Com Diferença: <span class="text-red-600">${comDiferenca}</span><br>
                - Apenas no Sistema (Multipark): <span class="text-orange-600">${apenasSistema}</span><br>
                - Apenas no Ficheiro Odoo: <span class="text-orange-600">${apenasOdoo}</span>
            `;

        } catch (error) {
            console.error("Erro ao realizar comparação Odoo vs Sistema:", error);
            fcResumoComparacaoEl.textContent = 'Erro ao realizar comparação: ' + error.message;
            fcResumoComparacaoEl.className = 'mt-4 text-sm p-3 bg-red-100 rounded-md border text-red-700';
        } finally {
            mostrarSpinner('loadingComparacaoSpinnerEl', false);
        }
    }

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
        fechoDiaStatusEl.className = 'mt-4 text-sm'; // Reset class
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
            
            await exportarRelatorioSessao(sessaoIdParaFechar, dataSessao);

            // Check if exportarRelatorioSessao changed the class to red (error)
            if (!fechoDiaStatusEl.className.includes('text-red-600')) {
                fechoDiaStatusEl.textContent = `Caixa para ${dataSessao} fechada com sucesso! ${fechoDiaStatusEl.textContent.replace('A processar fecho do dia... Gerando relatório...', '')}`;
                fechoDiaStatusEl.className = 'mt-4 text-sm text-green-600';
            }
            
            idSessaoCaixaAtual = null; 
            await carregarDadosDashboardFechoCaixa(); 
        } catch (error) { 
            console.error("Erro ao fechar caixa:", error);
            fechoDiaStatusEl.textContent = `Erro ao fechar caixa: ${error.message}`;
            fechoDiaStatusEl.className = 'mt-4 text-sm text-red-600';
        } finally {
            mostrarSpinner('loadingFechoDiaSpinner', false);
            fcConfirmarFechoDiaBtnEl.disabled = false;
        }
    }

    // --- Função de Exportação de Relatório ---
    async function exportarRelatorioSessao(sessaoIdParaFechar, dataSessaoStr) {
        try {
            // Append to existing message if it's part of fechoDia, or set if called standalone
            if (fechoDiaStatusEl.textContent.includes('A processar fecho do dia...')) {
                 fechoDiaStatusEl.textContent += ' Gerando relatório...';
            } else {
                fechoDiaStatusEl.textContent = 'Gerando relatório...';
                fechoDiaStatusEl.className = 'mt-4 text-sm'; 
            }

            const { data: transacoesReport, error: erroTransacoes } = await supabase
                .from('caixa_transacoes_validadas')
                .select(`
                    *,
                    reservas (license_plate, alocation, booking_id, name_cliente, lastname_cliente),
                    profile_validador:profiles!caixa_transacoes_validadas_profile_id_validador_fkey (full_name, username),
                    profile_condutor:profiles!caixa_transacoes_validadas_profile_id_condutor_fkey (full_name, username)
                `)
                .eq('caixa_sessao_diaria_id', sessaoIdParaFechar);

            if (erroTransacoes) {
                console.error('Erro ao buscar transações para relatório:', erroTransacoes);
                fechoDiaStatusEl.textContent += ' (Erro ao gerar dados do relatório: ' + erroTransacoes.message + ')';
                fechoDiaStatusEl.className = 'mt-4 text-sm text-red-600';
                return; 
            }

            if (!transacoesReport || transacoesReport.length === 0) {
                fechoDiaStatusEl.textContent += ' (Nenhuma transação para exportar no relatório.)';
                // Ensure status message remains green if fecho was successful
                if (!fechoDiaStatusEl.className.includes('text-red-600') && fechoDiaStatusEl.textContent.startsWith('Caixa para')) {
                     fechoDiaStatusEl.className = 'mt-4 text-sm text-green-600';
                } else if (!fechoDiaStatusEl.className.includes('text-red-600')) {
                     fechoDiaStatusEl.className = 'mt-4 text-sm text-orange-600'; // Warning color
                }
                return;
            }

            const reportData = transacoesReport.map(t => ({
                'Data Validação': formatarDataHora(t.data_validacao),
                'Reserva ID (Sistema)': t.reserva_id,
                'Booking ID (Cliente)': t.reservas?.booking_id || 'N/A',
                'Matrícula': t.reservas?.license_plate || 'N/A',
                'Alocation': t.reservas?.alocation || 'N/A',
                'Cliente': `${t.reservas?.name_cliente || ''} ${t.reservas?.lastname_cliente || ''}`.trim(),
                'Valor Original (€)': t.valor_original_reserva,
                'Valor Recebido (€)': t.valor_corrigido_recebido,
                'Diferença (€)': (parseFloat(t.valor_corrigido_recebido || 0) - parseFloat(t.valor_original_reserva || 0)).toFixed(2),
                'Método Pag. Original': t.metodo_pagamento_original,
                'Método Pag. Corrigido': t.metodo_pagamento_corrigido,
                'Foi Corrigido?': t.foi_corrigido ? 'Sim' : 'Não',
                'Justificativa Correção': t.justificativa_correcao,
                'Validador': t.profile_validador?.full_name || t.profile_validador?.username || 'N/A',
                'Condutor': t.profile_condutor?.full_name || t.profile_condutor?.username || 'N/A',
                'ID Sessão Caixa': t.caixa_sessao_diaria_id
            }));

            const worksheet = XLSX.utils.json_to_sheet(reportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'RelatorioCaixa');
            
            const parqueInfo = parqueAtualId && parqueAtualId !== 'todos' ? `_Parque_${parqueAtualId}` : '_TodosParques';
            const filename = `Relatorio_Caixa_${dataSessaoStr.replace(/\//g, '-')}${parqueInfo}.xlsx`;
            
            XLSX.writeFile(workbook, filename);
            
            if (fechoDiaStatusEl.textContent.includes('Gerando relatório...')) { // Check if it's the primary message
                fechoDiaStatusEl.textContent = fechoDiaStatusEl.textContent.replace('Gerando relatório...', ''); // Clean up initial part
            }
            fechoDiaStatusEl.textContent += ' Relatório exportado com sucesso.';
            
            if (!fechoDiaStatusEl.className.includes('text-red-600')) {
                 fechoDiaStatusEl.className = 'mt-4 text-sm text-green-600';
            }

        } catch (exportError) {
            console.error('Erro durante a exportação do relatório:', exportError);
            fechoDiaStatusEl.textContent += ` (Erro crítico na exportação: ${exportError.message})`;
            fechoDiaStatusEl.className = 'mt-4 text-sm text-red-600';
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
        const fcGlobalNotificationEl = document.getElementById('fcGlobalNotification');

        if (!parqueIdOperacao && userProfile?.role !== 'super_admin' && userProfile?.role !== 'admin') {
            if (fcGlobalNotificationEl) {
                fcGlobalNotificationEl.textContent = "Nenhum parque de operação selecionado. Por favor, selecione um parque no dashboard principal para ativar as funcionalidades desta página.";
                fcGlobalNotificationEl.classList.add('text-red-700', 'p-4', 'bg-red-100', 'border', 'border-red-300', 'rounded-md');
            } else {
                alert("Nenhum parque de operação selecionado. Por favor, selecione um parque no dashboard principal para ativar as funcionalidades desta página.");
            }
            // Desabilitar botões e funcionalidades (ensure all relevant buttons are included)
            const buttonsToDisable = [
                fcProcessarBackOfficeBtnEl, fcCarregarOdooBtnEl, 
                fcCarregarEntregasCondutorBtnEl, fcIniciarComparacaoBtnEl, 
                fcAtualizarDashboardBtnEl, fcConfirmarFechoDiaBtnEl
            ];
            buttonsToDisable.forEach(btn => { if(btn) btn.disabled = true; });
            
            // Optionally, disable file inputs and select inputs as well
            if(importBackOfficeFileEl) importBackOfficeFileEl.disabled = true;
            if(importOdooFileEl) importOdooFileEl.disabled = true;
            if(fcCondutorSelectEl) fcCondutorSelectEl.disabled = true;
            if(fcComparacaoDataEl) fcComparacaoDataEl.disabled = true;
            if(fcDashboardDataEl) fcDashboardDataEl.disabled = true;

            return; // Stop further initialization of this page's features
        } else {
            if (fcGlobalNotificationEl) {
                fcGlobalNotificationEl.textContent = ""; // Clear message if park is selected
                fcGlobalNotificationEl.className = 'subapp-section mb-4'; // Reset classes
            }
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

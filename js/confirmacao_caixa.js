// js/confirmacao_caixa.js

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Confirmação de Caixa.");
        return;
    }
    checkAuthStatus(); // Should handle redirection if no user

    let currentUser = null;
    let userProfile = null;

    // Helper function to get parqueIdOperacao
    function getParqueIdOperacaoConfCaixa() {
        const parqueSelecionado = localStorage.getItem('parqueSelecionadoMultiparkId');
        return (parqueSelecionado && parqueSelecionado !== 'todos') ? parseInt(parqueSelecionado) : null;
    }

    function initializeConfirmacaoCaixa(user, profile) {
        if (document.body.classList.contains('conf-caixa-initialized')) return;
        document.body.classList.add('conf-caixa-initialized');

        currentUser = user; // Assign from parameter to module-scoped variable
        userProfile = profile; // Assign from parameter to module-scoped variable

        // --- Seletores DOM ---
        const importBackOfficeFileEl = document.getElementById('confImportBackOfficeFile');
        const processarBackOfficeBtnEl = document.getElementById('confProcessarBackOfficeBtn');
        const importBackOfficeStatusEl = document.getElementById('confImportBackOfficeStatus');
        const importOdooFileEl = document.getElementById('confImportOdooFile');
        const carregarOdooBtnEl = document.getElementById('confCarregarOdooBtn');
        const importOdooStatusEl = document.getElementById('confImportOdooStatus');
        const loadingImportSpinnerEl = document.getElementById('loadingConfImportSpinner');

        const dataComparacaoEl = document.getElementById('confDataComparacao');
        const iniciarComparacaoBtnEl = document.getElementById('confIniciarComparacaoBtn');
        const loadingComparacaoSpinnerEl = document.getElementById('loadingConfComparacaoSpinner');
        const resumoValidacaoEl = document.getElementById('confResumoValidacao');
        const inconsistenciasTableBodyEl = document.getElementById('confInconsistenciasTableBody');
        const inconsistenciasNenhumaMsgEl = document.getElementById('confInconsistenciasNenhumaMsg');
        const consistentesTableBodyEl = document.getElementById('confConsistentesTableBody');
        const consistentesNenhumaMsgEl = document.getElementById('confConsistentesNenhumaMsg');
        const validarTodosConsistentesBtnEl = document.getElementById('confValidarTodosConsistentesBtn');

        // Dashboard
        const dashboardFiltroDataInicioEl = document.getElementById('confDashboardFiltroDataInicio');
        const dashboardFiltroDataFimEl = document.getElementById('confDashboardFiltroDataFim');
        const aplicarFiltrosDashboardBtnEl = document.getElementById('confAplicarFiltrosDashboardBtn');
        const statTotalEntregasConfirmadasEl = document.getElementById('statTotalEntregasConfirmadas');
        const statValorTotalConfirmadoEl = document.getElementById('statValorTotalConfirmado');
        const statInconsistenciasResolvidasEl = document.getElementById('statInconsistenciasResolvidas');
        const statValorDivergenteJustificadoEl = document.getElementById('statValorDivergenteJustificado');
        const chartEntregasMarcaEl = document.getElementById('chartConfEntregasMarca');
        const chartPagamentosTipoEl = document.getElementById('chartConfPagamentosTipo');

        const exportarRelatorioBtnEl = document.getElementById('confExportarRelatorioBtn');
        const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnConfCaixa');

        // Modal Justificativa
        const justificativaModalEl = document.getElementById('confJustificativaModal');
        const justificativaFormEl = document.getElementById('confJustificativaForm');
        const justificativaReservaIdEl = document.getElementById('confJustificativaReservaId');
        const modalJustMatriculaEl = document.getElementById('modalJustMatricula');
        const modalJustAlocationEl = document.getElementById('modalJustAlocation');
        const modalJustDivergenciaEl = document.getElementById('modalJustDivergencia');
        const modalJustificativaTextoEl = document.getElementById('confModalJustificativaTexto');
        const fecharJustificativaModalBtns = document.querySelectorAll('.confFecharJustificativaModalBtn');

        // --- Estado da Aplicação ---
        let odooDataGlobalConf = [];
        let comparacaoResultados = []; // Array para guardar {reservaSistema, linhaOdoo, tipoDivergencia}

        // --- Configuração de Gráficos ---
        let graficoEntregasMarca, graficoPagamentosTipo;

        function setupGraficosConfCaixa() {
            if (chartEntregasMarcaEl) {
                const ctxMarca = chartEntregasMarcaEl.getContext('2d');
                if (graficoEntregasMarca) graficoEntregasMarca.destroy();
                graficoEntregasMarca = new Chart(ctxMarca, {
                    type: 'bar', data: { labels: [], datasets: [{ label: 'Nº Entregas', data: [], backgroundColor: 'rgba(75, 192, 192, 0.7)' }] },
                    options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
                });
            }
            if (chartPagamentosTipoEl) {
                const ctxPag = chartPagamentosTipoEl.getContext('2d');
                if (graficoPagamentosTipo) graficoPagamentosTipo.destroy();
                graficoPagamentosTipo = new Chart(ctxPag, {
                    type: 'pie', data: { labels: [], datasets: [{ data: [], backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'] }] },
                    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
                });
            }
        }
        
        // --- Funções Auxiliares ---
        function formatarMoeda(valor) { return parseFloat(valor || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }
        function mostrarSpinner(id) { document.getElementById(id)?.classList.remove('hidden'); }
        function esconderSpinner(id) { document.getElementById(id)?.classList.add('hidden'); }
        function normalizarMatricula(matricula) { return String(matricula || '').replace(/[\s\-\.]/g, '').toUpperCase(); }

        function parseAndFormatDateForSupabaseConfCaixa(dateInput) {
            if (!dateInput) return null;
            if (dateInput instanceof Date) {
                // Check if it's a valid date
                if (isNaN(dateInput.getTime())) return null;
                return dateInput.toISOString();
            }
            if (typeof dateInput === 'string') {
                let parts;
                let date;
                // Try parsing dd/mm/yyyy hh:mm or dd-mm-yyyy hh:mm
                if (dateInput.includes(' ') && dateInput.includes(':') && (dateInput.includes('/') || dateInput.includes('-'))) {
                    const [datePart, timePart] = dateInput.split(' ');
                    const separator = datePart.includes('/') ? '/' : '-';
                    const [day, month, year] = datePart.split(separator);
                    const [hours, minutes] = timePart.split(':');
                    if (day && month && year && hours && minutes) {
                        date = new Date(year, month - 1, day, hours, minutes);
                    }
                } 
                // Try parsing dd/mm/yyyy or dd-mm-yyyy
                else if (dateInput.includes('/') || dateInput.includes('-')) {
                    const separator = dateInput.includes('/') ? '/' : '-';
                    parts = dateInput.split(separator);
                    if (parts.length === 3) {
                        const [day, month, year] = parts;
                        // Basic validation for year length, can be improved
                        if (year && year.length === 4 && day && month) {
                             date = new Date(year, month - 1, day);
                        }
                    }
                }

                if (date && !isNaN(date.getTime())) {
                    return date.toISOString();
                }
            }
            // Try parsing if it's an Excel serial date number (if cellDates:true failed)
            if (typeof dateInput === 'number') {
                const excelEpoch = new Date(1899, 11, 30);
                const jsDate = new Date(excelEpoch.getTime() + dateInput * 24 * 60 * 60 * 1000);
                if (!isNaN(jsDate.getTime())) {
                    const timezoneOffsetMinutes = jsDate.getTimezoneOffset();
                    jsDate.setMinutes(jsDate.getMinutes() - timezoneOffsetMinutes);
                    return jsDate.toISOString();
                }
            }
            console.warn('Could not parse date (Conf Caixa):', dateInput);
            return null; 
        }


        // --- Processamento de Ficheiros ---
        async function processarBackOfficeConf() {
            // --- User-configurable Back Office Column Names ---
            const COL_BO_MATRICULA = 'Matrícula'; // Replace with actual name if different
            const COL_BO_ALOCATION = 'Alocation';  // Replace with actual name if different
            const COL_BO_DATA_SAIDA_REAL = 'Data Saída Real'; // Replace with actual name if different
            const COL_BO_CONDUTOR_ENTREGA = 'Condutor Entrega'; // Replace with actual name if different
            // Add more as needed, e.g., for preco_final_pago, metodo_pagamento_final if imported here
            // const COL_BO_PRECO_FINAL = 'Preço Final Pago';
            // --- End User-configurable ---

            const ficheiro = importBackOfficeFileEl.files[0];
            if (!ficheiro) {
                importBackOfficeStatusEl.textContent = 'Selecione ficheiro Back Office.';
                importBackOfficeStatusEl.className = 'mt-2 text-xs text-red-600';
                return;
            }
            importBackOfficeStatusEl.textContent = 'A processar Back Office...';
            mostrarSpinner('loadingConfImportSpinner');
            processarBackOfficeBtnEl.disabled = true;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const fileData = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(fileData, { type: 'array', cellDates: true }); // cellDates:true is important
                    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });

                    if (jsonData.length === 0) throw new Error('Ficheiro Back Office vazio.');
                    
                    let atualizacoesBemSucedidas = 0;

                    for (const row of jsonData) {
                        const matricula = normalizarMatricula(row[COL_BO_MATRICULA] || row['license_plate']);
                        const alocation = row[COL_BO_ALOCATION] || row['alocation'];
                        const dataSaidaRealRaw = row[COL_BO_DATA_SAIDA_REAL] || row['data_saida_real'];
                        const dataSaidaRealISO = parseAndFormatDateForSupabaseConfCaixa(dataSaidaRealRaw);
                        const condutorEntregaNome = row[COL_BO_CONDUTOR_ENTREGA] || row['condutor_entrega'];

                        if (!matricula || !alocation) {
                            console.warn("Linha BO ignorada (sem matrícula/alocation):", row);
                            continue;
                        }

                        let condutorEntregaId = null;
                        if (condutorEntregaNome) {
                            // Tentativa de encontrar ID do condutor pelo nome.
                            // ATENÇÃO: Esta abordagem pode ser imprecisa se os nomes não forem únicos ou tiverem variações.
                            // O ideal seria que o ficheiro Back Office fornecesse diretamente o ID do condutor.
                            const { data: condutor } = await supabase.from('profiles').select('id').or(`full_name.eq.${condutorEntregaNome},username.eq.${condutorEntregaNome}`).maybeSingle();
                            if (condutor) condutorEntregaId = condutor.id;
                            else console.warn(`Condutor de entrega "${condutorEntregaNome}" não encontrado.`);
                        }
                        
                        const dadosUpdate = {
                            estado_reserva: 'Entregue',
                            data_saida_real: dataSaidaRealISO || new Date().toISOString(), // Use parsed date or now as fallback
                            condutor_entrega_id: condutorEntregaId,
                            user_id_last_modified: currentUser?.id
                        };

                        const { data: updatedReserva, error } = await supabase
                            .from('reservas')
                            .update(dadosUpdate)
                            .eq('matricula', matricula)
                            .eq('alocation', alocation)
                            .select('id') 
                            .maybeSingle();

                        if (error) {
                            console.error(`Erro ao atualizar reserva ${matricula}-${alocation}:`, error);
                        } else if (updatedReserva) {
                            atualizacoesBemSucedidas++;
                             await supabase.from('reservas_logs').insert({
                                reserva_id: updatedReserva.id, user_id: currentUser?.id,
                                descricao_alteracao: `Reserva marcada como Entregue via importação BO (Conf. Caixa). Condutor: ${condutorEntregaNome || 'N/A'}`,
                                campo_alterado: 'estado_reserva;data_saida_real;condutor_entrega_id',
                                valor_novo: `Entregue;${dadosUpdate.data_saida_real};${condutorEntregaId || 'N/A'}`
                            });
                        }
                    }
                    importBackOfficeStatusEl.textContent = `${atualizacoesBemSucedidas} reservas atualizadas para "Entregue".`;
                    importBackOfficeStatusEl.className = 'mt-2 text-xs text-green-600';

                } catch (err) {
                    console.error("Erro detalhado ao processar ficheiro Back Office (Conf Caixa):", err);
                    let userMessage = `Erro ao processar ficheiro Back Office: ${err.message}`;
                    if (err.message.includes('sheet') || err.message.toLowerCase().includes('format')) { // More generic check
                        userMessage = "Erro ao ler a planilha do ficheiro Back Office. Verifique o formato e se as colunas esperadas existem.";
                    }
                    importBackOfficeStatusEl.textContent = userMessage;
                    importBackOfficeStatusEl.className = 'mt-2 text-xs text-red-600';
                } finally {
                    esconderSpinner('loadingConfImportSpinner');
                    processarBackOfficeBtnEl.disabled = false;
                }
            };
            reader.readAsArrayBuffer(ficheiro);
        }

        async function carregarOdooConf() {
            const ficheiro = importOdooFileEl.files[0];
            if (!ficheiro) {
                importOdooStatusEl.textContent = 'Selecione ficheiro Odoo.';
                importOdooStatusEl.className = 'mt-2 text-xs text-red-600';
                return;
            }
            importOdooStatusEl.textContent = 'A carregar Odoo...';
            mostrarSpinner('loadingConfImportSpinner');
            carregarOdooBtnEl.disabled = true;
            try {
                const fileData = new Uint8Array(await ficheiro.arrayBuffer());
                const workbook = XLSX.read(fileData, { type: 'array', cellDates: true }); // cellDates:true is important
                odooDataGlobalConf = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
                if (odooDataGlobalConf.length === 0) throw new Error('Ficheiro Odoo vazio.');
                importOdooStatusEl.textContent = `${odooDataGlobalConf.length} registos carregados do Odoo.`;
                importOdooStatusEl.className = 'mt-2 text-xs text-green-600';
            } catch (err) {
                console.error("Erro detalhado ao carregar ficheiro Odoo (Conf Caixa):", err);
                let userMessage = `Erro ao carregar ficheiro Odoo: ${err.message}`;
                if (err.message.includes('sheet') || err.message.toLowerCase().includes('format')) { // More generic check
                     userMessage = "Erro ao ler a planilha do ficheiro Odoo. Verifique o formato e se as colunas esperadas existem.";
                }
                importOdooStatusEl.textContent = userMessage;
                importOdooStatusEl.className = 'mt-2 text-xs text-red-600';
                odooDataGlobalConf = [];
            } finally {
                esconderSpinner('loadingConfImportSpinner');
                carregarOdooBtnEl.disabled = false;
            }
        }

        // --- Comparação e Validação ---
        async function iniciarComparacaoEValidacao() {
            // --- User-configurable Odoo Column Names (for comparison logic) ---
            const NOME_COLUNA_MATRICULA_ODOO = 'Matrícula'; // Example: Replace with actual name if different
            const NOME_COLUNA_ALOCACAO_ODOO = 'Alocation';  // Example: Replace with actual name if different
            const NOME_COLUNA_ESTADO_ODOO = 'Estado';       // Example: Replace with actual name if different
            const NOME_COLUNA_VALOR_ODOO = 'Total Pago';    // Example: Replace with actual name if different

            const dataFiltro = dataComparacaoEl.value;
            if (!dataFiltro) {
                alert("Por favor, selecione uma data para a comparação.");
                return;
            }
            if (odooDataGlobalConf.length === 0) {
                alert("Carregue o ficheiro Odoo primeiro.");
                return;
            }

            mostrarSpinner('loadingConfComparacaoSpinner');
            inconsistenciasTableBodyEl.innerHTML = '';
            consistentesTableBodyEl.innerHTML = '';
            inconsistenciasNenhumaMsgEl.classList.add('hidden');
            consistentesNenhumaMsgEl.classList.add('hidden');
            resumoValidacaoEl.textContent = 'A carregar dados do sistema e Odoo...';
            comparacaoResultados = []; // Reset for new comparison

            const parqueId = getParqueIdOperacaoConfCaixa();
            let queryReservas = supabase
                .from('reservas')
                .select('id, matricula, alocation, estado_reserva, valor_reserva, preco_final_pago, metodo_pagamento_final, marca_veiculo')
                .eq('data_saida_real', dataFiltro);

            if (parqueId) {
                queryReservas = queryReservas.eq('parque_id', parqueId);
            }
            
            const { data: systemData, error: errorSystemData } = await queryReservas;

            if (errorSystemData) {
                console.error("Erro ao carregar dados do sistema (reservas):", errorSystemData);
                alert(`Erro ao carregar dados do sistema: ${errorSystemData.message}`);
                resumoValidacaoEl.textContent = 'Erro ao carregar dados do sistema.';
                esconderSpinner('loadingConfComparacaoSpinner');
                return;
            }
            if (!systemData || systemData.length === 0) {
                console.log("Nenhuma reserva encontrada no sistema para a data selecionada.");
            }
            const localSystemData = systemData || []; 


            let consistentesCount = 0;
            let inconsistentesCount = 0;
            let valorTotalSistema = 0;
            let valorTotalOdoo = 0;

            for (const linhaOdoo of odooDataGlobalConf) {
                const matriculaOdoo = normalizarMatricula(linhaOdoo[NOME_COLUNA_MATRICULA_ODOO]);
                const alocationOdoo = linhaOdoo[NOME_COLUNA_ALOCACAO_ODOO]; 
                const estadoOdoo = String(linhaOdoo[NOME_COLUNA_ESTADO_ODOO] || '').toLowerCase();
                const valorOdoo = parseFloat(linhaOdoo[NOME_COLUNA_VALOR_ODOO] || 0);

                valorTotalOdoo += valorOdoo;

                const reservaSistema = localSystemData.find(
                    r => normalizarMatricula(r.matricula) === matriculaOdoo && r.alocation === alocationOdoo
                );

                let tipoDivergencia = [];
                let eConsistente = true;

                if (!reservaSistema) {
                    tipoDivergencia.push("Não encontrado no Sistema");
                    eConsistente = false;
                } else {
                    // Prioriza 'preco_final_pago' (se já preenchido, e.g., pelo Fecho de Caixa) como o valor mais atualizado do sistema.
                    // Caso contrário, usa 'valor_reserva' como base para comparação.
                    const valorSistemaParaComparar = parseFloat(reservaSistema.preco_final_pago || reservaSistema.valor_reserva || 0);
                    valorTotalSistema += valorSistemaParaComparar; 

                    const estadosSistemaAceitaveis = ['entregue', 'validadafinanceiramente', 'concluída'];
                    if (!estadosSistemaAceitaveis.includes(String(reservaSistema.estado_reserva || '').toLowerCase())) {
                        tipoDivergencia.push(`Estado (SIS: ${reservaSistema.estado_reserva} vs ODOO: ${estadoOdoo})`);
                        eConsistente = false;
                    }

                    if (Math.abs(valorSistemaParaComparar - valorOdoo) > 0.01) { // Tolerância para floats
                        tipoDivergencia.push(`Valor (SIS: ${formatarMoeda(valorSistemaParaComparar)} vs ODOO: ${formatarMoeda(valorOdoo)})`);
                        eConsistente = false;
                    }
                }
                
                const resultado = {
                    idSistema: reservaSistema ? reservaSistema.id : null,
                    matricula: matriculaOdoo,
                    alocation: alocationOdoo,
                    estadoSistema: reservaSistema ? reservaSistema.estado_reserva : 'N/A',
                    estadoOdoo: estadoOdoo,
                    valorSistema: reservaSistema ? parseFloat(reservaSistema.preco_final_pago || reservaSistema.valor_reserva || 0) : 0,
                    valorOdoo: valorOdoo,
                    divergencia: tipoDivergencia.join('; ') || 'OK',
                    consistente: eConsistente,
                    validado: false,
                    justificativa: ''
                };
                comparacaoResultados.push(resultado);

                if (eConsistente) consistentesCount++; else inconsistentesCount++;
            }
            
            renderTabelasComparacao();
            resumoValidacaoEl.textContent = `Comparação Concluída: ${consistentesCount} consistentes, ${inconsistentesCount} com inconsistências. Total Sistema (referência): ${formatarMoeda(valorTotalSistema)}, Total Odoo: ${formatarMoeda(valorTotalOdoo)}.`;
            esconderSpinner('loadingConfComparacaoSpinner');
        }

        function renderTabelasComparacao() {
            inconsistenciasTableBodyEl.innerHTML = '';
            consistentesTableBodyEl.innerHTML = '';
            let temInconsistencias = false;
            let temConsistentes = false;

            comparacaoResultados.forEach((res, index) => {
                if (!res.consistente) {
                    temInconsistencias = true;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${res.matricula}</td>
                        <td>${res.alocation}</td>
                        <td>${res.estadoSistema}</td>
                        <td>${res.estadoOdoo}</td>
                        <td>${formatarMoeda(res.valorSistema)}</td>
                        <td>${formatarMoeda(res.valorOdoo)}</td>
                        <td class="text-red-600">${res.divergencia}</td>
                        <td><button class="action-button warning text-xs !p-1 conf-justificar-btn" data-index="${index}">Validar com Justificativa</button></td>
                    `;
                    inconsistenciasTableBodyEl.appendChild(tr);
                } else {
                    temConsistentes = true;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><input type="checkbox" class="conf-validar-checkbox" data-index="${index}"></td>
                        <td>${res.matricula}</td>
                        <td>${res.alocation}</td>
                        <td>${res.estadoSistema}</td>
                        <td>${res.estadoOdoo}</td>
                        <td>${formatarMoeda(res.valorSistema)}</td>
                        <td><button class="action-button success text-xs !p-1 conf-validar-consistente-btn" data-index="${index}">Validar</button></td>
                    `;
                    consistentesTableBodyEl.appendChild(tr);
                }
            });
            if (!temInconsistencias) inconsistenciasNenhumaMsgEl.classList.remove('hidden');
            if (!temConsistentes) consistentesNenhumaMsgEl.classList.remove('hidden');
        }

        function abrirModalJustificativa(index) {
            const item = comparacaoResultados[index];
            if (!item) return;
            justificativaReservaIdEl.value = item.idSistema || `odoo_${item.matricula}_${item.alocation}`; // Identificador único
            modalJustMatriculaEl.textContent = item.matricula;
            modalJustAlocationEl.textContent = item.alocation;
            modalJustDivergenciaEl.textContent = item.divergencia;
            modalJustificativaTextoEl.value = item.justificativa || '';
            justificativaModalEl.classList.add('active');
            
            // Guardar o índice para o submit do form
            justificativaFormEl.dataset.currentIndex = index;
        }

        async function submeterJustificativa(event) {
            event.preventDefault();
            const index = parseInt(justificativaFormEl.dataset.currentIndex);
            const item = comparacaoResultados[index];
            const justificativaTexto = modalJustificativaTextoEl.value.trim();

            if (!justificativaTexto) {
                alert("A justificativa é obrigatória para validar uma inconsistência.");
                return;
            }
            item.justificativa = justificativaTexto;
            item.validado = true; 
            
            const parqueId = getParqueIdOperacaoConfCaixa(); 
            const dataToSave = {
                reserva_id_sistema: item.idSistema, 
                matricula_odoo: item.matricula,
                alocation_odoo: item.alocation,
                data_comparacao: dataComparacaoEl.value, 
                tipo_divergencia: item.divergencia,
                valor_sistema: item.valorSistema,
                valor_odoo: item.valorOdoo,
                estado_sistema: item.estadoSistema,
                estado_odoo: item.estadoOdoo,
                foi_consistente_inicialmente: false, 
                justificativa_validacao: justificativaTexto,
                user_id_validacao: currentUser?.id,
                data_validacao: new Date().toISOString(),
                parque_id: parqueId 
            };

            try {
                const { error: dbError } = await supabase
                    .from('confirmacao_caixa_validacoes')
                    .insert(dataToSave);

                if (dbError) {
                    console.error('Erro ao guardar justificação no Supabase:', dbError);
                    alert(`Erro ao guardar justificação: ${dbError.message}`);
                    item.validado = false; 
                    return; 
                }

                console.log("Item validado com justificativa e guardado:", item);
                justificativaModalEl.classList.remove('active');
                const btn = inconsistenciasTableBodyEl.querySelector(`button[data-index="${index}"]`);
                if(btn) {
                    btn.textContent = 'Validado';
                    btn.disabled = true;
                    btn.classList.remove('warning');
                    btn.classList.add('secondary');
                }
                await carregarDadosDashboardConfCaixa(); 
            } catch (e) {
                console.error('Exceção ao guardar justificação:', e);
                alert('Ocorreu uma exceção ao guardar a justificação.');
                item.validado = false; 
            }
        }

        async function validarConsistente(index, manual = true) {
            const item = comparacaoResultados[index];
            if (!item || item.validado) return;
            item.validado = true;
            item.justificativa = manual ? 'Validado como consistente pelo utilizador' : 'Validado automaticamente como consistente';

            const parqueId = getParqueIdOperacaoConfCaixa();
            const dataToSave = {
                reserva_id_sistema: item.idSistema,
                matricula_odoo: item.matricula,
                alocation_odoo: item.alocation,
                data_comparacao: dataComparacaoEl.value,
                tipo_divergencia: item.divergencia, 
                valor_sistema: item.valorSistema,
                valor_odoo: item.valorOdoo,
                estado_sistema: item.estadoSistema,
                estado_odoo: item.estadoOdoo,
                foi_consistente_inicialmente: true,
                justificativa_validacao: item.justificativa,
                user_id_validacao: currentUser?.id,
                data_validacao: new Date().toISOString(),
                parque_id: parqueId
            };

            try {
                const { error: dbError } = await supabase
                    .from('confirmacao_caixa_validacoes')
                    .insert(dataToSave);

                if (dbError) {
                    console.error('Erro ao guardar validação consistente no Supabase:', dbError);
                    alert(`Erro ao guardar validação: ${dbError.message}`);
                    item.validado = false; 
                    return;
                }
                console.log("Item consistente validado e guardado:", item);
                const btn = consistentesTableBodyEl.querySelector(`button[data-index="${index}"]`);
                if(btn) {
                    btn.textContent = 'Validado';
                    btn.disabled = true;
                    btn.classList.remove('success');
                    btn.classList.add('secondary');
                }
                const checkbox = consistentesTableBodyEl.querySelector(`input[data-index="${index}"]`);
                if(checkbox) { checkbox.disabled = true; checkbox.checked = false; } 
                await carregarDadosDashboardConfCaixa();
            } catch (e) {
                console.error('Exceção ao guardar validação consistente:', e);
                alert('Ocorreu uma exceção ao guardar a validação.');
                item.validado = false; 
            }
        }
        
        async function validarTodosConsistentesSelecionados() {
            // Assumindo que loadingConfComparacaoSpinnerEl é o spinner geral para a seção de comparação.
            if (loadingConfComparacaoSpinnerEl) mostrarSpinner('loadingConfComparacaoSpinner'); 
            validarTodosConsistentesBtnEl.disabled = true; // Disable button during operation
            
            try {
                const checkboxes = consistentesTableBodyEl.querySelectorAll('.conf-validar-checkbox:checked');
                if (checkboxes.length === 0) {
                    alert("Nenhum item consistente selecionado para validação.");
                    return;
                }
                if (!confirm(`Validar ${checkboxes.length} itens consistentes?`)) return;

                for (const cb of checkboxes) {
                    const index = parseInt(cb.dataset.index);
                    await validarConsistente(index, false); 
                }
                alert(`${checkboxes.length} itens consistentes validados.`);
            } finally {
                if (loadingConfComparacaoSpinnerEl) esconderSpinner('loadingConfComparacaoSpinner');
                validarTodosConsistentesBtnEl.disabled = false; // Re-enable button
            }
        }


        // --- Dashboard de Confirmação ---
        async function carregarDadosDashboardConfCaixa() {
            if (aplicarFiltrosDashboardBtnEl) aplicarFiltrosDashboardBtnEl.disabled = true;
            // Consider adding a specific dashboard spinner here if one exists
            // if (loadingDashboardStatsSpinnerEl) mostrarSpinner('loadingDashboardStatsSpinner');

            try {
                const dataInicio = dashboardFiltroDataInicioEl.value;
                const dataFim = dashboardFiltroDataFimEl.value;
                const parqueId = getParqueIdOperacaoConfCaixa();

                if (!dataInicio || !dataFim) {
                    alert("Por favor, selecione as datas de início e fim para o dashboard.");
                    return;
                }

                let query = supabase
                    .from('confirmacao_caixa_validacoes')
                    .select(`
                        *,
                        reservas:reserva_id_sistema(marca_veiculo, metodo_pagamento_final) 
                    `)
                    .gte('data_comparacao', dataInicio)
                    .lte('data_comparacao', dataFim);

                if (parqueId) {
                    query = query.eq('parque_id', parqueId);
                }
                
                const { data: validacoes, error: validacoesError } = await query;

                if (validacoesError) {
                    console.error("Erro ao carregar dados para dashboard:", validacoesError);
                    return;
                }

                let totalConfirmadas = 0;
                let valorConfirmado = 0;
                let inconsistenciasResolvidas = 0;
                let valorDivergenteJustificado = 0;
                const entregasPorMarca = {};
                const pagamentosPorTipo = {};

                if (validacoes) {
                    validacoes.forEach(v => {
                        totalConfirmadas++;
                        valorConfirmado += (v.valor_sistema || v.valor_odoo || 0);

                        if (!v.foi_consistente_inicialmente && v.justificativa_validacao) {
                            inconsistenciasResolvidas++;
                            valorDivergenteJustificado += Math.abs((v.valor_sistema || 0) - (v.valor_odoo || 0));
                        }

                        const marca = v.reservas?.marca_veiculo || 'Desconhecida';
                        entregasPorMarca[marca] = (entregasPorMarca[marca] || 0) + 1;
                        
                        const valorParaPagamento = v.valor_sistema || v.valor_odoo || 0; 
                        const tipoPag = v.reservas?.metodo_pagamento_final || 'N/A'; // Placeholder, ideally from 'v' itself if available
                        if (valorParaPagamento > 0) {
                           pagamentosPorTipo[tipoPag] = (pagamentosPorTipo[tipoPag] || 0) + valorParaPagamento;
                        }
                    });
                }

                statTotalEntregasConfirmadasEl.textContent = totalConfirmadas;
                statValorTotalConfirmadoEl.textContent = formatarMoeda(valorConfirmado);
                statInconsistenciasResolvidasEl.textContent = inconsistenciasResolvidas;
                statValorDivergenteJustificadoEl.textContent = formatarMoeda(valorDivergenteJustificado);

                if (graficoEntregasMarca) {
                    graficoEntregasMarca.data.labels = Object.keys(entregasPorMarca);
                    graficoEntregasMarca.data.datasets[0].data = Object.values(entregasPorMarca);
                    graficoEntregasMarca.update();
                }
                if (graficoPagamentosTipo) {
                    graficoPagamentosTipo.data.labels = Object.keys(pagamentosPorTipo);
                    graficoPagamentosTipo.data.datasets[0].data = Object.values(pagamentosPorTipo);
                    const defaultColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED', '#8A2BE2'];
                    graficoPagamentosTipo.data.datasets[0].backgroundColor = defaultColors.slice(0, Object.keys(pagamentosPorTipo).length);
                    graficoPagamentosTipo.update();
                }
            } finally {
                // if (loadingDashboardStatsSpinnerEl) esconderSpinner('loadingDashboardStatsSpinner');
                if (aplicarFiltrosDashboardBtnEl) aplicarFiltrosDashboardBtnEl.disabled = false;
            }
        }
        
        // --- Exportação ---
        function exportarRelatorioConfirmacao() {
            const dataExport = comparacaoResultados.map(res => ({
                Matricula: res.matricula,
                Alocation: res.alocation,
                "Estado Sistema": res.estadoSistema,
                "Estado Odoo": res.estadoOdoo,
                "Valor Sistema": res.valorSistema,
                "Valor Odoo": res.valorOdoo,
                Divergencia: res.divergencia,
                Validado: res.validado ? "Sim" : "Não",
                Justificativa: res.justificativa || ""
            }));
            if (dataExport.length === 0) {
                alert("Não há dados de confirmação para exportar.");
                return;
            }
            const worksheet = XLSX.utils.json_to_sheet(dataExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "ConfirmacaoCaixa");
            XLSX.writeFile(workbook, `relatorio_confirmacao_caixa_${new Date().toISOString().split('T')[0]}.xlsx`);
        }


        // --- Event Listeners ---
        if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
        if (processarBackOfficeBtnEl) processarBackOfficeBtnEl.addEventListener('click', processarBackOfficeConf);
        if (carregarOdooBtnEl) carregarOdooBtnEl.addEventListener('click', carregarOdooConf);
        if (iniciarComparacaoBtnEl) iniciarComparacaoBtnEl.addEventListener('click', iniciarComparacaoEValidacao);
        
        inconsistenciasTableBodyEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('conf-justificar-btn')) {
                abrirModalJustificativa(parseInt(e.target.dataset.index));
            }
        });
        consistentesTableBodyEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('conf-validar-consistente-btn')) {
                validarConsistente(parseInt(e.target.dataset.index));
            }
        });
        if(validarTodosConsistentesBtnEl) validarTodosConsistentesBtnEl.addEventListener('click', validarTodosConsistentesSelecionados);

        fecharJustificativaModalBtns.forEach(btn => btn.addEventListener('click', () => justificativaModalEl.classList.remove('active')));
        if (justificativaFormEl) justificativaFormEl.addEventListener('submit', submeterJustificativa);

        if (aplicarFiltrosDashboardBtnEl) aplicarFiltrosDashboardBtnEl.addEventListener('click', carregarDadosDashboardConfCaixa);
        if (exportarRelatorioBtnEl) exportarRelatorioBtnEl.addEventListener('click', exportarRelatorioConfirmacao);

        // --- Inicialização ---
        function initConfCaixaPage() {
            const parqueIdOperacao = getParqueIdOperacaoConfCaixa();
            const globalNotificationEl = document.getElementById('confCaixaGlobalNotification'); // Get the notification element

            if (!parqueIdOperacao && userProfile && userProfile.role !== 'super_admin' && userProfile.role !== 'admin') {
                if (globalNotificationEl) {
                    globalNotificationEl.innerHTML = `
                        <p class="text-red-700 font-semibold">Nenhum parque de operação selecionado.</p>
                        <p class="text-sm text-gray-600">Por favor, selecione um parque no dashboard principal para ativar as funcionalidades desta página.</p>
                        <p class="text-sm text-gray-600 mt-2">Algumas funcionalidades podem estar desabilitadas ou apresentar dados de todos os parques.</p>
                    `;
                    globalNotificationEl.className = 'subapp-section mb-4 p-4 bg-red-50 border border-red-200 rounded-md';
                } else {
                    alert("Nenhum parque de operação selecionado. Funcionalidades podem ser limitadas. Selecione um parque no dashboard principal.");
                }
                
                // Disable specific interactive elements
                const elementsToDisable = [
                    processarBackOfficeBtnEl, carregarOdooBtnEl, iniciarComparacaoBtnEl, 
                    validarTodosConsistentesBtnEl, exportarRelatorioBtnEl,
                    importBackOfficeFileEl, importOdooFileEl, dataComparacaoEl,
                    // dashboardFiltroDataInicioEl, dashboardFiltroDataFimEl, aplicarFiltrosDashboardBtnEl // Dashboard filters might still be useful for admins
                ];
                elementsToDisable.forEach(el => { if (el) el.disabled = true; });

                // Clear tables and show "no data" messages
                if(inconsistenciasTableBodyEl) inconsistenciasTableBodyEl.innerHTML = '';
                if(consistentesTableBodyEl) consistentesTableBodyEl.innerHTML = '';
                if(inconsistenciasNenhumaMsgEl) inconsistenciasNenhumaMsgEl.textContent = 'Selecione um parque para ver dados.';
                if(consistentesNenhumaMsgEl) consistentesNenhumaMsgEl.textContent = 'Selecione um parque para ver dados.';
                if(inconsistenciasNenhumaMsgEl) inconsistenciasNenhumaMsgEl.classList.remove('hidden');
                if(consistentesNenhumaMsgEl) consistentesNenhumaMsgEl.classList.remove('hidden');
                if(resumoValidacaoEl) resumoValidacaoEl.textContent = 'Selecione um parque para iniciar.';
            } else {
                 if (globalNotificationEl) {
                    globalNotificationEl.innerHTML = ""; // Clear message
                    globalNotificationEl.className = ''; // Reset classes, or set to a default non-visible state
                    globalNotificationEl.classList.add('hidden'); // Hide if not needed
                }
                 // Ensure elements are enabled if a park is selected or user is admin
                const elementsToEnable = [
                    processarBackOfficeBtnEl, carregarOdooBtnEl, iniciarComparacaoBtnEl, 
                    validarTodosConsistentesBtnEl, exportarRelatorioBtnEl,
                    importBackOfficeFileEl, importOdooFileEl, dataComparacaoEl,
                    // dashboardFiltroDataInicioEl, dashboardFiltroDataFimEl, aplicarFiltrosDashboardBtnEl
                ];
                elementsToEnable.forEach(el => { if (el) el.disabled = false; });
            }

            dataComparacaoEl.value = new Date().toISOString().split('T')[0];
            dashboardFiltroDataInicioEl.value = new Date(new Date().setDate(1)).toISOString().split('T')[0]; 
            dashboardFiltroDataFimEl.value = new Date().toISOString().split('T')[0]; 

            setupGraficosConfCaixa();
            carregarDadosDashboardConfCaixa(); 
            console.log("Subaplicação Confirmação de Caixa inicializada.");
        }

        initConfCaixaPage();
    } // End of initializeConfirmacaoCaixa

    async function handleAuth() {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('Error getting session:', error.message);
            return; 
        }

        if (session && session.user) {
            const localProfile = JSON.parse(localStorage.getItem('userProfile'));
            initializeConfirmacaoCaixa(session.user, localProfile);
        } else {
            document.body.classList.remove('conf-caixa-initialized'); 
        }
    }

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            if (session && session.user) {
                const localProfile = JSON.parse(localStorage.getItem('userProfile'));
                initializeConfirmacaoCaixa(session.user, localProfile);
            }
        } else if (event === 'SIGNED_OUT') {
            currentUser = null; 
            userProfile = null; 
            document.body.classList.remove('conf-caixa-initialized');
        }
    });

    handleAuth();
});

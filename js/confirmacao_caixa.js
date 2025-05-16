// js/confirmacao_caixa.js

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Confirmação de Caixa.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

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
    let backOfficeDataParaComparacao = []; // Dados do BO após processamento, para usar na comparação
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
                type: 'pie', data: { labels: [], datasets: [{ data: [], backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'] }] },
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });
        }
    }
    
    // --- Funções Auxiliares ---
    function formatarMoeda(valor) { /* ... (igual às outras subapps) ... */ return parseFloat(valor || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }
    function mostrarSpinner(id) { document.getElementById(id)?.classList.remove('hidden'); }
    function esconderSpinner(id) { document.getElementById(id)?.classList.add('hidden'); }
    function normalizarMatricula(matricula) { return String(matricula || '').replace(/[\s\-\.]/g, '').toUpperCase(); }


    // --- Processamento de Ficheiros ---
    async function processarBackOfficeConf() {
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
                const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });

                if (jsonData.length === 0) throw new Error('Ficheiro Back Office vazio.');
                
                backOfficeDataParaComparacao = []; // Resetar para nova importação
                let atualizacoesBemSucedidas = 0;

                for (const row of jsonData) {
                    // IMPORTANTE: Ajustar nomes das colunas do teu ficheiro Back Office
                    const matricula = normalizarMatricula(row['Matrícula'] || row['license_plate']);
                    const alocation = row['Alocation'] || row['alocation'];
                    const dataSaidaReal = row['Data Saída Real'] || row['data_saida_real'];
                    const condutorEntregaNome = row['Condutor Entrega'] || row['condutor_entrega']; // Nome ou ID
                    // Outros campos que este ficheiro possa trazer para atualizar a reserva:
                    // const precoFinalPagoBO = parseFloat(row['Preço Final Pago'] || 0);
                    // const metodoPagamentoFinalBO = row['Método Pagamento Final'];

                    if (!matricula || !alocation) {
                        console.warn("Linha BO ignorada (sem matrícula/alocation):", row);
                        continue;
                    }

                    let condutorEntregaId = null;
                    if (condutorEntregaNome) {
                        // Tentar encontrar ID do condutor (se o ficheiro trouxer nome em vez de ID)
                        // Esta lógica pode precisar de ser mais robusta
                        const { data: condutor } = await supabase.from('profiles').select('id').or(`full_name.eq.${condutorEntregaNome},username.eq.${condutorEntregaNome}`).maybeSingle();
                        if (condutor) condutorEntregaId = condutor.id;
                        else console.warn(`Condutor de entrega "${condutorEntregaNome}" não encontrado.`);
                    }
                    
                    const dadosUpdate = {
                        estado_reserva: 'Entregue', // Ou o estado que indica conclusão operacional
                        data_saida_real: dataSaidaReal ? new Date(dataSaidaReal).toISOString() : new Date().toISOString(),
                        condutor_entrega_id: condutorEntregaId,
                        // Se o ficheiro BO também tiver dados financeiros finais, podem ser atualizados aqui,
                        // mas o "Fecho de Caixa" já trata disso. É preciso definir qual a fonte da verdade.
                        // preco_final_pago: precoFinalPagoBO,
                        // metodo_pagamento_final: metodoPagamentoFinalBO,
                        user_id_last_modified: currentUser?.id
                    };

                    const { data: updatedReserva, error } = await supabase
                        .from('reservas')
                        .update(dadosUpdate)
                        .eq('matricula', matricula)
                        .eq('alocation', alocation)
                        // .neq('estado_reserva', 'Cancelada') // Não atualizar se já estiver cancelada
                        .select('id, matricula, alocation, estado_reserva, valor_reserva, preco_final_pago, metodo_pagamento_final') // Selecionar campos para comparação
                        .maybeSingle();

                    if (error) {
                        console.error(`Erro ao atualizar reserva ${matricula}-${alocation}:`, error);
                    } else if (updatedReserva) {
                        atualizacoesBemSucedidas++;
                        backOfficeDataParaComparacao.push(updatedReserva); // Guardar para comparar com Odoo
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
                console.error("Erro ao processar ficheiro Back Office:", err);
                importBackOfficeStatusEl.textContent = `Erro: ${err.message}`;
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
            const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
            odooDataGlobalConf = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
            if (odooDataGlobalConf.length === 0) throw new Error('Ficheiro Odoo vazio.');
            importOdooStatusEl.textContent = `${odooDataGlobalConf.length} registos carregados do Odoo.`;
            importOdooStatusEl.className = 'mt-2 text-xs text-green-600';
        } catch (err) {
            console.error("Erro ao carregar ficheiro Odoo:", err);
            importOdooStatusEl.textContent = `Erro: ${err.message}`;
            importOdooStatusEl.className = 'mt-2 text-xs text-red-600';
            odooDataGlobalConf = [];
        } finally {
            esconderSpinner('loadingConfImportSpinner');
            carregarOdooBtnEl.disabled = false;
        }
    }

    // --- Comparação e Validação ---
    async function iniciarComparacaoEValidacao() {
        const dataFiltro = dataComparacaoEl.value;
        if (!dataFiltro) {
            alert("Por favor, selecione uma data para a comparação.");
            return;
        }
        if (odooDataGlobalConf.length === 0) {
            alert("Carregue o ficheiro Odoo primeiro.");
            return;
        }
        // O backOfficeDataParaComparacao já deve ter sido populado pelo processarBackOfficeConf()
        // Se não foi, ou se a lógica for carregar dados do Supabase para a data, ajustar aqui.
        // Por agora, assume-se que o processarBackOfficeConf() é o passo anterior.
        if(backOfficeDataParaComparacao.length === 0){
            alert("Processe o ficheiro Back Office primeiro ou não há dados do sistema para a data.");
            // Poderia tentar carregar do Supabase aqui se a lógica fosse diferente
            // const {data, error} = await supabase.from('reservas').select('*').eq('data_saida_real', dataFiltro)...
            // backOfficeDataParaComparacao = data;
            // if(error || !data) { /*tratar erro*/ return; }
        }


        mostrarSpinner('loadingConfComparacaoSpinner');
        inconsistenciasTableBodyEl.innerHTML = '';
        consistentesTableBodyEl.innerHTML = '';
        inconsistenciasNenhumaMsgEl.classList.add('hidden');
        consistentesNenhumaMsgEl.classList.add('hidden');
        resumoValidacaoEl.textContent = 'A comparar...';
        comparacaoResultados = [];

        let consistentesCount = 0;
        let inconsistentesCount = 0;
        let valorTotalSistema = 0;
        let valorTotalOdoo = 0;

        for (const linhaOdoo of odooDataGlobalConf) {
            // Ajustar nomes das colunas do Odoo
            const matriculaOdoo = normalizarMatricula(linhaOdoo['Matrícula'] || linhaOdoo['Imma']);
            const alocationOdoo = linhaOdoo['Alocation'] || linhaOdoo['Nº Reserva']; // Ou outra chave de alocação do Odoo
            const estadoOdoo = String(linhaOdoo['Estado'] || '').toLowerCase(); // Ex: "concluído", "faturado"
            const valorOdoo = parseFloat(linhaOdoo['Total Pago'] || linhaOdoo['Valor'] || 0);

            valorTotalOdoo += valorOdoo;

            // Encontrar correspondente nos dados do sistema (que vieram do Back Office ou Supabase)
            const reservaSistema = backOfficeDataParaComparacao.find(
                r => normalizarMatricula(r.matricula) === matriculaOdoo && r.alocation === alocationOdoo
            );

            let tipoDivergencia = [];
            let eConsistente = true;

            if (!reservaSistema) {
                tipoDivergencia.push("Não encontrado no Sistema");
                eConsistente = false;
            } else {
                valorTotalSistema += parseFloat(reservaSistema.preco_final_pago || reservaSistema.valor_reserva || 0); // Usar preco_final_pago se disponível

                // Comparação de Estado
                // Assumir que "concluído" ou "faturado" no Odoo deve corresponder a "Entregue" ou "ValidadaFinanceiramente" no sistema
                const estadosSistemaAceitaveis = ['entregue', 'validadafinanceiramente', 'concluída'];
                if (!estadosSistemaAceitaveis.includes(String(reservaSistema.estado_reserva || '').toLowerCase())) {
                    tipoDivergencia.push(`Estado (SIS: ${reservaSistema.estado_reserva} vs ODOO: ${estadoOdoo})`);
                    eConsistente = false;
                }

                // Comparação de Valor (usar preco_final_pago se o Fecho de Caixa já ocorreu e atualizou)
                const valorSistemaParaComparar = parseFloat(reservaSistema.preco_final_pago || reservaSistema.valor_reserva || 0);
                if (Math.abs(valorSistemaParaComparar - valorOdoo) > 0.01) { // Tolerância para floats
                    tipoDivergencia.push(`Valor (SIS: ${formatarMoeda(valorSistemaParaComparar)} vs ODOO: ${formatarMoeda(valorOdoo)})`);
                    eConsistente = false;
                }
            }
            
            const resultado = {
                idSistema: reservaSistema ? reservaSistema.id : null, // ID da reserva no Supabase
                matricula: matriculaOdoo,
                alocation: alocationOdoo,
                estadoSistema: reservaSistema ? reservaSistema.estado_reserva : 'N/A',
                estadoOdoo: estadoOdoo,
                valorSistema: reservaSistema ? parseFloat(reservaSistema.preco_final_pago || reservaSistema.valor_reserva || 0) : 0,
                valorOdoo: valorOdoo,
                divergencia: tipoDivergencia.join('; ') || 'OK',
                consistente: eConsistente,
                validado: false, // Para marcar se o user já validou
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
        
        // TODO: Guardar no Supabase (tabela `confirmacao_caixa_resultados` ou similar)
        // Ex: await supabase.from('confirmacao_caixa_resultados').insert({ ...item, user_id_validacao: currentUser.id ... });
        console.log("Item validado com justificativa:", item);
        
        justificativaModalEl.classList.remove('active');
        renderTabelasComparacao(); // Re-render para refletir mudança (ex: mudar botão para "Validado")
        // Poderia remover da lista de inconsistências ou mudar o estilo da linha.
        const btn = inconsistenciasTableBodyEl.querySelector(`button[data-index="${index}"]`);
        if(btn) {
            btn.textContent = 'Validado';
            btn.disabled = true;
            btn.classList.remove('warning');
            btn.classList.add('secondary');
        }
        await carregarDadosDashboardConfCaixa(); // Atualizar dashboard
    }

    async function validarConsistente(index, manual = true) {
        const item = comparacaoResultados[index];
        if (!item || item.validado) return;
        item.validado = true;
        item.justificativa = manual ? 'Validado como consistente pelo utilizador' : 'Validado automaticamente como consistente';

        // TODO: Guardar no Supabase
        console.log("Item consistente validado:", item);
        
        const btn = consistentesTableBodyEl.querySelector(`button[data-index="${index}"]`);
        if(btn) {
            btn.textContent = 'Validado';
            btn.disabled = true;
            btn.classList.remove('success');
            btn.classList.add('secondary');
        }
        const checkbox = consistentesTableBodyEl.querySelector(`input[data-index="${index}"]`);
        if(checkbox) checkbox.disabled = true;

        await carregarDadosDashboardConfCaixa();
    }
    
    async function validarTodosConsistentesSelecionados() {
        const checkboxes = consistentesTableBodyEl.querySelectorAll('.conf-validar-checkbox:checked');
        if (checkboxes.length === 0) {
            alert("Nenhum item consistente selecionado para validação.");
            return;
        }
        if (!confirm(`Validar ${checkboxes.length} itens consistentes?`)) return;

        for (const cb of checkboxes) {
            const index = parseInt(cb.dataset.index);
            await validarConsistente(index, false); // Validar sem abrir modal, com justificativa padrão
        }
        alert(`${checkboxes.length} itens consistentes validados.`);
        // A tabela já é atualizada dentro de validarConsistente
    }


    // --- Dashboard de Confirmação ---
    async function carregarDadosDashboardConfCaixa() {
        const dataInicio = dashboardFiltroDataInicioEl.value;
        const dataFim = dashboardFiltroDataFimEl.value;
        // TODO: Usar datas para filtrar queries ao Supabase
        
        // Contar com base nos `comparacaoResultados` que foram marcados como `validado`
        let totalConfirmadas = 0;
        let valorConfirmado = 0;
        let inconsistenciasResolvidas = 0;
        let valorDivergenteJustificado = 0;
        const entregasPorMarca = {};
        const pagamentosPorTipo = {};


        comparacaoResultados.filter(r => r.validado).forEach(res => {
            totalConfirmadas++;
            valorConfirmado += res.valorSistema; // Ou valorOdoo se essa for a fonte da verdade após validação
            if (!res.consistente && res.justificativa) { // Se era inconsistente mas foi justificado
                inconsistenciasResolvidas++;
                valorDivergenteJustificado += Math.abs(res.valorSistema - res.valorOdoo);
            }
            // Para gráficos, precisaríamos de dados da reserva original (marca, tipo pagamento)
            // Isto exigiria que `res` contivesse mais detalhes ou fizéssemos outra query.
            // Exemplo simplificado:
            // const marca = res.detalhesReserva?.marca_veiculo || 'Desconhecida';
            // entregasPorMarca[marca] = (entregasPorMarca[marca] || 0) + 1;
            // const tipoPag = res.detalhesReserva?.metodo_pagamento_final || 'N/A';
            // pagamentosPorTipo[tipoPag] = (pagamentosPorTipo[tipoPag] || 0) + res.valorSistema;
        });

        statTotalEntregasConfirmadasEl.textContent = totalConfirmadas;
        statValorTotalConfirmadoEl.textContent = formatarMoeda(valorConfirmado);
        statInconsistenciasResolvidasEl.textContent = inconsistenciasResolvidas;
        statValorDivergenteJustificadoEl.textContent = formatarMoeda(valorDivergenteJustificado);

        // Atualizar gráficos (simulado por agora)
        if (graficoEntregasMarca) {
            graficoEntregasMarca.data.labels = ['Marca A', 'Marca B'];
            graficoEntregasMarca.data.datasets[0].data = [Math.floor(Math.random()*50), Math.floor(Math.random()*30)];
            graficoEntregasMarca.update();
        }
        if (graficoPagamentosTipo) {
            graficoPagamentosTipo.data.labels = ['Numerário', 'Multibanco'];
            graficoPagamentosTipo.data.datasets[0].data = [Math.random()*1000, Math.random()*800];
            graficoPagamentosTipo.update();
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
        // Definir data padrão para comparação
        dataComparacaoEl.value = new Date().toISOString().split('T')[0];
        dashboardFiltroDataInicioEl.value = new Date(new Date().setDate(1)).toISOString().split('T')[0]; // Início do mês atual
        dashboardFiltroDataFimEl.value = new Date().toISOString().split('T')[0]; // Hoje

        setupGraficosConfCaixa();
        carregarDadosDashboardConfCaixa(); // Carregar com defaults
        console.log("Subaplicação Confirmação de Caixa inicializada.");
    }

    initConfCaixaPage();
});

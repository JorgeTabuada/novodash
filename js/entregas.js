// js/entregas_multipark.js - Lógica para a Subaplicação de Gestão de Entregas

document.addEventListener("DOMContentLoaded", async () => {
    // --- Verificação e Inicialização do Cliente Supabase ---
    if (typeof window.getSupabaseClient !== 'function') {
        console.error("ERRO CRÍTICO (entregas.js): getSupabaseClient não está definido.");
        alert("Erro crítico na configuração da aplicação (Entregas). Contacte o suporte.");
        return;
    }
    const supabase = window.getSupabaseClient();
    if (!supabase) {
        console.error("ERRO CRÍTICO (entregas.js): Cliente Supabase não disponível.");
        alert("Erro crítico ao conectar com o sistema (Entregas). Contacte o suporte.");
        return;
    }
    if (typeof flatpickr !== "undefined") {
        flatpickr.localize(flatpickr.l10ns.pt);
    } else {
        console.warn("Flatpickr não carregado (Entregas).");
    }

    let currentUser = null;
    let userProfile = null;
    let listaCondutoresCache = []; // Cache para a lista de condutores

    // --- Seletores de Elementos DOM ---
    const importEntregasFileEl = document.getElementById("importEntregasFile");
    const processarImportacaoEntregasBtnEl = document.getElementById("processarImportacaoEntregasBtn");
    const importacaoEntregasStatusEl = document.getElementById("importacaoEntregasStatus");
    const loadingImportEntregasSpinnerEl = document.getElementById("loadingImportEntregasSpinner");

    const entFiltroMatriculaEl = document.getElementById("entFiltroMatricula");
    const entFiltroAlocationEl = document.getElementById("entFiltroAlocation");
    const entFiltroDataEntregaInicioEl = document.getElementById("entFiltroDataEntregaInicio");
    const entFiltroDataEntregaFimEl = document.getElementById("entFiltroDataEntregaFim");
    const entFiltroCondutorEntregaEl = document.getElementById("entFiltroCondutorEntrega");
    const entFiltroEstadoReservaEl = document.getElementById("entFiltroEstadoReserva");
    const entAplicarFiltrosBtnEl = document.getElementById("entAplicarFiltrosBtn");
    
    const entregasTableBodyEl = document.getElementById("entregasTableBody");
    const entregasNenhumaMsgEl = document.getElementById("entregasNenhumaMsg");
    const entregasPaginacaoEl = document.getElementById("entregasPaginacao");
    const loadingEntregasTableSpinnerEl = document.getElementById("loadingEntregasTableSpinner");
    const entregasTotalCountEl = document.getElementById("entregasTotalCount");
    
    const voltarDashboardBtnEntregasEl = document.getElementById("voltarDashboardBtnEntregas");

    // Dashboard de Entregas
    const entregasDashboardFiltroDataInicioEl = document.getElementById("entregasDashboardFiltroDataInicio");
    const entregasDashboardFiltroDataFimEl = document.getElementById("entregasDashboardFiltroDataFim");
    const entregasDashboardFiltroPeriodoEl = document.getElementById("entregasDashboardFiltroPeriodo");
    const entregasAplicarFiltrosDashboardBtnEl = document.getElementById("entregasAplicarFiltrosDashboardBtn");
    const statTotalEntregasDashboardEl = document.getElementById("statTotalEntregasDashboard");
    const statTotalEntregasPeriodoDashboardEl = document.getElementById("statTotalEntregasPeriodoDashboard");
    const statMediaEntregasDiaDashboardEl = document.getElementById("statMediaEntregasDiaDashboard");
    const statMediaEntregasDiaPeriodoDashboardEl = document.getElementById("statMediaEntregasDiaPeriodoDashboard");
    const entregasDashboardDataHoraInputEl = document.getElementById("entregasDashboardDataHoraInput");
    const entregasDashboardDataHoraDisplayEl = document.getElementById("entregasDashboardDataHoraDisplay");
    const chartEntregasPorHoraDashboardEl = document.getElementById("chartEntregasPorHoraDashboard")?.getContext('2d'); // Obter contexto 2D
    const chartTopCondutoresEntregasDashboardEl = document.getElementById("chartTopCondutoresEntregasDashboard")?.getContext('2d');

    // Modal de Detalhes/Registo de Entrega
    const entregaDetalhesModalEl = document.getElementById('entregaDetalhesModal');
    const entregaModalTitleEl = document.getElementById('entregaModalTitle');
    const entregaDetalhesFormEl = document.getElementById('entregaDetalhesForm');
    const entregaModalReservaIdPkEl = document.getElementById('entregaModalReservaIdPk');
    const modalEntInfoBookingIdEl = document.getElementById('modalEntInfoBookingId');
    const modalEntInfoMatriculaEl = document.getElementById('modalEntInfoMatricula');
    const modalEntInfoAlocationEl = document.getElementById('modalEntInfoAlocation');
    const modalEntInfoNomeClienteEl = document.getElementById('modalEntInfoNomeCliente');
    const modalEntInfoCheckoutPrevistoEl = document.getElementById('modalEntInfoCheckoutPrevisto');
    const modalEntInfoParqueAtualEl = document.getElementById('modalEntInfoParqueAtual');
    const modalEntregaDataRealEl = document.getElementById('modalEntregaDataReal');
    const modalEntregaCondutorEl = document.getElementById('modalEntregaCondutor');
    const modalEntregaKmsSaidaEl = document.getElementById('modalEntregaKmsSaida');
    const modalEntregaDanosCheckOutEl = document.getElementById('modalEntregaDanosCheckOut');
    const modalEntregaFotosEl = document.getElementById('modalEntregaFotos');
    const modalEntregaFotosPreviewEl = document.getElementById('modalEntregaFotosPreview');
    const modalEntregaFotosUrlsExistentesEl = document.getElementById('modalEntregaFotosUrlsExistentes');
    const modalEntregaObsInternasEl = document.getElementById('modalEntregaObsInternas');
    const modalEntregaEstadoFinalReservaEl = document.getElementById('modalEntregaEstadoFinalReserva');
    const entregaModalStatusEl = document.getElementById('entregaModalStatus');
    const entFecharModalBtns = document.querySelectorAll(".entFecharModalBtn");
    const loadingModalSpinnerEntregaEl = document.getElementById("loadingModalSpinnerEntrega");

    let paginaAtualEntregas = 1;
    const itensPorPaginaEntregas = 15;
    let graficoEntregasPorHoraDashboard, graficoTopCondutoresEntregasDashboard;

    // --- Funções Utilitárias Essenciais ---
    function formatarDataHora(dataISO, includeSeconds = false) {
        if (!dataISO) return "N/A";
        try {
            const date = new Date(dataISO);
            if (isNaN(date.getTime())) return "Data Inválida";
            const options = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" };
            if (includeSeconds) options.second = "2-digit";
            return date.toLocaleString("pt-PT", options);
        } catch (e) { console.warn("Erro ao formatar data-hora (Entregas):", dataISO, e); return String(dataISO).split('T')[0]; }
    }

    function formatarDataParaInputDateTimeLocal(dataISO) {
        if (!dataISO) return "";
        try {
            const d = new Date(dataISO);
            if (isNaN(d.getTime())) return "";
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        } catch (e) { console.warn("Erro formatar data input datetime-local (Entregas):", dataISO, e); return ""; }
    }
    
    function formatarDataParaInputDate(dataISO) {
        if (!dataISO) return "";
        try {
            const d = new Date(dataISO);
            if (isNaN(d.getTime())) return "";
            return d.toISOString().split('T')[0];
        } catch (e) { console.warn("Erro formatar data input date (Entregas):", dataISO, e); return ""; }
    }

    function converterDataParaISO(dataStr) {
        if (!dataStr) return null;
        if (dataStr instanceof Date) {
            if (isNaN(dataStr.getTime())) { console.warn(`Data inválida para ISO:`, dataStr); return null; }
            return dataStr.toISOString().split('.')[0]; // Remove milissegundos
        }
        // Tenta formatos comuns, incluindo o de flatpickr "DD/MM/YYYY HH:MM" ou "YYYY-MM-DDTHH:MM"
        let d;
        const flatpickrDateTimeMatch = String(dataStr).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/); // DD/MM/YYYY HH:MM
        const flatpickrDateMatch = String(dataStr).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // DD/MM/YYYY
        const htmlDateTimeLocalMatch = String(dataStr).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/); // YYYY-MM-DDTHH:MM

        if (flatpickrDateTimeMatch) {
            const [, day, month, year, hour, minute] = flatpickrDateTimeMatch;
            d = new Date(Date.UTC(year, month - 1, day, hour, minute));
        } else if (flatpickrDateMatch) {
            const [, day, month, year] = flatpickrDateMatch;
            d = new Date(Date.UTC(year, month - 1, day));
        } else if (htmlDateTimeLocalMatch) {
             d = new Date(dataStr + ":00Z"); // Adiciona segundos e Z para UTC se vier de datetime-local
        } else {
            d = new Date(dataStr); // Tenta parse direto
        }

        if (!isNaN(d.getTime())) return d.toISOString().split('.')[0];
        
        console.warn(`Formato de data não reconhecido para ISO (Entregas): "${dataStr}"`);
        return null;
    }

    function validarCampoNumerico(valor) {
        if (valor === null || valor === undefined || String(valor).trim() === "") return null;
        let numStr = String(valor).replace(',', '.').replace(/[^\d.-]/g, '');
        const numero = parseFloat(numStr);
        return isNaN(numero) ? null : numero;
    }

    function mostrarSpinner(spinnerId, show = true) {
        const el = document.getElementById(spinnerId);
        if(el) el.classList.toggle('hidden', !show);
    }
    
    function normalizarMatricula(matricula) {
        if (!matricula) return null;
        return String(matricula).replace(/[\s\-\.]/g, '').toUpperCase();
    }

    async function obterEntidadeIdPorNomeComRPC(nomeEntidade, rpcName = 'obter_condutor_id_por_nome', paramName = 'p_nome_condutor') {
        if (!nomeEntidade || String(nomeEntidade).trim() === "") {
            console.warn(`RPC ${rpcName}: Nome da entidade vazio.`);
            return null;
        }
        try {
            const nomeNormalizado = String(nomeEntidade).trim();
            const params = {};
            params[paramName] = nomeNormalizado;
            const { data, error } = await supabase.rpc(rpcName, params);
            if (error) { console.error(`Erro RPC ${rpcName} para "${nomeNormalizado}":`, error); return null; }
            return data; 
        } catch (error) {
            console.error(`Exceção RPC ${rpcName} para "${nomeEntidade}":`, error);
            return null;
        }
    }
    
    // --- Carregar Condutores ---
    async function carregarCondutoresParaSelects() {
        if (listaCondutoresCache.length > 0) {
            popularSelectCondutores(entFiltroCondutorEntregaEl, listaCondutoresCache, "Todos Condutores");
            popularSelectCondutores(modalEntregaCondutorEl, listaCondutoresCache, "Selecione o Condutor");
            return;
        }
        try {
            const { data, error } = await supabase.from('profiles')
                .select('id, full_name, username')
                .order('full_name');
            if (error) throw error;
            listaCondutoresCache = data || [];
            popularSelectCondutores(entFiltroCondutorEntregaEl, listaCondutoresCache, "Todos Condutores");
            popularSelectCondutores(modalEntregaCondutorEl, listaCondutoresCache, "Selecione o Condutor");
        } catch (error) {
            console.error("Erro ao carregar condutores (Entregas):", error);
        }
    }

    function popularSelectCondutores(selectEl, condutores, textoPrimeiraOpcao = "Todos") {
        if (!selectEl) return;
        const valorGuardado = selectEl.value;
        selectEl.innerHTML = `<option value="">${textoPrimeiraOpcao}</option>`;
        condutores.forEach(cond => {
            const option = document.createElement('option');
            option.value = cond.id;
            option.textContent = cond.full_name || cond.username || `ID: ${cond.id.substring(0,6)}`;
            selectEl.appendChild(option);
        });
        if (Array.from(selectEl.options).some(opt => opt.value === valorGuardado)) {
            selectEl.value = valorGuardado;
        }
    }

    // --- Lógica de Importação de Ficheiro de Entregas ---
    async function processarFicheiroEntregasImport() {
        const ficheiro = importEntregasFileEl.files[0];
        if (!ficheiro) {
            importacaoEntregasStatusEl.textContent = 'Por favor, selecione um ficheiro.';
            importacaoEntregasStatusEl.className = 'mt-3 text-sm text-red-600'; return;
        }
        importacaoEntregasStatusEl.textContent = 'A processar ficheiro...';
        importacaoEntregasStatusEl.className = 'mt-3 text-sm text-blue-600';
        mostrarSpinner('loadingImportEntregasSpinner', true);
        if(processarImportacaoEntregasBtnEl) processarImportacaoEntregasBtnEl.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const fileData = new Uint8Array(e.target.result);
                const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
                const nomePrimeiraFolha = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[nomePrimeiraFolha], { raw: false, defval: null });

                if (jsonData.length === 0) throw new Error('Ficheiro vazio ou dados ilegíveis.');
                importacaoEntregasStatusEl.textContent = `A processar ${jsonData.length} registos...`;

                let atualizacoesSucesso = 0, erros = 0, ignoradas = 0, naoEncontradas = 0;

                const mapeamento = { // Chaves Excel (lowercase, sem espaços) -> Colunas Supabase
                    "licenseplate": "license_plate", "alocation": "alocation", "bookingid": "booking_id_excel",
                    "actiondate": "action_date", // Usado como action_date na tabela reservas
                    "checkout": "data_saida_real", // Principal data da entrega
                    "checkoutdate": "data_saida_real", // Alternativa
                    "condutorentrega": "_condutor_nome_excel",
                    "kmssaída": "kms_saida", "kmssaida": "kms_saida",
                    "danoscheckout": "danos_checkout",
                    "observacoesentrega": "observacoes_entrega",
                    "stats": "estado_reserva_atual_import", // 'entregue', 'concluida', etc.
                    "priceondelivery": "price_on_delivery", // Preço na entrega (pode atualizar total_price ou price_on_delivery)
                    "correctedprice": "corrected_price", // Preço corrigido
                    "extraservices": "extras_price", // Pode ser um valor
                    // Adicionar outros campos do Excel de Entregas aqui
                };
                
                const precosPossiveis = ["priceondelivery", "correctedprice", "extraservices"]; // Nomes de coluna do Excel

                const loteSize = 50;
                for (let i = 0; i < jsonData.length; i += loteSize) {
                    const loteJson = jsonData.slice(i, i + loteSize);
                    const promessasLote = loteJson.map(async (rowExcelOriginal) => {
                        const rowExcel = {}; Object.keys(rowExcelOriginal).forEach(k => rowExcel[k.toLowerCase().replace(/\s+/g, '')] = rowExcelOriginal[k]);
                        
                        const dadosUpdate = {}; let identReserva = {};

                        for (const excelColNorm in mapeamento) {
                            if (rowExcel.hasOwnProperty(excelColNorm) && rowExcel[excelColNorm] !== null) {
                                const valorOriginal = rowExcel[excelColNorm];
                                const supabaseCol = mapeamento[excelColNorm];

                                if (supabaseCol === "license_plate") identReserva.license_plate = normalizarMatricula(String(valorOriginal));
                                else if (supabaseCol === "alocation") identReserva.alocation = String(valorOriginal).trim();
                                else if (supabaseCol === "booking_id_excel") identReserva.booking_id = String(valorOriginal).trim();
                                else if (supabaseCol === "data_saida_real" || supabaseCol === "action_date") dadosUpdate[supabaseCol] = converterDataParaISO(valorOriginal);
                                else if (supabaseCol === "_condutor_nome_excel") dadosUpdate[supabaseCol] = String(valorOriginal).trim();
                                else if (supabaseCol === "kms_saida" || (camposDePrecoSupabase.includes(supabaseCol) || precosPossiveis.includes(excelColNorm))) { // Ajustado para incluir preços
                                    dadosUpdate[supabaseCol] = validarCampoNumerico(valorOriginal);
                                } else if (supabaseCol === "estado_reserva_atual_import") dadosUpdate.estado_reserva_atual = String(valorOriginal).trim().toLowerCase();
                                else dadosUpdate[supabaseCol] = String(valorOriginal).trim();
                            }
                        }

                        if (!identReserva.booking_id && (!identReserva.license_plate || !identReserva.alocation)) { ignoradas++; return; }
                        if (!dadosUpdate.data_saida_real) dadosUpdate.data_saida_real = new Date().toISOString(); // Data da entrega é crucial

                        if (dadosUpdate._condutor_nome_excel) {
                            const condutorId = await obterEntidadeIdPorNomeComRPC(dadosUpdate._condutor_nome_excel, 'obter_condutor_id_por_nome', 'p_nome_condutor');
                            if (condutorId) dadosUpdate.condutor_entrega_id = condutorId;
                            delete dadosUpdate._condutor_nome_excel;
                        }
                        
                        // Se priceOnDelivery do Excel foi mapeado para total_price ou price_on_delivery na BD
                        if(dadosUpdate.hasOwnProperty('price_on_delivery') && dadosUpdate.price_on_delivery !== null) {
                            dadosUpdate.total_price = dadosUpdate.price_on_delivery; // Exemplo: atualiza total_price
                        }


                        let queryBusca = supabase.from("reservas").select("id_pk");
                        if (identReserva.booking_id) queryBusca = queryBusca.eq("booking_id", identReserva.booking_id);
                        else queryBusca = queryBusca.eq("license_plate", identReserva.license_plate).eq("alocation", identReserva.alocation);
                        
                        const { data: reserva, error: errBusca } = await queryBusca.maybeSingle();
                        if (errBusca) { erros++; return; }

                        if (reserva) {
                            if (!dadosUpdate.estado_reserva_atual) dadosUpdate.estado_reserva_atual = "Entregue";
                            dadosUpdate.user_id_modificacao_registo = currentUser?.id;
                            if(!dadosUpdate.action_date) dadosUpdate.action_date = new Date().toISOString(); // Data da modificação

                            const { error: errUpdate } = await supabase.from("reservas").update(dadosUpdate).eq("id_pk", reserva.id_pk);
                            if (errUpdate) {
                                console.error(`Erro ao atualizar entrega para reserva PK ${reserva.id_pk}:`, errUpdate, "Dados:", dadosUpdate);
                                erros++;
                            } else { atualizacoesSucesso++; }
                        } else { naoEncontradas++; }
                    });
                    await Promise.all(promessasLote);
                    if (i + loteSize < jsonData.length) await new Promise(resolve => setTimeout(resolve, 200));
                }
                importacaoEntregasStatusEl.textContent = `Concluído: ${atualizacoesSucesso} atualizadas. ${erros} erros. ${ignoradas} ignoradas. ${naoEncontradas} não encontradas.`;
                await carregarEntregasDaLista(); await carregarDadosDashboardEntregas();
            } catch (error) {
                console.error('Erro ao processar ficheiro Entregas:', error);
                importacaoEntregasStatusEl.textContent = `Erro: ${error.message}`;
            } finally {
                mostrarSpinner('loadingImportEntregasSpinner', false);
                if(processarImportacaoEntregasBtnEl) processarImportacaoEntregasBtnEl.disabled = false;
                if(importEntregasFileEl) importEntregasFileEl.value = '';
            }
        };
        reader.readAsArrayBuffer(ficheiro);
    }

    // --- Lógica da Lista de Entregas (READ) ---
    async function carregarEntregasDaLista(pagina = 1, filtrosParams = null) { /* ... (manter lógica de Entregas que te dei, com `data_saida_real` etc.) ... */ }
    function atualizarPaginacaoEntregasLista(paginaCorrente, totalItens) { /* ... (manter) ... */ }
    function obterFiltrosEntregasLista() { /* ... (manter) ... */ }
    function getEstadoClass(estado) { /* ... (manter ou adaptar para estados de entrega) ... */ }

    // --- Lógica do Dashboard de Entregas ---
    async function carregarDadosDashboardEntregas() { /* ... (manter, mas garantir que as RPCs/queries usam data_saida_real) ... */ }
    
    // --- Modal de Detalhes/Registo de Entrega ---
    function configurarBotoesAcaoEntregas() { /* ... (manter) ... */ }
    async function abrirModalDetalhesEntrega(reservaIdPk) { /* ... (manter) ... */ }
    async function handleEntregaFormSubmit(event) { /* ... (manter, assegurar `validarCampoNumerico` para KMs, e que as fotos vão para `fotos_checkout_urls`) ... */ }
    
    // --- Configuração de Event Listeners ---
    function configurarEventosEntregas() { /* ... (manter e verificar todos os listeners) ... */ }

    // --- Inicialização da Página de Entregas ---
    async function initEntregasPage() {
        console.log("Entregas.js: Iniciando initEntregasPage...");
        if (!currentUser) { console.warn("Entregas.js: currentUser não definido."); return; }
        console.log("Entregas.js: Utilizador autenticado, prosseguindo com init.");
        
        configurarEventosEntregas();
        await carregarCondutoresParaSelects();
        
        const dateInputs = [
            entFiltroDataEntregaInicioEl, entFiltroDataEntregaFimEl,
            entregasDashboardFiltroDataInicioEl, entregasDashboardFiltroDataFimEl,
            entregasDashboardDataHoraInputEl, modalEntregaDataRealEl // modalEntregaDataRealEl é datetime
        ];
        dateInputs.forEach(el => {
            if (el) {
                const isDateTime = el.id === 'modalEntregaDataRealEl' || el.classList.contains('flatpickr-datetime');
                flatpickr(el, { 
                    dateFormat: isDateTime ? "Y-m-d H:i" : "Y-m-d", 
                    enableTime: isDateTime,
                    time_24hr: isDateTime,
                    locale: "pt", 
                    allowInput: true,
                    defaultDate: el.id === 'modalEntregaDataRealEl' ? new Date() : (el.id === 'entregasDashboardDataHoraInputEl' ? "today" : null)
                });
            }
        });

        if (entregasDashboardFiltroPeriodoEl) {
            entregasDashboardFiltroPeriodoEl.dispatchEvent(new Event('change'));
        } else {
            await carregarDadosDashboardEntregas();
        }
        
        await carregarEntregasDaLista(1, obterFiltrosEntregasLista());
        console.log("Subaplicação de Gestão de Entregas inicializada.");
    }
    
    // Bloco de Inicialização e Autenticação (IIFE)
    (async () => {
        try {
            if (typeof window.checkAuthStatus !== 'function') { console.error("ERRO CRÍTICO (Entregas): checkAuthStatus não definido."); alert("Erro config Auth (Entregas)."); return; }
            await window.checkAuthStatus(); 
            const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
            if (authError) { console.error("Entregas: Erro getUser():", authError); window.location.href = "index.html"; return; }
            currentUser = supabaseUser;
            if (currentUser) {
                const userProfileStr = localStorage.getItem('userProfile');
                if (userProfileStr) { try { userProfile = JSON.parse(userProfileStr); } catch (e) { console.error("Erro parse userProfile (Entregas):", e);}}
                initEntregasPage();
            } else { console.warn("Entregas: Utilizador não autenticado. Redirecionando."); window.location.href = "index.html"; }
        } catch (e) { console.error("Erro inicialização Entregas:", e); alert("Erro crítico ao iniciar Entregas.");}
    })();
});

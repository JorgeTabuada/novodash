// js/reservas.js - Lógica para a Subaplicação de Gestão de Reservas

// Certifica-te que este script é carregado DEPOIS de supabaseClient.js e auth_global.js

document.addEventListener("DOMContentLoaded", async () => {
    // --- Verificação de Cliente Supabase ---
    if (!window.sbClient) {
        console.error("ERRO CRÍTICO: sbClient (Supabase Client) não está definido. Verifique a ordem de carregamento dos scripts (supabaseClient.js deve vir antes).");
        alert("Erro crítico na configuração da aplicação. Contacte o suporte.");
        return;
    }

    let currentUser = null;
    let userProfile = null;

    try {
        const { data: { user } } = await window.sbClient.auth.getUser();
        currentUser = user;
        if (!currentUser) {
            console.log("Utilizador não autenticado, auth_global.js deveria ter redirecionado.");
            // auth_global.js é responsável pelo redirecionamento se não houver sessão.
            // Se chegarmos aqui sem utilizador, pode ser um estado inesperado ou a página de login.
            // Não faremos nada aqui, pois auth_global.js trata do fluxo.
            return; 
        }
        // Tentar obter perfil do localStorage (se auth_global.js o guardar lá)
        // userProfile = JSON.parse(localStorage.getItem("userProfile")); 
        // console.log("Utilizador atual:", currentUser, "Perfil:", userProfile);
    } catch (error) {
        console.error("Erro ao obter utilizador autenticado:", error);
        // auth_global.js deve tratar o redirecionamento em caso de falha grave.
        return;
    }

    // --- Seletores de Elementos DOM (mantidos como no original, verificar se todos existem no HTML) ---
    const importReservasFileEl = document.getElementById("importReservasFile");
    const resProcessarImportacaoBtnEl = document.getElementById("resProcessarImportacaoBtn");
    const importacaoStatusEl = document.getElementById("importacaoStatus");
    const loadingImportSpinnerEl = document.getElementById("loadingImportSpinner");

    const resDashboardFiltroDataInicioEl = document.getElementById("resDashboardFiltroDataInicio");
    const resDashboardFiltroDataFimEl = document.getElementById("resDashboardFiltroDataFim");
    const resDashboardFiltroPeriodoEl = document.getElementById("resDashboardFiltroPeriodo");
    const resAplicarFiltrosDashboardBtnEl = document.getElementById("resAplicarFiltrosDashboardBtn");

    const statTotalReservasEl = document.getElementById("statTotalReservas");
    const statTotalReservasPeriodoEl = document.getElementById("statTotalReservasPeriodo");
    const statValorTotalReservasEl = document.getElementById("statValorTotalReservas");
    const statValorTotalReservasPeriodoEl = document.getElementById("statValorTotalReservasPeriodo");
    const statReservasCampanhaEl = document.getElementById("statReservasCampanha");
    const statReservasDiaSemanaEl = document.getElementById("statReservasDiaSemana");
    const resDashboardDataHoraInputEl = document.getElementById("resDashboardDataHoraInput");
    const resDashboardDataHoraDisplayEl = document.getElementById("resDashboardDataHoraDisplay");
    const calendarioReservasContainerEl = document.getElementById("calendarioReservasContainer");
    const chartReservasPorHoraEl = document.getElementById("chartReservasPorHora");
    const chartReservasMensalEl = document.getElementById("chartReservasMensal");

    const resSearchTermEl = document.getElementById("resSearchTerm");
    const resSearchBtnEl = document.getElementById("resSearchBtn");

    const resAbrirModalNovaBtnEl = document.getElementById("resAbrirModalNovaBtn");
    const resExportarBtnEl = document.getElementById("resExportarBtn");

    const resFiltroClienteListaEl = document.getElementById("resFiltroClienteLista");
    const resFiltroMatriculaListaEl = document.getElementById("resFiltroMatriculaLista");
    const resFiltroDataEntradaListaEl = document.getElementById("resFiltroDataEntradaLista");
    const resFiltroEstadoListaEl = document.getElementById("resFiltroEstadoLista");
    const resAplicarFiltrosListaBtnEl = document.getElementById("resAplicarFiltrosListaBtn");
    const reservasTableBodyEl = document.getElementById("reservasTableBody");
    const reservasNenhumaMsgEl = document.getElementById("reservasNenhumaMsg");
    const reservasPaginacaoEl = document.getElementById("reservasPaginacao");
    const loadingTableSpinnerEl = document.getElementById("loadingTableSpinner");

    const reservaFormModalEl = document.getElementById("reservaFormModal");
    const reservaFormModalTitleEl = document.getElementById("reservaFormModalTitle");
    const reservaFormEl = document.getElementById("reservaForm");
    const reservaFormIdEl = document.getElementById("reservaFormId"); // Hidden input para ID da reserva em edição
    const resFecharModalBtns = document.querySelectorAll(".resFecharModalBtn");
    
    // Campos do formulário (garantir que os IDs correspondem ao HTML)
    const formFields = {
        booking_id: document.getElementById("reservaFormBookingId"),
        data_reserva: document.getElementById("reservaFormDataReserva"),
        nome_cliente: document.getElementById("reservaFormNomeCliente"),
        email_cliente: document.getElementById("reservaFormEmailCliente"),
        telefone_cliente: document.getElementById("reservaFormTelefoneCliente"),
        matricula: document.getElementById("reservaFormMatricula"),
        alocation: document.getElementById("reservaFormAlocation"),
        check_in_datetime: document.getElementById("reservaFormDataEntrada"),
        check_out_datetime: document.getElementById("reservaFormDataSaida"),
        physical_park_name: document.getElementById("reservaFormParque"), // Ou parque_id se for um select
        campaign_name: document.getElementById("reservaFormCampanha"),
        total_price: document.getElementById("reservaFormValor"),
        estado_reserva: document.getElementById("reservaFormEstado"),
        observacoes: document.getElementById("reservaFormObservacoes"),
        // Adicionar outros campos conforme schema_final.md
        last_action: document.getElementById("reservaFormLastAction"),
        last_action_user_details: document.getElementById("reservaFormLastActionUser"),
        last_action_date: document.getElementById("reservaFormLastActionDate"),
        extra_services: document.getElementById("reservaFormExtraServices"),
        has_online_payment: document.getElementById("reservaFormHasOnlinePayment"),
        park_brand: document.getElementById("reservaFormParkBrand"),
        parking_price: document.getElementById("reservaFormParkingPrice"),
        delivery_price: document.getElementById("reservaFormDeliveryPrice"),
        delivery_name: document.getElementById("reservaFormDeliveryName"),
        is_imported: document.getElementById("reservaFormIsImported"),
        client_external_id: document.getElementById("reservaFormClientExternalId"),
        car_info_details: document.getElementById("reservaFormCarInfoDetails"),
        car_brand: document.getElementById("reservaFormCarBrand"),
        car_model: document.getElementById("reservaFormCarModel"),
        car_color: document.getElementById("reservaFormCarColor"),
        info_from_license_plate: document.getElementById("reservaFormInfoFromLicensePlate"),
        car_location_description: document.getElementById("reservaFormCarLocationDescription"),
        check_in_video_url: document.getElementById("reservaFormCheckInVideoUrl"),
        parking_row: document.getElementById("reservaFormParkingRow"),
        parking_spot: document.getElementById("reservaFormParkingSpot"),
        delivery_location: document.getElementById("reservaFormDeliveryLocation"),
        tax_name: document.getElementById("reservaFormTaxName"),
        tax_number: document.getElementById("reservaFormTaxNumber"),
        client_city: document.getElementById("reservaFormClientCity"),
        terms_agreed: document.getElementById("reservaFormTermsAgreed"),
        campaign_payment_details: document.getElementById("reservaFormCampaignPaymentDetails"),
        pickup_driver_name: document.getElementById("reservaFormPickupDriverName"),
        parking_type: document.getElementById("reservaFormParkingType"),
        flight_number: document.getElementById("reservaFormFlightNumber"),
        payment_status: document.getElementById("reservaFormPaymentStatus")
    };

    // --- Estado da Aplicação ---
    let todasAsReservasGeral = []; // Cache local das reservas carregadas
    let paginaAtualLista = 1;
    const itensPorPaginaLista = 15;
    let totalReservasNaBD = 0;

    // --- Funções Utilitárias (mantidas e verificadas) ---
    function formatarDataHora(dataISO) {
        if (!dataISO) return "N/A";
        try {
            return new Date(dataISO).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
        } catch (e) { return dataISO; }
    }
    function formatarDataParaInput(dataISO) {
        if (!dataISO) return "";
        try {
            const d = new Date(dataISO);
            return d.toISOString().slice(0, 16); // Formato YYYY-MM-DDTHH:mm
        } catch (e) { return ""; }
    }
    function formatarMoeda(valor) {
        if (valor === null || valor === undefined || isNaN(parseFloat(valor))) return "0,00 €";
        return parseFloat(valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
    }
    function mostrarSpinner(elementId) { if(document.getElementById(elementId)) document.getElementById(elementId).classList.remove("hidden"); }
    function esconderSpinner(elementId) { if(document.getElementById(elementId)) document.getElementById(elementId).classList.add("hidden"); }
    function mostrarElemento(elementId) { if(document.getElementById(elementId)) document.getElementById(elementId).classList.remove("hidden"); }
    function esconderElemento(elementId) { if(document.getElementById(elementId)) document.getElementById(elementId).classList.add("hidden"); }

    // --- Lógica de Carregamento de Reservas (READ) ---
    async function carregarReservasDaLista(pagina = 1, filtros = {}) {
        if (!reservasTableBodyEl) return;
        mostrarSpinner("loadingTableSpinner");
        reservasTableBodyEl.innerHTML = ""; 
        if(reservasNenhumaMsgEl) reservasNenhumaMsgEl.classList.add("hidden");

        const rangeFrom = (pagina - 1) * itensPorPaginaLista;
        const rangeTo = rangeFrom + itensPorPaginaLista - 1;

        let query = window.sbClient.from("reservas").select("*", { count: "exact" });

        // Aplicar filtros (exemplos)
        if (filtros.searchTerm) {
            query = query.or(`nome_cliente.ilike.%${filtros.searchTerm}%,matricula.ilike.%${filtros.searchTerm}%,booking_id.ilike.%${filtros.searchTerm}%`);
        }
        if (filtros.estado_reserva && filtros.estado_reserva !== "todos") {
            query = query.eq("estado_reserva", filtros.estado_reserva);
        }
        // Adicionar mais filtros conforme necessário (data_entrada, etc.)

        query = query.order("created_at", { ascending: false }).range(rangeFrom, rangeTo);

        const { data, error, count } = await query;

        esconderSpinner("loadingTableSpinner");
        if (error) {
            console.error("Erro ao carregar reservas:", error);
            if(reservasNenhumaMsgEl) {
                reservasNenhumaMsgEl.textContent = "Erro ao carregar dados. Tente novamente.";
                reservasNenhumaMsgEl.classList.remove("hidden");
            }
            return;
        }

        todasAsReservasGeral = data;
        totalReservasNaBD = count;

        if (data && data.length > 0) {
            data.forEach(reserva => {
                const tr = document.createElement("tr");
                tr.className = "border-b hover:bg-gray-50";
                tr.innerHTML = `
                    <td class="py-3 px-4 text-xs">${reserva.booking_id || "N/A"}</td>
                    <td class="py-3 px-4 text-xs">${formatarDataHora(reserva.data_reserva)}</td>
                    <td class="py-3 px-4 text-xs">${reserva.nome_cliente || "N/A"}</td>
                    <td class="py-3 px-4 text-xs">${reserva.matricula || "N/A"}</td>
                    <td class="py-3 px-4 text-xs">${reserva.alocation || "N/A"}</td>
                    <td class="py-3 px-4 text-xs">${formatarDataHora(reserva.check_in_datetime)}</td>
                    <td class="py-3 px-4 text-xs">${formatarDataHora(reserva.check_out_datetime)}</td>
                    <td class="py-3 px-4 text-xs">${reserva.physical_park_name || "N/A"}</td>
                    <td class="py-3 px-4 text-xs text-right">${formatarMoeda(reserva.total_price)}</td>
                    <td class="py-3 px-4 text-xs"><span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">${reserva.estado_reserva || "N/A"}</span></td>
                    <td class="py-3 px-4 text-xs">
                        <button class="text-blue-600 hover:text-blue-800 editar-reserva-btn" data-id="${reserva.id}">Editar</button>
                        <button class="text-red-600 hover:text-red-800 apagar-reserva-btn ml-2" data-id="${reserva.id}">Apagar</button>
                    </td>
                `;
                reservasTableBodyEl.appendChild(tr);
            });
            configurarBotoesAcao();
        } else {
            if(reservasNenhumaMsgEl) {
                reservasNenhumaMsgEl.textContent = "Nenhuma reserva encontrada com os filtros atuais.";
                reservasNenhumaMsgEl.classList.remove("hidden");
            }
        }
        atualizarPaginacaoLista(pagina, count);
        atualizarDashboardStats(); // Atualizar estatísticas do dashboard
    }

    // --- Lógica de Paginação ---
    function atualizarPaginacaoLista(paginaCorrente, totalItens) {
        if (!reservasPaginacaoEl || totalItens === 0) {
            if(reservasPaginacaoEl) reservasPaginacaoEl.innerHTML = "";
            return;
        }
        const totalPaginas = Math.ceil(totalItens / itensPorPaginaLista);
        reservasPaginacaoEl.innerHTML = ""; // Limpar paginação anterior

        if (totalPaginas <= 1) return;

        // Botão Anterior
        const prevButton = document.createElement("button");
        prevButton.innerHTML = "&laquo; Anterior";
        prevButton.className = "px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed";
        prevButton.disabled = paginaCorrente === 1;
        prevButton.addEventListener("click", () => carregarReservasDaLista(paginaCorrente - 1, obterFiltrosAtuais()));
        reservasPaginacaoEl.appendChild(prevButton);

        // Números das Páginas (simplificado)
        let startPage = Math.max(1, paginaCorrente - 2);
        let endPage = Math.min(totalPaginas, paginaCorrente + 2);

        if (startPage > 1) {
            const firstButton = document.createElement("button");
            firstButton.textContent = "1";
            firstButton.className = "px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 mx-1";
            firstButton.addEventListener("click", () => carregarReservasDaLista(1, obterFiltrosAtuais()));
            reservasPaginacaoEl.appendChild(firstButton);
            if (startPage > 2) {
                const ellipsis = document.createElement("span");
                ellipsis.textContent = "...";
                ellipsis.className = "px-3 py-1 text-sm";
                reservasPaginacaoEl.appendChild(ellipsis);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement("button");
            pageButton.textContent = i;
            pageButton.className = `px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 mx-1 ${i === paginaCorrente ? "bg-blue-500 text-white border-blue-500" : ""}`;
            if (i === paginaCorrente) pageButton.disabled = true;
            pageButton.addEventListener("click", () => carregarReservasDaLista(i, obterFiltrosAtuais()));
            reservasPaginacaoEl.appendChild(pageButton);
        }

        if (endPage < totalPaginas) {
            if (endPage < totalPaginas - 1) {
                const ellipsis = document.createElement("span");
                ellipsis.textContent = "...";
                ellipsis.className = "px-3 py-1 text-sm";
                reservasPaginacaoEl.appendChild(ellipsis);
            }
            const lastButton = document.createElement("button");
            lastButton.textContent = totalPaginas;
            lastButton.className = "px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 mx-1";
            lastButton.addEventListener("click", () => carregarReservasDaLista(totalPaginas, obterFiltrosAtuais()));
            reservasPaginacaoEl.appendChild(lastButton);
        }

        // Botão Próximo
        const nextButton = document.createElement("button");
        nextButton.innerHTML = "Próximo &raquo;";
        nextButton.className = "px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 ml-2 disabled:opacity-50 disabled:cursor-not-allowed";
        nextButton.disabled = paginaCorrente === totalPaginas;
        nextButton.addEventListener("click", () => carregarReservasDaLista(paginaCorrente + 1, obterFiltrosAtuais()));
        reservasPaginacaoEl.appendChild(nextButton);
    }
    
    function obterFiltrosAtuais() {
        // Implementar lógica para obter filtros dos inputs de filtro da lista
        const filtros = {};
        if (resSearchTermEl && resSearchTermEl.value) filtros.searchTerm = resSearchTermEl.value.trim();
        if (resFiltroEstadoListaEl && resFiltroEstadoListaEl.value) filtros.estado_reserva = resFiltroEstadoListaEl.value;
        // Adicionar outros filtros aqui
        return filtros;
    }

    // --- Lógica de Criação e Edição de Reservas (CREATE/UPDATE) ---
    function abrirModalReserva(reserva = null) {
        if (!reservaFormModalEl || !reservaFormEl) return;
        reservaFormEl.reset(); // Limpar formulário
        if(reservaFormIdEl) reservaFormIdEl.value = ""; // Limpar ID oculto

        if (reserva) {
            if(reservaFormModalTitleEl) reservaFormModalTitleEl.textContent = "Editar Reserva";
            if(reservaFormIdEl) reservaFormIdEl.value = reserva.id; // Guardar ID para update
            
            // Preencher formulário com dados da reserva
            // Usar os IDs corretos dos campos do formulário definidos em `formFields`
            for (const key in formFields) {
                if (formFields[key] && reserva[key] !== undefined) {
                    if (formFields[key].type === "datetime-local") {
                        formFields[key].value = formatarDataParaInput(reserva[key]);
                    } else if (formFields[key].type === "checkbox") {
                        formFields[key].checked = !!reserva[key];
                    } else {
                        formFields[key].value = reserva[key] === null ? "" : reserva[key];
                    }
                }
            }
            // Campo booking_id é especial, pode ser apenas para mostrar
            if (formFields.booking_id && reserva.booking_id) {
                formFields.booking_id.value = reserva.booking_id;
                // formFields.booking_id.readOnly = true; // Tornar não editável se for gerado pelo sistema
            }

        } else {
            if(reservaFormModalTitleEl) reservaFormModalTitleEl.textContent = "Nova Reserva";
            // Gerar e mostrar um booking_id temporário ou deixar em branco para ser gerado no backend?
            // Por agora, deixamos o campo booking_id editável ou geramos no submit se estiver vazio.
            if (formFields.booking_id) {
                // formFields.booking_id.value = `TEMP-${Date.now()}`;
                // formFields.booking_id.readOnly = false;
            }
        }
        if(reservaFormModalEl) reservaFormModalEl.classList.remove("hidden");
    }

    function fecharModalReserva() {
        if(reservaFormModalEl) reservaFormModalEl.classList.add("hidden");
    }

    async function submeterFormularioReserva(event) {
        event.preventDefault();
        if (!currentUser || !window.sbClient) {
            alert("Não autenticado ou cliente Supabase não disponível.");
            return;
        }

        const idReserva = reservaFormIdEl ? reservaFormIdEl.value : null;
        const dadosFormulario = {};

        for (const key in formFields) {
            if (formFields[key]) {
                if (formFields[key].type === "checkbox") {
                    dadosFormulario[key] = formFields[key].checked;
                } else if (formFields[key].value !== "") {
                    // Converter para número se for um campo numérico
                    if (["total_price", "parking_price", "delivery_price"].includes(key)) {
                        dadosFormulario[key] = parseFloat(formFields[key].value) || null;
                    } else {
                        dadosFormulario[key] = formFields[key].value;
                    }
                } else {
                    dadosFormulario[key] = null; // Enviar null se o campo estiver vazio
                }
            }
        }
        
        // Se booking_id estiver vazio e for uma nova reserva, gerar um
        if (!idReserva && !dadosFormulario.booking_id) {
            dadosFormulario.booking_id = `SUPA-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        }

        // Adicionar/atualizar user_id e parque_id (se aplicável)
        dadosFormulario.user_id = currentUser.id;
        // Se tiver um select para parques, obter o parque_id selecionado.
        // dadosFormulario.parque_id = o_id_do_parque_selecionado;

        let resultado;
        if (idReserva) { // Atualizar reserva existente
            console.log("A atualizar reserva ID:", idReserva, "Dados:", dadosFormulario);
            const { data, error } = await window.sbClient.from("reservas").update(dadosFormulario).eq("id", idReserva).select().single();
            resultado = { data, error };
        } else { // Criar nova reserva
            console.log("A criar nova reserva. Dados:", dadosFormulario);
            const { data, error } = await window.sbClient.from("reservas").insert(dadosFormulario).select().single();
            resultado = { data, error };
        }

        if (resultado.error) {
            console.error("Erro ao guardar reserva:", resultado.error);
            alert(`Erro ao guardar reserva: ${resultado.error.message}`);
        } else {
            console.log("Reserva guardada com sucesso:", resultado.data);
            fecharModalReserva();
            carregarReservasDaLista(paginaAtualLista, obterFiltrosAtuais()); // Recarregar lista
            // Opcional: mostrar mensagem de sucesso
        }
    }

    // --- Lógica de Eliminação de Reservas (DELETE) ---
    async function apagarReserva(idReserva) {
        if (!idReserva) return;
        if (!confirm("Tem a certeza que deseja apagar esta reserva permanentemente?")) return;

        const { error } = await window.sbClient.from("reservas").delete().eq("id", idReserva);

        if (error) {
            console.error("Erro ao apagar reserva:", error);
            alert(`Erro ao apagar reserva: ${error.message}`);
        } else {
            console.log("Reserva apagada com sucesso.");
            carregarReservasDaLista(paginaAtualLista, obterFiltrosAtuais()); // Recarregar lista
            // Opcional: mostrar mensagem de sucesso
        }
    }
    
    // --- Configurar Botões de Ação Dinâmicos (Editar/Apagar) ---
    function configurarBotoesAcao() {
        document.querySelectorAll(".editar-reserva-btn").forEach(button => {
            button.removeEventListener("click", handleEditarReservaClick); // Evitar múltiplos listeners
            button.addEventListener("click", handleEditarReservaClick);
        });
        document.querySelectorAll(".apagar-reserva-btn").forEach(button => {
            button.removeEventListener("click", handleApagarReservaClick); // Evitar múltiplos listeners
            button.addEventListener("click", handleApagarReservaClick);
        });
    }
    function handleEditarReservaClick(event) {
        const id = event.target.dataset.id;
        const reservaParaEditar = todasAsReservasGeral.find(r => r.id === id);
        if (reservaParaEditar) {
            abrirModalReserva(reservaParaEditar);
        } else {
            console.error("Reserva não encontrada para edição com ID:", id);
        }
    }
    function handleApagarReservaClick(event) {
        const id = event.target.dataset.id;
        apagarReserva(id);
    }

    // --- Lógica de Importação (adaptada para Supabase) ---
    async function processarFicheiroImportacao() {
        const ficheiro = importReservasFileEl.files[0];
        if (!ficheiro) {
            if(importacaoStatusEl) {
                importacaoStatusEl.textContent = "Por favor, selecione um ficheiro.";
                importacaoStatusEl.className = "mt-4 text-sm text-red-600";
            }
            return;
        }

        if(importacaoStatusEl) {
            importacaoStatusEl.textContent = "A processar ficheiro...";
            importacaoStatusEl.className = "mt-4 text-sm text-blue-600";
        }
        mostrarSpinner("loadingImportSpinner");
        if(resProcessarImportacaoBtnEl) resProcessarImportacaoBtnEl.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const dataArray = new Uint8Array(e.target.result);
                const workbook = XLSX.read(dataArray, { type: "array", cellDates: true });
                const nomePrimeiraFolha = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[nomePrimeiraFolha], { raw: false, defval: null });

                if (jsonData.length === 0) {
                    if(importacaoStatusEl) {
                        importacaoStatusEl.textContent = "O ficheiro está vazio ou não foi possível ler os dados.";
                        importacaoStatusEl.className = "mt-4 text-sm text-red-600";
                    }
                    esconderSpinner("loadingImportSpinner");
                    if(resProcessarImportacaoBtnEl) resProcessarImportacaoBtnEl.disabled = false;
                    return;
                }

                const mapeamentoColunasExcelParaSupabase = {
                    "licensePlate": "matricula", "alocation": "alocation", "bookingPrice": "total_price",
                    "action": "last_action", "actionUser": "last_action_user_details", "actionDate": "last_action_date",
                    "extraServices": "extra_services", "hasOnlinePayment": "has_online_payment", "stats": "estado_reserva",
                    "parkBrand": "park_brand", "parkingPrice": "parking_price", "deliveryPrice": "delivery_price",
                    "deliveryName": "delivery_name", "imported": "is_imported", "idClient": "client_external_id",
                    "name": "nome_cliente_primeiro", "lastname": "nome_cliente_ultimo", "phoneNumber": "telefone_cliente",
                    "carInfo": "car_info_details", "brand": "car_brand", "model": "car_model", "color": "car_color",
                    "infoBasedOnLicensePlate": "info_from_license_plate", "carLocation": "car_location_description",
                    "checkInVideo": "check_in_video_url", "park": "physical_park_name", "row": "parking_row",
                    "spot": "parking_spot", "deliveryLocation": "delivery_location", "taxName": "tax_name",
                    "taxNumber": "tax_number", "city": "client_city", "bookingRemarks": "observacoes",
                    "terms": "terms_agreed", "campaign": "campaign_name", "campaignPay": "campaign_payment_details",
                    "condutorRecolha": "pickup_driver_name", "checkIn": "check_in_datetime",
                    "parkingType": "parking_type", "bookingDate": "data_reserva", "returnFlight": "flight_number",
                    "checkOut": "check_out_datetime", "email": "email_cliente" // Adicionado email se existir no Excel
                };

                const reservasParaInserir = jsonData.map(row => {
                    const reservaSupabase = {};
                    for (const excelColName in mapeamentoColunasExcelParaSupabase) {
                        if (row[excelColName] !== undefined && row[excelColName] !== null) {
                            const supabaseColName = mapeamentoColunasExcelParaSupabase[excelColName];
                            // Tratamento especial para datas do Excel que podem vir como números
                            if (["actionDate", "checkIn", "bookingDate", "checkOut"].includes(excelColName) && typeof row[excelColName] === 'number') {
                                reservaSupabase[supabaseColName] = new Date(XLSX.SSF.format("yyyy-mm-dd hh:mm:ss", row[excelColName])).toISOString();
                            } else if (row[excelColName] instanceof Date) {
                                reservaSupabase[supabaseColName] = row[excelColName].toISOString();
                            } else {
                                reservaSupabase[supabaseColName] = row[excelColName];
                            }
                        }
                    }

                    let nomeCompleto = "";
                    if (reservaSupabase.nome_cliente_primeiro) nomeCompleto += reservaSupabase.nome_cliente_primeiro;
                    if (reservaSupabase.nome_cliente_ultimo) nomeCompleto += (nomeCompleto ? " " : "") + reservaSupabase.nome_cliente_ultimo;
                    reservaSupabase.nome_cliente = nomeCompleto.trim() || null;
                    delete reservaSupabase.nome_cliente_primeiro;
                    delete reservaSupabase.nome_cliente_ultimo;

                    reservaSupabase.booking_id = `IMP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
                    reservaSupabase.user_id = currentUser ? currentUser.id : null;
                    reservaSupabase.is_imported = true;
                    
                    // Garantir que campos numéricos são números
                    const camposNumericos = ["total_price", "parking_price", "delivery_price"];
                    camposNumericos.forEach(campo => {
                        if (reservaSupabase[campo] !== undefined && reservaSupabase[campo] !== null) {
                            const valorLimpo = String(reservaSupabase[campo]).replace(/[^0-9.,-]/g, '').replace(',', '.');
                            reservaSupabase[campo] = parseFloat(valorLimpo);
                            if (isNaN(reservaSupabase[campo])) reservaSupabase[campo] = null;
                        }
                    });
                    // Garantir que campos booleanos são booleanos
                    const camposBooleanos = ["has_online_payment", "is_imported", "terms_agreed"];
                    camposBooleanos.forEach(campo => {
                        if (reservaSupabase[campo] !== undefined && reservaSupabase[campo] !== null) {
                            reservaSupabase[campo] = String(reservaSupabase[campo]).toLowerCase() === "true" || String(reservaSupabase[campo]) === "1";
                        }
                    });

                    return reservaSupabase;
                });

                console.log("Reservas para inserir:", reservasParaInserir);

                const { data: insertedData, error: insertError } = await window.sbClient.from("reservas").insert(reservasParaInserir).select();

                if (insertError) {
                    console.error("Erro ao inserir reservas importadas:", insertError);
                    if(importacaoStatusEl) {
                        importacaoStatusEl.textContent = `Erro na importação: ${insertError.message}`;
                        importacaoStatusEl.className = "mt-4 text-sm text-red-600";
                    }
                } else {
                    if(importacaoStatusEl) {
                        importacaoStatusEl.textContent = `${insertedData.length} reservas importadas com sucesso!`;
                        importacaoStatusEl.className = "mt-4 text-sm text-green-600";
                    }
                    carregarReservasDaLista(1, obterFiltrosAtuais()); // Recarregar lista
                }

            } catch (err) {
                console.error("Erro ao processar o ficheiro Excel:", err);
                if(importacaoStatusEl) {
                    importacaoStatusEl.textContent = `Erro ao ler ficheiro: ${err.message}`;
                    importacaoStatusEl.className = "mt-4 text-sm text-red-600";
                }
            } finally {
                esconderSpinner("loadingImportSpinner");
                if(resProcessarImportacaoBtnEl) resProcessarImportacaoBtnEl.disabled = false;
                if(importReservasFileEl) importReservasFileEl.value = ""; // Limpar seleção do ficheiro
            }
        };
        reader.readAsArrayBuffer(ficheiro);
    }

    // --- Lógica de Exportação (adaptada para Supabase) ---
    async function exportarReservasParaExcel() {
        mostrarSpinner("loadingTableSpinner"); // Usar o mesmo spinner da tabela por simplicidade
        // Obter todas as reservas (ou com filtros atuais, se preferir)
        const { data: todasAsReservas, error } = await window.sbClient
            .from("reservas")
            .select("*") // Selecionar todas as colunas definidas no Supabase
            .order("created_at", { ascending: false });
        
        esconderSpinner("loadingTableSpinner");

        if (error) {
            console.error("Erro ao obter dados para exportação:", error);
            alert("Erro ao exportar dados. Tente novamente.");
            return;
        }

        if (!todasAsReservas || todasAsReservas.length === 0) {
            alert("Não há dados para exportar.");
            return;
        }

        // Mapear dados do Supabase para um formato mais simples para o Excel (opcional)
        // Ou usar diretamente as colunas do Supabase.
        // Por agora, vamos usar as colunas como estão.
        const worksheet = XLSX.utils.json_to_sheet(todasAsReservas);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reservas");
        XLSX.writeFile(workbook, `export_reservas_${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    // --- Lógica do Dashboard (a ser implementada com queries ao Supabase) ---
    async function atualizarDashboardStats() {
        if (!window.sbClient) return;

        // Total de Reservas (geral)
        if (statTotalReservasEl) statTotalReservasEl.textContent = totalReservasNaBD;
        if (statTotalReservasPeriodoEl) statTotalReservasPeriodoEl.textContent = "(Período selecionado)"; // Placeholder

        // Valor Total Estimado (geral)
        const { data: sumData, error: sumError } = await window.sbClient
            .from('reservas')
            .select('total_price.sum()');
        
        if (sumError) console.error("Erro ao calcular valor total:", sumError);
        if (statValorTotalReservasEl && sumData && sumData[0] && sumData[0].sum !== null) {
            statValorTotalReservasEl.textContent = formatarMoeda(sumData[0].sum);
        } else if (statValorTotalReservasEl) {
            statValorTotalReservasEl.textContent = formatarMoeda(0);
        }
        if (statValorTotalReservasPeriodoEl) statValorTotalReservasPeriodoEl.textContent = "(Período selecionado)"; // Placeholder

        // TODO: Implementar queries para as restantes estatísticas (Campanha, Dia Semana, Mensal, Hora)
        // Exemplo para Reservas por Campanha:
        // const { data: campData, error: campError } = await window.sbClient
        //    .rpc('contar_reservas_por_campanha'); // Se criar uma função no Supabase
        // Ou: .from('reservas').select('campaign_name, count').groupBy('campaign_name');
        if (statReservasCampanhaEl) statReservasCampanhaEl.textContent = "N/A (a implementar)";
        if (statReservasDiaSemanaEl) statReservasDiaSemanaEl.textContent = "N/A (a implementar)";

        // Atualizar gráficos (placeholder)
        // setupGraficosReservas(); // Inicializa se não existirem
        // if (graficoReservasMensal) {
        //     graficoReservasMensal.data.datasets[0].data = [/* dados do Supabase */];
        //     graficoReservasMensal.update();
        // }
    }

    // --- Event Listeners ---
    if (resProcessarImportacaoBtnEl && importReservasFileEl) {
        resProcessarImportacaoBtnEl.addEventListener("click", processarFicheiroImportacao);
        // Opcional: processar automaticamente ao selecionar ficheiro
        // importReservasFileEl.addEventListener("change", processarFicheiroImportacao);
    }

    if (resAbrirModalNovaBtnEl) {
        resAbrirModalNovaBtnEl.addEventListener("click", () => abrirModalReserva(null));
    }

    if (resFecharModalBtns) {
        resFecharModalBtns.forEach(btn => btn.addEventListener("click", fecharModalReserva));
    }

    if (reservaFormEl) {
        reservaFormEl.addEventListener("submit", submeterFormularioReserva);
    }

    if (resExportarBtnEl) {
        resExportarBtnEl.addEventListener("click", exportarReservasParaExcel);
    }
    
    if (resSearchBtnEl && resSearchTermEl) {
        resSearchBtnEl.addEventListener("click", () => carregarReservasDaLista(1, obterFiltrosAtuais()));
        resSearchTermEl.addEventListener("keypress", (e) => {
            if (e.key === "Enter") carregarReservasDaLista(1, obterFiltrosAtuais());
        });
    }
    if (resAplicarFiltrosListaBtnEl) { // Se houver um botão geral para aplicar filtros da lista
        resAplicarFiltrosListaBtnEl.addEventListener("click", () => carregarReservasDaLista(1, obterFiltrosAtuais()));
    }

    if (resAplicarFiltrosDashboardBtnEl) { // Botão para filtros do dashboard
        resAplicarFiltrosDashboardBtnEl.addEventListener("click", () => {
            // Lógica para aplicar filtros do dashboard e recarregar estatísticas
            console.log("Aplicar filtros do dashboard (a implementar)");
            atualizarDashboardStats();
        });
    }

    // --- Inicialização da Página ---
    console.log("Subaplicação Reservas Inicializada!");
    carregarReservasDaLista(); // Carregar dados iniciais
    setupGraficosReservas(); // Configurar gráficos (mesmo que vazios inicialmente)

});


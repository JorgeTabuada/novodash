// js/reservas.js - Lógica para a Subaplicação de Gestão de Reservas

document.addEventListener("DOMContentLoaded", async () => {
    // --- Verificação de Cliente Supabase ---
    if (typeof window.getSupabaseClient !== 'function') {
        console.error("ERRO CRÍTICO: getSupabaseClient não está definido. Verifique a inicialização no HTML.");
        alert("Erro crítico na configuração da aplicação (Reservas). Contacte o suporte.");
        document.querySelectorAll('.action-button').forEach(btn => btn.disabled = true);
        return;
    }
    const supabase = window.getSupabaseClient();
    if (!supabase) {
        console.error("ERRO CRÍTICO: Cliente Supabase não disponível (Reservas).");
        alert("Erro crítico ao conectar com o sistema (Reservas). Contacte o suporte.");
        document.querySelectorAll('.action-button').forEach(btn => btn.disabled = true);
        return;
    }

    let currentUser = null;
    let userProfile = null;

    // --- Seletores de Elementos DOM ---
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
    const statReservasHoraConteudoEl = document.getElementById("statReservasHoraConteudo");


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
    const loadingTableSpinnerEl = document.getElementById("loadingTableSpinner"); // Presumindo que existe um spinner para a tabela

    const reservaFormModalEl = document.getElementById("reservaFormModal");
    const reservaFormModalTitleEl = document.getElementById("reservaFormModalTitle");
    const reservaFormEl = document.getElementById("reservaForm");
    const reservaFormIdEl = document.getElementById("reservaFormId"); 
    const resFecharModalBtns = document.querySelectorAll(".resFecharModalBtn");
    
    const reservaLogModalEl = document.getElementById("reservaLogModal");
    const logReservaBookingIdEl = document.getElementById("logReservaBookingId");
    const reservaLogTableBodyEl = document.getElementById("reservaLogTableBody");
    const reservaLogNenhumaMsgEl = document.getElementById("reservaLogNenhumaMsg");
    const resFecharLogModalBtns = document.querySelectorAll(".resFecharLogModalBtn");

    const voltarDashboardBtnReservasEl = document.getElementById("voltarDashboardBtnReservas");


    // Mapeamento dos campos do formulário para chaves de dados (simplificado)
    // Os IDs no HTML devem corresponder a estes (ex: id="reservaFormBookingId")
    const formFieldsIds = {
        booking_id: "reservaFormBookingId", data_reserva: "reservaFormDataReserva",
        nome_cliente: "reservaFormNomeCliente", email_cliente: "reservaFormEmailCliente",
        telefone_cliente: "reservaFormTelefoneCliente", matricula: "reservaFormMatricula",
        alocation: "reservaFormAlocation", check_in_datetime: "reservaFormDataEntrada",
        check_out_datetime: "reservaFormDataSaida", physical_park_name: "reservaFormParque", // Assumindo que este é o ID do select do parque
        campaign_name: "reservaFormCampanha", total_price: "reservaFormValor",
        estado_reserva: "reservaFormEstado", observacoes: "reservaFormObservacoes"
        // Adicionar outros campos do schema_final.md aqui se estiverem no formulário
    };


    // --- Estado da Aplicação ---
    let todasAsReservasGeral = []; 
    let paginaAtualLista = 1;
    const itensPorPaginaLista = 15;
    let totalReservasNaBD = 0;
    let graficoReservasHora, graficoReservasMensal;


    // --- Funções Utilitárias ---
    function formatarDataHora(dataISO) {
        if (!dataISO) return "N/A";
        try {
            return new Date(dataISO).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
        } catch (e) { return dataISO; }
    }
    function formatarDataParaInput(dataISO) {
        if (!dataISO) return "";
        try {
            const d = new Date(dataISO);
            // Formato YYYY-MM-DDTHH:MM
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (e) { return ""; }
    }
    function formatarMoeda(valor) {
        if (valor === null || valor === undefined || isNaN(parseFloat(valor))) return "0,00 €";
        return parseFloat(valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
    }
    function mostrarSpinner(elementId) { 
        const el = document.getElementById(elementId);
        if (el) el.classList.remove("hidden"); 
    }
    function esconderSpinner(elementId) { 
        const el = document.getElementById(elementId);
        if (el) el.classList.add("hidden");
    }
    
    // --- Lógica de Carregamento de Reservas (READ) ---
    async function carregarReservasDaLista(pagina = 1, filtros = {}) {
        if (!reservasTableBodyEl) {
            console.error("Elemento da tabela de reservas (tbody) não encontrado.");
            return;
        }
        mostrarSpinner("loadingTableSpinner"); // Usar um ID de spinner específico se houver
        reservasTableBodyEl.innerHTML = ""; 
        if(reservasNenhumaMsgEl) reservasNenhumaMsgEl.classList.add("hidden");

        const rangeFrom = (pagina - 1) * itensPorPaginaLista;
        const rangeTo = rangeFrom + itensPorPaginaLista - 1;

        let query = supabase.from("reservas").select("*", { count: "exact" });

        if (filtros.searchTerm) {
            query = query.or(`nome_cliente.ilike.%${filtros.searchTerm}%,matricula.ilike.%${filtros.searchTerm}%,booking_id.ilike.%${filtros.searchTerm}%,alocation.ilike.%${filtros.searchTerm}%`);
        }
        if (filtros.estado_reserva && filtros.estado_reserva !== "" && filtros.estado_reserva !== "Todos") {
            query = query.eq("estado_reserva", filtros.estado_reserva);
        }
        if (filtros.data_entrada_prevista) {
            query = query.gte("check_in_datetime", filtros.data_entrada_prevista + "T00:00:00");
        }
        if (filtros.cliente) {
            query = query.ilike("nome_cliente", `%${filtros.cliente}%`);
        }
        if (filtros.matricula) {
             query = query.ilike("matricula", `%${filtros.matricula}%`);
        }


        query = query.order("created_at", { ascending: false }).range(rangeFrom, rangeTo);

        try {
            const { data, error, count } = await query;

            if (error) throw error;

            todasAsReservasGeral = data; // Atualiza o cache local com os dados da página atual
            totalReservasNaBD = count;    // Total de registos que correspondem aos filtros

            if (data && data.length > 0) {
                data.forEach(reserva => {
                    const tr = document.createElement("tr");
                    tr.className = "border-b hover:bg-gray-50";
                    // Ajustar para usar os nomes corretos das colunas do Supabase
                    tr.innerHTML = `
                        <td class="py-3 px-4 text-xs">${reserva.booking_id || "N/A"}</td>
                        <td class="py-3 px-4 text-xs">${formatarDataHora(reserva.data_reserva)}</td>
                        <td class="py-3 px-4 text-xs">${reserva.nome_cliente || "N/A"}</td>
                        <td class="py-3 px-4 text-xs">${reserva.matricula || "N/A"}</td>
                        <td class="py-3 px-4 text-xs">${reserva.alocation || "N/A"}</td>
                        <td class="py-3 px-4 text-xs">${formatarDataHora(reserva.check_in_datetime)}</td>
                        <td class="py-3 px-4 text-xs">${formatarDataHora(reserva.check_out_datetime)}</td>
                        <td class="py-3 px-4 text-xs">${reserva.physical_park_name || reserva.parque_id || "N/A"}</td>
                        <td class="py-3 px-4 text-xs text-right">${formatarMoeda(reserva.total_price)}</td>
                        <td class="py-3 px-4 text-xs"><span class="px-2 py-1 text-xs font-semibold rounded-full ${getEstadoClass(reserva.estado_reserva)}">${reserva.estado_reserva || "N/A"}</span></td>
                        <td class="py-3 px-4 text-xs">
                            <button class="text-blue-600 hover:text-blue-800 editar-reserva-btn" data-id="${reserva.id}">Editar</button>
                            <button class="text-red-600 hover:text-red-800 apagar-reserva-btn ml-2" data-id="${reserva.id}">Apagar</button>
                            <button class="text-gray-600 hover:text-gray-800 log-reserva-btn ml-2" data-booking-id="${reserva.booking_id || reserva.id}" data-reserva-pk="${reserva.id}">Hist.</button>
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
            atualizarDashboardStatsGeral(); // Atualizar estatísticas gerais do dashboard
        } catch (error) {
            console.error("Erro ao carregar reservas:", error);
            if(reservasNenhumaMsgEl) {
                reservasNenhumaMsgEl.textContent = "Erro ao carregar dados. Tente novamente.";
                reservasNenhumaMsgEl.classList.remove("hidden");
            }
        } finally {
            esconderSpinner("loadingTableSpinner");
        }
    }
    
    function getEstadoClass(estado) {
        // Função auxiliar para classes de cor do estado
        switch (String(estado).toLowerCase()) {
            case 'confirmada': return 'bg-green-100 text-green-700';
            case 'pendente': return 'bg-yellow-100 text-yellow-700';
            case 'cancelada': return 'bg-red-100 text-red-700';
            case 'concluída': case 'validadafinanceiramente': return 'bg-blue-100 text-blue-700';
            case 'em curso': return 'bg-indigo-100 text-indigo-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    }

    // --- Lógica de Paginação ---
    function atualizarPaginacaoLista(paginaCorrente, totalItens) {
        if (!reservasPaginacaoEl) return;
        reservasPaginacaoEl.innerHTML = ""; 
        if (totalItens === 0) return;

        const totalPaginas = Math.ceil(totalItens / itensPorPaginaLista);
        if (totalPaginas <= 1) return;

        const criarBotao = (texto, pagina, desabilitado = false, ativo = false) => {
            const btn = document.createElement("button");
            btn.innerHTML = texto;
            btn.className = `px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed mx-0.5 ${ativo ? "bg-blue-500 text-white border-blue-500" : ""}`;
            btn.disabled = desabilitado;
            btn.addEventListener("click", () => carregarReservasDaLista(pagina, obterFiltrosAtuaisLista()));
            return btn;
        };

        reservasPaginacaoEl.appendChild(criarBotao("&laquo; Ant", paginaCorrente - 1, paginaCorrente === 1));

        // Lógica simplificada para mostrar algumas páginas
        let paginasAMostrar = [1, totalPaginas];
        for (let i = Math.max(2, paginaCorrente - 2); i <= Math.min(totalPaginas - 1, paginaCorrente + 2); i++) {
            if (!paginasAMostrar.includes(i)) paginasAMostrar.push(i);
        }
        paginasAMostrar.sort((a,b) => a-b);

        let ultimaPaginaMostrada = 0;
        paginasAMostrar.forEach(p => {
            if (ultimaPaginaMostrada > 0 && p > ultimaPaginaMostrada + 1) {
                const span = document.createElement("span");
                span.textContent = "...";
                span.className = "px-2 py-1 text-sm";
                reservasPaginacaoEl.appendChild(span);
            }
            reservasPaginacaoEl.appendChild(criarBotao(p, p, p === paginaCorrente, p === paginaCorrente));
            ultimaPaginaMostrada = p;
        });
        
        reservasPaginacaoEl.appendChild(criarBotao("Próx &raquo;", paginaCorrente + 1, paginaCorrente === totalPaginas));
    }
    
    function obterFiltrosAtuaisLista() {
        const filtros = {};
        if (resSearchTermEl && resSearchTermEl.value) filtros.searchTerm = resSearchTermEl.value.trim();
        if (resFiltroEstadoListaEl && resFiltroEstadoListaEl.value) filtros.estado_reserva = resFiltroEstadoListaEl.value;
        if (resFiltroDataEntradaListaEl && resFiltroDataEntradaListaEl.value) filtros.data_entrada_prevista = resFiltroDataEntradaListaEl.value;
        if (resFiltroClienteListaEl && resFiltroClienteListaEl.value) filtros.cliente = resFiltroClienteListaEl.value.trim();
        if (resFiltroMatriculaListaEl && resFiltroMatriculaListaEl.value) filtros.matricula = resFiltroMatriculaListaEl.value.trim();
        return filtros;
    }

    // --- Lógica de Criação e Edição de Reservas (CREATE/UPDATE) ---
    function abrirModalReserva(reserva = null) {
        if (!reservaFormModalEl || !reservaFormEl || !reservaFormIdEl || !reservaFormModalTitleEl) return;
        reservaFormEl.reset(); 
        reservaFormIdEl.value = ""; 

        if (reserva) {
            reservaFormModalTitleEl.textContent = "Editar Reserva";
            reservaFormIdEl.value = reserva.id; 
            
            for (const key in formFieldsIds) {
                const elementId = formFieldsIds[key];
                const inputElement = document.getElementById(elementId);
                if (inputElement && reserva[key] !== undefined) {
                    if (inputElement.type === "datetime-local") {
                        inputElement.value = formatarDataParaInput(reserva[key]);
                    } else if (inputElement.type === "checkbox") {
                        inputElement.checked = !!reserva[key];
                    } else {
                        inputElement.value = reserva[key] === null ? "" : reserva[key];
                    }
                }
            }
            // Campos que podem precisar de tratamento especial ou não estão no formFieldsIds
            if(document.getElementById("reservaFormParque") && reserva.physical_park_name) document.getElementById("reservaFormParque").value = reserva.physical_park_name;
            if(document.getElementById("reservaFormValor") && reserva.total_price !== null) document.getElementById("reservaFormValor").value = reserva.total_price;


        } else {
            reservaFormModalTitleEl.textContent = "Nova Reserva";
            if(document.getElementById(formFieldsIds.data_reserva)) document.getElementById(formFieldsIds.data_reserva).value = formatarDataParaInput(new Date().toISOString());
            if(document.getElementById(formFieldsIds.estado_reserva)) document.getElementById(formFieldsIds.estado_reserva).value = "Confirmada";
        }
        reservaFormModalEl.classList.add("active");
        reservaFormModalEl.classList.remove("hidden");
    }

    function fecharModalReserva() {
        if(reservaFormModalEl) {
            reservaFormModalEl.classList.remove("active");
            reservaFormModalEl.classList.add("hidden");
        }
    }

    async function submeterFormularioReserva(event) {
        event.preventDefault();
        if (!currentUser || !supabase) {
            alert("Não autenticado ou cliente Supabase não disponível.");
            return;
        }

        const idReserva = reservaFormIdEl ? reservaFormIdEl.value : null;
        const dadosFormulario = {};

        for (const key in formFieldsIds) {
            const element = document.getElementById(formFieldsIds[key]);
            if (element) {
                if (element.type === "checkbox") {
                    dadosFormulario[key] = element.checked;
                } else if (element.value !== "") {
                    if (["total_price", "parking_price", "delivery_price"].includes(key)) { // Adicionar outros campos numéricos aqui
                        dadosFormulario[key] = parseFloat(element.value) || null;
                    } else if (element.type === 'datetime-local' && element.value) {
                        dadosFormulario[key] = new Date(element.value).toISOString();
                    }
                     else {
                        dadosFormulario[key] = element.value;
                    }
                } else {
                    dadosFormulario[key] = null; 
                }
            }
        }
        
        if (!idReserva && !dadosFormulario.booking_id) { // Se for nova e não tiver Booking ID
            dadosFormulario.booking_id = `MPK-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        }
        if (!idReserva) { // Apenas para novas reservas
            dadosFormulario.user_id_created = currentUser.id;
            dadosFormulario.created_at = new Date().toISOString();
        }
        dadosFormulario.user_id_last_modified = currentUser.id;
        dadosFormulario.updated_at = new Date().toISOString();
        dadosFormulario.last_update_source = "Interface Reservas";


        let resultado;
        try {
            if (idReserva) { 
                console.log("A atualizar reserva ID:", idReserva, "Dados:", dadosFormulario);
                const { data, error } = await supabase.from("reservas").update(dadosFormulario).eq("id", idReserva).select().single();
                resultado = { data, error };
            } else { 
                console.log("A criar nova reserva. Dados:", dadosFormulario);
                const { data, error } = await supabase.from("reservas").insert(dadosFormulario).select().single();
                resultado = { data, error };
            }

            if (resultado.error) throw resultado.error;

            console.log("Reserva guardada com sucesso:", resultado.data);
            fecharModalReserva();
            await carregarReservasDaLista(idReserva ? paginaAtualLista : 1, obterFiltrosAtuaisLista()); 
            await registrarLogReserva(
                resultado.data.id, 
                idReserva ? 'Reserva Editada' : 'Nova Reserva Criada', 
                JSON.stringify(dadosFormulario) // Log dos dados completos
            );

        } catch (error) {
            console.error("Erro ao guardar reserva:", error);
            alert(`Erro ao guardar reserva: ${error.message}`);
        }
    }
    
    async function registrarLogReserva(reservaPk, descricao, detalhes = null, campoAlterado = null, valorAntigo = null, valorNovo = null) {
        if (!currentUser) return;
        try {
            await supabase.from('reservas_logs').insert({
                reserva_id: reservaPk,
                user_id: currentUser.id,
                user_email: currentUser.email, // Adicionar email do utilizador para referência
                descricao_alteracao: descricao,
                campo_alterado: campoAlterado,
                valor_antigo: valorAntigo,
                valor_novo: valorNovo,
                detalhes_alteracao: detalhes ? JSON.stringify(detalhes) : null,
                timestamp_alteracao: new Date().toISOString()
            });
        } catch (logError) {
            console.error("Erro ao registrar log da reserva:", logError);
        }
    }


    // --- Lógica de Eliminação de Reservas (DELETE) ---
    async function apagarReserva(idReserva) {
        if (!idReserva) return;
        if (!confirm("Tem a certeza que deseja apagar esta reserva permanentemente? Esta ação não pode ser desfeita.")) return;

        try {
            const { error } = await supabase.from("reservas").delete().eq("id", idReserva);
            if (error) throw error;

            console.log("Reserva apagada com sucesso.");
            await carregarReservasDaLista(paginaAtualLista, obterFiltrosAtuaisLista()); 
            // Não é comum registar log para deleção na mesma tabela de logs de alteração, mas pode ser feito
            // await registrarLogReserva(idReserva, 'Reserva Apagada', { id_apagado: idReserva });

        } catch (error) {
            console.error("Erro ao apagar reserva:", error);
            alert(`Erro ao apagar reserva: ${error.message}`);
        }
    }
    
    // --- Configurar Botões de Ação Dinâmicos (Editar/Apagar/Log) ---
    function configurarBotoesAcao() {
        document.querySelectorAll(".editar-reserva-btn").forEach(button => {
            button.removeEventListener("click", handleEditarReservaClick); 
            button.addEventListener("click", handleEditarReservaClick);
        });
        document.querySelectorAll(".apagar-reserva-btn").forEach(button => {
            button.removeEventListener("click", handleApagarReservaClick); 
            button.addEventListener("click", handleApagarReservaClick);
        });
        document.querySelectorAll(".log-reserva-btn").forEach(button => {
            button.removeEventListener("click", handleLogReservaClick);
            button.addEventListener("click", handleLogReservaClick);
        });
    }
    function handleEditarReservaClick(event) {
        const id = event.target.dataset.id;
        // Para edição, é melhor buscar os dados mais recentes do Supabase
        // em vez de usar o `todasAsReservasGeral` que pode estar desatualizado.
        const reservaParaEditar = todasAsReservasGeral.find(r => String(r.id) === String(id)); // Fallback se não buscar novamente
        if (reservaParaEditar) { // Idealmente, buscaria do Supabase aqui
            abrirModalReserva(reservaParaEditar);
        } else {
            console.error("Reserva não encontrada para edição com ID:", id);
            alert("Reserva não encontrada. Por favor, atualize a lista.");
        }
    }
    function handleApagarReservaClick(event) {
        const id = event.target.dataset.id;
        apagarReserva(id);
    }
    async function handleLogReservaClick(event) {
        const reservaPk = event.target.dataset.reservaPk; // Usar o PK da reserva
        const bookingId = event.target.dataset.bookingId;
        if (reservaPk) {
            await mostrarLogsReserva(reservaPk, bookingId);
        }
    }
    
    // --- Lógica de Importação ---
    async function processarFicheiroImportacao() {
        if (!importReservasFileEl || !resProcessarImportacaoBtnEl || !importacaoStatusEl || !loadingImportSpinnerEl) return;
        const ficheiro = importReservasFileEl.files[0];
        if (!ficheiro) {
            importacaoStatusEl.textContent = "Por favor, selecione um ficheiro.";
            importacaoStatusEl.className = "mt-4 text-sm text-red-600";
            return;
        }

        importacaoStatusEl.textContent = "A processar ficheiro...";
        importacaoStatusEl.className = "mt-4 text-sm text-blue-600";
        mostrarSpinner("loadingImportSpinner");
        resProcessarImportacaoBtnEl.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const dataArray = new Uint8Array(e.target.result);
                const workbook = XLSX.read(dataArray, { type: "array", cellDates: true });
                const nomePrimeiraFolha = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[nomePrimeiraFolha], { raw: false, defval: null });

                if (jsonData.length === 0) throw new Error("O ficheiro está vazio ou não foi possível ler os dados.");
                
                const { data: { user: importUser } } = await supabase.auth.getUser(); // Obter o utilizador que está a importar

                // Mapeamento mais robusto e adaptado ao schema_final.md
                const mapeamentoColunas = {
                    // Coluna no Excel : Coluna no Supabase
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
                    "checkOut": "check_out_datetime", "email": "email_cliente",
                    "Booking ID": "booking_id_excel" // Se o Booking ID vier do Excel e for diferente do gerado
                };
                
                const reservasParaUpsert = jsonData.map(row => {
                    const reservaSupabase = {};
                    for (const excelCol in mapeamentoColunas) {
                        if (row[excelCol] !== undefined && row[excelCol] !== null) {
                            const supabaseCol = mapeamentoColunas[excelCol];
                            // Tratamento de Datas
                            if (["data_reserva", "check_in_datetime", "check_out_datetime", "last_action_date"].includes(supabaseCol)) {
                                if (row[excelCol] instanceof Date) {
                                    reservaSupabase[supabaseCol] = row[excelCol].toISOString();
                                } else if (typeof row[excelCol] === 'number') { // Data do Excel como número
                                    reservaSupabase[supabaseCol] = new Date(XLSX.SSF.format("yyyy-mm-dd hh:mm:ss", row[excelCol])).toISOString();
                                } else if (typeof row[excelCol] === 'string' && !isNaN(new Date(row[excelCol]).getTime())) {
                                    reservaSupabase[supabaseCol] = new Date(row[excelCol]).toISOString();
                                } else {
                                    reservaSupabase[supabaseCol] = null; // Data inválida
                                }
                            } 
                            // Tratamento de Booleanos
                            else if (["has_online_payment", "is_imported", "terms_agreed"].includes(supabaseCol)) {
                                reservaSupabase[supabaseCol] = ['true', '1', 'sim', 'yes', true].includes(String(row[excelCol]).toLowerCase());
                            }
                            // Tratamento de Números (total_price, parking_price, delivery_price)
                            else if (["total_price", "parking_price", "delivery_price"].includes(supabaseCol)) {
                                const valorLimpo = String(row[excelCol]).replace(/[^0-9.,-]/g, '').replace(',', '.');
                                reservaSupabase[supabaseCol] = parseFloat(valorLimpo);
                                if (isNaN(reservaSupabase[supabaseCol])) reservaSupabase[supabaseCol] = null;
                            }
                            else {
                                reservaSupabase[supabaseCol] = row[excelCol];
                            }
                        }
                    }

                    // Combinar nome e apelido
                    let nomeCompleto = "";
                    if (reservaSupabase.nome_cliente_primeiro) nomeCompleto += reservaSupabase.nome_cliente_primeiro;
                    if (reservaSupabase.nome_cliente_ultimo) nomeCompleto += (nomeCompleto ? " " : "") + reservaSupabase.nome_cliente_ultimo;
                    reservaSupabase.nome_cliente = nomeCompleto.trim() || null;
                    delete reservaSupabase.nome_cliente_primeiro;
                    delete reservaSupabase.nome_cliente_ultimo;

                    // Gerar booking_id se não vier do Excel ou se for para ser gerado sempre
                    if (!reservaSupabase.booking_id_excel) { // Se não houver uma coluna "Booking ID" no Excel
                        reservaSupabase.booking_id = `IMP-${Date.now().toString().slice(-5)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
                    } else {
                        reservaSupabase.booking_id = reservaSupabase.booking_id_excel; // Usar o do Excel
                    }
                    delete reservaSupabase.booking_id_excel;


                    reservaSupabase.user_id_created = importUser ? importUser.id : null;
                    reservaSupabase.created_at = new Date().toISOString();
                    reservaSupabase.updated_at = new Date().toISOString();
                    reservaSupabase.user_id_last_modified = importUser ? importUser.id : null;
                    reservaSupabase.is_imported = true;
                    reservaSupabase.last_update_source = 'Import Excel Reservas';
                    
                    // Garantir que chaves de conflito (matricula, alocation) existem
                    if (!reservaSupabase.matricula || !reservaSupabase.alocation) {
                        console.warn("Reserva ignorada por falta de matrícula ou alocation:", reservaSupabase);
                        return null; // Ignorar esta reserva
                    }
                    reservaSupabase.matricula = normalizarMatricula(reservaSupabase.matricula);


                    return reservaSupabase;
                }).filter(Boolean); // Remover nulos (reservas ignoradas)

                console.log("Reservas para Upsert:", reservasParaUpsert);

                if (reservasParaUpsert.length > 0) {
                    // Usar UPSERT: se a combinação matricula + alocation já existir, atualiza. Senão, insere.
                    const { data: upsertedData, error: upsertError } = await supabase
                        .from("reservas")
                        .upsert(reservasParaUpsert, { 
                            onConflict: 'matricula,alocation', // Colunas para verificar conflito
                            ignoreDuplicates: false // Atualiza se houver conflito
                        })
                        .select();

                    if (upsertError) throw upsertError;
                    
                    importacaoStatusEl.textContent = `${upsertedData.length} reservas importadas/atualizadas com sucesso!`;
                    importacaoStatusEl.className = "mt-4 text-sm text-green-600";
                    await carregarReservasDaLista(1, obterFiltrosAtuaisLista()); 
                } else {
                    importacaoStatusEl.textContent = "Nenhuma reserva válida encontrada no ficheiro para processar.";
                    importacaoStatusEl.className = "mt-4 text-sm text-yellow-600";
                }

            } catch (err) {
                console.error("Erro ao processar o ficheiro Excel:", err);
                importacaoStatusEl.textContent = `Erro ao ler ficheiro: ${err.message}`;
                importacaoStatusEl.className = "mt-4 text-sm text-red-600";
            } finally {
                esconderSpinner("loadingImportSpinner");
                if(resProcessarImportacaoBtnEl) resProcessarImportacaoBtnEl.disabled = false;
                if(importReservasFileEl) importReservasFileEl.value = ""; 
            }
        };
        reader.onerror = () => {
            console.error("Erro ao ler o ficheiro.");
            importacaoStatusEl.textContent = "Erro ao ler o ficheiro selecionado.";
            importacaoStatusEl.className = "mt-4 text-sm text-red-600";
            esconderSpinner("loadingImportSpinner");
            if(resProcessarImportacaoBtnEl) resProcessarImportacaoBtnEl.disabled = false;
            if(importReservasFileEl) importReservasFileEl.value = "";
        };
        reader.readAsArrayBuffer(ficheiro);
    }

    // --- Lógica de Exportação ---
    async function exportarReservasParaExcel() {
        mostrarSpinner("loadingTableSpinner"); 
        try {
            // Obter todas as reservas (ou com filtros atuais)
            const { data: todasAsReservas, error } = await supabase
                .from("reservas")
                .select("*") 
                .order("created_at", { ascending: false });
            
            if (error) throw error;

            if (!todasAsReservas || todasAsReservas.length === 0) {
                alert("Não há dados para exportar.");
                return;
            }
            const worksheet = XLSX.utils.json_to_sheet(todasAsReservas);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Reservas");
            XLSX.writeFile(workbook, `export_reservas_${new Date().toISOString().slice(0,10)}.xlsx`);

        } catch (error) {
            console.error("Erro ao obter dados para exportação:", error);
            alert("Erro ao exportar dados. Tente novamente.");
        } finally {
            esconderSpinner("loadingTableSpinner");
        }
    }

    // --- Lógica do Dashboard ---
    async function atualizarDashboardStatsGeral() {
        if (!supabase) return;
        try {
            // Total de Reservas (geral)
            const { count, error: countError } = await supabase
                .from('reservas')
                .select('*', { count: 'exact', head: true }); // Apenas conta, sem buscar dados
            if (countError) throw countError;
            if (statTotalReservasEl) statTotalReservasEl.textContent = count || 0;

            // Valor Total Estimado (geral)
            const { data: sumData, error: sumError } = await supabase
                .from('reservas')
                .select('total_price'); // Buscar todos os preços para somar no cliente
            
            if (sumError) throw sumError;

            let valorTotalEstimado = 0;
            if (sumData) {
                valorTotalEstimado = sumData.reduce((acc, item) => acc + (parseFloat(item.total_price) || 0), 0);
            }
            if (statValorTotalReservasEl) statValorTotalReservasEl.textContent = formatarMoeda(valorTotalEstimado);

        } catch (error) {
            console.error("Erro ao atualizar estatísticas gerais do dashboard:", error);
        }
    }
    
    async function aplicarFiltrosDashboardEAtualizar() {
        if (!resDashboardFiltroDataInicioEl || !resDashboardFiltroDataFimEl || !resDashboardFiltroPeriodoEl) return;
    
        let dataInicio = resDashboardFiltroDataInicioEl.value;
        let dataFim = resDashboardFiltroDataFimEl.value;
        const periodoSelecionado = resDashboardFiltroPeriodoEl.value;
    
        const hoje = new Date();
        const hojeISO = hoje.toISOString().split('T')[0];
    
        if (periodoSelecionado !== "personalizado") {
            resDashboardFiltroDataInicioEl.disabled = true;
            resDashboardFiltroDataFimEl.disabled = true;
            let inicio = new Date();
            let fim = new Date();
    
            switch (periodoSelecionado) {
                case "hoje":
                    inicio = new Date(hoje.setHours(0, 0, 0, 0));
                    fim = new Date(hoje.setHours(23, 59, 59, 999));
                    break;
                case "semana_atual":
                    const primeiroDiaSemana = hoje.getDate() - hoje.getDay() + (hoje.getDay() === 0 ? -6 : 1); // Ajuste para segunda-feira
                    inicio = new Date(hoje.setDate(primeiroDiaSemana));
                    inicio.setHours(0,0,0,0);
                    fim = new Date(inicio);
                    fim.setDate(inicio.getDate() + 6);
                    fim.setHours(23,59,59,999);
                    break;
                case "mes_atual":
                    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                    fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);
                    break;
                case "ultimos_30dias":
                    fim = new Date(hoje.setHours(23, 59, 59, 999));
                    inicio = new Date();
                    inicio.setDate(hoje.getDate() - 30);
                    inicio.setHours(0,0,0,0);
                    break;
                case "este_ano":
                    inicio = new Date(hoje.getFullYear(), 0, 1);
                    fim = new Date(hoje.getFullYear(), 11, 31, 23, 59, 59, 999);
                    break;
            }
            dataInicio = inicio.toISOString().split('T')[0];
            dataFim = fim.toISOString().split('T')[0];
            resDashboardFiltroDataInicioEl.value = dataInicio;
            resDashboardFiltroDataFimEl.value = dataFim;
        } else {
            resDashboardFiltroDataInicioEl.disabled = false;
            resDashboardFiltroDataFimEl.disabled = false;
            if (!dataInicio || !dataFim) {
                alert("Para período personalizado, selecione data de início e fim.");
                return;
            }
        }
        if (new Date(dataInicio) > new Date(dataFim)) {
            alert("A data de início não pode ser posterior à data de fim.");
            return;
        }
    
        console.log(`Analisando período: ${dataInicio} a ${dataFim}`);
        await carregarEstatisticasDashboardFiltradas(dataInicio, dataFim);
    }
    
    async function carregarEstatisticasDashboardFiltradas(dataInicio, dataFim) {
        if (!supabase) return;
        const inicioISO = dataInicio ? new Date(dataInicio + "T00:00:00.000Z").toISOString() : null;
        const fimISO = dataFim ? new Date(dataFim + "T23:59:59.999Z").toISOString() : null;
    
        if (!inicioISO || !fimISO) {
            if (statTotalReservasPeriodoEl) statTotalReservasPeriodoEl.textContent = "Selecione um período";
            if (statValorTotalReservasPeriodoEl) statValorTotalReservasPeriodoEl.textContent = "Selecione um período";
            return;
        }
    
        try {
            // Contagem de reservas no período
            const { count, error: countErr } = await supabase.from('reservas')
                .select('*', { count: 'exact', head: true })
                .gte('data_reserva', inicioISO)
                .lte('data_reserva', fimISO);
            if (countErr) throw countErr;
            if (statTotalReservasPeriodoEl) statTotalReservasPeriodoEl.textContent = `${count || 0} (no período)`;
    
            // Soma do valor_reserva no período
            const { data: sumData, error: sumErr } = await supabase.from('reservas')
                .select('total_price')
                .gte('data_reserva', inicioISO)
                .lte('data_reserva', fimISO);
            if (sumErr) throw sumErr;
            let valorTotalPeriodo = 0;
            if (sumData) {
                valorTotalPeriodo = sumData.reduce((acc, item) => acc + (parseFloat(item.total_price) || 0), 0);
            }
            if (statValorTotalReservasPeriodoEl) statValorTotalReservasPeriodoEl.textContent = `${formatarMoeda(valorTotalPeriodo)} (no período)`;
    
            // Reservas por campanha (no período)
            const { data: campData, error: campErr } = await supabase
                .from('reservas')
                .select('campaign_name, count:id') // Supabase não tem groupBy direto no client, precisa de RPC ou processar no cliente
                .gte('data_reserva', inicioISO)
                .lte('data_reserva', fimISO)
                .not('campaign_name', 'is', null); // Ignorar campanhas nulas
            if (campErr) throw campErr;
            
            const contagemCampanhas = {};
            if (campData) {
                campData.forEach(item => {
                    contagemCampanhas[item.campaign_name] = (contagemCampanhas[item.campaign_name] || 0) + 1;
                });
            }
            let campHtml = Object.entries(contagemCampanhas).map(([nome, num]) => `${nome}: ${num}`).join('<br>') || "Nenhuma";
            if (statReservasCampanhaEl) statReservasCampanhaEl.innerHTML = campHtml;
    
            // Reservas por dia da semana (no período)
            const { data: diaSemanaData, error: diaSemanaErr } = await supabase
                .from('reservas')
                .select('data_reserva')
                .gte('data_reserva', inicioISO)
                .lte('data_reserva', fimISO);
            if (diaSemanaErr) throw diaSemanaErr;

            const diasDaSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
            const contagemDias = Array(7).fill(0);
            if (diaSemanaData) {
                diaSemanaData.forEach(item => {
                    const dia = new Date(item.data_reserva).getDay();
                    contagemDias[dia]++;
                });
            }
            let diaSemanaHtml = diasDaSemana.map((dia, i) => `${dia}: ${contagemDias[i]}`).join(' | ');
            if (statReservasDiaSemanaEl) statReservasDiaSemanaEl.innerHTML = diaSemanaHtml;

            // Atualizar gráfico mensal (simplificado, apenas para o ano do período)
            if (graficoReservasMensal) {
                 const anoInicio = new Date(dataInicio).getFullYear();
                 const anoFim = new Date(dataFim).getFullYear();
                 // Para simplificar, pegamos o primeiro ano do período se for um intervalo.
                 // Uma lógica mais complexa seria necessária para múltiplos anos.
                 const anoParaGrafico = anoInicio; 
                 
                 const { data: mensalData, error: mensalErr } = await supabase.rpc('contar_reservas_por_mes_no_ano', { ano_param: anoParaGrafico });
                 if (mensalErr) throw mensalErr;

                 const dataGraficoMensal = Array(12).fill(0);
                 if (mensalData) {
                     mensalData.forEach(item => {
                         if (item.mes >= 1 && item.mes <= 12) {
                             dataGraficoMensal[item.mes - 1] = item.total_reservas;
                         }
                     });
                 }
                 graficoReservasMensal.data.datasets[0].data = dataGraficoMensal;
                 graficoReservasMensal.data.datasets[0].label = `Reservas em ${anoParaGrafico}`;
                 graficoReservasMensal.update();
            }


        } catch (error) {
            console.error("Erro ao carregar estatísticas filtradas do dashboard:", error);
            if (statTotalReservasPeriodoEl) statTotalReservasPeriodoEl.textContent = "Erro";
        }
    }
    
    function setupGraficosReservas() {
        if (!chartReservasPorHoraEl || !chartReservasMensalEl) {
            console.warn("Elementos canvas para gráficos não encontrados.");
            return;
        }
        try {
            // Gráfico por Hora
            const ctxHora = chartReservasPorHoraEl.getContext('2d');
            if (graficoReservasHora) graficoReservasHora.destroy();
            graficoReservasHora = new Chart(ctxHora, {
                type: 'bar',
                data: { labels: [], datasets: [{ label: 'Nº de Reservas', data: [], backgroundColor: 'rgba(54, 162, 235, 0.6)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });

            // Gráfico Mensal
            const ctxMensal = chartReservasMensalEl.getContext('2d');
            if(graficoReservasMensal) graficoReservasMensal.destroy();
            graficoReservasMensal = new Chart(ctxMensal, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
                    datasets: [{
                        label: 'Total de Reservas por Mês', data: Array(12).fill(0),
                        borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        fill: true, tension: 0.1
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
        } catch(e) {
            console.error("Erro ao configurar gráficos de Reservas:", e);
        }
    }

    async function carregarReservasPorHora(dataSelecionada) {
        if (!graficoReservasHora || !statReservasHoraConteudoEl || !resDashboardDataHoraDisplayEl) return;
        
        resDashboardDataHoraDisplayEl.textContent = new Date(dataSelecionada + "T00:00:00").toLocaleDateString('pt-PT'); // Adicionar T00:00:00 para evitar problemas de fuso horário na formatação
        statReservasHoraConteudoEl.textContent = "A carregar...";

        try {
            const { data, error } = await supabase.rpc('contar_reservas_por_hora_no_dia', { dia_param: dataSelecionada });
            if (error) throw error;

            const labelsHora = Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`);
            const dataHora = Array(24).fill(0);
            let totalNoDia = 0;

            if (data) {
                data.forEach(item => {
                    if (item.hora >= 0 && item.hora <= 23) {
                        dataHora[item.hora] = item.total_reservas;
                        totalNoDia += item.total_reservas;
                    }
                });
            }
            
            graficoReservasHora.data.labels = labelsHora;
            graficoReservasHora.data.datasets[0].data = dataHora;
            graficoReservasHora.update();
            statReservasHoraConteudoEl.textContent = `Total: ${totalNoDia} reservas neste dia.`;

        } catch (error) {
            console.error("Erro ao carregar reservas por hora:", error);
            statReservasHoraConteudoEl.textContent = "Erro ao carregar dados.";
        }
    }
    
    // --- Modal de Logs ---
    async function mostrarLogsReserva(reservaPk, bookingIdParaDisplay) {
        if (!reservaLogModalEl || !reservaLogTableBodyEl || !reservaLogNenhumaMsgEl || !logReservaBookingIdEl) return;
        
        logReservaBookingIdEl.textContent = `(${bookingIdParaDisplay || reservaPk})`;
        reservaLogTableBodyEl.innerHTML = '<tr><td colspan="6" class="text-center py-4">A carregar histórico...</td></tr>';
        reservaLogNenhumaMsgEl.classList.add('hidden');
        reservaLogModalEl.classList.add('active');
        reservaLogModalEl.classList.remove('hidden');

        try {
            const { data: logs, error } = await supabase
                .from('reservas_logs')
                .select('*')
                .eq('reserva_id', reservaPk) // Filtrar pelo PK da reserva
                .order('timestamp_alteracao', { ascending: false });

            if (error) throw error;

            reservaLogTableBodyEl.innerHTML = '';
            if (logs && logs.length > 0) {
                logs.forEach(log => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="py-2 px-3 text-xs">${formatarDataHora(log.timestamp_alteracao)}</td>
                        <td class="py-2 px-3 text-xs">${log.user_email || log.user_id || 'Sistema'}</td>
                        <td class="py-2 px-3 text-xs">${log.descricao_alteracao || 'N/A'}</td>
                        <td class="py-2 px-3 text-xs">${log.campo_alterado || '-'}</td>
                        <td class="py-2 px-3 text-xs">${log.valor_antigo !== null ? String(log.valor_antigo).substring(0,50) : '-'}</td>
                        <td class="py-2 px-3 text-xs">${log.valor_novo !== null ? String(log.valor_novo).substring(0,50) : '-'}</td>
                    `;
                    reservaLogTableBodyEl.appendChild(tr);
                });
            } else {
                reservaLogNenhumaMsgEl.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Erro ao carregar histórico da reserva:", error);
            reservaLogTableBodyEl.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-red-500">Erro ao carregar histórico.</td></tr>';
        }
    }

    function fecharModalLogReserva() {
        if(reservaLogModalEl) {
            reservaLogModalEl.classList.remove('active');
            reservaLogModalEl.classList.add('hidden');
        }
    }


    // --- Event Listeners ---
    if (resProcessarImportacaoBtnEl) { // Botão de importar
        resProcessarImportacaoBtnEl.addEventListener("click", processarFicheiroImportacao);
    } else {
        console.warn("Botão de processar importação não encontrado.");
    }
    
    if (importReservasFileEl) { // Input de ficheiro
         // Não é necessário um listener de 'change' se o botão 'Processar' é usado.
         // Se quiser auto-processar ao selecionar:
         // importReservasFileEl.addEventListener("change", processarFicheiroImportacao);
    } else {
        console.warn("Input de ficheiro para importação não encontrado.");
    }


    if (resAbrirModalNovaBtnEl) {
        resAbrirModalNovaBtnEl.addEventListener("click", () => abrirModalReserva(null));
    }

    resFecharModalBtns.forEach(btn => btn.addEventListener("click", fecharModalReserva));
    resFecharLogModalBtns.forEach(btn => btn.addEventListener("click", fecharModalLogReserva));


    if (reservaFormEl) {
        reservaFormEl.addEventListener("submit", submeterFormularioReserva);
    }

    if (resExportarBtnEl) {
        resExportarBtnEl.addEventListener("click", exportarReservasParaExcel);
    }
    
    if (resSearchBtnEl && resSearchTermEl) {
        resSearchBtnEl.addEventListener("click", () => carregarReservasDaLista(1, obterFiltrosAtuaisLista()));
        resSearchTermEl.addEventListener("keypress", (e) => {
            if (e.key === "Enter") carregarReservasDaLista(1, obterFiltrosAtuaisLista());
        });
    }
    if (resAplicarFiltrosListaBtnEl) { 
        resAplicarFiltrosListaBtnEl.addEventListener("click", () => carregarReservasDaLista(1, obterFiltrosAtuaisLista()));
    }

    if (resAplicarFiltrosDashboardBtnEl) { 
        resAplicarFiltrosDashboardBtnEl.addEventListener("click", aplicarFiltrosDashboardEAtualizar);
    }
    if (resDashboardFiltroPeriodoEl) {
        resDashboardFiltroPeriodoEl.addEventListener('change', aplicarFiltrosDashboardEAtualizar);
    }

    if (resDashboardDataHoraInputEl) {
        resDashboardDataHoraInputEl.addEventListener('change', function() {
            if (this.value) {
                carregarReservasPorHora(this.value);
            }
        });
    }
    
    if (voltarDashboardBtnReservasEl) {
        voltarDashboardBtnReservasEl.addEventListener('click', () => {
            window.location.href = 'index.html'; // Redireciona para a página principal
        });
    }


    // --- Inicialização da Página ---
    async function initReservasPage() {
        // Garantir que a autenticação foi verificada e o perfil está disponível
        if (typeof window.checkAuthStatus === 'function') {
            await window.checkAuthStatus(); 
        } else {
            console.warn("Função checkAuthStatus não encontrada. A autenticação pode não funcionar corretamente.");
            // Considerar redirecionar para login se checkAuthStatus for essencial e não estiver definido
            // window.location.href = 'index.html';
            // return;
        }
        
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            console.error("Erro ao obter utilizador ou utilizador não autenticado em reservas.js:", authError);
            // auth_global.js deve ter tratado o redirecionamento, mas como fallback:
            // window.location.href = 'index.html'; 
            return;
        }
        currentUser = authUser;
        userProfile = JSON.parse(localStorage.getItem('userProfile')); // Assumindo que auth_global.js preenche isto

        if (!userProfile) {
            console.warn("Perfil do utilizador não encontrado no localStorage (Reservas). Algumas funcionalidades podem ser limitadas.");
        }

        console.log("Subaplicação Reservas Inicializada!");
        setupGraficosReservas(); 
        await carregarReservasDaLista(); 
        await aplicarFiltrosDashboardEAtualizar(); // Carrega dashboard com período padrão
        
        // Definir data padrão para o seletor de "Reservas por Hora"
        if (resDashboardDataHoraInputEl) {
            resDashboardDataHoraInputEl.value = new Date().toISOString().split('T')[0];
            // Disparar o evento change para carregar o gráfico para o dia atual
            resDashboardDataHoraInputEl.dispatchEvent(new Event('change'));
        }
    }

    // Atrasar a inicialização para dar tempo a auth_global.js
    setTimeout(() => {
        initReservasPage();
    }, 250);

});

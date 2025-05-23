// js/tarefas.js - Lógica para a Subaplicação de Gestão de Tarefas

document.addEventListener("DOMContentLoaded", () => {
    if (typeof checkAuthStatus !== "function" || typeof supabase === "undefined") {
        console.error("Supabase client ou auth_global.js não carregados para Tarefas.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem("userProfile")); 

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById("voltarDashboardBtnTarefas");
    const tarefaFiltroUserEl = document.getElementById("tarefaFiltroUser");
    const tarefaFiltroEstadoEl = document.getElementById("tarefaFiltroEstado");
    const tarefaFiltroPrioridadeEl = document.getElementById("tarefaFiltroPrioridade");
    const tarefaFiltroPrazoDeEl = document.getElementById("tarefaFiltroPrazoDe");
    const tarefaFiltroPrazoAteEl = document.getElementById("tarefaFiltroPrazoAte");
    const tarefaAplicarFiltrosBtnEl = document.getElementById("tarefaAplicarFiltrosBtn");
    const tarefaNovaBtnEl = document.getElementById("tarefaNovaBtn");
    const tarefaViewModeEl = document.getElementById("tarefaViewMode");
    const loadingTarefasSpinnerEl = document.getElementById("loadingTarefasSpinner");

    const tarefasViewListaEl = document.getElementById("tarefasViewLista");
    const tarefasTableBodyEl = document.getElementById("tarefasTableBody");
    const tarefasListaNenhumaMsgEl = document.getElementById("tarefasListaNenhumaMsg");
    const tarefasListaPaginacaoEl = document.getElementById("tarefasListaPaginacao");

    const tarefasViewKanbanEl = document.getElementById("tarefasViewKanban");
    const kanbanBoardEl = document.getElementById("kanbanBoard");

    const tarefasViewCalendarioEl = document.getElementById("tarefasViewCalendario");
    const calendarContainerEl = document.getElementById("calendarContainer");

    // Modal
    const tarefaFormModalEl = document.getElementById("tarefaFormModal");
    const tarefaFormModalTitleEl = document.getElementById("tarefaFormModalTitle");
    const tarefaFormEl = document.getElementById("tarefaForm");
    const tarefaFormIdEl = document.getElementById("tarefaFormId");
    const tarefaFormTituloEl = document.getElementById("tarefaFormTitulo");
    const tarefaFormDescricaoEl = document.getElementById("tarefaFormDescricao");
    const tarefaFormAtribuidoAEl = document.getElementById("tarefaFormAtribuidoA");
    const tarefaFormPrazoEl = document.getElementById("tarefaFormPrazo");
    const tarefaFormPrioridadeEl = document.getElementById("tarefaFormPrioridade");
    const tarefaFormEstadoModalEl = document.getElementById("tarefaFormEstadoModal");
    const tarefaFormParqueEl = document.getElementById("tarefaFormParque");
    const tarefaFormProjetoModalEl = document.getElementById("tarefaFormProjetoModal");
    const tarefaFormRecorrenciaTipoEl = document.getElementById("tarefaFormRecorrenciaTipo");
    const recorrenciaConfigSemanalEl = document.getElementById("recorrenciaConfigSemanal");
    const recorrenciaConfigMensalEl = document.getElementById("recorrenciaConfigMensal");
    const tarefaFormRecorrenciaDiaMesEl = document.getElementById("tarefaFormRecorrenciaDiaMes");
    const tarFecharModalBtns = document.querySelectorAll(".tarFecharModalBtn");

    // Detalhes Modal Selectors
    const tarefaDetalhesModalEl = document.getElementById("tarefaDetalhesModal");
    const tarefaDetalhesModalTitleEl = document.getElementById("tarefaDetalhesModalTitle");
    const tarefaDetalhesModalBodyEl = document.getElementById("tarefaDetalhesModalBody"); // Not directly used in provided funcs, but good to have
    const detalheTarefaTituloEl = document.getElementById("detalheTarefaTitulo");
    const detalheTarefaDescricaoEl = document.getElementById("detalheTarefaDescricao");
    const detalheTarefaAtribuidoAEl = document.getElementById("detalheTarefaAtribuidoA");
    const detalheTarefaPrazoEl = document.getElementById("detalheTarefaPrazo");
    const detalheTarefaPrioridadeEl = document.getElementById("detalheTarefaPrioridade");
    const detalheTarefaEstadoEl = document.getElementById("detalheTarefaEstado");
    const detalheTarefaProjetoEl = document.getElementById("detalheTarefaProjeto");
    const detalheTarefaParqueEl = document.getElementById("detalheTarefaParque");
    const detalheTarefaCriadorEl = document.getElementById("detalheTarefaCriador");
    const detalheTarefaCriadoEmEl = document.getElementById("detalheTarefaCriadoEm");
    const detalheTarefaModificadoEmEl = document.getElementById("detalheTarefaModificadoEm");
    const tarFecharDetalhesModalBtns = document.querySelectorAll(".tarFecharDetalhesModalBtn");


    // --- Estado da Aplicação ---
    let calendarInstance; // Added for FullCalendar
    let todasAsTarefas = [];
    let paginaAtualLista = 1;
    const itensPorPaginaLista = 15;
    let usuariosParaAtribuicao = []; 
    let todosOsUsuariosSistema = []; 
    let listaParquesGlob = [];
    let listaProjetosGlob = [];

    const KANBAN_COLUNAS = {
        "Pendente": { id: "col-pendente", title: "📝 Pendente", tasks: [] },
        "Em Progresso": { id: "col-progresso", title: "⏳ Em Progresso", tasks: [] },
        "Concluída": { id: "col-concluida", title: "✅ Concluída", tasks: [] },
        "Bloqueada": { id: "col-bloqueada", title: "🚫 Bloqueada", tasks: [] }
    };


    // --- Funções Auxiliares ---
    function formatarDataHora(dataISO, apenasData = false) {
        if (!dataISO) return "N/A";
        const options = { year: "numeric", month: "2-digit", day: "2-digit" };
        if (!apenasData) {
            options.hour = "2-digit";
            options.minute = "2-digit";
        }
        try { return new Date(dataISO).toLocaleString("pt-PT", options); }
        catch (e) { return dataISO; }
    }
    function mostrarSpinner(show = true) { loadingTarefasSpinnerEl.style.display = show ? "block" : "none"; }

    // --- Carregar Dados Iniciais (Utilizadores, Parques, Projetos) ---
    async function carregarDadosIniciaisParaFiltrosEForm() {
        // Carregar todos os utilizadores para filtros e atribuição (depois filtrar por permissão)
        const { data: usersData, error: usersError } = await supabase.from("profiles").select("id, full_name, username, role, reporta_a_user_id");
        if (usersError) console.error("Erro ao carregar utilizadores:", usersError);
        else todosOsUsuariosSistema = usersData || [];

        // Carregar Parques
        const { data: parquesData, error: parquesError } = await supabase.from("parques").select("id, nome");
        if (parquesError) console.error("Erro ao carregar parques:", parquesError);
        else listaParquesGlob = parquesData || [];

        // Carregar Projetos
        const { data: projetosData, error: projetosError } = await supabase.from("projetos").select("id, nome");
        if (projetosError) console.error("Erro ao carregar projetos:", projetosError);
        else listaProjetosGlob = projetosData || [];

        popularSelectUtilizadores();
        popularSelectParques();
        popularSelectProjetos();
    }

    function popularSelectUtilizadores() {
        // Popular filtro de utilizador
        tarefaFiltroUserEl.innerHTML = `
            <option value="minhas">Minhas Tarefas</option>
            <option value="todas_subordinados">Minhas e Subordinados</option>
            <option value="todas_geral">Todas (se permissão)</option> 
        `;
        todosOsUsuariosSistema.forEach(u => {
            if (userProfile.role === "super_admin" || u.id === currentUser.id ) {
                const opt = document.createElement("option");
                opt.value = u.id;
                opt.textContent = u.full_name || u.username;
                tarefaFiltroUserEl.appendChild(opt);
            }
        });
        
        usuariosParaAtribuicao = todosOsUsuariosSistema.filter(u => {
            if (userProfile.role === "super_admin") return true;
            if (userProfile.role === "admin") return u.role !== "super_admin";
            if (userProfile.role === "supervisor") return u.role !== "super_admin" && u.role !== "admin";
            return u.id === currentUser.id; 
        });

        tarefaFormAtribuidoAEl.innerHTML = "<option value=\"\">Selecione Utilizador</option>";
        usuariosParaAtribuicao.forEach(u => {
            const opt = document.createElement("option");
            opt.value = u.id;
            opt.textContent = u.full_name || u.username;
            tarefaFormAtribuidoAEl.appendChild(opt);
        });
        const selfOption = tarefaFormAtribuidoAEl.querySelector(`option[value="${currentUser.id}"]`);
        if (selfOption) selfOption.selected = true;

    }
    function popularSelectParques() {
        tarefaFormParqueEl.innerHTML = "<option value=\"\">Nenhum</option>";
        listaParquesGlob.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = p.nome;
            tarefaFormParqueEl.appendChild(opt);
        });
    }
    function popularSelectProjetos() {
        [tarefaFormProjetoModalEl ].forEach(select => {
            if (!select) return;
            select.innerHTML = "<option value=\"\">Nenhum</option>";
            listaProjetosGlob.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p.id;
                opt.textContent = p.nome;
                select.appendChild(opt);
            });
        });
    }


    // --- Lógica de Tarefas (CRUD e Visualização) ---
    async function carregarTarefas() {
        mostrarSpinner();
        const filtroUserSelecionado = tarefaFiltroUserEl.value;
        const estado = tarefaFiltroEstadoEl.value;
        const prioridade = tarefaFiltroPrioridadeEl.value;
        const prazoDe = tarefaFiltroPrazoDeEl.value;
        const prazoAte = tarefaFiltroPrazoAteEl.value;

        let query = supabase.from("tarefas").select(`
            *,
            user_criador:profiles!tarefas_user_id_criador_fkey(full_name, username),
            user_atribuido:profiles!tarefas_user_id_atribuido_a_fkey(full_name, username),
            projeto:projetos(nome),
            parque:parques(nome)
        `, { count: "exact" });

        if (filtroUserSelecionado === "minhas") {
            query = query.eq("user_id_atribuido_a", currentUser.id);
        } else if (filtroUserSelecionado === "todas_subordinados") {
            query = query.or(`user_id_atribuido_a.eq.${currentUser.id},user_id_criador.eq.${currentUser.id}`);
        } else if (filtroUserSelecionado && filtroUserSelecionado !== "todas_geral") {
            query = query.eq("user_id_atribuido_a", filtroUserSelecionado);
        } else if (filtroUserSelecionado === "todas_geral" && userProfile.role !== "super_admin") {
             query = query.or(`user_id_atribuido_a.eq.${currentUser.id},user_id_criador.eq.${currentUser.id}`);
        }

        if (estado) query = query.eq("estado", estado);
        if (prioridade) query = query.eq("prioridade", prioridade);
        if (prazoDe) query = query.gte("data_prazo", prazoDe + "T00:00:00");
        if (prazoAte) query = query.lte("data_prazo", prazoAte + "T23:59:59");

        const offset = (paginaAtualLista - 1) * itensPorPaginaLista;
        query = query.order("data_prazo", { ascending: true, nullsFirst: false })
                     .order("created_at", { ascending: false })
                     .range(offset, offset + itensPorPaginaLista - 1);
        
        const { data, error, count } = await query;
        esconderSpinner();

        if (error) {
            console.error("Erro ao carregar tarefas:", error);
            alert("Erro ao carregar tarefas.");
            return;
        }
        todasAsTarefas = data || [];
        renderizarVistaAtual();
        renderPaginacao(count);
    }

    function renderizarVistaAtual() {
        const modo = tarefaViewModeEl.value;
        [tarefasViewListaEl, tarefasViewKanbanEl, tarefasViewCalendarioEl].forEach(v => v.classList.add("hidden"));
        if (modo === "lista") {
            tarefasViewListaEl.classList.remove("hidden");
            renderTabelaTarefas();
        } else if (modo === "kanban") {
            tarefasViewKanbanEl.classList.remove("hidden");
            renderQuadroKanban();
        } else if (modo === "calendario") {
            tarefasViewCalendarioEl.classList.remove("hidden");
            renderCalendarioTarefas();
        }
    }

    function renderTabelaTarefas() {
        tarefasTableBodyEl.innerHTML = "";
        if (todasAsTarefas.length === 0) {
            tarefasListaNenhumaMsgEl.classList.remove("hidden");
            return;
        }
        tarefasListaNenhumaMsgEl.classList.add("hidden");
        const agora = new Date();

        todasAsTarefas.forEach(t => {
            const tr = document.createElement("tr");
            const prazo = t.data_prazo ? new Date(t.data_prazo) : null;
            const atrasada = prazo && prazo < agora && t.estado !== "Concluída" && t.estado !== "Cancelada";
            tr.className = atrasada ? "task-row overdue bg-red-50" : "";

            const nomeProjeto = t.projeto?.nome || "N/A";
            const idProjeto = t.projeto_id;
            let projetoCellHTML = nomeProjeto;
            if (idProjeto && nomeProjeto !== "N/A") {
                projetoCellHTML = `<a href="#" class="text-blue-600 hover:underline project-link" data-project-id="${idProjeto}">${nomeProjeto}</a>`;
            }

            tr.innerHTML = `
                <td class="font-medium ${atrasada ? "text-red-700" : ""}">${t.titulo}</td>
                <td>${t.user_atribuido?.full_name || t.user_atribuido?.username || "N/A"}</td>
                <td><span class="px-2 py-1 text-xs font-semibold rounded-full ${getPrioridadeClass(t.prioridade)}">${t.prioridade}</span></td>
                <td><span class="px-2 py-1 text-xs font-semibold rounded-full ${getEstadoClass(t.estado)}">${t.estado}</span></td>
                <td class="${atrasada ? "text-red-700 font-bold" : ""}">${formatarDataHora(t.data_prazo)}</td>
                <td>${projetoCellHTML}</td>
                <td class="actions-cell">
                    <button class="action-button text-xs !p-1 tar-editar-btn" data-id="${t.id}">Editar</button>
                    <button class="action-button secondary text-xs !p-1 tar-detalhes-btn" data-id="${t.id}">Detalhes</button>
                </td>
            `;
            tarefasTableBodyEl.appendChild(tr);
        });
    }
    
    function getPrioridadeClass(prioridade) {
        if (prioridade === "Alta") return "bg-red-100 text-red-700";
        if (prioridade === "Média") return "bg-yellow-100 text-yellow-700";
        if (prioridade === "Baixa") return "bg-green-100 text-green-700";
        return "bg-gray-100 text-gray-700";
    }
    function getEstadoClass(estado) {
        if (estado === "Concluída") return "bg-green-100 text-green-700";
        if (estado === "Em Progresso") return "bg-blue-100 text-blue-700";
        if (estado === "Bloqueada" || estado === "Cancelada") return "bg-gray-100 text-gray-700 line-through";
        if (estado === "Pendente") return "bg-yellow-100 text-yellow-700";
        return "bg-gray-100 text-gray-700";
    }


    function renderQuadroKanban() {
        kanbanBoardEl.innerHTML = ""; 
        for (const colKey in KANBAN_COLUNAS) {
            KANBAN_COLUNAS[colKey].tasks = [];
        }
        todasAsTarefas.forEach(t => {
            if (KANBAN_COLUNAS[t.estado]) {
                KANBAN_COLUNAS[t.estado].tasks.push(t);
            } else if (KANBAN_COLUNAS["Pendente"]) { 
                KANBAN_COLUNAS["Pendente"].tasks.push(t);
            }
        });

        const agora = new Date();
        for (const colKey in KANBAN_COLUNAS) {
            const colunaData = KANBAN_COLUNAS[colKey];
            const colunaDiv = document.createElement("div");
            colunaDiv.id = colunaData.id;
            colunaDiv.className = "kanban-column";
            colunaDiv.innerHTML = `<h4 class="kanban-column-title">${colunaData.title} (${colunaData.tasks.length})</h4>
                                 <div class="kanban-cards-container" data-estado-coluna="${colKey}"></div>`;
            
            const cardsContainer = colunaDiv.querySelector(".kanban-cards-container");
            colunaData.tasks.sort((a,b) => (new Date(a.data_prazo) || 0) - (new Date(b.data_prazo) || 0)); 

            colunaData.tasks.forEach(t => {
                const card = document.createElement("div");
                card.className = "kanban-card";
                card.dataset.id = t.id;
                card.draggable = true;
                const prazo = t.data_prazo ? new Date(t.data_prazo) : null;
                const atrasada = prazo && prazo < agora && t.estado !== "Concluída" && t.estado !== "Cancelada";
                if (atrasada) card.classList.add("overdue");

                card.innerHTML = `
                    <div class="kanban-card-title">${t.titulo}</div>
                    <div class="kanban-card-details">
                        <span>Prazo: ${formatarDataHora(t.data_prazo, true)}</span>
                        <span>Atribuído: ${t.user_atribuido?.full_name || t.user_atribuido?.username || "N/A"}</span>
                        <span class="px-1 py-0.5 text-xs font-semibold rounded-full ${getPrioridadeClass(t.prioridade)}">${t.prioridade}</span>
                    </div>
                    <div class="kanban-card-actions">
                         <button class="action-button text-xs !p-1 tar-editar-btn" data-id="${t.id}">Editar</button>
                    </div>
                `;
                cardsContainer.appendChild(card);
            });
            kanbanBoardEl.appendChild(colunaDiv);
        }
        setupKanbanDragAndDrop();
    }

    function setupKanbanDragAndDrop() {
        const cards = document.querySelectorAll(".kanban-card");
        const columns = document.querySelectorAll(".kanban-cards-container");
        let draggedItem = null;

        cards.forEach(card => {
            card.addEventListener("dragstart", () => {
                draggedItem = card;
                setTimeout(() => card.style.display = "none", 0);
            });
            card.addEventListener("dragend", () => {
                setTimeout(() => {
                    draggedItem.style.display = "block";
                    draggedItem = null;
                }, 0);
            });
        });

        columns.forEach(column => {
            column.addEventListener("dragover", e => e.preventDefault());
            column.addEventListener("dragenter", e => {
                e.preventDefault();
                column.classList.add("hovered");
            });
            column.addEventListener("dragleave", () => column.classList.remove("hovered"));
            column.addEventListener("drop", async () => {
                if (draggedItem) {
                    column.appendChild(draggedItem);
                    column.classList.remove("hovered");
                    const tarefaId = draggedItem.dataset.id;
                    const novoEstado = column.dataset.estadoColuna;
                    await atualizarEstadoTarefa(tarefaId, novoEstado);
                }
            });
        });
    }

    async function atualizarEstadoTarefa(tarefaId, novoEstado) {
        const { error } = await supabase.from("tarefas")
            .update({ estado: novoEstado, user_id_last_modified: currentUser.id })
            .eq("id", tarefaId);
        if (error) {
            console.error("Erro ao atualizar estado da tarefa:", error);
            alert("Erro ao mover tarefa.");
            carregarTarefas(); // Recarregar para reverter visualmente
        } else {
            // Atualizar localmente para evitar recarga completa se for só o estado
            const tarefaIndex = todasAsTarefas.findIndex(t => t.id === tarefaId);
            if (tarefaIndex > -1) todasAsTarefas[tarefaIndex].estado = novoEstado;
        }
    }

    function renderCalendarioTarefas() {
        if (!calendarContainerEl) {
            console.error("Elemento calendarContainerEl não encontrado.");
            return;
        }
        if (typeof FullCalendar === 'undefined') {
            calendarContainerEl.innerHTML = '<p>Biblioteca FullCalendar não carregada. Tente atualizar a página.</p>';
            return;
        }

        if (calendarInstance) {
            calendarInstance.destroy();
        }

        const eventos = todasAsTarefas.map(t => ({
            id: t.id.toString(), // Ensure ID is string for FullCalendar
            title: t.titulo,
            start: t.data_prazo ? new Date(t.data_prazo).toISOString().split("T")[0] : null,
            allDay: true,
            extendedProps: { tarefa_original: t },
            backgroundColor: getCorCalendarioPorEstado(t.estado),
            borderColor: getCorCalendarioPorEstado(t.estado)
        })).filter(e => e.start);

        calendarInstance = new FullCalendar.Calendar(calendarContainerEl, {
            initialView: 'dayGridMonth',
            locale: 'pt',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listWeek'
            },
            events: eventos,
            editable: true,
            eventDrop: async (info) => {
                const tarefaId = info.event.id;
                const novoPrazo = info.event.start.toISOString();
                const { error } = await supabase.from("tarefas")
                    .update({ data_prazo: novoPrazo, user_id_last_modified: currentUser.id })
                    .eq("id", tarefaId);
                if (error) {
                    console.error("Erro ao atualizar prazo da tarefa via drag-and-drop:", error);
                    info.revert();
                    alert("Erro ao atualizar prazo da tarefa.");
                } else {
                    // Atualizar localmente para refletir a mudança imediatamente
                    const tarefaIndex = todasAsTarefas.findIndex(t => t.id.toString() === tarefaId);
                    if (tarefaIndex > -1) {
                        todasAsTarefas[tarefaIndex].data_prazo = novoPrazo;
                    }
                }
            },
            eventClick: (info) => {
                // Usar abrirModalDetalhesTarefa em vez de abrirModalTarefa para consistência
                abrirModalDetalhesTarefa(info.event.id); 
            }
        });
        calendarInstance.render();
    }
    
    function getCorCalendarioPorEstado(estado) {
        if (estado === "Concluída") return "#22c55e"; // Verde
        if (estado === "Em Progresso") return "#3b82f6"; // Azul
        if (estado === "Bloqueada" || estado === "Cancelada") return "#6b7280"; // Cinza
        if (estado === "Pendente") return "#f59e0b"; // Amarelo/Laranja
        return "#a1a1aa"; // Default
    }

    function renderPaginacao(totalItens) {
        if (!tarefasListaPaginacaoEl || totalItens === 0 || tarefaViewModeEl.value !== "lista") {
            if(tarefasListaPaginacaoEl) tarefasListaPaginacaoEl.innerHTML = "";
            return;
        }
        const totalPaginas = Math.ceil(totalItens / itensPorPaginaLista);
        tarefasListaPaginacaoEl.innerHTML = ""; 

        if (totalPaginas <= 1) return;

        const criarBotaoPag = (texto, pagina, desabilitado = false, ativo = false) => {
            const btn = document.createElement("button");
            btn.innerHTML = texto;
            btn.className = `px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 mx-0.5 ${desabilitado ? "opacity-50 cursor-not-allowed" : ""} ${ativo ? "bg-blue-500 text-white border-blue-500" : ""}`;
            btn.disabled = desabilitado;
            if (!desabilitado) {
                btn.addEventListener("click", () => { paginaAtualLista = pagina; carregarTarefas(); });
            }
            return btn;
        };
        tarefasListaPaginacaoEl.appendChild(criarBotaoPag("&laquo; Ant.", paginaAtualLista - 1, paginaAtualLista === 1));
        // Lógica de reticências e números de página...
        let inicio = Math.max(1, paginaAtualLista - 2);
        let fim = Math.min(totalPaginas, paginaAtualLista + 2);
        if (paginaAtualLista <= 3) fim = Math.min(totalPaginas, 5);
        if (paginaAtualLista >= totalPaginas - 2) inicio = Math.max(1, totalPaginas - 4);

        if (inicio > 1) {
            tarefasListaPaginacaoEl.appendChild(criarBotaoPag("1", 1));
            if (inicio > 2) tarefasListaPaginacaoEl.appendChild(document.createTextNode("..."));
        }
        for (let i = inicio; i <= fim; i++) {
            tarefasListaPaginacaoEl.appendChild(criarBotaoPag(i, i, false, i === paginaAtualLista));
        }
        if (fim < totalPaginas) {
            if (fim < totalPaginas - 1) tarefasListaPaginacaoEl.appendChild(document.createTextNode("..."));
            tarefasListaPaginacaoEl.appendChild(criarBotaoPag(totalPaginas, totalPaginas));
        }
        tarefasListaPaginacaoEl.appendChild(criarBotaoPag("Próx. &raquo;", paginaAtualLista + 1, paginaAtualLista === totalPaginas));
    }

    // --- Modal de Tarefa (Criar/Editar) ---
    function abrirModalTarefa(tarefaId = null) {
        tarefaFormEl.reset();
        tarefaFormIdEl.value = "";
        tarefaFormModalTitleEl.textContent = "Nova Tarefa";
        tarefaFormPrazoEl.min = new Date().toISOString().split("T")[0]; // Não permitir prazos passados para novas tarefas
        tarefaFormAtribuidoAEl.value = currentUser.id; // Default para o user logado
        tarefaFormEstadoModalEl.value = "Pendente";
        tarefaFormPrioridadeEl.value = "Média";
        
        // Resetar campos de recorrência para nova tarefa
        tarefaFormRecorrenciaTipoEl.value = "";
        recorrenciaConfigSemanalEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        tarefaFormRecorrenciaDiaMesEl.value = "";
        toggleRecorrenciaConfig(); // Esconder campos de config de recorrência

        if (tarefaId) {
            const tarefa = todasAsTarefas.find(t => t.id.toString() === tarefaId.toString()); // Robust ID comparison
            if (tarefa) {
                tarefaFormModalTitleEl.textContent = "Editar Tarefa";
                tarefaFormIdEl.value = tarefa.id;
                tarefaFormTituloEl.value = tarefa.titulo;
                tarefaFormDescricaoEl.value = tarefa.descricao || "";
                tarefaFormAtribuidoAEl.value = tarefa.user_id_atribuido_a;
                if (tarefa.data_prazo) tarefaFormPrazoEl.value = new Date(tarefa.data_prazo).toISOString().slice(0,16);
                tarefaFormPrioridadeEl.value = tarefa.prioridade;
                tarefaFormEstadoModalEl.value = tarefa.estado;
                tarefaFormParqueEl.value = tarefa.parque_id || "";
                tarefaFormProjetoModalEl.value = tarefa.projeto_id || "";
                
                // Preencher campos de recorrência
                tarefaFormRecorrenciaTipoEl.value = tarefa.recorrencia_tipo || "";
                toggleRecorrenciaConfig(); // Atualiza visibilidade dos campos de config

                if (tarefa.recorrencia_tipo === 'semanal' && tarefa.recorrencia_config?.dias_semana) {
                    recorrenciaConfigSemanalEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                        cb.checked = tarefa.recorrencia_config.dias_semana.includes(parseInt(cb.value));
                    });
                } else {
                     recorrenciaConfigSemanalEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                }
                
                if (tarefa.recorrencia_tipo === 'mensal' && tarefa.recorrencia_config?.dia_mes) {
                    tarefaFormRecorrenciaDiaMesEl.value = tarefa.recorrencia_config.dia_mes;
                } else {
                    tarefaFormRecorrenciaDiaMesEl.value = "";
                }
            }
        } else {
             // Assegurar que para novas tarefas, os campos de recorrência estão limpos (já feito acima)
        }
        tarefaFormModalEl.classList.remove("hidden");
    }
    function fecharModalTarefa() {
        tarefaFormModalEl.classList.add("hidden");
    }

    function abrirModalDetalhesTarefa(tarefaId) {
        const tarefa = todasAsTarefas.find(t => t.id.toString() === tarefaId.toString()); // Ensure ID comparison is robust
        if (!tarefa) {
            alert("Detalhes da tarefa não encontrados.");
            return;
        }

        detalheTarefaTituloEl.textContent = tarefa.titulo;
        detalheTarefaDescricaoEl.textContent = tarefa.descricao || "N/A";
        detalheTarefaAtribuidoAEl.textContent = tarefa.user_atribuido?.full_name || tarefa.user_atribuido?.username || "N/A";
        detalheTarefaPrazoEl.textContent = formatarDataHora(tarefa.data_prazo);
        detalheTarefaPrioridadeEl.innerHTML = `<span class="px-2 py-1 text-xs font-semibold rounded-full ${getPrioridadeClass(tarefa.prioridade)}">${tarefa.prioridade}</span>`;
        detalheTarefaEstadoEl.innerHTML = `<span class="px-2 py-1 text-xs font-semibold rounded-full ${getEstadoClass(tarefa.estado)}">${tarefa.estado}</span>`;
        detalheTarefaProjetoEl.textContent = tarefa.projeto?.nome || "N/A";
        detalheTarefaParqueEl.textContent = tarefa.parque?.nome || "N/A";
        detalheTarefaCriadorEl.textContent = tarefa.user_criador?.full_name || tarefa.user_criador?.username || "N/A";
        detalheTarefaCriadoEmEl.textContent = formatarDataHora(tarefa.created_at);
        detalheTarefaModificadoEmEl.textContent = tarefa.updated_at ? formatarDataHora(tarefa.updated_at) : "Nunca";
        
        tarefaDetalhesModalTitleEl.textContent = `Detalhes: ${tarefa.titulo}`;
        tarefaDetalhesModalEl.classList.remove("hidden");
    }

    function fecharModalDetalhesTarefa() {
        if (tarefaDetalhesModalEl) tarefaDetalhesModalEl.classList.add("hidden");
    }

    tarefaFormRecorrenciaTipoEl.addEventListener("change", toggleRecorrenciaConfig);
    function toggleRecorrenciaConfig() {
        const tipo = tarefaFormRecorrenciaTipoEl.value;
        recorrenciaConfigSemanalEl.classList.toggle("hidden", tipo !== "semanal");
        recorrenciaConfigMensalEl.classList.toggle("hidden", tipo !== "mensal");
    }

    tarefaFormEl.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = tarefaFormIdEl.value;
        const dadosTarefa = {
            titulo: tarefaFormTituloEl.value,
            descricao: tarefaFormDescricaoEl.value || null,
            user_id_atribuido_a: tarefaFormAtribuidoAEl.value,
            data_prazo: tarefaFormPrazoEl.value ? new Date(tarefaFormPrazoEl.value).toISOString() : null,
            prioridade: tarefaFormPrioridadeEl.value,
            estado: tarefaFormEstadoModalEl.value,
            parque_id: tarefaFormParqueEl.value || null,
            projeto_id: tarefaFormProjetoModalEl.value || null,
            recorrencia_tipo: tarefaFormRecorrenciaTipoEl.value || null,
            recorrencia_config: null 
        };

        if (dadosTarefa.recorrencia_tipo === 'semanal') {
            dadosTarefa.recorrencia_config = { dias_semana: [] };
            recorrenciaConfigSemanalEl.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                dadosTarefa.recorrencia_config.dias_semana.push(parseInt(cb.value));
            });
        } else if (dadosTarefa.recorrencia_tipo === 'mensal') {
            dadosTarefa.recorrencia_config = { 
                dia_mes: tarefaFormRecorrenciaDiaMesEl.value ? parseInt(tarefaFormRecorrenciaDiaMesEl.value) : null 
            };
        }

        let resultado, erro;
        if (id) { // Editar
            dadosTarefa.user_id_last_modified = currentUser.id;
            const { data, error } = await supabase.from("tarefas").update(dadosTarefa).eq("id", id).select().single();
            resultado = data; erro = error;
        } else { // Criar
            dadosTarefa.user_id_criador = currentUser.id;
            const { data, error } = await supabase.from("tarefas").insert(dadosTarefa).select().single();
            resultado = data; erro = error;
        }

        if (erro) {
            console.error("Erro ao guardar tarefa:", erro);
            alert(`Erro: ${erro.message}`);
        } else {
            fecharModalTarefa();
            carregarTarefas(); // Recarregar a lista/quadro
        }
    });

    // --- Event Listeners ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener("click", () => { window.location.href = "index.html"; });
    if (tarefaAplicarFiltrosBtnEl) tarefaAplicarFiltrosBtnEl.addEventListener("click", () => { paginaAtualLista = 1; carregarTarefas(); });
    if (tarefaViewModeEl) tarefaViewModeEl.addEventListener("change", renderizarVistaAtual);
    if (tarefaNovaBtnEl) tarefaNovaBtnEl.addEventListener("click", () => abrirModalTarefa());
    tarFecharModalBtns.forEach(btn => btn.addEventListener("click", fecharModalTarefa));
    tarFecharDetalhesModalBtns.forEach(btn => btn.addEventListener("click", fecharModalDetalhesTarefa));


    // Event listeners para botões de editar/detalhes na tabela (delegação de eventos)
    tarefasTableBodyEl.addEventListener("click", (e) => {
        const projectLink = e.target.closest(".project-link");
        const editButton = e.target.closest(".tar-editar-btn");
        const detailsButton = e.target.closest(".tar-detalhes-btn");

        if (projectLink && projectLink.dataset.projectId) {
            e.preventDefault();
            const projectId = projectLink.dataset.projectId;
            localStorage.setItem("selectedProjectIdForProjetos", projectId);
            window.location.href = "Projetos.html";
        } else if (editButton && editButton.dataset.id) {
            abrirModalTarefa(editButton.dataset.id);
        } else if (detailsButton && detailsButton.dataset.id) {
            abrirModalDetalhesTarefa(detailsButton.dataset.id);
        }
    });
    kanbanBoardEl.addEventListener("click", (e) => {
        if (e.target.classList.contains("tar-editar-btn") || e.target.closest(".tar-editar-btn")) {
            const btn = e.target.classList.contains("tar-editar-btn") ? e.target : e.target.closest(".tar-editar-btn");
            abrirModalTarefa(btn.dataset.id);
        }
    });


    // --- Inicialização ---
    async function initTarefas() {
        if (!currentUser && !localStorage.getItem("supabase.auth.token")) return;
        
        const deepLinkedTaskId = localStorage.getItem("selectedTaskIdForTarefas");
        if (deepLinkedTaskId) {
            localStorage.removeItem("selectedTaskIdForTarefas");
            // Ensure data is loaded before trying to open modal
            await carregarDadosIniciaisParaFiltrosEForm();
            await carregarTarefas(); // This populates 'todasAsTarefas'
            abrirModalTarefa(deepLinkedTaskId); // Open the specific task for editing
        } else {
            await carregarDadosIniciaisParaFiltrosEForm();
            await carregarTarefas();
        }
        // console.log("Subaplicação de Tarefas inicializada."); 
    }

    initTarefas().catch(console.error);
});


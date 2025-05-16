// js/tarefas.js - Lógica para a Subaplicação de Gestão de Tarefas

document.addEventListener("DOMContentLoaded", () => {
    if (typeof checkAuthStatus !== "function" || typeof window.sbClient === "undefined") {
        console.error("Supabase client ou auth_global.js não carregados para Tarefas.");
        return;
    }
    checkAuthStatus();

    const currentUser = window.sbClient.auth.user();
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

    // --- Estado da Aplicação ---
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
        const { data: usersData, error: usersError } = await window.sbClient.from("profiles").select("id, full_name, username, role, reporta_a_user_id");
        if (usersError) console.error("Erro ao carregar utilizadores:", usersError);
        else todosOsUsuariosSistema = usersData || [];

        // Carregar Parques
        const { data: parquesData, error: parquesError } = await window.sbClient.from("parques").select("id, nome");
        if (parquesError) console.error("Erro ao carregar parques:", parquesError);
        else listaParquesGlob = parquesData || [];

        // Carregar Projetos
        const { data: projetosData, error: projetosError } = await window.sbClient.from("projetos").select("id, nome");
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

        let query = window.sbClient.from("tarefas").select(`
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

            tr.innerHTML = `
                <td class="font-medium ${atrasada ? "text-red-700" : ""}">${t.titulo}</td>
                <td>${t.user_atribuido?.full_name || t.user_atribuido?.username || "N/A"}</td>
                <td><span class="px-2 py-1 text-xs font-semibold rounded-full ${getPrioridadeClass(t.prioridade)}">${t.prioridade}</span></td>
                <td><span class="px-2 py-1 text-xs font-semibold rounded-full ${getEstadoClass(t.estado)}">${t.estado}</span></td>
                <td class="${atrasada ? "text-red-700 font-bold" : ""}">${formatarDataHora(t.data_prazo)}</td>
                <td>${t.projeto?.nome || "N/A"}</td>
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
        const { error } = await window.sbClient.from("tarefas")
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
        if (!calendarContainerEl || typeof FullCalendar === "undefined") {
            calendarContainerEl.innerHTML = "<p>Biblioteca de Calendário não carregada.</p>";
            return;
        }
        const eventos = todasAsTarefas.map(t => ({
            id: t.id,
            title: t.titulo,
            start: t.data_prazo ? new Date(t.data_prazo).toISOString().split("T")[0] : null, // Apenas data para eventos de dia inteiro
            allDay: true,
            extendedProps: { tarefa: t },
            backgroundColor: getCorCalendarioPorEstado(t.estado),
            borderColor: getCorCalendarioPorEstado(t.estado)
        })).filter(e => e.start); // Apenas tarefas com prazo

        const calendar = new FullCalendar.Calendar(calendarContainerEl, {
            initialView: "dayGridMonth",
            locale: "pt",
            headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listWeek" },
            events: eventos,
            editable: true, // Permitir arrastar eventos (prazos)
            eventDrop: async (info) => {
                const tarefaId = info.event.id;
                const novoPrazo = info.event.start.toISOString();
                const { error } = await window.sbClient.from("tarefas")
                    .update({ data_prazo: novoPrazo, user_id_last_modified: currentUser.id })
                    .eq("id", tarefaId);
                if (error) {
                    console.error("Erro ao atualizar prazo da tarefa:", error);
                    info.revert();
                    alert("Erro ao atualizar prazo.");
                }
            },
            eventClick: (info) => {
                abrirModalTarefa(info.event.id);
            }
        });
        calendar.render();
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
        toggleRecorrenciaConfig();

        if (tarefaId) {
            const tarefa = todasAsTarefas.find(t => t.id === tarefaId);
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
                // TODO: Carregar e preencher dados de recorrência se existirem
            }
        }
        tarefaFormModalEl.classList.remove("hidden");
    }
    function fecharModalTarefa() {
        tarefaFormModalEl.classList.add("hidden");
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
            // TODO: Adicionar dados de recorrência
            // recorrencia_tipo: tarefaFormRecorrenciaTipoEl.value || null,
            // recorrencia_config: // construir objeto com base no tipo
        };

        let resultado, erro;
        if (id) { // Editar
            dadosTarefa.user_id_last_modified = currentUser.id;
            const { data, error } = await window.sbClient.from("tarefas").update(dadosTarefa).eq("id", id).select().single();
            resultado = data; erro = error;
        } else { // Criar
            dadosTarefa.user_id_criador = currentUser.id;
            const { data, error } = await window.sbClient.from("tarefas").insert(dadosTarefa).select().single();
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

    // Event listeners para botões de editar/detalhes na tabela (delegação de eventos)
    tarefasTableBodyEl.addEventListener("click", (e) => {
        if (e.target.classList.contains("tar-editar-btn") || e.target.closest(".tar-editar-btn")) {
            const btn = e.target.classList.contains("tar-editar-btn") ? e.target : e.target.closest(".tar-editar-btn");
            abrirModalTarefa(btn.dataset.id);
        }
        // TODO: Botão de detalhes pode abrir um modal diferente ou uma vista lateral
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
        await carregarDadosIniciaisParaFiltrosEForm();
        await carregarTarefas();
    }

    initTarefas().catch(console.error);
});


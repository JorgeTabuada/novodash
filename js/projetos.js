// js/projetos.js - Lógica para a Subaplicação de Gestão de Projetos

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Projetos.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnProjetos');
    const projetoFiltroUserEl = document.getElementById('projetoFiltroUser');
    const projetoFiltroEstadoEl = document.getElementById('projetoFiltroEstado');
    const projetoFiltroTipoEl = document.getElementById('projetoFiltroTipo');
    const projetoFiltroPrazoDeEl = document.getElementById('projetoFiltroPrazoDe');
    const projetoFiltroPrazoAteEl = document.getElementById('projetoFiltroPrazoAte');
    const projetoAplicarFiltrosBtnEl = document.getElementById('projetoAplicarFiltrosBtn');
    const projetoNovoBtnEl = document.getElementById('projetoNovoBtn');
    const projetoViewModeEl = document.getElementById('projetoViewMode');
    const loadingProjetosSpinnerEl = document.getElementById('loadingProjetosSpinner');

    const projetosViewListaEl = document.getElementById('projetosViewLista');
    const projetosTableBodyEl = document.getElementById('projetosTableBody');
    const projetosListaNenhumaMsgEl = document.getElementById('projetosListaNenhumaMsg');
    const projetosListaPaginacaoEl = document.getElementById('projetosListaPaginacao');

    const projetosViewKanbanEl = document.getElementById('projetosViewKanban');
    const kanbanProjetosBoardEl = document.getElementById('kanbanProjetosBoard');

    const projetosViewCalendarioEl = document.getElementById('projetosViewCalendario');
    const timelineProjetosContainerEl = document.getElementById('timelineProjetosContainer');

    // Modal Novo/Editar Projeto
    const projetoFormModalEl = document.getElementById('projetoFormModal');
    const projetoFormModalTitleEl = document.getElementById('projetoFormModalTitle');
    const projetoFormEl = document.getElementById('projetoForm');
    const projetoFormIdEl = document.getElementById('projetoFormId');
    const projetoFormNomeEl = document.getElementById('projetoFormNome');
    const projetoFormTipoEl = document.getElementById('projetoFormTipo');
    const projetoFormResponsavelPrincipalEl = document.getElementById('projetoFormResponsavelPrincipal');
    const projetoFormDataInicioEl = document.getElementById('projetoFormDataInicio');
    const projetoFormDataPrazoEl = document.getElementById('projetoFormDataPrazo');
    const projetoFormOrcamentoEl = document.getElementById('projetoFormOrcamento');
    const projetoFormEstadoModalEl = document.getElementById('projetoFormEstadoModal');
    const projetoFormDescricaoEl = document.getElementById('projetoFormDescricao');
    const projetoFormMembrosEl = document.getElementById('projetoFormMembros');
    const projetoFormParqueEl = document.getElementById('projetoFormParque');
    const projFecharFormModalBtns = document.querySelectorAll('.projFecharFormModalBtn');

    // Modal Detalhes do Projeto
    const projetoDetalhesModalEl = document.getElementById('projetoDetalhesModal');
    const projetoDetalhesModalTitleEl = document.getElementById('projetoDetalhesModalTitle');
    const projetoDetalhesIdEl = document.getElementById('projetoDetalhesId');
    const detalheNomeProjetoEl = document.getElementById('detalheNomeProjeto');
    const detalheTipoProjetoEl = document.getElementById('detalheTipoProjeto');
    const detalheResponsavelProjetoEl = document.getElementById('detalheResponsavelProjeto');
    const detalheEstadoProjetoEl = document.getElementById('detalheEstadoProjeto');
    const detalheDataInicioEl = document.getElementById('detalheDataInicio');
    const detalheDataPrazoEl = document.getElementById('detalheDataPrazo');
    const detalheOrcamentoEl = document.getElementById('detalheOrcamento');
    const detalheDespesasTotalEl = document.getElementById('detalheDespesasTotal');
    const detalheSaldoOrcamentoEl = document.getElementById('detalheSaldoOrcamento');
    const detalheDescricaoProjetoEl = document.getElementById('detalheDescricaoProjeto');
    const detalheListaMembrosEl = document.getElementById('detalheListaMembros');
    const detalheTarefasPendentesEl = document.getElementById('detalheTarefasPendentes');
    const detalheTarefasProgressoEl = document.getElementById('detalheTarefasProgresso');
    const detalheTarefasConcluidasEl = document.getElementById('detalheTarefasConcluidas');
    const detalheListaTarefasContainerEl = document.getElementById('detalheListaTarefasContainer');
    const detalheListaDespesasContainerEl = document.getElementById('detalheListaDespesasContainer');
    const projFecharDetalhesModalBtns = document.querySelectorAll('.projFecharDetalhesModalBtn');
    const projEditarDesdeDetalhesBtnEl = document.querySelector('.projEditarDesdeDetalhesBtn');


    // --- Estado da Aplicação ---
    let todosOsProjetos = [];
    let paginaAtualProjetosLista = 1;
    const itensPorPaginaProjetosLista = 10;
    let todosOsUsuariosSistemaProj = [];
    let listaParquesGlobProj = [];
    let tiposDeProjetoDistintos = []; // Para popular filtro

    const KANBAN_COLUNAS_PROJETOS = {
        'Planeado': { id: 'col-proj-planeado', title: '🎯 Planeado', projects: [] },
        'Em Curso': { id: 'col-proj-emcurso', title: '🚧 Em Curso', projects: [] },
        'Concluído': { id: 'col-proj-concluido', title: '🏁 Concluído', projects: [] },
        'Suspenso': { id: 'col-proj-suspenso', title: '⏸️ Suspenso', projects: [] },
        'Cancelado': { id: 'col-proj-cancelado', title: '❌ Cancelado', projects: [] }
    };

    // --- Funções Auxiliares ---
    function formatarData(dataISO) { return dataISO ? new Date(dataISO).toLocaleDateString('pt-PT') : 'N/A'; }
    function formatarMoeda(valor) { return parseFloat(valor || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }
    function mostrarSpinnerProj(show = true) { loadingProjetosSpinnerEl.style.display = show ? 'block' : 'none'; }
    function calcularProgresso(tarefas) { // tarefas = [{estado: 'Concluída'}, ...]
        if (!tarefas || tarefas.length === 0) return 0;
        const concluidas = tarefas.filter(t => t.estado === 'Concluída').length;
        return Math.round((concluidas / tarefas.length) * 100);
    }

    function getEstadoTarefaClassProj(estado) { // Renamed to avoid conflict if ever merged
        if (estado === "Concluída") return "bg-green-100 text-green-700";
        if (estado === "Em Progresso") return "bg-blue-100 text-blue-700";
        if (estado === "Bloqueada" || estado === "Cancelada") return "bg-gray-100 text-gray-700 line-through";
        if (estado === "Pendente") return "bg-yellow-100 text-yellow-700";
        return "bg-gray-100 text-gray-700";
    }

    // --- Carregar Dados Iniciais (Utilizadores, Parques, Tipos de Projeto) ---
    async function carregarDadosIniciaisProjetos() {
        const { data: usersData, error: usersError } = await supabase.from('profiles').select('id, full_name, username, role');
        if (usersError) console.error("Erro ao carregar utilizadores para projetos:", usersError);
        else todosOsUsuariosSistemaProj = usersData || [];

        const { data: parquesData, error: parquesError } = await supabase.from('parques').select('id, nome');
        if (parquesError) console.error("Erro ao carregar parques para projetos:", parquesError);
        else listaParquesGlobProj = parquesData || [];
        
        const { data: tiposData, error: tiposError } = await supabase.rpc('get_distinct_tipos_projeto'); 
        if (tiposError) console.error("Erro ao carregar tipos de projeto:", tiposError);
        else tiposDeProjetoDistintos = tiposData ? tiposData.map(t => t.tipo_projeto) : [];

        popularSelectsProjetos();
    }

    function popularSelectsProjetos() {
        projetoFiltroUserEl.innerHTML = `
            <option value="meus_associados">Meus Projetos</option>
            <option value="todos_subordinados">Minha Equipa/Subordinados</option>
            ${userProfile.role === 'super_admin' || userProfile.role === 'admin' ? '<option value="todos_geral">Todos os Projetos</option>' : ''}
        `;
        projetoFormResponsavelPrincipalEl.innerHTML = '<option value="">Selecione Responsável</option>';
        todosOsUsuariosSistemaProj.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.full_name || u.username;
            projetoFormResponsavelPrincipalEl.appendChild(opt);
        });
        projetoFormMembrosEl.innerHTML = ''; 
        todosOsUsuariosSistemaProj.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.full_name || u.username;
            projetoFormMembrosEl.appendChild(opt);
        });
        projetoFormParqueEl.innerHTML = '<option value="">Nenhum</option>';
        listaParquesGlobProj.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nome;
            projetoFormParqueEl.appendChild(opt);
        });
        projetoFiltroTipoEl.innerHTML = '<option value="">Todos</option>';
        tiposDeProjetoDistintos.forEach(tipo => {
            if(tipo) { 
                const opt = document.createElement('option');
                opt.value = tipo;
                opt.textContent = tipo;
                projetoFiltroTipoEl.appendChild(opt);
            }
        });
    }

    async function carregarProjetos() {
        mostrarSpinnerProj();
        const filtroUser = projetoFiltroUserEl.value;
        const estado = projetoFiltroEstadoEl.value;
        const tipo = projetoFiltroTipoEl.value;
        const prazoDe = projetoFiltroPrazoDeEl.value;
        const prazoAte = projetoFiltroPrazoAteEl.value;

        let query = supabase.from('projetos').select(`
            id, nome_projeto, tipo_projeto, orcamento_previsto, data_inicio, data_prazo, estado_projeto, descricao, parque_id,
            responsavel:profiles!projetos_user_id_responsavel_principal_fkey (id, full_name, username),
            membros:projeto_membros ( profiles (id, full_name) ),
            tarefas (id, titulo, estado, data_prazo, user_id_atribuido_a, user_atribuido:profiles!tarefas_user_id_atribuido_a_fkey(full_name, username)),
            despesas (valor)
        `, { count: 'exact' });

        if (estado) query = query.eq('estado_projeto', estado);
        if (tipo) query = query.eq('tipo_projeto', tipo);
        if (prazoDe) query = query.gte('data_prazo', prazoDe);
        if (prazoAte) query = query.lte('data_prazo', prazoAte);
        
        if (filtroUser === 'meus_associados') {
            query = query.or(`user_id_responsavel_principal.eq.${currentUser.id},membros.user_id_membro.eq.${currentUser.id}`);
        } else if (filtroUser === 'todos_subordinados') {
             query = query.or(`user_id_responsavel_principal.eq.${currentUser.id},membros.user_id_membro.eq.${currentUser.id}`); 
        } else if (filtroUser && filtroUser !== 'todos_geral') { 
            if (userProfile.role === 'super_admin' || userProfile.role === 'admin') { 
                query = query.or(`user_id_responsavel_principal.eq.${filtroUser},membros.user_id_membro.eq.${filtroUser}`);
            } else { 
                 query = query.or(`user_id_responsavel_principal.eq.${currentUser.id},membros.user_id_membro.eq.${currentUser.id}`);
            }
        } else if (filtroUser === 'todos_geral' && userProfile.role !== 'super_admin' && userProfile.role !== 'admin') {
            query = query.or(`user_id_responsavel_principal.eq.${currentUser.id},membros.user_id_membro.eq.${currentUser.id}`);
        }

        const offset = (paginaAtualProjetosLista - 1) * itensPorPaginaProjetosLista;
        query = query.order('data_prazo', { ascending: true, nullsFirst: false })
                     .order('created_at', { ascending: false })
                     .range(offset, offset + itensPorPaginaProjetosLista - 1);
        
        const { data, error, count } = await query;
        mostrarSpinnerProj(false);

        if (error) {
            console.error("Erro ao carregar projetos:", error);
            alert("Erro ao carregar projetos.");
            return;
        }
        todosOsProjetos = (data || []).map(p => ({
            ...p,
            total_despesas: (p.despesas || []).reduce((sum, d) => sum + (d.valor || 0), 0),
            progresso_tarefas: calcularProgresso(p.tarefas || [])
        }));
        
        renderizarVistaAtualProjetos();
        renderPaginacaoProjetos(count);
    }

    function renderizarVistaAtualProjetos() {
        const modo = projetoViewModeEl.value;
        [projetosViewListaEl, projetosViewKanbanEl, projetosViewCalendarioEl].forEach(v => v.classList.add('hidden'));
        if (modo === 'lista') {
            projetosViewListaEl.classList.remove('hidden');
            renderTabelaProjetos();
        } else if (modo === 'kanban') {
            projetosViewKanbanEl.classList.remove('hidden');
            renderQuadroKanbanProjetos();
        } else if (modo === 'calendario') {
            projetosViewCalendarioEl.classList.remove('hidden');
            renderTimelineProjetos();
        }
    }

    function renderTabelaProjetos() {
        projetosTableBodyEl.innerHTML = '';
        if (todosOsProjetos.length === 0) {
            projetosListaNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        projetosListaNenhumaMsgEl.classList.add('hidden');
        const agora = new Date();

        todosOsProjetos.forEach(p => {
            const tr = document.createElement('tr');
            const prazo = p.data_prazo ? new Date(p.data_prazo) : null;
            const atrasado = prazo && prazo < agora && p.estado_projeto !== 'Concluído' && p.estado_projeto !== 'Cancelado';
            tr.className = atrasado ? 'bg-red-50' : '';

            tr.innerHTML = `
                <td class="font-medium ${atrasado ? 'text-red-700' : ''}">${p.nome_projeto}</td>
                <td>${p.responsavel?.full_name || p.responsavel?.username || 'N/A'}</td>
                <td><span class="px-2 py-1 text-xs font-semibold rounded-full ${getEstadoProjetoClass(p.estado_projeto)}">${p.estado_projeto}</span></td>
                <td class="${atrasado ? 'text-red-700 font-bold' : ''}">${formatarData(p.data_prazo)}</td>
                <td>${formatarMoeda(p.orcamento_previsto)}</td>
                <td>${formatarMoeda(p.total_despesas)}</td>
                <td>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${p.progresso_tarefas}%;">${p.progresso_tarefas}%</div>
                    </div>
                </td>
                <td class="actions-cell">
                    <button class="action-button text-xs !p-1 proj-detalhes-btn" data-id="${p.id}">Detalhes</button>
                    <button class="action-button secondary text-xs !p-1 proj-editar-btn" data-id="${p.id}">Editar</button>
                </td>
            `;
            projetosTableBodyEl.appendChild(tr);
        });
    }

    function getEstadoProjetoClass(estado) {
        if (estado === 'Concluído') return 'bg-green-100 text-green-700';
        if (estado === 'Em Curso') return 'bg-blue-100 text-blue-700';
        if (estado === 'Suspenso' || estado === 'Cancelado') return 'bg-gray-100 text-gray-700';
        if (estado === 'Planeado') return 'bg-yellow-100 text-yellow-700';
        return 'bg-gray-100 text-gray-700';
    }

    function renderQuadroKanbanProjetos() {
        kanbanProjetosBoardEl.innerHTML = '';
        for (const colKey in KANBAN_COLUNAS_PROJETOS) { KANBAN_COLUNAS_PROJETOS[colKey].projects = []; }
        
        todosOsProjetos.forEach(p => {
            if (KANBAN_COLUNAS_PROJETOS[p.estado_projeto]) {
                KANBAN_COLUNAS_PROJETOS[p.estado_projeto].projects.push(p);
            } else if (KANBAN_COLUNAS_PROJETOS['Planeado']) {
                KANBAN_COLUNAS_PROJETOS['Planeado'].projects.push(p); 
            }
        });

        const agora = new Date();
        for (const colKey in KANBAN_COLUNAS_PROJETOS) {
            const colunaData = KANBAN_COLUNAS_PROJETOS[colKey];
            const colunaDiv = document.createElement('div');
            colunaDiv.id = colunaData.id;
            colunaDiv.className = 'kanban-column';
            colunaDiv.innerHTML = `<h4 class="kanban-column-title">${colunaData.title} (${colunaData.projects.length})</h4>
                                 <div class="kanban-cards-container" data-estado-coluna="${colKey}"></div>`;
            
            const cardsContainer = colunaDiv.querySelector('.kanban-cards-container');
            colunaData.projects.sort((a,b) => (new Date(a.data_prazo) || 0) - (new Date(b.data_prazo) || 0) ).forEach(p => {
                const card = document.createElement('div');
                card.className = 'kanban-card';
                card.dataset.projetoId = p.id;
                card.draggable = true; // Add this line
                const prazo = p.data_prazo ? new Date(p.data_prazo) : null;
                const atrasado = prazo && prazo < agora && p.estado_projeto !== 'Concluído' && p.estado_projeto !== 'Cancelado';
                if(atrasado) card.classList.add('overdue');

                card.innerHTML = `
                    <h5>${p.nome_projeto}</h5>
                    <p class="text-xs">Resp: ${p.responsavel?.full_name || 'N/A'}</p>
                    <p class="text-xs">Orçamento: ${formatarMoeda(p.orcamento_previsto)} | Despesas: ${formatarMoeda(p.total_despesas)}</p>
                    <div class="progress-bar-container"><div class="progress-bar" style="width: ${p.progresso_tarefas}%;">${p.progresso_tarefas}%</div></div>
                    <small class="prazo">Prazo: ${formatarData(p.data_prazo)} ${atrasado ? '(ATRASADO)' : ''}</small>
                `;
                card.addEventListener('click', () => abrirModalDetalhesProjeto(p.id));
                cardsContainer.appendChild(card);
            });
            kanbanProjetosBoardEl.appendChild(colunaDiv);
        }
        setupKanbanDragAndDropProjetos(); // Add this call
    }

    function setupKanbanDragAndDropProjetos() {
        const cards = kanbanProjetosBoardEl.querySelectorAll(".kanban-card[data-projeto-id]"); // Ensure we select project cards
        const columns = kanbanProjetosBoardEl.querySelectorAll(".kanban-cards-container[data-estado-coluna]");
        let draggedItem = null;

        cards.forEach(card => {
            card.addEventListener("dragstart", () => {
                draggedItem = card;
                setTimeout(() => card.style.display = "none", 0);
            });
            card.addEventListener("dragend", () => {
                if (draggedItem) { // Check if it wasn't dropped on a valid target
                    draggedItem.style.display = "block"; // Show it again
                }
                draggedItem = null;
            });
        });

        columns.forEach(column => {
            column.addEventListener("dragover", e => {
                e.preventDefault(); // Necessary to allow drop
            });
            column.addEventListener("dragenter", e => {
                e.preventDefault();
                column.classList.add("hovered"); // Visual feedback
            });
            column.addEventListener("dragleave", () => {
                column.classList.remove("hovered");
            });
            column.addEventListener("drop", async (e) => {
                e.preventDefault(); // Prevent default browser behavior
                if (draggedItem) {
                    const oldColumnCardsContainer = draggedItem.parentElement;
                    column.appendChild(draggedItem); // Move card to new column
                    draggedItem.style.display = "block"; // Ensure it's visible
                    
                    const projetoId = draggedItem.dataset.projetoId;
                    const novoEstado = column.dataset.estadoColuna;
                    
                    // Update project count on old and new column titles
                    const oldColumnEl = oldColumnCardsContainer.closest('.kanban-column');
                    const newColumnEl = column.closest('.kanban-column');
                    if(oldColumnEl && newColumnEl && oldColumnEl !== newColumnEl) {
                        const oldTitleEl = oldColumnEl.querySelector('.kanban-column-title');
                        const newTitleEl = newColumnEl.querySelector('.kanban-column-title');
                        if(oldTitleEl) oldTitleEl.textContent = `${KANBAN_COLUNAS_PROJETOS[oldColumnCardsContainer.dataset.estadoColuna].title} (${oldColumnCardsContainer.children.length})`;
                        if(newTitleEl) newTitleEl.textContent = `${KANBAN_COLUNAS_PROJETOS[novoEstado].title} (${column.children.length})`;
                    }
                    
                    await atualizarEstadoProjeto(projetoId, novoEstado);
                    // draggedItem is already set to null in dragend, but good practice
                    draggedItem = null; 
                }
                column.classList.remove("hovered");
            });
        });
    }

    async function atualizarEstadoProjeto(projetoId, novoEstado) {
        mostrarSpinnerProj(true); // Show spinner
        const { error } = await supabase
            .from("projetos")
            .update({ estado_projeto: novoEstado, updated_at: new Date().toISOString() })
            .eq("id", projetoId);
        
        mostrarSpinnerProj(false); // Hide spinner
        if (error) {
            console.error("Erro ao atualizar estado do projeto:", error);
            alert("Erro ao mover projeto. A visualização será recarregada.");
            await carregarProjetos(); // Recarregar para reverter visualmente e get fresh data
        } else {
            // Update local data to reflect change without full reload if preferred
            const projetoIndex = todosOsProjetos.findIndex(p => p.id.toString() === projetoId.toString());
            if (projetoIndex > -1) {
                todosOsProjetos[projetoIndex].estado_projeto = novoEstado;
            }
            // No need to call renderQuadroKanbanProjetos() again if counts updated manually, 
            // but a full carregarProjetos() is safer for data consistency if other things depend on status.
            // For now, we've updated counts manually. If other views (list, calendar) are visible/cached, they might be stale.
            console.log(`Projeto ${projetoId} atualizado para estado ${novoEstado}`);
        }
    }

    function renderTimelineProjetos() {
       timelineProjetosContainerEl.innerHTML = ''; // Clear placeholder or previous render

       if (todosOsProjetos.length === 0) {
           timelineProjetosContainerEl.innerHTML = '<p class="text-center">Nenhum projeto para exibir na timeline.</p>';
           return;
       }

       // Filter projects that have both start and end dates for the timeline
       const projectsWithDates = todosOsProjetos.filter(p => p.data_inicio && p.data_prazo);
       if (projectsWithDates.length === 0) {
           timelineProjetosContainerEl.innerHTML = '<p class="text-center">Nenhum projeto com datas de início e fim definidas para exibir na timeline.</p>';
           return;
       }

       // Determine overall date range for the timeline
       let minDate = new Date(projectsWithDates[0].data_inicio);
       let maxDate = new Date(projectsWithDates[0].data_prazo);
       projectsWithDates.forEach(p => {
           const startDate = new Date(p.data_inicio);
           const endDate = new Date(p.data_prazo);
           if (startDate < minDate) minDate = startDate;
           if (endDate > maxDate) maxDate = endDate;
       });

       // Add some padding to min/max dates for display
       minDate.setDate(minDate.getDate() - 7); // 1 week padding before
       maxDate.setDate(maxDate.getDate() + 7); // 1 week padding after
       
       const totalTimelineDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
       if (totalTimelineDays <= 0) {
            timelineProjetosContainerEl.innerHTML = '<p class="text-center">Intervalo de datas inválido para a timeline.</p>';
           return;
       }

       const timelineWrapper = document.createElement('div');
       timelineWrapper.style.position = 'relative';
       timelineWrapper.style.width = '100%';
       timelineWrapper.style.padding = '20px 0';
       // Could add month markers here later if desired

       projectsWithDates.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));

       projectsWithDates.forEach((p, index) => {
           const startDate = new Date(p.data_inicio);
           const endDate = new Date(p.data_prazo);
           
           const projectStartOffsetDays = (startDate - minDate) / (1000 * 60 * 60 * 24);
           const projectDurationDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24)); // Min 1 day duration for visibility

           const leftPercentage = (projectStartOffsetDays / totalTimelineDays) * 100;
           const widthPercentage = (projectDurationDays / totalTimelineDays) * 100;

           const projectBar = document.createElement('div');
           projectBar.className = 'project-timeline-bar';
           projectBar.style.position = 'absolute';
           projectBar.style.left = `${leftPercentage}%`;
           projectBar.style.width = `${widthPercentage}%`;
           projectBar.style.top = `${index * 40}px`; // Stack bars vertically
           projectBar.style.height = '30px';
           projectBar.style.borderRadius = '4px';
           projectBar.style.overflow = 'hidden';
           projectBar.style.whiteSpace = 'nowrap';
           projectBar.style.padding = '5px';
           projectBar.style.fontSize = '12px';
           projectBar.style.border = '1px solid #ccc';
           projectBar.title = `${p.nome_projeto} (${formatarData(p.data_inicio)} - ${formatarData(p.data_prazo)})`;
           
           // Use project status color (simplified)
           const estadoClass = getEstadoProjetoClass(p.estado_projeto); // Helper should be available
           if (estadoClass.includes('bg-green')) projectBar.style.backgroundColor = '#dcfce7'; // light green
           else if (estadoClass.includes('bg-blue')) projectBar.style.backgroundColor = '#dbeafe'; // light blue
           else if (estadoClass.includes('bg-yellow')) projectBar.style.backgroundColor = '#fef9c3'; // light yellow
           else projectBar.style.backgroundColor = '#f3f4f6'; // light gray

           projectBar.textContent = p.nome_projeto;
           
           // Make bar clickable to open details modal
           projectBar.dataset.projectId = p.id;
           projectBar.style.cursor = 'pointer';
           projectBar.addEventListener('click', () => abrirModalDetalhesProjeto(p.id));

           timelineWrapper.appendChild(projectBar);
       });
       
       // Set height of wrapper based on number of projects
       timelineWrapper.style.height = `${projectsWithDates.length * 40}px`;
       timelineProjetosContainerEl.appendChild(timelineWrapper);
       
       // Add month markers (basic example)
       const monthMarkerContainer = document.createElement('div');
       monthMarkerContainer.style.position = 'relative';
       monthMarkerContainer.style.width = '100%';
       monthMarkerContainer.style.height = '30px'; // Height for markers
       monthMarkerContainer.style.borderTop = '1px solid #eee';
       monthMarkerContainer.style.marginTop = `${projectsWithDates.length * 40 + 20}px`; // Below bars

       let currentMonth = new Date(minDate);
       while(currentMonth <= maxDate) {
           const monthStartOffsetDays = (currentMonth - minDate) / (1000 * 60 * 60 * 24);
           const monthLeftPercentage = (monthStartOffsetDays / totalTimelineDays) * 100;
           if (monthLeftPercentage >= 0 && monthLeftPercentage < 100) {
               const marker = document.createElement('div');
               marker.style.position = 'absolute';
               marker.style.left = `${monthLeftPercentage}%`;
               marker.style.width = '1px';
               marker.style.height = '10px'; // Short line
               marker.style.backgroundColor = '#aaa';
               
               const label = document.createElement('span');
               label.textContent = `${currentMonth.toLocaleString('pt-PT', { month: 'short' })}`;
               label.style.position = 'absolute';
               label.style.left = `${monthLeftPercentage}%`;
               label.style.top = '12px'; // Below the line
               label.style.fontSize = '10px';
               label.style.transform = 'translateX(-50%)'; // Center label
               
               monthMarkerContainer.appendChild(marker);
               monthMarkerContainer.appendChild(label);
           }
           currentMonth.setMonth(currentMonth.getMonth() + 1);
           currentMonth.setDate(1); // Go to start of next month
       }
       timelineProjetosContainerEl.appendChild(monthMarkerContainer);
   }

    function renderPaginacaoProjetos(totalItens) {
        projetosListaPaginacaoEl.innerHTML = '';
        if (!totalItens || totalItens <= itensPorPaginaProjetosLista) return;
        const totalPaginas = Math.ceil(totalItens / itensPorPaginaProjetosLista);
        for (let i = 1; i <= totalPaginas; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `action-button text-sm !p-2 mx-1 ${i === paginaAtualProjetosLista ? 'bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'}`;
            btn.addEventListener('click', () => { paginaAtualProjetosLista = i; carregarProjetos(); });
            projetosListaPaginacaoEl.appendChild(btn);
        }
    }
    
    function abrirModalFormProjeto(projetoId = null) {
        projetoFormEl.reset();
        projetoFormIdEl.value = '';
        Array.from(projetoFormMembrosEl.options).forEach(opt => opt.selected = false);

        if (projetoId) {
            const projeto = todosOsProjetos.find(p => p.id === projetoId);
            if (!projeto) { alert("Projeto não encontrado."); return; }
            projetoFormModalTitleEl.textContent = 'Editar Projeto';
            projetoFormIdEl.value = projeto.id;
            projetoFormNomeEl.value = projeto.nome_projeto;
            projetoFormTipoEl.value = projeto.tipo_projeto || '';
            projetoFormResponsavelPrincipalEl.value = projeto.user_id_responsavel_principal || projeto.responsavel?.id || '';
            projetoFormDataInicioEl.value = projeto.data_inicio ? projeto.data_inicio.split('T')[0] : '';
            projetoFormDataPrazoEl.value = projeto.data_prazo ? projeto.data_prazo.split('T')[0] : '';
            projetoFormOrcamentoEl.value = projeto.orcamento_previsto || '';
            projetoFormEstadoModalEl.value = projeto.estado_projeto;
            projetoFormDescricaoEl.value = projeto.descricao || '';
            projetoFormParqueEl.value = projeto.parque_id || '';
            
            if (projeto.membros) {
                projeto.membros.forEach(membroAssoc => {
                    const membroPerfil = membroAssoc.profiles; 
                    if (membroPerfil) {
                         const option = projetoFormMembrosEl.querySelector(`option[value="${membroPerfil.id}"]`);
                         if (option) option.selected = true;
                    }
                });
            }
        } else {
            projetoFormModalTitleEl.textContent = 'Novo Projeto';
            projetoFormEstadoModalEl.value = 'Planeado'; 
            const selfOption = Array.from(projetoFormResponsavelPrincipalEl.options).find(opt => opt.value === currentUser.id);
            if (selfOption) projetoFormResponsavelPrincipalEl.value = currentUser.id;
        }
        projetoFormModalEl.classList.add('active');
    }

    async function abrirModalDetalhesProjeto(projetoId) {
        const projeto = todosOsProjetos.find(p => p.id === projetoId); 
        if (!projeto) {
            console.log(`Projeto ID ${projetoId} não encontrado localmente, tentando buscar do Supabase...`);
            const { data: projetoRemoto, error: erroRemoto } = await supabase
                .from('projetos')
                .select(`
                    id, nome_projeto, tipo_projeto, orcamento_previsto, data_inicio, data_prazo, estado_projeto, descricao, parque_id,
                    responsavel:profiles!projetos_user_id_responsavel_principal_fkey (id, full_name, username),
                    membros:projeto_membros ( profiles (id, full_name) ),
                    tarefas (id, titulo, estado, data_prazo, user_id_atribuido_a, user_atribuido:profiles!tarefas_user_id_atribuido_a_fkey(full_name, username)),
                    despesas (valor)
                `)
                .eq('id', projetoId)
                .single();

            if (erroRemoto || !projetoRemoto) {
                console.error("Erro ao buscar projeto remoto ou projeto não encontrado:", erroRemoto);
                alert("Detalhes do projeto não puderam ser carregados."); return;
            }
            const projetoMapeado = {
                ...projetoRemoto,
                total_despesas: (projetoRemoto.despesas || []).reduce((sum, d) => sum + (d.valor || 0), 0),
                progresso_tarefas: calcularProgresso(projetoRemoto.tarefas || [])
            };
            const indexExistente = todosOsProjetos.findIndex(p => p.id === projetoMapeado.id);
            if (indexExistente > -1) {
                todosOsProjetos[indexExistente] = projetoMapeado;
            } else {
                todosOsProjetos.push(projetoMapeado); 
            }
            preencherModalDetalhesComDados(projetoMapeado); // Call preencher directly
            return; 
        }
        preencherModalDetalhesComDados(projeto); // Call preencher for locally found project
    }

    function preencherModalDetalhesComDados(projeto) { // Renamed function to avoid confusion with async one
        projetoDetalhesIdEl.value = projeto.id;
        projetoDetalhesModalTitleEl.textContent = `Detalhes: ${projeto.nome_projeto}`;
        detalheNomeProjetoEl.textContent = projeto.nome_projeto;
        detalheTipoProjetoEl.textContent = projeto.tipo_projeto || 'N/A';
        detalheResponsavelProjetoEl.textContent = projeto.responsavel?.full_name || projeto.responsavel?.username || 'N/A';
        detalheEstadoProjetoEl.innerHTML = `<span class="px-2 py-1 text-xs font-semibold rounded-full ${getEstadoProjetoClass(projeto.estado_projeto)}">${projeto.estado_projeto}</span>`;
        detalheDataInicioEl.textContent = formatarData(projeto.data_inicio);
        detalheDataPrazoEl.textContent = formatarData(projeto.data_prazo);
        detalheOrcamentoEl.textContent = formatarMoeda(projeto.orcamento_previsto);
        detalheDescricaoProjetoEl.textContent = projeto.descricao || 'Sem descrição.';

        detalheDespesasTotalEl.textContent = formatarMoeda(projeto.total_despesas);
        detalheSaldoOrcamentoEl.textContent = formatarMoeda((projeto.orcamento_previsto || 0) - projeto.total_despesas);
        if (((projeto.orcamento_previsto || 0) - projeto.total_despesas) < 0) {
            detalheSaldoOrcamentoEl.classList.add('text-red-600');
        } else {
            detalheSaldoOrcamentoEl.classList.remove('text-red-600');
        }
        
        detalheListaMembrosEl.innerHTML = '';
        (projeto.membros || []).forEach(membroAssoc => {
            const membro = membroAssoc.profiles;
            if(membro) {
                const li = document.createElement('li');
                li.textContent = membro.full_name || membro.username;
                detalheListaMembrosEl.appendChild(li);
            }
        });
        if (detalheListaMembrosEl.children.length === 0) detalheListaMembrosEl.innerHTML = '<li>Nenhum membro atribuído.</li>';

        const tarefasDoProjeto = projeto.tarefas || [];
        detalheTarefasPendentesEl.textContent = tarefasDoProjeto.filter(t => t.estado === 'Pendente' || t.estado === 'Bloqueada').length;
        detalheTarefasProgressoEl.textContent = tarefasDoProjeto.filter(t => t.estado === 'Em Progresso').length;
        detalheTarefasConcluidasEl.textContent = tarefasDoProjeto.filter(t => t.estado === 'Concluída').length;
        
        detalheListaTarefasContainerEl.innerHTML = ''; 
        if (tarefasDoProjeto.length > 0) {
            const listElement = document.createElement('div');
            listElement.className = 'space-y-2'; 

            tarefasDoProjeto.forEach(t => {
                const taskItem = document.createElement('div');
                taskItem.className = 'p-2 border rounded-md hover:bg-gray-50 cursor-pointer';
                taskItem.dataset.taskId = t.id; 

                const atribuidoNome = t.user_atribuido?.full_name || t.user_atribuido?.username || 'N/A';
                const prazoFormatado = t.data_prazo ? formatarData(t.data_prazo) : 'N/A'; 

                taskItem.innerHTML = `
                    <div class="font-semibold">${t.titulo || 'Tarefa sem título'}</div>
                    <div class="text-xs text-gray-600">
                        Atribuído a: ${atribuidoNome} | Prazo: ${prazoFormatado}
                    </div>
                    <div class="text-xs">
                        Estado: <span class="px-1 py-0.5 rounded-full ${getEstadoTarefaClassProj(t.estado)}">${t.estado}</span>
                    </div>
                `;
                listElement.appendChild(taskItem);
            });
            detalheListaTarefasContainerEl.appendChild(listElement);
        } else {
            detalheListaTarefasContainerEl.innerHTML = '<p class="text-xs text-gray-500">Nenhuma tarefa associada.</p>';
        }

        const despesasDoProjeto = projeto.despesas || [];
        detalheListaDespesasContainerEl.innerHTML = '<ul class="list-disc list-inside"></ul>';
        const ulDespesas = detalheListaDespesasContainerEl.querySelector('ul');
        if (despesasDoProjeto.length > 0) {
            despesasDoProjeto.slice(0,10).forEach(d => {
                const li = document.createElement('li');
                li.textContent = `${formatarMoeda(d.valor)} (a implementar ligação à despesa)`;
                ulDespesas.appendChild(li);
            });
             if(despesasDoProjeto.length > 10) ulDespesas.innerHTML += '<li class="text-xs text-gray-500">... e mais.</li>';
        } else {
            ulDespesas.innerHTML = '<li class="text-xs text-gray-500">Nenhuma despesa associada.</li>';
        }
        projetoDetalhesModalEl.classList.add('active');

        // Add event listener for clickable tasks
        // Clone and replace to ensure old listeners are removed if any
        const newDetalheListaTarefasContainerEl = detalheListaTarefasContainerEl.cloneNode(true);
        detalheListaTarefasContainerEl.parentNode.replaceChild(newDetalheListaTarefasContainerEl, detalheListaTarefasContainerEl);
        detalheListaTarefasContainerEl = newDetalheListaTarefasContainerEl; // Update reference

        detalheListaTarefasContainerEl.addEventListener('click', (e) => {
            const taskItem = e.target.closest('[data-task-id]');
            if (taskItem && taskItem.dataset.taskId) {
                const taskId = taskItem.dataset.taskId;
                localStorage.setItem('selectedTaskIdForTarefas', taskId); 
                window.location.href = 'Tarefas.html';
            }
        });
    }


    async function submeterFormProjeto(event) {
        event.preventDefault();
        const id = projetoFormIdEl.value;

        const dadosProjeto = {
            nome_projeto: projetoFormNomeEl.value,
            tipo_projeto: projetoFormTipoEl.value || null,
            user_id_responsavel_principal: projetoFormResponsavelPrincipalEl.value,
            data_inicio: projetoFormDataInicioEl.value || null,
            data_prazo: projetoFormDataPrazoEl.value || null,
            orcamento_previsto: parseFloat(projetoFormOrcamentoEl.value) || null,
            estado_projeto: projetoFormEstadoModalEl.value,
            descricao: projetoFormDescricaoEl.value || null,
            parque_id: projetoFormParqueEl.value || null,
            updated_at: new Date().toISOString()
        };
        
        const membrosSelecionadosIds = Array.from(projetoFormMembrosEl.selectedOptions).map(opt => opt.value);

        mostrarSpinnerProj();
        let projetoSalvo, erroSupabase;

        if (id) { 
            const { data, error } = await supabase.from('projetos').update(dadosProjeto).eq('id', id).select().single();
            projetoSalvo = data; erroSupabase = error;
        } else { 
            dadosProjeto.user_id_criador = currentUser.id; 
            const { data, error } = await supabase.from('projetos').insert(dadosProjeto).select().single();
            projetoSalvo = data; erroSupabase = error;
        }

        if (erroSupabase) {
            mostrarSpinnerProj(false);
            console.error("Erro ao guardar projeto:", erroSupabase);
            alert(`Erro: ${erroSupabase.message}`);
            return;
        }

        if (projetoSalvo) {
            const { error: deleteError } = await supabase.from('projeto_membros').delete().eq('projeto_id', projetoSalvo.id);
            if (deleteError) console.error("Erro ao limpar membros antigos:", deleteError);

            if (membrosSelecionadosIds.length > 0) {
                const membrosParaInserir = membrosSelecionadosIds.map(userId => ({
                    projeto_id: projetoSalvo.id,
                    user_id_membro: userId
                }));
                const { error: insertMembrosError } = await supabase.from('projeto_membros').insert(membrosParaInserir);
                if (insertMembrosError) console.error("Erro ao adicionar novos membros:", insertMembrosError);
            }
        }
        
        mostrarSpinnerProj(false);
        projetoFormModalEl.classList.remove('active');
        await carregarProjetos(); 
        await carregarDadosIniciaisProjetos(); 
    }

    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (projetoAplicarFiltrosBtnEl) projetoAplicarFiltrosBtnEl.addEventListener('click', () => { paginaAtualProjetosLista = 1; carregarProjetos(); });
    if (projetoViewModeEl) projetoViewModeEl.addEventListener('change', renderizarVistaAtualProjetos);
    if (projetoNovoBtnEl) projetoNovoBtnEl.addEventListener('click', () => abrirModalFormProjeto());
    
    projFecharFormModalBtns.forEach(btn => btn.addEventListener('click', () => projetoFormModalEl.classList.remove('active')));
    if (projetoFormEl) projetoFormEl.addEventListener('submit', submeterFormProjeto);

    projFecharDetalhesModalBtns.forEach(btn => btn.addEventListener('click', () => projetoDetalhesModalEl.classList.remove('active')));
    if(projEditarDesdeDetalhesBtnEl) {
        projEditarDesdeDetalhesBtnEl.addEventListener('click', () => {
            const projetoId = projetoDetalhesIdEl.value;
            if(projetoId) {
                projetoDetalhesModalEl.classList.remove('active'); 
                abrirModalFormProjeto(projetoId); 
            }
        });
    }
    
    projetosTableBodyEl.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        const id = target.dataset.id;
        if (target.classList.contains('proj-editar-btn')) {
            abrirModalFormProjeto(id);
        } else if (target.classList.contains('proj-detalhes-btn')) {
            abrirModalDetalhesProjeto(id);
        }
    });
    kanbanProjetosBoardEl.addEventListener('click', (e) => {
        const card = e.target.closest('.kanban-card');
        if (card && card.dataset.projetoId) {
            abrirModalDetalhesProjeto(card.dataset.projetoId);
        }
    });

    async function initProjetosPage() {
        if (!userProfile) { alert("Perfil do utilizador não carregado."); return; }

        const deepLinkedProjectId = localStorage.getItem("selectedProjectIdForProjetos");
        if (deepLinkedProjectId) {
            localStorage.removeItem("selectedProjectIdForProjetos");
            await carregarDadosIniciaisProjetos(); 
            await carregarProjetos(); 
            abrirModalDetalhesProjeto(deepLinkedProjectId); 
        } else {
            await carregarDadosIniciaisProjetos();
            await carregarProjetos();
        }
        console.log("Subaplicação de Projetos inicializada.");
    }

    initProjetosPage();
});

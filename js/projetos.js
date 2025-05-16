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

    // --- Carregar Dados Iniciais (Utilizadores, Parques, Tipos de Projeto) ---
    async function carregarDadosIniciaisProjetos() {
        const { data: usersData, error: usersError } = await supabase.from('profiles').select('id, full_name, username, role');
        if (usersError) console.error("Erro ao carregar utilizadores para projetos:", usersError);
        else todosOsUsuariosSistemaProj = usersData || [];

        const { data: parquesData, error: parquesError } = await supabase.from('parques').select('id, nome');
        if (parquesError) console.error("Erro ao carregar parques para projetos:", parquesError);
        else listaParquesGlobProj = parquesData || [];
        
        // Carregar tipos de projeto distintos da própria tabela de projetos
        const { data: tiposData, error: tiposError } = await supabase.rpc('get_distinct_tipos_projeto'); // Criar esta RPC
        if (tiposError) console.error("Erro ao carregar tipos de projeto:", tiposError);
        else tiposDeProjetoDistintos = tiposData ? tiposData.map(t => t.tipo_projeto) : [];


        popularSelectsProjetos();
    }

    function popularSelectsProjetos() {
        // Filtro de Utilizador (Responsável/Membro)
        projetoFiltroUserEl.innerHTML = `
            <option value="meus_associados">Meus Projetos</option>
            <option value="todos_subordinados">Minha Equipa/Subordinados</option>
            ${userProfile.role === 'super_admin' || userProfile.role === 'admin' ? '<option value="todos_geral">Todos os Projetos</option>' : ''}
        `;
        // Adicionar utilizadores específicos se necessário (para super_admin ver projetos de X)

        // Select de Responsável Principal no Modal
        projetoFormResponsavelPrincipalEl.innerHTML = '<option value="">Selecione Responsável</option>';
        todosOsUsuariosSistemaProj.forEach(u => {
            // Idealmente, filtrar por roles que podem ser responsáveis
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.full_name || u.username;
            projetoFormResponsavelPrincipalEl.appendChild(opt);
        });

        // Select de Membros no Modal
        projetoFormMembrosEl.innerHTML = ''; // Limpar
        todosOsUsuariosSistemaProj.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.full_name || u.username;
            projetoFormMembrosEl.appendChild(opt);
        });
        
        // Select de Parque no Modal
        projetoFormParqueEl.innerHTML = '<option value="">Nenhum</option>';
        listaParquesGlobProj.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nome;
            projetoFormParqueEl.appendChild(opt);
        });

        // Filtro de Tipo de Projeto
        projetoFiltroTipoEl.innerHTML = '<option value="">Todos</option>';
        tiposDeProjetoDistintos.forEach(tipo => {
            if(tipo) { // Ignorar nulos/vazios
                const opt = document.createElement('option');
                opt.value = tipo;
                opt.textContent = tipo;
                projetoFiltroTipoEl.appendChild(opt);
            }
        });
    }

    // --- Lógica de Projetos (CRUD e Visualização) ---
    async function carregarProjetos() {
        mostrarSpinnerProj();
        const filtroUser = projetoFiltroUserEl.value;
        const estado = projetoFiltroEstadoEl.value;
        const tipo = projetoFiltroTipoEl.value;
        const prazoDe = projetoFiltroPrazoDeEl.value;
        const prazoAte = projetoFiltroPrazoAteEl.value;

        // Esta query é complexa devido às permissões e associações.
        // Uma RPC no Supabase (`get_projetos_para_utilizador`) seria muito mais eficiente e segura.
        // A RPC receberia currentUser.id e userProfile.role e os filtros.
        // Por agora, uma simulação simplificada da lógica de permissão no cliente:

        let query = supabase.from('projetos').select(`
            id, nome_projeto, tipo_projeto, orcamento_previsto, data_inicio, data_prazo, estado_projeto,
            responsavel:profiles!projetos_user_id_responsavel_principal_fkey (id, full_name, username),
            membros:projeto_membros ( profiles (id, full_name) ),
            tarefas (id, estado),
            despesas (valor)
        `, { count: 'exact' });

        // Filtros básicos
        if (estado) query = query.eq('estado_projeto', estado);
        if (tipo) query = query.eq('tipo_projeto', tipo);
        if (prazoDe) query = query.gte('data_prazo', prazoDe);
        if (prazoAte) query = query.lte('data_prazo', prazoAte);
        
        // Filtro de permissão (MUITO SIMPLIFICADO - IDEALMENTE FEITO NO BACKEND COM RLS/RPC)
        if (filtroUser === 'meus_associados') {
            query = query.or(`user_id_responsavel_principal.eq.${currentUser.id},membros.user_id_membro.eq.${currentUser.id}`);
        } else if (filtroUser === 'todos_subordinados') {
            // TODO: Obter lista de IDs de subordinados e adicionar ao filtro 'or'
            // query = query.or(`user_id_responsavel_principal.eq.${currentUser.id},membros.user_id_membro.eq.${currentUser.id},user_id_responsavel_principal.in.(${lista_ids_subordinados})`);
             query = query.or(`user_id_responsavel_principal.eq.${currentUser.id},membros.user_id_membro.eq.${currentUser.id}`); // Placeholder
        } else if (filtroUser && filtroUser !== 'todos_geral') { // Ver projetos de um user específico (se permissão)
            if (userProfile.role === 'super_admin' || userProfile.role === 'admin') { // Admins podem ver de outros
                query = query.or(`user_id_responsavel_principal.eq.${filtroUser},membros.user_id_membro.eq.${filtroUser}`);
            } else { // Se não é admin, só pode ver os seus ou da equipa, mesmo que selecione outro user
                 query = query.or(`user_id_responsavel_principal.eq.${currentUser.id},membros.user_id_membro.eq.${currentUser.id}`);
            }
        } else if (filtroUser === 'todos_geral' && userProfile.role !== 'super_admin' && userProfile.role !== 'admin') {
            query = query.or(`user_id_responsavel_principal.eq.${currentUser.id},membros.user_id_membro.eq.${currentUser.id}`);
        }
        // Se super_admin e 'todos_geral', não aplica filtro de user


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
        // Similar a getEstadoClass de tarefas.js, adaptar para estados de projeto
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
                KANBAN_COLUNAS_PROJETOS['Planeado'].projects.push(p); // Fallback
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
                card.dataset.projetoId = p.id; // Para drag & drop ou clique
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
        // TODO: setupKanbanDragAndDropProjetos(); (se quiser mover projetos entre colunas)
    }

    function renderTimelineProjetos() {
        timelineProjetosContainerEl.innerHTML = '<p class="text-center">Vista de Timeline/Gantt (a implementar com FullCalendar ou similar).</p>';
        // TODO: Inicializar e popular o FullCalendar com `todosOsProjetos`
        // Eventos seriam os projetos, com 'start': p.data_inicio, 'end': p.data_prazo
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
    
    // --- Modais (Formulário e Detalhes) ---
    function abrirModalFormProjeto(projetoId = null) {
        projetoFormEl.reset();
        projetoFormIdEl.value = '';
        // Limpar select de múltiplos membros
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
            
            // Selecionar membros
            if (projeto.membros) {
                projeto.membros.forEach(membroAssoc => {
                    const membroPerfil = membroAssoc.profiles; // A relação está em membroAssoc.profiles
                    if (membroPerfil) {
                         const option = projetoFormMembrosEl.querySelector(`option[value="${membroPerfil.id}"]`);
                         if (option) option.selected = true;
                    }
                });
            }

        } else {
            projetoFormModalTitleEl.textContent = 'Novo Projeto';
            projetoFormEstadoModalEl.value = 'Planeado'; // Default
            // Responsável principal pode ser o user atual por defeito
            const selfOption = Array.from(projetoFormResponsavelPrincipalEl.options).find(opt => opt.value === currentUser.id);
            if (selfOption) projetoFormResponsavelPrincipalEl.value = currentUser.id;
        }
        projetoFormModalEl.classList.add('active');
    }

    async function abrirModalDetalhesProjeto(projetoId) {
        const projeto = todosOsProjetos.find(p => p.id === projetoId); // Usar dados já carregados
        if (!projeto) {
            // Se não estiver em todosOsProjetos (ex: clicado de um link externo), buscar do Supabase
            // const {data, error} = await supabase.from('projetos').select(...).eq('id', projetoId).single(); ...
            alert("Detalhes do projeto não encontrados localmente."); return;
        }
        
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

        // Calcular e mostrar despesas e saldo
        // const { data: despesasDoProjeto, error: erroDespesas } = await supabase.from('despesas').select('valor').eq('projeto_id', projeto.id);
        // const totalDespesasProjeto = erroDespesas ? 0 : (despesasDoProjeto || []).reduce((sum, d) => sum + d.valor, 0);
        // Usar o total_despesas já calculado ao carregar projetos
        detalheDespesasTotalEl.textContent = formatarMoeda(projeto.total_despesas);
        detalheSaldoOrcamentoEl.textContent = formatarMoeda((projeto.orcamento_previsto || 0) - projeto.total_despesas);
        if (((projeto.orcamento_previsto || 0) - projeto.total_despesas) < 0) {
            detalheSaldoOrcamentoEl.classList.add('text-red-600');
        } else {
            detalheSaldoOrcamentoEl.classList.remove('text-red-600');
        }
        
        // Membros
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

        // Tarefas (contagens e lista simplificada)
        // const { data: tarefasDoProjeto, error: erroTarefas } = await supabase.from('tarefas').select('id, titulo, estado').eq('projeto_id', projeto.id);
        // Usar as tarefas já carregadas com o projeto
        const tarefasDoProjeto = projeto.tarefas || [];
        detalheTarefasPendentesEl.textContent = tarefasDoProjeto.filter(t => t.estado === 'Pendente' || t.estado === 'Bloqueada').length;
        detalheTarefasProgressoEl.textContent = tarefasDoProjeto.filter(t => t.estado === 'Em Progresso').length;
        detalheTarefasConcluidasEl.textContent = tarefasDoProjeto.filter(t => t.estado === 'Concluída').length;
        
        detalheListaTarefasContainerEl.innerHTML = '<ul class="list-disc list-inside"></ul>';
        const ulTarefas = detalheListaTarefasContainerEl.querySelector('ul');
        if (tarefasDoProjeto.length > 0) {
            tarefasDoProjeto.slice(0, 10).forEach(t => { // Mostrar as primeiras 10, por exemplo
                const li = document.createElement('li');
                li.innerHTML = `${t.titulo} <span class="text-xs px-1 py-0.5 rounded ${getEstadoClass(t.estado)}">${t.estado}</span>`;
                ulTarefas.appendChild(li);
            });
            if(tarefasDoProjeto.length > 10) ulTarefas.innerHTML += '<li class="text-xs text-gray-500">... e mais.</li>';
        } else {
            ulTarefas.innerHTML = '<li class="text-xs text-gray-500">Nenhuma tarefa associada.</li>';
        }

        // Despesas (lista simplificada)
        // Usar as despesas já carregadas com o projeto
        const despesasDoProjeto = projeto.despesas || []; // Assumindo que 'despesas' foi selecionado no join
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

        if (id) { // Edição
            const { data, error } = await supabase.from('projetos').update(dadosProjeto).eq('id', id).select().single();
            projetoSalvo = data; erroSupabase = error;
        } else { // Criação
            dadosProjeto.user_id_criador = currentUser.id; // Adicionar quem criou
            const { data, error } = await supabase.from('projetos').insert(dadosProjeto).select().single();
            projetoSalvo = data; erroSupabase = error;
        }

        if (erroSupabase) {
            mostrarSpinnerProj(false);
            console.error("Erro ao guardar projeto:", erroSupabase);
            alert(`Erro: ${erroSupabase.message}`);
            return;
        }

        // Gerir membros (apagar os antigos não selecionados, adicionar os novos)
        if (projetoSalvo) {
            // 1. Apagar todas as associações de membros existentes para este projeto
            const { error: deleteError } = await supabase.from('projeto_membros').delete().eq('projeto_id', projetoSalvo.id);
            if (deleteError) console.error("Erro ao limpar membros antigos:", deleteError);

            // 2. Inserir os novos membros selecionados
            if (membrosSelecionadosIds.length > 0) {
                const membrosParaInserir = membrosSelecionadosIds.map(userId => ({
                    projeto_id: projetoSalvo.id,
                    user_id_membro: userId
                    // role_no_projeto: 'Membro Equipa' // Default role
                }));
                const { error: insertMembrosError } = await supabase.from('projeto_membros').insert(membrosParaInserir);
                if (insertMembrosError) console.error("Erro ao adicionar novos membros:", insertMembrosError);
            }
        }
        
        mostrarSpinnerProj(false);
        projetoFormModalEl.classList.remove('active');
        await carregarProjetos(); // Recarrega a vista atual
        await carregarDadosIniciaisProjetos(); // Para atualizar o filtro de tipo de projeto se um novo foi criado
    }


    // --- Event Listeners ---
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
                projetoDetalhesModalEl.classList.remove('active'); // Fechar detalhes
                abrirModalFormProjeto(projetoId); // Abrir form de edição
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
    // Adicionar listener para cliques nos cards do Kanban para abrir detalhes
    kanbanProjetosBoardEl.addEventListener('click', (e) => {
        const card = e.target.closest('.kanban-card');
        if (card && card.dataset.projetoId) {
            abrirModalDetalhesProjeto(card.dataset.projetoId);
        }
    });


    // --- Inicialização ---
    async function initProjetosPage() {
        if (!userProfile) { alert("Perfil do utilizador não carregado."); return; }
        await carregarDadosIniciaisProjetos();
        await carregarProjetos();
        console.log("Subaplicação de Projetos inicializada.");
    }

    initProjetosPage();
});

// js/acessos_alteracoes.js

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Acessos/Alterações.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile')); // Assume 'role', 'id'

    // --- Seletores DOM Globais da Subapp ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnAcessos');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabLogSistemaEl = document.getElementById('tabLogSistema'); // Para mostrar/esconder

    // --- Seletores DOM: Gestão de Utilizadores ---
    const gestaoUtilizadoresContentEl = document.getElementById('gestaoUtilizadoresContent');
    const novoUtilizadorBtnEl = document.getElementById('aaNovoUtilizadorBtn');
    const formNovoUtilizadorSecaoEl = document.getElementById('aaFormNovoUtilizadorSecao');
    const formUtilizadorTitleEl = document.getElementById('aaFormUtilizadorTitle');
    const novoUtilizadorFormEl = document.getElementById('aaNovoUtilizadorForm');
    const utilizadorFormProfileIdEl = document.getElementById('aaUtilizadorFormProfileId'); // ID do profile de RH
    const utilizadorFormAuthIdEl = document.getElementById('aaUtilizadorFormAuthId'); // ID do auth.users para edição
    const selectFuncionarioRHEl = document.getElementById('aaSelectFuncionarioRH');
    const userEmailEl = document.getElementById('aaUserEmail');
    const userPasswordEl = document.getElementById('aaUserPassword');
    const userRoleEl = document.getElementById('aaUserRole');
    const cancelarNovoUtilizadorBtnEl = document.getElementById('aaCancelarNovoUtilizadorBtn');
    const novoUtilizadorStatusEl = document.getElementById('aaNovoUtilizadorStatus');
    
    const filtroUserNomeEmailEl = document.getElementById('aaFiltroUserNomeEmail');
    const filtroUserRoleEl = document.getElementById('aaFiltroUserRole');
    const aplicarFiltrosUserBtnEl = document.getElementById('aaAplicarFiltrosUserBtn');
    const loadingUsersSpinnerEl = document.getElementById('loadingAAUsersSpinner');
    const utilizadoresTableBodyEl = document.getElementById('aaUtilizadoresTableBody');
    const utilizadoresNenhumMsgEl = document.getElementById('aaUtilizadoresNenhumMsg');
    const usersPaginacaoEl = document.getElementById('aaUsersPaginacao');

    // --- Seletores DOM: Log do Sistema ---
    const logSistemaContentEl = document.getElementById('logSistemaContent');
    const logFiltroDataInicioEl = document.getElementById('logFiltroDataInicio');
    const logFiltroDataFimEl = document.getElementById('logFiltroDataFim');
    const logFiltroUtilizadorEl = document.getElementById('logFiltroUtilizador');
    const logFiltroSubAppEl = document.getElementById('logFiltroSubApp');
    const logFiltroTipoAcaoEl = document.getElementById('logFiltroTipoAcao');
    const logFiltroRecursoIdEl = document.getElementById('logFiltroRecursoId');
    const logAplicarFiltrosBtnEl = document.getElementById('logAplicarFiltrosBtn');
    const loadingLogsSpinnerEl = document.getElementById('loadingAALogsSpinner');
    const logsTableBodyEl = document.getElementById('aaLogsTableBody');
    const logsNenhumMsgEl = document.getElementById('aaLogsNenhumMsg');
    const logsPaginacaoEl = document.getElementById('aaLogsPaginacao');

    // --- Estado da Aplicação ---
    let paginaAtualUsers = 1;
    const itensPorPaginaUsers = 10;
    let paginaAtualLogs = 1;
    const itensPorPaginaLogs = 20;
    let todosFuncionariosRHDisponiveis = []; // Profiles sem auth_user_id
    let todasRolesSistema = []; // Lista de roles e sua hierarquia
    let todasSubAppsParaFiltro = []; // Lista de subaplicações para filtro de logs

    // Definir roles e hierarquia (pode vir do Supabase no futuro)
    // Nível 0 é o mais alto. Um user só pode atribuir roles de nível >= ao seu. Super Admin (0) pode atribuir tudo.
    const ROLES_HIERARQUIA = [
        { nome: "super_admin", display: "Super Administrador", nivel: 0 },
        { nome: "admin", display: "Administrador", nivel: 1 },
        { nome: "supervisor", display: "Supervisor", nivel: 2 },
        { nome: "back_office", display: "Back Office", nivel: 3 },
        { nome: "front_office", display: "Front Office", nivel: 3 }, // Mesmo nível que back_office
        { nome: "operador_recolhas", display: "Operador Recolhas", nivel: 4 },
        { nome: "operador_caixa", display: "Operador Caixa", nivel: 4 },
        { nome: "cliente", display: "Cliente (App Externa)", nivel: 5 } // Se aplicável
    ];


    // --- Funções Auxiliares ---
    function formatarDataHora(dataISO) { return dataISO ? new Date(dataISO).toLocaleString('pt-PT', {dateStyle:'short', timeStyle:'short'}) : 'N/A'; }
    function mostrarSpinner(id, show = true) { document.getElementById(id)?.classList.toggle('hidden', !show); }

    // --- Navegação por Abas e Permissões ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            if (tabId === "logSistema" && userProfile?.role !== 'super_admin') {
                alert("Apenas Super Administradores podem aceder ao Log do Sistema.");
                return;
            }
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(tabId + 'Content').classList.add('active');

            if (tabId === 'gestaoUtilizadores') {
                carregarFuncionariosParaNovoUtilizadorSelect();
                popularSelectRolesParaFiltro();
                carregarUtilizadoresSistema();
            } else if (tabId === 'logSistema') {
                popularSelectSubAppsParaFiltro();
                carregarLogsSistema();
            }
        });
    });

    function verificarPermissaoAcessoModulo() {
        const rolesPermitidasGestaoUsers = ['super_admin', 'admin', 'supervisor', 'back_office', 'front_office']; // Quem pode ver Gestão de Users
        const podeAcederGestaoUsers = userProfile && rolesPermitidasGestaoUsers.includes(userProfile.role);
        const podeAcederLogs = userProfile && userProfile.role === 'super_admin';

        if (!podeAcederGestaoUsers && !podeAcederLogs) {
            alert("Não tem permissão para aceder a este módulo.");
            window.location.href = 'index.html'; // Volta ao dashboard principal
            return false;
        }
        if (!podeAcederLogs) {
            tabLogSistemaEl.classList.add('hidden'); // Esconde a aba de logs
            // Se a aba de logs estiver ativa por defeito e o user não for super_admin, muda para a primeira aba
            if (document.querySelector('.tab-button[data-tab="logSistema"].active')) {
                tabButtons[0].click();
            }
        } else {
            tabLogSistemaEl.classList.remove('hidden');
        }
        return true;
    }

    // --- Gestão de Utilizadores ---
    async function carregarFuncionariosParaNovoUtilizadorSelect() {
        // Buscar profiles que AINDA NÃO têm um auth_user_id associado
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, username, email') // 'id' aqui é o PK da tabela profiles
            .is('auth_user_id', null) // Onde a FK para auth.users está nula
            .order('full_name');

        if (error) {
            console.error("Erro ao carregar funcionários de RH disponíveis:", error);
            selectFuncionarioRHEl.innerHTML = '<option value="">Erro ao carregar</option>';
            return;
        }
        todosFuncionariosRHDisponiveis = data || [];
        selectFuncionarioRHEl.innerHTML = '<option value="">Selecione um funcionário de RH...</option>';
        todosFuncionariosRHDisponiveis.forEach(func => {
            const opt = document.createElement('option');
            opt.value = func.id; // Este é o profile.id
            opt.textContent = `${func.full_name || func.username} (${func.email || 'Sem email no perfil'})`;
            opt.dataset.email = func.email || ''; // Guardar email para preencher automaticamente
            selectFuncionarioRHEl.appendChild(opt);
        });
    }
    
    selectFuncionarioRHEl.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption && selectedOption.dataset.email) {
            userEmailEl.value = selectedOption.dataset.email;
        } else {
            userEmailEl.value = '';
        }
    });


    function popularSelectRolesParaCriacao() {
        userRoleEl.innerHTML = '<option value="">Selecione uma Posição...</option>';
        const nivelUserAtual = ROLES_HIERARQUIA.find(r => r.nome === userProfile?.role)?.nivel ?? 99;

        ROLES_HIERARQUIA.forEach(role => {
            // Super admin pode dar qualquer role. Outros só podem dar roles de nível igual ou inferior.
            // E não podem dar roles "superiores" (menor nível numérico).
            if (userProfile?.role === 'super_admin' || (role.nivel >= nivelUserAtual && role.nome !== 'super_admin' && (userProfile?.role !== 'admin' || role.nome !== 'admin'))) {
                 if(userProfile?.role !== 'super_admin' && role.nome === 'admin' && userProfile?.role !== 'admin') return; // Ninguém além de super_admin pode criar admin, exceto o próprio admin para outros admins
                 if(userProfile?.role !== 'super_admin' && role.nome === 'super_admin') return; // Ninguém além de super_admin pode criar super_admin

                const opt = document.createElement('option');
                opt.value = role.nome;
                opt.textContent = role.display;
                userRoleEl.appendChild(opt);
            }
        });
    }
    
    function popularSelectRolesParaFiltro() {
        filtroUserRoleEl.innerHTML = '<option value="">Todas</option>';
        ROLES_HIERARQUIA.forEach(role => {
            const opt = document.createElement('option');
            opt.value = role.nome;
            opt.textContent = role.display;
            filtroUserRoleEl.appendChild(opt);
        });
    }


    novoUtilizadorBtnEl.addEventListener('click', () => {
        formNovoUtilizadorSecaoEl.classList.remove('hidden');
        formUtilizadorTitleEl.textContent = 'Criar Novo Utilizador do Sistema';
        novoUtilizadorFormEl.reset();
        utilizadorFormProfileIdEl.value = '';
        utilizadorFormAuthIdEl.value = '';
        userPasswordEl.setAttribute('required', 'required'); // Password é obrigatória para novos users
        popularSelectRolesParaCriacao(); // Popular com base nas permissões do user logado
    });
    cancelarNovoUtilizadorBtnEl.addEventListener('click', () => {
        formNovoUtilizadorSecaoEl.classList.add('hidden');
    });

    novoUtilizadorFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const profileIdSelecionado = selectFuncionarioRHEl.value; // Este é o ID da tabela `profiles`
        const email = userEmailEl.value;
        const password = userPasswordEl.value;
        const roleSelecionado = userRoleEl.value;
        const editAuthUserId = utilizadorFormAuthIdEl.value; // Se estiver a editar um auth user

        if (!profileIdSelecionado && !editAuthUserId) { // Se for novo, precisa de um profile de RH
            alert("Selecione um funcionário de Recursos Humanos para associar a este utilizador.");
            return;
        }
        if (!email || !roleSelecionado) {
            alert("Email e Posição são obrigatórios.");
            return;
        }
        if (!editAuthUserId && !password) { // Password obrigatória para novos users
             alert("Palavra-passe é obrigatória para novos utilizadores.");
            return;
        }


        novoUtilizadorStatusEl.textContent = 'A processar...';
        novoUtilizadorStatusEl.className = 'mt-2 text-sm text-blue-600';

        try {
            let authUserId = editAuthUserId;
            let operacao = editAuthUserId ? "atualizado" : "criado";

            if (!editAuthUserId) { // Criar novo utilizador no Supabase Auth
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                });
                if (signUpError) throw signUpError;
                if (!signUpData.user) throw new Error("Criação do utilizador no Auth não retornou dados.");
                authUserId = signUpData.user.id;
            } else if (password) { // Se editando e password fornecida, atualizar password
                 const { error: updatePassError } = await supabase.auth.admin.updateUserById(authUserId, { password: password });
                 if (updatePassError) throw updatePassError;
            }
            
            // Atualizar/Associar o perfil na tabela `profiles`
            // O ID do profile já temos (profileIdSelecionado)
            // Vamos atualizar o auth_user_id e o role nesse profile
            const profileParaAtualizarId = editAuthUserId ? utilizadorFormProfileIdEl.value : profileIdSelecionado;

            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    auth_user_id: authUserId, // Link para o auth.users.id
                    role: roleSelecionado,
                    email: email // Pode ser útil ter o email de login também no profile
                })
                .eq('id', profileParaAtualizarId); // Onde 'id' é o PK da tabela profiles

            if (profileError) throw profileError;

            novoUtilizadorStatusEl.textContent = `Utilizador ${operacao} e perfil associado/atualizado com sucesso!`;
            novoUtilizadorStatusEl.className = 'mt-2 text-sm text-green-600';
            novoUtilizadorFormEl.reset();
            formNovoUtilizadorSecaoEl.classList.add('hidden');
            await carregarFuncionariosParaNovoUtilizadorSelect(); // Atualizar lista de disponíveis
            await carregarUtilizadoresSistema(); // Atualizar tabela de users do sistema
        } catch (error) {
            console.error(`Erro ao ${editAuthUserId ? 'atualizar' : 'criar'} utilizador:`, error);
            novoUtilizadorStatusEl.textContent = `Erro: ${error.message}`;
            novoUtilizadorStatusEl.className = 'mt-2 text-sm text-red-600';
        }
    });
    
    async function carregarUtilizadoresSistema(pagina = 1) {
        paginaAtualUsers = pagina;
        mostrarSpinner('loadingAAUsersSpinner', true);
        utilizadoresTableBodyEl.innerHTML = '';
        utilizadoresNenhumMsgEl.classList.add('hidden');

        // Esta query assume que `profiles.id` é a FK para `auth.users.id`
        // Se `profiles.auth_user_id` é a FK, a query precisa ser ajustada.
        // Vamos assumir que profiles.id = auth.users.id (padrão do trigger Supabase)
        // OU que profiles tem uma coluna auth_user_id que é a FK.
        // A segunda abordagem é mais flexível se profiles são criados antes dos users auth.

        let query = supabase.from('profiles')
            .select(`
                id, auth_user_id, full_name, username, email, role,
                auth_user:auth_users!profiles_auth_user_id_fkey (last_sign_in_at, created_at)
            `, { count: 'exact' })
            .not('auth_user_id', 'is', null); // Apenas os que são utilizadores do sistema

        if (filtroUserNomeEmailEl.value) {
            const searchTerm = `%${filtroUserNomeEmailEl.value}%`;
            query = query.or(`full_name.ilike.${searchTerm},username.ilike.${searchTerm},email.ilike.${searchTerm}`);
        }
        if (filtroUserRoleEl.value) {
            query = query.eq('role', filtroUserRoleEl.value);
        }
        
        const offset = (pagina - 1) * itensPorPaginaUsers;
        query = query.order('full_name').range(offset, offset + itensPorPaginaUsers - 1);

        const { data, error, count } = await query;
        mostrarSpinner('loadingAAUsersSpinner', false);

        if (error) {
            console.error("Erro ao carregar utilizadores do sistema:", error);
            utilizadoresNenhumMsgEl.textContent = "Erro ao carregar utilizadores.";
            utilizadoresNenhumMsgEl.classList.remove('hidden');
            return;
        }
        renderTabelaUtilizadores(data || []);
        renderPaginacaoUsers(count);
    }

    function renderTabelaUtilizadores(users) {
        utilizadoresTableBodyEl.innerHTML = '';
        if (users.length === 0) {
            utilizadoresNenhumMsgEl.classList.remove('hidden');
            return;
        }
        users.forEach(u => {
            const tr = document.createElement('tr');
            const roleDisplay = ROLES_HIERARQUIA.find(r => r.nome === u.role)?.display || u.role;
            tr.innerHTML = `
                <td>${u.full_name || u.username || 'N/A'}</td>
                <td>${u.email}</td>
                <td>${roleDisplay}</td>
                <td>${u.auth_user?.last_sign_in_at ? formatarDataHora(u.auth_user.last_sign_in_at) : 'Nunca'}</td>
                <td>${formatarDataHora(u.auth_user?.created_at)}</td>
                <td class="actions-cell">
                    <button class="action-button text-xs !p-1 aa-editar-user-btn" data-profile-id="${u.id}" data-auth-id="${u.auth_user_id}">Editar</button>
                    {/* <button class="action-button danger text-xs !p-1 aa-desativar-user-btn" data-auth-id="${u.auth_user_id}" data-ativo="${u.ativo}">Desativar/Ativar</button> */}
                </td>
            `;
            utilizadoresTableBodyEl.appendChild(tr);
        });
    }
    function renderPaginacaoUsers(totalItens) { /* ... (implementar) ... */ }
    
    utilizadoresTableBodyEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('aa-editar-user-btn')) {
            const profileId = e.target.dataset.profileId;
            const authId = e.target.dataset.authId;
            abrirFormParaEdicao(profileId, authId);
        }
        // TODO: Implementar desativação (requer chamada admin ao Supabase Auth)
    });

    async function abrirFormParaEdicao(profileId, authId) {
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', profileId).single();
        if (error || !profile) { alert("Erro ao carregar dados do perfil para edição."); return; }

        formNovoUtilizadorSecaoEl.classList.remove('hidden');
        formUtilizadorTitleEl.textContent = `Editar Utilizador: ${profile.full_name || profile.username}`;
        novoUtilizadorFormEl.reset();
        
        utilizadorFormProfileIdEl.value = profile.id; // ID do profile
        utilizadorFormAuthIdEl.value = authId; // ID do auth.users
        
        selectFuncionarioRHEl.disabled = true; // Não pode mudar o funcionário de RH associado
        selectFuncionarioRHEl.innerHTML = `<option value="${profile.id}">${profile.full_name || profile.username}</option>`;
        selectFuncionarioRHEl.value = profile.id;

        userEmailEl.value = profile.email; // O email de login
        userPasswordEl.removeAttribute('required');
        userPasswordEl.placeholder = "Deixar em branco para não alterar";
        
        popularSelectRolesParaCriacao(); // Popular com base nas permissões do user logado
        userRoleEl.value = profile.role;

        formNovoUtilizadorSecaoEl.scrollIntoView({behavior: 'smooth'});
    }


    // --- Log do Sistema ---
    function popularSelectSubAppsParaFiltro() {
        // Usar a lista de subApplications do app_principal.js (se acessível)
        // ou definir uma lista aqui.
        const appsConhecidas = ['Reservas', 'Recolhas', 'Entregas', 'Cancelamentos', 'Fecho de Caixa', 'Confirmação de Caixa', 'Despesas', 'Projetos', 'Tarefas', 'Recursos Humanos', 'Formação e Apoio', 'Perdidos e Achados', 'Comentários e Reclamações', 'Auditorias Internas', 'Login', 'Gestão Utilizadores'];
        logFiltroSubAppEl.innerHTML = '<option value="">Todas</option>';
        appsConhecidas.sort().forEach(appNome => {
            const opt = document.createElement('option');
            opt.value = appNome; // Ou um ID/slug se tiveres
            opt.textContent = appNome;
            logFiltroSubAppEl.appendChild(opt);
        });
    }

    async function carregarLogsSistema(pagina = 1) {
        if (userProfile?.role !== 'super_admin') {
            logSistemaContentEl.innerHTML = '<p class="text-red-600 p-4">Acesso negado a esta secção.</p>';
            return;
        }
        paginaAtualLogs = pagina;
        mostrarSpinner('loadingAALogsSpinner', true);
        logsTableBodyEl.innerHTML = '';
        logsNenhumaMsgEl.classList.add('hidden');

        let query = supabase.from('sistema_logs').select('*', { count: 'exact' });

        if (logFiltroDataInicioEl.value) query = query.gte('timestamp_evento', new Date(logFiltroDataInicioEl.value).toISOString());
        if (logFiltroDataFimEl.value) query = query.lte('timestamp_evento', new Date(logFiltroDataFimEl.value).toISOString());
        if (logFiltroUtilizadorEl.value) query = query.or(`user_id_acao::text.ilike.%${logFiltroUtilizadorEl.value}%,nome_utilizador_acao.ilike.%${logFiltroUtilizadorEl.value}%`);
        if (logFiltroSubAppEl.value) query = query.eq('sub_aplicacao', logFiltroSubAppEl.value);
        if (logFiltroTipoAcaoEl.value) query = query.ilike('tipo_acao', `%${logFiltroTipoAcaoEl.value}%`);
        if (logFiltroRecursoIdEl.value) query = query.eq('id_recurso_afetado', logFiltroRecursoIdEl.value);

        const offset = (pagina - 1) * itensPorPaginaLogs;
        query = query.order('timestamp_evento', { ascending: false }).range(offset, offset + itensPorPaginaLogs - 1);

        const { data, error, count } = await query;
        mostrarSpinner('loadingAALogsSpinner', false);

        if (error) {
            console.error("Erro ao carregar logs:", error);
            logsNenhumaMsgEl.textContent = "Erro ao carregar logs.";
            logsNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        renderTabelaLogs(data || []);
        renderPaginacaoLogs(count);
    }

    function renderTabelaLogs(logs) {
        logsTableBodyEl.innerHTML = '';
        if (logs.length === 0) {
            logsNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatarDataHora(log.timestamp_evento)}</td>
                <td>${log.nome_utilizador_acao || log.user_id_acao || 'Sistema'}</td>
                <td>${log.sub_aplicacao}</td>
                <td>${log.tipo_acao}</td>
                <td>${log.recurso_afetado || 'N/A'}</td>
                <td>${log.id_recurso_afetado || 'N/A'}</td>
                <td><pre class="log-details">${JSON.stringify(log.detalhes_acao, null, 2)}</pre></td>
            `;
            logsTableBodyEl.appendChild(tr);
        });
    }
    function renderPaginacaoLogs(totalItens) { /* ... (implementar) ... */ }


    // --- Event Listeners ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (aplicarFiltrosUserBtnEl) aplicarFiltrosUserBtnEl.addEventListener('click', () => carregarUtilizadoresSistema(1));
    if (logAplicarFiltrosBtnEl) logAplicarFiltrosBtnEl.addEventListener('click', () => carregarLogsSistema(1));


    // --- Inicialização da Página ---
    async function initAcessosAlteracoesPage() {
        if (!verificarPermissaoAcessoModulo()) return; // Verifica permissões gerais primeiro

        // Definir datas padrão para filtros de logs (ex: últimas 24h)
        const agora = new Date();
        const ontem = new Date(agora);
        ontem.setDate(agora.getDate() - 1);
        logFiltroDataInicioEl.value = ontem.toISOString().slice(0,16);
        logFiltroDataFimEl.value = agora.toISOString().slice(0,16);

        // Carregar dados para a aba ativa por defeito (Gestão de Utilizadores)
        if (gestaoUtilizadoresContentEl.classList.contains('active')) {
            await carregarFuncionariosParaNovoUtilizadorSelect();
            popularSelectRolesParaFiltro();
            await carregarUtilizadoresSistema();
        }
        // Se a aba de logs for a ativa por defeito e o user for super_admin:
        else if (logSistemaContentEl.classList.contains('active') && userProfile?.role === 'super_admin') {
            popularSelectSubAppsParaFiltro();
            await carregarLogsSistema();
        }
        
        console.log("Subaplicação de Acessos e Alterações inicializada.");
    }

    initAcessosAlteracoesPage();
});

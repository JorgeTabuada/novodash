// js/recursos_humanos.js - Lógica para a Subaplicação de Recursos Humanos

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para RH.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnRH');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Ficha de Funcionário
    const filtroNomeFuncionarioEl = document.getElementById('rhFiltroNomeFuncionario');
    const pesquisarFuncionarioBtnEl = document.getElementById('rhPesquisarFuncionarioBtn');
    const novoFuncionarioBtnEl = document.getElementById('rhNovoFuncionarioBtn');
    const loadingFuncionariosSpinnerEl = document.getElementById('loadingFuncionariosSpinner');
    const funcionariosTableBodyEl = document.getElementById('rhFuncionariosTableBody');
    const funcionariosNenhumaMsgEl = document.getElementById('rhFuncionariosNenhumMsg');
    
    const formularioFuncionarioSecaoEl = document.getElementById('rhFormularioFuncionarioSecao');
    const formTitleEl = document.getElementById('rhFormTitle');
    const funcionarioFormEl = document.getElementById('rhFuncionarioForm');
    const funcionarioFormIdEl = document.getElementById('rhFuncionarioFormId');
    const nomeCompletoEl = document.getElementById('rhNomeCompleto');
    const moradaEl = document.getElementById('rhMorada');
    const dataNascimentoEl = document.getElementById('rhDataNascimento');
    const nifEl = document.getElementById('rhNIF');
    const docIdTipoEl = document.getElementById('rhDocIdTipo');
    const docIdNumeroEl = document.getElementById('rhDocIdNumero');
    const fotoEl = document.getElementById('rhFoto');
    const fotoPreviewEl = document.getElementById('rhFotoPreview');
    const funcaoEl = document.getElementById('rhFuncao');
    const dataEntradaEl = document.getElementById('rhDataEntrada');
    const dataSaidaEl = document.getElementById('rhDataSaida');
    const parquePrincipalEl = document.getElementById('rhParquePrincipal');
    const supervisorDiretoEl = document.getElementById('rhSupervisorDireto');
    const tipoColaboradorEl = document.getElementById('rhTipoColaborador');
    const dadosFixoEl = document.getElementById('rhDadosFixo');
    const ordenadoBrutoEl = document.getElementById('rhOrdenadoBruto');
    const horarioTrabalhoEl = document.getElementById('rhHorarioTrabalho');
    // const valorHoraFixoEl = document.getElementById('rhValorHoraFixo');
    const dadosExtraEl = document.getElementById('rhDadosExtra');
    const nivelExtraEl = document.getElementById('rhNivelExtra');
    const valorHoraExtraEl = document.getElementById('rhValorHoraExtra');
    const ibanEl = document.getElementById('rhIBAN');
    const ativoEl = document.getElementById('rhAtivo');
    const cancelarEdicaoBtnEl = document.getElementById('rhCancelarEdicaoBtn');
    const formStatusEl = document.getElementById('rhFormStatus');

    // Documentos
    const documentosSecaoEl = document.getElementById('rhDocumentosSecao');
    const nomeFuncionarioDocsEl = document.getElementById('rhNomeFuncionarioDocs');
    const tipoDocumentoUploadEl = document.getElementById('rhTipoDocumentoUpload');
    const ficheiroDocumentoUploadEl = document.getElementById('rhFicheiroDocumentoUpload');
    const dataValidadeDocEl = document.getElementById('rhDataValidadeDoc');
    const obsDocumentoUploadEl = document.getElementById('rhObsDocumentoUpload');
    const uploadDocumentoBtnEl = document.getElementById('rhUploadDocumentoBtn');
    const uploadDocStatusEl = document.getElementById('rhUploadDocStatus');
    const listaDocumentosEl = document.getElementById('rhListaDocumentos');
    const documentosNenhumMsgEl = document.getElementById('rhDocumentosNenhumMsg');
    let currentProfileIdParaDocs = null;


    // Processamento Salarial
    const importPicagensFileEl = document.getElementById('rhImportPicagensFile');
    const periodoProcessamentoEl = document.getElementById('rhPeriodoProcessamento');
    const processarSalariosBtnEl = document.getElementById('rhProcessarSalariosBtn');
    const processamentoStatusEl = document.getElementById('rhProcessamentoStatus');
    const loadingProcessamentoSpinnerEl = document.getElementById('loadingProcessamentoSpinner');
    const labelPeriodoProcessadoEl = document.getElementById('rhLabelPeriodoProcessado');
    const processadosTableBodyEl = document.getElementById('rhProcessadosTableBody');
    const processadosNenhumaMsgEl = document.getElementById('rhProcessadosNenhumMsg');
    const totalLiquidoPagarPeriodoEl = document.getElementById('rhTotalLiquidoPagarPeriodo');

    // Análise Picagens
    const analiseFuncionarioSelectEl = document.getElementById('rhAnaliseFuncionarioSelect');
    const analiseDataEl = document.getElementById('rhAnaliseData');
    const executarAnalisePicagensBtnEl = document.getElementById('rhExecutarAnalisePicagensBtn');
    const loadingAnalisePicagensSpinnerEl = document.getElementById('loadingAnalisePicagensSpinner');
    const analisePicagensTableBodyEl = document.getElementById('rhAnalisePicagensTableBody');
    const analiseNenhumaMsgEl = document.getElementById('rhAnaliseNenhumaMsg');

    // --- Estado da Aplicação ---
    let todosOsFuncionarios = [];
    let listaParquesRH = [];
    let listaSupervisoresRH = [];


    // --- Funções Auxiliares ---
    function formatarData(dataISO) { return dataISO ? new Date(dataISO).toLocaleDateString('pt-PT') : 'N/A'; }
    function mostrarSpinner(id, show = true) { document.getElementById(id)?.classList.toggle('hidden', !show); }
    function resetFormularioFuncionario() {
        funcionarioFormEl.reset();
        funcionarioFormIdEl.value = '';
        formTitleEl.textContent = 'Novo Funcionário';
        fotoPreviewEl.textContent = '';
        documentosSecaoEl.classList.add('hidden');
        currentProfileIdParaDocs = null;
        formStatusEl.textContent = '';
        tipoColaboradorEl.dispatchEvent(new Event('change')); // Para esconder/mostrar campos fixo/extra
    }

    // --- Navegação por Abas ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.tab + 'Content').classList.add('active');
        });
    });

    // --- Carregar Dados Iniciais (Parques, Supervisores para Selects) ---
    async function carregarDadosParaSelectsRH() {
        const { data: parquesData, error: errorParques } = await supabase.from('parques').select('id, nome, cidade').order('cidade').order('nome');
        if (errorParques) console.error("Erro ao carregar parques:", errorParques);
        else listaParquesRH = parquesData || [];
        
        parquePrincipalEl.innerHTML = '<option value="">Selecione o Parque</option>';
        listaParquesRH.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.nome} (${p.cidade || 'N/A'})`;
            parquePrincipalEl.appendChild(opt);
        });

        // Carregar potenciais supervisores (ex: todos os users com role 'admin' ou 'supervisor')
        const { data: usersData, error: usersError } = await supabase.from('profiles').select('id, full_name, username').or('role.eq.admin,role.eq.supervisor,role.eq.super_admin').order('full_name');
        if (usersError) console.error("Erro ao carregar supervisores:", usersError);
        else listaSupervisoresRH = usersData || [];

        supervisorDiretoEl.innerHTML = '<option value="">Nenhum</option>';
        listaSupervisoresRH.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.full_name || u.username;
            supervisorDiretoEl.appendChild(opt);
        });
        
        // Para filtro de análise de picagens
        analiseFuncionarioSelectEl.innerHTML = '<option value="">Todos</option>';
         (await supabase.from('profiles').select('id, full_name, username').order('full_name')).data.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.full_name || u.username;
            analiseFuncionarioSelectEl.appendChild(opt);
        });
    }

    // --- Lógica da Ficha de Funcionário ---
    tipoColaboradorEl.addEventListener('change', function() {
        dadosFixoEl.classList.toggle('hidden', this.value !== 'Fixo');
        dadosExtraEl.classList.toggle('hidden', this.value !== 'Extra');
    });

    async function carregarFuncionarios(searchTerm = '') {
        mostrarSpinner('loadingFuncionariosSpinner');
        funcionariosTableBodyEl.innerHTML = '';
        funcionariosNenhumaMsgEl.classList.add('hidden');

        let query = supabase.from('profiles').select(`
            id, full_name, username, email, funcao, tipo_colaborador, ativo,
            parque_principal:parques (nome)
        `, { count: 'exact' });

        if (searchTerm) {
            query = query.or(`full_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,nif.ilike.%${searchTerm}%,doc_identificacao_numero.ilike.%${searchTerm}%`);
        }
        // Adicionar mais filtros se necessário (parque, tipo, ativo)
        
        const { data, error, count } = await query.order('full_name').limit(50); // Limitar para performance inicial

        mostrarSpinner('loadingFuncionariosSpinner', false);
        if (error) {
            console.error("Erro ao carregar funcionários:", error);
            funcionariosNenhumaMsgEl.textContent = "Erro ao carregar funcionários.";
            funcionariosNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        todosOsFuncionarios = data || [];
        renderTabelaFuncionarios(todosOsFuncionarios);
        // TODO: Adicionar paginação se count > 50
    }

    function renderTabelaFuncionarios(funcionarios) {
        funcionariosTableBodyEl.innerHTML = '';
        if (funcionarios.length === 0) {
            funcionariosNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        funcionarios.forEach(func => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${func.full_name || func.username || 'N/A'}</td>
                <td>${func.funcao || 'N/A'}</td>
                <td>${func.tipo_colaborador || 'N/A'}</td>
                <td>${func.parque_principal?.nome || 'N/A'}</td>
                <td><span class="px-2 py-1 text-xs font-semibold rounded-full ${func.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${func.ativo ? 'Sim' : 'Não'}</span></td>
                <td class="actions-cell">
                    <button class="action-button text-xs !p-1 rh-editar-funcionario-btn" data-id="${func.id}">Editar/Ver</button>
                </td>
            `;
            funcionariosTableBodyEl.appendChild(tr);
        });
    }
    
    async function abrirFormularioFuncionario(profileId = null) {
        resetFormularioFuncionario();
        formularioFuncionarioSecaoEl.classList.remove('hidden');
        documentosSecaoEl.classList.add('hidden'); // Esconder docs ao abrir form
        currentProfileIdParaDocs = profileId;

        if (profileId) {
            formTitleEl.textContent = 'Editar Funcionário';
            const { data: func, error } = await supabase.from('profiles').select('*').eq('id', profileId).single();
            if (error || !func) {
                alert("Erro ao carregar dados do funcionário para edição.");
                formularioFuncionarioSecaoEl.classList.add('hidden');
                return;
            }
            funcionarioFormIdEl.value = func.id;
            nomeCompletoEl.value = func.full_name || '';
            moradaEl.value = func.morada_completa || '';
            dataNascimentoEl.value = func.data_nascimento || '';
            nifEl.value = func.nif || '';
            docIdTipoEl.value = func.doc_identificacao_tipo || 'CC';
            docIdNumeroEl.value = func.doc_identificacao_numero || '';
            // Foto: mostrar preview se existir func.foto_url
            if(func.foto_url) fotoPreviewEl.innerHTML = `<img src="${func.foto_url}" alt="Foto" class="h-16 w-16 object-cover rounded mt-1">`;

            funcaoEl.value = func.funcao || '';
            dataEntradaEl.value = func.data_entrada_empresa || '';
            dataSaidaEl.value = func.data_saida_empresa || '';
            parquePrincipalEl.value = func.parque_id_principal || '';
            supervisorDiretoEl.value = func.supervisor_direto_id || '';
            tipoColaboradorEl.value = func.tipo_colaborador || 'Fixo';
            tipoColaboradorEl.dispatchEvent(new Event('change')); // Trigger para mostrar campos corretos

            if (func.tipo_colaborador === 'Fixo') {
                ordenadoBrutoEl.value = func.ordenado_bruto_base || '';
                horarioTrabalhoEl.value = func.horario_trabalho_default_json ? JSON.stringify(func.horario_trabalho_default_json) : '';
            } else if (func.tipo_colaborador === 'Extra') {
                nivelExtraEl.value = func.nivel_extra || '';
                valorHoraExtraEl.value = func.valor_hora_extra_definido || '';
            }
            ibanEl.value = func.iban || '';
            ativoEl.checked = func.ativo !== false; // Default to true if null/undefined

            // Após carregar funcionário, mostrar secção de documentos e carregar os seus docs
            documentosSecaoEl.classList.remove('hidden');
            nomeFuncionarioDocsEl.textContent = func.full_name || func.username;
            await carregarDocumentosFuncionario(profileId);

        } else {
            formTitleEl.textContent = 'Novo Funcionário';
            dataEntradaEl.value = new Date().toISOString().split('T')[0]; // Data de hoje por defeito
            ativoEl.checked = true;
        }
    }

    funcionarioFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const profileId = funcionarioFormIdEl.value;
        formStatusEl.textContent = 'A guardar...';

        let fotoUrlFinal = null;
        if (profileId) { // Se editando, manter foto antiga se não houver nova
            const {data: funcAntigo} = await supabase.from('profiles').select('foto_url').eq('id', profileId).single();
            fotoUrlFinal = funcAntigo?.foto_url;
        }

        const ficheiroFoto = fotoEl.files[0];
        if (ficheiroFoto) {
            const nomeFoto = `avatars/${currentUser.id}_${Date.now()}_${ficheiroFoto.name.replace(/\s+/g, '_')}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('avatars-funcionarios').upload(nomeFoto, ficheiroFoto, { upsert: true });
            if (uploadError) { formStatusEl.textContent = `Erro no upload da foto: ${uploadError.message}`; return; }
            const { data: urlData } = supabase.storage.from('avatars-funcionarios').getPublicUrl(uploadData.path);
            fotoUrlFinal = urlData.publicUrl;
        }

        const dadosProfile = {
            full_name: nomeCompletoEl.value,
            morada_completa: moradaEl.value,
            data_nascimento: dataNascimentoEl.value || null,
            nif: nifEl.value || null,
            doc_identificacao_tipo: docIdTipoEl.value,
            doc_identificacao_numero: docIdNumeroEl.value || null,
            foto_url: fotoUrlFinal,
            funcao: funcaoEl.value,
            data_entrada_empresa: dataEntradaEl.value,
            data_saida_empresa: dataSaidaEl.value || null,
            parque_id_principal: parquePrincipalEl.value || null,
            supervisor_direto_id: supervisorDiretoEl.value || null,
            tipo_colaborador: tipoColaboradorEl.value,
            ordenado_bruto_base: tipoColaboradorEl.value === 'Fixo' ? (parseFloat(ordenadoBrutoEl.value) || null) : null,
            horario_trabalho_default_json: tipoColaboradorEl.value === 'Fixo' ? (horarioTrabalhoEl.value ? JSON.parse(horarioTrabalhoEl.value) : null) : null,
            nivel_extra: tipoColaboradorEl.value === 'Extra' ? (parseInt(nivelExtraEl.value) || null) : null,
            valor_hora_extra_definido: tipoColaboradorEl.value === 'Extra' ? (parseFloat(valorHoraExtraEl.value) || null) : null,
            iban: ibanEl.value || null,
            ativo: ativoEl.checked,
            // username e email são geridos pela auth.users, aqui é a extensão em profiles
        };
        // Se for novo, o ID do profile é o mesmo do auth.user.id
        if (!profileId && currentUser) dadosProfile.id = currentUser.id; 
        // Se estiver a criar um user novo que ainda não existe no auth.users, o fluxo é mais complexo (criar user no auth primeiro)
        // Este formulário assume que o user já existe no Supabase Auth se for um novo profile,
        // ou que estamos a editar um profile existente.

        let resultado, erroSupabase;
        if (profileId) { // Edição
            const { data, error } = await supabase.from('profiles').update(dadosProfile).eq('id', profileId).select().single();
            resultado = data; erroSupabase = error;
        } else { // Criação (ou upsert se o ID do user já existir em profiles)
            // Para um novo funcionário, idealmente o user já foi criado no Supabase Auth.
            // E o ID do profile seria o ID do user do Auth.
            // Se o profileId é para um user que ainda não tem profile, usamos upsert.
            // Se for um user completamente novo, este formulário não cria o user no Auth.
            dadosProfile.id = dadosProfile.id || currentUser?.id; // Garantir que tem ID para upsert
            if(!dadosProfile.id) { alert("Não foi possível determinar o ID do utilizador para o novo perfil."); return; }
            const { data, error } = await supabase.from('profiles').upsert(dadosProfile, { onConflict: 'id' }).select().single();
            resultado = data; erroSupabase = error;
        }

        if (erroSupabase) {
            formStatusEl.textContent = `Erro: ${erroSupabase.message}`;
        } else {
            formStatusEl.textContent = `Funcionário ${profileId ? 'atualizado' : 'guardado'}!`;
            await carregarFuncionarios(filtroNomeFuncionarioEl.value); // Recarregar lista
            // Se foi um novo, abrir para documentos
            if (!profileId && resultado) {
                 abrirFormularioFuncionario(resultado.id); // Reabre no modo edição para adicionar docs
            }
        }
    });
    
    // --- Lógica de Documentos ---
    async function carregarDocumentosFuncionario(profileId) {
        if (!profileId) {
            listaDocumentosEl.innerHTML = '';
            documentosNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        mostrarSpinner('loadingFuncionariosSpinner'); // Reutilizar
        const { data, error } = await supabase.from('documentos_colaborador')
            .select('*').eq('profile_id', profileId).order('data_upload', { ascending: false });
        mostrarSpinner('loadingFuncionariosSpinner', false);

        listaDocumentosEl.innerHTML = '';
        if (error) {
            console.error("Erro ao carregar documentos:", error);
            documentosNenhumaMsgEl.textContent = "Erro ao carregar documentos.";
            documentosNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        if (!data || data.length === 0) {
            documentosNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        documentosNenhumaMsgEl.classList.add('hidden');
        data.forEach(doc => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'document-list-item';
            itemDiv.innerHTML = `
                <div>
                    <a href="${doc.ficheiro_url}" target="_blank" class="text-blue-600 hover:underline font-medium">${doc.tipo_documento}</a>
                    <span class="text-xs text-gray-500 ml-2">(Upload: ${formatarData(doc.data_upload)})</span>
                    ${doc.data_validade_documento ? `<span class="text-xs text-orange-600 ml-2">Val: ${formatarData(doc.data_validade_documento)}</span>` : ''}
                    ${doc.observacoes ? `<p class="text-xs text-gray-600 mt-1">Obs: ${doc.observacoes}</p>` : ''}
                </div>
                <button class="action-button danger text-xs !p-1 rh-apagar-doc-btn" data-doc-id="${doc.id}" data-path="${doc.bucket_path}">Apagar</button>
            `;
            listaDocumentosEl.appendChild(itemDiv);
        });
    }

    uploadDocumentoBtnEl.addEventListener('click', async () => {
        if (!currentProfileIdParaDocs) {
            alert("Selecione ou guarde um funcionário primeiro.");
            return;
        }
        const ficheiro = ficheiroDocumentoUploadEl.files[0];
        if (!ficheiro) {
            alert("Selecione um ficheiro para anexar.");
            return;
        }
        uploadDocStatusEl.textContent = 'A carregar documento...';
        mostrarSpinner('loadingFuncionariosSpinner');

        const nomeFicheiroStorage = `documentos_rh/${currentProfileIdParaDocs}/${Date.now()}_${ficheiro.name.replace(/\s+/g, '_')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documentos-funcionarios') // Nome do Bucket
            .upload(nomeFicheiroStorage, ficheiro);

        if (uploadError) {
            uploadDocStatusEl.textContent = `Erro no upload: ${uploadError.message}`;
            mostrarSpinner('loadingFuncionariosSpinner', false);
            return;
        }
        
        const { data: urlData } = supabase.storage.from('documentos-funcionarios').getPublicUrl(uploadData.path);

        const dadosDocumento = {
            profile_id: currentProfileIdParaDocs,
            tipo_documento: tipoDocumentoUploadEl.value,
            nome_ficheiro_original: ficheiro.name,
            ficheiro_url: urlData.publicUrl,
            bucket_path: uploadData.path,
            data_validade_documento: dataValidadeDocEl.value || null,
            observacoes: obsDocumentoUploadEl.value || null
        };

        const { error: insertError } = await supabase.from('documentos_colaborador').insert(dadosDocumento);
        mostrarSpinner('loadingFuncionariosSpinner', false);

        if (insertError) {
            uploadDocStatusEl.textContent = `Erro ao guardar registo do documento: ${insertError.message}`;
            // Tentar apagar o ficheiro do storage se a inserção na BD falhar
            await supabase.storage.from('documentos-funcionarios').remove([uploadData.path]);
        } else {
            uploadDocStatusEl.textContent = 'Documento anexado com sucesso!';
            ficheiroDocumentoUploadEl.value = ''; // Limpar input
            obsDocumentoUploadEl.value = '';
            dataValidadeDocEl.value = '';
            await carregarDocumentosFuncionario(currentProfileIdParaDocs);
        }
    });
    
    listaDocumentosEl.addEventListener('click', async (e) => {
        if (e.target.classList.contains('rh-apagar-doc-btn')) {
            const docId = e.target.dataset.docId;
            const bucketPath = e.target.dataset.path;
            if (!confirm("Tem certeza que deseja apagar este documento?")) return;

            // 1. Apagar do Storage
            if (bucketPath) {
                const { error: storageError } = await supabase.storage.from('documentos-funcionarios').remove([bucketPath]);
                if (storageError) {
                    alert(`Erro ao apagar ficheiro do armazenamento: ${storageError.message}. O registo na base de dados não será apagado.`);
                    return;
                }
            }
            // 2. Apagar da Base de Dados
            const { error: dbError } = await supabase.from('documentos_colaborador').delete().eq('id', docId);
            if (dbError) {
                alert(`Erro ao apagar registo do documento: ${dbError.message}. O ficheiro pode ter sido apagado do armazenamento.`);
            } else {
                alert("Documento apagado com sucesso.");
                await carregarDocumentosFuncionario(currentProfileIdParaDocs);
            }
        }
    });


    // --- Lógica de Processamento Salarial (Esqueleto) ---
    processarSalariosBtnEl.addEventListener('click', async () => {
        const ficheiroPicagens = importPicagensFileEl.files[0];
        const periodo = periodoProcessamentoEl.value; // Formato "AAAA-MM"
        if (!ficheiroPicagens || !periodo) {
            alert("Selecione o ficheiro de picagens e o período a processar.");
            return;
        }
        processamentoStatusEl.textContent = 'A processar salários...';
        mostrarSpinner('loadingProcessamentoSpinner');
        // 1. Ler ficheiro de picagens (XLSX)
        // 2. Para cada funcionário:
        //    a. Obter dados contratuais (tipo, valor/hora, nível extra, ordenado base fixo) da tabela `profiles`.
        //    b. Calcular horas trabalhadas (regulares, extras) com base nas picagens.
        //    c. Se Extra: Salário = Horas * ValorHora (considerando nível).
        //    d. Se Fixo: Calcular bruto, depois tentar estimar líquido (descontos são complexos, pode ser simplificado ou exigir mais inputs).
        //    e. Guardar em `processamentos_salariais`.
        // 3. Atualizar tabela `rhProcessadosTableBodyEl` e totais.
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simular processamento
        processamentoStatusEl.textContent = 'Processamento de salários (simulado) concluído.';
        labelPeriodoProcessadoEl.textContent = periodo;
        esconderSpinner('loadingProcessamentoSpinner');
        // Exemplo de resultado:
        processadosTableBodyEl.innerHTML = `<tr><td>João Silva</td><td>Extra</td><td>${periodo}</td><td>80</td><td>10</td><td>850,00 €</td><td>750,00 €</td><td>Pendente</td><td><button class="action-button text-xs">Detalhes</button></td></tr>`;
        totalLiquidoPagarPeriodoEl.textContent = formatarMoeda(750);
    });

    // --- Lógica de Análise Picagens vs Atividade (Esqueleto) ---
    executarAnalisePicagensBtnEl.addEventListener('click', async () => {
        const funcionarioId = analiseFuncionarioSelectEl.value;
        const dataAnalise = analiseDataEl.value;
        if (!dataAnalise) {
            alert("Selecione uma data para análise.");
            return;
        }
        analiseNenhumaMsgEl.classList.add('hidden');
        analisePicagensTableBodyEl.innerHTML = '';
        mostrarSpinner('loadingAnalisePicagensSpinner');
        // 1. Buscar picagens de saída para o(s) funcionário(s) na data.
        // 2. Buscar última atividade (recolha/entrega) na tabela `reservas` para esse(s) funcionário(s) ANTES da hora da picagem de saída.
        // 3. Comparar e mostrar na tabela `rhAnalisePicagensTableBodyEl`.
        await new Promise(resolve => setTimeout(resolve, 1500));
        esconderSpinner('loadingAnalisePicagensSpinner');
        analisePicagensTableBodyEl.innerHTML = `<tr><td>Maria Costa</td><td>${dataAnalise}</td><td>18:05</td><td>17:30 (Entrega)</td><td class="text-red-600 font-bold">35 min</td><td>Verificar</td></tr>`;
    });


    // --- Event Listeners Gerais ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (pesquisarFuncionarioBtnEl) pesquisarFuncionarioBtnEl.addEventListener('click', () => carregarFuncionarios(filtroNomeFuncionarioEl.value));
    if (filtroNomeFuncionarioEl) filtroNomeFuncionarioEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') carregarFuncionarios(filtroNomeFuncionarioEl.value); });
    if (novoFuncionarioBtnEl) novoFuncionarioBtnEl.addEventListener('click', () => abrirFormularioFuncionario());
    if (cancelarEdicaoBtnEl) cancelarEdicaoBtnEl.addEventListener('click', () => {
        formularioFuncionarioSecaoEl.classList.add('hidden');
        documentosSecaoEl.classList.add('hidden');
    });
    
    funcionariosTableBodyEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('rh-editar-funcionario-btn')) {
            abrirFormularioFuncionario(e.target.dataset.id);
        }
    });


    // --- Inicialização da Página ---
    async function initRHPage() {
        if (!userProfile) {
            alert("Perfil do utilizador não carregado. Funcionalidades podem ser limitadas.");
        }
        // Definir data de hoje para análise de picagens por defeito
        analiseDataEl.value = new Date().toISOString().split('T')[0];
        periodoProcessamentoEl.value = new Date().toISOString().slice(0,7); // Mês atual AAAA-MM

        await carregarDadosParaSelectsRH();
        await carregarFuncionarios(); // Carregar lista inicial
        resetFormularioFuncionario(); // Garante que o form está limpo e seções corretas visíveis/escondidas
        console.log("Subaplicação de Recursos Humanos inicializada.");
    }

    initRHPage();
});

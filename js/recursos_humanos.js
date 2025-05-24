// js/recursos_humanos.js

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para RH.");
        return;
    }
    checkAuthStatus(); // Should handle redirection if no user

    let currentUser = null;
    let userProfile = null;

    function initializeRHPageLogic(user, profile) {
        if (document.body.classList.contains('rh-logic-initialized')) {
            // console.log('RH logic already initialized for this user session.');
            return;
        }
        document.body.classList.add('rh-logic-initialized');

        currentUser = user;
        userProfile = profile;

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
        const documentosNenhumaMsgEl = document.getElementById('rhDocumentosNenhumMsg');
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
            tipoColaboradorEl.dispatchEvent(new Event('change')); 
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
        
        function getParqueIdOperacaoRH() {
            const parqueSelecionado = localStorage.getItem('parqueSelecionadoMultiparkId');
            if (parqueSelecionado && parqueSelecionado !== 'todos' && parqueSelecionado !== 'null') {
                return parseInt(parqueSelecionado, 10);
            }
            return null;
        }

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
                id, full_name, username, email, funcao, tipo_colaborador, ativo, nif, ordenado_bruto_base, valor_hora_extra_definido, nivel_extra,
                parque_principal:parques (nome)
            `, { count: 'exact' });

            const parqueIdOperacao = getParqueIdOperacaoRH();
            if (parqueIdOperacao) {
                 query = query.eq('parque_id_principal', parqueIdOperacao);
            } else if (userProfile?.role !== 'super_admin' && userProfile?.role !== 'admin') {
                console.warn("RH: Non-admin attempting to load all users without a park context. Aborting load.");
                mostrarSpinner('loadingFuncionariosSpinner', false);
                funcionariosNenhumaMsgEl.textContent = "Selecione um parque para listar funcionários.";
                funcionariosNenhumaMsgEl.classList.remove('hidden');
                return;
            }

            if (searchTerm) {
                query = query.or(`full_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,nif.ilike.%${searchTerm}%,doc_identificacao_numero.ilike.%${searchTerm}%`);
            }
            
            const { data, error, count } = await query.order('full_name').limit(50); 

            mostrarSpinner('loadingFuncionariosSpinner', false);
            if (error) {
                console.error("Erro ao carregar funcionários:", error);
                funcionariosNenhumaMsgEl.textContent = "Erro ao carregar funcionários.";
                funcionariosNenhumaMsgEl.classList.remove('hidden');
                return;
            }
            todosOsFuncionarios = data || [];
            renderTabelaFuncionarios(todosOsFuncionarios);
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
            documentosSecaoEl.classList.add('hidden'); 
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
                if(func.foto_url) fotoPreviewEl.innerHTML = `<img src="${func.foto_url}" alt="Foto" class="h-16 w-16 object-cover rounded mt-1">`;

                funcaoEl.value = func.funcao || '';
                dataEntradaEl.value = func.data_entrada_empresa || '';
                dataSaidaEl.value = func.data_saida_empresa || '';
                parquePrincipalEl.value = func.parque_id_principal || '';
                supervisorDiretoEl.value = func.supervisor_direto_id || '';
                tipoColaboradorEl.value = func.tipo_colaborador || 'Fixo';
                tipoColaboradorEl.dispatchEvent(new Event('change'));

                if (func.tipo_colaborador === 'Fixo') {
                    ordenadoBrutoEl.value = func.ordenado_bruto_base || '';
                    horarioTrabalhoEl.value = func.horario_trabalho_default_json ? JSON.stringify(func.horario_trabalho_default_json) : '';
                } else if (func.tipo_colaborador === 'Extra') {
                    nivelExtraEl.value = func.nivel_extra || '';
                    valorHoraExtraEl.value = func.valor_hora_extra_definido || '';
                }
                ibanEl.value = func.iban || '';
                ativoEl.checked = func.ativo !== false; 

                documentosSecaoEl.classList.remove('hidden');
                nomeFuncionarioDocsEl.textContent = func.full_name || func.username;
                await carregarDocumentosFuncionario(profileId);

            } else { // New employee
                formTitleEl.textContent = 'Novo Funcionário';
                dataEntradaEl.value = new Date().toISOString().split('T')[0]; 
                ativoEl.checked = true;
                
                // Default to current operational park if one is selected
                const parqueIdOperacao = getParqueIdOperacaoRH();
                if (parqueIdOperacao && parquePrincipalEl) {
                    parquePrincipalEl.value = parqueIdOperacao;
                }
            }
        }

        funcionarioFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;
            const profileId = funcionarioFormIdEl.value; 
            formStatusEl.textContent = 'A guardar...';

            let fotoUrlFinal = null;
            if (profileId) { 
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
                ativo: ativoEl.checked
            };

            if (profileId) { 
            } else { 
                if (currentUser && currentUser.id) {
                    dadosProfile.id = currentUser.id; 
                    console.log(`INFO: Novo perfil será criado/atualizado para o ID do utilizador logado: ${currentUser.id}. ATENÇÃO: Se um admin está a criar um perfil para outro funcionário, este ID deve ser o do funcionário alvo, não o do admin.`);
                } else {
                    alert("Erro crítico: Utilizador não autenticado ao tentar criar novo perfil. Não é possível determinar o ID.");
                    formStatusEl.textContent = 'Erro: Utilizador não autenticado.';
                    return; 
                }
            }
            
            let resultado, erroSupabase;
            if (profileId) { 
                const dadosParaUpdate = { ...dadosProfile }; 
                delete dadosParaUpdate.id; 
                const { data, error } = await supabase.from('profiles').update(dadosParaUpdate).eq('id', profileId).select().single();
                resultado = data; erroSupabase = error;
            } else { 
                const { data, error } = await supabase.from('profiles').upsert(dadosProfile, { onConflict: 'id' }).select().single();
                resultado = data; erroSupabase = error;
            }

            if (erroSupabase) {
                formStatusEl.textContent = `Erro: ${erroSupabase.message}`;
            } else {
                formStatusEl.textContent = `Funcionário ${profileId ? 'atualizado' : 'guardado'}!`;
                await carregarFuncionarios(filtroNomeFuncionarioEl.value); 
                if (!profileId && resultado) {
                     abrirFormularioFuncionario(resultado.id); 
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
            mostrarSpinner('loadingFuncionariosSpinner'); 
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
                .from('documentos-funcionarios') 
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
                await supabase.storage.from('documentos-funcionarios').remove([uploadData.path]);
            } else {
                uploadDocStatusEl.textContent = 'Documento anexado com sucesso!';
                ficheiroDocumentoUploadEl.value = ''; 
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

                if (bucketPath) {
                    const { error: storageError } = await supabase.storage.from('documentos-funcionarios').remove([bucketPath]);
                    if (storageError) {
                        alert(`Erro ao apagar ficheiro do armazenamento: ${storageError.message}. O registo na base de dados não será apagado.`);
                        return;
                    }
                }
                const { error: dbError } = await supabase.from('documentos_colaborador').delete().eq('id', docId);
                if (dbError) {
                    alert(`Erro ao apagar registo do documento: ${dbError.message}. O ficheiro pode ter sido apagado do armazenamento.`);
                } else {
                    alert("Documento apagado com sucesso.");
                    await carregarDocumentosFuncionario(currentProfileIdParaDocs);
                }
            }
        });


        // --- Lógica de Processamento Salarial ---
        processarSalariosBtnEl.addEventListener('click', async () => {
            // --- User-configurable Timesheet Column Names ---
            const COL_PICAGEM_ID_FUNCIONARIO = 'NIF Funcionario'; 
            const COL_PICAGEM_HORAS_REGULARES = 'Horas Regulares Trabalhadas'; 
            const COL_PICAGEM_HORAS_EXTRA = 'Horas Extra Trabalhadas'; 
            // --- End User-configurable ---

            const ficheiroPicagens = importPicagensFileEl.files[0];
            const periodo = periodoProcessamentoEl.value; 
            if (!ficheiroPicagens || !periodo) {
                alert("Selecione o ficheiro de picagens e o período a processar.");
                return;
            }
            processamentoStatusEl.textContent = 'A processar salários...';
            mostrarSpinner('loadingProcessamentoSpinner', true);
            processadosTableBodyEl.innerHTML = ''; 
            processadosNenhumaMsgEl.classList.add('hidden');
            let totalLiquidoEstimadoPeriodo = 0;

            try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const sheetName = workbook.SheetNames[0];
                        const picagensData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

                        if (picagensData.length === 0) {
                            throw new Error("Ficheiro de picagens vazio ou mal formatado.");
                        }
                        
                        if (!todosOsFuncionarios || todosOsFuncionarios.length === 0) {
                            console.warn("Lista 'todosOsFuncionarios' vazia, tentando carregar...");
                            const { data: allProfiles, error: fetchError } = await supabase.from('profiles')
                                .select('id, nif, full_name, username, tipo_colaborador, ordenado_bruto_base, valor_hora_extra_definido, nivel_extra, funcao, parque_principal:parques(nome)');
                            if (fetchError) throw new Error("Falha ao carregar lista de funcionários para processamento: " + fetchError.message);
                            todosOsFuncionarios = allProfiles || [];
                            if(todosOsFuncionarios.length === 0) throw new Error("Nenhum funcionário carregado no sistema para processamento.");
                        }

                        let resultadosProcessamento = [];

                        for (const row of picagensData) {
                            const idFuncionarioPicagem = String(row[COL_PICAGEM_ID_FUNCIONARIO] || '').trim();
                            const horasRegulares = parseFloat(row[COL_PICAGEM_HORAS_REGULARES] || 0);
                            const horasExtra = parseFloat(row[COL_PICAGEM_HORAS_EXTRA] || 0);

                            if (!idFuncionarioPicagem) {
                                console.warn("Linha de picagem ignorada: ID do funcionário em falta.", row);
                                resultadosProcessamento.push({
                                    nome: `ID Picagem Inválido/Em falta`,
                                    tipo: 'Erro', periodo, horasRegulares, horasExtra,
                                    brutoCalculado: 0, liquidoEstimado: 0, estadoPagamento: 'Erro', erro: 'ID Funcionário em falta na picagem'
                                });
                                continue;
                            }
                            
                            const funcionarioProfile = todosOsFuncionarios.find(f => String(f.nif || '').trim() === idFuncionarioPicagem);

                            if (!funcionarioProfile) {
                                resultadosProcessamento.push({
                                    nome: `Funcionário Desconhecido (ID: ${idFuncionarioPicagem})`,
                                    tipo: 'Erro', periodo, horasRegulares, horasExtra,
                                    brutoCalculado: 0, liquidoEstimado: 0, estadoPagamento: 'Erro', erro: 'Perfil não encontrado'
                                });
                                continue;
                            }

                            let brutoCalculado = 0;
                            let liquidoEstimado = 0; 

                            if (funcionarioProfile.tipo_colaborador === 'Extra') {
                                const valorHora = parseFloat(funcionarioProfile.valor_hora_extra_definido || 0); 
                                brutoCalculado = (horasRegulares + horasExtra) * valorHora; 
                                liquidoEstimado = brutoCalculado; 
                            } else if (funcionarioProfile.tipo_colaborador === 'Fixo') {
                                brutoCalculado = parseFloat(funcionarioProfile.ordenado_bruto_base || 0);
                                liquidoEstimado = brutoCalculado; 
                            } else {
                                 resultadosProcessamento.push({
                                    nome: funcionarioProfile.full_name || funcionarioProfile.username,
                                    tipo: funcionarioProfile.tipo_colaborador || 'N/D', periodo, horasRegulares, horasExtra,
                                    brutoCalculado: 0, liquidoEstimado: 0, estadoPagamento: 'Erro', erro: 'Tipo de colaborador não definido'
                                });
                                continue;
                            }
                            totalLiquidoEstimadoPeriodo += liquidoEstimado;
                            resultadosProcessamento.push({
                                id: funcionarioProfile.id, 
                                nome: funcionarioProfile.full_name || funcionarioProfile.username,
                                tipo: funcionarioProfile.tipo_colaborador, periodo, horasRegulares, horasExtra,
                                brutoCalculado, liquidoEstimado, estadoPagamento: 'Pendente', erro: null
                            });
                        }

                        if (resultadosProcessamento.length > 0) {
                            resultadosProcessamento.forEach(res => {
                                const tr = document.createElement('tr');
                                tr.innerHTML = `
                                    <td>${res.nome}</td>
                                    <td>${res.tipo}</td>
                                    <td>${res.periodo}</td>
                                    <td>${res.horasRegulares.toFixed(2)}</td>
                                    <td>${res.horasExtra.toFixed(2)}</td>
                                    <td>${formatarMoeda(res.brutoCalculado)}</td>
                                    <td>${formatarMoeda(res.liquidoEstimado)}</td>
                                    <td class="${res.erro ? 'text-red-500 font-semibold' : ''}">${res.erro ? res.erro : res.estadoPagamento}</td>
                                    <td><button class="action-button text-xs !p-1" data-id="${res.id || ''}" ${res.erro || !res.id ? 'disabled' : ''}>Detalhes</button></td>
                                `;
                                processadosTableBodyEl.appendChild(tr);
                            });
                        } else {
                            processadosNenhumaMsgEl.classList.remove('hidden');
                            processadosNenhumaMsgEl.textContent = "Nenhum dado processado do ficheiro de picagens. Verifique o ficheiro e os NIFs.";
                        }
                        totalLiquidoPagarPeriodoEl.textContent = formatarMoeda(totalLiquidoEstimadoPeriodo);
                        processamentoStatusEl.textContent = `Processamento concluído para ${picagensData.length} registos do ficheiro. ${resultadosProcessamento.length} resultados para exibir.`;
                        labelPeriodoProcessadoEl.textContent = periodo;

                    } catch (err) {
                        console.error("Erro ao ler ou processar ficheiro de picagens:", err);
                        processamentoStatusEl.textContent = `Erro: ${err.message}`;
                        processadosNenhumaMsgEl.classList.remove('hidden');
                        processadosNenhumaMsgEl.textContent = `Erro: ${err.message}`;
                    } finally {
                        mostrarSpinner('loadingProcessamentoSpinner', false);
                    }
                };
                reader.readAsArrayBuffer(ficheiroPicagens);

            } catch (errorGlobal) {
                console.error("Erro global no processamento de salários:", errorGlobal);
                processamentoStatusEl.textContent = `Erro inesperado: ${errorGlobal.message}`;
                mostrarSpinner('loadingProcessamentoSpinner', false);
            }
        });


        // --- Lógica de Análise Picagens vs Atividade ---
        executarAnalisePicagensBtnEl.addEventListener('click', async () => {
            const funcionarioIdFiltro = analiseFuncionarioSelectEl.value; // Can be empty for "Todos"
            const dataAnalise = analiseDataEl.value;
            if (!dataAnalise) {
                alert("Selecione uma data para análise.");
                return;
            }
            analiseNenhumaMsgEl.classList.add('hidden');
            analisePicagensTableBodyEl.innerHTML = '';
            mostrarSpinner('loadingAnalisePicagensSpinner', true);

            try {
                // 1. Get relevant profiles
                let profilesToAnalyze = [];
                if (funcionarioIdFiltro) {
                    const profile = todosOsFuncionarios.find(f => f.id === funcionarioIdFiltro);
                    if (profile) profilesToAnalyze.push(profile);
                } else {
                    // If `todosOsFuncionarios` isn't guaranteed to be loaded, fetch all.
                    // For this illustrative version, assume `todosOsFuncionarios` is loaded via init or search.
                    // If it might be empty, a fetch like in salary processing would be needed here.
                    profilesToAnalyze = todosOsFuncionarios;
                }

                if (profilesToAnalyze.length === 0) {
                    analiseNenhumaMsgEl.textContent = "Nenhum funcionário selecionado ou carregado para análise.";
                    analiseNenhumaMsgEl.classList.remove('hidden');
                    mostrarSpinner('loadingAnalisePicagensSpinner', false);
                    return;
                }

                let resultsHtml = '';
                let discrepanciesFound = 0;

                for (const funcProfile of profilesToAnalyze) {
                    // 2. Simulate "Last Clock-out Time" for this illustrative example
                    // In a real scenario, this would come from a timesheet system/table.
                    // Example: Assume clock-out at 18:00 on the analysis date.
                    const dataAnaliseDateObj = new Date(dataAnalise);
                    const simulatedClockOutDateTime = new Date(
                        dataAnaliseDateObj.getFullYear(),
                        dataAnaliseDateObj.getMonth(),
                        dataAnaliseDateObj.getDate(),
                        18, 0, 0 // 18:00:00
                    );
                    const formattedSimulatedClockOut = simulatedClockOutDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

                    // 3. Fetch last activity from 'reservas'
                    // IMPORTANT: This assumes 'user_id_condutor_entrega' OR 'user_id_condutor_recolha'
                    // links an employee in 'profiles' to their activity in 'reservas'.
                    // Also assumes 'checkout_date_real' is the relevant activity timestamp.
                    // This query needs to be adapted based on the actual schema and logic.
                    const { data: lastActivityData, error: activityError } = await supabase
                        .from('reservas')
                        .select('checkout_date_real, booking_id, license_plate')
                        .or(`user_id_condutor_entrega.eq.${funcProfile.id},user_id_condutor_recolha.eq.${funcProfile.id}`) // Add other relevant user_id fields if necessary
                        .lte('checkout_date_real', `${dataAnalise}T23:59:59`) // Activity on or before the end of analysis date
                        .order('checkout_date_real', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    let lastActivityTimeStr = 'N/A';
                    let lastActivityDetails = 'Nenhuma atividade encontrada';
                    let disparityMinutes = null;
                    let observation = '';

                    if (activityError) {
                        console.error(`Erro ao buscar atividade para ${funcProfile.full_name}:`, activityError.message);
                        observation = 'Erro ao buscar atividade.';
                    } else if (lastActivityData && lastActivityData.checkout_date_real) {
                        const lastActivityDateTime = new Date(lastActivityData.checkout_date_real);
                        lastActivityTimeStr = lastActivityDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                        lastActivityDetails = `${lastActivityTimeStr} (Reserva: ${lastActivityData.booking_id || lastActivityData.license_plate})`;
                        
                        // Compare with simulatedClockOutDateTime
                        // Only consider if activity is on the SAME DAY as analysis for this simple comparison
                        if (lastActivityDateTime.toDateString() === dataAnaliseDateObj.toDateString()) {
                            const diffMs = simulatedClockOutDateTime.getTime() - lastActivityDateTime.getTime();
                            disparityMinutes = Math.round(diffMs / (1000 * 60));

                            if (disparityMinutes < 0) {
                                observation = `Atividade APÓS picagem (${Math.abs(disparityMinutes)} min).`;
                            } else if (disparityMinutes > 30) { // Example threshold for "significant"
                                observation = `Picagem ${disparityMinutes} min APÓS última atividade.`;
                                discrepanciesFound++;
                            } else {
                                observation = 'Normal';
                            }
                        } else {
                            observation = 'Última atividade noutro dia.';
                        }
                    } else {
                         observation = 'Nenhuma atividade registada no dia.';
                    }
                    
                    resultsHtml += `
                        <tr>
                            <td>${funcProfile.full_name || funcProfile.username}</td>
                            <td>${new Date(dataAnalise).toLocaleDateString('pt-PT')}</td>
                            <td>${formattedSimulatedClockOut} (Simulado)</td>
                            <td>${lastActivityDetails}</td>
                            <td class="${disparityMinutes !== null && Math.abs(disparityMinutes) > 30 ? 'text-red-600 font-bold' : ''}">${disparityMinutes !== null ? `${disparityMinutes} min` : 'N/A'}</td>
                            <td>${observation}</td>
                        </tr>
                    `;
                }

                analisePicagensTableBodyEl.innerHTML = resultsHtml;
                if (!resultsHtml) {
                    analiseNenhumaMsgEl.textContent = "Nenhum dado para apresentar para os critérios selecionados.";
                    analiseNenhumaMsgEl.classList.remove('hidden');
                } else if (discrepanciesFound === 0 && resultsHtml) {
                     analiseNenhumaMsgEl.textContent = "Nenhuma disparidade significativa encontrada.";
                     analiseNenhumaMsgEl.classList.remove('hidden');
                }


            } catch (error) {
                console.error("Erro ao executar análise de picagens:", error);
                analiseNenhumaMsgEl.textContent = `Erro ao executar análise: ${error.message}`;
                analiseNenhumaMsgEl.classList.remove('hidden');
            } finally {
                mostrarSpinner('loadingAnalisePicagensSpinner', false);
            }
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
            const parqueIdOperacao = getParqueIdOperacaoRH();
            const rhGlobalNotificationEl = document.getElementById('rhGlobalNotification'); 

            if (!parqueIdOperacao && userProfile?.role !== 'super_admin' && userProfile?.role !== 'admin') {
                if (rhGlobalNotificationEl) {
                    rhGlobalNotificationEl.textContent = "Nenhum parque de operação selecionado. Por favor, selecione um parque no dashboard principal para ativar as funcionalidades desta página.";
                    rhGlobalNotificationEl.className = 'subapp-section mb-4 text-red-700 p-4 bg-red-100 border border-red-300 rounded-md';
                    rhGlobalNotificationEl.classList.remove('hidden');
                } else {
                    alert("Nenhum parque de operação selecionado. Por favor, selecione um parque no dashboard principal.");
                }
                
                const elementsToDisable = [
                    filtroNomeFuncionarioEl, pesquisarFuncionarioBtnEl, novoFuncionarioBtnEl,
                    importPicagensFileEl, periodoProcessamentoEl, processarSalariosBtnEl,
                    analiseFuncionarioSelectEl, analiseDataEl, executarAnalisePicagensBtnEl,
                    // Add form elements if they are not within a hidden section by default
                    nomeCompletoEl, moradaEl, dataNascimentoEl, nifEl, docIdTipoEl, docIdNumeroEl, fotoEl, funcaoEl, dataEntradaEl, dataSaidaEl, parquePrincipalEl, supervisorDiretoEl, tipoColaboradorEl, ordenadoBrutoEl, horarioTrabalhoEl, nivelExtraEl, valorHoraExtraEl, ibanEl, ativoEl,
                    tipoDocumentoUploadEl, ficheiroDocumentoUploadEl, dataValidadeDocEl, obsDocumentoUploadEl, uploadDocumentoBtnEl
                ];
                elementsToDisable.forEach(el => { if(el) el.disabled = true; });
                
                if(funcionariosNenhumaMsgEl) { funcionariosNenhumaMsgEl.textContent = "Selecione um parque para listar funcionários."; funcionariosNenhumaMsgEl.classList.remove('hidden');}
                if(funcionariosTableBodyEl) funcionariosTableBodyEl.innerHTML = '';
                if(processadosNenhumaMsgEl) { processadosNenhumaMsgEl.textContent = "Selecione um parque para processar salários."; processadosNenhumaMsgEl.classList.remove('hidden');}
                if(processadosTableBodyEl) processadosTableBodyEl.innerHTML = '';
                if(analiseNenhumaMsgEl) { analiseNenhumaMsgEl.textContent = "Selecione um parque para análises."; analiseNenhumaMsgEl.classList.remove('hidden');}
                if(analisePicagensTableBodyEl) analisePicagensTableBodyEl.innerHTML = '';

                if(formularioFuncionarioSecaoEl) formularioFuncionarioSecaoEl.classList.add('hidden');
                if(documentosSecaoEl) documentosSecaoEl.classList.add('hidden');
                
                return; 
            } else {
                if (rhGlobalNotificationEl) {
                    rhGlobalNotificationEl.textContent = ""; 
                    rhGlobalNotificationEl.className = 'subapp-section mb-4 hidden'; // Hide by default if park is selected or admin
                }
                 const elementsToEnable = [ // Ensure elements are enabled if a park is selected or user is admin
                    filtroNomeFuncionarioEl, pesquisarFuncionarioBtnEl, novoFuncionarioBtnEl,
                    importPicagensFileEl, periodoProcessamentoEl, processarSalariosBtnEl,
                    analiseFuncionarioSelectEl, analiseDataEl, executarAnalisePicagensBtnEl,
                    nomeCompletoEl, moradaEl, dataNascimentoEl, nifEl, docIdTipoEl, docIdNumeroEl, fotoEl, funcaoEl, dataEntradaEl, dataSaidaEl, parquePrincipalEl, supervisorDiretoEl, tipoColaboradorEl, ordenadoBrutoEl, horarioTrabalhoEl, nivelExtraEl, valorHoraExtraEl, ibanEl, ativoEl,
                    tipoDocumentoUploadEl, ficheiroDocumentoUploadEl, dataValidadeDocEl, obsDocumentoUploadEl, uploadDocumentoBtnEl
                ];
                elementsToEnable.forEach(el => { if(el) el.disabled = false; });
            }

            analiseDataEl.value = new Date().toISOString().split('T')[0];
            periodoProcessamentoEl.value = new Date().toISOString().slice(0,7); 

            await carregarDadosParaSelectsRH();
            await carregarFuncionarios(); 
            resetFormularioFuncionario(); 
            console.log("Subaplicação de Recursos Humanos inicializada.");
        }

        initRHPage();
    } // End of initializeRHPageLogic

    async function handleAuthRH() {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('Error getting session (RH):', error.message);
            return;
        }

        if (session && session.user) {
            const fetchedUserProfile = JSON.parse(localStorage.getItem('userProfile')); 
            if (fetchedUserProfile) {
                 initializeRHPageLogic(session.user, fetchedUserProfile);
            } else {
                console.error('User session exists but profile not found in localStorage (RH). Logging out.');
                if (typeof handleLogoutGlobal === 'function') handleLogoutGlobal(); else window.location.href = 'index.html';
            }
        } else {
            document.body.classList.remove('rh-logic-initialized'); 
        }
    }

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            if (session && session.user) {
                const freshProfile = JSON.parse(localStorage.getItem('userProfile'));
                if (freshProfile) {
                    initializeRHPageLogic(session.user, freshProfile);
                } else {
                     console.error('Auth event triggered session but profile missing in localStorage (RH).');
                     if (typeof handleLogoutGlobal === 'function') handleLogoutGlobal(); else window.location.href = 'index.html';
                }
            }
        } else if (event === 'SIGNED_OUT') {
            currentUser = null; 
            userProfile = null; 
            document.body.classList.remove('rh-logic-initialized');
        }
    });

    handleAuthRH();
});

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

[end of js/recursos_humanos.js]

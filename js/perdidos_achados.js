// js/perdidos_achados.js - Lógica para Perdidos e Achados

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Perdidos e Achados.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnPA');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const loadingGlobalSpinner = null; // Adicionar um spinner global se necessário

    // Aba Lista de Casos
    const filtroMatriculaEl = document.getElementById('paFiltroMatricula');
    const filtroAlocationEl = document.getElementById('paFiltroAlocation');
    const filtroClienteEl = document.getElementById('paFiltroCliente');
    const filtroEstadoEl = document.getElementById('paFiltroEstado');
    const aplicarFiltrosListaBtnEl = document.getElementById('paAplicarFiltrosListaBtn');
    const loadingCasosSpinnerEl = document.getElementById('loadingPACasosSpinner');
    const casosTableBodyEl = document.getElementById('paCasosTableBody');
    const casosNenhumaMsgEl = document.getElementById('paCasosNenhumMsg');
    const casosPaginacaoEl = document.getElementById('paCasosPaginacao');

    // Aba Novo Caso
    const novoCasoContentEl = document.getElementById('novoCasoContent');
    const formCasoTitleEl = document.getElementById('paFormCasoTitle');
    const novoCasoFormEl = document.getElementById('paNovoCasoForm');
    const casoFormIdEl = document.getElementById('paCasoFormId'); // Hidden para edição
    const matriculaInputEl = document.getElementById('paMatricula');
    const alocationInputEl = document.getElementById('paAlocation');
    const buscarDadosReservaBtnEl = document.getElementById('paBuscarDadosReservaBtn');
    const nomeClienteInputEl = document.getElementById('paNomeCliente');
    const contactoClienteInputEl = document.getElementById('paContactoCliente');
    const origemQueixaEl = document.getElementById('paOrigemQueixa');
    const dataQueixaEl = document.getElementById('paDataQueixa');
    const descricaoQueixaEl = document.getElementById('paDescricaoQueixa');
    const parqueOcorrenciaEl = document.getElementById('paParqueOcorrencia');
    const anexoQueixaEl = document.getElementById('paAnexoQueixa');
    const anexoQueixaNomeEl = document.getElementById('paAnexoQueixaNome');
    // const ficheiroMovimentacoesEl = document.getElementById('paFicheiroMovimentacoes'); // Se upload manual
    const novoCasoStatusEl = document.getElementById('paNovoCasoStatus');

    // Aba Detalhe do Caso
    const detalheCasoContentEl = document.getElementById('detalheCasoContent');
    const detalheCasoTitleEl = document.getElementById('paDetalheCasoTitle');
    const detalheCasoIdExibicaoEl = document.getElementById('paDetalheCasoIdExibicao');
    const voltarParaListaBtnEl = document.getElementById('paVoltarParaListaBtn');
    const detalheCasoIdAtualEl = document.getElementById('paDetalheCasoIdAtual'); // Hidden
    const detalheClienteNomeEl = document.getElementById('detalheClienteNome');
    const detalheClienteContactoEl = document.getElementById('detalheClienteContacto');
    const detalheMatriculaAlocEl = document.getElementById('detalheMatriculaAloc');
    const detalheDataQueixaEl = document.getElementById('detalheDataQueixa');
    const detalheItemPerdidoEl = document.getElementById('detalheItemPerdido'); // Precisa ser preenchido
    const detalheDescricaoCompletaEl = document.getElementById('detalheDescricaoCompleta');
    const detalheEstadoAtualEl = document.getElementById('detalheEstadoAtual');
    const detalheListaAnexosEl = document.getElementById('paDetalheListaAnexos');
    const novoAnexoTipoEl = document.getElementById('paNovoAnexoTipo');
    const novoAnexoFicheiroEl = document.getElementById('paNovoAnexoFicheiro');
    const adicionarAnexoBtnEl = document.getElementById('paAdicionarAnexoBtn');
    const novoAnexoStatusEl = document.getElementById('paNovoAnexoStatus');
    const loadingMovimentacoesSpinnerEl = document.getElementById('loadingMovimentacoesSpinner');
    const detalhePeriodoInvestigacaoEl = document.getElementById('detalhePeriodoInvestigacao');
    const movimentacoesTableBodyEl = document.getElementById('paMovimentacoesTableBody');
    const movimentacoesNenhumaMsgEl = document.getElementById('paMovimentacoesNenhumaMsg');
    const notasInvestigacaoEl = document.getElementById('paNotasInvestigacao');
    const estadoResolucaoEl = document.getElementById('paEstadoResolucao');
    const detalhesResolucaoFinalEl = document.getElementById('paDetalhesResolucaoFinal');
    const guardarProgressoBtnEl = document.getElementById('paGuardarProgressoInvestigacaoBtn');
    const detalheCasoStatusEl = document.getElementById('paDetalheCasoStatus');

    // Aba Análise Condutores
    const analiseCondDataInicioEl = document.getElementById('paAnaliseCondutorDataInicio');
    const analiseCondDataFimEl = document.getElementById('paAnaliseCondutorDataFim');
    const executarAnaliseCondutoresBtnEl = document.getElementById('paExecutarAnaliseCondutoresBtn');
    const loadingAnaliseCondutoresSpinnerEl = document.getElementById('loadingAnaliseCondutoresSpinner');
    const analiseCondutoresTableBodyEl = document.getElementById('paAnaliseCondutoresTableBody');
    const analiseCondutoresNenhumaMsgEl = document.getElementById('paAnaliseCondutoresNenhumaMsg');


    // --- Estado da Aplicação ---
    let listaCasosPA = [];
    let paginaAtualCasos = 1;
    const itensPorPaginaCasos = 10;
    let listaParquesPA = [];

    // --- Funções Auxiliares ---
    function formatarDataHora(dataISO, apenasData = false) { /* ... */ return dataISO ? new Date(dataISO).toLocaleString('pt-PT', {dateStyle:'short', timeStyle: apenasData ? undefined : 'short'}) : 'N/A'; }
    function mostrarSpinner(id, show = true) { document.getElementById(id)?.classList.toggle('hidden', !show); }
    function getEstadoCasoClass(estado) {
        switch (String(estado || '').toLowerCase()) {
            case 'aberto': return 'status-aberto';
            case 'em investigação': return 'status-investigacao';
            case 'resolvido - devolvido':
            case 'resolvido - não encontrado':
            case 'resolvido - outro':
            case 'resolvido - rejeitado': return 'status-resolvido';
            case 'fechado': return 'status-fechado';
            default: return 'bg-gray-200 text-gray-700';
        }
    }

    // --- Navegação por Abas ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(tabId + 'Content').classList.add('active');

            if (tabId === 'listaCasos') carregarCasosPA();
            else if (tabId === 'novoCaso') resetFormNovoCaso();
            else if (tabId === 'detalheCasoContent' && !detalheCasoIdAtualEl.value) { // Evitar ir para detalhes sem ID
                 tabButtons[0].click(); // Volta para lista
            }
        });
    });
    
    function mostrarTab(tabId, casoIdParaDetalhe = null) {
        const tabButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (tabButton) {
            if(tabId === 'detalheCasoContent' && casoIdParaDetalhe) {
                abrirDetalhesCaso(casoIdParaDetalhe); // Função que carrega os dados e depois mostra a tab
            } else {
                 tabButton.click();
            }
        }
    }


    // --- Carregar Dados Iniciais (Parques) ---
    async function carregarParquesPA() {
        const { data, error } = await supabase.from('parques').select('id, nome, cidade').order('cidade').order('nome');
        if (error) console.error("Erro ao carregar parques para P&A:", error);
        else listaParquesPA = data || [];
        
        parqueOcorrenciaEl.innerHTML = '<option value="">Selecione o Parque</option>';
        listaParquesPA.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.nome} (${p.cidade || 'N/A'})`;
            parqueOcorrenciaEl.appendChild(opt);
        });
    }

    // --- Aba Lista de Casos ---
    async function carregarCasosPA(pagina = 1) {
        paginaAtualCasos = pagina;
        mostrarSpinner('loadingPACasosSpinner', true);
        casosTableBodyEl.innerHTML = '';
        casosNenhumaMsgEl.classList.add('hidden');

        let query = supabase.from('perdidos_achados_casos')
            .select(`*, user_registo:profiles(full_name, username)`, { count: 'exact' });

        if (filtroMatriculaEl.value) query = query.ilike('matricula_veiculo', `%${filtroMatriculaEl.value}%`);
        if (filtroAlocationEl.value) query = query.ilike('alocation_veiculo', `%${filtroAlocationEl.value}%`);
        if (filtroClienteEl.value) query = query.ilike('nome_cliente', `%${filtroClienteEl.value}%`);
        if (filtroEstadoEl.value) query = query.eq('estado_caso', filtroEstadoEl.value);
        
        const offset = (pagina - 1) * itensPorPaginaCasos;
        query = query.order('data_queixa', { ascending: false }).range(offset, offset + itensPorPaginaCasos - 1);

        const { data, error, count } = await query;
        mostrarSpinner('loadingPACasosSpinner', false);

        if (error) {
            console.error("Erro ao carregar casos P&A:", error);
            casosNenhumaMsgEl.textContent = "Erro ao carregar casos.";
            casosNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        listaCasosPA = data || [];
        renderTabelaCasosPA(listaCasosPA);
        renderPaginacaoCasosPA(count);
    }

    function renderTabelaCasosPA(casos) {
        casosTableBodyEl.innerHTML = '';
        if (casos.length === 0) {
            casosNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        casos.forEach(caso => {
            const tr = document.createElement('tr');
            const userReg = caso.user_registo?.full_name || caso.user_registo?.username || 'N/A';
            tr.innerHTML = `
                <td>PA-${String(caso.id).substring(0,8)}</td>
                <td>${formatarDataHora(caso.data_queixa)}</td>
                <td>${caso.matricula_veiculo}</td>
                <td>${caso.nome_cliente || 'N/A'}</td>
                <td class="max-w-xs truncate" title="${caso.descricao_queixa}">${caso.detalhes_item_perdido || caso.descricao_queixa.substring(0,50)+'...'}</td>
                <td><span class="status-tag ${getEstadoCasoClass(caso.estado_caso)}">${caso.estado_caso}</span></td>
                <td>${userReg}</td>
                <td class="actions-cell">
                    <button class="action-button text-xs !p-1 pa-ver-detalhes-btn" data-id="${caso.id}">Ver/Gerir</button>
                </td>
            `;
            casosTableBodyEl.appendChild(tr);
        });
    }
    function renderPaginacaoCasosPA(totalItens) { /* ... (implementar como nas outras apps) ... */ }


    // --- Aba Novo Caso ---
    function resetFormNovoCaso() {
        novoCasoFormEl.reset();
        casoFormIdEl.value = ''; // Certificar que não estamos a editar
        formCasoTitleEl.textContent = 'Registar Novo Caso de Perdidos e Achados';
        dataQueixaEl.value = new Date().toISOString().slice(0,16);
        anexoQueixaNomeEl.textContent = '';
        novoCasoStatusEl.textContent = '';
    }

    buscarDadosReservaBtnEl.addEventListener('click', async () => {
        const matricula = matriculaInputEl.value.trim();
        const alocation = alocationInputEl.value.trim();
        if (!matricula || !alocation) {
            alert("Insira a matrícula e alocation para buscar dados da reserva.");
            return;
        }
        novoCasoStatusEl.textContent = "A buscar dados da reserva...";
        const { data: reserva, error } = await supabase.from('reservas')
            .select('id, nome_cliente, email_cliente, telefone_cliente, parque_id')
            .eq('matricula', matricula) // Idealmente normalizar matricula aqui também
            .eq('alocation', alocation)
            .order('data_reserva', {ascending: false}) // Pega a mais recente se houver múltiplas
            .limit(1)
            .single();
        
        if (error || !reserva) {
            novoCasoStatusEl.textContent = "Reserva não encontrada ou erro ao buscar. Preencha os dados do cliente manualmente.";
            console.error("Erro buscar reserva P&A:", error);
        } else {
            nomeClienteInputEl.value = reserva.nome_cliente || '';
            // Combinar email e telefone no campo contacto
            let contacto = '';
            if(reserva.email_cliente) contacto += reserva.email_cliente;
            if(reserva.telefone_cliente) contacto += (contacto ? ' / ' : '') + reserva.telefone_cliente;
            contactoClienteInputEl.value = contacto;
            if(reserva.parque_id) parqueOcorrenciaEl.value = reserva.parque_id;
            novoCasoStatusEl.textContent = "Dados da reserva preenchidos (se encontrados).";
        }
    });
    
    anexoQueixaEl.addEventListener('change', () => {
        anexoQueixaNomeEl.textContent = anexoQueixaEl.files[0] ? anexoQueixaEl.files[0].name : '';
    });

    novoCasoFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!currentUser) { alert("Sessão inválida."); return; }
        novoCasoStatusEl.textContent = "A registar caso...";

        let anexoUrl = null;
        let anexoPath = null;
        const ficheiroAnexo = anexoQueixaEl.files[0];
        if (ficheiroAnexo) {
            const nomeFicheiro = `perdidos_achados/anexos_queixa/${currentUser.id}_${Date.now()}_${ficheiroAnexo.name.replace(/\s+/g, '_')}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('documentos-casos-pa').upload(nomeFicheiro, ficheiroAnexo);
            if (uploadError) { novoCasoStatusEl.textContent = `Erro upload anexo: ${uploadError.message}`; return; }
            const { data: urlData } = supabase.storage.from('documentos-casos-pa').getPublicUrl(uploadData.path);
            anexoUrl = urlData.publicUrl;
            anexoPath = uploadData.path;
        }

        const dadosCaso = {
            matricula_veiculo: matriculaInputEl.value.trim(),
            alocation_veiculo: alocationInputEl.value.trim(),
            nome_cliente: nomeClienteInputEl.value.trim() || null,
            contacto_cliente: contactoClienteInputEl.value.trim() || null,
            data_queixa: new Date(dataQueixaEl.value).toISOString(),
            user_id_registo: currentUser.id,
            descricao_queixa: descricaoQueixaEl.value.trim(),
            origem_queixa: origemQueixaEl.value,
            detalhes_item_perdido: descricaoQueixaEl.value.substring(0, 100), // Resumo para listagens
            parque_id_ocorrencia: parqueOcorrenciaEl.value || null,
            estado_caso: 'Aberto'
        };
        
        const { data: novoCaso, error: erroInsertCaso } = await supabase.from('perdidos_achados_casos').insert(dadosCaso).select().single();

        if (erroInsertCaso) {
            novoCasoStatusEl.textContent = `Erro ao registar caso: ${erroInsertCaso.message}`;
            // Se o upload do anexo foi feito mas o caso falhou, apagar o anexo do storage
            if (anexoPath) await supabase.storage.from('documentos-casos-pa').remove([anexoPath]);
            return;
        }

        // Se houve anexo e o caso foi criado, registar o anexo na tabela `perdidos_achados_anexos`
        if (anexoUrl && novoCaso) {
            await supabase.from('perdidos_achados_anexos').insert({
                caso_id: novoCaso.id,
                tipo_anexo: 'Email Queixa', // Ou outro tipo conforme o contexto
                nome_ficheiro_original: ficheiroAnexo.name,
                ficheiro_url: anexoUrl,
                storage_bucket_path: anexoPath,
                user_id_upload: currentUser.id
            });
        }
        
        novoCasoStatusEl.textContent = `Caso PA-${String(novoCaso.id).substring(0,8)} registado com sucesso!`;
        novoCasoFormEl.reset();
        anexoQueixaNomeEl.textContent = '';
        dataQueixaEl.value = new Date().toISOString().slice(0,16);
        await carregarCasosPA(); // Atualizar lista
        mostrarTab('detalheCasoContent', novoCaso.id); // Abrir detalhes do novo caso
    });

    // --- Aba Detalhes do Caso ---
    // (Funções para carregar detalhes, movimentações, anexos, e guardar progresso)
    // ... esta parte será extensa ...
    async function abrirDetalhesCaso(casoId) {
        // 1. Carregar dados do caso
        // 2. Carregar anexos do caso
        // 3. Carregar movimentações do veículo (baseado em matricula, alocation e datas da reserva associada, se houver)
        // 4. Popular os campos do HTML
        // 5. Mudar para a tab de detalhes
        detalheCasoContentEl.classList.remove('hidden'); // Mostrar a tab
        document.querySelector('.tab-button[data-tab="detalheCasoContent"]')?.classList.add('active'); // Marcar a tab (se existir uma tab dedicada)
        document.querySelector('.tab-button[data-tab="listaCasos"]')?.classList.remove('active'); // Desmarcar a tab da lista
        document.getElementById('listaCasosContent').classList.add('hidden'); // Esconder lista


        console.log("Abrir detalhes para caso ID:", casoId);
        // Implementação detalhada aqui...
    }
    
    if(voltarParaListaBtnEl) voltarParaListaBtnEl.addEventListener('click', () => mostrarTab('listaCasos'));


    // --- Aba Análise de Condutores (Esqueleto) ---
    executarAnaliseCondutoresBtnEl.addEventListener('click', async () => {
        const dataInicio = analiseCondDataInicioEl.value;
        const dataFim = analiseCondDataFimEl.value;
        if (!dataInicio || !dataFim) { alert("Selecione o período para análise."); return; }

        mostrarSpinner('loadingAnaliseCondutoresSpinner', true);
        analiseCondutoresTableBodyEl.innerHTML = '';
        analiseCondutoresNenhumaMsgEl.classList.add('hidden');
        
        // 1. Obter todos os casos de P&A no período.
        // 2. Para cada caso, obter as movimentações e os condutores envolvidos.
        // 3. Agrupar por condutor: contar nº de casos distintos, listar matrículas/alocations.
        // Esta query é complexa e idealmente seria uma RPC no Supabase.
        // Ex: supabase.rpc('analisar_condutores_perdidos_achados', { p_data_inicio: dataInicio, p_data_fim: dataFim })

        await new Promise(resolve => setTimeout(resolve, 1000)); // Simular
        mostrarSpinner('loadingAnaliseCondutoresSpinner', false);
        analiseCondutoresTableBodyEl.innerHTML = `<tr><td>Condutor X</td><td>5</td><td>AA-00-BB (ALOC1), CC-11-DD (ALOC2)...</td><td>10%</td></tr>`;
    });


    // --- Event Listeners Gerais ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (aplicarFiltrosListaBtnEl) aplicarFiltrosListaBtnEl.addEventListener('click', () => carregarCasosPA(1));
    
    casosTableBodyEl.addEventListener('click', (e) => {
        const targetButton = e.target.closest('.pa-ver-detalhes-btn');
        if (targetButton) {
            mostrarTab('detalheCasoContent', targetButton.dataset.id);
        }
    });


    // --- Inicialização da Página ---
    async function initPerdidosAchadosPage() {
        if (!userProfile) { alert("Perfil não carregado."); return; }
        dataQueixaEl.value = new Date().toISOString().slice(0,16); // Default para novo caso
        analiseDataEl.value = new Date().toISOString().split('T')[0]; // Default para análise
        const hoje = new Date();
        analiseCondDataInicioEl.value = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
        analiseCondDataFimEl.value = hoje.toISOString().split('T')[0];


        await carregarParquesPA();
        await carregarCasosPA(); // Carregar lista inicial
        console.log("Subaplicação de Perdidos e Achados inicializada.");
    }

    initPerdidosAchadosPage();
});

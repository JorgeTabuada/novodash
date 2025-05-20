// js/comentarios_reclamacoes.js

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Comentários/Reclamações.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnCR');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Aba Lista
    const filtroMatriculaEl = document.getElementById('crFiltroMatricula');
    const filtroAlocationEl = document.getElementById('crFiltroAlocation');
    const filtroClienteEl = document.getElementById('crFiltroCliente');
    const filtroTipoReclamacaoEl = document.getElementById('crFiltroTipoReclamacao');
    const filtroEstadoEl = document.getElementById('crFiltroEstado');
    const aplicarFiltrosListaBtnEl = document.getElementById('crAplicarFiltrosListaBtn');
    const loadingSpinnerEl = document.getElementById('loadingCRSpinner');
    const tableBodyEl = document.getElementById('crReclamacoesTableBody');
    const nenhumaMsgEl = document.getElementById('crReclamacoesNenhumaMsg');
    const paginacaoEl = document.getElementById('crReclamacoesPaginacao');

    // Aba Novo Caso
    const formReclamacaoTitleEl = document.getElementById('crFormReclamacaoTitle');
    const novoReclamacaoFormEl = document.getElementById('crNovaReclamacaoForm');
    const reclamacaoFormIdEl = document.getElementById('crReclamacaoFormId');
    const matriculaInputEl = document.getElementById('crMatricula');
    const alocationInputEl = document.getElementById('crAlocation');
    const buscarDadosReservaBtnEl = document.getElementById('crBuscarDadosReservaBtn');
    const nomeClienteInputEl = document.getElementById('crNomeCliente');
    const contactoClienteInputEl = document.getElementById('crContactoCliente');
    const origemReclamacaoEl = document.getElementById('crOrigemReclamacao');
    const dataReclamacaoEl = document.getElementById('crDataReclamacao');
    const tipoReclamacaoFormEl = document.getElementById('crTipoReclamacaoForm');
    const descricaoReclamacaoEl = document.getElementById('crDescricaoReclamacao');
    const parqueOcorrenciaEl = document.getElementById('crParqueOcorrencia');
    const anexoPrincipalEl = document.getElementById('crAnexoPrincipal');
    const anexoPrincipalNomeEl = document.getElementById('crAnexoPrincipalNome');
    const ficheiroMovimentacoesEl = document.getElementById('crFicheiroMovimentacoesVeiculo');
    const ficheiroMovimentacoesNomeEl = document.getElementById('crFicheiroMovimentacoesVeiculoNome');
    const novaReclamacaoStatusEl = document.getElementById('crNovaReclamacaoStatus');

    // Aba Detalhe do Caso
    const detalheReclamacaoContentEl = document.getElementById('detalheReclamacaoContent');
    const detalheReclamacaoTitleEl = document.getElementById('crDetalheReclamacaoTitle');
    const detalheReclamacaoIdExibicaoEl = document.getElementById('crDetalheReclamacaoIdExibicao');
    const voltarParaListaBtnEl = document.getElementById('crVoltarParaListaBtn');
    const detalheReclamacaoIdAtualEl = document.getElementById('crDetalheReclamacaoIdAtual');
    const detalheClienteNomeEl = document.getElementById('crDetalheClienteNome');
    const detalheClienteContactoEl = document.getElementById('crDetalheClienteContacto');
    const detalheMatriculaAlocEl = document.getElementById('crDetalheMatriculaAloc');
    const detalheDataRegistoEl = document.getElementById('crDetalheDataRegisto'); // Mudado de Queixa para Registo
    const detalheTipoReclamacaoEl = document.getElementById('crDetalheTipoReclamacao');
    const detalheDescricaoCompletaEl = document.getElementById('crDetalheDescricaoCompleta');
    const detalheEstadoAtualEl = document.getElementById('crDetalheEstadoAtual');
    const detalheAvaliacaoObrigatoriaEl = document.getElementById('crDetalheAvaliacaoObrigatoria');
    const detalheOcorrenciasAssociadasEl = document.getElementById('crDetalheOcorrenciasAssociadas');
    const detalheListaAnexosEl = document.getElementById('crDetalheListaAnexos');
    const novoAnexoTipoEl = document.getElementById('crNovoAnexoTipo');
    const novoAnexoFicheiroEl = document.getElementById('crNovoAnexoFicheiro');
    const adicionarAnexoBtnEl = document.getElementById('crAdicionarAnexoBtn');
    const novoAnexoStatusEl = document.getElementById('crNovoAnexoStatus');
    const loadingMovimentacoesSpinnerEl = document.getElementById('loadingCRMovimentacoesSpinner');
    const detalhePeriodoInvestigacaoEl = document.getElementById('crDetalhePeriodoInvestigacao');
    const movimentacoesTableBodyEl = document.getElementById('crMovimentacoesTableBody');
    const movimentacoesNenhumaMsgEl = document.getElementById('crMovimentacoesNenhumaMsg');
    const notasAcompanhamentoEl = document.getElementById('crNotasAcompanhamento');
    const estadoResolucaoEl = document.getElementById('crEstadoResolucao');
    const detalhesResolucaoFinalEl = document.getElementById('crDetalhesResolucaoFinal');
    const guardarProgressoBtnEl = document.getElementById('crGuardarProgressoBtn');
    const detalheReclamacaoStatusEl = document.getElementById('crDetalheReclamacaoStatus');

    // --- Estado da Aplicação ---
    let listaReclamacoes = [];
    let paginaAtual = 1;
    const itensPorPagina = 10;
    let listaParquesCR = [];
    const ESTADOS_RECLAMACAO = ["Aberta", "Em Análise", "Pendente Resposta Cliente", "Resolvida - Procedente", "Resolvida - Improcedente", "Fechada"];


    // --- Funções Auxiliares ---
    function formatarDataHora(dataISO, apenasData = false) { /* ... */ return dataISO ? new Date(dataISO).toLocaleString('pt-PT', {dateStyle:'short', timeStyle: apenasData ? undefined : 'short'}) : 'N/A'; }
    function mostrarSpinner(id, show = true) { document.getElementById(id)?.classList.toggle('hidden', !show); }
    function getEstadoReclamacaoClass(estado) {
        switch (String(estado || '').toLowerCase()) {
            case 'aberta': return 'status-reclam-aberta';
            case 'em análise': return 'status-reclam-analise';
            case 'resolvida - procedente':
            case 'resolvida - improcedente': return 'status-reclam-resolvida';
            case 'fechada': return 'status-reclam-fechada';
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

            if (tabId === 'listaReclamacoes') carregarReclamacoes();
            else if (tabId === 'novaReclamacao') resetFormNovaReclamacao();
            else if (tabId === 'detalheReclamacaoContent' && !detalheReclamacaoIdAtualEl.value) {
                 tabButtons[0].click();
            }
        });
    });
    function mostrarTab(tabId, casoIdParaDetalhe = null) {
        const tabButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (tabButton) {
            if(tabId === 'detalheReclamacaoContent' && casoIdParaDetalhe) {
                abrirDetalhesReclamacao(casoIdParaDetalhe);
            } else {
                 tabButton.click();
            }
        }
    }

    // --- Carregar Dados Iniciais (Parques para Selects) ---
    async function carregarParquesCR() {
        const { data, error } = await supabase.from('parques').select('id, nome, cidade').order('cidade').order('nome');
        if (error) console.error("Erro ao carregar parques para C&R:", error);
        else listaParquesCR = data || [];
        
        parqueOcorrenciaEl.innerHTML = '<option value="">Selecione o Parque da Ocorrência</option>';
        listaParquesCR.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.nome} (${p.cidade || 'N/A'})`;
            parqueOcorrenciaEl.appendChild(opt);
        });
    }
    
    // --- Aba Lista de Reclamações ---
    async function carregarReclamacoes(pagina = 1) {
        paginaAtual = pagina;
        mostrarSpinner('loadingCRSpinner', true);
        tableBodyEl.innerHTML = '';
        nenhumaMsgEl.classList.add('hidden');

        let query = supabase.from('comentarios_reclamacoes')
            .select(`*, user_reg:profiles(full_name, username)`, { count: 'exact' });

        if (filtroMatriculaEl.value) query = query.ilike('matricula_veiculo', `%${filtroMatriculaEl.value}%`);
        if (filtroAlocationEl.value) query = query.ilike('alocation_veiculo', `%${filtroAlocationEl.value}%`);
        if (filtroClienteEl.value) query = query.ilike('nome_cliente', `%${filtroClienteEl.value}%`);
        if (filtroTipoReclamacaoEl.value) query = query.eq('tipo_reclamacao', filtroTipoReclamacaoEl.value);
        if (filtroEstadoEl.value) query = query.eq('estado_reclamacao', filtroEstadoEl.value);
        
        const offset = (pagina - 1) * itensPorPagina;
        query = query.order('data_reclamacao', { ascending: false }).range(offset, offset + itensPorPagina - 1);

        const { data, error, count } = await query;
        mostrarSpinner('loadingCRSpinner', false);

        if (error) {
            console.error("Erro ao carregar reclamações:", error);
            nenhumaMsgEl.textContent = "Erro ao carregar reclamações.";
            nenhumaMsgEl.classList.remove('hidden');
            return;
        }
        listaReclamacoes = data || [];
        renderTabelaReclamacoes(listaReclamacoes);
        renderPaginacaoReclamacoes(count);
    }

    function renderTabelaReclamacoes(reclamacoes) {
        tableBodyEl.innerHTML = '';
        if (reclamacoes.length === 0) {
            nenhumaMsgEl.classList.remove('hidden');
            return;
        }
        reclamacoes.forEach(rec => {
            const tr = document.createElement('tr');
            const userReg = rec.user_reg?.full_name || rec.user_reg?.username || 'N/A';
            tr.innerHTML = `
                <td>CR-${String(rec.id).substring(0,8)}</td>
                <td>${formatarDataHora(rec.data_reclamacao)}</td>
                <td>${rec.matricula_veiculo}</td>
                <td>${rec.nome_cliente || 'N/A'}</td>
                <td>${rec.tipo_reclamacao}</td>
                <td><span class="status-tag ${getEstadoReclamacaoClass(rec.estado_reclamacao)}">${rec.estado_reclamacao}</span></td>
                <td>${userReg}</td>
                <td class="actions-cell">
                    <button class="action-button text-xs !p-1 cr-ver-detalhes-btn" data-id="${rec.id}">Ver/Gerir</button>
                </td>
            `;
            tableBodyEl.appendChild(tr);
        });
    }
    function renderPaginacaoReclamacoes(totalItens) { /* ... (implementar) ... */ }

    // --- Aba Novo Caso ---
    function resetFormNovaReclamacao() {
        novoReclamacaoFormEl.reset();
        reclamacaoFormIdEl.value = '';
        formReclamacaoTitleEl.textContent = 'Registar Nova Reclamação/Comentário';
        dataReclamacaoEl.value = new Date().toISOString().slice(0,16);
        anexoPrincipalNomeEl.textContent = '';
        ficheiroMovimentacoesNomeEl.textContent = '';
        novaReclamacaoStatusEl.textContent = '';
    }

    buscarDadosReservaBtnEl.addEventListener('click', async () => {
        const matricula = matriculaInputEl.value.trim();
        const alocation = alocationInputEl.value.trim();
        if (!matricula || !alocation) {
            alert("Insira a matrícula e alocation para buscar dados da reserva.");
            return;
        }
        novaReclamacaoStatusEl.textContent = "A buscar dados da reserva...";
        const { data: reserva, error } = await supabase.from('reservas')
            .select('id, nome_cliente, email_cliente, telefone_cliente, parque_id, para_avaliar') // Adicionar 'para_avaliar'
            .eq('matricula', matricula)
            .eq('alocation', alocation)
            .order('data_reserva', {ascending: false})
            .limit(1)
            .single();
        
        if (error || !reserva) {
            novaReclamacaoStatusEl.textContent = "Reserva não encontrada. Preencha os dados do cliente manualmente.";
        } else {
            nomeClienteInputEl.value = reserva.nome_cliente || '';
            let contacto = (reserva.email_cliente || '') + (reserva.email_cliente && reserva.telefone_cliente ? ' / ' : '') + (reserva.telefone_cliente || '');
            contactoClienteInputEl.value = contacto;
            if(reserva.parque_id) parqueOcorrenciaEl.value = reserva.parque_id;
            // Guardar reserva_id para associar depois
            novoReclamacaoFormEl.dataset.reservaId = reserva.id; 
            novoReclamacaoFormEl.dataset.reservaParaAvaliar = reserva.para_avaliar;
            novaReclamacaoStatusEl.textContent = "Dados da reserva preenchidos (se encontrados).";
        }
    });
    
    [anexoPrincipalEl, ficheiroMovimentacoesEl].forEach(input => {
        if(input) input.addEventListener('change', (e) => {
            const nomeEl = document.getElementById(e.target.id + 'Nome');
            if(nomeEl) nomeEl.textContent = e.target.files[0] ? e.target.files[0].name : '';
        });
    });

    novoReclamacaoFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!currentUser) { alert("Sessão inválida."); return; }
        novaReclamacaoStatusEl.textContent = "A registar...";

        const reservaIdAssociada = novoReclamacaoFormEl.dataset.reservaId || null;
        const tinhaAvaliacaoObrigatoria = novoReclamacaoFormEl.dataset.reservaParaAvaliar === 'true';

        const dadosReclamacao = {
            reserva_id: reservaIdAssociada,
            matricula_veiculo: matriculaInputEl.value.trim(),
            alocation_veiculo: alocationInputEl.value.trim(),
            nome_cliente: nomeClienteInputEl.value.trim() || null,
            contacto_cliente: contactoClienteInputEl.value.trim() || null,
            data_reclamacao: new Date(dataReclamacaoEl.value).toISOString(),
            user_id_registo: currentUser.id,
            tipo_reclamacao: tipoReclamacaoFormEl.value,
            descricao_reclamacao: descricaoReclamacaoEl.value.trim(),
            origem_reclamacao: origemReclamacaoEl.value,
            parque_id_ocorrencia: parqueOcorrenciaEl.value || null,
            estado_reclamacao: 'Aberta',
            reserva_tinha_avaliacao_obrigatoria: tinhaAvaliacaoObrigatoria,
            // ocorrencias_associadas_ids: // TODO: Lógica para buscar e associar ocorrências
        };
        
        const { data: novaReclamacao, error: erroInsert } = await supabase.from('comentarios_reclamacoes').insert(dadosReclamacao).select().single();

        if (erroInsert) {
            novaReclamacaoStatusEl.textContent = `Erro: ${erroInsert.message}`;
            return;
        }
        
        // Upload de anexos
        const ficheiroPrincipal = anexoPrincipalEl.files[0];
        if (ficheiroPrincipal) {
            await uploadAnexoReclamacao(novaReclamacao.id, 'Email Cliente', ficheiroPrincipal); // Ajustar tipo
        }
        const ficheiroMov = ficheiroMovimentacoesEl.files[0];
        if (ficheiroMov) {
            await uploadAnexoReclamacao(novaReclamacao.id, 'Ficheiro Movimentacoes', ficheiroMov);
        }
        
        novaReclamacaoStatusEl.textContent = `Reclamação CR-${String(novaReclamacao.id).substring(0,8)} registada!`;
        novoReclamacaoFormEl.reset();
        anexoPrincipalNomeEl.textContent = '';
        ficheiroMovimentacoesNomeEl.textContent = '';
        delete novoReclamacaoFormEl.dataset.reservaId;
        delete novoReclamacaoFormEl.dataset.reservaParaAvaliar;
        dataReclamacaoEl.value = new Date().toISOString().slice(0,16);
        await carregarReclamacoes();
        mostrarTab('detalheReclamacaoContent', novaReclamacao.id);
    });

    async function uploadAnexoReclamacao(reclamacaoId, tipoAnexo, ficheiro) {
        if (!ficheiro) return;
        const nomeFicheiroStorage = `reclamacoes/${reclamacaoId}/${Date.now()}_${ficheiro.name.replace(/\s+/g, '_')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('documentos-casos-reclamacoes').upload(nomeFicheiroStorage, ficheiro); // NOVO BUCKET

        if (uploadError) {
            console.error(`Erro upload anexo (${tipoAnexo}):`, uploadError);
            // Adicionar feedback ao utilizador sobre falha no anexo específico
            return;
        }
        const { data: urlData } = supabase.storage.from('documentos-casos-reclamacoes').getPublicUrl(uploadData.path);
        await supabase.from('comentarios_reclamacoes_anexos').insert({
            reclamacao_id: reclamacaoId,
            tipo_anexo: tipoAnexo,
            nome_ficheiro_original: ficheiro.name,
            ficheiro_url: urlData.publicUrl,
            storage_bucket_path: uploadData.path,
            user_id_upload: currentUser.id
        });
    }

    // --- Aba Detalhes da Reclamação ---
    async function abrirDetalhesReclamacao(reclamacaoId) {
        mostrarTab('detalheReclamacaoContent'); // Mudar para a tab primeiro
        detalheReclamacaoIdAtualEl.value = reclamacaoId;
        detalheReclamacaoStatusEl.textContent = "A carregar dados...";
        
        const { data: caso, error } = await supabase.from('comentarios_reclamacoes')
            .select(`*, user_reg:profiles(full_name), parque:parques(nome)`)
            .eq('id', reclamacaoId).single();

        if (error || !caso) {
            detalheReclamacaoStatusEl.textContent = "Erro ao carregar detalhes da reclamação.";
            console.error("Erro:", error); return;
        }
        
        detalheReclamacaoIdExibicaoEl.textContent = String(caso.id).substring(0,8);
        detalheReclamacaoTitleEl.textContent = `Detalhes: Reclamação CR-${String(caso.id).substring(0,8)}`;
        detalheClienteNomeEl.textContent = caso.nome_cliente || 'N/A';
        detalheClienteContactoEl.textContent = caso.contacto_cliente || 'N/A';
        detalheMatriculaAlocEl.textContent = `${caso.matricula_veiculo} / ${caso.alocation_veiculo}`;
        detalheDataRegistoEl.textContent = formatarDataHora(caso.data_reclamacao);
        detalheTipoReclamacaoEl.textContent = caso.tipo_reclamacao;
        detalheDescricaoCompletaEl.textContent = caso.descricao_reclamacao;
        detalheEstadoAtualEl.className = `font-bold status-tag ${getEstadoReclamacaoClass(caso.estado_reclamacao)}`;
        detalheEstadoAtualEl.textContent = caso.estado_reclamacao;
        detalheAvaliacaoObrigatoriaEl.textContent = caso.reserva_tinha_avaliacao_obrigatoria === null ? 'N/A' : (caso.reserva_tinha_avaliacao_obrigatoria ? 'Sim' : 'Não');
        // TODO: Carregar ocorrências associadas
        detalheOcorrenciasAssociadasEl.textContent = 'A implementar...';

        notasAcompanhamentoEl.value = caso.notas_internas_acompanhamento || '';
        detalhesResolucaoFinalEl.value = caso.resolucao_final_aplicada || '';
        
        // Popular select de estado para resolução
        estadoResolucaoEl.innerHTML = '';
        ESTADOS_RECLAMACAO.forEach(est => {
            const opt = document.createElement('option');
            opt.value = est;
            opt.textContent = est;
            if (est === caso.estado_reclamacao) opt.selected = true;
            estadoResolucaoEl.appendChild(opt);
        });

        await carregarAnexosReclamacao(reclamacaoId);
        await carregarMovimentacoesVeiculo(caso.matricula_veiculo, caso.alocation_veiculo, caso.reserva_id);
        detalheReclamacaoStatusEl.textContent = "";
    }

    async function carregarAnexosReclamacao(reclamacaoId) { /* ... (similar a perdidos_achados) ... */ }
    async function carregarMovimentacoesVeiculo(matricula, alocation, reservaId) { /* ... (similar a perdidos_achados) ... */ }
    
    adicionarAnexoBtnEl.addEventListener('click', async () => { /* ... (similar a perdidos_achados) ... */ });
    
    guardarProgressoBtnEl.addEventListener('click', async () => {
        const casoId = detalheReclamacaoIdAtualEl.value;
        if (!casoId) return;
        detalheReclamacaoStatusEl.textContent = "A guardar...";
        const dadosUpdate = {
            notas_internas_acompanhamento: notasAcompanhamentoEl.value,
            estado_reclamacao: estadoResolucaoEl.value,
            resolucao_final_aplicada: detalhesResolucaoFinalEl.value,
            user_id_last_modified: currentUser.id, // Adicionar esta coluna à tabela
        };
        if (['Resolvida - Procedente', 'Resolvida - Improcedente', 'Fechada'].includes(estadoResolucaoEl.value) && ! (await supabase.from('comentarios_reclamacoes').select('data_resolucao').eq('id', casoId).single()).data.data_resolucao ) {
            dadosUpdate.data_resolucao = new Date().toISOString();
            dadosUpdate.user_id_resolucao = currentUser.id;
        }

        const { error } = await supabase.from('comentarios_reclamacoes').update(dadosUpdate).eq('id', casoId);
        if (error) {
            detalheReclamacaoStatusEl.textContent = `Erro: ${error.message}`;
        } else {
            detalheReclamacaoStatusEl.textContent = "Progresso/Resolução guardado!";
            await carregarReclamacoes(paginaAtual); // Atualizar lista principal
            // Atualizar estado no detalhe
            detalheEstadoAtualEl.textContent = estadoResolucaoEl.value;
            detalheEstadoAtualEl.className = `font-bold status-tag ${getEstadoReclamacaoClass(estadoResolucaoEl.value)}`;
        }
    });


    // --- Event Listeners Gerais ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (aplicarFiltrosListaBtnEl) aplicarFiltrosListaBtnEl.addEventListener('click', () => carregarReclamacoes(1));
    
    tableBodyEl.addEventListener('click', (e) => {
        const targetButton = e.target.closest('.cr-ver-detalhes-btn');
        if (targetButton) {
            abrirDetalhesReclamacao(targetButton.dataset.id);
        }
    });
    if(voltarParaListaBtnEl) voltarParaListaBtnEl.addEventListener('click', () => mostrarTab('listaReclamacoes'));


    // --- Inicialização da Página ---
    async function initComentariosReclamacoesPage() {
        if (!userProfile) { alert("Perfil não carregado."); return; }
        dataReclamacaoEl.value = new Date().toISOString().slice(0,16);
        await carregarParquesCR();
        await carregarReclamacoes();
        console.log("Subaplicação de Comentários e Reclamações inicializada.");
    }

    initComentariosReclamacoesPage();
});

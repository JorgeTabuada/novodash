// js/formacao_apoio.js - Lógica para a Subaplicação de Formação e Apoio

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Formação/Apoio.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile')); // Assume 'role'

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnFormApoio');
    const tabButtons = document.querySelectorAll('.tab-button-formacao');
    const tabContents = document.querySelectorAll('.tab-content-formacao');
    const tabGestaoConteudoEl = document.getElementById('tabGestaoConteudo');

    // Aba Consulta
    const formApoioSearchTermEl = document.getElementById('formApoioSearchTerm');
    const formApoioFiltroCategoriaEl = document.getElementById('formApoioFiltroCategoria');
    const formApoioAplicarPesquisaBtnEl = document.getElementById('formApoioAplicarPesquisaBtn');
    const loadingFormApoioSpinnerEl = document.getElementById('loadingFormApoioSpinner');
    const formApoioResultadosContainerEl = document.getElementById('formApoioResultadosContainer');
    const formApoioNenhumResultadoMsgEl = document.getElementById('formApoioNenhumResultadoMsg');

    // Aba Gestão
    const gestaoContentEl = document.getElementById('gestaoContent');
    const formApoioGestaoFormEl = document.getElementById('formApoioGestaoForm');
    const formApoioConteudoIdEl = document.getElementById('formApoioConteudoId');
    const gestaoTituloEl = document.getElementById('gestaoTitulo');
    const gestaoCategoriaEl = document.getElementById('gestaoCategoria');
    const gestaoTipoConteudoEl = document.getElementById('gestaoTipoConteudo');
    const gestaoDescricaoCurtaEl = document.getElementById('gestaoDescricaoCurta');
    const gestaoFaqFieldsEl = document.getElementById('gestaoFaqFields');
    const gestaoConteudoFaqEl = document.getElementById('gestaoConteudoFaq');
    const gestaoFicheiroFieldsEl = document.getElementById('gestaoFicheiroFields');
    const gestaoFicheiroUploadEl = document.getElementById('gestaoFicheiroUpload');
    const gestaoFicheiroAtualEl = document.getElementById('gestaoFicheiroAtual');
    const gestaoVideoLinkFieldsEl = document.getElementById('gestaoVideoLinkFields');
    const gestaoVideoLinkExternoEl = document.getElementById('gestaoVideoLinkExterno');
    const gestaoPalavrasChaveEl = document.getElementById('gestaoPalavrasChave');
    const formApoioLimparFormGestaoBtnEl = document.getElementById('formApoioLimparFormGestaoBtn');
    const formApoioGestaoStatusEl = document.getElementById('formApoioGestaoStatus');

    const formApoioCategoriaFormEl = document.getElementById('formApoioCategoriaForm');
    const formApoioCategoriaIdEl = document.getElementById('formApoioCategoriaId');
    const gestaoNomeCategoriaEl = document.getElementById('gestaoNomeCategoria');
    const gestaoDescricaoCategoriaEl = document.getElementById('gestaoDescricaoCategoria');
    const formApoioAddCategoriaBtnEl = document.getElementById('formApoioAddCategoriaBtn');
    const formApoioCategoriaStatusEl = document.getElementById('formApoioCategoriaStatus');
    const listaCategoriasGestaoEl = document.getElementById('listaCategoriasGestao');
    
    const loadingGestaoConteudosSpinnerEl = document.getElementById('loadingGestaoConteudosSpinner');
    const gestaoConteudosTableBodyEl = document.getElementById('gestaoConteudosTableBody');
    const gestaoNenhumConteudoMsgEl = document.getElementById('gestaoNenhumConteudoMsg');

    // --- Estado da Aplicação ---
    let todasCategoriasFormacao = [];
    let todosConteudosFormacao = []; // Para a área de gestão
    let currentEditConteudoData = null; // Para guardar URL de ficheiro ao editar

    // --- Funções Auxiliares ---
    function mostrarSpinner(id, show = true) { document.getElementById(id)?.classList.toggle('hidden', !show); }
    function formatarDataHora(dataISO) { /* ... (igual às outras subapps) ... */ return dataISO ? new Date(dataISO).toLocaleString('pt-PT', {dateStyle:'short', timeStyle:'short'}) : 'N/A'; }

    // --- Permissões ---
    function verificarPermissaoGestao() {
        const rolesPermitidas = ['super_admin', 'admin', 'supervisor']; // Ajustar roles
        if (userProfile && rolesPermitidas.includes(userProfile.role)) {
            tabGestaoConteudoEl.classList.remove('hidden');
            return true;
        } else {
            tabGestaoConteudoEl.classList.add('hidden');
            // Se o utilizador estiver na aba de gestão e não tiver permissão, redireciona para consulta
            if (gestaoContentEl.classList.contains('active')) {
                tabButtons[0].click(); // Clica na primeira aba (Consulta)
            }
            return false;
        }
    }

    // --- Navegação por Abas ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (button.dataset.tab === "gestao" && !verificarPermissaoGestao()) {
                alert("Não tem permissão para aceder a esta área.");
                return;
            }
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.tab + 'Content').classList.add('active');
            
            if (button.dataset.tab === "gestao") {
                carregarCategoriasParaGestao();
                carregarConteudosParaGestao();
            } else if (button.dataset.tab === "consulta") {
                carregarConteudoParaConsulta();
            }
        });
    });

    // --- Lógica da Aba de Consulta ---
    async function carregarCategoriasParaConsultaEfiltros() {
        const { data, error } = await supabase.from('formacao_categorias').select('*').order('ordem_exibicao').order('nome');
        if (error) {
            console.error("Erro ao carregar categorias para consulta:", error);
            return;
        }
        todasCategoriasFormacao = data || [];
        
        // Popular filtro de categoria
        formApoioFiltroCategoriaEl.innerHTML = '<option value="">Todas as Categorias</option>';
        todasCategoriasFormacao.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.nome;
            formApoioFiltroCategoriaEl.appendChild(opt);
        });
    }

    async function carregarConteudoParaConsulta() {
        mostrarSpinner('loadingFormApoioSpinner', true);
        formApoioResultadosContainerEl.innerHTML = '';
        formApoioNenhumResultadoMsgEl.classList.add('hidden');

        const searchTerm = formApoioSearchTermEl.value.toLowerCase();
        const categoriaFiltroId = formApoioFiltroCategoriaEl.value;

        let query = supabase.from('formacao_conteudos')
            .select(`
                *,
                categoria:formacao_categorias (nome)
            `)
            .eq('ativo', true)
            .order('created_at', { ascending: false });

        if (categoriaFiltroId) {
            query = query.eq('categoria_id', categoriaFiltroId);
        }
        if (searchTerm) {
            // Pesquisa em título, descrição, palavras-chave. Pode precisar de uma função tsvector no Supabase para pesquisa full-text.
            query = query.or(`titulo.ilike.%${searchTerm}%,descricao_curta.ilike.%${searchTerm}%,palavras_chave.cs.{${searchTerm}}`);
        }

        const { data: conteudos, error } = await query;
        mostrarSpinner('loadingFormApoioSpinner', false);

        if (error) {
            console.error("Erro ao carregar conteúdo de formação:", error);
            formApoioNenhumResultadoMsgEl.textContent = "Erro ao carregar materiais.";
            formApoioNenhumResultadoMsgEl.classList.remove('hidden');
            return;
        }

        if (!conteudos || conteudos.length === 0) {
            formApoioNenhumResultadoMsgEl.classList.remove('hidden');
            return;
        }
        
        // Agrupar por categoria para exibição
        const conteudosAgrupados = todasCategoriasFormacao.map(cat => ({
            ...cat,
            items: conteudos.filter(item => item.categoria_id === cat.id)
        })).filter(grupo => grupo.items.length > 0); // Só mostrar categorias com itens
        
        // Se não houver filtro de categoria, e houver itens sem categoria_id (formações gerais), mostrar primeiro
        const formacoesGerais = conteudos.filter(item => !item.categoria_id && item.tipo_conteudo === 'documento');
        if (!categoriaFiltroId && formacoesGerais.length > 0) {
            const geralContainer = document.createElement('div');
            geralContainer.className = 'categoria-container';
            geralContainer.innerHTML = `<h4 class="categoria-title">Formações Gerais</h4>`;
            formacoesGerais.forEach(item => geralContainer.appendChild(criarElementoConteudoConsulta(item)));
            formApoioResultadosContainerEl.appendChild(geralContainer);
        }


        conteudosAgrupados.forEach(grupo => {
            const categoriaContainer = document.createElement('div');
            categoriaContainer.className = 'categoria-container';
            categoriaContainer.innerHTML = `<h4 class="categoria-title">${grupo.nome}</h4>`;
            grupo.items.forEach(item => {
                categoriaContainer.appendChild(criarElementoConteudoConsulta(item));
            });
            formApoioResultadosContainerEl.appendChild(categoriaContainer);
        });
         if(formApoioResultadosContainerEl.children.length === 0) formApoioNenhumResultadoMsgEl.classList.remove('hidden');

    }

    function criarElementoConteudoConsulta(item) {
        const div = document.createElement('div');
        div.className = 'conteudo-item';
        
        let corpoHtml = '';
        if (item.tipo_conteudo === 'faq' && item.conteudo_faq) {
            corpoHtml = `<div class="prose prose-sm max-w-none">${item.conteudo_faq.replace(/\n/g, '<br>')}</div>`; // Usar classe 'prose' do Tailwind para estilizar HTML simples
        } else if (item.tipo_conteudo === 'documento' && item.ficheiro_url) {
            corpoHtml = `<div class="conteudo-actions">
                            <a href="${item.ficheiro_url}" target="_blank" class="action-button text-xs !p-1.5"><i class="fas fa-download mr-1"></i> Ver/Descarregar Documento</a>
                         </div>`;
        } else if (item.tipo_conteudo === 'video_link' && item.video_link_externo) {
            // Tentar criar embed para YouTube/Vimeo
            let videoEmbed = `<a href="${item.video_link_externo}" target="_blank">Ver Vídeo Externo</a>`;
            if (item.video_link_externo.includes("youtube.com/watch?v=")) {
                const videoId = item.video_link_externo.split('v=')[1].split('&')[0];
                videoEmbed = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            } else if (item.video_link_externo.includes("vimeo.com/")) {
                const videoId = item.video_link_externo.split('/').pop();
                videoEmbed = `<iframe src="https://player.vimeo.com/video/${videoId}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
            }
            corpoHtml = `<div class="video-container">${videoEmbed}</div>`;
        } else if (item.tipo_conteudo === 'video_upload' && item.ficheiro_url) {
             corpoHtml = `<div class="video-container">
                            <video controls width="100%"><source src="${item.ficheiro_url}" type="video/mp4">O seu navegador não suporta o elemento de vídeo.</video>
                          </div>
                          <div class="conteudo-actions mt-2">
                             <a href="${item.ficheiro_url}" target="_blank" class="action-button text-xs !p-1.5"><i class="fas fa-download mr-1"></i> Descarregar Vídeo</a>
                          </div>`;
        }

        div.innerHTML = `
            <div class="conteudo-header">
                <h5><i class="fas ${getIconePorTipo(item.tipo_conteudo)} mr-2 text-gray-500"></i>${item.titulo}</h5>
                <i class="fas fa-chevron-down text-gray-400"></i>
            </div>
            <div class="conteudo-body">
                ${item.descricao_curta ? `<p class="mb-2 text-sm italic text-gray-600">${item.descricao_curta}</p>` : ''}
                ${corpoHtml}
            </div>
        `;
        const header = div.querySelector('.conteudo-header');
        const body = div.querySelector('.conteudo-body');
        header.addEventListener('click', () => {
            body.style.display = body.style.display === 'none' || body.style.display === '' ? 'block' : 'none';
            header.querySelector('.fa-chevron-down, .fa-chevron-up').classList.toggle('fa-chevron-down');
            header.querySelector('.fa-chevron-down, .fa-chevron-up').classList.toggle('fa-chevron-up');
        });
        return div;
    }
    function getIconePorTipo(tipo){
        switch(tipo){
            case 'documento': return 'fa-file-alt'; // ou fa-file-pdf, fa-file-powerpoint
            case 'faq': return 'fa-question-circle';
            case 'video_link':
            case 'video_upload': return 'fa-video';
            default: return 'fa-info-circle';
        }
    }


    // --- Lógica da Aba de Gestão ---
    gestaoTipoConteudoEl.addEventListener('change', function() {
        gestaoFaqFieldsEl.classList.add('hidden');
        gestaoFicheiroFieldsEl.classList.add('hidden');
        gestaoVideoLinkFieldsEl.classList.add('hidden');

        if (this.value === 'faq') gestaoFaqFieldsEl.classList.remove('hidden');
        else if (this.value === 'documento' || this.value === 'video_upload') gestaoFicheiroFieldsEl.classList.remove('hidden');
        else if (this.value === 'video_link') gestaoVideoLinkFieldsEl.classList.remove('hidden');
    });

    async function carregarCategoriasParaGestao() {
        // Usa `todasCategoriasFormacao` já carregado ou recarrega
        if (todasCategoriasFormacao.length === 0) {
            const { data, error } = await supabase.from('formacao_categorias').select('*').order('nome');
            if (error) { console.error("Erro ao carregar categorias para gestão:", error); return; }
            todasCategoriasFormacao = data || [];
        }
        
        // Popular select de categoria no formulário de conteúdo
        gestaoCategoriaEl.innerHTML = '<option value="">Selecione uma Categoria</option>';
        todasCategoriasFormacao.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.nome;
            gestaoCategoriaEl.appendChild(opt);
        });

        // Listar categorias para gestão (adicionar/editar/apagar categoria)
        listaCategoriasGestaoEl.innerHTML = '';
        if (todasCategoriasFormacao.length === 0) {
            listaCategoriasGestaoEl.innerHTML = '<p class="text-gray-500">Nenhuma categoria criada.</p>';
            return;
        }
        todasCategoriasFormacao.forEach(cat => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center p-2 border-b';
            div.innerHTML = `
                <span>${cat.nome} ${cat.descricao ? `(${cat.descricao})` : ''}</span>
                <div>
                    <button class="action-button text-xs !p-1 secondary mr-1 formapoio-edit-cat-btn" data-id="${cat.id}" data-nome="${cat.nome}" data-desc="${cat.descricao || ''}">Editar</button>
                    <button class="action-button text-xs !p-1 danger formapoio-delete-cat-btn" data-id="${cat.id}">Apagar</button>
                </div>
            `;
            listaCategoriasGestaoEl.appendChild(div);
        });
    }
    
    formApoioCategoriaFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = formApoioCategoriaIdEl.value;
        const nome = gestaoNomeCategoriaEl.value.trim();
        const descricao = gestaoDescricaoCategoriaEl.value.trim();
        if (!nome) { alert("O nome da categoria é obrigatório."); return; }

        formApoioCategoriaStatusEl.textContent = 'A guardar categoria...';
        let query;
        const dadosCategoria = { nome, descricao: descricao || null };

        if (id) { // Edição
            query = supabase.from('formacao_categorias').update(dadosCategoria).eq('id', id);
        } else { // Criação
            query = supabase.from('formacao_categorias').insert(dadosCategoria);
        }
        const { error } = await query;
        if (error) {
            formApoioCategoriaStatusEl.textContent = `Erro: ${error.message}`;
            console.error("Erro ao guardar categoria:", error);
        } else {
            formApoioCategoriaStatusEl.textContent = `Categoria ${id ? 'atualizada' : 'criada'}!`;
            formApoioCategoriaFormEl.reset();
            formApoioCategoriaIdEl.value = '';
            await carregarCategoriasParaGestao(); // Recarrega lista de categorias
            await carregarCategoriasParaConsultaEfiltros(); // Recarrega dropdowns de consulta
        }
    });

    listaCategoriasGestaoEl.addEventListener('click', async (e) => {
        if (e.target.classList.contains('formapoio-edit-cat-btn')) {
            formApoioCategoriaIdEl.value = e.target.dataset.id;
            gestaoNomeCategoriaEl.value = e.target.dataset.nome;
            gestaoDescricaoCategoriaEl.value = e.target.dataset.desc;
            gestaoNomeCategoriaEl.focus();
        } else if (e.target.classList.contains('formapoio-delete-cat-btn')) {
            const catId = e.target.dataset.id;
            if (!confirm("Tem a certeza que deseja apagar esta categoria? Todo o conteúdo associado também será afetado (ou precisará ser re-categorizado).")) return;
            // TODO: Verificar se há conteúdos associados e alertar/impedir ou oferecer re-categorização.
            // Por agora, apaga diretamente.
            const { error } = await supabase.from('formacao_categorias').delete().eq('id', catId);
            if (error) alert(`Erro ao apagar categoria: ${error.message}`);
            else {
                alert("Categoria apagada.");
                await carregarCategoriasParaGestao();
                await carregarCategoriasParaConsultaEfiltros();
            }
        }
    });


    formApoioGestaoFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const conteudoId = formApoioConteudoIdEl.value;
        formApoioGestaoStatusEl.textContent = 'A guardar conteúdo...';

        let ficheiroUrlFinal = currentEditConteudoData?.ficheiro_url || null;
        let bucketPathFinal = currentEditConteudoData?.storage_bucket_path || null;
        const ficheiroParaUpload = gestaoFicheiroUploadEl.files[0];

        if (ficheiroParaUpload && (gestaoTipoConteudoEl.value === 'documento' || gestaoTipoConteudoEl.value === 'video_upload')) {
            // Se houver ficheiro antigo ao editar, apaga-o primeiro
            if (conteudoId && currentEditConteudoData?.storage_bucket_path) {
                await supabase.storage.from('formacao-materiais').remove([currentEditConteudoData.storage_bucket_path]);
            }
            const nomeFicheiroStorage = `materiais/${currentUser.id}/${Date.now()}_${ficheiroParaUpload.name.replace(/\s+/g, '_')}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('formacao-materiais') // Nome do Bucket
                .upload(nomeFicheiroStorage, ficheiroParaUpload, { upsert: false });
            
            if (uploadError) { formApoioGestaoStatusEl.textContent = `Erro upload: ${uploadError.message}`; return; }
            const { data: urlData } = supabase.storage.from('formacao-materiais').getPublicUrl(uploadData.path);
            ficheiroUrlFinal = urlData.publicUrl;
            bucketPathFinal = uploadData.path;
        }

        const dadosConteudo = {
            titulo: gestaoTituloEl.value,
            categoria_id: gestaoCategoriaEl.value,
            tipo_conteudo: gestaoTipoConteudoEl.value,
            descricao_curta: gestaoDescricaoCurtaEl.value || null,
            conteudo_faq: gestaoTipoConteudoEl.value === 'faq' ? gestaoConteudoFaqEl.value : null,
            ficheiro_url: (gestaoTipoConteudoEl.value === 'documento' || gestaoTipoConteudoEl.value === 'video_upload') ? ficheiroUrlFinal : null,
            storage_bucket_path: (gestaoTipoConteudoEl.value === 'documento' || gestaoTipoConteudoEl.value === 'video_upload') ? bucketPathFinal : null,
            video_link_externo: gestaoTipoConteudoEl.value === 'video_link' ? gestaoVideoLinkExternoEl.value : null,
            palavras_chave: gestaoPalavrasChaveEl.value ? gestaoPalavrasChaveEl.value.split(',').map(s => s.trim()).filter(Boolean) : null,
        };

        let resultado, erroSupabase;
        if (conteudoId) { // Edição
            dadosConteudo.updated_at = new Date().toISOString();
            const { data, error } = await supabase.from('formacao_conteudos').update(dadosConteudo).eq('id', conteudoId).select().single();
            resultado = data; erroSupabase = error;
        } else { // Criação
            dadosConteudo.user_id_criador = currentUser.id;
            const { data, error } = await supabase.from('formacao_conteudos').insert(dadosConteudo).select().single();
            resultado = data; erroSupabase = error;
        }

        if (erroSupabase) {
            formApoioGestaoStatusEl.textContent = `Erro: ${erroSupabase.message}`;
        } else {
            formApoioGestaoStatusEl.textContent = `Conteúdo ${conteudoId ? 'atualizado' : 'guardado'}!`;
            formApoioGestaoFormEl.reset();
            formApoioConteudoIdEl.value = '';
            gestaoFicheiroAtualEl.textContent = '';
            currentEditConteudoData = null;
            gestaoTipoConteudoEl.dispatchEvent(new Event('change')); // Resetar visibilidade dos campos
            await carregarConteudosParaGestao();
        }
    });
    
    formApoioLimparFormGestaoBtnEl.addEventListener('click', () => {
        formApoioGestaoFormEl.reset();
        formApoioConteudoIdEl.value = '';
        gestaoFicheiroAtualEl.textContent = '';
        currentEditConteudoData = null;
        gestaoTipoConteudoEl.dispatchEvent(new Event('change'));
        formApoioGestaoStatusEl.textContent = '';
    });

    async function carregarConteudosParaGestao() {
        mostrarSpinner('loadingGestaoConteudosSpinner', true);
        gestaoConteudosTableBodyEl.innerHTML = '';
        gestaoNenhumConteudoMsgEl.classList.add('hidden');

        const { data, error } = await supabase.from('formacao_conteudos')
            .select(`*, categoria:formacao_categorias(nome)`)
            .order('created_at', { ascending: false });
        
        mostrarSpinner('loadingGestaoConteudosSpinner', false);
        if (error) { console.error("Erro ao carregar conteúdos para gestão:", error); gestaoNenhumConteudoMsgEl.classList.remove('hidden'); return; }

        todosConteudosFormacao = data || [];
        if (todosConteudosFormacao.length === 0) { gestaoNenhumConteudoMsgEl.classList.remove('hidden'); return; }

        todosConteudosFormacao.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.titulo}</td>
                <td>${item.categoria?.nome || 'N/A'}</td>
                <td>${item.tipo_conteudo}</td>
                <td>${formatarDataHora(item.created_at)}</td>
                <td class="actions-cell">
                    <button class="action-button text-xs !p-1 secondary formapoio-edit-conteudo-btn" data-id="${item.id}">Editar</button>
                    <button class="action-button text-xs !p-1 danger formapoio-delete-conteudo-btn" data-id="${item.id}">Apagar</button>
                </td>
            `;
            gestaoConteudosTableBodyEl.appendChild(tr);
        });
    }

    gestaoConteudosTableBodyEl.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('formapoio-edit-conteudo-btn')) {
            const id = target.dataset.id;
            const conteudo = todosConteudosFormacao.find(c => c.id === id);
            if (!conteudo) return;
            
            currentEditConteudoData = conteudo; // Guardar dados atuais, incluindo URL do ficheiro
            formApoioConteudoIdEl.value = conteudo.id;
            gestaoTituloEl.value = conteudo.titulo;
            gestaoCategoriaEl.value = conteudo.categoria_id;
            gestaoTipoConteudoEl.value = conteudo.tipo_conteudo;
            gestaoTipoConteudoEl.dispatchEvent(new Event('change')); // Mostrar campos corretos

            gestaoDescricaoCurtaEl.value = conteudo.descricao_curta || '';
            if (conteudo.tipo_conteudo === 'faq') gestaoConteudoFaqEl.value = conteudo.conteudo_faq || '';
            if (conteudo.tipo_conteudo === 'documento' || conteudo.tipo_conteudo === 'video_upload') {
                gestaoFicheiroAtualEl.textContent = conteudo.ficheiro_url ? `Ficheiro atual: ${conteudo.ficheiro_url.split('/').pop()}` : 'Nenhum ficheiro atual.';
            }
            if (conteudo.tipo_conteudo === 'video_link') gestaoVideoLinkExternoEl.value = conteudo.video_link_externo || '';
            gestaoPalavrasChaveEl.value = (conteudo.palavras_chave || []).join(', ');
            
            formApoioGestaoFormEl.scrollIntoView({ behavior: 'smooth' });

        } else if (target.classList.contains('formapoio-delete-conteudo-btn')) {
            const id = target.dataset.id;
            const conteudo = todosConteudosFormacao.find(c => c.id === id);
            if (!conteudo || !confirm(`Tem a certeza que deseja apagar o conteúdo "${conteudo.titulo}"?`)) return;

            // Se houver ficheiro no storage, apagar primeiro
            if (conteudo.storage_bucket_path) {
                const { error: storageError } = await supabase.storage.from('formacao-materiais').remove([conteudo.storage_bucket_path]);
                if (storageError) console.warn("Erro ao apagar ficheiro do storage:", storageError.message);
            }
            const { error } = await supabase.from('formacao_conteudos').delete().eq('id', id);
            if (error) alert(`Erro ao apagar: ${error.message}`);
            else {
                alert("Conteúdo apagado.");
                await carregarConteudosParaGestao();
            }
        }
    });


    // --- Event Listeners Gerais ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (formApoioAplicarPesquisaBtnEl) formApoioAplicarPesquisaBtnEl.addEventListener('click', carregarConteudoParaConsulta);
    if (formApoioSearchTermEl) formApoioSearchTermEl.addEventListener('keypress', (e) => { if(e.key === 'Enter') carregarConteudoParaConsulta(); });
    if (formApoioFiltroCategoriaEl) formApoioFiltroCategoriaEl.addEventListener('change', carregarConteudoParaConsulta);


    // --- Inicialização ---
    async function initFormApoioPage() {
        if (!userProfile) { alert("Perfil não carregado."); return; }
        verificarPermissaoGestao();
        await carregarCategoriasParaConsultaEfiltros(); // Carrega para consulta e para selects de gestão
        await carregarConteudoParaConsulta(); // Carrega conteúdo inicial da aba de consulta
        console.log("Subaplicação Formação e Apoio inicializada.");
    }

    initFormApoioPage();
});

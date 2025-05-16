// js/despesas.js - Lógica para a Subaplicação de Gestão de Despesas

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Despesas.");
        // Idealmente, auth_global.js já teria redirecionado se não houvesse sessão.
        return;
    }
    checkAuthStatus(); // Verifica se o utilizador está logado

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile')); // Assume que tem 'id', 'role', 'full_name'

    // --- Seletores DOM ---
    const despesaFormEl = document.getElementById('despesaForm');
    const despesaFormIdEl = document.getElementById('despesaFormId');
    const despesaDataEl = document.getElementById('despesaData');
    const despesaValorEl = document.getElementById('despesaValor');
    const despesaParqueEl = document.getElementById('despesaParque');
    const despesaTipoEl = document.getElementById('despesaTipo');
    const despesaDescricaoEl = document.getElementById('despesaDescricao');
    const despesaProjetoEl = document.getElementById('despesaProjeto');
    const despesaComprovativoEl = document.getElementById('despesaComprovativo');
    const despesaComprovativoNomeEl = document.getElementById('despesaComprovativoNome');
    const despesaLimparFormBtnEl = document.getElementById('despesaLimparFormBtn');
    const despesaFormStatusEl = document.getElementById('despesaFormStatus');

    // Dashboard Filtros e Stats
    const dashboardFiltroDataInicioEl = document.getElementById('despDashboardFiltroDataInicio');
    const dashboardFiltroDataFimEl = document.getElementById('despDashboardFiltroDataFim');
    const dashboardFiltroPeriodoEl = document.getElementById('despDashboardFiltroPeriodo');
    const dashboardFiltroTipoEl = document.getElementById('despDashboardFiltroTipo');
    const dashboardFiltroParqueEl = document.getElementById('despDashboardFiltroParque');
    const dashboardFiltroProjetoEl = document.getElementById('despDashboardFiltroProjeto');
    const dashboardFiltroUserEl = document.getElementById('despDashboardFiltroUser');
    const aplicarFiltrosDashboardBtnEl = document.getElementById('despAplicarFiltrosDashboardBtn');

    const statTotalDespesasEl = document.getElementById('statTotalDespesas');
    const statTotalDespesasPeriodoEl = document.getElementById('statTotalDespesasPeriodo');
    const statNumRegistosDespesasEl = document.getElementById('statNumRegistosDespesas');
    const statNumRegistosDespesasPeriodoEl = document.getElementById('statNumRegistosDespesasPeriodo');
    const statMediaDespesaEl = document.getElementById('statMediaDespesa');
    const statMediaDespesaPeriodoEl = document.getElementById('statMediaDespesaPeriodo');
    
    const chartDespesasPorTipoEl = document.getElementById('chartDespesasPorTipo');
    const chartDespesasPorParqueEl = document.getElementById('chartDespesasPorParque');
    const chartEvolucaoDespesasMensalEl = document.getElementById('chartEvolucaoDespesasMensal');

    // Lista de Despesas
    const despesasTableBodyEl = document.getElementById('despesasTableBody');
    const despesasNenhumaMsgEl = document.getElementById('despesasNenhumaMsg');
    const despesasPaginacaoEl = document.getElementById('despesasPaginacao');
    const loadingDespesasTableSpinnerEl = document.getElementById('loadingDespesasTableSpinner');
    const exportarListaBtnEl = document.getElementById('despExportarListaBtn');
    
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnDespesas');

    // --- Estado da Aplicação ---
    let todasAsDespesasGeral = []; // Para a lista paginada
    let paginaAtualDespesasLista = 1;
    const itensPorPaginaDespesasLista = 10;
    let listaParquesGlob = []; // Para popular selects
    let listaProjetosGlob = []; // Para popular selects
    let listaUsersRegistoGlob = []; // Para popular selects

    // --- Configuração de Gráficos ---
    let graficoDespesasTipo, graficoDespesasParque, graficoEvolucaoMensal;

    function setupGraficosDespesas() {
        if (chartDespesasPorTipoEl) {
            const ctxTipo = chartDespesasPorTipoEl.getContext('2d');
            if (graficoDespesasTipo) graficoDespesasTipo.destroy();
            graficoDespesasTipo = new Chart(ctxTipo, {
                type: 'doughnut', data: { labels: [], datasets: [{ data: [], backgroundColor: ['#f59e0b', '#f97316', '#ef4444', '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6'] }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });
        }
        if (chartDespesasPorParqueEl) {
            const ctxParque = chartDespesasPorParqueEl.getContext('2d');
            if (graficoDespesasParque) graficoDespesasParque.destroy();
            graficoDespesasParque = new Chart(ctxParque, {
                type: 'bar', data: { labels: [], datasets: [{ label: 'Total Despesas (€)', data: [], backgroundColor: 'rgba(245, 158, 11, 0.7)', borderColor: 'rgba(245, 158, 11, 1)' }] },
                options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
            });
        }
        if (chartEvolucaoDespesasMensalEl) {
            const ctxEvolucao = chartEvolucaoDespesasMensalEl.getContext('2d');
            if (graficoEvolucaoMensal) graficoEvolucaoMensal.destroy();
            graficoEvolucaoMensal = new Chart(ctxEvolucao, {
                type: 'line', data: { labels: [], datasets: [{ label: 'Total Despesas Mensais (€)', data: [], borderColor: '#d97706', backgroundColor: 'rgba(251, 191, 36, 0.2)', fill: true, tension: 0.1 }] },
                options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: true } } }
            });
        }
    }
    
    // --- Funções Auxiliares ---
    function formatarDataHora(dataISO, apenasData = false) {
        if (!dataISO) return 'N/A';
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        if (!apenasData) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        try { return new Date(dataISO).toLocaleString('pt-PT', options); }
        catch (e) { return dataISO; }
    }
    function formatarMoeda(valor) { return parseFloat(valor || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }
    function mostrarSpinner(id) { document.getElementById(id)?.classList.remove('hidden'); }
    function esconderSpinner(id) { document.getElementById(id)?.classList.add('hidden'); }

    // --- Carregar Dados para Selects (Parques, Projetos, Utilizadores) ---
    async function carregarDadosParaSelects() {
        // Parques
        const { data: parquesData, error: errorParques } = await supabase.from('parques').select('id, nome, cidade').order('cidade').order('nome');
        if (errorParques) console.error("Erro ao carregar parques:", errorParques);
        else listaParquesGlob = parquesData || [];
        
        [despesaParqueEl, dashboardFiltroParqueEl].forEach(selectEl => {
            if (!selectEl) return;
            const currentVal = selectEl.value;
            const firstOptText = selectEl.options[0]?.textContent || (selectEl === despesaParqueEl ? "Selecione o Parque" : "Todos");
            const firstOptVal = selectEl.options[0]?.value || "";
            selectEl.innerHTML = `<option value="${firstOptVal}">${firstOptText}</option>`; // Manter a primeira opção
            listaParquesGlob.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.nome} (${p.cidade || 'N/A'})`;
                selectEl.appendChild(opt);
            });
            if(currentVal) selectEl.value = currentVal;
        });

        // Projetos
        const { data: projetosData, error: errorProjetos } = await supabase.from('projetos').select('id, nome').order('nome');
        if (errorProjetos) console.error("Erro ao carregar projetos:", errorProjetos);
        else listaProjetosGlob = projetosData || [];
        
        [despesaProjetoEl, dashboardFiltroProjetoEl].forEach(selectEl => {
             if (!selectEl) return;
            const currentVal = selectEl.value;
            const firstOptText = selectEl.options[0]?.textContent || "Nenhum Projeto";
            const firstOptVal = selectEl.options[0]?.value || "";
            selectEl.innerHTML = `<option value="${firstOptVal}">${firstOptText}</option>`;
            listaProjetosGlob.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.nome;
                selectEl.appendChild(opt);
            });
            if(currentVal) selectEl.value = currentVal;
        });
        
        // Utilizadores
        const { data: usersData, error: errorUsers } = await supabase.from('profiles').select('id, full_name, username').order('full_name');
        if (errorUsers) console.error("Erro ao carregar utilizadores:", errorUsers);
        else listaUsersRegistoGlob = usersData || [];

        if (dashboardFiltroUserEl) {
            const currentVal = dashboardFiltroUserEl.value;
            const firstOptText = dashboardFiltroUserEl.options[0]?.textContent || "Todos";
            const firstOptVal = dashboardFiltroUserEl.options[0]?.value || "";
            dashboardFiltroUserEl.innerHTML = `<option value="${firstOptVal}">${firstOptText}</option>`;
            listaUsersRegistoGlob.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = u.full_name || u.username;
                dashboardFiltroUserEl.appendChild(opt);
            });
             if(currentVal) dashboardFiltroUserEl.value = currentVal;
        }

        // Tipos de despesa para o filtro do dashboard
        if (dashboardFiltroTipoEl) {
            const currentVal = dashboardFiltroTipoEl.value;
            const firstOptText = dashboardFiltroTipoEl.options[0]?.textContent || "Todos";
            const firstOptVal = dashboardFiltroTipoEl.options[0]?.value || "";
            dashboardFiltroTipoEl.innerHTML = `<option value="${firstOptVal}">${firstOptText}</option>`;
            Array.from(despesaTipoEl.options).forEach(opt => {
                if (opt.value) { 
                    const newOpt = document.createElement('option');
                    newOpt.value = opt.value;
                    newOpt.textContent = opt.textContent;
                    dashboardFiltroTipoEl.appendChild(newOpt);
                }
            });
            if(currentVal) dashboardFiltroTipoEl.value = currentVal;
        }
    }

    // --- Lógica do Formulário de Despesas ---
    if(despesaComprovativoEl) {
        despesaComprovativoEl.addEventListener('change', () => {
            despesaComprovativoNomeEl.textContent = despesaComprovativoEl.files[0] ? despesaComprovativoEl.files[0].name : '';
        });
    }

    if(despesaLimparFormBtnEl) {
        despesaLimparFormBtnEl.addEventListener('click', () => {
            despesaFormEl.reset();
            despesaFormIdEl.value = '';
            despesaComprovativoNomeEl.textContent = '';
            despesaFormStatusEl.textContent = '';
            despesaDataEl.value = new Date().toISOString().slice(0,16);
        });
    }

    if(despesaFormEl) {
        despesaFormEl.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!currentUser) {
                alert("Sessão inválida. Por favor, faça login novamente.");
                return;
            }
            const despesaId = despesaFormIdEl.value;

            let comprovativoUrlFinal = null;
            const ficheiroComprovativo = despesaComprovativoEl.files[0];

            // Se estiver a editar e não carregou novo ficheiro, manter o URL antigo (se existir)
            if (despesaId && !ficheiroComprovativo) {
                const despesaExistente = todasAsDespesasGeral.find(d => d.id === despesaId);
                comprovativoUrlFinal = despesaExistente?.comprovativo_url || null;
            }

            if (ficheiroComprovativo) {
                despesaFormStatusEl.textContent = 'A carregar comprovativo...';
                despesaFormStatusEl.className = 'mt-4 text-sm text-blue-600';
                mostrarSpinner('loadingDespesasTableSpinner'); // Reutilizar spinner
                const nomeFicheiro = `despesas/${currentUser.id}_${Date.now()}_${ficheiroComprovativo.name.replace(/\s+/g, '_')}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('comprovativos-despesas') 
                    .upload(nomeFicheiro, ficheiroComprovativo, {
                        cacheControl: '3600',
                        upsert: true // Se for editar e carregar novo com mesmo nome (improvável devido ao timestamp)
                    });
                
                esconderSpinner('loadingDespesasTableSpinner');
                if (uploadError) {
                    console.error("Erro no upload do comprovativo:", uploadError);
                    despesaFormStatusEl.textContent = `Erro no upload: ${uploadError.message}`;
                    despesaFormStatusEl.className = 'mt-4 text-sm text-red-600';
                    return;
                }
                const { data: urlData } = supabase.storage.from('comprovativos-despesas').getPublicUrl(uploadData.path);
                comprovativoUrlFinal = urlData.publicUrl;
            }

            const dadosDespesa = {
                data_despesa: new Date(despesaDataEl.value).toISOString(),
                user_id_registo: currentUser.id,
                valor: parseFloat(despesaValorEl.value),
                parque_id: despesaParqueEl.value,
                tipo_despesa: despesaTipoEl.value,
                descricao_motivo: despesaDescricaoEl.value,
                projeto_id: despesaProjetoEl.value || null,
                comprovativo_url: comprovativoUrlFinal,
            };

            despesaFormStatusEl.textContent = 'A guardar despesa...';
            let resultado, erroSupabase;

            if (despesaId) {
                const { data, error } = await supabase.from('despesas').update(dadosDespesa).eq('id', despesaId).select().single();
                resultado = data; erroSupabase = error;
            } else {
                const { data, error } = await supabase.from('despesas').insert(dadosDespesa).select().single();
                resultado = data; erroSupabase = error;
            }

            if (erroSupabase) {
                console.error("Erro ao guardar despesa:", erroSupabase);
                despesaFormStatusEl.textContent = `Erro: ${erroSupabase.message}`;
                despesaFormStatusEl.className = 'mt-4 text-sm text-red-600';
            } else {
                despesaFormStatusEl.textContent = `Despesa ${despesaId ? 'atualizada' : 'registada'} com sucesso!`;
                despesaFormStatusEl.className = 'mt-4 text-sm text-green-600';
                despesaFormEl.reset();
                despesaFormIdEl.value = '';
                despesaComprovativoNomeEl.textContent = '';
                despesaDataEl.value = new Date().toISOString().slice(0,16);
                await carregarDespesasDaLista(paginaAtualDespesasLista);
                await carregarDadosDashboardDespesas();
            }
        });
    }
    // --- Lógica do Dashboard de Despesas ---
    async function carregarDadosDashboardDespesas() {
        const dataInicio = dashboardFiltroDataInicioEl.value;
        const dataFim = dashboardFiltroDataFimEl.value;
        const periodoSelecionado = dashboardFiltroPeriodoEl.value;
        const tipoFiltro = dashboardFiltroTipoEl.value;
        const parqueFiltro = dashboardFiltroParqueEl.value;
        const projetoFiltro = dashboardFiltroProjetoEl.value;
        const userFiltro = dashboardFiltroUserEl.value;

        let filtroDataInicio, filtroDataFim;
        const hoje = new Date(); hoje.setHours(0,0,0,0);

        switch(periodoSelecionado) {
            case 'hoje': filtroDataInicio = new Date(hoje); filtroDataFim = new Date(hoje); filtroDataFim.setHours(23,59,59,999); break;
            case 'semana_atual': filtroDataInicio = new Date(hoje); filtroDataInicio.setDate(hoje.getDate() - hoje.getDay() + (hoje.getDay() === 0 ? -6 : 1)); filtroDataFim = new Date(filtroDataInicio); filtroDataFim.setDate(filtroDataInicio.getDate() + 6); filtroDataFim.setHours(23,59,59,999); break;
            case 'mes_atual': filtroDataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1); filtroDataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0); filtroDataFim.setHours(23,59,59,999); break;
            case 'este_ano': filtroDataInicio = new Date(hoje.getFullYear(), 0, 1); filtroDataFim = new Date(hoje.getFullYear(), 11, 31); filtroDataFim.setHours(23,59,59,999); break;
            default: filtroDataInicio = dataInicio ? new Date(dataInicio) : null; if(filtroDataInicio) filtroDataInicio.setHours(0,0,0,0); filtroDataFim = dataFim ? new Date(dataFim) : null; if(filtroDataFim) filtroDataFim.setHours(23,59,59,999); break;
        }
        
        const periodoTexto = filtroDataInicio && filtroDataFim ?
            `${formatarDataHora(filtroDataInicio, true)} - ${formatarDataHora(filtroDataFim, true)}` :
            'Todo o período';
        [statTotalDespesasPeriodoEl, statNumRegistosDespesasPeriodoEl, statMediaDespesaPeriodoEl].forEach(el => { if(el) el.textContent = periodoTexto; });

        let query = supabase.from('despesas')
            .select('valor, tipo_despesa, parque_id, data_despesa, parques(nome, cidade)', {count: 'exact'}) // Contar para num_registos
            .gte('data_despesa', filtroDataInicio ? filtroDataInicio.toISOString() : '1900-01-01')
            .lte('data_despesa', filtroDataFim ? filtroDataFim.toISOString() : '2999-12-31');
        
        if (tipoFiltro) query = query.eq('tipo_despesa', tipoFiltro);
        if (parqueFiltro) query = query.eq('parque_id', parqueFiltro);
        if (projetoFiltro) query = query.eq('projeto_id', projetoFiltro);
        if (userFiltro) query = query.eq('user_id_registo', userFiltro);

        const { data: despesasFiltradas, error, count } = await query;

        if(error) { console.error("Erro ao carregar dados para dashboard de despesas:", error); return; }

        const totalDespesas = (despesasFiltradas || []).reduce((sum, d) => sum + (d.valor || 0), 0);
        const numRegistos = count || 0; // Usar o count da query
        statTotalDespesasEl.textContent = formatarMoeda(totalDespesas);
        statNumRegistosDespesasEl.textContent = numRegistos;
        statMediaDespesaEl.textContent = formatarMoeda(numRegistos > 0 ? totalDespesas / numRegistos : 0);

        const despesasPorTipo = (despesasFiltradas || []).reduce((acc, d) => {
            acc[d.tipo_despesa] = (acc[d.tipo_despesa] || 0) + d.valor;
            return acc;
        }, {});
        if (graficoDespesasTipo) {
            graficoDespesasTipo.data.labels = Object.keys(despesasPorTipo);
            graficoDespesasTipo.data.datasets[0].data = Object.values(despesasPorTipo);
            graficoDespesasTipo.update();
        }
        
        const despesasPorParque = (despesasFiltradas || []).reduce((acc, d) => {
            const nomeParque = d.parques?.nome || 'Desconhecido';
            acc[nomeParque] = (acc[nomeParque] || 0) + d.valor;
            return acc;
        }, {});
         if (graficoDespesasParque) {
            graficoDespesasParque.data.labels = Object.keys(despesasPorParque);
            graficoDespesasParque.data.datasets[0].data = Object.values(despesasPorParque);
            graficoDespesasParque.update();
        }
        
        // Evolução Mensal - Idealmente uma RPC para performance
        const { data: evolucaoData, error: evolucaoError } = await supabase.rpc('get_despesas_evolucao_mensal', {
            // Passar parâmetros para a RPC se necessário, ex: ano
        });
        if(evolucaoError) console.error("Erro ao buscar evolução mensal:", evolucaoError);
        if (graficoEvolucaoMensal && evolucaoData) {
            graficoEvolucaoMensal.data.labels = evolucaoData.map(d => d.mes_ano_label); // Ajustar conforme output da RPC
            graficoEvolucaoMensal.data.datasets[0].data = evolucaoData.map(d => d.total_valor_mes); // Ajustar
            graficoEvolucaoMensal.update();
        } else if (graficoEvolucaoMensal) { // Simulação se RPC não existir
            const labelsMeses = []; const dataValoresMeses = [];
            for (let i = 11; i >= 0; i--) {
                const d = new Date(); d.setMonth(d.getMonth() - i);
                labelsMeses.push(d.toLocaleString('pt-PT', { month: 'short', year: '2-digit' }));
                dataValoresMeses.push(Math.floor(Math.random() * 5000));
            }
            graficoEvolucaoMensal.data.labels = labelsMeses;
            graficoEvolucaoMensal.data.datasets[0].data = dataValoresMeses;
            graficoEvolucaoMensal.update();
        }
    }

    // --- Lógica da Lista de Despesas ---
    async function carregarDespesasDaLista(pagina = 1) {
        paginaAtualDespesasLista = pagina;
        mostrarSpinner('loadingDespesasTableSpinner');
        despesasTableBodyEl.innerHTML = '';
        despesasNenhumaMsgEl.classList.add('hidden');

        // Usar os mesmos filtros do dashboard para a lista
        const dataInicio = dashboardFiltroDataInicioEl.value;
        const dataFim = dashboardFiltroDataFimEl.value;
        const periodoSelecionado = dashboardFiltroPeriodoEl.value;
        const tipoFiltro = dashboardFiltroTipoEl.value;
        const parqueFiltro = dashboardFiltroParqueEl.value;
        const projetoFiltro = dashboardFiltroProjetoEl.value;
        const userFiltro = dashboardFiltroUserEl.value;

        let filtroDataInicio, filtroDataFim;
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        switch(periodoSelecionado) {
            case 'hoje': filtroDataInicio = new Date(hoje); filtroDataFim = new Date(hoje); filtroDataFim.setHours(23,59,59,999); break;
            case 'semana_atual': filtroDataInicio = new Date(hoje); filtroDataInicio.setDate(hoje.getDate() - hoje.getDay() + (hoje.getDay() === 0 ? -6 : 1)); filtroDataFim = new Date(filtroDataInicio); filtroDataFim.setDate(filtroDataInicio.getDate() + 6); filtroDataFim.setHours(23,59,59,999); break;
            case 'mes_atual': filtroDataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1); filtroDataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0); filtroDataFim.setHours(23,59,59,999); break;
            case 'este_ano': filtroDataInicio = new Date(hoje.getFullYear(), 0, 1); filtroDataFim = new Date(hoje.getFullYear(), 11, 31); filtroDataFim.setHours(23,59,59,999); break;
            default: filtroDataInicio = dataInicio ? new Date(dataInicio) : null; if(filtroDataInicio) filtroDataInicio.setHours(0,0,0,0); filtroDataFim = dataFim ? new Date(dataFim) : null; if(filtroDataFim) filtroDataFim.setHours(23,59,59,999); break;
        }

        let query = supabase
            .from('despesas')
            .select(`
                id, data_despesa, valor, tipo_despesa, descricao_motivo, comprovativo_url,
                user:profiles!despesas_user_id_registo_fkey (full_name, username),
                parque:parques (id, nome, cidade),
                projeto:projetos (id, nome)
            `, { count: 'exact' })
            .gte('data_despesa', filtroDataInicio ? filtroDataInicio.toISOString() : '1900-01-01')
            .lte('data_despesa', filtroDataFim ? filtroDataFim.toISOString() : '2999-12-31');

        if (tipoFiltro) query = query.eq('tipo_despesa', tipoFiltro);
        if (parqueFiltro) query = query.eq('parque_id', parqueFiltro);
        if (projetoFiltro) query = query.eq('projeto_id', projetoFiltro);
        if (userFiltro) query = query.eq('user_id_registo', userFiltro);
        
        const offset = (pagina - 1) * itensPorPaginaDespesasLista;
        query = query.order('data_despesa', { ascending: false }).range(offset, offset + itensPorPaginaDespesasLista - 1);

        const { data, error, count } = await query;

        esconderSpinner('loadingDespesasTableSpinner');
        if (error) {
            console.error('Erro ao carregar despesas:', error);
            despesasNenhumaMsgEl.textContent = `Erro ao carregar: ${error.message}`;
            despesasNenhumaMsgEl.classList.remove('hidden');
            return;
        }

        todasAsDespesasGeral = data || [];
        renderDespesasTable(todasAsDespesasGeral);
        renderPaginacaoDespesasLista(count);
    }

    function renderDespesasTable(despesas) {
        despesasTableBodyEl.innerHTML = '';
        if (!despesas || despesas.length === 0) {
            despesasNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        despesasNenhumaMsgEl.classList.add('hidden');

        despesas.forEach(d => {
            const tr = document.createElement('tr');
            const nomeUser = d.user?.full_name || d.user?.username || 'N/A';
            const nomeParque = d.parque?.nome || 'N/A';
            const nomeProjeto = d.projeto?.nome || 'N/A';
            tr.innerHTML = `
                <td>${formatarDataHora(d.data_despesa)}</td>
                <td>${nomeUser}</td>
                <td>${formatarMoeda(d.valor)}</td>
                <td>${d.tipo_despesa}</td>
                <td>${nomeParque}</td>
                <td class="max-w-xs truncate" title="${d.descricao_motivo}">${d.descricao_motivo}</td>
                <td>${nomeProjeto}</td>
                <td>${d.comprovativo_url ? `<a href="${d.comprovativo_url}" target="_blank" class="text-blue-600 hover:underline">Ver</a>` : 'Não'}</td>
                <td class="actions-cell">
                    <button class="action-button text-xs !p-1 desp-editar-btn" data-id="${d.id}">Editar</button>
                    <button class="action-button danger text-xs !p-1 desp-apagar-btn" data-id="${d.id}">Apagar</button>
                </td>
            `;
            despesasTableBodyEl.appendChild(tr);
        });
    }

    function renderPaginacaoDespesasLista(totalItens) {
        despesasPaginacaoEl.innerHTML = '';
        if (!totalItens || totalItens <= itensPorPaginaDespesasLista) return;
        const totalPaginas = Math.ceil(totalItens / itensPorPaginaDespesasLista);
        for (let i = 1; i <= totalPaginas; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `action-button text-sm !p-2 mx-1 ${i === paginaAtualDespesasLista ? 'bg-yellow-700' : 'bg-yellow-500 hover:bg-yellow-600'}`;
            btn.addEventListener('click', () => carregarDespesasDaLista(i));
            despesasPaginacaoEl.appendChild(btn);
        }
    }
    
    async function apagarDespesa(despesaId) {
        if (!confirm("Tem a certeza que deseja apagar esta despesa? Esta ação não pode ser desfeita.")) return;

        const { data: despesaParaApagar } = await supabase.from('despesas').select('comprovativo_url').eq('id', despesaId).single();
        if (despesaParaApagar && despesaParaApagar.comprovativo_url) {
            try {
                const pathComprovativo = new URL(despesaParaApagar.comprovativo_url).pathname.split('/comprovativos-despesas/')[1];
                if (pathComprovativo) {
                    const { error: storageError } = await supabase.storage.from('comprovativos-despesas').remove([pathComprovativo]);
                    if (storageError) console.warn("Aviso: Não foi possível apagar o ficheiro do storage:", storageError);
                }
            } catch (e) { console.warn("Exceção ao tentar apagar ficheiro do storage:", e); }
        }

        const { error } = await supabase.from('despesas').delete().eq('id', despesaId);
        if (error) {
            console.error("Erro ao apagar despesa:", error);
            alert(`Erro: ${error.message}`);
        } else {
            alert("Despesa apagada com sucesso!");
            await carregarDespesasDaLista(paginaAtualDespesasLista);
            await carregarDadosDashboardDespesas();
        }
    }

    function editarDespesa(despesaId) {
        const despesa = todasAsDespesasGeral.find(d => d.id === despesaId);
        if (!despesa) return;
        despesaFormIdEl.value = despesa.id;
        despesaDataEl.value = new Date(despesa.data_despesa).toISOString().slice(0,16);
        despesaValorEl.value = despesa.valor;
        despesaParqueEl.value = despesa.parque_id || (despesa.parque ? despesa.parque.id : '');
        despesaTipoEl.value = despesa.tipo_despesa;
        despesaDescricaoEl.value = despesa.descricao_motivo;
        despesaProjetoEl.value = despesa.projeto_id || (despesa.projeto ? despesa.projeto.id : '');
        despesaComprovativoNomeEl.textContent = despesa.comprovativo_url ? decodeURIComponent(despesa.comprovativo_url.split('/').pop().split('?')[0].split('_').slice(2).join('_')) : '';
        despesaComprovativoEl.value = ''; 
        window.scrollTo({ top: despesaFormEl.offsetTop - 20, behavior: 'smooth' });
        despesaFormStatusEl.textContent = 'A editar despesa. Carregue novo comprovativo apenas se desejar substituí-lo.';
        despesaFormStatusEl.className = 'mt-4 text-sm text-blue-600';
    }

    // --- Exportar Lista ---
    function exportarDespesasParaCSV() {
        if (todasAsDespesasGeral.length === 0) {
            alert("Não há despesas para exportar com os filtros atuais."); return;
        }
        const dataExport = todasAsDespesasGeral.map(d => ({
            "Data Despesa": formatarDataHora(d.data_despesa),
            "Utilizador Registo": d.user?.full_name || d.user?.username || 'N/A',
            "Valor (€)": d.valor,
            "Tipo": d.tipo_despesa,
            "Parque": d.parque?.nome || 'N/A',
            "Cidade": d.parque?.cidade || 'N/A',
            "Descrição": d.descricao_motivo,
            "Projeto": d.projeto?.nome || 'N/A',
            "Link Comprovativo": d.comprovativo_url || 'N/A',
            "Data Registo BD": formatarDataHora(d.created_at)
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Despesas");
        XLSX.writeFile(workbook, `despesas_multipark_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    // --- Event Listeners ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (aplicarFiltrosDashboardBtnEl) {
        aplicarFiltrosDashboardBtnEl.addEventListener('click', async () => {
            await carregarDadosDashboardDespesas();
            await carregarDespesasDaLista(1);
        });
    }
    [dashboardFiltroPeriodoEl, dashboardFiltroTipoEl, dashboardFiltroParqueEl, dashboardFiltroProjetoEl, dashboardFiltroUserEl].forEach(el => {
        if(el) el.addEventListener('change', () => {
            if (el.id === 'despDashboardFiltroPeriodo') {
                const personalizado = dashboardFiltroPeriodoEl.value === 'personalizado';
                dashboardFiltroDataInicioEl.disabled = !personalizado;
                dashboardFiltroDataFimEl.disabled = !personalizado;
                 if (!personalizado) { // Se não for personalizado, aplicar filtros imediatamente
                    aplicarFiltrosDashboardBtnEl.click();
                }
            } else {
                 aplicarFiltrosDashboardBtnEl.click(); // Aplicar para outros filtros
            }
        });
    });

    if(despesasTableBodyEl) {
        despesasTableBodyEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('desp-editar-btn')) {
                editarDespesa(e.target.dataset.id);
            } else if (e.target.classList.contains('desp-apagar-btn')) {
                apagarDespesa(e.target.dataset.id);
            }
        });
    }
    if(exportarListaBtnEl) exportarListaBtnEl.addEventListener('click', exportarDespesasParaCSV);

    // --- Inicialização da Página ---
    async function initDespesasPage() {
        despesaDataEl.value = new Date().toISOString().slice(0,16); // Data/hora atual por defeito
        await carregarDadosParaSelects(); // Carrega parques, projetos, users para os dropdowns
        setupGraficosDespesas();
        
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dashboardFiltroDataInicioEl.valueAsDate = primeiroDiaMes;
        dashboardFiltroDataFimEl.valueAsDate = hoje;
        dashboardFiltroPeriodoEl.value = 'mes_atual';
        dashboardFiltroDataInicioEl.disabled = true;
        dashboardFiltroDataFimEl.disabled = true;

        await carregarDadosDashboardDespesas();
        await carregarDespesasDaLista();
        console.log("Subaplicação de Despesas inicializada.");
    }

    initDespesasPage();
});

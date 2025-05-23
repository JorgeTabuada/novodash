// js/comportamentos.js - Lógica para Análise de Comportamentos e Produtividade

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Comportamentos.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnComp');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Aba Gerar Relatório
    const funcionarioSelectEl = document.getElementById('compFuncionarioSelect');
    const periodoRangeEl = document.getElementById('compPeriodoRange');
    const fileVelocidadeJsonEl = document.getElementById('compFileVelocidadeJson');
    const fileMovimentacoesExcelEl = document.getElementById('compFileMovimentacoesExcel');
    const filesAudioEl = document.getElementById('compFilesAudio');
    const gerarApanhadoBtnEl = document.getElementById('compGerarApanhadoBtn');
    const geracaoStatusEl = document.getElementById('compGeracaoStatus');
    const loadingSpinnerEl = document.getElementById('loadingCompSpinner');
    
    const resultadosApanhadoSecaoEl = document.getElementById('compResultadosApanhado');
    const nomeFuncionarioApanhadoEl = document.getElementById('compNomeFuncionarioApanhado');
    const periodoApanhadoEl = document.getElementById('compPeriodoApanhado');
    const reportGridEl = document.getElementById('compReportGrid');
    const observacoesRelatorioEl = document.getElementById('compObservacoesRelatorio');
    const guardarApanhadoBtnEl = document.getElementById('compGuardarApanhadoBtn');
    const guardarStatusEl = document.getElementById('compGuardarStatus');

    // Aba Consultar Relatórios
    const filtroFuncionarioGuardadoEl = document.getElementById('compFiltroFuncionarioGuardado');
    const filtroDataGeracaoGuardadoEl = document.getElementById('compFiltroDataGeracaoGuardado');
    const aplicarFiltrosGuardadosBtnEl = document.getElementById('compAplicarFiltrosGuardadosBtn');
    const loadingGuardadosSpinnerEl = document.getElementById('loadingCompGuardadosSpinner');
    const relatoriosGuardadosTableBodyEl = document.getElementById('compRelatoriosGuardadosTableBody');
    const relatoriosGuardadosNenhumaMsgEl = document.getElementById('compRelatoriosGuardadosNenhumMsg');
    // const relatoriosGuardadosPaginacaoEl = document.getElementById('compRelatoriosGuardadosPaginacao'); // Para paginação futura

    let fpDateRangeComp; // Flatpickr instance
    let currentGeneratedReportData = null; // Para guardar os dados do relatório gerado antes de salvar

    // --- Funções Auxiliares ---
    function mostrarSpinner(id, show = true) { document.getElementById(id)?.classList.toggle('hidden', !show); }
    function formatarData(dataISO) { return dataISO ? new Date(dataISO).toLocaleDateString('pt-PT') : 'N/A'; }
    function formatarDataHora(dataISO) { return dataISO ? new Date(dataISO).toLocaleString('pt-PT', {dateStyle:'short', timeStyle:'short'}) : 'N/A'; }
    function formatarHorasMinutos(totalMinutos) {
        if (isNaN(totalMinutos) || totalMinutos === null || totalMinutos < 0) return 'N/D';
        const horas = Math.floor(totalMinutos / 60);
        const minutos = Math.round(totalMinutos % 60);
        return `${horas}h ${String(minutos).padStart(2, '0')}m`;
    }

    // --- Navegação por Abas ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(tabId + 'Content').classList.add('active');

            if (tabId === 'consultarRelatoriosComp') {
                carregarRelatoriosGuardados();
            } else if (tabId === 'gerarRelatorioComp') {
                // Limpar resultados anteriores ao voltar para esta aba
                resultadosApanhadoSecaoEl.classList.add('hidden');
                reportGridEl.innerHTML = '';
                observacoesRelatorioEl.value = '';
            }
        });
    });

    // --- Carregar Funcionários para Selects ---
    async function carregarFuncionariosParaSelectComp() {
        const { data, error } = await supabase.from('profiles')
            .select('id, full_name, username')
            .order('full_name');
        
        if (error) {
            console.error("Erro ao carregar funcionários para Comportamentos:", error);
            [funcionarioSelectEl, filtroFuncionarioGuardadoEl].forEach(sel => {
                if(sel) sel.innerHTML = '<option value="">Erro ao carregar</option>';
            });
            return;
        }
        const funcionarios = data || [];
        [funcionarioSelectEl, filtroFuncionarioGuardadoEl].forEach(sel => {
            if (!sel) return;
            const firstOptText = sel.id === 'compFuncionarioSelect' ? 'Selecione um Funcionário...' : 'Todos';
            sel.innerHTML = `<option value="">${firstOptText}</option>`;
            funcionarios.forEach(func => {
                const option = document.createElement('option');
                option.value = func.id;
                option.textContent = func.full_name || func.username;
                sel.appendChild(option);
            });
        });
    }

    // --- Aba Gerar Novo Relatório ---
    gerarApanhadoBtnEl.addEventListener('click', async () => {
        const profileIdAnalisado = funcionarioSelectEl.value;
        const selectedDates = fpDateRangeComp.selectedDates;

        if (!profileIdAnalisado) { alert("Selecione um funcionário para analisar."); return; }
        if (selectedDates.length === 0) { alert("Selecione um período de análise."); return; }
        
        const dataInicio = selectedDates[0].toISOString().split('T')[0];
        const dataFim = selectedDates.length > 1 ? selectedDates[1].toISOString().split('T')[0] : dataInicio;

        mostrarSpinner('loadingCompSpinner', true);
        geracaoStatusEl.textContent = "A recolher e analisar dados...";
        resultadosApanhadoSecaoEl.classList.add('hidden');
        reportGridEl.innerHTML = ''; // Limpar resultados anteriores

        try {
            // 1. Uploads opcionais (se houver ficheiros)
            // TODO: Implementar lógica de upload para `compFileVelocidadeJson`, `compFileMovimentacoesExcel`, `compFilesAudio`
            // Estes ficheiros podem ser guardados no Storage e as suas referências/dados processados em `auditoria_dados_importados`
            // ou numa nova tabela `comportamentos_dados_uploads` associada ao `profile_id_analisado` e período.
            // Por agora, vamos assumir que a RPC principal pode, opcionalmente, considerar dados de uma tabela de uploads.
            let uploadRefs = {};
            if(fileVelocidadeJsonEl.files[0]) geracaoStatusEl.textContent += "\n(Ficheiro JSON de velocidade será considerado se a lógica de backend estiver implementada)";
            if(fileMovimentacoesExcelEl.files[0]) geracaoStatusEl.textContent += "\n(Ficheiro Excel de movimentações será considerado se a lógica de backend estiver implementada)";


            // 2. Chamar RPC principal para obter todas as métricas
            console.log("A chamar RPC get_comportamento_apanhado para:", { profileIdAnalisado, dataInicio, dataFim });
            const { data: apanhadoData, error: rpcError } = await supabase.rpc('get_comportamento_apanhado', {
                p_profile_id_analisado: profileIdAnalisado,
                p_data_inicio: dataInicio,
                p_data_fim: dataFim
                // p_referencias_uploads_json: uploadRefs // Passar referências dos ficheiros carregados se aplicável
            });

            if (rpcError) throw rpcError;
            if (!apanhadoData) throw new Error("A análise não retornou dados.");

            currentGeneratedReportData = apanhadoData; // Guardar para salvar depois

            // 3. Renderizar o "Apanhado"
            nomeFuncionarioApanhadoEl.textContent = funcionarioSelectEl.options[funcionarioSelectEl.selectedIndex].text;
            periodoApanhadoEl.textContent = `${formatarData(dataInicio)} a ${formatarData(dataFim)}`;
            
            reportGridEl.innerHTML = `
                <div class="report-card"><h4>Atividade Geral</h4>
                    <p><strong>Reservas Criadas:</strong> ${apanhadoData.num_reservas_criadas || 0}</p>
                    <p><strong>Recolhas Efetuadas:</strong> ${apanhadoData.num_recolhas_efetuadas || 0}</p>
                    <p><strong>Entregas Efetuadas:</strong> ${apanhadoData.num_entregas_efetuadas || 0}</p>
                    <p><strong>Total Movimentações (R+E):</strong> ${(apanhadoData.num_recolhas_efetuadas || 0) + (apanhadoData.num_entregas_efetuadas || 0)}</p>
                </div>
                <div class="report-card"><h4>Horários e Picagens</h4>
                    <p><strong>Horas Trabalhadas (Picagens):</strong> ${formatarHorasMinutos(apanhadoData.total_minutos_trabalhados)}</p>
                    <p><strong>Disparidades Picagem vs. Atividade:</strong> ${apanhadoData.num_disparidades_picagem || 0}</p>
                    ${apanhadoData.detalhes_disparidades ? `<ul>${apanhadoData.detalhes_disparidades.map(d => `<li>${d}</li>`).join('')}</ul>` : ''}
                </div>
                <div class="report-card"><h4>Tarefas e Projetos</h4>
                    <p><strong>Tarefas Atribuídas:</strong> ${apanhadoData.num_tarefas_atribuidas || 0}</p>
                    <p><strong>Tarefas Não Concluídas a Tempo:</strong> <strong class="${(apanhadoData.num_tarefas_atrasadas || 0) > 0 ? 'text-red-600' : ''}">${apanhadoData.num_tarefas_atrasadas || 0}</strong></p>
                    <p><strong>Projetos Não Concluídos (Responsável/Membro):</strong> ${apanhadoData.num_projetos_nao_concluidos || 0}</p>
                </div>
                <div class="report-card"><h4>Financeiro e Administrativo</h4>
                    <p><strong>Nº Despesas Registadas:</strong> ${apanhadoData.num_despesas_registadas || 0}</p>
                    <p><strong>Valor Total Despesas (€):</strong> ${formatarMoeda(apanhadoData.valor_total_despesas)}</p>
                    <p><strong>Reclamações Não Respondidas (Prazo):</strong> <strong class="${(apanhadoData.num_reclamacoes_nao_respondidas || 0) > 0 ? 'text-red-600' : ''}">${apanhadoData.num_reclamacoes_nao_respondidas || 0}</strong></p>
                    <p><strong>Faturas Não Emitidas (Prazo):</strong> <strong class="${(apanhadoData.num_faturas_nao_emitidas || 0) > 0 ? 'text-red-600' : ''}">${apanhadoData.num_faturas_nao_emitidas || 0}</strong></p>
                </div>
                <div class="report-card col-span-full"><h4>Dados de Auditorias Anteriores (se aplicável)</h4>
                    <p><strong>Velocidades Acima do Permitido (Auditoria):</strong> ${apanhadoData.alertas_velocidade_auditoria || 'N/D'}</p>
                    <p><strong>Envolvimento em Perdidos/Achados (Auditoria):</strong> ${apanhadoData.casos_pa_auditoria || 'N/D'}</p>
                    <p><strong>Reclamações Diretas (Auditoria):</strong> ${apanhadoData.reclamacoes_auditoria || 'N/D'}</p>
                </div>
            `;

            resultadosApanhadoSecaoEl.classList.remove('hidden');
            geracaoStatusEl.textContent = "Apanhado gerado com sucesso. Adicione observações e guarde se desejar.";
            geracaoStatusEl.className = 'mt-4 text-sm text-green-600';

        } catch (error) {
            console.error("Erro ao gerar apanhado de comportamento:", error);
            geracaoStatusEl.textContent = `Erro: ${error.message}`;
            geracaoStatusEl.className = 'mt-4 text-sm text-red-600';
        } finally {
            mostrarSpinner('loadingCompSpinner', false);
        }
    });

    guardarApanhadoBtnEl.addEventListener('click', async () => {
        if (!currentGeneratedReportData) {
            alert("Gere um apanhado primeiro antes de guardar.");
            return;
        }
        const profileIdAnalisado = funcionarioSelectEl.value;
        const selectedDates = fpDateRangeComp.selectedDates;
        const dataInicio = selectedDates[0].toISOString().split('T')[0];
        const dataFim = selectedDates.length > 1 ? selectedDates[1].toISOString().split('T')[0] : dataInicio;

        guardarStatusEl.textContent = "A guardar apanhado...";
        const { error } = await supabase.from('comportamentos_relatorios_gerados').insert({
            profile_id_analisado: profileIdAnalisado,
            user_id_gerador: currentUser.id,
            periodo_inicio_analise: dataInicio,
            periodo_fim_analise: dataFim,
            // filtros_uploads_usados: { /* ... referências aos ficheiros se foram usados ... */ },
            metricas_apuradas: currentGeneratedReportData,
            observacoes_gerais: observacoesRelatorioEl.value || null
        });

        if (error) {
            console.error("Erro ao guardar apanhado:", error);
            guardarStatusEl.textContent = `Erro ao guardar: ${error.message}`;
            guardarStatusEl.className = 'mt-2 text-sm text-red-600';
        } else {
            guardarStatusEl.textContent = "Apanhado guardado com sucesso!";
            guardarStatusEl.className = 'mt-2 text-sm text-green-600';
            currentGeneratedReportData = null; // Limpar após guardar
            // Opcional: Mudar para a aba de consulta de relatórios
            // document.querySelector('.tab-button[data-tab="consultarRelatoriosComp"]').click();
        }
    });


    // --- Aba Consultar Relatórios Guardados ---
    async function carregarRelatoriosGuardados() {
        mostrarSpinner('loadingCompGuardadosSpinner', true);
        relatoriosGuardadosTableBodyEl.innerHTML = '';
        relatoriosGuardadosNenhumaMsgEl.classList.add('hidden');

        let query = supabase.from('comportamentos_relatorios_gerados')
            .select(`
                id, data_geracao, periodo_inicio_analise, periodo_fim_analise,
                analisado:profiles!comportamentos_relatorios_gerados_profile_id_analisado_fkey (full_name, username),
                gerador:profiles!comportamentos_relatorios_gerados_user_id_gerador_fkey (full_name, username)
            `, { count: 'exact' })
            .order('data_geracao', { ascending: false });
        
        if(filtroFuncionarioGuardadoEl.value) query = query.eq('profile_id_analisado', filtroFuncionarioGuardadoEl.value);
        if(filtroDataGeracaoGuardadoEl.value) query = query.gte('data_geracao', filtroDataGeracaoGuardadoEl.value + 'T00:00:00Z');

        const { data, error, count } = await query.limit(20); // Adicionar paginação depois

        mostrarSpinner('loadingCompGuardadosSpinner', false);
        if (error) {
            console.error("Erro ao carregar relatórios guardados:", error);
            relatoriosGuardadosNenhumaMsgEl.textContent = "Erro ao carregar relatórios.";
            relatoriosGuardadosNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        if (!data || data.length === 0) {
            relatoriosGuardadosNenhumaMsgEl.classList.remove('hidden');
            return;
        }
        data.forEach(rel => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>CRG-${String(rel.id).substring(0,8)}</td>
                <td>${rel.analisado?.full_name || rel.analisado?.username || 'N/A'}</td>
                <td>${formatarData(rel.periodo_inicio_analise)} a ${formatarData(rel.periodo_fim_analise)}</td>
                <td>${formatarDataHora(rel.data_geracao)}</td>
                <td>${rel.gerador?.full_name || rel.gerador?.username || 'N/A'}</td>
                <td class="actions-cell">
                    <button class="action-button text-xs !p-1 comp-ver-relatorio-guardado-btn" data-id="${rel.id}">Ver Detalhes</button>
                </td>
            `;
            relatoriosGuardadosTableBodyEl.appendChild(tr);
        });
        // TODO: Implementar paginação para relatórios guardados
    }
    
    relatoriosGuardadosTableBodyEl.addEventListener('click', (e) => {
        if(e.target.classList.contains('comp-ver-relatorio-guardado-btn')) {
            const relatorioId = e.target.dataset.id;
            // TODO: Função para buscar o JSON `metricas_apuradas` e `observacoes_gerais`
            // e preencher a secção `compResultadosApanhado` (ou um modal)
            alert(`Ver detalhes do relatório ${relatorioId} (a implementar)`);
            // Ex: buscar dados, preencher `currentGeneratedReportData`, `observacoesRelatorioEl.value`
            // e depois chamar `renderizarApanhadoComDados(currentGeneratedReportData)`
            // e mudar para a aba 'gerarRelatorioComp' (ou mostrar num modal dedicado)
        }
    });


    // --- Event Listeners Gerais ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (aplicarFiltrosGuardadosBtnEl) aplicarFiltrosGuardadosBtnEl.addEventListener('click', carregarRelatoriosGuardados);
    

    // --- Inicialização da Página ---
    async function initComportamentosPage() {
        if (!userProfile) { alert("Perfil não carregado."); return; }
        // Permissões: Quem pode gerar/ver estes relatórios? Super Admin, Admin, Supervisores?
        // if (!['super_admin', 'admin', 'supervisor'].includes(userProfile.role)) {
        //     alert("Não tem permissão para aceder a este módulo.");
        //     window.location.href = 'index.html';
        //     return;
        // }

        fpDateRangeComp = flatpickr(periodoRangeEl, {
            mode: "range", dateFormat: "Y-m-d",
            defaultDate: [new Date(new Date().setDate(1)), new Date()], // Mês atual
            locale: { /* ... (locale pt) ... */ }
        });

        await carregarFuncionariosParaSelectComp();
        // Por defeito, pode carregar a lista de relatórios guardados
        if (document.getElementById('consultarRelatoriosCompContent').classList.contains('active')) {
            await carregarRelatoriosGuardados();
        }
        console.log("Subaplicação de Comportamentos inicializada.");
    }

    initComportamentosPage();
});

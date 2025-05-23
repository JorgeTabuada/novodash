// js/produtividade_condutores.js (REVISTO)

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Produtividade.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnProd');
    const condutorSelectEl = document.getElementById('prodCondutorSelect');
    const periodoRangeEl = document.getElementById('prodPeriodoRange');
    const analisarBtnEl = document.getElementById('prodAnalisarBtn');
    const loadingSpinnerEl = document.getElementById('loadingProdSpinner');

    const resultadosVisaoGeralEl = document.getElementById('prodResultadosVisaoGeral');
    const periodoVisaoGeralEl = document.getElementById('prodPeriodoVisaoGeral');
    const statGeralEntreguesEl = document.getElementById('statGeralEntregues');
    const statGeralRecolhidosEl = document.getElementById('statGeralRecolhidos');
    const statGeralMovimentacoesEl = document.getElementById('statGeralMovimentacoes');

    const resultadosCondutorEl = document.getElementById('prodResultadosCondutor');
    const nomeCondutorAnalisadoEl = document.getElementById('prodNomeCondutorAnalisado');
    const periodoCondutorEl = document.getElementById('prodPeriodoCondutor');
    const statCondHorasTrabalhadasEl = document.getElementById('statCondHorasTrabalhadas');
    const statCondRecolhasEl = document.getElementById('statCondRecolhas');
    const statCondEntregasEl = document.getElementById('statCondEntregas');
    const statCondMovimentacoesEl = document.getElementById('statCondMovimentacoes');
    const statCondUltimaAuditoriaEl = document.getElementById('statCondUltimaAuditoria');
    
    const uploadSectionOpcionalEl = document.getElementById('prodUploadSectionOpcional');
    const nomeCondutorUploadEl = document.getElementById('prodNomeCondutorUpload');
    const fileVelocidadeJsonEl = document.getElementById('prodFileVelocidadeJson');
    const fileMovExtrasExcelEl = document.getElementById('prodFileMovExtrasExcel');
    const processarUploadsAdicionaisBtnEl = document.getElementById('prodProcessarUploadsAdicionaisBtn');
    const uploadAdicionalStatusEl = document.getElementById('prodUploadAdicionalStatus');

    let fpDateRangeProd; 

    // --- Funções Auxiliares ---
    function mostrarSpinner(show = true) { loadingSpinnerEl.style.display = show ? 'block' : 'none'; }
    function formatarData(dataISO) { return dataISO ? new Date(dataISO).toLocaleDateString('pt-PT') : 'N/A'; }
    function formatarHorasMinutos(totalMinutos) {
        if (isNaN(totalMinutos) || totalMinutos === null || totalMinutos < 0) return 'N/D';
        const horas = Math.floor(totalMinutos / 60);
        const minutos = Math.round(totalMinutos % 60);
        return `${horas}h ${String(minutos).padStart(2, '0')}m`;
    }

    // --- Carregar Condutores para Select ---
    async function carregarCondutoresParaSelectProd() {
        const { data, error } = await supabase.from('profiles')
            .select('id, full_name, username')
            .order('full_name');
        
        if (error) {
            console.error("Erro ao carregar condutores para produtividade:", error);
            condutorSelectEl.innerHTML = '<option value="">Erro ao carregar</option>';
            return;
        }
        condutorSelectEl.innerHTML = '<option value="">-- Todos / Visão Geral --</option>';
        (data || []).forEach(func => {
            const option = document.createElement('option');
            option.value = func.id;
            option.textContent = func.full_name || func.username;
            condutorSelectEl.appendChild(option);
        });
    }

    // --- Lógica de Análise Principal ---
    analisarBtnEl.addEventListener('click', async () => {
        const condutorId = condutorSelectEl.value;
        const selectedDates = fpDateRangeProd.selectedDates;

        if (selectedDates.length === 0) {
            alert("Por favor, selecione um período de análise.");
            return;
        }
        const dataInicio = selectedDates[0].toISOString().split('T')[0];
        const dataFim = selectedDates.length > 1 ? selectedDates[1].toISOString().split('T')[0] : dataInicio;

        mostrarSpinner(true);
        resultadosVisaoGeralEl.classList.add('hidden');
        resultadosCondutorEl.classList.add('hidden');
        uploadSectionOpcionalEl.classList.add('hidden');
        uploadAdicionalStatusEl.textContent = ''; // Limpar status de uploads anteriores

        const periodoFormatado = `${formatarData(dataInicio)} a ${formatarData(dataFim)}`;
        
        try {
            // 1. Buscar Dados Gerais (Sempre)
            console.log("A chamar RPC get_produtividade_geral_periodo...");
            const { data: dadosGerais, error: erroGeral } = await supabase.rpc('get_produtividade_geral_periodo', {
                p_data_inicio: dataInicio,
                p_data_fim: dataFim,
            });
            if (erroGeral) throw erroGeral;

            if (dadosGerais && dadosGerais.length > 0) {
                const geral = dadosGerais[0];
                periodoVisaoGeralEl.textContent = periodoFormatado;
                statGeralEntreguesEl.textContent = geral.total_entregas || 0;
                statGeralRecolhidosEl.textContent = geral.total_recolhas || 0;
                statGeralMovimentacoesEl.textContent = geral.total_movimentacoes_gerais || ((geral.total_entregas || 0) + (geral.total_recolhas || 0));
                resultadosVisaoGeralEl.classList.remove('hidden');
            } else {
                 periodoVisaoGeralEl.textContent = periodoFormatado;
                 statGeralEntreguesEl.textContent = '0';
                 statGeralRecolhidosEl.textContent = '0';
                 statGeralMovimentacoesEl.textContent = '0';
                 resultadosVisaoGeralEl.classList.remove('hidden');
                 console.warn("RPC get_produtividade_geral_periodo não retornou dados.");
            }

            // 2. Se um condutor específico foi selecionado, buscar seus dados
            if (condutorId) {
                const nomeCondutorSelecionado = condutorSelectEl.options[condutorSelectEl.selectedIndex].text;
                nomeCondutorAnalisadoEl.textContent = nomeCondutorSelecionado;
                periodoCondutorEl.textContent = periodoFormatado;
                if(nomeCondutorUploadEl) nomeCondutorUploadEl.textContent = nomeCondutorSelecionado;


                console.log(`A chamar RPC get_produtividade_condutor_periodo para condutor ID: ${condutorId}`);
                const { data: dadosCondutor, error: erroCondutor } = await supabase.rpc('get_produtividade_condutor_periodo', {
                    p_condutor_id: condutorId,
                    p_data_inicio: dataInicio,
                    p_data_fim: dataFim
                });
                if (erroCondutor) throw erroCondutor;

                if (dadosCondutor && dadosCondutor.length > 0) {
                    const condutorData = dadosCondutor[0];
                    statCondHorasTrabalhadasEl.textContent = formatarHorasMinutos(condutorData.total_minutos_trabalhados);
                    statCondRecolhasEl.textContent = condutorData.num_recolhas || 0;
                    statCondEntregasEl.textContent = condutorData.num_entregas || 0;
                    statCondMovimentacoesEl.textContent = condutorData.num_movimentacoes_condutor || ((condutorData.num_recolhas || 0) + (condutorData.num_entregas || 0));
                    statCondUltimaAuditoriaEl.innerHTML = condutorData.resumo_ultima_auditoria ? `<span class="font-semibold">${formatarData(condutorData.data_ultima_auditoria)}:</span> ${condutorData.resumo_ultima_auditoria}` : 'Nenhuma auditoria recente encontrada.';
                } else {
                    statCondHorasTrabalhadasEl.textContent = 'N/D';
                    statCondRecolhasEl.textContent = '0';
                    statCondEntregasEl.textContent = '0';
                    statCondMovimentacoesEl.textContent = '0';
                    statCondUltimaAuditoriaEl.textContent = 'Nenhum dado de produtividade encontrado.';
                     console.warn(`RPC get_produtividade_condutor_periodo não retornou dados para condutor ID: ${condutorId}`);
                }
                resultadosCondutorEl.classList.remove('hidden');
                uploadSectionOpcionalEl.classList.remove('hidden');
            }

        } catch (error) {
            console.error("Erro ao analisar produtividade:", error);
            alert(`Erro ao buscar dados: ${error.message}`);
        } finally {
            mostrarSpinner(false);
        }
    });
    
    // --- Lógica de Upload de Ficheiros Adicionais ---
    processarUploadsAdicionaisBtnEl.addEventListener('click', async () => {
        const condutorId = condutorSelectEl.value;
        const selectedDates = fpDateRangeProd.selectedDates;

        if (!condutorId || selectedDates.length === 0) {
            alert("Selecione um condutor e um período antes de carregar ficheiros adicionais.");
            return;
        }
        const dataInicio = selectedDates[0].toISOString().split('T')[0];
        const dataFim = selectedDates.length > 1 ? selectedDates[1].toISOString().split('T')[0] : dataInicio;

        const ficheiroVelocidade = fileVelocidadeJsonEl.files[0];
        const ficheiroMovimentacoes = fileMovExtrasExcelEl.files[0];

        if (!ficheiroVelocidade && !ficheiroMovimentacoes) {
            uploadAdicionalStatusEl.textContent = "Nenhum ficheiro adicional selecionado para processar.";
            uploadAdicionalStatusEl.className = 'mt-2 text-sm text-yellow-600';
            return;
        }

        mostrarSpinner(true);
        uploadAdicionalStatusEl.textContent = "A processar ficheiros adicionais...";
        uploadAdicionalStatusEl.className = 'mt-2 text-sm text-blue-600';
        let mensagensStatus = [];

        // Criar ou obter uma sessão de auditoria/análise para associar estes dados, se necessário
        // Por agora, vamos assumir que os dados são inseridos numa tabela que referencia o condutor e período.
        // Ex: `produtividade_dados_uploads` com colunas: profile_id, data_registo, tipo_dado, dados_json

        if (ficheiroVelocidade) {
            try {
                const jsonContent = JSON.parse(await ficheiroVelocidade.text());
                if (Array.isArray(jsonContent) && jsonContent.length > 0) {
                    const dadosParaInserir = jsonContent.map(reg => ({
                        profile_id_condutor: condutorId,
                        periodo_analisado_inicio: dataInicio, // Para contextualizar
                        periodo_analisado_fim: dataFim,
                        tipo_dado: 'velocidade_gps_upload',
                        timestamp_registo_original: reg.timestamp || reg.data_hora,
                        dados_json: reg
                    }));
                    const { error } = await supabase.from('produtividade_dados_uploads').insert(dadosParaInserir);
                    if (error) throw error;
                    console.log("Dados JSON para inserir (simulado):", dadosParaInserir);
                    mensagensStatus.push(`Ficheiro JSON "${ficheiroVelocidade.name}" processado com ${dadosParaInserir.length} registos (simulado).`);
                } else {
                    mensagensStatus.push(`Ficheiro JSON "${ficheiroVelocidade.name}" vazio ou formato inválido.`);
                }
            } catch (e) {
                console.error("Erro ao processar JSON adicional:", e);
                mensagensStatus.push(`Erro no ficheiro JSON "${ficheiroVelocidade.name}": ${e.message}`);
            }
        }

        if (ficheiroMovimentacoes) {
             try {
                const fileData = new Uint8Array(await ficheiroMovimentacoes.arrayBuffer());
                const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
                const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
                if (sheetData.length > 0) {
                     const dadosParaInserir = sheetData.map(row => ({
                        profile_id_condutor: condutorId,
                        periodo_analisado_inicio: dataInicio,
                        periodo_analisado_fim: dataFim,
                        tipo_dado: 'movimentacao_excel_upload',
                        timestamp_registo_original: row['Data Movimento'] || row['data_hora_inicio_mov'],
                        dados_json: row
                    }));
                    const { error } = await supabase.from('produtividade_dados_uploads').insert(dadosParaInserir);
                    if (error) throw error;
                    console.log("Dados Excel para inserir (simulado):", dadosParaInserir);
                    mensagensStatus.push(`Ficheiro Excel "${ficheiroMovimentacoes.name}" processado com ${dadosParaInserir.length} registos (simulado).`);
                } else {
                     mensagensStatus.push(`Ficheiro Excel "${ficheiroMovimentacoes.name}" vazio.`);
                }
            } catch(e) {
                console.error("Erro ao processar Excel adicional:", e);
                mensagensStatus.push(`Erro no ficheiro Excel "${ficheiroMovimentacoes.name}": ${e.message}`);
            }
        }
        
        uploadAdicionalStatusEl.innerHTML = mensagensStatus.join('<br>');
        uploadAdicionalStatusEl.className = `mt-2 text-sm ${mensagensStatus.some(m => m.toLowerCase().includes('erro')) ? 'text-red-600' : 'text-green-600'}`;
        
        fileVelocidadeJsonEl.value = ''; // Limpar inputs
        fileMovExtrasExcelEl.value = '';

        // Após processar, re-analisar para incluir os novos dados (se a lógica da RPC os considerar)
        // ou se o dashboard for atualizado para ler diretamente desta nova fonte.
        // Por agora, apenas informa. Poderia-se chamar analisarBtnEl.click() se a RPC for desenhada para usar estes dados.
        // alert("Ficheiros adicionais processados (simulado). Clique em 'Analisar Produtividade' novamente se a RPC foi desenhada para incluir estes dados.");

        mostrarSpinner(false);
    });


    // --- Event Listeners Gerais ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    
    condutorSelectEl.addEventListener('change', () => {
        resultadosCondutorEl.classList.add('hidden');
        uploadSectionOpcionalEl.classList.add('hidden');
        uploadAdicionalStatusEl.textContent = '';
        if (!condutorSelectEl.value) { // Se voltou para "Todos / Visão Geral"
            // Manter a visão geral se já foi calculada, ou limpar se preferir
            // resultadosVisaoGeralEl.classList.remove('hidden'); // Ou deixar como está
        }
    });

    // --- Inicialização da Página ---
    async function initProdutividadePage() {
        if (!userProfile) { alert("Perfil não carregado."); return; }
        
        fpDateRangeProd = flatpickr(periodoRangeEl, {
            mode: "range", dateFormat: "Y-m-d",
            defaultDate: [new Date(new Date().setDate(new Date().getDate() - 7)), new Date()],
            locale: { firstDayOfWeek: 1, /* ... (locale pt) ... */ }
        });

        await carregarCondutoresParaSelectProd();
        console.log("Subaplicação de Produtividade de Condutores inicializada.");
        // Opcional: Disparar uma análise inicial com os filtros padrão
        analisarBtnEl.click(); 
    }

    initProdutividadePage();
});

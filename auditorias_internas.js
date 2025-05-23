// js/auditorias_internas.js

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Auditorias.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnAuditoria');
    const funcionarioSelectEl = document.getElementById('auditFuncionarioSelect');
    const periodoInicioEl = document.getElementById('auditPeriodoInicio');
    const periodoFimEl = document.getElementById('auditPeriodoFim');
    const fileVelocidadeJsonEl = document.getElementById('auditFileVelocidadeJson');
    const fileMovimentacoesExcelEl = document.getElementById('auditFileMovimentacoesExcel');
    const filesAudioEl = document.getElementById('auditFilesAudio');
    const iniciarAnaliseBtnEl = document.getElementById('auditIniciarAnaliseBtn');
    const uploadStatusEl = document.getElementById('auditUploadStatus');
    const loadingAuditSpinnerEl = document.getElementById('loadingAuditSpinner');

    const dashboardSecaoEl = document.getElementById('auditDashboardSecao');
    const nomeFuncionarioDashboardEl = document.getElementById('auditNomeFuncionarioDashboard');
    const periodoDashboardEl = document.getElementById('auditPeriodoDashboard');
    
    const statVelocidadeMaxEl = document.getElementById('statVelocidadeMax');
    const statVelocidadeAcimaLimiteEl = document.getElementById('statVelocidadeAcimaLimite');
    const statCarrosMovimentadosEl = document.getElementById('statCarrosMovimentados');
    const statRecolhasEl = document.getElementById('statRecolhas');
    const statEntregasEl = document.getElementById('statEntregas');
    const statDisparidadePicagemEl = document.getElementById('statDisparidadePicagem');
    const listDisparidadesPicagemEl = document.getElementById('listDisparidadesPicagem');
    const statPerdidosAchadosEl = document.getElementById('statPerdidosAchados');
    const statReclamacoesEl = document.getElementById('statReclamacoes');
    const listVeiculosConduzidosEl = document.getElementById('listVeiculosConduzidos');
    const statTelefoneBateriaMediaEl = document.getElementById('statTelefoneBateriaMedia');
    const statTelefonePingsEl = document.getElementById('statTelefonePings');
    
    const velocidadeTableBodyEl = document.getElementById('auditVelocidadeTableBody');
    const velocidadeNenhumaMsgEl = document.getElementById('auditVelocidadeNenhumaMsg');
    const listaAudiosEl = document.getElementById('auditListaAudios');
    const notasFinaisEl = document.getElementById('auditNotasFinais');
    const guardarConclusoesBtnEl = document.getElementById('auditGuardarConclusoesBtn');
    const saveStatusEl = document.getElementById('auditSaveStatus');
    
    let currentAuditoriaSessaoId = null;


    // --- Funções Auxiliares ---
    function mostrarSpinner(show = true) { loadingAuditSpinnerEl.style.display = show ? 'block' : 'none'; }
    function formatarDataHora(dataISO) { return dataISO ? new Date(dataISO).toLocaleString('pt-PT', {dateStyle:'short', timeStyle:'short'}) : 'N/A'; }


    // --- Carregar Funcionários para Select ---
    async function carregarFuncionariosParaAuditoria() {
        const { data, error } = await supabase.from('profiles')
            .select('id, full_name, username')
            // .in('role', ['condutor', 'operador_recolhas', 'operador_entregas']) // Filtrar por roles auditáveis
            .order('full_name');
        
        if (error) {
            console.error("Erro ao carregar funcionários para auditoria:", error);
            funcionarioSelectEl.innerHTML = '<option value="">Erro ao carregar</option>';
            return;
        }
        funcionarioSelectEl.innerHTML = '<option value="">-- Selecione um Funcionário --</option>';
        (data || []).forEach(func => {
            const option = document.createElement('option');
            option.value = func.id;
            option.textContent = func.full_name || func.username;
            funcionarioSelectEl.appendChild(option);
        });
    }

    // --- Lógica de Upload e Análise ---
    iniciarAnaliseBtnEl.addEventListener('click', async () => {
        const funcionarioId = funcionarioSelectEl.value;
        const dataInicio = periodoInicioEl.value;
        const dataFim = periodoFimEl.value;
        const ficheiroVelocidade = fileVelocidadeJsonEl.files[0];
        const ficheiroMovimentacoes = fileMovimentacoesExcelEl.files[0];
        const ficheirosAudio = filesAudioEl.files;

        if (!funcionarioId || !dataInicio || !dataFim) {
            alert("Selecione o funcionário e o período de análise.");
            return;
        }
        if (!ficheiroVelocidade && !ficheiroMovimentacoes) {
            alert("Pelo menos um ficheiro de dados (Velocidade JSON ou Movimentações Excel) deve ser fornecido.");
            return;
        }

        mostrarSpinner(true);
        uploadStatusEl.textContent = "A iniciar sessão de auditoria e carregar ficheiros...";
        dashboardSecaoEl.classList.add('hidden'); // Esconder dashboard anterior
        
        // 1. Criar uma sessão de auditoria no Supabase
        const { data: sessaoData, error: erroSessao } = await supabase
            .from('auditoria_sessoes')
            .insert({
                profile_id_auditado: funcionarioId,
                user_id_auditor: currentUser.id,
                periodo_inicio_analise: dataInicio,
                periodo_fim_analise: dataFim,
            })
            .select('id')
            .single();

        if (erroSessao || !sessaoData) {
            console.error("Erro ao criar sessão de auditoria:", erroSessao);
            uploadStatusEl.textContent = `Erro ao criar sessão: ${erroSessao?.message || 'Desconhecido'}`;
            mostrarSpinner(false);
            return;
        }
        currentAuditoriaSessaoId = sessaoData.id;
        console.log("Sessão de auditoria criada:", currentAuditoriaSessaoId);
        nomeFuncionarioDashboardEl.textContent = funcionarioSelectEl.options[funcionarioSelectEl.selectedIndex].text;
        periodoDashboardEl.textContent = `${formatarDataHora(dataInicio, true)} a ${formatarDataHora(dataFim, true)}`;


        // 2. Upload e Processamento do Ficheiro JSON de Velocidade/Localização
        if (ficheiroVelocidade) {
            uploadStatusEl.textContent = "A processar ficheiro JSON de velocidade...";
            try {
                const jsonContent = JSON.parse(await ficheiroVelocidade.text());
                if (Array.isArray(jsonContent) && jsonContent.length > 0) {
                    const dadosParaInserir = jsonContent.map(reg => ({
                        sessao_auditoria_id: currentAuditoriaSessaoId,
                        profile_id_condutor: funcionarioId, // Assumindo que o JSON é específico do condutor
                        timestamp_registo_original: reg.timestamp || reg.data_hora, // Ajustar ao teu JSON
                        velocidade_kmh: parseFloat(reg.velocidade || reg.speed || 0),
                        latitude: parseFloat(reg.latitude || reg.lat || 0),
                        longitude: parseFloat(reg.longitude || reg.lon || 0),
                        gps_precisao_metros: parseFloat(reg.precisao_gps || reg.accuracy || null),
                        telefone_ativo: typeof reg.telefone_ativo === 'boolean' ? reg.telefone_ativo : (String(reg.telefone_ativo).toLowerCase() === 'true'),
                        telefone_bateria_percentagem: parseInt(reg.bateria || reg.battery_level || null),
                        telefone_ultimo_ping_app: reg.ultimo_ping ? new Date(reg.ultimo_ping).toISOString() : null,
                        dados_json: reg // Guardar a linha original do JSON
                    }));
                    const { error: erroJsonInsert } = await supabase.from('auditoria_dados_importados').insert(dadosParaInserir);
                    if (erroJsonInsert) throw erroJsonInsert;
                    uploadStatusEl.textContent = `Ficheiro JSON processado: ${dadosParaInserir.length} registos.`;
                } else {
                     uploadStatusEl.textContent += "\nFicheiro JSON vazio ou formato inválido.";
                }
            } catch (e) {
                console.error("Erro ao processar JSON:", e);
                uploadStatusEl.textContent += `\nErro no ficheiro JSON: ${e.message}`;
            }
        }
        
        // 3. Upload e Processamento do Ficheiro Excel de Movimentações
        if (ficheiroMovimentacoes) {
             uploadStatusEl.textContent = "A processar ficheiro Excel de movimentações...";
            try {
                const fileData = new Uint8Array(await ficheiroMovimentacoes.arrayBuffer());
                const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
                const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });

                if (sheetData.length > 0) {
                    const dadosParaInserir = sheetData.map(row => ({
                        sessao_auditoria_id: currentAuditoriaSessaoId,
                        profile_id_condutor: funcionarioId, // Assumindo que o Excel é específico do condutor
                        tipo_dado: 'movimentacao_excel',
                        // Ajustar nomes das colunas do teu Excel
                        timestamp_registo_original: row['Data Movimento'] || row['data_hora_inicio_mov'], 
                        excel_tipo_movimento: row['Tipo Movimento'] || row['tipo_movimento'],
                        excel_matricula: row['Matrícula'] || row['matricula'],
                        excel_alocation: row['Alocation'] || row['alocation'],
                        // Adicionar outros campos relevantes do Excel
                        dados_json: row
                    }));
                    const { error: erroExcelInsert } = await supabase.from('auditoria_dados_importados').insert(dadosParaInserir);
                    if (erroExcelInsert) throw erroExcelInsert;
                    uploadStatusEl.textContent += `\nFicheiro Excel processado: ${dadosParaInserir.length} registos.`;
                } else {
                    uploadStatusEl.textContent += "\nFicheiro Excel de movimentações vazio.";
                }
            } catch(e) {
                console.error("Erro ao processar Excel:", e);
                uploadStatusEl.textContent += `\nErro no ficheiro Excel: ${e.message}`;
            }
        }

        // 4. Upload de Ficheiros de Áudio
        listaAudiosEl.innerHTML = '<p class="text-sm text-gray-500">Nenhum áudio novo para esta sessão.</p>';
        if (ficheirosAudio.length > 0) {
            uploadStatusEl.textContent += "\nA carregar áudios...";
            let audiosHtml = '';
            for (const audioFile of ficheirosAudio) {
                const nomeAudioStorage = `auditorias_audio/${currentAuditoriaSessaoId}/${Date.now()}_${audioFile.name.replace(/\s+/g, '_')}`;
                const { data: audioUploadData, error: audioUploadError } = await supabase.storage
                    .from('audios-auditorias') // Nome do Bucket
                    .upload(nomeAudioStorage, audioFile);
                
                if (audioUploadError) {
                    console.error("Erro upload áudio:", audioUploadError);
                    audiosHtml += `<p class="text-xs text-red-500">Erro ao carregar ${audioFile.name}</p>`;
                } else {
                    const { data: urlAudio } = supabase.storage.from('audios-auditorias').getPublicUrl(audioUploadData.path);
                    await supabase.from('auditoria_anexos_audio').insert({
                        sessao_auditoria_id: currentAuditoriaSessaoId,
                        nome_ficheiro_original: audioFile.name,
                        ficheiro_url: urlAudio.publicUrl,
                        storage_bucket_path: audioUploadData.path,
                    });
                    audiosHtml += `<div class="document-list-item"><a href="${urlAudio.publicUrl}" target="_blank" class="text-blue-600 hover:underline">${audioFile.name}</a></div>`;
                }
            }
            if(audiosHtml) listaAudiosEl.innerHTML = audiosHtml;
            uploadStatusEl.textContent += `\n${ficheirosAudio.length} áudio(s) processado(s).`;
        }
        
        // 5. Após todos os uploads, buscar e apresentar dados no Dashboard
        await apresentarResultadosAuditoria(currentAuditoriaSessaoId, funcionarioId, dataInicio, dataFim);
        mostrarSpinner(false);
        dashboardSecaoEl.classList.remove('hidden');
        uploadStatusEl.textContent = "Análise inicial concluída. Verifique o dashboard abaixo.";
    });

    async function apresentarResultadosAuditoria(sessaoId, funcionarioId, periodoInicio, periodoFim) {
        // Limpar dashboard anterior
        statVelocidadeMaxEl.textContent = 'N/D';
        statVelocidadeAcimaLimiteEl.textContent = 'N/D';
        statCarrosMovimentadosEl.textContent = '0';
        statRecolhasEl.textContent = '0';
        statEntregasEl.textContent = '0';
        statDisparidadePicagemEl.textContent = 'N/D';
        listDisparidadesPicagemEl.innerHTML = '';
        statPerdidosAchadosEl.textContent = '0';
        statReclamacoesEl.textContent = '0';
        listVeiculosConduzidosEl.textContent = 'A calcular...';
        statTelefoneBateriaMediaEl.textContent = 'N/D';
        statTelefonePingsEl.textContent = 'N/D';
        velocidadeTableBodyEl.innerHTML = '';
        velocidadeNenhumaMsgEl.classList.remove('hidden');

        // A. Dados de Velocidade e Telefone (da tabela auditoria_dados_importados)
        const { data: dadosVelocidade, error: erroVel } = await supabase
            .from('auditoria_dados_importados')
            .select('velocidade_kmh, latitude, longitude, telefone_ativo, telefone_bateria_percentagem, timestamp_registo_original')
            .eq('sessao_auditoria_id', sessaoId)
            .eq('profile_id_condutor', funcionarioId) // Redundante se já filtrado pela sessão, mas bom para garantir
            .order('timestamp_registo_original', { ascending: false }); // Mais recentes primeiro para amostra

        if (erroVel) console.error("Erro ao buscar dados de velocidade:", erroVel);
        
        if (dadosVelocidade && dadosVelocidade.length > 0) {
            velocidadeNenhumaMsgEl.classList.add('hidden');
            let maxVel = 0;
            let totalBat = 0; let countBat = 0;
            let pings = 0; // Contar pings ou atividade da app
            dadosVelocidade.slice(0, 20).forEach(d => { // Amostra para tabela
                if (d.velocidade_kmh > maxVel) maxVel = d.velocidade_kmh;
                if (d.telefone_bateria_percentagem !== null) { totalBat += d.telefone_bateria_percentagem; countBat++; }
                if (d.telefone_ativo) pings++; // Exemplo de contagem de pings

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatarDataHora(d.timestamp_registo_original)}</td>
                    <td>${d.velocidade_kmh || 0}</td>
                    <td>${d.latitude?.toFixed(5) || 'N/A'}, ${d.longitude?.toFixed(5) || 'N/A'}</td>
                    <td>${d.telefone_ativo ? 'Sim' : 'Não'}</td>
                    <td>${d.telefone_bateria_percentagem !== null ? d.telefone_bateria_percentagem + '%' : 'N/A'}</td>
                `;
                velocidadeTableBodyEl.appendChild(tr);
            });
            statVelocidadeMaxEl.textContent = `${maxVel.toFixed(1)} km/h`;
            statTelefoneBateriaMediaEl.textContent = countBat > 0 ? `${(totalBat/countBat).toFixed(0)}%` : 'N/D';
            statTelefonePingsEl.textContent = `${pings} (em ${dadosVelocidade.length} registos)`;
            // TODO: Lógica para "velocidade acima do permitido" - requer dados externos de limites de velocidade
            statVelocidadeAcimaLimiteEl.textContent = "Comparação não implementada";
        }

        // B. Dados de Movimentações (da tabela auditoria_dados_importados, tipo 'movimentacao_excel')
        // OU diretamente da tabela `reservas` se o ficheiro Excel apenas complementa/confirma
        const { data: dadosMov, error: erroMov } = await supabase
            .from('auditoria_dados_importados')
            .select('excel_tipo_movimento, excel_matricula')
            .eq('sessao_auditoria_id', sessaoId)
            .eq('profile_id_condutor', funcionarioId)
            .eq('tipo_dado', 'movimentacao_excel');
            // OU:
            // .from('reservas')
            // .select('tipo_servico, matricula') // Ajustar colunas
            // .eq('condutor_recolha_id', funcionarioId) // Ou condutor_entrega_id
            // .gte('data_entrada_real', periodoInicio)
            // .lte('data_entrada_real', periodoFim) // Ou data_saida_real

        if (erroMov) console.error("Erro ao buscar dados de movimentações:", erroMov);
        let recolhas = 0, entregas = 0;
        const veiculosUnicos = new Set();
        (dadosMov || []).forEach(m => {
            if(m.excel_matricula) veiculosUnicos.add(m.excel_matricula);
            if (m.excel_tipo_movimento?.toLowerCase().includes('recolha')) recolhas++;
            if (m.excel_tipo_movimento?.toLowerCase().includes('entrega')) entregas++;
        });
        statCarrosMovimentadosEl.textContent = veiculosUnicos.size;
        statRecolhasEl.textContent = recolhas;
        statEntregasEl.textContent = entregas;
        listVeiculosConduzidosEl.innerHTML = veiculosUnicos.size > 0 ? `<ul>${Array.from(veiculosUnicos).map(v => `<li>${v}</li>`).join('')}</ul>` : 'Nenhum veículo registado.';


        // C. Picagens (da tabela picagens_horas)
        const { data: picagens, error: erroPic } = await supabase
            .from('picagens_horas')
            .select('data_hora_picagem, tipo_movimento')
            .eq('profile_id', funcionarioId)
            .gte('data_hora_picagem', `${periodoInicio}T00:00:00Z`)
            .lte('data_hora_picagem', `${periodoFim}T23:59:59Z`)
            .order('data_hora_picagem');
        
        if (erroPic) console.error("Erro ao buscar picagens:", erroPic);
        // TODO: Lógica para comparar última picagem de saída do dia com última movimentação de veículo nesse dia.
        // Isto requer agrupar picagens por dia, encontrar a última saída.
        // E agrupar movimentações por dia, encontrar a última.
        // É complexo para fazer puramente no cliente. Uma RPC seria ideal.
        statDisparidadePicagemEl.textContent = "Análise a implementar";
        listDisparidadesPicagemEl.innerHTML = '<li>Ex: Dia X - Picou Saída 18:00, Última Mov. 17:00 (Dif: 60min)</li>';


        // D. Perdidos e Achados (da tabela perdidos_achados_casos)
        // Precisa de uma forma de ligar o condutor ao caso (ex: se o condutor foi um dos que movimentou o carro do caso)
        // Esta query é complexa e precisaria de joins ou subqueries.
        // const { count: paCount, error: erroPA } = await supabase.from('perdidos_achados_casos')
        //     .select('*', {count: 'exact', head: true})
        //     // .in('reserva_id', [IDs das reservas que o condutor movimentou no período])
        //     // OU se tiver uma coluna direta `condutor_suspeito_id`
        // if(erroPA) console.error("Erro PA:", erroPA); else statPerdidosAchadosEl.textContent = paCount || 0;
        statPerdidosAchadosEl.textContent = "A implementar";

        // E. Reclamações (da tabela comentarios_reclamacoes)
        // Similar a P&A, precisa de ligar a reclamação ao condutor.
        // const { count: recCount, error: erroRec } = await supabase.from('comentarios_reclamacoes')
        //     .select('*', {count: 'exact', head: true})
        //     // .in('reserva_id', [IDs das reservas que o condutor movimentou no período])
        // if(erroRec) console.error("Erro Rec:", erroRec); else statReclamacoesEl.textContent = recCount || 0;
        statReclamacoesEl.textContent = "A implementar";
    }
    
    guardarConclusoesBtnEl.addEventListener('click', async () => {
        if (!currentAuditoriaSessaoId) {
            alert("Nenhuma sessão de auditoria ativa para guardar conclusões.");
            return;
        }
        const notas = notasFinaisEl.value;
        saveStatusEl.textContent = "A guardar...";
        const { error } = await supabase
            .from('auditoria_sessoes')
            .update({ notas_gerais_auditoria: notas, estado_auditoria: 'Concluída' }) // Marcar como concluída
            .eq('id', currentAuditoriaSessaoId);
        
        if (error) {
            saveStatusEl.textContent = `Erro ao guardar: ${error.message}`;
            console.error("Erro ao guardar conclusões:", error);
        } else {
            saveStatusEl.textContent = "Conclusões da auditoria guardadas com sucesso!";
        }
    });


    // --- Event Listeners Gerais ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    
    // --- Inicialização da Página ---
    async function initAuditoriasPage() {
        if (!userProfile) { alert("Perfil não carregado."); return; }
        // Definir datas padrão para filtros (ex: último mês)
        const hoje = new Date();
        const fimMesPassado = new Date(hoje.getFullYear(), hoje.getMonth(), 0); // Último dia do mês passado
        const inicioMesPassado = new Date(fimMesPassado.getFullYear(), fimMesPassado.getMonth(), 1);
        periodoInicioEl.valueAsDate = inicioMesPassado;
        periodoFimEl.valueAsDate = fimMesPassado;

        await carregarFuncionariosParaAuditoria();
        console.log("Subaplicação de Auditorias Internas inicializada.");
    }

    initAuditoriasPage();
});

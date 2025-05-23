// js/mapa_ocupacao.js

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuthStatus !== 'function' || typeof supabase === 'undefined') {
        console.error("Supabase client ou auth_global.js não carregados para Mapa de Ocupação.");
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));

    // --- Seletores DOM ---
    const voltarDashboardBtnEl = document.getElementById('voltarDashboardBtnMapa');
    const adminCapacidadeSectionEl = document.getElementById('adminCapacidadeSection');
    const parqueSelectAdminEl = document.getElementById('mapaParqueSelectAdmin');
    const capacidadeCobertosAdminEl = document.getElementById('mapaCapacidadeCobertosAdmin');
    const capacidadeDescobertosAdminEl = document.getElementById('mapaCapacidadeDescobertosAdmin');
    const guardarCapacidadeBtnEl = document.getElementById('mapaGuardarCapacidadeBtn');
    const capacidadeStatusEl = document.getElementById('mapaCapacidadeStatus');

    const parqueSelectEl = document.getElementById('mapaParqueSelect');
    const dataSelectEl = document.getElementById('mapaDataSelect');
    const loadingSpinnerEl = document.getElementById('loadingMapaOcupacaoSpinner');

    const nomeParqueSelecionadoEl = document.getElementById('mapaNomeParqueSelecionado');
    const dataSelecionadaInfoEl = document.getElementById('mapaDataSelecionadaInfo');
    const ocupadosCobertosEl = document.getElementById('mapaOcupadosCobertos');
    const totalCobertosEl = document.getElementById('mapaTotalCobertos');
    const progressCobertosEl = document.getElementById('mapaProgressCobertos');
    const percentCobertosEl = document.getElementById('mapaPercentCobertos');
    const livresCobertosEl = document.getElementById('mapaLivresCobertos');

    const ocupadosDescobertosEl = document.getElementById('mapaOcupadosDescobertos');
    const totalDescobertosEl = document.getElementById('mapaTotalDescobertos');
    const progressDescobertosEl = document.getElementById('mapaProgressDescobertos');
    const percentDescobertosEl = document.getElementById('mapaPercentDescobertos');
    const livresDescobertosEl = document.getElementById('mapaLivresDescobertos');

    const calendarEl = document.getElementById('mapaOcupacaoCalendar');
    let fullCalendarInstance = null;

    // --- Estado da Aplicação ---
    let listaParquesMapa = [];
    let parqueSelecionadoAtual = null; // Objeto do parque com capacidades

    // --- Funções Auxiliares ---
    function mostrarSpinner(show = true) { loadingSpinnerEl.style.display = show ? 'block' : 'none'; }
    function formatarData(dataISO) { return dataISO ? new Date(dataISO).toLocaleDateString('pt-PT', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'; }

    // --- Gestão de Capacidade (Admin) ---
    function verificarPermissaoAdminCapacidade() {
        const rolesPermitidas = ['super_admin', 'admin']; // Ajustar roles
        if (userProfile && rolesPermitidas.includes(userProfile.role)) {
            adminCapacidadeSectionEl.classList.remove('hidden');
            return true;
        }
        adminCapacidadeSectionEl.classList.add('hidden');
        return false;
    }

    parqueSelectAdminEl.addEventListener('change', async function() {
        const parqueId = this.value;
        if (!parqueId) {
            capacidadeCobertosAdminEl.value = '';
            capacidadeDescobertosAdminEl.value = '';
            return;
        }
        const parque = listaParquesMapa.find(p => p.id === parqueId);
        if (parque) {
            capacidadeCobertosAdminEl.value = parque.capacidade_coberto || 0;
            capacidadeDescobertosAdminEl.value = parque.capacidade_descoberto || 0;
        }
    });

    guardarCapacidadeBtnEl.addEventListener('click', async () => {
        const parqueId = parqueSelectAdminEl.value;
        const capacidadeCobertos = parseInt(capacidadeCobertosAdminEl.value);
        const capacidadeDescobertos = parseInt(capacidadeDescobertosAdminEl.value);

        if (!parqueId) {
            capacidadeStatusEl.textContent = "Selecione um parque para atualizar.";
            capacidadeStatusEl.className = 'mt-2 text-sm text-red-600';
            return;
        }
        if (isNaN(capacidadeCobertos) || isNaN(capacidadeDescobertos) || capacidadeCobertos < 0 || capacidadeDescobertos < 0) {
            capacidadeStatusEl.textContent = "Valores de capacidade inválidos.";
            capacidadeStatusEl.className = 'mt-2 text-sm text-red-600';
            return;
        }

        capacidadeStatusEl.textContent = "A guardar capacidade...";
        capacidadeStatusEl.className = 'mt-2 text-sm text-blue-600';

        const { error } = await supabase
            .from('parques')
            .update({
                capacidade_coberto: capacidadeCobertos,
                capacidade_descoberto: capacidadeDescobertos,
                updated_at: new Date().toISOString() // Forçar atualização do timestamp
            })
            .eq('id', parqueId);

        if (error) {
            console.error("Erro ao guardar capacidade:", error);
            capacidadeStatusEl.textContent = `Erro: ${error.message}`;
            capacidadeStatusEl.className = 'mt-2 text-sm text-red-600';
        } else {
            capacidadeStatusEl.textContent = "Capacidade atualizada com sucesso!";
            capacidadeStatusEl.className = 'mt-2 text-sm text-green-600';
            await carregarParquesParaSelects(); // Recarregar dados dos parques
            // Se o parque atualizado for o selecionado para visualização, atualizar o dashboard
            if (parqueSelecionadoAtual && parqueSelecionadoAtual.id === parqueId) {
                parqueSelecionadoAtual.capacidade_coberto = capacidadeCobertos;
                parqueSelecionadoAtual.capacidade_descoberto = capacidadeDescobertos;
                await calcularEAtualizarOcupacaoParaData(dataSelectEl.value || new Date().toISOString().split('T')[0]);
            }
        }
    });


    // --- Carregar Parques para Selects ---
    async function carregarParquesParaSelects() {
        const { data, error } = await supabase.from('parques')
            .select('id, nome, cidade, capacidade_coberto, capacidade_descoberto')
            .order('cidade').order('nome');
        
        if (error) {
            console.error("Erro ao carregar parques:", error);
            parqueSelectEl.innerHTML = '<option value="">Erro ao carregar</option>';
            parqueSelectAdminEl.innerHTML = '<option value="">Erro ao carregar</option>';
            return;
        }
        listaParquesMapa = data || [];
        
        [parqueSelectEl, parqueSelectAdminEl].forEach(select => {
            select.innerHTML = '<option value="">Selecione um Parque</option>';
            listaParquesMapa.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.nome} (${p.cidade || 'N/A'})`;
                select.appendChild(opt);
            });
        });

        // Selecionar o primeiro parque por defeito para visualização (se houver)
        if (listaParquesMapa.length > 0 && parqueSelectEl.value === "") {
            parqueSelectEl.value = listaParquesMapa[0].id;
            parqueSelectEl.dispatchEvent(new Event('change')); // Disparar change para carregar dados
        }
    }

    // --- Lógica do Calendário e Ocupação ---
    function inicializarCalendario() {
        if (!calendarEl) {
            console.error("Elemento do calendário não encontrado.");
            return;
        }
        if (fullCalendarInstance) {
            fullCalendarInstance.destroy();
        }
        fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'pt', // Para português
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            dateClick: async function(info) {
                dataSelectEl.value = info.dateStr; // Atualiza o input de data
                await calcularEAtualizarOcupacaoParaData(info.dateStr);
            },
            datesSet: async function(info) { // Quando a vista do calendário muda (mês/semana/dia)
                // Recalcular e renderizar a ocupação para os dias visíveis
                await renderizarOcupacaoParaRangeVisivel(info.startStr, info.endStr);
            },
            // Para adicionar eventos que mostrem a ocupação em cada dia:
            // events: async function(fetchInfo, successCallback, failureCallback) { ... }
            // Ou dayCellContent, dayCellDidMount para customizar células
            dayCellDidMount: function(info) {
                // Placeholder para adicionar info de ocupação diretamente na célula do dia
                // Ex: info.el.classList.add('ocupacao-media');
                // info.el.innerHTML += '<span class="ocupacao-info-evento ocupacao-coberta">C: 5/10</span>';
            }
        });
        fullCalendarInstance.render();
    }

    async function calcularEAtualizarOcupacaoParaData(dataStr) {
        if (!parqueSelecionadoAtual || !dataStr) {
            limparDashboardOcupacao();
            return;
        }
        mostrarSpinner(true);
        dataSelecionadaInfoEl.textContent = `Data: ${formatarData(dataStr)}`;
        nomeParqueSelecionadoEl.textContent = `Parque: ${parqueSelecionadoAtual.nome}`;

        const dataAlvo = new Date(dataStr);
        const inicioDia = new Date(dataAlvo.setHours(0,0,0,0)).toISOString();
        const fimDia = new Date(dataAlvo.setHours(23,59,59,999)).toISOString();

        // Query para buscar reservas ativas no dia
        // Uma reserva está ativa se:
        // (data_entrada_real OU data_entrada_prevista) <= fimDia E (data_saida_real OU data_saida_prevista) >= inicioDia
        // E estado não é Cancelada/No-Show
        const { data: reservasAtivas, error } = await supabase
            .from('reservas')
            .select('id, tipo_servico, data_entrada_prevista, data_saida_prevista, data_entrada_real, data_saida_real, estado_reserva')
            .eq('parque_id', parqueSelecionadoAtual.id)
            .not('estado_reserva', 'in', '("Cancelada", "No-Show", "Cancelada pelo Cliente", "Cancelada pelo Sistema")') // Ajustar estados
            .or(`data_entrada_real.lte.${fimDia},data_entrada_prevista.lte.${fimDia}`) // Entrada antes ou durante o fim do dia
            .or(`data_saida_real.gte.${inicioDia},data_saida_prevista.gte.${inicioDia}`);   // Saída depois ou durante o início do dia
            // Esta query pode precisar de refinamento para pegar corretamente os overlaps.
            // Idealmente, uma função RPC: get_ocupacao_dia(parque_id, data_alvo)

        if (error) {
            console.error("Erro ao buscar reservas para ocupação:", error);
            limparDashboardOcupacao();
            mostrarSpinner(false);
            return;
        }
        
        let ocupadosCobertos = 0;
        let ocupadosDescobertos = 0;

        (reservasAtivas || []).forEach(res => {
            const entrada = res.data_entrada_real ? new Date(res.data_entrada_real) : new Date(res.data_entrada_prevista);
            const saida = res.data_saida_real ? new Date(res.data_saida_real) : new Date(res.data_saida_prevista);
            const dataAlvoObj = new Date(dataStr); // Para comparação precisa do dia

            // Verificar se a reserva está ativa NAQUELE DIA específico (não apenas se sobrepõe ao dia)
            // A reserva está ativa no dia se a data de entrada for <= dataAlvo E data de saída >= dataAlvo
            // (considerando apenas a parte da data, ignorando horas para ocupação diária)
            const entradaDia = new Date(entrada.getFullYear(), entrada.getMonth(), entrada.getDate());
            const saidaDia = new Date(saida.getFullYear(), saida.getMonth(), saida.getDate());
            const alvoDia = new Date(dataAlvoObj.getFullYear(), dataAlvoObj.getMonth(), dataAlvoObj.getDate());

            if (entradaDia <= alvoDia && saidaDia >= alvoDia) {
                 // Assumindo que 'tipo_servico' na reserva indica se é coberto ou descoberto
                 // Ou se o parque só tem um tipo, ou se a reserva não especifica, contar para um default.
                 // Exemplo:
                if (String(res.tipo_servico).toLowerCase().includes('coberto')) {
                    ocupadosCobertos++;
                } else if (String(res.tipo_servico).toLowerCase().includes('descoberto')) {
                    ocupadosDescobertos++;
                } else {
                    // Se não especificado, e o parque tem ambos, onde contamos?
                    // Por agora, se o parque tem lugares cobertos, assume-se coberto por defeito, senão descoberto.
                    if (parqueSelecionadoAtual.capacidade_coberto > 0) ocupadosCobertos++;
                    else ocupadosDescobertos++;
                }
            }
        });

        atualizarUIDashboardOcupacao(ocupadosCobertos, ocupadosDescobertos);
        mostrarSpinner(false);
    }
    
    async function renderizarOcupacaoParaRangeVisivel(dataInicioRange, dataFimRange) {
        if (!parqueSelecionadoAtual || !fullCalendarInstance) return;
        console.log(`Renderizando ocupação para o range: ${dataInicioRange} a ${dataFimRange} do parque ${parqueSelecionadoAtual.nome}`);
        
        // TODO: Otimizar esta parte. Chamar uma RPC que retorne a ocupação diária para o range.
        // get_ocupacao_range(parque_id, data_inicio_range, data_fim_range)
        // A RPC retornaria [{ data: 'YYYY-MM-DD', ocup_cobertos: X, ocup_descobertos: Y }, ...]
        
        // Simulação de como os eventos poderiam ser adicionados ao calendário
        // Esta é uma forma SIMPLIFICADA e NÃO OTIMIZADA.
        // Idealmente, a RPC traria os dados agregados.
        
        // Limpar eventos antigos do calendário
        fullCalendarInstance.removeAllEvents(); 
        
        const { data: reservasRange, error } = await supabase
            .from('reservas')
            .select('id, tipo_servico, data_entrada_prevista, data_saida_prevista, data_entrada_real, data_saida_real, estado_reserva')
            .eq('parque_id', parqueSelecionadoAtual.id)
            .not('estado_reserva', 'in', '("Cancelada", "No-Show")')
            .gte('data_saida_prevista', dataInicioRange) // Reservas que terminam depois do início do range
            .lte('data_entrada_prevista', dataFimRange); // Reservas que começam antes do fim do range
            // Esta query ainda precisa ser melhorada para pegar todos os overlaps corretamente.

        if(error) { console.error("Erro ao buscar reservas para o range do calendário", error); return; }

        const ocupacaoDiaria = {}; // { 'YYYY-MM-DD': {cobertos: X, descobertos: Y} }

        (reservasRange || []).forEach(res => {
            const entrada = res.data_entrada_real ? new Date(res.data_entrada_real) : new Date(res.data_entrada_prevista);
            const saida = res.data_saida_real ? new Date(res.data_saida_real) : new Date(res.data_saida_prevista);
            
            let currentDate = new Date(entrada);
            while(currentDate <= saida) {
                const dateStr = currentDate.toISOString().split('T')[0];
                if (!ocupacaoDiaria[dateStr]) ocupacaoDiaria[dateStr] = {cobertos: 0, descobertos: 0};

                if (String(res.tipo_servico).toLowerCase().includes('coberto')) {
                    ocupacaoDiaria[dateStr].cobertos++;
                } else { // Assumir descoberto se não for coberto
                    ocupacaoDiaria[dateStr].descobertos++;
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
        });
        
        // Adicionar "eventos" ou classes às células do FullCalendar
        // Esta parte é mais complexa e depende de como se quer visualizar.
        // Uma forma é usar o `dayCellDidMount` ou `events` para adicionar pequenos indicadores.
        const calendarEvents = [];
        for (const dateKey in ocupacaoDiaria) {
            const ocup = ocupacaoDiaria[dateKey];
            const totalOcupados = ocup.cobertos + ocup.descobertos;
            const totalCapacidade = (parqueSelecionadoAtual.capacidade_coberto || 0) + (parqueSelecionadoAtual.capacidade_descoberto || 0);
            let classeOcupacao = 'ocupacao-baixa';
            if (totalCapacidade > 0) {
                const perc = (totalOcupados / totalCapacidade) * 100;
                if (perc > 90) classeOcupacao = 'ocupacao-cheio';
                else if (perc > 70) classeOcupacao = 'ocupacao-alta';
                else if (perc > 40) classeOcupacao = 'ocupacao-media';
            }
            
            // Adicionar eventos para mostrar na célula (exemplo muito básico)
            // fullCalendarInstance.addEvent({ title: `C:${ocup.cobertos}`, start: dateKey, allDay: true, classNames: ['ocupacao-info-evento', 'ocupacao-coberta'] });
            // fullCalendarInstance.addEvent({ title: `D:${ocup.descobertos}`, start: dateKey, allDay: true, classNames: ['ocupacao-info-evento', 'ocupacao-descoberta'] });
            
            // Para colorir o dia, precisaria de manipular o DOM da célula ou usar funcionalidades do FullCalendar
            // Exemplo com dayCellDidMount (já no init, mas aqui seria onde se aplicaria a classe com base em `ocupacaoDiaria`)
        }
         fullCalendarInstance.refetchEvents(); // Se estiver a usar a propriedade `events`
         // Se estiver a usar dayCellDidMount, precisaria de uma forma de forçar o re-render dos dias,
         // ou guardar os dados de ocupação e aceder a eles no dayCellDidMount.
    }


    function limparDashboardOcupacao() {
        ocupadosCobertosEl.textContent = '0';
        totalCobertosEl.textContent = '0';
        progressCobertosEl.style.width = '0%';
        percentCobertosEl.textContent = '0';
        livresCobertosEl.textContent = '0';
        ocupadosDescobertosEl.textContent = '0';
        totalDescobertosEl.textContent = '0';
        progressDescobertosEl.style.width = '0%';
        percentDescobertosEl.textContent = '0';
        livresDescobertosEl.textContent = '0';
    }

    function atualizarUIDashboardOcupacao(ocupadosC, ocupadosD) {
        const capCobertos = parqueSelecionadoAtual?.capacidade_coberto || 0;
        const capDescobertos = parqueSelecionadoAtual?.capacidade_descoberto || 0;

        ocupadosCobertosEl.textContent = ocupadosC;
        totalCobertosEl.textContent = capCobertos;
        const percC = capCobertos > 0 ? Math.round((ocupadosC / capCobertos) * 100) : 0;
        progressCobertosEl.style.width = `${percC}%`;
        percentCobertosEl.textContent = percC;
        livresCobertosEl.textContent = Math.max(0, capCobertos - ocupadosC);

        ocupadosDescobertosEl.textContent = ocupadosD;
        totalDescobertosEl.textContent = capDescobertos;
        const percD = capDescobertos > 0 ? Math.round((ocupadosD / capDescobertos) * 100) : 0;
        progressDescobertosEl.style.width = `${percD}%`;
        percentDescobertosEl.textContent = percD;
        livresDescobertosEl.textContent = Math.max(0, capDescobertos - ocupadosD);
    }

    // --- Event Listeners ---
    if (voltarDashboardBtnEl) voltarDashboardBtnEl.addEventListener('click', () => { window.location.href = 'index.html'; });
    
    parqueSelectEl.addEventListener('change', async function() {
        const parqueId = this.value;
        parqueSelecionadoAtual = listaParquesMapa.find(p => p.id === parqueId);
        if (parqueSelecionadoAtual) {
            await calcularEAtualizarOcupacaoParaData(dataSelectEl.value || new Date().toISOString().split('T')[0]);
            if (fullCalendarInstance) { // Forçar o calendário a recarregar os dados para o novo parque
                const view = fullCalendarInstance.view;
                await renderizarOcupacaoParaRangeVisivel(view.activeStart.toISOString().split('T')[0], view.activeEnd.toISOString().split('T')[0]);
            }
        } else {
            limparDashboardOcupacao();
        }
    });

    dataSelectEl.addEventListener('change', async function() {
        if (parqueSelecionadoAtual && this.value) {
            await calcularEAtualizarOcupacaoParaData(this.value);
        }
    });

    // --- Inicialização da Página ---
    async function initMapaOcupacaoPage() {
        if (!userProfile) { alert("Perfil não carregado."); return; }
        verificarPermissaoAdminCapacidade();
        await carregarParquesParaSelects(); // Isto vai popular os selects e disparar o primeiro load de dados
        
        dataSelectEl.value = new Date().toISOString().split('T')[0]; // Data de hoje por defeito
        inicializarCalendario();
        
        // A primeira carga de dados para o parque default e data default já é feita pelo 'change' do parqueSelectEl
        // ou pode ser chamada explicitamente aqui se necessário.
        if (parqueSelectEl.value) { // Se um parque foi selecionado por defeito
             await calcularEAtualizarOcupacaoParaData(dataSelectEl.value);
             const view = fullCalendarInstance.view;
             if(view.activeStart && view.activeEnd) { // Garantir que a vista do calendário está pronta
                await renderizarOcupacaoParaRangeVisivel(view.activeStart.toISOString().split('T')[0], view.activeEnd.toISOString().split('T')[0]);
             }
        }

        console.log("Subaplicação Mapa de Ocupação inicializada.");
    }

    initMapaOcupacaoPage();
});

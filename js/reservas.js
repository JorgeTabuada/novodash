// js/reservas.js - Lógica para a Subaplicação de Gestão de Reservas

document.addEventListener("DOMContentLoaded", async () => {
    // --- Verificação de Cliente Supabase ---
    if (typeof window.getSupabaseClient !== 'function') {
        console.error("ERRO CRÍTICO: getSupabaseClient não está definido. Verifique a inicialização no HTML.");
        alert("Erro crítico na configuração da aplicação (Reservas). Contacte o suporte.");
        document.querySelectorAll('.action-button').forEach(btn => btn.disabled = true);
        return;
    }
    const supabase = window.getSupabaseClient();
    if (!supabase) {
        console.error("ERRO CRÍTICO: Cliente Supabase não disponível (Reservas).");
        alert("Erro crítico ao conectar com o sistema (Reservas). Contacte o suporte.");
        document.querySelectorAll('.action-button').forEach(btn => btn.disabled = true);
        return;
    }

    let currentUser = null;
    let userProfile = null;

    // --- Seletores de Elementos DOM ---
    const fileImportacaoEl = document.getElementById("fileImportacao");
    const fileImportacaoLabelEl = document.getElementById("fileImportacaoLabel");
    const btnProcessarFicheiroEl = document.getElementById("btnProcessarFicheiro");
    const importacaoStatusEl = document.getElementById("importacaoStatus");

    const dataInicioEl = document.getElementById("dataInicio");
    const dataFimEl = document.getElementById("dataFim");
    const periodoRapidoEl = document.getElementById("periodoRapido");
    const btnAnalisarEl = document.getElementById("btnAnalisar");

    const totalReservasEl = document.getElementById("totalReservas");
    const totalReservasComparacaoEl = document.getElementById("totalReservasComparacao");
    const valorTotalEstimadoEl = document.getElementById("valorTotalEstimado");
    const valorTotalEstimadoComparacaoEl = document.getElementById("valorTotalEstimadoComparacao");
    const reservasPorCampanhaEl = document.getElementById("reservasPorCampanha");
    const reservasPorDiaSemanaEl = document.getElementById("reservasPorDiaSemana");
    const dataReservasPorHoraEl = document.getElementById("dataReservasPorHora");
    
    const graficoReservasPorHoraEl = document.getElementById("graficoReservasPorHora");
    const graficoDistribuicaoMensalEl = document.getElementById("graficoDistribuicaoMensal");

    const pesquisaReservaEl = document.getElementById("pesquisaReserva");
    const btnExportarReservasEl = document.getElementById("btnExportarReservas");
    const tabelaReservasEl = document.getElementById("tabelaReservas");
    const totalRegistrosEl = document.getElementById("totalRegistros");
    const btnPaginaAnteriorEl = document.getElementById("btnPaginaAnterior");
    const paginaAtualEl = document.getElementById("paginaAtual");
    const btnProximaPaginaEl = document.getElementById("btnProximaPagina");

    const modalDetalhesReservaEl = document.getElementById("modalDetalhesReserva");
    const btnFecharModalEl = document.getElementById("btnFecharModal");
    const conteudoDetalhesReservaEl = document.getElementById("conteudoDetalhesReserva");
    const btnCancelarReservaEl = document.getElementById("btnCancelarReserva");
    const btnEditarReservaEl = document.getElementById("btnEditarReserva");
    const btnFecharDetalhesEl = document.getElementById("btnFecharDetalhes");

    const modalEditarReservaEl = document.getElementById("modalEditarReserva");
    const btnFecharModalEdicaoEl = document.getElementById("btnFecharModalEdicao");
    const formEditarReservaEl = document.getElementById("formEditarReserva");
    const editReservaIdEl = document.getElementById("editReservaId");
    const btnCancelarEdicaoEl = document.getElementById("btnCancelarEdicao");

    const btnVoltarDashboardEl = document.getElementById("btnVoltarDashboard");

    // --- Estado da Aplicação ---
    let todasAsReservasGeral = []; 
    let paginaAtualLista = 1;
    const itensPorPaginaLista = 15;
    let totalReservasNaBD = 0;
    let graficoReservasHora, graficoReservasMensal;

    // --- Funções Utilitárias ---
    function formatarDataHora(dataISO) {
        if (!dataISO) return "N/A";
        try {
            return new Date(dataISO).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
        } catch (e) { return dataISO; }
    }
    
    function formatarDataParaInput(dataISO) {
        if (!dataISO) return "";
        try {
            const d = new Date(dataISO);
            // Formato YYYY-MM-DDTHH:MM
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (e) { return ""; }
    }
    
    function formatarMoeda(valor) {
        if (valor === null || valor === undefined || isNaN(parseFloat(valor))) return "0,00 €";
        return parseFloat(valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
    }
    
    function mostrarSpinner(elementId) { 
        const el = document.getElementById(elementId);
        if (el) el.classList.remove("hidden"); 
    }
    
    function esconderSpinner(elementId) { 
        const el = document.getElementById(elementId);
        if (el) el.classList.add("hidden");
    }
    
    // Função para normalizar matrículas
    function normalizarMatricula(matricula) {
        if (!matricula) return "";
        
        // Remove espaços, hífens e converte para maiúsculas
        let normalizada = matricula.toString().toUpperCase().replace(/[\s\-]/g, "");
        
        // Formato padrão português: XX-XX-XX ou XX-XX-XX
        if (/^[A-Z0-9]{2,}[A-Z0-9]{2,}[A-Z0-9]{2,}$/.test(normalizada)) {
            // Adiciona hífens se não existirem
            if (normalizada.length === 6) {
                normalizada = normalizada.substring(0, 2) + "-" + 
                             normalizada.substring(2, 4) + "-" + 
                             normalizada.substring(4, 6);
            } else if (normalizada.length >= 8) {
                // Para matrículas mais recentes ou estrangeiras, tenta formatar se possível
                normalizada = normalizada.substring(0, 2) + "-" + 
                             normalizada.substring(2, 4) + "-" + 
                             normalizada.substring(4, 6);
            }
        }
        
        return normalizada;
    }
    
    // --- Lógica de Carregamento de Reservas (READ) ---
    async function carregarReservasDaLista(pagina = 1, filtros = {}) {
        if (!tabelaReservasEl) {
            console.error("Elemento da tabela de reservas (tbody) não encontrado.");
            return;
        }
        
        tabelaReservasEl.innerHTML = "<tr><td colspan='7' class='py-4 text-center text-gray-500'>Carregando reservas...</td></tr>"; 

        const rangeFrom = (pagina - 1) * itensPorPaginaLista;
        const rangeTo = rangeFrom + itensPorPaginaLista - 1;

        let query = supabase.from("reservas").select("*", { count: "exact" });

        if (filtros.searchTerm) {
            query = query.or(`nome_cliente.ilike.%${filtros.searchTerm}%,matricula.ilike.%${filtros.searchTerm}%,booking_id.ilike.%${filtros.searchTerm}%,alocation.ilike.%${filtros.searchTerm}%`);
        }
        if (filtros.estado_reserva && filtros.estado_reserva !== "" && filtros.estado_reserva !== "Todos") {
            query = query.eq("estado_reserva", filtros.estado_reserva);
        }
        if (filtros.data_entrada_prevista) {
            query = query.gte("check_in_datetime", filtros.data_entrada_prevista + "T00:00:00");
        }
        if (filtros.cliente) {
            query = query.ilike("nome_cliente", `%${filtros.cliente}%`);
        }
        if (filtros.matricula) {
             query = query.ilike("matricula", `%${filtros.matricula}%`);
        }

        // Correção: usar created_at_db em vez de created_at
        query = query.order("created_at_db", { ascending: false }).range(rangeFrom, rangeTo);

        try {
            const { data, error, count } = await query;

            if (error) throw error;

            todasAsReservasGeral = data; // Atualiza o cache local com os dados da página atual
            totalReservasNaBD = count;    // Total de registos que correspondem aos filtros

            if (data && data.length > 0) {
                tabelaReservasEl.innerHTML = "";
                data.forEach(reserva => {
                    const tr = document.createElement("tr");
                    tr.className = "border-b hover:bg-gray-50";
                    // Ajustar para usar os nomes corretos das colunas do Supabase
                    tr.innerHTML = `
                        <td class="py-3 px-4 text-xs">${reserva.booking_id || "N/A"}</td>
                        <td class="py-3 px-4 text-xs">${formatarDataHora(reserva.data_reserva)}</td>
                        <td class="py-3 px-4 text-xs">${reserva.nome_cliente || "N/A"}</td>
                        <td class="py-3 px-4 text-xs">${reserva.matricula || "N/A"}</td>
                        <td class="py-3 px-4 text-xs">${reserva.alocation || "N/A"}</td>
                        <td class="py-3 px-4 text-xs">${formatarDataHora(reserva.check_in_datetime)}</td>
                        <td class="py-3 px-4 text-xs">${formatarDataHora(reserva.check_out_datetime)}</td>
                        <td class="py-3 px-4 text-xs">${reserva.physical_park_name || reserva.parque_id || "N/A"}</td>
                        <td class="py-3 px-4 text-xs text-right">${formatarMoeda(reserva.total_price)}</td>
                        <td class="py-3 px-4 text-xs"><span class="px-2 py-1 text-xs font-semibold rounded-full ${getEstadoClass(reserva.estado_reserva)}">${reserva.estado_reserva || "N/A"}</span></td>
                        <td class="py-3 px-4 text-xs">
                            <button class="text-blue-600 hover:text-blue-800 editar-reserva-btn" data-id="${reserva.id}">Editar</button>
                            <button class="text-red-600 hover:text-red-800 apagar-reserva-btn ml-2" data-id="${reserva.id}">Apagar</button>
                            <button class="text-gray-600 hover:text-gray-800 log-reserva-btn ml-2" data-booking-id="${reserva.booking_id || reserva.id}" data-reserva-pk="${reserva.id}">Hist.</button>
                        </td>
                    `;
                    tabelaReservasEl.appendChild(tr);
                });
                configurarBotoesAcao();
                
                if (totalRegistrosEl) {
                    totalRegistrosEl.textContent = count;
                }
                
                atualizarPaginacao(pagina, count);
            } else {
                tabelaReservasEl.innerHTML = "<tr><td colspan='7' class='py-4 text-center text-gray-500'>Nenhuma reserva encontrada com os filtros atuais.</td></tr>";
                if (totalRegistrosEl) {
                    totalRegistrosEl.textContent = "0";
                }
            }
            
            atualizarEstatisticas();
        } catch (error) {
            console.error("Erro ao carregar reservas:", error);
            tabelaReservasEl.innerHTML = "<tr><td colspan='7' class='py-4 text-center text-red-500'>Erro ao carregar dados. Tente novamente.</td></tr>";
        }
    }
    
    function getEstadoClass(estado) {
        // Função auxiliar para classes de cor do estado
        switch (String(estado).toLowerCase()) {
            case 'confirmada': return 'bg-green-100 text-green-700';
            case 'pendente': return 'bg-yellow-100 text-yellow-700';
            case 'cancelada': return 'bg-red-100 text-red-700';
            case 'concluída': case 'validadafinanceiramente': return 'bg-blue-100 text-blue-700';
            case 'em curso': return 'bg-indigo-100 text-indigo-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    }

    // --- Lógica de Paginação ---
    function atualizarPaginacao(paginaCorrente, totalItens) {
        if (!btnPaginaAnteriorEl || !paginaAtualEl || !btnProximaPaginaEl) return;
        
        const totalPaginas = Math.ceil(totalItens / itensPorPaginaLista);
        
        btnPaginaAnteriorEl.disabled = paginaCorrente <= 1;
        btnProximaPaginaEl.disabled = paginaCorrente >= totalPaginas;
        
        paginaAtualEl.textContent = `Página ${paginaCorrente} de ${totalPaginas || 1}`;
        
        btnPaginaAnteriorEl.onclick = () => {
            if (paginaCorrente > 1) {
                carregarReservasDaLista(paginaCorrente - 1, obterFiltrosAtuais());
            }
        };
        
        btnProximaPaginaEl.onclick = () => {
            if (paginaCorrente < totalPaginas) {
                carregarReservasDaLista(paginaCorrente + 1, obterFiltrosAtuais());
            }
        };
    }
    
    function obterFiltrosAtuais() {
        const filtros = {};
        if (pesquisaReservaEl && pesquisaReservaEl.value) {
            filtros.searchTerm = pesquisaReservaEl.value.trim();
        }
        return filtros;
    }

    // --- Lógica de Processamento de Ficheiros Excel ---
    function processarFicheiroImportacao() {
        if (!fileImportacaoEl || !fileImportacaoEl.files || fileImportacaoEl.files.length === 0) {
            if (importacaoStatusEl) {
                importacaoStatusEl.textContent = "Por favor, selecione um ficheiro para importar.";
            }
            return;
        }

        const file = fileImportacaoEl.files[0];
        if (importacaoStatusEl) {
            importacaoStatusEl.textContent = `A processar ficheiro: ${file.name}`;
        }

        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    if (importacaoStatusEl) {
                        importacaoStatusEl.textContent = "O ficheiro não contém dados.";
                    }
                    return;
                }

                // Mapear dados do Excel para o formato da tabela reservas
                let reservasParaUpsert = jsonData.map(row => {
                    // Normalizar matrícula
                    const matriculaNormalizada = normalizarMatricula(row.matricula || row.Matricula || row.MATRICULA);
                    
                    // Criar objeto com os campos necessários
                    const reserva = {
                        matricula: matriculaNormalizada,
                        nome_cliente: row.nome_cliente || row.Nome || row["Nome Cliente"] || "",
                        email_cliente: row.email_cliente || row.Email || row["Email Cliente"] || "",
                        telefone_cliente: row.telefone_cliente || row.Telefone || row["Telefone Cliente"] || "",
                        check_in_datetime: row.check_in_datetime || row["Data Entrada"] || row["Check-in"] || null,
                        check_out_datetime: row.check_out_datetime || row["Data Saída"] || row["Check-out"] || null,
                        estado_reserva: row.estado_reserva || row.Estado || "pendente",
                        total_price: row.total_price || row.Valor || row.Preço || 0,
                        alocation: row.alocation || row.Alocação || row.Localização || "",
                        campaign_name: row.campaign_name || row.Campanha || "",
                        observacoes: row.observacoes || row.Observações || row.Notas || "",
                        is_imported: true,
                        last_update_source: "importação excel"
                    };
                    
                    // Verificar se booking_id existe, se não, gerar um
                    if (!row.booking_id && !row["ID Reserva"]) {
                        // Gerar um ID baseado na matrícula e data
                        const timestamp = new Date().getTime();
                        const randomPart = Math.floor(Math.random() * 10000);
                        reserva.booking_id = `RES-${matriculaNormalizada || 'NOPLATE'}-${timestamp}-${randomPart}`;
                    } else {
                        reserva.booking_id = row.booking_id || row["ID Reserva"];
                    }
                    
                    return reserva;
                });

                console.log("Reservas para Upsert:", reservasParaUpsert);

                // Inserir ou atualizar no Supabase
                const { data, error } = await supabase
                    .from('reservas')
                    .upsert(reservasParaUpsert, {
                        onConflict: 'matricula,check_in_datetime',
                        returning: 'minimal'
                    });

                if (error) throw error;

                if (importacaoStatusEl) {
                    importacaoStatusEl.textContent = `Importação concluída com sucesso! ${reservasParaUpsert.length} reservas processadas.`;
                    importacaoStatusEl.classList.remove("text-red-500");
                    importacaoStatusEl.classList.add("text-green-500");
                }

                // Recarregar a lista de reservas
                carregarReservasDaLista(1);
                
                // Limpar o campo de ficheiro
                fileImportacaoEl.value = "";
                if (fileImportacaoLabelEl) {
                    fileImportacaoLabelEl.textContent = "Escolher Ficheiro";
                }

            } catch (error) {
                console.error("Erro ao processar o ficheiro Excel:", error);
                if (importacaoStatusEl) {
                    importacaoStatusEl.textContent = `Erro ao processar o ficheiro: ${error.message || "Verifique o formato do ficheiro."}`;
                    importacaoStatusEl.classList.remove("text-green-500");
                    importacaoStatusEl.classList.add("text-red-500");
                }
            }
        };
        reader.onerror = function() {
            if (importacaoStatusEl) {
                importacaoStatusEl.textContent = "Erro ao ler o ficheiro.";
                importacaoStatusEl.classList.remove("text-green-500");
                importacaoStatusEl.classList.add("text-red-500");
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // --- Lógica de Estatísticas e Dashboard ---
    async function atualizarEstatisticas() {
        // Atualizar estatísticas básicas
        if (totalReservasEl) {
            totalReservasEl.textContent = totalReservasNaBD.toString();
        }
        
        // Calcular valor total estimado
        if (valorTotalEstimadoEl && todasAsReservasGeral.length > 0) {
            const valorTotal = todasAsReservasGeral.reduce((sum, reserva) => {
                return sum + (parseFloat(reserva.total_price) || 0);
            }, 0);
            valorTotalEstimadoEl.textContent = formatarMoeda(valorTotal);
        }
        
        // Inicializar gráficos se necessário
        inicializarGraficos();
    }
    
    function inicializarGraficos() {
        // Inicializar gráfico de distribuição mensal se o elemento existir
        if (graficoDistribuicaoMensalEl && !graficoReservasMensal) {
            const ctx = graficoDistribuicaoMensalEl.getContext('2d');
            graficoReservasMensal = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
                    datasets: [{
                        label: 'Reservas por Mês',
                        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            });
        }
        
        // Inicializar gráfico de reservas por hora se o elemento existir
        if (graficoReservasPorHoraEl && !graficoReservasHora) {
            const ctx = graficoReservasPorHoraEl.getContext('2d');
            graficoReservasHora = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                    datasets: [{
                        label: 'Reservas por Hora',
                        data: Array(24).fill(0),
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            });
        }
    }
    
    // Função para carregar reservas por hora em um dia específico
    async function carregarReservasPorHora(data) {
        try {
            // Formato da data: YYYY-MM-DD
            const dataInicio = `${data}T00:00:00`;
            const dataFim = `${data}T23:59:59.999Z`;
            
            // Buscar todas as reservas do dia
            const { data: reservas, error } = await supabase
                .from('reservas')
                .select('*')
                .gte('check_in_datetime', dataInicio)
                .lte('check_in_datetime', dataFim);
                
            if (error) throw error;
            
            // Agrupar por hora
            const reservasPorHora = Array(24).fill(0);
            
            if (reservas && reservas.length > 0) {
                reservas.forEach(reserva => {
                    if (reserva.check_in_datetime) {
                        const hora = new Date(reserva.check_in_datetime).getHours();
                        reservasPorHora[hora]++;
                    }
                });
            }
            
            // Atualizar o gráfico
            if (graficoReservasHora) {
                graficoReservasHora.data.datasets[0].data = reservasPorHora;
                graficoReservasHora.update();
            }
            
            return {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                data: reservasPorHora
            };
        } catch (error) {
            console.error("Erro ao carregar reservas por hora:", error);
            return { labels: [], data: [] };
        }
    }

    // --- Configuração de Eventos ---
    function configurarEventos() {
        // Evento para o botão de voltar ao dashboard
        if (btnVoltarDashboardEl) {
            btnVoltarDashboardEl.addEventListener("click", () => {
                window.location.href = "index.html";
            });
        }
        
        // Eventos para importação de ficheiros
        if (fileImportacaoEl) {
            fileImportacaoEl.addEventListener("change", () => {
                if (fileImportacaoEl.files.length > 0 && fileImportacaoLabelEl) {
                    fileImportacaoLabelEl.textContent = fileImportacaoEl.files[0].name;
                }
            });
        }
        
        if (btnProcessarFicheiroEl) {
            btnProcessarFicheiroEl.addEventListener("click", processarFicheiroImportacao);
        }
        
        // Eventos para filtros e pesquisa
        if (pesquisaReservaEl) {
            pesquisaReservaEl.addEventListener("keyup", (e) => {
                if (e.key === "Enter") {
                    carregarReservasDaLista(1, obterFiltrosAtuais());
                }
            });
        }
        
        // Eventos para o datepicker de reservas por hora
        if (dataReservasPorHoraEl) {
            // Inicializar flatpickr
            flatpickr(dataReservasPorHoraEl, {
                dateFormat: "d/m/Y",
                locale: "pt",
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        const dataFormatada = selectedDates[0].toISOString().split('T')[0];
                        carregarReservasPorHora(dataFormatada);
                    }
                }
            });
            
            // Definir data atual como padrão
            const hoje = new Date();
            const diaFormatado = hoje.getDate().toString().padStart(2, '0');
            const mesFormatado = (hoje.getMonth() + 1).toString().padStart(2, '0');
            const anoFormatado = hoje.getFullYear();
            dataReservasPorHoraEl.value = `${diaFormatado}/${mesFormatado}/${anoFormatado}`;
            
            // Carregar dados iniciais
            carregarReservasPorHora(hoje.toISOString().split('T')[0]);
        }
        
        // Eventos para análise de período
        if (btnAnalisarEl) {
            btnAnalisarEl.addEventListener("click", () => {
                let dataInicio, dataFim;
                
                if (periodoRapidoEl && periodoRapidoEl.value) {
                    const hoje = new Date();
                    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
                    
                    switch (periodoRapidoEl.value) {
                        case "este_mes":
                            dataInicio = primeiroDiaMes;
                            dataFim = ultimoDiaMes;
                            break;
                        case "mes_anterior":
                            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                            dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                            break;
                        case "ultimos_7_dias":
                            dataInicio = new Date(hoje);
                            dataInicio.setDate(hoje.getDate() - 7);
                            dataFim = hoje;
                            break;
                        case "ultimos_30_dias":
                            dataInicio = new Date(hoje);
                            dataInicio.setDate(hoje.getDate() - 30);
                            dataFim = hoje;
                            break;
                        case "este_ano":
                            dataInicio = new Date(hoje.getFullYear(), 0, 1);
                            dataFim = new Date(hoje.getFullYear(), 11, 31);
                            break;
                    }
                    
                    // Atualizar campos de data se existirem
                    if (dataInicioEl) {
                        dataInicioEl.value = `${dataInicio.getDate().toString().padStart(2, '0')}/${(dataInicio.getMonth() + 1).toString().padStart(2, '0')}/${dataInicio.getFullYear()}`;
                    }
                    if (dataFimEl) {
                        dataFimEl.value = `${dataFim.getDate().toString().padStart(2, '0')}/${(dataFim.getMonth() + 1).toString().padStart(2, '0')}/${dataFim.getFullYear()}`;
                    }
                } else {
                    // Usar datas dos inputs se disponíveis
                    if (dataInicioEl && dataInicioEl.value) {
                        const partes = dataInicioEl.value.split('/');
                        if (partes.length === 3) {
                            dataInicio = new Date(partes[2], partes[1] - 1, partes[0]);
                        }
                    }
                    if (dataFimEl && dataFimEl.value) {
                        const partes = dataFimEl.value.split('/');
                        if (partes.length === 3) {
                            dataFim = new Date(partes[2], partes[1] - 1, partes[0]);
                        }
                    }
                }
                
                if (dataInicio && dataFim) {
                    console.log(`Analisando período: ${dataInicio.toISOString().split('T')[0]} a ${dataFim.toISOString().split('T')[0]}`);
                    carregarEstatisticasDashboardFiltradas(dataInicio, dataFim);
                }
            });
        }
        
        // Inicializar datepickers para filtros de data
        if (dataInicioEl && dataFimEl) {
            flatpickr(dataInicioEl, {
                dateFormat: "d/m/Y",
                locale: "pt"
            });
            
            flatpickr(dataFimEl, {
                dateFormat: "d/m/Y",
                locale: "pt"
            });
        }
        
        // Evento para exportar reservas
        if (btnExportarReservasEl) {
            btnExportarReservasEl.addEventListener("click", exportarReservas);
        }
    }
    
    function configurarBotoesAcao() {
        // Configurar botões de editar
        document.querySelectorAll('.editar-reserva-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const reservaId = btn.getAttribute('data-id');
                const reserva = todasAsReservasGeral.find(r => r.id === reservaId);
                if (reserva) {
                    abrirModalEdicao(reserva);
                }
            });
        });
        
        // Configurar botões de apagar
        document.querySelectorAll('.apagar-reserva-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm("Tem certeza que deseja apagar esta reserva?")) {
                    const reservaId = btn.getAttribute('data-id');
                    await apagarReserva(reservaId);
                }
            });
        });
    }
    
    // --- Funções de Exportação ---
    function exportarReservas() {
        if (todasAsReservasGeral.length === 0) {
            alert("Não há reservas para exportar.");
            return;
        }
        
        // Criar uma worksheet
        const ws = XLSX.utils.json_to_sheet(todasAsReservasGeral);
        
        // Criar um workbook e adicionar a worksheet
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reservas");
        
        // Gerar o arquivo Excel
        const hoje = new Date();
        const dataFormatada = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, '0')}-${hoje.getDate().toString().padStart(2, '0')}`;
        XLSX.writeFile(wb, `reservas_${dataFormatada}.xlsx`);
    }
    
    // --- Funções de Modal ---
    function abrirModalEdicao(reserva) {
        if (!modalEditarReservaEl || !editReservaIdEl) return;
        
        // Preencher o formulário com os dados da reserva
        editReservaIdEl.value = reserva.id;
        
        if (document.getElementById("editMatricula")) {
            document.getElementById("editMatricula").value = reserva.matricula || "";
        }
        if (document.getElementById("editNomeCliente")) {
            document.getElementById("editNomeCliente").value = reserva.nome_cliente || "";
        }
        if (document.getElementById("editDataEntrada")) {
            document.getElementById("editDataEntrada").value = formatarDataParaInput(reserva.check_in_datetime);
        }
        if (document.getElementById("editDataSaida")) {
            document.getElementById("editDataSaida").value = formatarDataParaInput(reserva.check_out_datetime);
        }
        if (document.getElementById("editValor")) {
            document.getElementById("editValor").value = reserva.total_price || "";
        }
        if (document.getElementById("editEstado")) {
            document.getElementById("editEstado").value = reserva.estado_reserva || "pendente";
        }
        if (document.getElementById("editCampanha")) {
            document.getElementById("editCampanha").value = reserva.campaign_name || "";
        }
        if (document.getElementById("editObservacoes")) {
            document.getElementById("editObservacoes").value = reserva.observacoes || "";
        }
        
        // Mostrar o modal
        modalEditarReservaEl.classList.remove("hidden");
    }
    
    // --- Funções de CRUD ---
    async function apagarReserva(id) {
        try {
            const { error } = await supabase
                .from('reservas')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            
            // Recarregar a lista após apagar
            carregarReservasDaLista(paginaAtualLista, obterFiltrosAtuais());
            
            alert("Reserva apagada com sucesso!");
        } catch (error) {
            console.error("Erro ao apagar reserva:", error);
            alert(`Erro ao apagar reserva: ${error.message}`);
        }
    }
    
    // --- Inicialização da Página ---
    async function initReservasPage() {
        console.log("reservas.js: Iniciando initReservasPage...");
        
        // Verificar autenticação
        try {
            await window.checkAuthStatus();
            console.log("reservas.js: Autenticação verificada.");
        } catch (error) {
            console.error("Erro ao verificar autenticação:", error);
            return;
        }
        
        // Configurar eventos
        configurarEventos();
        
        // Carregar dados iniciais
        carregarReservasDaLista(1);
        
        console.log("Subaplicação Reservas Inicializada!");
    }
    
    // Iniciar a página com um pequeno delay para garantir que auth_global.js foi carregado
    setTimeout(() => {
        initReservasPage();
    }, 100);
});

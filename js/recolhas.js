// js/recolhas.js - Lógica para a Subaplicação de Gestão de Recolhas

document.addEventListener("DOMContentLoaded", () => {
    // --- Autenticação e Inicialização ---
    if (typeof checkAuthStatus !== "function" || typeof supabase === "undefined") {
        console.error("Supabase client ou auth_global.js não carregados corretamente para Recolhas.");
        // Idealmente, auth_global.js já teria redirecionado se não houvesse sessão.
        // window.location.href = "/index.html"; // Fallback
        return;
    }
    checkAuthStatus();

    const currentUser = supabase.auth.user();
    const userProfile = JSON.parse(localStorage.getItem("userProfile"));

    // --- Seletores de Elementos DOM ---
    const importRecolhasFileEl = document.getElementById("importRecolhasFile");
    const recProcessarImportacaoBtnEl = document.getElementById("recProcessarImportacaoBtn");
    const importacaoRecolhasStatusEl = document.getElementById("importacaoRecolhasStatus");
    const loadingRecolhasImportSpinnerEl = document.getElementById("loadingRecolhasImportSpinner");

    const recDashboardFiltroDataInicioEl = document.getElementById("recDashboardFiltroDataInicio");
    const recDashboardFiltroDataFimEl = document.getElementById("recDashboardFiltroDataFim");
    const recDashboardFiltroPeriodoEl = document.getElementById("recDashboardFiltroPeriodo");
    const recDashboardFiltroCondutorEl = document.getElementById("recDashboardFiltroCondutor");
    const recAplicarFiltrosDashboardBtnEl = document.getElementById("recAplicarFiltrosDashboardBtn");

    const statTotalRecolhasEl = document.getElementById("statTotalRecolhas");
    const statTotalRecolhasPeriodoEl = document.getElementById("statTotalRecolhasPeriodo");
    const statReservasRecolhidasEl = document.getElementById("statReservasRecolhidas");
    const statReservasRecolhidasPeriodoEl = document.getElementById("statReservasRecolhidasPeriodo");
    const statValorTotalRecolhasEl = document.getElementById("statValorTotalRecolhas");
    const statValorTotalRecolhasPeriodoEl = document.getElementById("statValorTotalRecolhasPeriodo");
    const statRecolhasPorCondutorEl = document.getElementById("statRecolhasPorCondutor");

    const recDashboardDataHoraInputEl = document.getElementById("recDashboardDataHoraInput");
    const recDashboardDataHoraDisplayEl = document.getElementById("recDashboardDataHoraDisplay");
    const chartRecolhasPorHoraEl = document.getElementById("chartRecolhasPorHora");
    const chartTopCondutoresRecolhasEl = document.getElementById("chartTopCondutoresRecolhas");

    const recFiltroMatriculaListaEl = document.getElementById("recFiltroMatriculaLista");
    const recFiltroAlocationListaEl = document.getElementById("recFiltroAlocationLista");
    const recFiltroDataRecolhaListaEl = document.getElementById("recFiltroDataRecolhaLista");
    const recFiltroCondutorListaEl = document.getElementById("recFiltroCondutorLista");
    const recAplicarFiltrosListaBtnEl = document.getElementById("recAplicarFiltrosListaBtn");
    const recolhasTableBodyEl = document.getElementById("recolhasTableBody");
    const recolhasNenhumaMsgEl = document.getElementById("recolhasNenhumaMsg");
    const recolhasPaginacaoEl = document.getElementById("recolhasPaginacao");
    const loadingRecolhasTableSpinnerEl = document.getElementById("loadingRecolhasTableSpinner");
    
    const recExportarListaBtnEl = document.getElementById("recExportarListaBtn");
    const voltarDashboardBtnRecolhasEl = document.getElementById("voltarDashboardBtnRecolhas");

    // --- Estado da Aplicação ---
    let todasAsRecolhasGeral = [];
    let paginaAtualRecolhasLista = 1;
    const itensPorPaginaRecolhasLista = 15;
    let listaCondutores = []; // Para popular os selects de filtro

    // --- Configuração de Gráficos ---
    let graficoRecolhasPorHora;
    let graficoTopCondutores;

    function setupGraficosRecolhas() {
        const ctxHora = chartRecolhasPorHoraEl.getContext("2d");
        if (graficoRecolhasPorHora) graficoRecolhasPorHora.destroy();
        graficoRecolhasPorHora = new Chart(ctxHora, {
            type: "bar",
            data: { labels: [], datasets: [{ label: "Nº de Recolhas", data: [], backgroundColor: "rgba(255, 159, 64, 0.7)", borderColor: "rgba(255, 159, 64, 1)", borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
        });

        const ctxTopCondutores = chartTopCondutoresRecolhasEl.getContext("2d");
        if (graficoTopCondutores) graficoTopCondutores.destroy();
        graficoTopCondutores = new Chart(ctxTopCondutores, {
            type: "pie", // Ou "doughnut"
            data: { labels: [], datasets: [{ label: "Recolhas por Condutor", data: [], backgroundColor: ["rgba(255, 99, 132, 0.7)", "rgba(54, 162, 235, 0.7)", "rgba(255, 206, 86, 0.7)", "rgba(75, 192, 192, 0.7)", "rgba(153, 102, 255, 0.7)"], borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
        });
    }

    // --- Funções Auxiliares (Reutilizar/Adaptar de reservas.js se necessário) ---
    function formatarDataHora(dataISO) {
        if (!dataISO) return "N/A";
        try { return new Date(dataISO).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }); }
        catch (e) { return dataISO; }
    }
    function formatarMoeda(valor) {
        if (valor === null || valor === undefined) return "0,00 €";
        return parseFloat(valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
    }
    function mostrarSpinner(spinnerId) {
        const spinner = document.getElementById(spinnerId);
        if (spinner) spinner.classList.remove("hidden");
    }
    function esconderSpinner(spinnerId) {
        const spinner = document.getElementById(spinnerId);
        if (spinner) spinner.classList.add("hidden");
    }

    // --- Carregar Condutores para Filtros ---
    async function carregarCondutores() {
        // Assumindo que condutores são utilizadores com um certo "role" na tabela "profiles"
        // Ajustar "role_condutor_recolha" conforme a tua definição de roles
        const { data, error } = await supabase
            .from("profiles")
            .select("id, username, full_name")
            // .eq("role", "operador_recolhas") // Exemplo de filtro por role
            .order("full_name", { ascending: true });

        if (error) {
            console.error("Erro ao carregar condutores:", error);
            return;
        }
        listaCondutores = data || [];
        popularSelectCondutores(recDashboardFiltroCondutorEl, listaCondutores);
        popularSelectCondutores(recFiltroCondutorListaEl, listaCondutores);
    }

    function popularSelectCondutores(selectElement, condutores) {
        if (!selectElement) return;
        // Guardar a opção "Todos" se existir
        const primeiraOpcao = selectElement.options[0];
        selectElement.innerHTML = ""; // Limpar opções existentes
        if (primeiraOpcao) selectElement.appendChild(primeiraOpcao); // Readicionar "Todos"

        condutores.forEach(cond => {
            const option = document.createElement("option");
            option.value = cond.id; // Usar o ID do perfil como valor
            option.textContent = cond.full_name || cond.username || cond.id;
            selectElement.appendChild(option);
        });
    }


    // --- Lógica de Importação de Ficheiro de Recolhas ---
    async function processarFicheiroRecolhas() {
        const ficheiro = importRecolhasFileEl.files[0];
        if (!ficheiro) {
            importacaoRecolhasStatusEl.textContent = "Por favor, selecione um ficheiro de recolhas.";
            importacaoRecolhasStatusEl.className = "mt-4 text-sm text-red-600";
            return;
        }

        importacaoRecolhasStatusEl.textContent = "A processar ficheiro de recolhas...";
        importacaoRecolhasStatusEl.className = "mt-4 text-sm text-blue-600";
        mostrarSpinner("loadingRecolhasImportSpinner");
        recProcessarImportacaoBtnEl.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array", cellDates: true });
                const nomePrimeiraFolha = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[nomePrimeiraFolha], { raw: false });

                if (jsonData.length === 0) {
                    throw new Error("O ficheiro de recolhas está vazio ou não foi possível ler os dados.");
                }

                let atualizacoes = 0;
                let criacoes = 0;

                for (const row of jsonData) {
                    // IMPORTANTE: Ajustar os nomes das colunas conforme o teu ficheiro de recolhas
                    const matricula = row["Matrícula"] || row["license_plate"];
                    const alocation = row["Alocation"] || row["alocation"];
                    const dataRecolhaReal = row["Data Recolha Real"] || row["data_entrada_real"]; // Ajustar
                    const nomeCondutorRecolha = row["Condutor Recolha"] || row["condutor_recolha"]; // Nome do condutor
                    
                    if (!matricula || !alocation || !dataRecolhaReal || !nomeCondutorRecolha) {
                        console.warn("Linha ignorada por falta de dados essenciais (matrícula, alocation, data recolha, condutor):", row);
                        continue;
                    }

                    // 1. Encontrar o ID do condutor pelo nome (assumindo que o nome é único ou suficientemente distinto)
                    // Idealmente, o ficheiro de recolha teria o ID do condutor.
                    // Esta é uma simplificação; para produção, um mapeamento mais robusto seria necessário.
                    let condutorRecolhaId = null;
                    const condutorEncontrado = listaCondutores.find(c => (c.full_name === nomeCondutorRecolha || c.username === nomeCondutorRecolha));
                    if (condutorEncontrado) {
                        condutorRecolhaId = condutorEncontrado.id;
                    } else {
                        console.warn(`Condutor "${nomeCondutorRecolha}" não encontrado na lista de perfis. Recolha para ${matricula} pode não ter condutor associado.`);
                        // Poderia criar um perfil "placeholder" ou deixar null e tratar depois.
                    }

                    // 2. Procurar reserva existente
                    const { data: reservaExistente, error: erroProcura } = await supabase
                        .from("reservas")
                        .select("id, estado_reserva, valor_reserva, nome_cliente, parque") // Selecionar campos necessários
                        .eq("matricula", matricula)
                        .eq("alocation", alocation)
                        // .in("estado_reserva", ["Confirmada", "Pendente"]) // Considerar apenas reservas que esperam check-in
                        .maybeSingle(); // Retorna um único objeto ou null

                    if (erroProcura) {
                        console.error(`Erro ao procurar reserva para ${matricula}/${alocation}:`, erroProcura);
                        continue; // Pular esta linha e tentar a próxima
                    }
                    
                    const dadosParaAtualizarOuInserir = {
                        matricula: matricula,
                        alocation: alocation,
                        data_entrada_real: new Date(dataRecolhaReal).toISOString(),
                        condutor_recolha_id: condutorRecolhaId,
                        estado_reserva: "Em Curso", // Ou "Check-in Efetuado"
                        user_id_last_modified: currentUser ? currentUser.id : null,
                        // Outros campos do ficheiro de recolha:
                        // ex: kms_entrada: row["KMS Entrada"], danos_observados: row["Danos Observados"]
                    };


                    if (reservaExistente) { // Atualizar reserva
                        const { error: erroUpdate } = await supabase
                            .from("reservas")
                            .update(dadosParaAtualizarOuInserir)
                            .eq("id", reservaExistente.id);
                        
                        if (erroUpdate) {
                            console.error(`Erro ao atualizar reserva ${reservaExistente.id}:`, erroUpdate);
                        } else {
                            atualizacoes++;
                            // Log da modificação
                            await supabase.from("reservas_logs").insert({
                                reserva_id: reservaExistente.id,
                                user_id: currentUser ? currentUser.id : null,
                                descricao_alteracao: `Recolha processada. Estado: ${dadosParaAtualizarOuInserir.estado_reserva}. Condutor: ${nomeCondutorRecolha}.`,
                                campo_alterado: "estado_reserva;data_entrada_real;condutor_recolha_id", // Exemplo
                                valor_novo: `${dadosParaAtualizarOuInserir.estado_reserva};${dadosParaAtualizarOuInserir.data_entrada_real};${condutorRecolhaId}`
                            });
                        }
                    } else { // Criar novo registo (entrada direta sem reserva prévia)
                        // Adicionar campos que seriam da reserva original, se disponíveis no ficheiro de recolha
                        // ou deixar como null/default.
                        dadosParaAtualizarOuInserir.nome_cliente = row["Cliente"] || "Entrada Direta";
                        dadosParaAtualizarOuInserir.parque = row["Parque"] || (userProfile ? userProfile.parque_associado_id : null) || "N/A"; // Exemplo
                        dadosParaAtualizarOuInserir.data_reserva = new Date(dataRecolhaReal).toISOString(); // Usar data da recolha como data da "reserva"
                        dadosParaAtualizarOuInserir.data_entrada_prevista = new Date(dataRecolhaReal).toISOString();
                        // booking_id pode ser gerado ou vir do ficheiro se aplicável
                        dadosParaAtualizarOuInserir.booking_id = row["Booking ID"] || `REC-${Date.now().toString().slice(-6)}`;
                        dadosParaAtualizarOuInserir.user_id_created = currentUser ? currentUser.id : null;


                        const { error: erroInsert } = await supabase.from("reservas").insert(dadosParaAtualizarOuInserir);
                        if (erroInsert) {
                            console.error(`Erro ao inserir nova recolha para ${matricula}/${alocation}:`, erroInsert);
                        } else {
                            criacoes++;
                        }
                    }
                }

                importacaoRecolhasStatusEl.textContent = `Processamento concluído: ${atualizacoes} reservas atualizadas, ${criacoes} novas entradas registadas.`;
                importacaoRecolhasStatusEl.className = "mt-4 text-sm text-green-600";
                await carregarRecolhasDaLista(); // Recarregar a lista de recolhas
                await carregarDadosDashboardRecolhas(); // Recarregar dados do dashboard

            } catch (error) {
                console.error("Erro ao processar o ficheiro de recolhas:", error);
                importacaoRecolhasStatusEl.textContent = `Erro ao processar: ${error.message}`;
                importacaoRecolhasStatusEl.className = "mt-4 text-sm text-red-600";
            } finally {
                esconderSpinner("loadingRecolhasImportSpinner");
                recProcessarImportacaoBtnEl.disabled = false;
                importRecolhasFileEl.value = "";
            }
        };
        reader.readAsArrayBuffer(ficheiro);
    }

    // --- Lógica de Carregamento de Dados da Lista de Recolhas (READ) ---
    async function carregarRecolhasDaLista(pagina = 1, filtros = {}) {
        if (!recolhasTableBodyEl) return;
        mostrarSpinner("loadingRecolhasTableSpinner");
        recolhasTableBodyEl.innerHTML = "";
        if(recolhasNenhumaMsgEl) recolhasNenhumaMsgEl.classList.add("hidden");

        const rangeFrom = (pagina - 1) * itensPorPaginaRecolhasLista;
        const rangeTo = rangeFrom + itensPorPaginaRecolhasLista - 1;

        // Query base: Selecionar de "reservas" onde o estado indica que foi recolhido ou está em curso
        // E onde data_entrada_real (data da recolha) está preenchida.
        let query = supabase
            .from("reservas") // A tabela de recolhas é a própria tabela de reservas com campos específicos preenchidos
            .select("*, condutor_recolha_id(id, full_name, username)", { count: "exact" })
            .not("data_entrada_real", "is", null) // Apenas as que têm data de recolha real
            .in("estado_reserva", ["Em Curso", "Check-in Efetuado", "Recolhido"]); // Ajustar estados conforme necessário

        // Aplicar filtros
        if (filtros.matricula) query = query.ilike("matricula", `%${filtros.matricula}%`);
        if (filtros.alocation) query = query.ilike("alocation", `%${filtros.alocation}%`);
        if (filtros.data_recolha) query = query.gte("data_entrada_real", filtros.data_recolha + "T00:00:00").lte("data_entrada_real", filtros.data_recolha + "T23:59:59");
        if (filtros.condutor_id) query = query.eq("condutor_recolha_id", filtros.condutor_id);

        query = query.order("data_entrada_real", { ascending: false }).range(rangeFrom, rangeTo);

        const { data, error, count } = await query;

        esconderSpinner("loadingRecolhasTableSpinner");
        if (error) {
            console.error("Erro ao carregar recolhas:", error);
            if(recolhasNenhumaMsgEl) {
                recolhasNenhumaMsgEl.textContent = "Erro ao carregar dados. Tente novamente.";
                recolhasNenhumaMsgEl.classList.remove("hidden");
            }
            return;
        }

        todasAsRecolhasGeral = data;

        if (data && data.length > 0) {
            data.forEach(recolha => {
                const tr = document.createElement("tr");
                tr.className = "border-b hover:bg-gray-50";
                const nomeCondutor = recolha.condutor_recolha_id ? (recolha.condutor_recolha_id.full_name || recolha.condutor_recolha_id.username) : "N/A";
                tr.innerHTML = `
                    <td class="py-3 px-4 text-xs">${recolha.booking_id || "N/A"}</td>
                    <td class="py-3 px-4 text-xs">${recolha.matricula || "N/A"}</td>
                    <td class="py-3 px-4 text-xs">${recolha.alocation || "N/A"}</td>
                    <td class="py-3 px-4 text-xs">${formatarDataHora(recolha.data_entrada_real)}</td>
                    <td class="py-3 px-4 text-xs">${nomeCondutor}</td>
                    <td class="py-3 px-4 text-xs">${recolha.parque || "N/A"}</td>
                    <td class="py-3 px-4 text-xs text-right">${formatarMoeda(recolha.valor_reserva)}</td>
                    <td class="py-3 px-4 text-xs"><span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">${recolha.estado_reserva || "N/A"}</span></td>
                    <td class="py-3 px-4 text-xs">
                        <button class="text-blue-600 hover:text-blue-800 ver-detalhes-recolha-btn" data-id="${recolha.id}">Detalhes</button>
                        {/* Ações como "Editar Recolha" ou "Cancelar Recolha" podem ser adicionadas aqui */}
                    </td>
                `;
                recolhasTableBodyEl.appendChild(tr);
            });
            // configurarBotoesAcaoRecolhas(); // Se houver botões de ação na linha
        } else {
            if(recolhasNenhumaMsgEl) {
                recolhasNenhumaMsgEl.textContent = "Nenhuma recolha encontrada com os filtros atuais.";
                recolhasNenhumaMsgEl.classList.remove("hidden");
            }
        }
        atualizarPaginacaoRecolhasLista(pagina, count);
    }

    // --- Lógica de Paginação para Lista de Recolhas ---
    function atualizarPaginacaoRecolhasLista(paginaCorrente, totalItens) {
        if (!recolhasPaginacaoEl || totalItens === 0) {
            if(recolhasPaginacaoEl) recolhasPaginacaoEl.innerHTML = "";
            return;
        }
        const totalPaginas = Math.ceil(totalItens / itensPorPaginaRecolhasLista);
        recolhasPaginacaoEl.innerHTML = ""; // Limpar paginação anterior

        if (totalPaginas <= 1) return;

        // Botão Anterior
        const prevButton = document.createElement("button");
        prevButton.innerHTML = "&laquo; Anterior";
        prevButton.className = "px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed";
        prevButton.disabled = paginaCorrente === 1;
        prevButton.addEventListener("click", () => carregarRecolhasDaLista(paginaCorrente - 1, obterFiltrosAtuaisRecolhas()));
        recolhasPaginacaoEl.appendChild(prevButton);

        // Números das Páginas (simplificado)
        let startPage = Math.max(1, paginaCorrente - 2);
        let endPage = Math.min(totalPaginas, paginaCorrente + 2);

        if (startPage > 1) {
            const firstButton = document.createElement("button");
            firstButton.textContent = "1";
            firstButton.className = "px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 mx-1";
            firstButton.addEventListener("click", () => carregarRecolhasDaLista(1, obterFiltrosAtuaisRecolhas()));
            recolhasPaginacaoEl.appendChild(firstButton);
            if (startPage > 2) {
                const ellipsis = document.createElement("span");
                ellipsis.textContent = "...";
                ellipsis.className = "px-3 py-1 text-sm";
                recolhasPaginacaoEl.appendChild(ellipsis);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement("button");
            pageButton.textContent = i;
            pageButton.className = `px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 mx-1 ${i === paginaCorrente ? "bg-blue-500 text-white border-blue-500" : ""}`;
            if (i === paginaCorrente) pageButton.disabled = true;
            pageButton.addEventListener("click", () => carregarRecolhasDaLista(i, obterFiltrosAtuaisRecolhas()));
            recolhasPaginacaoEl.appendChild(pageButton);
        }

        if (endPage < totalPaginas) {
            if (endPage < totalPaginas - 1) {
                const ellipsis = document.createElement("span");
                ellipsis.textContent = "...";
                ellipsis.className = "px-3 py-1 text-sm";
                recolhasPaginacaoEl.appendChild(ellipsis);
            }
            const lastButton = document.createElement("button");
            lastButton.textContent = totalPaginas;
            lastButton.className = "px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 mx-1";
            lastButton.addEventListener("click", () => carregarRecolhasDaLista(totalPaginas, obterFiltrosAtuaisRecolhas()));
            recolhasPaginacaoEl.appendChild(lastButton);
        }

        // Botão Próximo
        const nextButton = document.createElement("button");
        nextButton.innerHTML = "Próximo &raquo;";
        nextButton.className = "px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed";
        nextButton.disabled = paginaCorrente === totalPaginas;
        nextButton.addEventListener("click", () => carregarRecolhasDaLista(paginaCorrente + 1, obterFiltrosAtuaisRecolhas()));
        recolhasPaginacaoEl.appendChild(nextButton);
    }

    function obterFiltrosAtuaisRecolhas() {
        return {
            matricula: recFiltroMatriculaListaEl ? recFiltroMatriculaListaEl.value : null,
            alocation: recFiltroAlocationListaEl ? recFiltroAlocationListaEl.value : null,
            data_recolha: recFiltroDataRecolhaListaEl ? recFiltroDataRecolhaListaEl.value : null,
            condutor_id: recFiltroCondutorListaEl ? recFiltroCondutorListaEl.value : null
        };
    }

    // --- Lógica do Dashboard de Recolhas ---
    async function carregarDadosDashboardRecolhas() {
        const filtros = {
            dataInicio: recDashboardFiltroDataInicioEl ? recDashboardFiltroDataInicioEl.value : null,
            dataFim: recDashboardFiltroDataFimEl ? recDashboardFiltroDataFimEl.value : null,
            periodo: recDashboardFiltroPeriodoEl ? recDashboardFiltroPeriodoEl.value : "mes_atual",
            condutorId: recDashboardFiltroCondutorEl ? recDashboardFiltroCondutorEl.value : null
        };

        let queryBase = supabase
            .from("reservas")
            .not("data_entrada_real", "is", null)
            .in("estado_reserva", ["Em Curso", "Check-in Efetuado", "Recolhido"]);

        // Aplicar filtros de data
        const { dataInicioFormatada, dataFimFormatada, periodoLabel } = calcularPeriodoDatas(filtros.periodo, filtros.dataInicio, filtros.dataFim);
        if (dataInicioFormatada) queryBase = queryBase.gte("data_entrada_real", dataInicioFormatada + "T00:00:00");
        if (dataFimFormatada) queryBase = queryBase.lte("data_entrada_real", dataFimFormatada + "T23:59:59");
        if (filtros.condutorId) queryBase = queryBase.eq("condutor_recolha_id", filtros.condutorId);

        // 1. Total de Recolhas e Valor Total
        const { data: recolhasData, error: recolhasError, count: totalRecolhas } = await queryBase.select("valor_reserva", { count: "exact" });
        if (recolhasError) console.error("Erro ao buscar dados para dashboard de recolhas:", recolhasError);

        const valorTotalRecolhas = recolhasData ? recolhasData.reduce((sum, item) => sum + (parseFloat(item.valor_reserva) || 0), 0) : 0;
        if (statTotalRecolhasEl) statTotalRecolhasEl.textContent = totalRecolhas || 0;
        if (statTotalRecolhasPeriodoEl) statTotalRecolhasPeriodoEl.textContent = periodoLabel;
        if (statValorTotalRecolhasEl) statValorTotalRecolhasEl.textContent = formatarMoeda(valorTotalRecolhas);
        if (statValorTotalRecolhasPeriodoEl) statValorTotalRecolhasPeriodoEl.textContent = periodoLabel;

        // 2. Recolhas por Hora (para o dia selecionado no input, ou hoje por defeito)
        const dataParaGraficoHora = recDashboardDataHoraInputEl ? recDashboardDataHoraInputEl.value : new Date().toISOString().split("T")[0];
        if (recDashboardDataHoraDisplayEl) recDashboardDataHoraDisplayEl.textContent = formatarDataHora(dataParaGraficoHora + "T00:00:00").split(",")[0];
        
        let queryHora = supabase
            .from("reservas")
            .not("data_entrada_real", "is", null)
            .in("estado_reserva", ["Em Curso", "Check-in Efetuado", "Recolhido"])
            .gte("data_entrada_real", dataParaGraficoHora + "T00:00:00")
            .lte("data_entrada_real", dataParaGraficoHora + "T23:59:59");
        if (filtros.condutorId) queryHora = queryHora.eq("condutor_recolha_id", filtros.condutorId);

        const { data: recolhasPorHoraData, error: recolhasPorHoraError } = await queryHora.select("data_entrada_real");
        if (recolhasPorHoraError) console.error("Erro ao buscar recolhas por hora:", recolhasPorHoraError);

        const contagemPorHora = Array(24).fill(0);
        if (recolhasPorHoraData) {
            recolhasPorHoraData.forEach(r => {
                const hora = new Date(r.data_entrada_real).getHours();
                contagemPorHora[hora]++;
            });
        }
        if (graficoRecolhasPorHora) {
            graficoRecolhasPorHora.data.labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
            graficoRecolhasPorHora.data.datasets[0].data = contagemPorHora;
            graficoRecolhasPorHora.update();
        }

        // 3. Top Condutores (no período selecionado)
        let queryCondutores = supabase
            .from("reservas")
            .select("condutor_recolha_id(id, full_name, username)", { count: "exact" })
            .not("data_entrada_real", "is", null)
            .not("condutor_recolha_id", "is", null)
            .in("estado_reserva", ["Em Curso", "Check-in Efetuado", "Recolhido"]);
        if (dataInicioFormatada) queryCondutores = queryCondutores.gte("data_entrada_real", dataInicioFormatada + "T00:00:00");
        if (dataFimFormatada) queryCondutores = queryCondutores.lte("data_entrada_real", dataFimFormatada + "T23:59:59");
        // Não aplicar filtro de condutor aqui, pois queremos o top geral no período

        const { data: recolhasPorCondutorData, error: recolhasPorCondutorError } = await queryCondutores;
        if (recolhasPorCondutorError) console.error("Erro ao buscar recolhas por condutor:", recolhasPorCondutorError);

        const contagemPorCondutor = {};
        if (recolhasPorCondutorData) {
            recolhasPorCondutorData.forEach(r => {
                const condutor = r.condutor_recolha_id;
                if (condutor) {
                    const nome = condutor.full_name || condutor.username || condutor.id;
                    contagemPorCondutor[nome] = (contagemPorCondutor[nome] || 0) + 1;
                }
            });
        }
        const labelsCondutores = Object.keys(contagemPorCondutor);
        const dataCondutores = Object.values(contagemPorCondutor);
        if (graficoTopCondutores) {
            graficoTopCondutores.data.labels = labelsCondutores;
            graficoTopCondutores.data.datasets[0].data = dataCondutores;
            graficoTopCondutores.update();
        }
        if (statRecolhasPorCondutorEl) {
            statRecolhasPorCondutorEl.innerHTML = labelsCondutores.map((nome, idx) => `<div class="text-xs"><strong>${nome}:</strong> ${dataCondutores[idx]}</div>`).join("") || "N/A";
        }

        // Estatística de "Reservas Recolhidas" (assumindo que são todas as que aparecem aqui)
        if (statReservasRecolhidasEl) statReservasRecolhidasEl.textContent = totalRecolhas || 0;
        if (statReservasRecolhidasPeriodoEl) statReservasRecolhidasPeriodoEl.textContent = periodoLabel;
    }

    function calcularPeriodoDatas(periodoSelecionado, dataInicioInput, dataFimInput) {
        let dataInicioFormatada, dataFimFormatada, periodoLabel;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        switch (periodoSelecionado) {
            case "hoje":
                dataInicioFormatada = hoje.toISOString().split("T")[0];
                dataFimFormatada = hoje.toISOString().split("T")[0];
                periodoLabel = "Hoje";
                break;
            case "semana_atual":
                const primeiroDiaSemana = new Date(hoje);
                const diaDaSemana = hoje.getDay(); // 0 (Dom) - 6 (Sáb)
                const diff = hoje.getDate() - diaDaSemana + (diaDaSemana === 0 ? -6 : 1); // Ajusta para segunda-feira
                primeiroDiaSemana.setDate(diff);
                const ultimoDiaSemana = new Date(primeiroDiaSemana);
                ultimoDiaSemana.setDate(primeiroDiaSemana.getDate() + 6);
                dataInicioFormatada = primeiroDiaSemana.toISOString().split("T")[0];
                dataFimFormatada = ultimoDiaSemana.toISOString().split("T")[0];
                periodoLabel = "Esta Semana";
                break;
            case "mes_atual":
                dataInicioFormatada = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
                dataFimFormatada = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0];
                periodoLabel = "Este Mês";
                break;
            case "ultimos_30_dias":
                const data30diasAtras = new Date(hoje);
                data30diasAtras.setDate(hoje.getDate() - 29); // Inclui hoje, então 29 dias atrás
                dataInicioFormatada = data30diasAtras.toISOString().split("T")[0];
                dataFimFormatada = hoje.toISOString().split("T")[0];
                periodoLabel = "Últimos 30 Dias";
                break;
            case "este_ano":
                dataInicioFormatada = new Date(hoje.getFullYear(), 0, 1).toISOString().split("T")[0];
                dataFimFormatada = new Date(hoje.getFullYear(), 11, 31).toISOString().split("T")[0];
                periodoLabel = "Este Ano";
                break;
            case "personalizado":
            default:
                dataInicioFormatada = dataInicioInput;
                dataFimFormatada = dataFimInput;
                if (dataInicioInput && dataFimInput) {
                    periodoLabel = `De ${formatarDataHora(dataInicioInput+"T00:00").split(",")[0]} a ${formatarDataHora(dataFimInput+"T00:00").split(",")[0]}`;
                } else if (dataInicioInput) {
                    periodoLabel = `Desde ${formatarDataHora(dataInicioInput+"T00:00").split(",")[0]}`;
                } else if (dataFimInput) {
                    periodoLabel = `Até ${formatarDataHora(dataFimInput+"T00:00").split(",")[0]}`;
                } else {
                    periodoLabel = "Todo o Período";
                }
                break;
        }
        return { dataInicioFormatada, dataFimFormatada, periodoLabel };
    }

    // --- Exportar Lista de Recolhas para CSV ---
    async function exportarListaRecolhasCSV() {
        mostrarSpinner("loadingRecolhasTableSpinner");
        const filtros = obterFiltrosAtuaisRecolhas();
        let query = supabase
            .from("reservas")
            .select("*, condutor_recolha_id(full_name, username)")
            .not("data_entrada_real", "is", null)
            .in("estado_reserva", ["Em Curso", "Check-in Efetuado", "Recolhido"]);

        if (filtros.matricula) query = query.ilike("matricula", `%${filtros.matricula}%`);
        if (filtros.alocation) query = query.ilike("alocation", `%${filtros.alocation}%`);
        if (filtros.data_recolha) query = query.gte("data_entrada_real", filtros.data_recolha + "T00:00:00").lte("data_entrada_real", filtros.data_recolha + "T23:59:59");
        if (filtros.condutor_id) query = query.eq("condutor_recolha_id", filtros.condutor_id);
        
        query = query.order("data_entrada_real", { ascending: false });

        const { data, error } = await query;
        esconderSpinner("loadingRecolhasTableSpinner");

        if (error) {
            alert("Erro ao exportar dados: " + error.message);
            return;
        }
        if (!data || data.length === 0) {
            alert("Nenhum dado para exportar com os filtros atuais.");
            return;
        }

        const csvHeader = [
            "Booking ID", "Matrícula", "Alocation", "Data Recolha Real", "Condutor Recolha", "Parque", "Valor Reserva (€)", "Estado Reserva",
            // Adicionar mais campos conforme necessário
            "Nome Cliente", "Email Cliente", "Telefone Cliente", "Data Reserva Original", "Data Entrada Prevista", "Data Saída Prevista", "Campanha", "Observações"
        ];
        const csvRows = data.map(r => [
            r.booking_id,
            r.matricula,
            r.alocation,
            formatarDataHora(r.data_entrada_real),
            r.condutor_recolha_id ? (r.condutor_recolha_id.full_name || r.condutor_recolha_id.username) : "",
            r.parque,
            r.valor_reserva ? r.valor_reserva.toString().replace(".", ",") : "0,00",
            r.estado_reserva,
            r.nome_cliente,
            r.email_cliente,
            r.telefone_cliente,
            formatarDataHora(r.data_reserva),
            formatarDataHora(r.data_entrada_prevista),
            formatarDataHora(r.data_saida_prevista),
            r.campanha,
            r.observacoes ? r.observacoes.replace(/\n|\r/g, " ") : ""
        ]);

        let csvContent = "data:text/csv;charset=utf-8," + csvHeader.join(";") + "\n" + csvRows.map(e => e.join(";")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `recolhas_multipark_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- Event Listeners ---
    if (recProcessarImportacaoBtnEl) recProcessarImportacaoBtnEl.addEventListener("click", processarFicheiroRecolhas);
    if (recAplicarFiltrosDashboardBtnEl) recAplicarFiltrosDashboardBtnEl.addEventListener("click", carregarDadosDashboardRecolhas);
    if (recAplicarFiltrosListaBtnEl) recAplicarFiltrosListaBtnEl.addEventListener("click", () => carregarRecolhasDaLista(1, obterFiltrosAtuaisRecolhas()));
    if (recExportarListaBtnEl) recExportarListaBtnEl.addEventListener("click", exportarListaRecolhasCSV);
    if (voltarDashboardBtnRecolhasEl) {
        voltarDashboardBtnRecolhasEl.addEventListener("click", () => {
            window.location.href = "index.html"; // Ou a página principal do dashboard
        });
    }
    if (recDashboardDataHoraInputEl) {
        recDashboardDataHoraInputEl.addEventListener("change", carregarDadosDashboardRecolhas);
    }
    if (recDashboardFiltroPeriodoEl) {
        recDashboardFiltroPeriodoEl.addEventListener("change", () => {
            const periodo = recDashboardFiltroPeriodoEl.value;
            if (periodo === "personalizado") {
                if(recDashboardFiltroDataInicioEl) recDashboardFiltroDataInicioEl.disabled = false;
                if(recDashboardFiltroDataFimEl) recDashboardFiltroDataFimEl.disabled = false;
            } else {
                if(recDashboardFiltroDataInicioEl) recDashboardFiltroDataInicioEl.disabled = true;
                if(recDashboardFiltroDataFimEl) recDashboardFiltroDataFimEl.disabled = true;
                carregarDadosDashboardRecolhas(); // Recarregar com o novo período
            }
        });
    }

    // --- Inicialização ---
    async function initRecolhas() {
        if (!currentUser && !localStorage.getItem("supabase.auth.token")) {
            // auth_global.js deve ter redirecionado, mas como fallback:
            // console.log("Nenhum utilizador autenticado em recolhas.js, redirecionando para login.");
            // window.location.href = "/index.html?redirect=recolhas.html";
            return; // Não prosseguir se não autenticado
        }
        
        if (chartRecolhasPorHoraEl && chartTopCondutoresRecolhasEl) setupGraficosRecolhas();
        await carregarCondutores();
        await carregarRecolhasDaLista();
        await carregarDadosDashboardRecolhas();

        // Definir data padrão para o input de data do gráfico por hora
        if (recDashboardDataHoraInputEl) {
            recDashboardDataHoraInputEl.value = new Date().toISOString().split("T")[0];
        }
        // Forçar o estado inicial do filtro de período
        if (recDashboardFiltroPeriodoEl) {
            const event = new Event("change");
            recDashboardFiltroPeriodoEl.dispatchEvent(event);
        }
    }

    initRecolhas().catch(error => {
        console.error("Erro fatal ao inicializar a página de Recolhas:", error);
        // alert("Ocorreu um erro ao carregar a página de Recolhas. Tente recarregar.");
    });
});


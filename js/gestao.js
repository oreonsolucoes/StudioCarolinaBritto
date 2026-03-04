import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
// ADICIONE ESTA IMPORTAÇÃO:
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBSipc3lVUGF-gTs5ktrU9G060GQ0liCBM",
    authDomain: "studio-manicure-f909f.firebaseapp.com",
    databaseURL: "https://studio-manicure-f909f-default-rtdb.firebaseio.com",
    projectId: "studio-manicure-f909f",
    storageBucket: "studio-manicure-f909f.firebasestorage.app",
    messagingSenderId: "257743931123",
    appId: "1:257743931123:web:d68421b2e04cb4cb9b5986",
    measurementId: "G-TD79VEFQG5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); // Inicializa a autenticação

// --- PROTEÇÃO DE ROTA ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        // Se o usuário estiver logado, mostramos o conteúdo
        // Certifique-se de que o <body> do gestao.html tenha id="gestao-body"
        const body = document.getElementById('gestao-body');
        if (body) body.style.display = 'block';
        console.log("Acesso à gestão autorizado:", user.email);
    }
});

// --- ELEMENTOS ---
const inputInicio = document.getElementById('filtro-inicio');
const inputFim = document.getElementById('filtro-fim');
const btnFiltrar = document.getElementById('btn-filtrar');
const btnLimpar = document.getElementById('btn-limpar');
const listaHistorico = document.getElementById('lista-historico');
const resumoFin = document.getElementById('resumo-financeiro');
const opcoesPagamento = document.querySelectorAll('.custom-option');

// --- LÓGICA DE SELEÇÃO DO DROPDOWN CUSTOMIZADO ---
opcoesPagamento.forEach(opcao => {
    opcao.onclick = () => {
        // Remove a classe selected de todas e adiciona na clicada
        opcoesPagamento.forEach(opt => opt.classList.remove('selected'));
        opcao.classList.add('selected');

        // GATILHO AUTOMÁTICO:
        // Se houver datas preenchidas, filtra automaticamente ao mudar o método
        if (inputInicio.value && inputFim.value) {
            btnFiltrar.click();
        } else {
            // Caso não tenha data, apenas avisa visualmente (opcional)
            console.log("Selecione as datas para filtrar por este método.");
        }
    };
});

function abrirModalPagamento(idAgendamento, nomeCliente) {
    const modal = document.getElementById('modal-confirmar-pagamento');
    const txtNome = document.getElementById('nome-cliente-confirm');
    const btnDigital = document.getElementById('btn-pago-digital');
    const btnDinheiro = document.getElementById('btn-pago-dinheiro');
    const btnCancelar = document.getElementById('btn-cancelar-pagamento');

    txtNome.innerText = nomeCliente;
    modal.style.display = 'flex';

    // Função para atualizar no Firebase
    const atualizarStatus = (novoStatus) => {
        update(ref(db, `agendamentos/${idAgendamento}`), {
            formaPagamento: novoStatus
        }).then(() => {
            modal.style.display = 'none';
            btnFiltrar.click(); // Recarrega o filtro automaticamente para sumir o botão
        });
    };

    btnDigital.onclick = () => atualizarStatus('digital');
    btnDinheiro.onclick = () => atualizarStatus('dinheiro');
    btnCancelar.onclick = () => modal.style.display = 'none';
}

// --- LÓGICA DE FILTRAGEM UNIFICADA ---
btnFiltrar.onclick = () => {
    const inicio = inputInicio.value;
    const fim = inputFim.value;

    const opcaoSelecionada = document.querySelector('.custom-option.selected');
    const metodo = opcaoSelecionada ? opcaoSelecionada.getAttribute('data-value') : 'todos';

    if (!inicio || !fim) return alert("Por favor, selecione as datas de início e fim.");

    onValue(ref(db, "agendamentos"), (snapAg) => {
        onValue(ref(db, "servicos"), (snapServ) => {
            const agendamentos = snapAg.val() || {};
            const servicos = snapServ.val() || {};

            let somaTotal = 0;
            let contador = 0;
            let htmlCards = "";

            // 1. Transformamos em array mantendo o ID original do Firebase
            const listaParaFiltrar = Object.entries(agendamentos).map(([id, dados]) => ({
                id,
                ...dados
            }));

            // 2. Filtramos por data e método
            const filtrados = listaParaFiltrar.filter(ag => {
                const passData = ag.data >= inicio && ag.data <= fim;
                const passMetodo = (metodo === 'todos') || (ag.formaPagamento === metodo);
               const naoEhBloqueio = ag.servicoId !== "bloqueio";
                return passData && passMetodo && naoEhBloqueio;
            }).sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora));

            filtrados.forEach(ag => {
                // Busca o preço comparando nomes sem espaços extras e em minúsculo
                const nomeServico = ag.servicoNome || ag.servico || "";
                const sInfo = Object.values(servicos).find(s =>
                    s.nome.trim().toLowerCase() === nomeServico.trim().toLowerCase()
                );

                let precoVal = 0;
                if (ag.valorFinal !== undefined && ag.valorFinal !== null) {
                    precoVal = typeof ag.valorFinal === 'number'
                        ? ag.valorFinal
                        : parseFloat(ag.valorFinal);
                } 
                // Caso não tenha valorFinal, usa preço do serviço padrão
                else if (sInfo) {
                    precoVal = typeof sInfo.preco === 'number'
                        ? sInfo.preco
                        : parseFloat(sInfo.preco);
                }

                somaTotal += precoVal;
                contador++;

                const dataBR = ag.data.split('-').reverse().join('/');

                // Cores dinâmicas
                let badgeColor = "#ffca28"; // Dinheiro/Outros
                if (ag.formaPagamento === 'pendente') badgeColor = "#ff4444"; // Vermelho
                if (ag.formaPagamento === 'digital') badgeColor = "#4db8ff";  // Azul

                // Lógica do Botão de Confirmação (Cereja do bolo 🍒)
                const botaoConfirmar = ag.formaPagamento === 'pendente'
                    ? `<button onclick="window.confirmarPagamento('${ag.id}', '${ag.cliente}')" 
                        style="background:#2ecc71; border:none; color:white; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:11px; margin-top:8px; font-weight:bold; display:block;">
                        ✔️ Confirmar Recebimento
                       </button>`
                    : '';

                htmlCards += `
                    <div class="admin-card" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 4px solid ${badgeColor};">
                        <div>
                            <strong>${ag.cliente}</strong> 
                            <span style="font-size: 10px; background: #222; color: ${badgeColor}; padding: 2px 6px; border-radius: 4px; border: 1px solid #444; margin-left: 8px; text-transform: uppercase; font-weight:bold;">
                                ${ag.formaPagamento || 'N/D'}
                            </span><br>
                            <small style="opacity:0.8;">${dataBR} - ${ag.hora} | ${nomeServico}</small>
                            ${botaoConfirmar}
                        </div>
                        <div style="text-align: right;">
                            <span style="color: #2ecc71; font-weight: bold; font-size: 1.1rem;">R$ ${precoVal.toFixed(2)}</span>
                        </div>
                    </div>`;
            });

            resumoFin.style.display = 'flex';
            document.getElementById('total-valor').innerText = `R$ ${somaTotal.toFixed(2)}`;
            document.getElementById('total-servicos').innerText = `${contador} atendimentos no período`;

            listaHistorico.innerHTML = htmlCards || "<p style='text-align:center; padding: 20px; opacity:0.6;'>Nenhum registro encontrado.</p>";

        }, { onlyOnce: true });
    }, { onlyOnce: true });
};

// --- LIMPAR TUDO ---
btnLimpar.onclick = () => {
    inputInicio.value = "";
    inputFim.value = "";
    resumoFin.style.display = 'none';
    listaHistorico.innerHTML = "<p style='text-align:center; opacity:0.5; padding: 40px;'>Selecione o período e o método para buscar os dados.</p>";

    // Reseta o dropdown para 'todos'
    opcoesPagamento.forEach(opt => opt.classList.remove('selected'));
    const optTodos = document.querySelector('.custom-option[data-value="todos"]');
    if (optTodos) optTodos.classList.add('selected');
};

inputInicio.onchange = () => { if (inputFim.value) btnFiltrar.click(); };
inputFim.onchange = () => { if (inputInicio.value) btnFiltrar.click(); };

window.confirmarPagamento = abrirModalPagamento;





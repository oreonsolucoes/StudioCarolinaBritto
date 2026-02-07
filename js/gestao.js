import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBSipc3lVUGF-gTs5ktrU9G060GQ0liCBM",
    authDomain: "studio-manicure-f909f.firebaseapp.com",
    projectId: "studio-manicure-f909f",
    storageBucket: "studio-manicure-f909f.firebasestorage.app",
    messagingSenderId: "257743931123",
    appId: "1:257743931123:web:d68421b2e04cb4cb9b5986",
    measurementId: "G-TD79VEFQG5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Elementos das Abas
const btnFin = document.getElementById('tab-financeiro');
const btnHist = document.getElementById('tab-historico');
const secFin = document.getElementById('sec-financeiro');
const secHist = document.getElementById('sec-historico');

// Filtros
const inputInicio = document.getElementById('filtro-inicio');
const inputFim = document.getElementById('filtro-fim');
const btnFiltrar = document.getElementById('btn-filtrar');
const btnLimpar = document.getElementById('btn-limpar');

// Alternar Abas
btnFin.onclick = () => {
    btnFin.classList.add('active'); btnHist.classList.remove('active');
    secFin.style.display = 'block'; secHist.style.display = 'none';
};
btnHist.onclick = () => {
    btnHist.classList.add('active'); btnFin.classList.remove('active');
    secHist.style.display = 'block'; secFin.style.display = 'none';
};

btnFiltrar.onclick = () => {
    const inicio = inputInicio.value;
    const fim = inputFim.value;

    if (!inicio || !fim) return alert("Por favor, selecione as datas de início e fim.");

    onValue(ref(db, "agendamentos"), (snapAg) => {
        onValue(ref(db, "servicos"), (snapServ) => {
            const agendamentos = snapAg.val() || {};
            const servicos = snapServ.val() || {};

            let totalDinheiro = 0;
            let totalQtd = 0;
            let htmlHistorico = "";

            // Filtra agendamentos no intervalo e ordena por data/hora
            const filtrados = Object.values(agendamentos)
                .filter(ag => ag.data && ag.data >= inicio && ag.data <= fim)
                .sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora));

            filtrados.forEach(ag => {
                // Busca o serviço correspondente para pegar o preço
                const sInfo = Object.values(servicos).find(s => s.nome === ag.servico);

                // AJUSTE: Se o preço for "A combinar" ou não for número, vira 0
                let precoVal = 0;
                if (sInfo && typeof sInfo.preco === 'number') {
                    precoVal = sInfo.preco;
                } else if (sInfo && !isNaN(parseFloat(sInfo.preco))) {
                    precoVal = parseFloat(sInfo.preco);
                }

                totalDinheiro += precoVal;
                totalQtd++;

                const dataBR = ag.data.split('-').reverse().join('/');
                const exibicaoPreco = precoVal > 0 ? `R$ ${precoVal.toFixed(2)}` : "A combinar (R$ 0,00)";

                htmlHistorico += `
                    <div class="admin-card">
                        <div>
                            <strong>${ag.cliente}</strong><br>
                            <small>${dataBR} - ${ag.hora} | ${ag.servico}</small>
                        </div>
                        <div style="color:${precoVal > 0 ? 'var(--verde)' : '#999'}">
                            ${exibicaoPreco}
                        </div>
                    </div>`;
            });

            // Atualiza Resumo Financeiro
            document.getElementById('resumo-financeiro').style.display = 'flex';
            document.getElementById('total-valor').innerText = `R$ ${totalDinheiro.toFixed(2)}`;
            document.getElementById('total-servicos').innerText = `${totalQtd} atendimentos realizados no período`;

            // Atualiza Lista de Histórico
            document.getElementById('lista-historico').innerHTML = htmlHistorico || "<p style='text-align:center;'>Nenhum agendamento encontrado neste intervalo.</p>";

        }, { onlyOnce: true });
    }, { onlyOnce: true });
};

btnLimpar.onclick = () => {
    inputInicio.value = "";
    inputFim.value = "";
    document.getElementById('resumo-financeiro').style.display = 'none';
    document.getElementById('lista-historico').innerHTML = "<p style='text-align:center; opacity:0.5;'>Selecione as datas para buscar o histórico.</p>";
};

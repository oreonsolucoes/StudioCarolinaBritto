import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, onValue, remove, update, push, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

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
let servicosDisponiveis = {};


// --- SELETORES GERAIS ---
const listaAgendamentos = document.getElementById("lista-agendamentos");
const filtroData = document.getElementById("filtro-data");
const buscaCliente = document.getElementById("pesquisa-cliente");
const togglePassados = document.getElementById("toggle-passados");
const listaServicos = document.getElementById("lista-servicos");
const btnTabManual = document.getElementById('btn-agendar-manual');
const formServico = document.getElementById('form-servico');
const gradeBloqueio = document.getElementById('grade-bloqueio');
const INTERVALO_MINUTOS = 10;


// --- SISTEMA DE ÁUDIO E DESBLOQUEIO ---
const somNotificacao = new Audio('notificacao.mp3');

function liberarAudio() {
  somNotificacao.play().then(() => {
    somNotificacao.pause();
    somNotificacao.currentTime = 0;
    document.removeEventListener('click', liberarAudio);
  }).catch(() => { });
}
document.addEventListener('click', liberarAudio);

// Data de hoje como padrão
const hojeISO = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-');;
if (filtroData) filtroData.value = hojeISO;

// --- 1️⃣ NOTIFICAÇÕES EM TEMPO REAL ---
let primeiraCarga = true;
const agendamentosRef = ref(db, "agendamentos");

onChildAdded(agendamentosRef, (snapshot) => {
  if (!primeiraCarga) {
    const novoAg = snapshot.val();
    exibirModalNovoAgendamento(novoAg);
  }
});

onValue(agendamentosRef, () => { primeiraCarga = false; }, { onlyOnce: true });

function exibirModalNovoAgendamento(ag) {
  const modal = document.getElementById('modal-notificacao');
  if (modal) {
    const dataBR = ag.data ? ag.data.split("-").reverse().join("/") : "---";
    document.getElementById('notif-cliente').innerText = ag.cliente || "---";
    document.getElementById('notif-servico').innerText = ag.servico || "---";
    document.getElementById('notif-data').innerText = dataBR;
    document.getElementById('notif-hora').innerText = ag.hora || "---";

    modal.style.display = 'flex';
    somNotificacao.play().catch(e => console.log("Áudio aguardando interação."));
    setTimeout(() => {
      modal.style.display = 'none';
    }, 60000);
  }
}

// --- 2️⃣ CARREGAR E FILTRAR AGENDAMENTOS ---
function carregarAgendamentos() {
  onValue(agendamentosRef, (snapshot) => {
    if (!listaAgendamentos) return;
    listaAgendamentos.innerHTML = "";
    const data = snapshot.val();

    if (data) {
      const dataSelecionada = filtroData.value;
      const termoBusca = buscaCliente.value.toLowerCase();
      const agora = new Date();
      const minutosAtuais = (agora.getHours() * 60) + agora.getMinutes();

      const itens = Object.entries(data)
        .filter(([id, ag]) => {
          if (!ag || !ag.hora || !ag.data) return false;
          const dataAg = ag.data;
          const [hAg, mAg] = ag.hora.split(":").map(Number);
          const minutosAg = (hAg * 60) + mAg;
          const nomeAg = (ag.cliente || "").toLowerCase();
          const foneAg = (ag.whatsapp || "");

          const matchesData = dataAg === dataSelecionada;
          const matchesBusca = nomeAg.includes(termoBusca) || foneAg.includes(termoBusca);

          let matchesHorario = true;
          if (togglePassados && togglePassados.checked) {
            if (dataAg === hojeISO) {
              matchesHorario = minutosAg >= minutosAtuais;
            }
          }

          return matchesData && matchesBusca && matchesHorario;
        })
        .sort(([, a], [, b]) => a.hora.localeCompare(b.hora));

      if (itens.length === 0) {
        listaAgendamentos.innerHTML = "<p style='text-align:center; padding:20px; opacity:0.6;'>Nenhum agendamento para este filtro.</p>";
        return;
      }

      itens.forEach(([id, ag]) => {
        const dataBR = ag.data.split("-").reverse().join("/");
        const urlWhats = `https://wa.me/55${ag.whatsapp}?text=Olá! Confirmamos seu agendamento do serviço de _*${ag.servico}*_ aqui na *Barberia SF* em _${dataBR}_ às _${ag.hora}_.`;
        const card = document.createElement("div");
        card.className = `admin-card ${ag.cliente === "BLOQUEADO" ? "bloqueado" : ""}`;

        const pagamentoAtual = ag.formaPagamento || "digital";

        card.innerHTML = `
          <div>
            <strong>${ag.hora} — ${ag.cliente}</strong><br>
            <small>${ag.servico || 'Bloqueio Manual'}</small><br>
            <small style="opacity:.7">💳 ${pagamentoAtual}</small>
          </div>

          <div class="btns-card">

            <div class="custom-select" data-id="${id}" data-valor="${pagamentoAtual}">
              <div class="custom-select-trigger">
                💳 ${pagamentoAtual}
                <span class="arrow">▾</span>
              </div>
              <div class="custom-options">
                <div class="custom-option" data-value="Pagamento digital">Pagamento Digital</div>
                <div class="custom-option" data-value="Pagamento em Dinheiro">Pagamento em Dinheiro</div>
                <div class="custom-option" data-value="Pendente">Pendente</div>
              </div>
            </div>
            
            ${ag.cliente !== "BLOQUEADO"
                    ? `<a href="${urlWhats}" target="_blank" class="btn-whatsapp">WhatsApp</a>`
                    : ''}

            


            <button class="btn-delete">Excluir</button>
          </div>
        `;


        card.querySelector(".btn-delete").onclick = () => {
          if (confirm(`Excluir agendamento de ${ag.cliente}?`)) remove(ref(db, `agendamentos/${id}`));
        };
        listaAgendamentos.appendChild(card);
      });
    }
  });
}

// --- 3️⃣ MODAL DE CONFIRMAÇÃO PERSONALIZADO ---
function mostrarConfirmacao(titulo, mensagem, data, servico, acaoSim) {
  const overlay = document.getElementById('custom-confirm');
  const txtTitulo = document.getElementById('confirm-title');
  const txtMsg = document.getElementById('confirm-msg');
  const txtDate = document.getElementById('confirm-date');
  const txtServ = document.getElementById('confirm-service');
  const btnSim = document.getElementById('confirm-yes');
  const btnNao = document.getElementById('confirm-no');

  if (!overlay) return;

  txtTitulo.innerText = titulo;
  txtMsg.innerText = mensagem;
  txtDate.innerText = data || "---";
  txtServ.innerText = servico || "---";
  overlay.style.display = 'flex';

  const novoBtnSim = btnSim.cloneNode(true);
  btnSim.parentNode.replaceChild(novoBtnSim, btnSim);

  novoBtnSim.onclick = () => {
    acaoSim();
    overlay.style.display = 'none';
  };

  btnNao.onclick = () => {
    overlay.style.display = 'none';
  };
}

// --- 4️⃣ GRADE DE BLOQUEIO (20 EM 20 MINUTOS) ---
function gerarGradeBloqueio() {
  const dataSelecionada = filtroData.value;
  if (!dataSelecionada) return;

  const diasSemana = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const diaNome = diasSemana[new Date(dataSelecionada + 'T00:00:00').getDay()];

  onValue(ref(db, `horarios_funcionamento/${diaNome}`), (funcSnapshot) => {
    const config = funcSnapshot.val();
    if (!config || config.fechado) {
      gradeBloqueio.innerHTML = `<p style='grid-column: 1/-1; text-align:center; padding:20px; color:var(--vermelho);'>Barbearia fechada (${diaNome}).</p>`;
      return;
    }

    onValue(agendamentosRef, (snapshot) => {
      const agendados = snapshot.val() || {};
      gradeBloqueio.innerHTML = "";
      const dataBR = dataSelecionada.split('-').reverse().join('/');

      for (let h = parseInt(config.inicio); h < parseInt(config.fim); h++) {
        for (let m = 0; m < 60; m += INTERVALO_MINUTOS) {
          const horaFormatada = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          const agId = Object.keys(agendados).find(id => agendados[id].data === dataSelecionada && agendados[id].hora === horaFormatada);
          const ocupado = !!agId;
          const ehBloqueio = ocupado && agendados[agId].cliente === "BLOQUEADO";

          const btn = document.createElement("button");
          btn.innerText = horaFormatada;
          btn.className = ehBloqueio ? "btn-hora bloqueado-red" : (ocupado ? "btn-hora ocupado" : "btn-hora livre");

          btn.onclick = () => {
            if (!ocupado) {
              mostrarConfirmacao("Bloquear Horário", `Bloquear ${horaFormatada}?`, dataBR, "Bloqueio Manual", () => {
                push(agendamentosRef, {
                  cliente: "BLOQUEADO",
                  data: dataSelecionada,
                  hora: horaFormatada,
                  whatsapp: "00000000000",
                  servico: "Bloqueio Manual",
                  duracao: INTERVALO_MINUTOS // <--- ADICIONADO PARA CORRIGIR O PROBLEMA NO APP.JS
                });
              });
            } else if (ehBloqueio) {
              mostrarConfirmacao("Liberar Horário", `Liberar ${horaFormatada}?`, dataBR, "Bloqueio Manual", () => {
                remove(ref(db, `agendamentos/${agId}`));
              });
            } else {
              alert("Horário ocupado por um cliente.");
            }
          };
          gradeBloqueio.appendChild(btn);
        }
      }
    });
  }, { onlyOnce: true });
}

// --- 5️⃣ GESTÃO DE SERVIÇOS ---
function carregarServicos() {
  onValue(ref(db, "servicos"), (snapshot) => {
    if (!listaServicos) return;
    listaServicos.innerHTML = "";
    const data = snapshot.val();
    servicosDisponiveis = data;
    if (data) {
      const ordenados = Object.entries(data).sort(([, a], [, b]) => (a.ordem || 99) - (b.ordem || 99));
      ordenados.forEach(([id, s]) => {
        const card = document.createElement('div');
        card.className = 'servico-card';
        card.innerHTML = `
          <div>
            <strong>${s.ordem || '?'}. ${s.nome}</strong><br>
            <small>R$ ${s.preco} | ${s.duracao}min</small>
          </div>
          <div class="btns-card">
            <button class="btn-edit-ordem" title="Mudar Posição">🔢</button>
            <button class="btn-edit-serv" title="Editar Preço">💰</button>
            <button class="btn-del-serv" title="Excluir">🗑️</button>
          </div>`;

        card.querySelector('.btn-del-serv').onclick = () => {
          if (confirm(`Excluir serviço ${s.nome}?`)) remove(ref(db, `servicos/${id}`));
        };
        card.querySelector('.btn-edit-serv').onclick = () => {
          const novoPreco = prompt(`Novo preço para ${s.nome}:`, s.preco);
          if (novoPreco) update(ref(db, `servicos/${id}`), { preco: Number(novoPreco) });
        };
        card.querySelector('.btn-edit-ordem').onclick = () => {
          const novaOrdem = prompt(`Nova posição para ${s.nome}:`, s.ordem || "");
          if (novaOrdem) update(ref(db, `servicos/${id}`), { ordem: Number(novaOrdem) });
        };
        listaServicos.appendChild(card);
      });
    }
  });
}

// --- 6️⃣ NAVEGAÇÃO ENTRE ABAS ---
const btnTabAg = document.getElementById('btn-agendamentos');
const btnTabServ = document.getElementById('btn-servicos');
const btnTabBloq = document.getElementById('btn-bloqueio');
const btnTabRecesso = document.getElementById('btn-recesso'); // Novo botão

function gerenciarAbas(abaAtiva) {
  document.getElementById('sec-agendamentos').style.display = abaAtiva === 'ag' ? 'block' : 'none';
  document.getElementById('sec-servicos').style.display = abaAtiva === 'serv' ? 'block' : 'none';
  document.getElementById('sec-bloqueio').style.display = abaAtiva === 'bloq' ? 'block' : 'none';
  document.getElementById('sec-recesso').style.display = abaAtiva === 'recesso' ? 'block' : 'none';
  document.getElementById('sec-agendar-manual').style.display = abaAtiva === 'manual' ? 'block' : 'none';
    
  btnTabManual.classList.toggle('active', abaAtiva === 'manual');
  btnTabAg.classList.toggle('active', abaAtiva === 'ag');
  btnTabServ.classList.toggle('active', abaAtiva === 'serv');
  btnTabBloq.classList.toggle('active', abaAtiva === 'bloq');
  btnTabRecesso.classList.toggle('active', abaAtiva === 'recesso');

  if (abaAtiva === 'bloq') gerarGradeBloqueio();
}

if (btnTabAg) btnTabAg.onclick = () => gerenciarAbas('ag');
if (btnTabServ) btnTabServ.onclick = () => gerenciarAbas('serv');
if (btnTabBloq) btnTabBloq.onclick = () => gerenciarAbas('bloq');
if (btnTabRecesso) btnTabRecesso.onclick = () => gerenciarAbas('recesso');
if (btnTabManual) btnTabManual.onclick = () => { gerenciarAbas('manual'); carregarFormularioManual();};


// --- 7️⃣ LOGICA DO RECESSO (NOVO) ---
const btnSalvarRecesso = document.getElementById('btn-salvar-recesso');
const btnRemoverRecesso = document.getElementById('btn-remover-recesso');
const boxStatusRecesso = document.getElementById('status-recesso-box');
const textoStatusRecesso = document.getElementById('texto-status-recesso');

if (btnSalvarRecesso) {
  btnSalvarRecesso.onclick = () => {
    const inicio = document.getElementById('recesso-inicio').value;
    const fim = document.getElementById('recesso-fim').value;
    if (!inicio || !fim) return alert("Selecione o período completo!");

    update(ref(db, 'configuracoes/recesso'), { inicio, fim, ativo: true })
      .then(() => alert("Recesso ativado com sucesso!"));
  };
}

if (btnRemoverRecesso) {
  btnRemoverRecesso.onclick = () => {
    update(ref(db, 'configuracoes/recesso'), { ativo: false })
      .then(() => alert("Recesso removido! A agenda está aberta."));
  };
}

// Monitorar status do recesso
onValue(ref(db, 'configuracoes/recesso'), (snapshot) => {
  const data = snapshot.val();
  if (data && data.ativo) {
    boxStatusRecesso.style.display = 'block';
    const dataIni = data.inicio.split('-').reverse().join('/');
    const dataFim = data.fim.split('-').reverse().join('/');
    textoStatusRecesso.innerHTML = `Barbearia FECHADA de <strong>${dataIni}</strong> até <strong>${dataFim}</strong>.`;
  } else {
    boxStatusRecesso.style.display = 'none';
  }
});


// --- 8️⃣ FORMULÁRIO DE SERVIÇOS E FILTROS ---
if (formServico) formServico.onsubmit = (e) => {
  e.preventDefault();
  push(ref(db, 'servicos'), {
    nome: document.getElementById('serv-nome').value,
    preco: Number(document.getElementById('serv-preco').value),
    duracao: Number(document.getElementById('serv-duracao').value),
    ordem: Number(document.getElementById('serv-ordem').value)
  }).then(() => {
    formServico.reset();
    alert("Serviço cadastrado com sucesso!");
  });
};

if (filtroData) filtroData.onchange = () => {
  carregarAgendamentos();
  if (document.getElementById('sec-bloqueio').style.display === 'block') gerarGradeBloqueio();
};

if (buscaCliente) buscaCliente.oninput = carregarAgendamentos;

if (togglePassados) togglePassados.onchange = carregarAgendamentos;

// --- 8.1 FORMULÁRIO DE AGENDAMENTO MANUAL ---
const manualNome = document.getElementById('manual-nome');
const manualWhats = document.getElementById('manual-whatsapp');
const manualServicoSelect = document.getElementById('manual-servico-select');
const manualServicoOptions = document.getElementById('manual-servico-options');
let manualServicoSelecionado = null;
const manualData = document.getElementById('manual-data');
const manualPagamentoSelect = document.getElementById('manual-pagamento-select');
let manualPagamentoValor = 'digital';
const manualGrid = document.getElementById('manual-grid-horarios');
const btnSalvarManual = document.getElementById('btn-salvar-agendamento-manual');

let horarioManualSelecionado = null;

// Popular serviços
function carregarFormularioManual() {
  if (!manualServicoOptions) return;

  manualServicoOptions.innerHTML = "";
  manualServicoSelecionado = null;

  if (!servicosDisponiveis || Object.keys(servicosDisponiveis).length === 0) {
    manualServicoOptions.innerHTML =
      `<div class="custom-option" data-value="">Nenhum serviço cadastrado</div>`;
    return;
  }

  Object.entries(servicosDisponiveis).forEach(([id, s]) => {
    const opt = document.createElement('div');
    opt.className = 'custom-option';
    opt.dataset.value = id;
    opt.innerText = `${s.nome} — R$ ${s.preco}`;
    manualServicoOptions.appendChild(opt);
  });

  manualServicoSelect.querySelector('.custom-select-trigger').innerHTML =
    `✂️ Selecione o serviço <span class="arrow">▾</span>`;
}


function paraMinutos(hora) {
  if (!hora || !hora.includes(":")) return 0;
  const [h, m] = hora.split(":").map(Number);
  return (h * 60) + m;
}


manualData.onchange = gerarHorariosManuais;

function gerarHorariosManuais() {
  if (!manualData.value || !manualServicoSelecionado) return;


  manualGrid.innerHTML = "Carregando...";
  horarioManualSelecionado = null;

  onValue(ref(db, 'agendamentos'), (snapshot) => {
    const ags = Object.values(snapshot.val() || {})
      .filter(a => a.data === manualData.value);

    manualGrid.innerHTML = "";

    for (let t = 0; t < 24 * 60; t += INTERVALO_MINUTOS) {
      const h = String(Math.floor(t / 60)).padStart(2, '0');
      const m = String(t % 60).padStart(2, '0');
      const horaStr = `${h}:${m}`;

      const conflito = ags.some(a => {
        const ini = paraMinutos(a.hora);
        const dur = Number(a.duracao) || INTERVALO_MINUTOS;
        return t < (ini + dur) && (t + INTERVALO_MINUTOS) > ini;
      });

      const div = document.createElement('button');
      div.className = `btn-hora ${conflito ? 'ocupado' : ''}`;
      div.innerText = horaStr;

      if (!conflito) {
        div.onclick = () => {
          document.querySelectorAll('#manual-grid-horarios .btn-hora')
            .forEach(b => b.classList.remove('livre'));
          div.classList.add('livre');
          horarioManualSelecionado = horaStr;
        };
      }

      manualGrid.appendChild(div);
    }
  }, { onlyOnce: true });
}

btnSalvarManual.onclick = async () => {
  if (!manualNome.value || !manualWhats.value || !manualServicoSelecionado
 || !manualData.value || !horarioManualSelecionado) {
    return alert("Preencha todos os campos e selecione o horário.");
  }

  const serv = servicosDisponiveis[manualServicoSelecionado];


  await push(ref(db, 'agendamentos'), {
    cliente: manualNome.value,
    whatsapp: manualWhats.value.replace(/\D/g, ''),
    servico: serv.nome,
    data: manualData.value,
    hora: horarioManualSelecionado,
    duracao: Number(serv.duracao),
    formaPagamento: manualPagamentoValor,
    criadoPor: "barbeiro",
    agendamentoExtra: true,
    timestamp: Date.now()
  });

  alert("Agendamento criado com sucesso!");

  manualNome.value = "";
  manualWhats.value = "";
  manualServicoSelecionado = null;
  manualServicoSelect.querySelector('.custom-select-trigger').innerHTML =
    `✂️ Selecione o serviço <span class="arrow">▾</span>`;
  manualData.value = "";
  manualGrid.innerHTML = "";
};

// --- 8.2 SELECT CUSTOMIZADO (FORMA DE PAGAMENTO) ---
document.addEventListener('click', (e) => {
  document.querySelectorAll('.custom-select').forEach(sel => {
    if (!sel.contains(e.target)) sel.classList.remove('open');
  });

  const trigger = e.target.closest('.custom-select-trigger');
  if (!trigger) return;

  const select = trigger.parentElement;
  select.classList.toggle('open');
});

document.addEventListener('click', (e) => {
  const option = e.target.closest('.custom-option');
  if (!option) return;

  const select = option.closest('.custom-select');
  if (!select) return;

  // ignora select do agendamento manual
  if (select.id === 'manual-pagamento-select') return;

  if (!select.dataset.id) return;


  const agendamentoId = select.dataset.id;
  const valor = option.dataset.value;

  select.querySelector('.custom-select-trigger').innerHTML =
    `💳 ${option.innerText} <span class="arrow">▾</span>`;

  select.classList.remove('open');

  update(ref(db, `agendamentos/${agendamentoId}`), {
    formaPagamento: valor
  });
});

// --- SELECT CUSTOMIZADO - SERVIÇO (AGENDAMENTO MANUAL) ---
document.addEventListener('click', (e) => {
  const option = e.target.closest('#manual-servico-options .custom-option');
  if (!option) return;

  manualServicoSelecionado = option.dataset.value;

  const serv = servicosDisponiveis[manualServicoSelecionado];

  manualServicoSelect.querySelector('.custom-select-trigger').innerHTML =
    `✂️ ${serv.nome} <span class="arrow">▾</span>`;

  manualServicoSelect.classList.remove('open');

  gerarHorariosManuais();
});

// --- SELECT CUSTOMIZADO - PAGAMENTO (AGENDAMENTO MANUAL) ---
document.addEventListener('click', (e) => {
  const option = e.target.closest(
    '#manual-pagamento-select .custom-option'
  );
  if (!option) return;

  manualPagamentoValor = option.dataset.value;

  manualPagamentoSelect.querySelector('.custom-select-trigger').innerHTML =
    `💳 ${option.innerText} <span class="arrow">▾</span>`;

  manualPagamentoSelect.classList.remove('open');
});



// --- 9️⃣ INICIALIZAÇÃO ---
window.addEventListener('auth-ready', () => {
  carregarAgendamentos();
  carregarServicos();
});

// Atualização automática a cada 1 hora (3600000 ms)
setInterval(() => {
  carregarAgendamentos();
}, 3600000);

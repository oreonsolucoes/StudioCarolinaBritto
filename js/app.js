import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, set, get } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

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

// Seletores
const containerAgendamentos = document.getElementById('container-agendamentos');
const btnAddPessoa = document.getElementById('btn-add-pessoa');
const btnConfirmarTudo = document.getElementById('btn-confirmar-tudo');
const modalGestao = document.getElementById('modal-gestao');
const btnAbrirGestao = document.getElementById('btn-abrir-gestao');
const btnBuscarGestao = document.getElementById('btn-buscar-gestao');
const modalSucesso = document.getElementById('modal-sucesso');

let horariosFuncionamento = {};
let servicosDisponiveis = {};

function paraMinutos(horaStr) {
  const [h, m] = horaStr.split(':').map(Number);
  return h * 60 + m;
}

// --- 1 CARREGA SERVIÇOS E HORÁRIOS ---
onValue(ref(db, 'servicos'), (snapshot) => {
  servicosDisponiveis = snapshot.val() || {};
  renderizarSelectServicos();
});

onValue(ref(db, 'horarios_funcionamento'), (snapshot) => {
  horariosFuncionamento = snapshot.val() || {};
});

function renderizarSelectServicos() {
  const selects = document.querySelectorAll('.cliente-servico');
  const listaOrdenada = Object.entries(servicosDisponiveis).sort(([, a], [, b]) => (a.ordem || 99) - (b.ordem || 99));

  selects.forEach(sel => {
    const valorAtual = sel.value;
    sel.innerHTML = `<option value="">Selecione um serviço</option>`;
    listaOrdenada.forEach(([id, s]) => {
      sel.innerHTML += `<option value="${id}">${s.nome} — R$${s.preco}</option>`;
    });
    sel.value = valorAtual;
  });
}

// Lógica para evitar horários duplicados entre blocos na tela
function atualizarBloqueiosLocais() {
  const selecionados = Array.from(document.querySelectorAll('.bloco-agendamento'))
    .map(b => b.dataset.hora).filter(h => h);

  document.querySelectorAll('.horario').forEach(div => {
    if (selecionados.includes(div.innerText) && !div.classList.contains('active')) {
      div.classList.add('indisponivel');
      div.style.opacity = "0.2";
      div.style.pointerEvents = "none";
    }
  });
}

// --- 2 LÓGICA DE MULTI-AGENDAMENTO ---
btnAddPessoa.onclick = () => {
  const totalAtual = document.querySelectorAll('.bloco-agendamento').length;
  if (totalAtual >= 2) return alert("Limite de 2 pessoas por vez.");

  const novoBloco = document.querySelector('.bloco-agendamento').cloneNode(true);
  novoBloco.id = `agendamento-${totalAtual + 1}`;
  novoBloco.querySelector('h3').innerText = `Acompanhante ${totalAtual}`;
  novoBloco.querySelector('.cliente-nome').value = "";
  novoBloco.querySelector('.secao-horarios').style.display = 'none';
  novoBloco.querySelector('.grid-horarios').innerHTML = "";
  novoBloco.dataset.hora = "";

  containerAgendamentos.appendChild(novoBloco);
  atribuirEventosBloco(novoBloco);
};

function atribuirEventosBloco(bloco) {
  const inputData = bloco.querySelector('.data-agenda');
// 1. Mantém a sua trava de data mínima
  inputData.min = new Date().toLocaleDateString('en-CA');


  // 2. NOVA TRAVA: Impede digitação manual (Bloqueia qualquer tecla)
  inputData.onkeydown = (e) => e.preventDefault();

  // 3. OPCIONAL: Abre o seletor de data ao clicar em qualquer lugar do campo (melhora o UX)
  inputData.onclick = () => {
    if (typeof inputData.showPicker === 'function') {
      inputData.showPicker();
    }
  }
  
  const inputServico = bloco.querySelector('.cliente-servico');
  inputData.onchange = () => gerarHorarios(bloco);
  inputServico.onchange = () => gerarHorarios(bloco);
}
atribuirEventosBloco(document.querySelector('.bloco-agendamento'));

// --- NOVA FUNÇÃO: VERIFICAR RECESSO DINÂMICO ---
async function verificarRecesso(dataSelecionada, bloco) {
  const snapshot = await get(ref(db, 'configuracoes/recesso'));
  const config = snapshot.val();

  if (config && config.ativo && dataSelecionada >= config.inicio && dataSelecionada <= config.fim) {
    // 1. Calcula dia de retorno (dia seguinte ao fim)
    const dataFimObj = new Date(config.fim + 'T12:00:00');
    dataFimObj.setDate(dataFimObj.getDate() + 1);

    // Formato Brasileiro para Texto (Ex: 27/01/2026)
    const retornoStr = dataFimObj.toLocaleDateString('pt-BR');

    // Formato ISO para o Input Date (Ex: 2026-01-27)
    const ano = dataFimObj.getFullYear();
    const mes = String(dataFimObj.getMonth() + 1).padStart(2, '0');
    const dia = String(dataFimObj.getDate()).padStart(2, '0');
    const retornoISO = `${ano}-${mes}-${dia}`;

    // Limpa a data selecionada errada e esconde horários
    bloco.querySelector('.data-agenda').value = "";
    bloco.querySelector('.secao-horarios').style.display = 'none';

    // Remove overlay antigo se existir
    const oldOverlay = document.querySelector('.overlay-recesso');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.className = 'overlay-recesso';
    overlay.style = `position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.8)),url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80');background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;backdrop-filter:blur(5px);`;

    overlay.innerHTML = `
      <div style="background:rgba(20,20,20,0.98);border:2px solid #d4af37;border-radius:20px;padding:40px 30px;max-width:450px;text-align:center;color:white;box-shadow:0 15px 50px rgba(0,0,0,1);">
        <div style="font-size:50px;">🏖️</div>
        <h2 style="color:#d4af37;margin:15px 0;font-family:'Cinzel Decorative',serif;">Pausa para Descanso</h2>
        <p style="color:#eee;margin-bottom:20px;">Informamos que nesta data estaremos fechados para repor as energias.</p>
        <div style="background:rgba(212,175,55,0.1);padding:15px;border-radius:10px;border:1px dashed #d4af37;margin-bottom:20px;">
          <p style="margin:0;">Estaremos de volta dia:<br><strong>${retornoStr}</strong></p>
        </div>
        <button id="btn-reagendar-retorno" style="background:#d4af37;color:#000;border:none;padding:15px;width:100%;border-radius:8px;font-weight:bold;cursor:pointer; text-transform: uppercase;">Agendar para dia ${retornoStr}</button>
      </div>`;

    document.body.appendChild(overlay);

    // LÓGICA DO BOTÃO "AGENDAR PARA DIA X"
    document.getElementById('btn-reagendar-retorno').onclick = () => {
      overlay.remove();
      const inputData = bloco.querySelector('.data-agenda');
      // Define a nova data automaticamente
      inputData.value = retornoISO;
      // Força a geração dos horários para a nova data
      gerarHorarios(bloco);
    };

    return true;
  }
  return false;
}


// --- 3 GERA HORÁRIOS (ATUALIZADO COM FILTRO DE HORA ATUAL) ---
async function gerarHorarios(bloco) {
  const grid = bloco.querySelector('.grid-horarios');
  const dataAg = bloco.querySelector('.data-agenda').value;
  const servId = bloco.querySelector('.cliente-servico').value;

  if (!dataAg || !servId) return;

  // --- NOVA TRAVA DE SEGURANÇA: Bloqueia dias passados ---
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0); // Zera as horas para comparar apenas a data
  const dataSelecionada = new Date(dataAg + 'T00:00:00');

  if (dataSelecionada < hoje) {
    grid.innerHTML = "<p style='color: #ff4444;'>Não é possível agendar em datas passadas.</p>";
    return;
  }
  // -----------------------------------------------------

  const estaDeFolga = await verificarRecesso(dataAg, bloco);
  if (estaDeFolga) return;

  bloco.querySelector('.secao-horarios').style.display = 'block';
  grid.innerHTML = "Carregando...";

  const servico = servicosDisponiveis[servId];
  const dataObjeto = new Date(dataAg + 'T00:00:00');
  const diaChave = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][dataObjeto.getDay()];
  const config = horariosFuncionamento[diaChave];

  if (!config || config.fechado) {
    grid.innerHTML = "<p>Fechado neste dia</p>";
    return;
  }

  // Lógica para pegar a hora atual se for o dia de hoje
  const agora = new Date(); // local
  const hojeFormatoISO = agora.toLocaleDateString('en-CA'); // YYYY-MM-DD local
  const ehHoje = dataAg === hojeFormatoISO;
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();


  onValue(ref(db, 'agendamentos'), (snapshot) => {
    const ags = Object.values(snapshot.val() || {}).filter(a => a.data === dataAg);
    grid.innerHTML = "";

    for (let t = paraMinutos(config.inicio); t <= paraMinutos(config.fim); t += 10) {
      
      // REGRA 1: Verificar se o horário já passou (apenas para o dia de hoje)
      // Adicionamos uma margem de segurança (ex: 5 minutos) se quiser, ou t < minutosAgora direto
      if (ehHoje && t <= minutosAgora) {
        continue; // Pula para o próximo horário do loop, não mostra este.
      }

      const fimN = t + Number(servico.duracao);

      // REGRA 2: Verificar conflito com agendamentos existentes
      const conflito = ags.some(a => {
        const inicioAg = paraMinutos(a.hora);
        const duracaoAg = Number(a.duracao) || 20;
        const fimAg = inicioAg + duracaoAg;
        return t < fimAg && fimN > inicioAg;
      });

      const horaStr = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      const div = document.createElement('div');
      div.className = `horario ${conflito ? 'indisponivel' : ''}`;
      div.innerText = horaStr;

      if (!conflito) {
        div.onclick = () => {
          bloco.querySelectorAll('.horario').forEach(h => h.classList.remove('active'));
          div.classList.add('active');
          bloco.dataset.hora = horaStr;
          btnConfirmarTudo.style.display = 'block';
          atualizarBloqueiosLocais();
        };
      } else {
        div.style.opacity = "0.3";
        div.style.pointerEvents = "none";
      }
      grid.appendChild(div);
    }

    if (grid.innerHTML === "") {
        grid.innerHTML = "<p>Não há mais horários disponíveis para hoje.</p>";
    }
    
    atualizarBloqueiosLocais();
  }, { onlyOnce: true });
}

async function enviarParaWebhook(dados) {
  // Verifique se a URL do ngrok abaixo ainda é a mesma no seu terminal!
  const WEBHOOK_URL = 'https://n8n.oreonsolucoes.dpdns.org/webhook/studio';

  try {
    // O return await é essencial para o loop esperar o envio
    return await fetch(WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify(dados)
    });
    console.log('✅ Agendamento enviado para o n8n!');
  } catch (error) {
    console.error('❌ Erro ao disparar Webhook:', error);
  }
}

// 🔒 CONSULTA SE O CLIENTE ESTÁ BLOQUEADO (ADMIN)
async function verificarClienteBloqueado(whatsapp) {
  const snap = await get(ref(db, `clientesBloqueados/${whatsapp}`));
  return snap.exists();
}

function mostrarModalBloqueado() {
  const telefoneBarbearia = "5511988523575"; // <-- SEU NÚMERO COM DDI
  const mensagem = encodeURIComponent(
    "Opa, tentei fazer um agendamento no site e ele pediu pra agendar por aqui."
  );

  const link = `https://wa.me/${telefoneBarbearia}?text=${mensagem}`;

  const btn = document.getElementById('btn-falar-whats');
  btn.href = link;

  document.getElementById('modal-bloqueado').style.display = 'flex';
}


// --- 4 FINALIZAR AGENDAMENTOS ---
btnConfirmarTudo.onclick = async (e) => {
  e.preventDefault();
  // 1. BLOQUEIO CONTRA CLIQUE DUPLO
  if (btnConfirmarTudo.disabled) return; 
  btnConfirmarTudo.disabled = true;
  btnConfirmarTudo.innerText = "Processando...";
  
  e.stopPropagation(); // 🔒 trava qualquer outro evento

  const blocos = document.querySelectorAll('.bloco-agendamento');

  const whatsapp = blocos[0]
    .querySelector('.cliente-whatsapp')
    .value.replace(/\D/g, '');

  if (!whatsapp) {
    alert("Informe um WhatsApp válido.");
    return;
  }

  // 🔍 DEBUG (IMPORTANTE PARA TESTE)
  console.log("Consultando bloqueio para:", whatsapp);

  const bloqueado = await verificarClienteBloqueado(whatsapp);

  console.log("Bloqueado?", bloqueado);

  if (bloqueado) {
    mostrarModalBloqueado();
    return; // ⛔ PARA TUDO AQUI
  }

  // 🔴 SE CHEGAR AQUI, NÃO ESTÁ BLOQUEADO
  const agendamentosParaSubir = [];

  for (let bloco of blocos) {
    const nome = bloco.querySelector('.cliente-nome').value;
    const whats = bloco.querySelector('.cliente-whatsapp').value.replace(/\D/g, '');
    const servId = bloco.querySelector('.cliente-servico').value;
    const data = bloco.querySelector('.data-agenda').value;
    const hora = bloco.dataset.hora;

    if (!nome || !whats || !hora) {
      alert("Preencha todos os campos!");
      return;
    }

    const serv = servicosDisponiveis[servId];
    const valorBase = Number(serv.preco);

    agendamentosParaSubir.push({
      cliente: nome,
      whatsapp: whats,
      servicoId: servId,
      servicoNome: serv.nome,
      valor: valorBase,
      valorFinal: valorBase,
      valorExtra: 0,
      data,
      hora,
      duracao: Number(serv.duracao),
      formaPagamento: "digital",
      criadoPor: "cliente",
      timestamp: Date.now()
    });

  }

  localStorage.setItem('listaAgendamentos', JSON.stringify(agendamentosParaSubir));

  // --- TRECHO ALTERADO ---
  for (let ag of agendamentosParaSubir) {
    // 1. Gera uma referência vazia para pegar o ID gerado pelo Firebase
    const novaRef = push(ref(db, 'agendamentos'));
    const firebaseId = novaRef.key;

    const agParaFirebase = {
      ...ag,
      id: firebaseId, // <--- ID INJETADO AQUI
      data: ag.data.split('/').reverse().join('-'),
      notificado: false
    };

    // 2. Salva no Firebase usando a referência que já tem o ID
    await set(novaRef, agParaFirebase);
    
    // 3. Envia para o Webhook (agora com o ID incluído no JSON)
    await enviarParaWebhook(agParaFirebase);
  }
  // --- FIM DO TRECHO ALTERADO ---

  mostrarFeedback();
};


// --- 5 SISTEMA DE GESTÃO (ABORDAGEM DE DELEGAÇÃO) ---

btnAbrirGestao.onclick = () => {
  const mg = document.getElementById('modal-gestao');
  if (mg) mg.style.display = 'flex';
};

btnBuscarGestao.onclick = () => {
  const tel = document.getElementById('busca-tel-gestao').value.replace(/\D/g, '');
  if (!tel) return;

  onValue(ref(db, 'agendamentos'), (snapshot) => {
    const ags = snapshot.val() || {};
    const resultado = document.getElementById('resultado-gestao');
    resultado.innerHTML = "";

    Object.entries(ags).forEach(([id, ag]) => {
      if (ag.whatsapp === tel) {
        const item = document.createElement('div');
        item.className = 'item-gestao';
        item.innerHTML = `
                  <p><strong>${ag.data.split('-').reverse().join('/')} às ${ag.hora}</strong><br>${ag.servico}</p>
                  <div class="acoes-gestao">
                    <button class="btn-reagendar" onclick="window.processarAcao('${id}', 'reagendar', '${ag.cliente}', '${ag.whatsapp}')">Reagendar</button>
                    <button class="btn-desistir" onclick="window.processarAcao('${id}', 'excluir')">Desistir</button>
                  </div>
                `;
        resultado.appendChild(item);
      }
    });
  }, { onlyOnce: true });
};

// FUNÇÃO GLOBAL DE PROCESSAMENTO
window.processarAcao = (id, tipo, nome = '', whatsapp = '') => {
  const agRef = ref(db, `agendamentos/${id}`);

  remove(agRef).then(() => {
    if (modalGestao) modalGestao.style.display = 'none';

    const mc = document.getElementById('modal-cancelamento');
    if (mc) {
      const titulo = mc.querySelector('h2');
      const texto = mc.querySelector('p');
      const botao = document.getElementById('btn-reload-gestao');

      if (tipo === 'excluir') {
        if (titulo) titulo.innerText = "Atendimento Descartado";
        if (texto) texto.innerHTML = "Seu agendamento foi excluído com sucesso. <br> Você pode se quiser, prosseguir criando um novo agendamento agora.";
      } else {
        // Reagendamento: preenche os inputs
        const inputNome = document.querySelector('.cliente-nome');
        const inputWhats = document.querySelector('.cliente-whatsapp');
        if (inputNome) inputNome.value = nome;
        if (inputWhats) inputWhats.value = whatsapp;

        if (titulo) titulo.innerText = "HORÁRIO LIBERADO";
        if (texto) texto.innerHTML = "O horário anterior foi removido com sucesso. <br> Escolha o seu novo horário agora.";
      }
      mc.style.display = 'flex';
    }
  }).catch(err => console.error("Erro Firebase:", err));
};

// --- 6 ABORDAGEM DEFINITIVA PARA O BOTÃO (DELEGAÇÃO DE EVENTO) ---

// Ouvimos o clique no documento inteiro
document.addEventListener('click', (event) => {
  // Verificamos se o clique foi no botão pelo ID ou pela CLASSE
  if (event.target && (event.target.id === 'btn-reload-gestao' || event.target.classList.contains('btn-novo-agendamento'))) {
    const mc = document.getElementById('modal-cancelamento');
    if (mc) {
      mc.style.display = 'none'; // Fecha o card
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

function mostrarFeedback() {
  window.location.href = "confirmacao.html";
}

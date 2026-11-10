import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, set, get } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import { PLANOS_ATIVOS, AGENDAS, LACUNA_MAXIMA_MIN } from "./config.js";
import { ic } from "./icones.js";
import { complementosWebhook } from "./mensagens.js";
import { gravarAgendamento, removerAgendamento } from "./espelhos.js";
import { caminho, caminhoRecesso, agendaDoAgendamento, horariosSugeridos } from "./agendas.js";

// ── Agenda escolhida (?agenda=unhas|cabelo). Sem parâmetro: mostra a tela de escolha. ──
const AGENDA_ID = (() => {
    const q = new URLSearchParams(location.search).get('agenda');
    return Object.prototype.hasOwnProperty.call(AGENDAS, q) ? q : null;
})();
const AGENDA_ATUAL = AGENDA_ID || 'unhas';
(function mostrarTelaInicial() {
    const escolha = document.getElementById('escolha-agenda');
    const form = document.getElementById('bookingForm');
    if (AGENDA_ID) {
        if (escolha) escolha.style.display = 'none';
        if (form) form.style.display = '';
        const nome = document.getElementById('nome-agenda-atual');
        if (nome) nome.innerHTML = `${ic(AGENDAS[AGENDA_ID].icone)} ${AGENDAS[AGENDA_ID].nome}`;
    }
})();

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

// ═══════════════════════════════════════════════════════════
// CICLO MENSAL BASEADO NA DATA DE APROVAÇÃO
// Retorna a chave "YYYY-MM-DD" do início do ciclo atual.
// Ex: aprovado dia 15 → ciclo vai de 15/set a 14/out → chave "2026-09-15"
// ═══════════════════════════════════════════════════════════
function calcularPeriodoAtual(dataAprovacao) {
    const agora = new Date();
    const aprovacao = new Date(dataAprovacao);
    const diaRenovacao = aprovacao.getDate();

    // Tenta o ciclo que começa neste mês
    let inicioCiclo = new Date(agora.getFullYear(), agora.getMonth(), diaRenovacao);

    // Se ainda não chegou o dia de renovação neste mês, o ciclo atual começou no mês anterior
    if (agora < inicioCiclo) {
        inicioCiclo = new Date(agora.getFullYear(), agora.getMonth() - 1, diaRenovacao);
    }

    // Formata como "YYYY-MM-DD" para usar como chave no Firebase
    const y = inicioCiclo.getFullYear();
    const m = String(inicioCiclo.getMonth() + 1).padStart(2, '0');
    const d = String(inicioCiclo.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const containerAgendamentos = document.getElementById('container-agendamentos');
const btnAddPessoa = document.getElementById('btn-add-pessoa');
const btnConfirmarTudo = document.getElementById('btn-confirmar-tudo');
const modalGestao = document.getElementById('modal-gestao');
const btnAbrirGestao = document.getElementById('btn-abrir-gestao');
const btnBuscarGestao = document.getElementById('btn-buscar-gestao');
const modalSucesso = document.getElementById('modal-sucesso');

let horariosFuncionamento = {};
let servicosDisponiveis = {};
let assinaturaAtiva = null;

if (PLANOS_ATIVOS) {
    const wrapPlanos = document.getElementById('wrap-planos');
    if (wrapPlanos) wrapPlanos.style.display = 'block';
}

function paraMinutos(horaStr) {
    // A aba "Horários" do admin grava hora inteira (ex.: 9); os agendamentos usam "HH:MM".
    if (typeof horaStr === 'number') return horaStr * 60;
    const [h, m] = String(horaStr).split(':').map(Number);
    return h * 60 + (m || 0);
}

// --- CARREGA SERVIÇOS E HORÁRIOS ---
onValue(ref(db, caminho('servicos', AGENDA_ATUAL)), (snapshot) => {
    servicosDisponiveis = snapshot.val() || {};
    renderizarSelectServicos();
});
onValue(ref(db, caminho('horarios_funcionamento', AGENDA_ATUAL)), (snapshot) => {
    horariosFuncionamento = snapshot.val() || {};
});

// ═══════════════════════════════════════════════════════════
// RENDERIZAR SELECT
// ─ Plano Flex  → 2 opções independentes (__flex__<key>)
// ─ Plano Normal → 1 opção (__plano__)
// ─ Avulso       → lista normal
// ═══════════════════════════════════════════════════════════
function renderizarSelectServicos(plano = null) {
    const selects = document.querySelectorAll('.cliente-servico');
    const listaOrdenada = Object.entries(servicosDisponiveis)
        .sort(([, a], [, b]) => (a.ordem || 99) - (b.ordem || 99));
    const periodoAtual = plano?.dataAprovacao
        ? calcularPeriodoAtual(plano.dataAprovacao)
        : new Date().toISOString().slice(0, 7);

    selects.forEach(sel => {
        const valorAtual = sel.value;
        sel.innerHTML = `<option value="">Selecione um serviço</option>`;

        if (plano && plano.status === 'ativo') {

            // ── PLANO FLEX ──────────────────────────────────────
            if (plano.isFlex && plano.servicosFlex) {
                Object.entries(plano.servicosFlex).forEach(([key, sf]) => {
                    const usos = (plano.usosFlexNoMes?.[periodoAtual]?.[key]) || 0;
                    const max = sf.maxUsos || 2;
                    const restam = max - usos;
                    const proximo = ['1º', '2º', '3º', '4º'][usos] || `${usos + 1}º`;

                    if (restam > 0) {
                        const opt = document.createElement('option');
                        opt.value = `__flex__${key}`;
                        opt.textContent = `${sf.nome} — ${proximo} uso (${restam} restante${restam > 1 ? 's' : ''})`;
                        opt.style.fontWeight = 'bold';
                        sel.appendChild(opt);
                    } else {
                        const opt = document.createElement('option');
                        opt.disabled = true;
                        opt.textContent = `${sf.nome} — esgotado neste ciclo`;
                        sel.appendChild(opt);
                    }
                });
                const sep = document.createElement('option');
                sep.disabled = true;
                sep.textContent = '──── Serviços Avulsos ────';
                sel.appendChild(sep);

                // ── PLANO NORMAL ─────────────────────────────────────
            } else if (!plano.isFlex) {
                const usos = (plano.usosNoMes?.[periodoAtual]) || 0;
                const maxUsos = plano.maxUsosMes || 4;

                if (usos < maxUsos) {
                    const ordinal = ['1º', '2º', '3º', '4º'][usos] || `${usos + 1}º`;
                    const opt = document.createElement('option');
                    opt.value = '__plano__';
                    opt.textContent = `${plano.planoNome} — ${ordinal} atendimento (incluso)`;
                    opt.style.fontWeight = 'bold';
                    sel.appendChild(opt);
                } else {
                    const opt = document.createElement('option');
                    opt.disabled = true;
                    opt.textContent = `Usos do plano esgotados neste ciclo — use os serviços avulsos`;
                    sel.appendChild(opt);
                }
                const sep = document.createElement('option');
                sep.disabled = true;
                sep.textContent = '──── Serviços Avulsos ────';
                sel.appendChild(sep);
            }
        }

        // ── Serviços avulsos normais ──
        listaOrdenada.forEach(([id, s]) => {
            const texto = (s.aCombinar || Number(s.preco) === 0)
                ? `${s.nome} — A combinar`
                : `${s.nome} — R$${s.preco}`;
            sel.innerHTML += `<option value="${id}">${texto}</option>`;
        });

        sel.value = valorAtual;
    });
}

// ═══════════════════════════════════════════════════════════
// BANNER DO PLANO
// ═══════════════════════════════════════════════════════════
function exibirBannerPlano(bloco, ass) {
    removerBannerPlano(bloco);
    const periodoAtual = ass.dataAprovacao
        ? calcularPeriodoAtual(ass.dataAprovacao)
        : new Date().toISOString().slice(0, 7);
    const banner = document.createElement('div');
    banner.id = 'banner-plano';
    banner.style.cssText = 'background:rgba(212,175,55,.12);border:1px solid var(--dourado);border-radius:8px;padding:10px 14px;margin-top:10px;font-size:.82rem;color:var(--dourado);line-height:1.6;';

    if (ass.isFlex && ass.servicosFlex) {
        // Banner Flex: mostra contador individual de cada serviço
        let html = `${ic('estrela')} <strong>${ass.planoNome}</strong> ativo!<br>`;
        Object.entries(ass.servicosFlex).forEach(([key, sf]) => {
            const usos = (ass.usosFlexNoMes?.[periodoAtual]?.[key]) || 0;
            const max = sf.maxUsos || 2;
            const emoji = usos < max ? ic('ok') : ic('proibido');
            html += `${emoji} ${sf.nome}: <strong>${usos}/${max}</strong> usos<br>`;
        });
        banner.innerHTML = html;
    } else {
        // Banner Normal
        const usos = (ass.usosNoMes?.[periodoAtual]) || 0;
        const max = ass.maxUsosMes || 4;
        banner.innerHTML = `
      ${ic('estrela')} <strong>${ass.planoNome}</strong> ativo!
      Usos neste ciclo: <strong>${usos}/${max}</strong>
      ${usos >= max ? `<br>${ic('alerta')} Usos esgotados — apenas serviços avulsos disponíveis.` : ''}
    `;
    }

    const sel = bloco.querySelector('.cliente-servico');
    sel.parentNode.insertBefore(banner, sel.nextSibling);
}

function removerBannerPlano(bloco) {
    const b = document.getElementById('banner-plano');
    if (b) b.remove();
}

// ═══════════════════════════════════════════════════════════
// SELETOR DE ADICIONAL — apenas para planos normais (não Flex)
// ═══════════════════════════════════════════════════════════
function exibirSeletorAdicional(bloco, adicionais) {
    removerSeletorAdicional(bloco);
    if (!adicionais || adicionais.length === 0) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'seletor-adicional';
    wrapper.style.cssText = 'margin-top:14px;';
    wrapper.innerHTML = `
    <label style="display:block;color:var(--dourado);font-weight:500;margin-bottom:8px;font-size:.9rem;">
      Adicional incluso no seu plano:
    </label>
    <div style="display:flex;flex-wrap:wrap;gap:8px;" id="opcoes-adicional"></div>
    <p style="font-size:.75rem;opacity:.6;margin-top:6px;">Selecione 1 adicional incluso.</p>
  `;

    const grid = wrapper.querySelector('#opcoes-adicional');

    adicionais.forEach(ad => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = ad;
        btn.dataset.adicional = ad;
        btn.style.cssText = `
      padding:7px 14px; border-radius:20px; border:1px solid #555;
      background:transparent; color:#ccc; cursor:pointer;
      font-size:.82rem; transition:.2s; font-family:'Poppins',sans-serif;
    `;
        btn.onclick = () => {
            grid.querySelectorAll('button').forEach(b => {
                b.style.background = 'transparent';
                b.style.color = '#ccc';
                b.style.borderColor = '#555';
                b.style.fontWeight = 'normal';
            });
            btn.style.background = 'var(--dourado)';
            btn.style.color = '#000';
            btn.style.borderColor = 'var(--dourado)';
            btn.style.fontWeight = 'bold';
            wrapper.dataset.selecionado = ad;
        };
        grid.appendChild(btn);
    });

    const secaoHorarios = bloco.querySelector('.secao-horarios');
    bloco.insertBefore(wrapper, secaoHorarios);
}

function removerSeletorAdicional(bloco) {
    const s = document.getElementById('seletor-adicional');
    if (s) s.remove();
}

// ═══════════════════════════════════════════════════════════
// VERIFICAR PLANO AO DIGITAR TELEFONE
// ═══════════════════════════════════════════════════════════
function iniciarVerificacaoPlano(bloco) {
    if (!PLANOS_ATIVOS) return; // planos desligados em js/config.js
    const inputWhats = bloco.querySelector('.cliente-whatsapp');
    if (!inputWhats) return;

    let debounceTimer;
    inputWhats.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const tel = inputWhats.value.replace(/\D/g, '');
            if (tel.length < 10) {
                assinaturaAtiva = null;
                renderizarSelectServicos(null);
                removerBannerPlano(bloco);
                removerSeletorAdicional(bloco);
                return;
            }

            const snap = await get(ref(db, `assinaturas/${tel}`));
            if (snap.exists() && snap.val().status === 'ativo') {
                assinaturaAtiva = snap.val();
                renderizarSelectServicos(assinaturaAtiva);
                exibirBannerPlano(bloco, assinaturaAtiva);
            } else {
                assinaturaAtiva = null;
                renderizarSelectServicos(null);
                removerBannerPlano(bloco);
                removerSeletorAdicional(bloco);
            }
        }, 600);
    });
}

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

// --- MULTI-AGENDAMENTO ---
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
    const inputServico = bloco.querySelector('.cliente-servico');

    inputData.min = new Date().toLocaleDateString('en-CA');
    inputData.onkeydown = (e) => e.preventDefault();
    inputData.onclick = () => { if (typeof inputData.showPicker === 'function') inputData.showPicker(); };
    inputData.onchange = () => gerarHorarios(bloco);

    // Ao mudar o serviço: mostra seletor de adicional (só para plano normal)
    inputServico.onchange = () => {
        const val = inputServico.value;
        if (val === '__plano__' && assinaturaAtiva && !assinaturaAtiva.isFlex && assinaturaAtiva.adicionais?.length > 0) {
            exibirSeletorAdicional(bloco, assinaturaAtiva.adicionais);
        } else {
            removerSeletorAdicional(bloco);
        }
        gerarHorarios(bloco);
    };

    iniciarVerificacaoPlano(bloco);
}
atribuirEventosBloco(document.querySelector('.bloco-agendamento'));

// --- NOVA FUNÇÃO: VERIFICAR RECESSO DINÂMICO ---
async function verificarRecesso(dataSelecionada, bloco) {
  const snapshot = await get(ref(db, caminhoRecesso(AGENDA_ATUAL)));
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
      <div style="background:rgba(38,24,15,0.98);border:2px solid #d4af37;border-radius:20px;padding:40px 30px;max-width:450px;text-align:center;color:white;box-shadow:0 15px 50px rgba(0,0,0,1);">
        <div style="font-size:44px;color:#d4af37;">${ic('ferias','ic-xl')}</div>
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

// --- GERAR HORÁRIOS ---
async function gerarHorarios(bloco) {
    const grid = bloco.querySelector('.grid-horarios');
    const dataAg = bloco.querySelector('.data-agenda').value;
    const servId = bloco.querySelector('.cliente-servico').value;
    if (!dataAg || !servId) return;

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    if (new Date(dataAg + 'T00:00:00') < hoje) {
        grid.innerHTML = "<p style='color:#ff4444;'>Não é possível agendar em datas passadas.</p>";
        return;
    }

    const estaDeFolga = await verificarRecesso(dataAg, bloco);
    if (estaDeFolga) return;

    bloco.querySelector('.secao-horarios').style.display = 'block';
    grid.innerHTML = "Carregando...";

    // Duração: flex usa serviço real, plano normal usa duração do serviço corte (ou 20), avulso usa duracao do serviço
    let duracaoServico = 20;
    if (servId.startsWith('__flex__') && assinaturaAtiva?.servicosFlex) {
        const flexKey = servId.replace('__flex__', '');
        const sfId = assinaturaAtiva.servicosFlex[flexKey]?.servicoId;
        if (sfId && servicosDisponiveis[sfId]) {
            duracaoServico = Number(servicosDisponiveis[sfId].duracao) || 20;
        }
    } else if (servId === '__plano__') {
        duracaoServico = Number(servicosDisponiveis[assinaturaAtiva?.servicoId]?.duracao) || 20;
    } else if (servicosDisponiveis[servId]) {
        duracaoServico = Number(servicosDisponiveis[servId].duracao) || 20;
    }

    const diaChave = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][new Date(dataAg + 'T00:00:00').getDay()];
    const config = horariosFuncionamento[diaChave];
    if (!config || config.fechado) { grid.innerHTML = "<p>Fechado neste dia.</p>"; return; }

    const agora = new Date();
    const ehHoje = dataAg === agora.toLocaleDateString('en-CA');
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

    // Lê só a ocupação do dia desta agenda (público, sem dados pessoais).
    onValue(ref(db, `ocupacao/${AGENDA_ATUAL}/${dataAg}`), (snapshot) => {
        const ags = Object.values(snapshot.val() || {});
        grid.innerHTML = "";

        const abertura = paraMinutos(config.inicio);
        const fechamento = paraMinutos(config.fim);
        const starts = [];
        for (let t = abertura; t <= fechamento; t += 10) {
            if (ehHoje && t <= minutosAgora) continue;
            starts.push(t);
        }
        const ocupados = ags.map(a => {
            const ini = paraMinutos(a.hora);
            return { ini, fim: ini + (Number(a.duracao) || 20) };
        });
        // Só mostra horários que encaixam (sem lacunas grandes) — ver LACUNA_MAXIMA_MIN em config.js
        const sugeridos = horariosSugeridos(starts, duracaoServico, ocupados, abertura, fechamento, LACUNA_MAXIMA_MIN);

        for (const t of sugeridos) {
            const horaStr = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
            const div = document.createElement('div');
            div.className = 'horario';
            div.innerText = horaStr;
            div.onclick = () => {
                bloco.querySelectorAll('.horario').forEach(h => h.classList.remove('active'));
                div.classList.add('active');
                bloco.dataset.hora = horaStr;
                btnConfirmarTudo.style.display = 'block';
                atualizarBloqueiosLocais();
            };
            grid.appendChild(div);
        }

        if (grid.innerHTML === "") grid.innerHTML = "<p>Não há mais horários disponíveis para hoje.</p>";
        atualizarBloqueiosLocais();
    }, { onlyOnce: true });
}

async function enviarParaWebhook(dados) {
    try {
        // texto da confirmação (editável no painel) — o n8n envia exatamente este campo
        dados = { ...dados, ...(await complementosWebhook(db, dados)) };
        return await fetch('https://n8n.oreonsolucoes.dpdns.org/webhook/studio', {
            method: 'POST', mode: 'no-cors',
            headers: { 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify(dados)
        });
    } catch (error) { console.error('Erro webhook:', error); }
}

async function verificarClienteBloqueado(whatsapp) {
    return (await get(ref(db, `clientesBloqueados/${whatsapp}`))).exists();
}

function mostrarModalBloqueado() {
    const msg = encodeURIComponent("Opa, tentei fazer um agendamento no site e ele pediu pra agendar por aqui.");
    document.getElementById('btn-falar-whats').href = `https://wa.me/5511988523575?text=${msg}`;
    document.getElementById('modal-bloqueado').style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════
// FINALIZAR AGENDAMENTOS
// ═══════════════════════════════════════════════════════════
btnConfirmarTudo.onclick = async (e) => {
    e.preventDefault();
    if (btnConfirmarTudo.disabled) return;

    const blocos = document.querySelectorAll('.bloco-agendamento');
    const campoWhats = blocos[0].querySelector('.cliente-whatsapp');
    const whatsappNum = campoWhats.value.replace(/\D/g, '');

    if (whatsappNum.length < 10) {
        alert("WhatsApp incompleto. Digite com DDD. Ex: (11) 99999-8888");
        campoWhats.focus(); return;
    }

    btnConfirmarTudo.disabled = true;
    btnConfirmarTudo.innerText = "Processando...";
    e.stopPropagation();

    if (await verificarClienteBloqueado(whatsappNum)) {
        mostrarModalBloqueado();
        btnConfirmarTudo.disabled = false;
        btnConfirmarTudo.innerText = "Confirmar Agendamento(s)";
        return;
    }

    const agendamentosParaSubir = [];

    for (let bloco of blocos) {
        const nome = bloco.querySelector('.cliente-nome').value;
        const whats = bloco.querySelector('.cliente-whatsapp').value.replace(/\D/g, '');
        const servId = bloco.querySelector('.cliente-servico').value;
        const data = bloco.querySelector('.data-agenda').value;
        const hora = bloco.dataset.hora;

        if (!nome || !whats || !hora || !servId) {
            alert("Preencha todos os campos!");
            btnConfirmarTudo.disabled = false;
            btnConfirmarTudo.innerText = "Confirmar Agendamento(s)";
            return;
        }

        // ══════════════════════════════════════════════
        // PLANO FLEX (__flex__<key>)
        // ══════════════════════════════════════════════
        if (servId.startsWith('__flex__') && assinaturaAtiva?.isFlex) {
            const ass = assinaturaAtiva;
            const flexKey = servId.replace('__flex__', '');
            const sf = ass.servicosFlex?.[flexKey];
            if (!sf) { alert('Serviço do plano não encontrado.'); btnConfirmarTudo.disabled = false; btnConfirmarTudo.innerText = "Confirmar Agendamento(s)"; return; }

            const periodoAtual = ass.dataAprovacao
                ? calcularPeriodoAtual(ass.dataAprovacao)
                : new Date().toISOString().slice(0, 7);

            const usosAtual = (ass.usosFlexNoMes?.[periodoAtual]?.[flexKey]) || 0;
            if (usosAtual >= (sf.maxUsos || 2)) {
                alert(`Usos de "${sf.nome}" esgotados neste ciclo.`);
                btnConfirmarTudo.disabled = false; btnConfirmarTudo.innerText = "Confirmar Agendamento(s)"; return;
            }

            // 1ª vez no ciclo = cobra; demais = R$0
            const totalUsosAtual = Object.keys(ass.servicosFlex).reduce((sum, k) => {
                return sum + ((ass.usosFlexNoMes?.[periodoAtual]?.[k]) || 0);
            }, 0);
            const ehPrimeiro = totalUsosAtual === 0;
            const valorFinal = ehPrimeiro ? Number(ass.planoPreco) : 0;
            const ordinal = ['1º', '2º', '3º', '4º'][usosAtual] || `${usosAtual + 1}º`;
            const sfServico = servicosDisponiveis[sf.servicoId];
            const duracao = sfServico ? Number(sfServico.duracao) : 20;

            agendamentosParaSubir.push({
                cliente: nome, whatsapp: whats,
                servicoId: `plano_flex_${flexKey}`,
                servicoNome: `${sf.nome} — ${ordinal} uso (Plano Flex)`,
                valor: valorFinal, valorFinal, valorExtra: 0,
                data, hora, duracao,
                formaPagamento: ehPrimeiro ? 'pendente_plano' : 'plano_incluso',
                criadoPor: 'cliente', ehPlano: true, isFlex: true,
                planoId: ass.planoId, planoNome: ass.planoNome,
                flexKey, usoNumero: usosAtual + 1, timestamp: Date.now()
            });

            await update(ref(db, `assinaturas/${whats}/usosFlexNoMes/${periodoAtual}`), {
                [flexKey]: usosAtual + 1
            });

            if (ehPrimeiro) {
                await set(ref(db, `planoCobrancas/${periodoAtual}/${whats}`), {
                    telefone: whats, nome, planoNome: ass.planoNome,
                    planoPreco: ass.planoPreco, status: 'pendente', criadoEm: Date.now()
                });
            }

            // ══════════════════════════════════════════════
            // PLANO NORMAL (__plano__)
            // ══════════════════════════════════════════════
        } else if (servId === '__plano__' && assinaturaAtiva && !assinaturaAtiva.isFlex) {
            const ass = assinaturaAtiva;
            const periodoAtual = ass.dataAprovacao
                ? calcularPeriodoAtual(ass.dataAprovacao)
                : new Date().toISOString().slice(0, 7);
            const usos = (ass.usosNoMes?.[periodoAtual]) || 0;
            const maxUsos = ass.maxUsosMes || 4;

            if (usos >= maxUsos) {
                alert('Você já utilizou todos os atendimentos do plano neste ciclo.');
                btnConfirmarTudo.disabled = false; btnConfirmarTudo.innerText = "Confirmar Agendamento(s)"; return;
            }

            // Adicional selecionado (planos normais com adicionais)
            const seletorWrapper = document.getElementById('seletor-adicional');
            const adicionalSelecionado = seletorWrapper ? seletorWrapper.dataset.selecionado : null;
            if (ass.adicionais?.length > 0 && !adicionalSelecionado) {
                alert('Selecione o adicional incluso no seu plano.');
                btnConfirmarTudo.disabled = false; btnConfirmarTudo.innerText = "Confirmar Agendamento(s)"; return;
            }

            const ordinal = ['1º', '2º', '3º', '4º'][usos] || `${usos + 1}º`;
            const valorFinal = usos === 0 ? Number(ass.planoPreco) : 0;
            const nomeServico = `${ass.planoNome} — ${ordinal} atendimento${adicionalSelecionado ? ` + ${adicionalSelecionado}` : ''}`;

            agendamentosParaSubir.push({
                cliente: nome, whatsapp: whats,
                servicoId: `plano_${ass.planoId}`,
                servicoNome: nomeServico,
                valor: valorFinal, valorFinal, valorExtra: 0,
                data, hora, duracao: Number(servicosDisponiveis[ass.servicoId]?.duracao) || 20,
                formaPagamento: usos === 0 ? 'pendente_plano' : 'plano_incluso',
                criadoPor: 'cliente', ehPlano: true, isFlex: false,
                planoId: ass.planoId, planoNome: ass.planoNome,
                adicional: adicionalSelecionado || null,
                usoNumero: usos + 1, timestamp: Date.now()
            });

            await update(ref(db, `assinaturas/${whats}/usosNoMes`), { [periodoAtual]: usos + 1 });

            if (usos === 0) {
                await set(ref(db, `planoCobrancas/${periodoAtual}/${whats}`), {
                    telefone: whats, nome, planoNome: ass.planoNome,
                    planoPreco: ass.planoPreco, status: 'pendente', criadoEm: Date.now()
                });
            }

            // ══════════════════════════════════════════════
            // AVULSO NORMAL
            // ══════════════════════════════════════════════
        } else {
            const serv = servicosDisponiveis[servId];
            if (!serv) { alert('Serviço inválido.'); btnConfirmarTudo.disabled = false; btnConfirmarTudo.innerText = "Confirmar Agendamento(s)"; return; }
            agendamentosParaSubir.push({
                cliente: nome, whatsapp: whats,
                servicoId: servId, servicoNome: serv.nome,
                valor: Number(serv.preco), valorFinal: Number(serv.preco), valorExtra: 0,
                data, hora, duracao: Number(serv.duracao),
                formaPagamento: 'digital', criadoPor: 'cliente',
                ehPlano: false, timestamp: Date.now()
            });
        }
    }

    localStorage.setItem('listaAgendamentos', JSON.stringify(agendamentosParaSubir));

    for (let ag of agendamentosParaSubir) {
        const novaRef = push(ref(db, 'agendamentos'));
        const agParaFirebase = {
            ...ag, id: novaRef.key, agendaId: AGENDA_ATUAL,
            data: ag.data.split('/').reverse().join('-'),
            notificado: false
        };
        await gravarAgendamento(db, novaRef.key, agParaFirebase);
        await enviarParaWebhook(agParaFirebase);
    }

    window.location.href = "confirmacao.html";
};

// --- GESTÃO ---
btnAbrirGestao.onclick = () => {
    const mg = document.getElementById('modal-gestao');
    if (mg) mg.style.display = 'flex';
};

btnBuscarGestao.onclick = () => {
    const tel = document.getElementById('busca-tel-gestao').value.replace(/\D/g, '');
    if (!tel) return;
    // Busca pelo telefone no resumo público (a lista completa de agendamentos é restrita à equipe).
    onValue(ref(db, `agendamentosPorTelefone/${tel}`), (snapshot) => {
        const ags = snapshot.val() || {};
        const resultado = document.getElementById('resultado-gestao');
        resultado.innerHTML = "";
        Object.entries(ags).forEach(([id, ag]) => {
            if (ag && ag.data) {
                const item = document.createElement('div');
                item.className = 'item-gestao';
                item.innerHTML = `
          <p><strong>${ag.data.split('-').reverse().join('/')} às ${ag.hora}</strong><br>${ag.servicoNome || ag.servico} <small>(${AGENDAS[agendaDoAgendamento(ag)].nome})</small></p>
          <div class="acoes-gestao">
            <button class="btn-reagendar" onclick="window.processarAcao('${id}','reagendar','${ag.cliente}','${tel}','${ag.agendaId || 'unhas'}','${ag.data}')">Reagendar</button>
            <button class="btn-desistir"  onclick="window.processarAcao('${id}','excluir','','${tel}','${ag.agendaId || 'unhas'}','${ag.data}')">Desistir</button>
          </div>`;
                resultado.appendChild(item);
            }
        });
    }, { onlyOnce: true });
};

window.processarAcao = (id, tipo, nome = '', whatsapp = '', agendaId = 'unhas', data = '') => {
    removerAgendamento(db, id, { agendaId, data, whatsapp }).then(() => {
        if (modalGestao) modalGestao.style.display = 'none';
        const mc = document.getElementById('modal-cancelamento');
        if (mc) {
            const titulo = mc.querySelector('h2');
            const texto = mc.querySelector('p');
            if (tipo === 'excluir') {
                if (titulo) titulo.innerText = "Atendimento Descartado";
                if (texto) texto.innerHTML = "Seu agendamento foi excluído com sucesso.<br>Você pode criar um novo agora.";
            } else {
                const inputNome = document.querySelector('.cliente-nome');
                const inputWhats = document.querySelector('.cliente-whatsapp');
                if (inputNome) inputNome.value = nome;
                if (inputWhats) inputWhats.value = whatsapp;
                if (titulo) titulo.innerText = "HORÁRIO LIBERADO";
                if (texto) texto.innerHTML = "O horário foi removido. Escolha um novo horário.";
            }
            mc.style.display = 'flex';
        }
    }).catch(err => console.error("Erro Firebase:", err));
};

document.addEventListener('click', (event) => {
    if (event.target && (event.target.id === 'btn-reload-gestao' || event.target.classList.contains('btn-novo-agendamento'))) {
        const mc = document.getElementById('modal-cancelamento');
        if (mc) mc.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

function mostrarFeedback() {
    window.location.href = "confirmacao.html";
}

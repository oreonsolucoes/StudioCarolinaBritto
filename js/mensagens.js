// Mensagem de confirmação enviada à cliente (via webhook do n8n).
// O texto é editável no painel (aba "Mensagem") e fica em configuracoes/mensagens/confirmacao_<agenda>.
import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

export const MENSAGEM_PADRAO =
`Olá, {nome}! Tudo bem? ✨

Passando para dizer que o seu momento de beleza já está reservado aqui no {studio}!
Estamos muito felizes em cuidar de você. 🌹🌸

Confira os detalhes da sua reserva:
💅 *Serviço: {servico}*
📅 *Data: {data}*
⏰ *Horário: {hora}*

📍 Onde estamos: _R. Dez de Março, 313 - Jardim Sao Salvador._

Preparamos um ambiente aconchegante para que sua experiência seja única. ☕️✨
Se precisar de qualquer ajuste, pedimos a gentileza de nos avisar com antecedência por aqui.

*Estamos ansiosas pelo nosso encontro! Até logo.* 🎀✨`;

export const VARIAVEIS = [
  { chave: 'nome',    rotulo: 'Nome da cliente' },
  { chave: 'servico', rotulo: 'Serviço' },
  { chave: 'data',    rotulo: 'Data (dd/mm/aaaa)' },
  { chave: 'dia',     rotulo: 'Dia da semana' },
  { chave: 'hora',    rotulo: 'Horário' },
  { chave: 'valor',   rotulo: 'Valor' },
  { chave: 'agenda',  rotulo: 'Agenda (Unhas/Cabelo)' },
  { chave: 'studio',  rotulo: 'Nome do Studio' },
];

const DIAS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const NOME_AGENDA = { unhas: 'Unhas', cabelo: 'Cabelo' };

export function caminhoMensagem(agendaId) {
  return `configuracoes/mensagens/confirmacao_${agendaId === 'cabelo' ? 'cabelo' : 'unhas'}`;
}

// ag.data em AAAA-MM-DD (ou dd/mm/aaaa). Devolve os valores de cada variável.
export function dadosDaMensagem(ag) {
  let iso = String(ag.data || '');
  if (iso.includes('/')) iso = iso.split('/').reverse().join('-');
  const [a, m, d] = iso.split('-');
  const dt = new Date(`${iso}T12:00:00`);
  const valor = Number(ag.valorFinal ?? ag.valor ?? 0);
  const agenda = ag.agendaId === 'cabelo' ? 'cabelo' : 'unhas';
  return {
    nome: ag.cliente || '',
    servico: ag.servicoNome || ag.servico || '',
    data: d ? `${d}/${m}/${a}` : '',
    dia: isNaN(dt) ? '' : DIAS[dt.getDay()],
    hora: ag.hora || '',
    valor: `R$ ${valor.toFixed(2).replace('.', ',')}`,
    agenda: NOME_AGENDA[agenda],
    studio: 'Studio Carolina Britto',
  };
}

// Troca {variavel} pelo valor; variável desconhecida fica como está.
export function renderizar(template, dados) {
  return String(template || '').replace(/\{(\w+)\}/g, (txt, k) => (k in dados ? dados[k] : txt));
}

export async function carregarTemplate(db, agendaId) {
  try {
    const snap = await get(ref(db, caminhoMensagem(agendaId)));
    const t = snap.val();
    return (typeof t === 'string' && t.trim()) ? t : MENSAGEM_PADRAO;
  } catch (e) {
    return MENSAGEM_PADRAO;
  }
}

// Campos extras do webhook para o n8n:
//   mensagem               texto pronto da confirmação
//   caminho                nó do agendamento no Realtime Database
//   campoMensagemEnviada   onde o n8n grava o texto realmente enviado (agendamentos/<id>/mensagemEnviada)
export async function complementosWebhook(db, ag) {
  return {
    mensagem: await montarMensagem(db, ag),
    caminho: `agendamentos/${ag.id}`,
    campoMensagemEnviada: `agendamentos/${ag.id}/mensagemEnviada`,
  };
}

export async function montarMensagem(db, ag) {
  const tpl = await carregarTemplate(db, ag.agendaId);
  return renderizar(tpl, dadosDaMensagem(ag));
}

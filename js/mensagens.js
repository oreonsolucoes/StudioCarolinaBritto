// Mensagem de confirmação enviada à cliente (via webhook do n8n).
// O texto é editável no painel (aba "Mensagem") e fica em configuracoes/mensagens/confirmacao_<agenda>.
import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

export const MENSAGEM_PADRAO =
`Olá, {nome}! Seu agendamento no {studio} está confirmado.

Serviço: *{servico}*
Data: {dia}, {data}
Horário: {hora}

Caso precise remarcar, avise com antecedência. Esperamos por você!`;

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

export async function montarMensagem(db, ag) {
  const tpl = await carregarTemplate(db, ag.agendaId);
  return renderizar(tpl, dadosDaMensagem(ag));
}

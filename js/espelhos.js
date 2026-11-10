// Espelhos públicos de um agendamento (necessários para as regras de segurança do Firebase).
//   agendamentos/<id>                              -> dados completos (só equipe lê)
//   ocupacao/<agenda>/<AAAA-MM-DD>/<id>            -> {hora, duracao}   (público: mostra horários ocupados, sem dados pessoais)
//   agendamentosPorTelefone/<whatsapp>/<id>        -> resumo para a cliente reagendar/desistir pelo próprio telefone
// Toda criação/remoção de agendamento deve passar por aqui.
import { ref, update, remove, push } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

const SEM_TEL = '00000000000';

export function caminhosEspelho(id, ag) {
  const agenda = ag.agendaId === 'cabelo' ? 'cabelo' : 'unhas';
  const c = { ocupacao: `ocupacao/${agenda}/${ag.data}/${id}`, tel: null };
  if (ag.cliente !== 'BLOQUEADO' && ag.whatsapp && ag.whatsapp !== SEM_TEL) {
    c.tel = `agendamentosPorTelefone/${ag.whatsapp}/${id}`;
  }
  return c;
}

export function novoId(db) {
  return push(ref(db, 'agendamentos')).key;
}

// Grava agendamento + espelhos numa única operação atômica.
export function gravarAgendamento(db, id, ag) {
  const c = caminhosEspelho(id, ag);
  const u = {};
  u[`agendamentos/${id}`] = ag;
  u[c.ocupacao] = { hora: ag.hora, duracao: Number(ag.duracao) || 20 };
  if (c.tel) {
    u[c.tel] = {
      agendaId: ag.agendaId === 'cabelo' ? 'cabelo' : 'unhas',
      data: ag.data, hora: ag.hora,
      servicoNome: ag.servicoNome || '', cliente: ag.cliente || ''
    };
  }
  return update(ref(db), u);
}

// Remove o agendamento primeiro e só depois os espelhos (as regras exigem essa ordem para a cliente).
export async function removerAgendamento(db, id, ag) {
  await remove(ref(db, `agendamentos/${id}`));
  const c = caminhosEspelho(id, ag);
  const u = { [c.ocupacao]: null };
  if (c.tel) u[c.tel] = null;
  await update(ref(db), u);
}

// Usado quando a equipe troca o serviço de um agendamento (muda a duração).
export function atualizarDuracaoEspelho(db, id, ag, duracao) {
  const c = caminhosEspelho(id, ag);
  const u = { [`${c.ocupacao}/duracao`]: Number(duracao) || 20 };
  if (c.tel) u[`${c.tel}/servicoNome`] = ag.servicoNome || '';
  return update(ref(db), u);
}

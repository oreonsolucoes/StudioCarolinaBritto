// Helpers de agenda e permissão (funções puras — testáveis em Node).
import { AGENDAS, AGENDA_PADRAO, PERMISSOES } from "./config.js";

export function agendaValida(id) {
  return Object.prototype.hasOwnProperty.call(AGENDAS, id) ? id : AGENDA_PADRAO;
}

// Agendamento sem agendaId (legado) pertence à agenda de unhas.
export function agendaDoAgendamento(ag) {
  return agendaValida(ag && ag.agendaId);
}

// caminho('servicos','cabelo') -> 'servicos_cabelo'; caminho('servicos','unhas') -> 'servicos'
export function caminho(base, agendaId) {
  return base + AGENDAS[agendaValida(agendaId)].sufixo;
}

export function caminhoRecesso(agendaId) {
  const id = agendaValida(agendaId);
  return 'configuracoes/recesso' + AGENDAS[id].sufixo;
}

// perfil = { papel, agendas:{cabelo:true} } ou null
export function agendasPermitidas(perfil) {
  const p = perfil && PERMISSOES[perfil.papel];
  if (!p) return [];
  if (p.agendas === 'todas') return Object.keys(AGENDAS);
  const lista = (perfil.agendas) || {};
  return Object.keys(AGENDAS).filter(id => lista[id] === true);
}

export function podeAgenda(perfil, agendaId) {
  return agendasPermitidas(perfil).includes(agendaId);
}

export function podeFinanceiro(perfil) {
  const p = perfil && PERMISSOES[perfil.papel];
  return !!(p && p.financeiro);
}

// Sugere só horários que "encaixam" na agenda do dia, evitando buracos grandes.
// starts: inícios possíveis (min); dur: duração do serviço (min);
// ocupados: [{ini,fim}] (clientes + bloqueios); abertura/fechamento em min; tol: lacuna máxima.
// Dia sem nenhum agendamento: mostra tudo. Se o filtro não deixar nada, mostra todos os livres.
export function horariosSugeridos(starts, dur, ocupados, abertura, fechamento, tol) {
  const livres = starts.filter(t => !ocupados.some(o => t < o.fim && t + dur > o.ini));
  if (ocupados.length === 0) return livres;
  const sug = livres.filter(t => {
    const fimN = t + dur;
    const prevFim = Math.max(abertura, ...ocupados.filter(o => o.fim <= t).map(o => o.fim));
    const nextIni = Math.min(fechamento, ...ocupados.filter(o => o.ini >= fimN).map(o => o.ini));
    return (t - prevFim) <= tol || (nextIni - fimN) <= tol;
  });
  return sug.length ? sug : livres;
}

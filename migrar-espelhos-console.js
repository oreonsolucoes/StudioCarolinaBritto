// Cole no Console do Chrome (F12 > Console). Rode ANTES de publicar as regras novas (o banco ainda aberto).
// Cria os nós "ocupacao" e "agendamentosPorTelefone" a partir dos agendamentos existentes (de hoje em diante).
// Pode rodar de novo quantas vezes quiser (só reescreve os mesmos dados).
(async () => {
  const DB = "https://studio-manicure-f909f-default-rtdb.firebaseio.com";
  const hoje = new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD
  const r = await fetch(`${DB}/agendamentos.json`);
  if (!r.ok) return console.error("❌ Não consegui ler agendamentos: HTTP", r.status);
  const todos = (await r.json()) || {};
  const u = {};
  let n = 0;
  for (const [id, ag] of Object.entries(todos)) {
    if (!ag || !ag.data || !ag.hora || ag.data < hoje) continue;
    const agenda = ag.agendaId === 'cabelo' ? 'cabelo' : 'unhas';
    u[`ocupacao/${agenda}/${ag.data}/${id}`] = { hora: ag.hora, duracao: Number(ag.duracao) || 20 };
    if (ag.cliente !== 'BLOQUEADO' && ag.whatsapp && ag.whatsapp !== '00000000000') {
      u[`agendamentosPorTelefone/${ag.whatsapp}/${id}`] = { agendaId: agenda, data: ag.data, hora: ag.hora, servicoNome: ag.servicoNome || ag.servico || '', cliente: ag.cliente || '' };
    }
    n++;
  }
  if (!n) return console.log("Nenhum agendamento futuro para migrar.");
  const p = await fetch(`${DB}/.json`, { method: "PATCH", body: JSON.stringify(u) });
  console.log(p.ok ? `✅ ${n} agendamento(s) espelhado(s).` : `❌ Falhou: HTTP ${p.status}`);
})();

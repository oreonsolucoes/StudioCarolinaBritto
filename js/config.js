// Interruptores do sistema do Studio Carolina Britto.
// Planos mensais: deixar false enquanto o Studio não for oferecer planos.
// Com false: o botão "Planos Mensais" some da home, as abas de planos somem do admin
// e a página planos.html redireciona para a home. Nada é apagado — é só ligar de novo.
export const PLANOS_ATIVOS = false;

// ── AGENDAS ─────────────────────────────────────────────────
// "unhas" é a agenda original (caminhos antigos, sem sufixo, nada precisa ser migrado).
// "cabelo" é a segunda agenda: mesmos nós do Firebase com sufixo "_cabelo".
export const AGENDA_PADRAO = 'unhas';
export const AGENDAS = {
  unhas:  { id: 'unhas',  nome: 'Unhas',  icone: '💅', sufixo: ''        },
  cabelo: { id: 'cabelo', nome: 'Cabelo', icone: '💇‍♀️', sufixo: '_cabelo' }
};

// ── PAPÉIS ──────────────────────────────────────────────────
// Cadastro no Firebase (Realtime Database):  usuarios/<UID do Authentication>
//   Carol:        { "papel": "admin" }
//   Funcionária:  { "papel": "funcionaria", "agendas": { "cabelo": true } }
export const PERMISSOES = {
  admin:       { agendas: 'todas', financeiro: true,  nome: 'Proprietária' },
  funcionaria: { agendas: 'lista', financeiro: false, nome: 'Funcionária'  }
};

// ── ENCAIXE DE HORÁRIOS ─────────────────────────────────────
// Maior espaço vazio (em minutos) que a cliente pode deixar antes/depois de um atendimento
// já marcado ao escolher o horário. 0 = só colado; 20 = até 20 min de folga. Ajuste à vontade.
export const LACUNA_MAXIMA_MIN = 20;

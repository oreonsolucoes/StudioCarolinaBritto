// Carrega o perfil (papel + agendas) do usuário logado: usuarios/<uid>
import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

export async function carregarPerfil(db, uid) {
  try {
    const snap = await get(ref(db, `usuarios/${uid}`));
    return snap.val() || null;
  } catch (e) {
    console.error("Erro ao ler perfil:", e);
    return null;
  }
}

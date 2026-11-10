// Cole no Console do Chrome (F12 > Console) em qualquer aba e dê Enter.
// 1) Troque os dois UIDs abaixo (Firebase > Authentication > coluna "UID do usuário").
// 2) Funciona com as regras atuais (.write: true). Depois das regras novas, este cadastro deverá ser feito pelo Console do Firebase.
(async () => {
  const DB = "https://studio-manicure-f909f-default-rtdb.firebaseio.com";
  const UID_CAROL  = "COLE_AQUI_O_UID_DA_CAROL";
  const UID_FUNCIONARIA = "COLE_AQUI_O_UID_DA_FUNCIONARIA";

  if (UID_CAROL.startsWith("COLE") || UID_FUNCIONARIA.startsWith("COLE")) {
    return console.error("❌ Troque os UIDs antes de rodar.");
  }
  const put = async (caminho, corpo) => {
    const r = await fetch(`${DB}/${caminho}.json`, { method: "PUT", body: JSON.stringify(corpo) });
    if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status}`);
    return r.json();
  };
  try {
    console.log("Carol:", await put(`usuarios/${UID_CAROL}`, { papel: "admin", nome: "Carolina Britto" }));
    console.log("Funcionária:", await put(`usuarios/${UID_FUNCIONARIA}`, { papel: "funcionaria", agendas: { cabelo: true } }));
    console.log("✅ Usuários criados. Confira em Realtime Database > usuarios.");
  } catch (e) {
    console.error("❌ Falhou:", e);
  }
})();

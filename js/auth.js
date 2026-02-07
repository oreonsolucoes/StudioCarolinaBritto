import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBSipc3lVUGF-gTs5ktrU9G060GQ0liCBM",
  authDomain: "studio-manicure-f909f.firebaseapp.com",
  projectId: "studio-manicure-f909f",
  storageBucket: "studio-manicure-f909f.firebasestorage.app",
  messagingSenderId: "257743931123",
  appId: "1:257743931123:web:d68421b2e04cb4cb9b5986",
  measurementId: "G-TD79VEFQG5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Configura o Firebase para lembrar do login mesmo se fechar o navegador
setPersistence(auth, browserLocalPersistence);

const loginSection = document.getElementById("login-section");
const adminSection = document.getElementById("admin-section");
const loginForm = document.getElementById("login-form");
const erroLogin = document.getElementById("erro-login");
const logoutBtn = document.getElementById("logout");
const toggleSenha = document.getElementById("toggle-senha");
const senhaInput = document.getElementById("senha");

// --- FUNÇÃO OLHO (MOSTRAR SENHA) ---
if (toggleSenha && senhaInput) {
  toggleSenha.addEventListener("click", () => {
    const type = senhaInput.getAttribute("type") === "password" ? "text" : "password";
    senhaInput.setAttribute("type", type);
    toggleSenha.textContent = type === "password" ? "👁️" : "🙈";
  });
}

// --- LOGIN ---
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;
    const btn = loginForm.querySelector('button');

    if (btn) {
      btn.innerText = "Carregando...";
      btn.disabled = true;
    }

    signInWithEmailAndPassword(auth, email, senha)
      .then(() => {
        if (erroLogin) erroLogin.textContent = "";
      })
      .catch((error) => {
        console.error(error);
        if (erroLogin) erroLogin.textContent = "❌ E-mail ou senha inválidos.";
      })
      .finally(() => {
        if (btn) {
          btn.innerText = "Entrar";
          btn.disabled = false;
        }
      });
  });
}

// --- OBSERVADOR DE AUTENTICAÇÃO (PERSISTÊNCIA) ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Proteção para evitar o erro de null no GitHub Pages
    if (loginSection) loginSection.style.display = "none";
    if (adminSection) adminSection.style.display = "block";
    
    // Dispara o evento para o admin.js carregar os dados
    window.dispatchEvent(new Event('auth-ready'));
  } else {
    if (loginSection) loginSection.style.display = "flex";
    if (adminSection) adminSection.style.display = "none";
  }
});

// --- LOGOUT (CORREÇÃO DA LINHA 73) ---
if (logoutBtn) {
  logoutBtn.onclick = (e) => {
    e.preventDefault();
    signOut(auth).then(() => {
      alert("Sessão encerrada.");
      window.location.reload(); 
    }).catch((error) => {
      console.error("Erro ao sair:", error);
    });
  };
}

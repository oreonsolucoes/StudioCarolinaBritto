import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

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
const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence);

const loginSection = document.getElementById("login-section");
const loginForm = document.getElementById("login-form");
const erroLogin = document.getElementById("erro-login");
const toggleSenha = document.getElementById("toggle-senha");
const senhaInput = document.getElementById("senha");

// --- FUNÇÃO MOSTRAR SENHA ---
if (toggleSenha && senhaInput) {
  toggleSenha.onclick = () => {
    const type = senhaInput.type === "password" ? "text" : "password";
    senhaInput.type = type;
    toggleSenha.textContent = type === "password" ? "👁️" : "🙈";
  };
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
        window.location.href = "admin.html";
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

// --- OBSERVADOR DE AUTENTICAÇÃO (AJUSTADO) ---
onAuthStateChanged(auth, (user) => {
  const estaNaLogin = window.location.pathname.includes("login.html");

  if (user) {
    // SÓ redireciona para admin se ele estiver na página de login
    if (estaNaLogin) {
      window.location.href = "admin.html";
    }
  } else {
    if (loginSection) loginSection.style.display = "flex";
  }
});

// js/auth.js

import { auth } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

let modoAuth = "login";

function mostrarMensagemAuth(texto, tipo = "ok") {
  const msg = document.getElementById("authMessage");
  if (!msg) return;
  msg.textContent = texto;
  msg.className = "auth-message " + tipo;
  msg.style.display = "block";
}

function limparMensagemAuth() {
  const msg = document.getElementById("authMessage");
  if (!msg) return;
  msg.textContent = "";
  msg.style.display = "none";
}

window.alternarAuth = function (modo) {
  modoAuth = modo;
  limparMensagemAuth();

  const tabLogin = document.getElementById("tabLogin");
  const tabCadastro = document.getElementById("tabCadastro");
  const btnAuth = document.getElementById("btnAuth");
  const senha = document.getElementById("authSenha");

  if (modo === "login") {
    tabLogin.classList.add("active");
    tabCadastro.classList.remove("active");
    btnAuth.textContent = "Entrar";
    senha.setAttribute("autocomplete", "current-password");
  } else {
    tabCadastro.classList.add("active");
    tabLogin.classList.remove("active");
    btnAuth.textContent = "Criar conta";
    senha.setAttribute("autocomplete", "new-password");
  }
};

window.executarAuth = async function () {
  const email = document.getElementById("authEmail").value.trim();
  const senha = document.getElementById("authSenha").value;
  const btnAuth = document.getElementById("btnAuth");

  if (!email || !senha) {
    mostrarMensagemAuth("Informe o e-mail e a senha.", "erro");
    return;
  }

  if (senha.length < 6) {
    mostrarMensagemAuth("A senha precisa ter pelo menos 6 caracteres.", "erro");
    return;
  }

  try {
    btnAuth.disabled = true;
    btnAuth.textContent = modoAuth === "login" ? "Entrando..." : "Criando conta...";

    if (modoAuth === "login") {
      await signInWithEmailAndPassword(auth, email, senha);
    } else {
      await createUserWithEmailAndPassword(auth, email, senha);
    }
  } catch (error) {
    mostrarMensagemAuth(traduzirErroFirebase(error.code), "erro");
  } finally {
    btnAuth.disabled = false;
    btnAuth.textContent = modoAuth === "login" ? "Entrar" : "Criar conta";
  }
};

window.recuperarSenha = async function () {
  const email = document.getElementById("authEmail").value.trim();

  if (!email) {
    mostrarMensagemAuth("Digite seu e-mail para receber a recuperação de senha.", "erro");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    mostrarMensagemAuth("Enviamos um e-mail para redefinir sua senha.", "ok");
  } catch (error) {
    mostrarMensagemAuth(traduzirErroFirebase(error.code), "erro");
  }
};

window.sairDoApp = async function () {
  try {
    await signOut(auth);
  } catch (error) {
    alert("Não foi possível sair agora. Tente novamente.");
  }
};

onAuthStateChanged(auth, (user) => {
  const authScreen = document.getElementById("authScreen");
  const appRoot = document.getElementById("appRoot");
  const userEmailLogado = document.getElementById("userEmailLogado");

  if (user) {
    authScreen.style.display = "none";
    appRoot.style.display = "flex";
    if (userEmailLogado) userEmailLogado.textContent = user.email || user.uid;
  } else {
    authScreen.style.display = "flex";
    appRoot.style.display = "none";
    if (userEmailLogado) userEmailLogado.textContent = "-";
  }
});

function traduzirErroFirebase(codigo) {
  const erros = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-disabled": "Este usuário foi desativado.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/weak-password": "A senha é muito fraca. Use pelo menos 6 caracteres.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente."
  };

  return erros[codigo] || "Não foi possível concluir a operação. Verifique os dados e tente novamente.";
}

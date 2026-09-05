import { supabase } from "./config.js";
import { getSession } from "./core/auth.js";

// ⚠️ Zachte toegangspoort tegen willekeurige bezoekers, geen echte
// beveiliging (staat zichtbaar in de broncode). Deel deze code enkel met
// mensen die een account mogen aanmaken. Pas gerust aan naar je eigen keuze.
const SIGNUP_ACCESS_CODE = "orange-mri-2026";

const els = {
  signinPanel: document.getElementById("signinPanel"),
  signupPanel: document.getElementById("signupPanel"),
  showSignupLink: document.getElementById("showSignupLink"),
  showSigninLink: document.getElementById("showSigninLink"),

  form: document.getElementById("loginForm"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  loginBtn: document.getElementById("loginBtn"),
  error: document.getElementById("loginError"),

  signupForm: document.getElementById("signupForm"),
  signupEmail: document.getElementById("signupEmail"),
  signupPassword: document.getElementById("signupPassword"),
  signupPasswordConfirm: document.getElementById("signupPasswordConfirm"),
  signupAccessCode: document.getElementById("signupAccessCode"),
  signupBtn: document.getElementById("signupBtn"),
  signupError: document.getElementById("signupError"),
  signupSuccess: document.getElementById("signupSuccess"),
};

// Al ingelogd? Meteen doorsturen naar de worklog.
const session = await getSession();
if (session) {
  window.location.href = "index.html";
}

function showError(el, message) {
  el.textContent = message;
  el.style.display = "block";
}

function hideMessages() {
  els.error.style.display = "none";
  els.signupError.style.display = "none";
  els.signupSuccess.style.display = "none";
}

els.showSignupLink.addEventListener("click", () => {
  hideMessages();
  els.signinPanel.hidden = true;
  els.signupPanel.hidden = false;
});

els.showSigninLink.addEventListener("click", () => {
  hideMessages();
  els.signupPanel.hidden = true;
  els.signinPanel.hidden = false;
});

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMessages();
  els.loginBtn.disabled = true;
  els.loginBtn.textContent = "Bezig...";

  const { error } = await supabase.auth.signInWithPassword({
    email: els.email.value.trim(),
    password: els.password.value,
  });

  if (error) {
    showError(els.error, "Inloggen mislukt: " + error.message);
    els.loginBtn.disabled = false;
    els.loginBtn.textContent = "Inloggen";
    return;
  }

  window.location.href = "index.html";
});

els.signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMessages();

  if (els.signupAccessCode.value.trim() !== SIGNUP_ACCESS_CODE) {
    showError(els.signupError, "Ongeldige toegangscode.");
    return;
  }

  if (els.signupPassword.value !== els.signupPasswordConfirm.value) {
    showError(els.signupError, "Wachtwoorden komen niet overeen.");
    return;
  }

  els.signupBtn.disabled = true;
  els.signupBtn.textContent = "Bezig...";

  const { data, error } = await supabase.auth.signUp({
    email: els.signupEmail.value.trim(),
    password: els.signupPassword.value,
  });

  els.signupBtn.disabled = false;
  els.signupBtn.textContent = "Account aanmaken";

  if (error) {
    showError(els.signupError, "Registreren mislukt: " + error.message);
    return;
  }

  if (data.session) {
    // Geen e-mailbevestiging vereist: meteen ingelogd.
    window.location.href = "index.html";
    return;
  }

  // E-mailbevestiging vereist voordat de eerste login lukt.
  els.signupForm.reset();
  els.signupSuccess.textContent =
    "Account aangemaakt. Check je e-mail om je account te bevestigen, en log dan in.";
  els.signupSuccess.style.display = "block";
});

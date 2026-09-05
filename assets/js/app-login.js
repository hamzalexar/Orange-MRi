import { supabase } from "./config.js";
import { getSession } from "./core/auth.js";

const els = {
  form: document.getElementById("loginForm"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  loginBtn: document.getElementById("loginBtn"),
  error: document.getElementById("loginError"),
};

// Al ingelogd? Meteen doorsturen naar de worklog.
const session = await getSession();
if (session) {
  window.location.href = "index.html";
}

function showError(message) {
  els.error.textContent = message;
  els.error.style.display = "block";
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.error.style.display = "none";
  els.loginBtn.disabled = true;
  els.loginBtn.textContent = "Bezig...";

  const { error } = await supabase.auth.signInWithPassword({
    email: els.email.value.trim(),
    password: els.password.value,
  });

  if (error) {
    showError("Inloggen mislukt: " + error.message);
    els.loginBtn.disabled = false;
    els.loginBtn.textContent = "Inloggen";
    return;
  }

  window.location.href = "index.html";
});

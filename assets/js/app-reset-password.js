import { supabase } from "./config.js";

const els = {
  resetPanel: document.getElementById("resetPanel"),
  invalidPanel: document.getElementById("invalidPanel"),
  form: document.getElementById("resetForm"),
  password: document.getElementById("password"),
  passwordConfirm: document.getElementById("passwordConfirm"),
  saveBtn: document.getElementById("saveBtn"),
  error: document.getElementById("errorMsg"),
  success: document.getElementById("successMsg"),
};

let recoveryReady = false;

function showInvalid() {
  if (recoveryReady) return;
  els.invalidPanel.hidden = false;
  els.resetPanel.hidden = true;
}

// Supabase verwerkt de recovery-token uit de link-URL en vuurt dit event.
supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    recoveryReady = true;
    els.resetPanel.hidden = false;
    els.invalidPanel.hidden = true;
  }
});

// Als er na een paar seconden geen recovery-sessie is, was de link
// ongeldig/verlopen of ontbreekt de token gewoon (rechtstreeks bezocht).
setTimeout(showInvalid, 3000);

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.error.style.display = "none";
  els.success.style.display = "none";

  if (els.password.value !== els.passwordConfirm.value) {
    els.error.textContent = "Wachtwoorden komen niet overeen.";
    els.error.style.display = "block";
    return;
  }

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = "Bezig...";

  const { error } = await supabase.auth.updateUser({ password: els.password.value });

  els.saveBtn.disabled = false;
  els.saveBtn.textContent = "Wachtwoord opslaan";

  if (error) {
    els.error.textContent = "Opslaan mislukt: " + error.message;
    els.error.style.display = "block";
    return;
  }

  els.success.textContent = "Wachtwoord aangepast! Je wordt doorgestuurd...";
  els.success.style.display = "block";
  setTimeout(() => (window.location.href = "index.html"), 1500);
});

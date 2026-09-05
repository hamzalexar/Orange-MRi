import { supabase } from "./config.js";

const els = {
  form: document.getElementById("forgotForm"),
  email: document.getElementById("email"),
  sendBtn: document.getElementById("sendBtn"),
  error: document.getElementById("errorMsg"),
  success: document.getElementById("successMsg"),
};

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.error.style.display = "none";
  els.success.style.display = "none";
  els.sendBtn.disabled = true;
  els.sendBtn.textContent = "Bezig...";

  const resetUrl = new URL("reset-password.html", window.location.href).href;

  const { error } = await supabase.auth.resetPasswordForEmail(els.email.value.trim(), {
    redirectTo: resetUrl,
  });

  els.sendBtn.disabled = false;
  els.sendBtn.textContent = "Verstuur reset-link";

  if (error) {
    els.error.textContent = "Versturen mislukt: " + error.message;
    els.error.style.display = "block";
    return;
  }

  els.form.reset();
  els.success.textContent = "Als dit e-mailadres bestaat, is er een reset-link naartoe gestuurd.";
  els.success.style.display = "block";
});

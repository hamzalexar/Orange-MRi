import { supabase } from "../config.js";

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

// Roept dit aan bovenaan elke pagina die login vereist.
// Stuurt door naar login.html als er geen geldige sessie is, en gooit
// daarna een error zodat de rest van het paginascript niet doorloopt
// terwijl de redirect bezig is.
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = "login.html";
    throw new Error("Not authenticated — redirecting to login.");
  }
  return session;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "login.html";
}

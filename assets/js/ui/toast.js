// assets/js/ui/toast.js
export function toast(message, opts = {}) {
    // Minimal, safe fallback toast.
    // Later kan je dit vervangen door een echte toast UI.
    const msg = String(message ?? "");
  
    // Probeer een kleine non-blocking toast in de pagina te tonen
    try {
      const id = "mri-toast-container";
      let container = document.getElementById(id);
  
      if (!container) {
        container = document.createElement("div");
        container.id = id;
        container.style.position = "fixed";
        container.style.right = "16px";
        container.style.bottom = "16px";
        container.style.zIndex = "9999";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "8px";
        document.body.appendChild(container);
      }
  
      const el = document.createElement("div");
      el.textContent = msg;
      el.style.padding = "10px 12px";
      el.style.borderRadius = "10px";
      el.style.background = "rgba(0,0,0,0.85)";
      el.style.color = "white";
      el.style.fontSize = "14px";
      el.style.maxWidth = "320px";
      el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      el.style.transition = "all 140ms ease";
  
      container.appendChild(el);
  
      requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
  
      const duration = Number.isFinite(opts.duration) ? opts.duration : 2200;
      setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateY(8px)";
        setTimeout(() => el.remove(), 180);
      }, duration);
  
      return;
    } catch (e) {
      // fallback
    }
  
    console.log("[toast]", msg);
  }
  
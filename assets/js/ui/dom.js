export function qs(selector, root = document) {
    const el = root.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    return el;
  }
  
  export function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  
  export function fillSelect(selectEl, options) {
    selectEl.innerHTML = "";
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      selectEl.appendChild(o);
    }
  }
  
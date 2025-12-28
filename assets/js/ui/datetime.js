export function formatDateTime(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString();
  }
  
export function readJson(key, fallbackValue) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallbackValue;
      return JSON.parse(raw);
    } catch {
      return fallbackValue;
    }
  }
  
  export function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  
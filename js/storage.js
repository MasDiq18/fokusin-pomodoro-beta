const STORAGE_PREFIX = "pomodoro_flow";

export function getJSON(key, fallbackValue) {
  try {
    const rawValue = localStorage.getItem(`${STORAGE_PREFIX}_${key}`);

    if (!rawValue) {
      return fallbackValue;
    }

    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
}

export function setJSON(key, value) {
  localStorage.setItem(`${STORAGE_PREFIX}_${key}`, JSON.stringify(value));
}

export function removeKey(key) {
  localStorage.removeItem(`${STORAGE_PREFIX}_${key}`);
}
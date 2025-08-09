// lib/storage.js
const SESSION_KEYS = {
  old: "netsuiteSessionOLD",
  new: "netsuiteSessionNEW",
};

export const getSession = (instanceType) => {
  if (typeof window === "undefined") return null;

  try {
    const data = localStorage.getItem(SESSION_KEYS[instanceType]);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Session parse error:", e);
    return null;
  }
};

export const setSession = (instanceType, session) => {
  localStorage.setItem(SESSION_KEYS[instanceType], JSON.stringify(session));
};

export const clearSession = (instanceType) => {
  localStorage.removeItem(SESSION_KEYS[instanceType]);
};
export const isSessionValid = (session) => {
  return session && session.expiresAt > Date.now();
};

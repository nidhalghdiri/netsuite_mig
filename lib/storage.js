import Cookies from "js-cookie";

const SESSION_KEYS = {
  old: "netsuiteSessionOLD",
  new: "netsuiteSessionNEW",
};

export const getSession = (instanceType) => {
  // Server-side: return null
  if (typeof window === "undefined") return null;

  try {
    // First check localStorage
    const localData = localStorage.getItem(SESSION_KEYS[instanceType]);
    if (localData) return JSON.parse(localData);

    // Fallback to cookies
    const cookieData = Cookies.get(SESSION_KEYS[instanceType]);
    return cookieData ? JSON.parse(cookieData) : null;
  } catch (e) {
    console.error("Session parse error:", e);
    return null;
  }
};

export const setSession = (instanceType, session) => {
  // Store in both localStorage AND cookies for redundancy
  localStorage.setItem(SESSION_KEYS[instanceType], JSON.stringify(session));
  Cookies.set(SESSION_KEYS[instanceType], JSON.stringify(session), {
    expires: new Date(session.expiresAt),
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
};

export const clearSession = (instanceType) => {
  localStorage.removeItem(SESSION_KEYS[instanceType]);
  Cookies.remove(SESSION_KEYS[instanceType]);
};

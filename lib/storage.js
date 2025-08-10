import Cookies from "js-cookie";

const SESSION_KEYS = {
  old: "netsuiteSessionOLD",
  new: "netsuiteSessionNEW",
};

export const getSession = (instanceType) => {
  if (typeof window === "undefined") return null;

  try {
    // Check localStorage first
    const localData = localStorage.getItem(SESSION_KEYS[instanceType]);
    if (localData) return JSON.parse(localData);

    // Then check cookies
    const cookieData = Cookies.get(SESSION_KEYS[instanceType]);
    if (cookieData) {
      // Migrate cookie to localStorage
      localStorage.setItem(SESSION_KEYS[instanceType], cookieData);
      return JSON.parse(cookieData);
    }

    return null;
  } catch (e) {
    console.error("Session parse error:", e);
    return null;
  }
};

export const setSession = (instanceType, session) => {
  const sessionString = JSON.stringify(session);

  // Store in localStorage
  localStorage.setItem(SESSION_KEYS[instanceType], sessionString);

  // Also store in cookie for initial transfer (with shorter expiration)
  Cookies.set(SESSION_KEYS[instanceType], sessionString, {
    expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
};

export const clearSession = (instanceType) => {
  localStorage.removeItem(SESSION_KEYS[instanceType]);
  Cookies.remove(SESSION_KEYS[instanceType]);
};

export function isSessionValid(session) {
  if (!session) return false;
  return session.expiresAt > Date.now();
}

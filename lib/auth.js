// src/lib/auth.js
import Cookies from "js-cookie";

// Get session from cookies
export function getSession() {
  if (typeof window === "undefined") return null;

  const sessionCookie = Cookies.get("netsuiteSession");
  if (!sessionCookie) return null;

  try {
    return JSON.parse(sessionCookie);
  } catch (e) {
    console.error("Error parsing session cookie:", e);
    return null;
  }
}

// Set session in cookies
export function setSession(session) {
  Cookies.set("netsuiteSession", JSON.stringify(session), {
    expires: new Date(session.expiresAt),
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

// Clear session
export function clearSession() {
  Cookies.remove("netsuiteSession", { path: "/" });
}

// Check if session is valid
export function isSessionValid(session) {
  if (!session) return false;
  return session.expiresAt > Date.now();
}

// src/lib/auth.js
export async function refreshToken(session) {
  if (!session || !session.refreshToken) {
    console.error("No refresh token available");
    return null;
  }

  try {
    const tokenUrl =
      session.instance === "old"
        ? process.env.OLD_NS_TOKEN_URL
        : process.env.NEW_NS_TOKEN_URL;

    const clientId =
      session.instance === "old"
        ? process.env.NEXT_PUBLIC_OLD_NS_CLIENT_ID
        : process.env.NEXT_PUBLIC_NEW_NS_CLIENT_ID;

    const clientSecret =
      session.instance === "old"
        ? process.env.OLD_NS_CLIENT_SECRET
        : process.env.NEW_NS_CLIENT_SECRET;

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const tokenData = await response.json();

    const newSession = {
      ...session,
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      refreshToken: tokenData.refresh_token || session.refreshToken,
    };

    setSession(newSession);
    return newSession;
  } catch (error) {
    console.error("Token refresh error:", error);
    clearSession();
    return null;
  }
}

// Add to your data fetching logic
export async function withValidSession(session, callback) {
  if (!session) return null;

  // Check if token needs refreshing
  if (session.expiresAt < Date.now() + 300000) {
    // 5 minutes before expiration
    const newSession = await refreshToken(session);
    if (!newSession) return null;
    return callback(newSession);
  }

  return callback(session);
}

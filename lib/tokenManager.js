// lib/tokenManager.js
import { getSession, setSession, clearSession } from "./storage";
import {
  getOldClientCredentialsToken,
  getNewClientCredentialsToken,
} from "./netsuiteOldM2M";

// Token expiration margin (refresh before actual expiration)
const TOKEN_EXPIRATION_MARGIN = 5 * 60 * 1000; // 5 minutes

export const isTokenExpired = (session) => {
  if (!session || !session.expiresAt) return true;
  return Date.now() >= session.expiresAt - TOKEN_EXPIRATION_MARGIN;
};

export const getValidToken = async (instanceType) => {
  try {
    const session = getSession(instanceType);

    // If session is valid, return the token
    if (session && !isTokenExpired(session)) {
      return session.token;
    }

    // Token expired or invalid, get a new one
    let tokenData;
    if (instanceType === "old") {
      tokenData = await getOldClientCredentialsToken();
    } else {
      tokenData = await getNewClientCredentialsToken();
    }

    // Update session with new token
    const newSession = {
      token: tokenData.accessToken,
      expiresAt: tokenData.expiresAt,
      timestamp: Date.now(),
    };

    setSession(instanceType, newSession);
    return tokenData.accessToken;
  } catch (error) {
    console.error(
      `Failed to get valid token for ${instanceType} instance:`,
      error
    );
    throw error;
  }
};

export const refreshTokenIfNeeded = async (instanceType) => {
  const session = getSession(instanceType);
  if (isTokenExpired(session)) {
    return await getValidToken(instanceType);
  }
  return session.token;
};

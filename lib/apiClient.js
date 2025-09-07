// lib/apiClient.js
import { getValidToken, refreshTokenIfNeeded } from "./tokenManager";

export const apiRequest = async (url, options = {}, instanceType = "old") => {
  try {
    // Get a valid token
    const token = await getValidToken(instanceType);

    // Make the request
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    // If unauthorized, try to refresh token and retry
    if (response.status === 401) {
      console.log(`Token expired for ${instanceType} instance, refreshing...`);
      const newToken = await refreshTokenIfNeeded(instanceType);

      // Retry the request with new token
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
        },
      });

      return retryResponse;
    }

    return response;
  } catch (error) {
    console.error(`API request failed for ${instanceType} instance:`, error);
    throw error;
  }
};

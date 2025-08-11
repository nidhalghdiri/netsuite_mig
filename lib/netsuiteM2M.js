import { KJUR, hextob64 } from "jsrsasign";

let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

export async function getClientCredentialsToken() {
  // Return cached token if valid
  if (tokenCache.accessToken && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  try {
    const tokenData = await fetchAccessToken();
    tokenCache = {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000 - 30000, // 30s buffer
    };
    return tokenData.access_token;
  } catch (error) {
    console.error("Failed to fetch access token:", error);
    throw error;
  }
}

async function fetchAccessToken() {
  const {
    NEW_NS_M2M_TOKEN_URL,
    NEW_NS_M2M_CONSUMER_KEY,
    NEW_NS_M2M_CERTIFICATE_KID,
    NEW_NS_M2M_CERTIFICATE_PRIVATE_KEY,
  } = process.env;

  // Generate JWT
  const jwtHeader = {
    alg: "PS256",
    typ: "JWT",
    kid: NEW_NS_M2M_CERTIFICATE_KID,
  };

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: NEW_NS_M2M_CONSUMER_KEY,
    scope: ["restlets", "rest_webservices"],
    iat: now,
    exp: now + 3600, // 1 hour expiration
    aud: NEW_NS_M2M_TOKEN_URL,
  };

  const signedJWT = KJUR.jws.JWS.sign(
    "PS256",
    JSON.stringify(jwtHeader),
    JSON.stringify(jwtPayload),
    NEW_NS_M2M_CERTIFICATE_PRIVATE_KEY
  );

  // Request access token
  const response = await fetch(NEW_NS_M2M_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: signedJWT,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function netsuiteGETRequest(path) {
  const accessToken = await getClientCredentialsToken();
  const baseUrl =
    process.env.NEW_NS_M2M_BASE_URL ||
    process.env.NEW_NS_M2M_TOKEN_URL.replace(
      "/services/rest/auth/oauth2/v1/token",
      ""
    );

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

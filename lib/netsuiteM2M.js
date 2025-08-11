import { KJUR, KEYUTIL } from "jsrsasign";
import CryptoJS from "crypto-js";

let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

// Initialize crypto engine for elliptic curve support
const initializeCryptoEngine = () => {
  if (typeof window !== "undefined") {
    // Browser environment - jsrsasign auto-initializes
    return;
  }

  // Node.js environment - manually initialize
  if (typeof KJUR.crypto.ECCurveFp === "undefined") {
    KJUR.crypto.ECCurveFp = function () {};
  }
};

export async function getClientCredentialsToken() {
  initializeCryptoEngine();
  console.log("1. tokenCache", tokenCache);
  // Cache check
  if (tokenCache.accessToken && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }
  try {
    const tokenData = await fetchAccessToken();
    console.log("8. tokenCache", tokenCache);

    tokenCache = {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000 - 30000,
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
  console.log("2. NEW_NS_M2M_TOKEN_URL", NEW_NS_M2M_TOKEN_URL);
  console.log("2. NEW_NS_M2M_CONSUMER_KEY", NEW_NS_M2M_CONSUMER_KEY);
  console.log("2. NEW_NS_M2M_CERTIFICATE_KID", NEW_NS_M2M_CERTIFICATE_KID);
  console.log(
    "2. NEW_NS_M2M_CERTIFICATE_PRIVATE_KEY",
    NEW_NS_M2M_CERTIFICATE_PRIVATE_KEY
  );

  // Generate JWT
  const jwtHeader = {
    alg: "PS256",
    typ: "JWT",
    kid: NEW_NS_M2M_CERTIFICATE_KID,
  };

  console.log("3. jwtHeader", jwtHeader);

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: NEW_NS_M2M_CONSUMER_KEY,
    scope: ["restlets", "rest_webservices"],
    iat: now,
    exp: now + 3600, // 1 hour expiration
    aud: NEW_NS_M2M_TOKEN_URL,
  };

  console.log("4. jwtPayload", jwtPayload);

  // Properly format private key
  const formattedPrivateKey = NEW_NS_M2M_CERTIFICATE_PRIVATE_KEY.replace(
    /\\n/g,
    "\n"
  )
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .trim();

  console.log("5. formattedPrivateKey", formattedPrivateKey);

  // Create RSAKey object
  const rsaKey = KEYUTIL.getKeyFromPlainPrivatePKCS8PEM(
    `-----BEGIN PRIVATE KEY-----\n${formattedPrivateKey}\n-----END PRIVATE KEY-----`
  );

  console.log("6. rsaKey", rsaKey);

  // Generate signed JWT
  const signedJWT = KJUR.jws.JWS.sign(
    "PS256",
    JSON.stringify(jwtHeader),
    JSON.stringify(jwtPayload),
    rsaKey
  );
  console.log("7. signedJWT", signedJWT);

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

export async function netsuiteRequest(method, path, data) {
  const accessToken = await getClientCredentialsToken();
  const baseUrl =
    "https://11661334-sb1.suitetalk.api.netsuite.com/" ||
    process.env.NEW_NS_M2M_TOKEN_URL.replace(
      "/services/rest/auth/oauth2/v1/token",
      ""
    );

  const url = `${baseUrl}${path}`;

  const config = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "transient", // For large requests
    },
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NetSuite API error (${response.status}): ${errorText}`);
  }

  try {
    return await response.json();
  } catch {
    return { success: true }; // For empty responses
  }
}

import { KJUR, KEYUTIL } from "jsrsasign";
import Base64 from "crypto-js/enc-base64";
import Utf8 from "crypto-js/enc-utf8";

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
    NEW_NS_M2M_TOKEN_URL = "https://11661334-sb1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token",
    NEW_NS_M2M_CONSUMER_KEY = "default_consumer_key",
    NEW_NS_M2M_CERTIFICATE_KID = "dO2zLhHRMwZDWqAuvTTho2qxIVE3LyT7ZBvtsbxNe3w",
    NEW_NS_M2M_CERTIFICATE_PRIVATE_KEY = "default_key",
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
    kid:
      process.env.NEW_NS_M2M_CERTIFICATE_KID ||
      "dO2zLhHRMwZDWqAuvTTho2qxIVE3LyT7ZBvtsbxNe3w",
  };

  console.log("3. jwtHeader", jwtHeader);
  let stringifiedJwtHeader = JSON.stringify(jwtHeader);

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss:
      process.env.NEW_NS_M2M_CONSUMER_KEY ||
      "3be458c966420e34e3172932bddef79abd1425991bc5f988ae961e73dcb0feb4",
    scope: ["restlets", "rest_webservices"],
    iat: now,
    exp: now + 3600, // 1 hour expiration
    aud:
      process.env.NEW_NS_M2M_TOKEN_URL ||
      "https://11661334-sb1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token",
  };

  console.log("4. jwtPayload", jwtPayload);
  var stringifiedJwtPayload = JSON.stringify(jwtPayload);

  let secret =
    process.env.NEW_NS_M2M_CERTIFICATE_PRIVATE_KEY ||
    `-----BEGIN PRIVATE KEY-----
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
uwRYPKG7aJWGvSmmb1wm98ic
-----END PRIVATE KEY-----`;

  let encodedSecret = Base64.stringify(Utf8.parse(secret));

  console.log("6. encodedSecret", encodedSecret);

  // Generate signed JWT
  const signedJWT = KJUR.jws.JWS.sign(
    "PS256",
    stringifiedJwtHeader,
    stringifiedJwtPayload,
    secret
  );
  console.log("7. signedJWT", signedJWT);

  // Request access token
  const response = await fetch(
    process.env.NEW_NS_M2M_TOKEN_URL ||
      "https://11661334-sb1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token",
    {
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
    }
  );
  console.log("JWT Response :", response);
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

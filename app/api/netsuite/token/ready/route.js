import { NextResponse } from "next/server";
import { KJUR, KEYUTIL } from "jsrsasign";
import Base64 from "crypto-js/enc-base64";

export async function GET(request) {
  try {
    // Generate JWT
    const jwtHeader = {
      alg: "PS256",
      typ: "JWT",
      kid:
        process.env.NEW_NS_M2M_CERTIFICATE_KID ||
        "Ize9zjs85FAFL6brVLQYwkc4lR6WmrvBw-0tf8_WKSo",
    };
    let stringifiedJwtHeader = JSON.stringify(jwtHeader);

    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss:
        process.env.NEW_NS_M2M_CONSUMER_KEY ||
        "56eaec00e92791527e4818045346aca63a02d189d4208cb7bcc0d899d88a6bb9",
      scope: ["restlets", "rest_webservices"],
      iat: now,
      exp: now + 3600, // 1 hour expiration
      aud:
        process.env.NEW_NS_M2M_TOKEN_URL ||
        "https://11661334.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token",
    };
    var stringifiedJwtPayload = JSON.stringify(jwtPayload);

    let secret =
      process.env.NEW_NS_M2M_CERTIFICATE_PRIVATE_KEY ||
      `-----BEGIN PRIVATE KEY-----
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
LCzIuIyEIkt42SD3zuFBTw==
-----END PRIVATE KEY-----`;

    // Generate signed JWT
    const signedJWT = KJUR.jws.JWS.sign(
      "PS256",
      stringifiedJwtHeader,
      stringifiedJwtPayload,
      secret
    );
    console.log("2.From Old System signedJWT: ", signedJWT);
    var accountID = "11661334";

    const response = await fetch(
      `https://${accountID}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`,
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
        }).toString(),
      }
    );

    const tokenData = await response.json();
    console.log("Token Response data", tokenData);
    // Return the ready-to-use token
    return NextResponse.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      obtained_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating token:", error);
    return NextResponse.json(
      { error: "Failed to generate token", details: error.message },
      { status: 500 }
    );
  }
}

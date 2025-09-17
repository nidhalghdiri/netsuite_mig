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
        process.env.OLD_NS_M2M_CERTIFICATE_KID ||
        "I11SnLupAZHRZ-hInDDfyj01IlaWWPRQfHmSo39FLqs",
    };
    let stringifiedJwtHeader = JSON.stringify(jwtHeader);

    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss:
        process.env.OLD_NS_M2M_CONSUMER_KEY ||
        "895790a50822411428a222315fdad3f0e4347ab3024b43a4cfea94c602157f67",
      scope: ["restlets", "rest_webservices"],
      iat: now,
      exp: now + 3600, // 1 hour expiration
      aud:
        process.env.OLD_NS_M2M_TOKEN_URL ||
        "https://11661334.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token",
    };
    var stringifiedJwtPayload = JSON.stringify(jwtPayload);

    let secret =
      process.env.OLD_NS_M2M_CERTIFICATE_PRIVATE_KEY ||
      `-----BEGIN PRIVATE KEY-----
MIIG/QIBADANBgkqhkiG9w0BAQEFAASCBucwggbjAgEAAoIBgQDA1O7zxc4pyzAr
VIqi9HXgZDIXAJWkaDLpX8UYwvHwJHkgQ4weHEBDBz9gRTAMUaJqK+TOVY5YbALG
mYgfUggkJdYaiPu8qGoGTM/kHrB1rz9HN76wsZxN8frkEsZhAaPC/nzbCpY33EDh
9/mT2AjDpJmI2Fk3Q67iw2wsI+qHZW+bLPguPek97okrUiJosxZhXugX2IRJz67F
n1IJR1zJNnKtkxErjwEZlUnqI4cvgUjeqOfs/QkLoU2V2r9CPdJ1FJlG1PuMx/YD
B4SLwzDSBdgZgjkGZ1IpW9valMcNdR1+3mUtqyBnGECPyHtB8Nqb8g0HwV4ZQXQz
wi10j7xyUrPl+OSZddplJchS10sSkEpTDCGZF5AEKVqpWrN8waD3cRzJ9R6pvdTG
dWZvPH8XBsvaHpBb/iEFLugtBfp9MUtiA3snOoBK3N+bP9GtoP8V2Gy8/4RpbmS3
lc/J7K6XBzC1gW0dXmKfp408uHVK9dGVmwvNw/lSNKXDJMyQKb0CAwEAAQKCAYAe
ijrUEepudRdKbYfNejEnGkdSnE2W7cfObVQOcWWW9nfWk8wfwrKsyvuPGDYdZVp3
PT9uLF+wgl7ILG3CJCBU9UcdCb/w561vFQBB7VheMySu91W0r1SFhcMKFy0jFPrm
OZ71pA4Zh8Eg6MC22Rq+PZXxde5fUdFjabb6oK+WxQpxhaRC0pxbqilAWrBHa8Gq
JzlT+X8uH33bH7oC7TH1TjHIasfn4ay3bAz6T6kr7WpolVCyGHszw9bBWpU6/QZP
BLfjmXrhjIWu6b3pamAT9UIDxcK7SxrabUURV3625bzF33liniioAAOgTWvCl9N/
BPNx7U+fcn2kYnqJUO1VjcxVPB2A9GjhdlwKdQP6AmbJrChCxCv1hNISwD/uVXFM
Uoo0EkAmKTwEEmt9UdoykXS3cQngnZ3SdnY21UEuD7yhUKrIHCFQOvsTBHa8kGGO
Mn4v9W5g8hxoNUNm+SbxNIXYAQfhU8GIM3AaGBeHWOGdqMJuCg2SqgTZ4Rbi4UMC
gcEA5zQCSDnMdzYq20XZBiLM5qTWAGZ+m9VZy91u0uCBPhLEmBXThxTQva1EFZFR
fZYfmcseAUJMdyPjXrTDTU6+n4zuFUsi1+/39g5FeXOwhxkPxUq/9s0g7+TKaSM/
lBh5RgICnjPLppyfTe8Nn3tTtk7t4jMGSV+wtwJFLsBfBnmvBcEoaTceXPCy5I8F
BIBakAjKcv7dLk4ORA/xaIPxXT69fTpMZstFihT/FICZCb4Qn6YPg4f13zmYNj1g
H4p7AoHBANWDYwgw/lj0NaTK4uavQ0sHrQTT5Ok5T9Kui6XPrEqrGhReaKHZv4V9
l5TdICwgRk1amwwmgvU+IeJhXEwXKFtbyC6c5KQ2QsZSjoHni59ZEdTmaoCmldvO
FnInO1CyVtHI6mG1dJgtWf2Z2sjwWeu1W00UHbhP0t+DJ1VAEeR5Xc+qvGI3SjGX
4+fSA/5gL7/CCNsC+cWm5VJrbRfJJx/GkwxOFfzjbE5csaj/GwBg23LrkvFSNVOk
jk+zpbXjJwKBwQDGkTZ8jZd7szvvgve3e1/7nwpk4aJPeFdc7drmpgaaJ0hNTkGT
vF7i6NKWq24PrEWLspUcg7JkiKAYkKtD1COHqGQ6SYOtbd3Kp8snWiL8hJu02FQy
RU7KefcVgT5zlOljJQrWkKmReOag6nUKycLFytgn86askdCV/Q8p7fIu/4dAK/rn
En2zWM5r2iF3Ej21grdNOHMB9+vsrLyrBNbhPKdFzDId/urEgu/ozeGiKmjglKCy
WKzkgPSncOMDc80CgcAnQFAkYV1g3QQ/l0y/O9kTIgYcrReYCIE0KgJiKRtzXqEc
vX5ewrkCwWPsafpQIl7KOa3nPe01SIbSJzPgiSFSKj1S1GT0C0WbT/ICz55LXQR6
LyHFJNrH3csikTPGUgLD7juoWsNkdnHkvTQLXKQrQNvX/6q3B3WswV+pvG2NowIr
+ydGpwNsuo+bPnCdgvFEP1eBa7qfK19dF4KmrMQUg1zlFjXUl7qBbWj7uGouV6AA
MG6DDqnfBpFi9ZOxLGECgcAhMtDlJd7btrMyL0+n7aWBCQTbJhuQF/9Te80TOdMf
v7hsFFuc5jnK7xQ2H90+ug64RZOxKZrmFK6RZEH5HnraRbd8SutljGJ90iEYrH4v
ygzvOiLtubAKNg99JQZ72OlP5DQZe1a3g+zhj+/m6uQsas7MGPeKDOFuW79Wpa9J
OOfwXitYuWbuXxTnTU4IeErH0lGXVKmDzbIZS8Z5LNBrtVoVZpPigumI7u6FHMKW
FhRZsBuZzMJUhW9c/M1a3nc=
-----END PRIVATE KEY-----`;

    // Generate signed JWT
    const signedJWT = KJUR.jws.JWS.sign(
      "PS256",
      stringifiedJwtHeader,
      stringifiedJwtPayload,
      secret
    );
    console.log("2.From Old System signedJWT: ", signedJWT);
    var accountID = "5319757";

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

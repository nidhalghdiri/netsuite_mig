import { NextResponse } from "next/server";

export async function POST(request) {
  const { accountID, signedJWT } = await request.json();

  try {
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

    const data = await response.json();
    console.log("Token Response data", data);
    if (data.error) {
      return NextResponse.json(
        { error: data.error_description },
        { status: 400 }
      );
    }

    return NextResponse.json({
      access_token: data.access_token,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}

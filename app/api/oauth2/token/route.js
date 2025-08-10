import { NextResponse } from "next/server";

export async function POST(request) {
  const { code } = await request.json();

  const config = {
    tokenUrl: process.env.NEW_NS_TOKEN_URL,
    clientId: process.env.NEW_NS_CLIENT_ID,
    clientSecret: process.env.NEW_NS_CLIENT_SECRET,
    accountId: process.env.NEW_NS_ACCOUNT_ID,
  };

  const { tokenUrl, clientId, clientSecret, accountId } = config;

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/oauth2/callback`,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json(
        { error: data.error_description },
        { status: 400 }
      );
    }

    return NextResponse.json({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      accountId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}

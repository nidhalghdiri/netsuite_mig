// src/app/api/auth/callback/route.js
import { NextResponse } from "next/server";
import { setSession } from "@/lib/auth";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  console.log("We Got Code: ", code);
  const instanceType = searchParams.get("state") || "ykv2XLx1BpT5Q0F3MRPHb94j";

  // Validate we have a valid code
  if (!code) {
    return NextResponse.redirect(
      process.env.NEXT_PUBLIC_BASE_URL + "/?error=missing_code"
    );
  }

  try {
    // Exchange the code for an access token
    const tokenData = await exchangeCodeForToken(code, instanceType);
    console.log("Token Data: ", tokenData);

    // Create session object
    const session = {
      accessToken: tokenData.access_token,
      instance: instanceType,
      accountId: tokenData.accountId,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      refreshToken: tokenData.refresh_token,
    };

    // Redirect to dashboard
    const response = NextResponse.redirect(
      process.env.NEXT_PUBLIC_BASE_URL + "/"
    );

    // Set session cookie
    response.cookies.set("netsuiteSession", JSON.stringify(session), {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokenData.expires_in,
    });

    return response;
  } catch (error) {
    console.error("Token exchange error:", error);
    return NextResponse.redirect(
      process.env.NEXT_PUBLIC_BASE_URL + "/?error=auth_failed"
    );
  }
}

async function exchangeCodeForToken(code, instanceType) {
  const tokenUrl = process.env.OLD_NS_TOKEN_URL;
  const clientId = process.env.NEXT_PUBLIC_OLD_NS_CLIENT_ID;
  const clientSecret = process.env.OLD_NS_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/oauth/callback`;
  const accountId = process.env.NEXT_PUBLIC_OLD_NS_ACCOUNT_ID;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  console.log("exchangeCodeForToken Response: ", response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Token exchange failed: ${response.status} - ${JSON.stringify(errorData)}`
    );
  }

  const tokenData = await response.json();
  return {
    ...tokenData,
    accountId,
  };
}

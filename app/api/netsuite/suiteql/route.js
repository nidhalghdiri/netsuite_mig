import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { accountId, token, query } = await request.json();

    // Validate input
    if (!accountId || !token) {
      return NextResponse.json(
        { error: "Missing required parameters or invalid format" },
        { status: 400 }
      );
    }

    // Execute SuiteQL query
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "transient",
      },
      body: JSON.stringify({ q: query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SuiteQL query failed: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Error in get Transactions:", error);
    return NextResponse.json(
      { error: "Failed to get Transactions", details: error.message },
      { status: 500 }
    );
  }
}

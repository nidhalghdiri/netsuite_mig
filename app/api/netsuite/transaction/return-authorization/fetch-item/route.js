import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { itemUrl, token } = await request.json();
    console.log("Fetch Item URL: ", itemUrl);

    if (!itemUrl || !token) {
      return NextResponse.json(
        { error: "itemUrl and token are required" },
        { status: 400 }
      );
    }
    const response = await fetch(itemUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "transient",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: "Failed to fetch Item",
          details: errorData.message || response.statusText,
          status: response.status,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in fetch-item:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

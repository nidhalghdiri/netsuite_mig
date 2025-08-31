import { NextResponse } from "next/server";

export async function POST(request) {
  const { itemUrl, token } = await request.json();

  try {
    const response = await fetch(itemUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "transient",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      const errorMessage =
        error.message || error.error?.message || "Unknown error occurred";
      throw new Error(`Failed to fetch Item: ${errorMessage}`);
    }

    return NextResponse.json(response.json());
  } catch (error) {
    console.error("Error Item :", error);
    return NextResponse.json(
      { error: "Failed to Item ", details: error.message },
      { status: 500 }
    );
  }
}

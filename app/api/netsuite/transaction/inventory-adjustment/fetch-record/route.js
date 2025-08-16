import { NextResponse } from "next/server";
export async function POST(request) {
  const { accountId, token, internalId } = await request.json();
  console.log("[InventoryAdjustment] AccountId: ", accountId);
  console.log("[InventoryAdjustment] token: ", token);
  console.log("[InventoryAdjustment] internalId: ", internalId);

  try {
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/inventoryAdjustment/${internalId}/`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "transient",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch record: ${error.error.message}`);
    }

    const record = await response.json();
    console.log("[InventoryAdjustment] internalId: ", record);

    return NextResponse.json(record);
  } catch (error) {
    console.error("Error fetching record:", error);
    return NextResponse.json(
      { error: "Failed to fetch record", details: error.message },
      { status: 500 }
    );
  }
}

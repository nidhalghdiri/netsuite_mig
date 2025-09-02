import { NextResponse } from "next/server";

export async function POST(request) {
  const { accountId, token, internalId } = await request.json();
  console.log("[Deposit] AccountId: ", accountId);
  console.log("[Deposit] token: ", token);
  console.log("[Deposit] internalId: ", internalId);

  try {
    // Fetch Inventory Adjustment Fields
    const record = await fetchRecord(accountId, token, "deposit", internalId);

    return NextResponse.json(record);
  } catch (error) {
    console.error("Error fetching record:", error);
    return NextResponse.json(
      { error: "Failed to fetch record", details: error.message },
      { status: 500 }
    );
  }
}

async function fetchRecord(accountId, token, recordType, internalId) {
  const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${recordType}/${internalId}`;

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
    throw new Error(`Failed to fetch ${recordType}: ${error.error.message}`);
  }

  return response.json();
}

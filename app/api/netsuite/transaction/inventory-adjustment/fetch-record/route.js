import { NextResponse } from "next/server";

// List of fields that contain references we want to expand
const REFERENCE_FIELDS = [
  "account",
  "subsidiary",
  "location",
  "department",
  "class",
  "item",
];
export async function POST(request) {
  const { accountId, token, internalId } = await request.json();
  console.log("[InventoryAdjustment] AccountId: ", accountId);
  console.log("[InventoryAdjustment] token: ", token);
  console.log("[InventoryAdjustment] internalId: ", internalId);

  try {
    const record = await fetchRecord(
      accountId,
      token,
      "inventoryAdjustment",
      internalId
    );

    console.log("[InventoryAdjustment] RECORD: ", record);

    const expandedRecord = await expandReferences(accountId, token, record);

    // 3. Process inventory items if they exist
    if (expandedRecord.inventoryList?.items) {
      expandedRecord.inventoryList.items = await Promise.all(
        expandedRecord.inventoryList.items.map((item) =>
          expandReferences(accountId, token, item)
        )
      );
    }

    return NextResponse.json(expandedRecord);
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

async function expandReferences(accountId, token, record) {
  const expanded = { ...record };

  for (const field of REFERENCE_FIELDS) {
    if (!record[field]?.id) continue;

    try {
      // Determine record type from field name
      const recordType = field === "item" ? "inventoryItem" : field;

      // Fetch the referenced record
      const refRecord = await fetchRecord(
        accountId,
        token,
        recordType,
        record[field].id
      );

      // Add the full record data to our expanded record
      expanded[field] = {
        ...record[field],
        ...refRecord,
        // Preserve the original reference structure
        links: record[field].links,
        refName: record[field].refName,
        id: record[field].id,
      };
    } catch (error) {
      console.warn(`Failed to expand ${field} reference:`, error);
      // Keep the original reference if expansion fails
      expanded[field] = record[field];
    }
  }

  return expanded;
}

// app/api/netsuite/create-record/route.js
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { accountId, token, recordType, recordData } = await request.json();

    // Validate input
    if (!accountId || !token || !recordType || !recordData) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Transform inventory adjustment data for new instance
    const transformedData = transformInventoryAdjustment(recordData);

    // Create record in new instance
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${recordType}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "transient",
      },
      body: JSON.stringify(transformedData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create record: ${error.error.message}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating record:", error);
    return NextResponse.json(
      { error: "Failed to create record", details: error.message },
      { status: 500 }
    );
  }
}

function transformInventoryAdjustment(data) {
  // Basic fields
  const transformed = {
    externalId: data.externalId,
    tranDate: data.tranDate,
    memo: data.memo,
    subsidiary: { id: data.subsidiary.new_id },
    account: { id: data.account.new_id },
    adjLocation: { id: data.adjLocation.new_id },
    postingPeriod: { id: data.postingPeriod.id },
  };

  // Custom fields
  const customFields = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("custbody") && !value?.id) {
      customFields[key] = value;
    }
  }
  if (Object.keys(customFields).length > 0) {
    transformed.customFields = customFields;
  }

  // Inventory items
  if (data.inventory?.items) {
    transformed.items = data.inventory.items.map((item) => ({
      item: { id: item.item.new_id },
      location: { id: item.location.new_id },
      quantity: item.adjustQtyBy,
      unitCost: item.unitCost,
      description: item.description,
      memo: item.memo,
      inventoryDetail: transformInventoryDetail(item.inventoryDetail),
    }));
  }

  return transformed;
}

function transformInventoryDetail(detail) {
  if (!detail) return null;

  const transformed = {
    quantity: detail.quantity,
    unit: detail.unit,
  };

  // Inventory assignments
  if (detail.inventoryAssignment?.items) {
    transformed.inventoryAssignment = {
      items: detail.inventoryAssignment.items.map((ass) => ({
        quantity: ass.quantity,
        receiptInventoryNumber: ass.receiptInventoryNumber,
      })),
    };
  }

  return transformed;
}

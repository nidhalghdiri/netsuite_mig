// app/api/netsuite/create-record/route.js
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

    console.log("transformedData : ", JSON.stringify(transformedData));

    // Create record in new instance
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${recordType}`;
    const idempotencyKey = randomUUID();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "respond-async",
        "X-NetSuite-Idempotency-Key": idempotencyKey,
        "X-NetSuite-PropertyNameValidation": "Warning",
        "X-NetSuite-PropertyValueValidation": "Warning",
      },
      body: JSON.stringify(transformedData),
    });

    if (!response.ok) {
      const responseText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorResponse = JSON.parse(responseText);
        // Handle NetSuite's error structure safely
        if (errorResponse.error?.message) {
          errorMessage = errorResponse.error.message;
        } else {
          errorMessage += ` - ${responseText.substring(0, 100)}`;
        }
      } catch (e) {
        errorMessage += ` - ${responseText.substring(0, 100)}`;
      }

      throw new Error(`Failed to create record: ${errorMessage}`);
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
    // postingPeriod: { id: data.postingPeriod.id },
  };

  // Custom fields
  //   const customFields = {};
  //   for (const [key, value] of Object.entries(data)) {
  //     if (key.startsWith("custbody") && !value?.id) {
  //       customFields[key] = value;
  //     }
  //   }
  //   if (Object.keys(customFields).length > 0) {
  //     transformed.customFields = customFields;
  //   }

  // Inventory items
  if (data.inventory?.items) {
    transformed.inventory = data.inventory.items.map((item) => ({
      item: { id: item.item.new_id },
      location: { id: item.location.new_id },
      quantity: item.adjustQtyBy,
      //   unitCost: item.unitCost,
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

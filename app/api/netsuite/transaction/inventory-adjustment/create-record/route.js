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
    // const transformedData = transformInventoryAdjustment(recordData);
    // Transform data using NetSuite's structure
    const transformedData = {
      externalId: recordData.externalId,
      tranDate: recordData.tranDate,
      memo: recordData.memo,
      subsidiary: { id: recordData.subsidiary.id },
      account: { id: recordData.account.id },
      adjLocation: { id: recordData.adjLocation.id },
      //   postingPeriod: { id: recordData.postingPeriod.id },
      inventory: {
        items: recordData.inventory.items.map((item) => ({
          item: { id: item.item.id },
          location: { id: item.location.id },
          adjustQtyBy: item.quantity,
          description: item.description,
          memo: item.memo,
          inventoryDetail: item.inventoryDetail
            ? {
                quantity: item.inventoryDetail.quantity,
                unit: { id: item.inventoryDetail.unit },
                inventoryAssignment: {
                  items: item.inventoryDetail.inventoryAssignment.items.map(
                    (ass) => ({
                      quantity: ass.quantity,
                      receiptInventoryNumber: ass.receiptInventoryNumber,
                    })
                  ),
                },
              }
            : null,
        })),
      },
    };

    console.log("Final Payload:", JSON.stringify(transformedData, null, 2));

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
        errorMessage += ` - ${errorResponse.title || "No error title"}`;
        if (errorResponse.detail) {
          errorMessage += `: ${errorResponse.detail}`;
        }
        if (errorResponse["o:errorDetails"]) {
          errorMessage += ` | Details: ${JSON.stringify(
            errorResponse["o:errorDetails"]
          )}`;
        }
      } catch (e) {
        errorMessage += ` - ${responseText.substring(0, 200)}`;
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

  // Transform items - handle both structures
  let items = [];
  if (Array.isArray(data.items)) {
    items = data.items;
  } else if (Array.isArray(data.inventory)) {
    items = data.inventory;
  } else if (data.inventory?.items && Array.isArray(data.inventory.items)) {
    items = data.inventory.items;
  }

  if (items.length > 0) {
    transformed.inventory = items.map((item) => ({
      item: { id: item.item.id },
      location: { id: item.location.id },
      quantity: item.quantity || item.adjustQtyBy,
      description: item.description,
      memo: item.memo,
      inventoryDetail: item.inventoryDetail
        ? transformInventoryDetail(item.inventoryDetail)
        : null,
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

// app/api/netsuite/create-record/route.js
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
export async function POST(request) {
  try {
    const {
      accountId,
      oldAccountId,
      token,
      oldToken,
      recordType,
      recordData,
      unitMapping,
      lotNumbers,
    } = await request.json();

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
    const lotNumbersToMap = [];

    var transformedData = {
      // Basic fields with defaults
      tranId: recordData.tranId || "",
      tranDate: recordData.tranDate || new Date().toISOString().split("T")[0],
      prevDate: recordData.prevDate || "",
      memo: recordData.memo ? recordData.memo.substring(0, 4000) : "",
      payment: parseFloat(recordData.payment) || 0.0,

      // Object fields with safety checks
      ...(recordData.undepFunds?.id && {
        undepFunds: { id: recordData.undepFunds.id },
      }),
      ...(recordData.subsidiary?.new_id && {
        subsidiary: { id: recordData.subsidiary.new_id },
      }),
      ...(recordData.status?.id && { status: { id: recordData.status.id } }),
      ...(recordData.customer?.new_id && {
        customer: { id: recordData.customer.new_id },
      }),
      ...(recordData.currency?.id && {
        currency: { id: recordData.currency.id },
      }),
      ...(recordData.aracct?.new_id && {
        aracct: { id: recordData.aracct.new_id },
      }),
      ...(recordData.account?.new_id && {
        account: { id: recordData.account.new_id },
      }),

      // Apply array with comprehensive safety
      ...(recordData.apply?.items && {
        apply: {
          items: (recordData.apply.items || [])
            .filter((line) => line !== null && line !== undefined)
            .map((line) => ({
              apply: Boolean(line.apply),
              amount: parseFloat(line.amount) || 0.0,
              applyDate: line.applyDate || "",
              type: line.type || "",
              ...(line.doc?.new_id && { doc: { id: line.doc.new_id } }),
            })),
        },
      }),
    };

    console.log("Final Payload:", JSON.stringify(transformedData, null, 2));
    if (
      transformedData.apply &&
      transformedData.apply.items &&
      Array.isArray(transformedData.apply.items)
    ) {
      transformedData.apply.items = transformedData.apply.items.filter((item) =>
        isValidDoc(item.doc)
      );

      // If no items remain after filtering, remove the apply section entirely
      if (transformedData.apply.items.length === 0) {
        delete transformedData.apply;
      }
    }
    console.log(
      "Final Payload Final:",
      JSON.stringify(transformedData, null, 2)
    );
    // Create record in new instance
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${recordType}`;
    const idempotencyKey = randomUUID();
    console.log("Create JOURNAL URL ", url);
    console.log("Create JOURNAL idempotencyKey ", idempotencyKey);

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

    // Handle 202 Accepted (async processing)
    if (response.status === 202) {
      const locationHeader = response.headers.get("Location");

      if (!locationHeader) {
        throw new Error("Location header not found in 202 response");
      }
      console.log("Async job started. Location:", locationHeader);

      return NextResponse.json({
        status: "processing",
        jobUrl: locationHeader,
        lotNumbersToMap,
        message:
          "Transaction creation in progress. Use the jobUrl to check status.",
      });
    }
    // Handle sync response
    if (response.ok) {
      const result = await response.json();
      return NextResponse.json({
        status: "completed",
        data: result,
        message: "Transaction created successfully",
      });
    }
    // Handle errors
    const errorText = await response.text();
    throw new Error(
      `Failed to create record: ${response.status} - ${errorText}`
    );
  } catch (error) {
    console.error("Error creating record:", error);
    return NextResponse.json(
      { error: "Failed to create record", details: error.message },
      { status: 500 }
    );
  }
}

function isValidDoc(doc) {
  // Check if doc exists and has the required structure for the API
  return doc && doc.id && doc.id !== false && doc.new_id; // This is the key field needed for the migration
}

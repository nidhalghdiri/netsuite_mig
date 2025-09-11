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
      memo: recordData.memo ? recordData.memo.substring(0, 4000) : "",
      total: parseFloat(recordData.total) || 0.0,

      // Object fields with safety checks
      ...(recordData.account?.new_id && {
        account: { id: recordData.account.new_id },
      }),
      ...(recordData.currency?.id && {
        currency: { id: recordData.currency.id },
      }),
      ...(recordData.entity?.new_id && {
        entity: { id: recordData.entity.new_id },
      }),
      ...(recordData.landedCostMethod?.id && {
        landedCostMethod: { id: recordData.landedCostMethod.id },
      }),
      ...(recordData.subsidiary?.new_id && {
        subsidiary: { id: recordData.subsidiary.new_id },
      }),

      // Expense array with comprehensive safety
      ...(recordData.expense?.items && {
        expense: {
          items: (recordData.expense.items || [])
            .filter((line) => line !== null && line !== undefined)
            .map((line) => ({
              amount: parseFloat(line.amount) || 0.0,
              isBillable: Boolean(line.isBillable),
              memo: line.memo ? line.memo.substring(0, 4000) : "",
              ...(line.account?.new_id && {
                account: { id: line.account.new_id },
              }),
              ...(line.location?.new_id && {
                location: { id: line.location.new_id },
              }),
            })),
        },
      }),
    };

    console.log("Final Payload:", JSON.stringify(transformedData, null, 2));

    // Create record in new instance
    // const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${recordType}`;
    const url = `https://${accountId}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1054&deploy=1`;
    const idempotencyKey = randomUUID();
    console.log("Create  URL ", url);
    console.log("Create  idempotencyKey ", idempotencyKey);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Prefer: "respond-async",
        // "X-NetSuite-Idempotency-Key": idempotencyKey,
        // "X-NetSuite-PropertyNameValidation": "Warning",
        // "X-NetSuite-PropertyValueValidation": "Warning",
      },
      body: JSON.stringify({
        data: transformedData,
      }),
    });

    // Handle 202 Accepted (async processing)
    // if (response.status === 202) {
    //   const locationHeader = response.headers.get("Location");

    //   if (!locationHeader) {
    //     throw new Error("Location header not found in 202 response");
    //   }
    //   console.log("Async job started. Location:", locationHeader);

    //   return NextResponse.json({
    //     status: "processing",
    //     jobUrl: locationHeader,
    //     lotNumbersToMap,
    //     message:
    //       "Transaction creation in progress. Use the jobUrl to check status.",
    //   });
    // }
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

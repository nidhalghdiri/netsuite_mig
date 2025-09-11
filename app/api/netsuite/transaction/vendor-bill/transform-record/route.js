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
      transformURL,
    } = await request.json();

    // Validate input
    if (!accountId || !token || !recordType || !recordData) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // const unitMapping = await getUnitMapping(oldAccountId, oldToken);
    // console.log("unitMapping", unitMapping);
    // console.log("lotNumbers", lotNumbers);

    // Transform inventory adjustment data for new instance
    // const transformedData = transformInventoryAdjustment(recordData);
    // Transform data using NetSuite's structure
    const lotNumbersToMap = [];

    const transformedData = {
      ...(recordData.externalId && { externalId: recordData.externalId }),
      tranId: recordData.tranId || "",
      tranDate: recordData.tranDate || new Date().toISOString().split("T")[0],
      ...(recordData.memo && {
        memo: recordData.memo ? recordData.memo.substring(0, 4000) : "",
      }),
      ...(recordData.subsidiary &&
        recordData.subsidiary.new_id && {
          subsidiary: { id: recordData.subsidiary.new_id },
        }),
      ...(recordData.id && {
        custbody_mig_old_internal_id: parseFloat(recordData.id) || 0.0,
      }),
      ...(recordData.location &&
        recordData.location.new_id && {
          location: { id: recordData.location.new_id },
        }),
      ...(recordData.landedCostMethod &&
        recordData.landedCostMethod.id && {
          landedCostMethod: { id: recordData.landedCostMethod.id },
        }),
      ...(recordData.account &&
        recordData.account.new_id && {
          account: { id: recordData.account.new_id.toString() },
        }),
      ...(recordData.entity &&
        recordData.entity.new_id && {
          entity: { id: recordData.entity.new_id },
        }),
      ...(recordData.employee &&
        recordData.employee.new_id && {
          employee: { id: recordData.employee.new_id },
        }),
      ...(recordData.currency &&
        recordData.currency.id && {
          currency: { id: recordData.currency.id },
        }),
    };

    console.log("Final Payload:", JSON.stringify(transformedData, null, 2));
    console.log(
      "Lot numbers to map:",
      JSON.stringify(lotNumbersToMap, null, 2)
    );

    // Create record in new instance
    const url = transformURL;
    const idempotencyKey = randomUUID();
    console.log("Create VENDORBILL URL ", url);
    console.log("Create VENDORBILL idempotencyKey ", idempotencyKey);

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

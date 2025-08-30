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

    const transformedData = {
      tranId: recordData.tranId,

      tranDate: recordData.tranDate,
      subsidiary: { id: recordData.subsidiary?.new_id },
      reversalDefer: recordData.reversalDefer,
      memo: recordData.memo ? recordData.memo.substring(0, 4000) : "",
      isReversal: recordData.isReversal,
      approvalStatus: { id: recordData.approvalStatus.id },
      currency: { id: recordData.currency.id },
      // postingPeriod: { id: "20" },
      line: {
        items: recordData.line.items.map((line) => ({
          account: { id: line.account?.new_id },
          cleared: line.cleared,
          debit: parseFloat(line.debit) || 0.0,
          credit: parseFloat(line.credit) || 0.0,
          ...(line.department && {
            department: { id: line.department.new_id },
          }),
          ...(line.location && { location: { id: line.location.new_id } }),
          ...(line.item && { item: { id: line.item.new_id } }),
          ...(line.entity && { entity: { id: line.entity.new_id } }),
          eliminate: line.eliminate,
          memo: line.memo ? line.memo.substring(0, 4000) : "",
        })),
      },
    };

    console.log("Final Payload:", JSON.stringify(transformedData, null, 2));
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

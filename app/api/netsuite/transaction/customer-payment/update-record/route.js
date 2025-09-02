// app/api/netsuite/create-record/route.js
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
export async function POST(request) {
  try {
    const { accountId, token, recordType, internalId, newId, newTransaction } =
      await request.json();

    // Validate input
    if (!accountId || !token || !recordType || !internalId || !newId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }
    console.log("UPDATE Record [" + internalId + "]: ", "New ID : " + newId);

    // Create record in new instance
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${recordType}/${internalId}`;
    console.log("UPDATE URL: ", url);
    const idempotencyKey = randomUUID();

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "respond-async",
        "X-NetSuite-Idempotency-Key": idempotencyKey,
        "X-NetSuite-PropertyNameValidation": "Warning",
        "X-NetSuite-PropertyValueValidation": "Warning",
      },
      body: JSON.stringify({
        custbody_mig_new_internal_id: parseFloat(newId) || 0.0,
        custbody_ogg_tran_ref_num: "0000",
      }),
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
        message:
          "Transaction Update in progress. Use the jobUrl to check status.",
      });
    }
    // Handle sync response
    if (response.ok) {
      const result = await response.json();
      return NextResponse.json({
        status: "completed",
        data: result,
        message: "Transaction updated successfully",
      });
    }
    // Handle errors
    const errorText = await response.text();
    throw new Error(
      `Failed to update record: ${response.status} - ${errorText}`
    );
  } catch (error) {
    console.error("Error updating record:", error);
    return NextResponse.json(
      { error: "Failed to update record", details: error.message },
      { status: 500 }
    );
  }
}

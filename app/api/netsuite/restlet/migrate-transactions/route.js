// app/api/netsuite/restlet/migrate-transactions/route.js
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const {
      oldAccountId,
      newAccountId,
      oldToken,
      newToken,
      transactionIds,
      transactionType,
      dateFilters,
    } = await request.json();

    // Validate input
    if (
      !oldAccountId ||
      !newAccountId ||
      !oldToken ||
      !newToken ||
      !transactionIds
    ) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Call your NetSuite RESTlet that triggers the Map/Reduce script
    const restletUrl = `https://${oldAccountId}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1536&deploy=1`;

    const response = await fetch(restletUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${oldToken}`,
      },
      body: JSON.stringify({
        action: "startMigration",
        // transactionIds: transactionIds,
        transactionType: transactionType,
        dateFilters: dateFilters, // Include date parameters
        newInstance: {
          accountId: newAccountId,
          token: newToken,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`RESTlet call failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      return NextResponse.json({
        success: true,
        jobId: result.jobId,
        message: "Migration started successfully",
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to start migration",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("RESTlet migration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

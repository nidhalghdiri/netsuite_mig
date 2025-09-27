// app/api/netsuite/restlet/migration-status/route.js
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Call your NetSuite RESTlet to get migration status
    const restletUrl = `https://5319757.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1536&deploy=1`;

    const response = await fetch(restletUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NETSUITE_TOKEN}`,
      },
      body: JSON.stringify({
        action: "getStatus",
        jobId: jobId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }

    const status = await response.json();
    return NextResponse.json(status);
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      {
        error: error.message,
        status: "error",
      },
      { status: 500 }
    );
  }
}

// app/api/migration/start/route.js
import { migrationQueue } from "@/lib/queue";
import { randomUUID } from "crypto";

export async function POST(request) {
  try {
    const { accountId, oldAccountId, token, oldToken, recordType, recordData } =
      await request.json();

    // Validate input
    if (!accountId || !token || !recordType || !recordData) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Create job ID
    const jobId = randomUUID();

    // Add to queue
    migrationQueue.addJob(jobId, {
      type: "create-inventory-adjustment",
      data: {
        accountId,
        oldAccountId,
        token,
        oldToken,
        recordType,
        recordData,
      },
      steps: ["get-unit-mapping", "get-lot-numbers", "create-transaction"],
    });

    return NextResponse.json({
      jobId,
      status: "queued",
      message: "Migration job started",
    });
  } catch (error) {
    console.error("Error starting migration:", error);
    return NextResponse.json(
      { error: "Failed to start migration", details: error.message },
      { status: 500 }
    );
  }
}

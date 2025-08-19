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
      tranId: recordData.tranId,
      tranDate: recordData.tranDate,
      memo: recordData.memo,
      subsidiary: { id: recordData.subsidiary.new_id },
      account: { id: recordData.account.new_id },
      adjLocation: { id: recordData.adjLocation.new_id },
      // postingPeriod: { id: "20" },
      inventory: {
        items: recordData.inventory.items.map((item) => ({
          item: { id: item.item.new_id },
          location: { id: item.location.new_id },
          adjustQtyBy: item.adjustQtyBy,
          unitCost: item.unitCost,
          description: item.description,
          exchangeRate: item.exchangeRate,
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
    console.log("Create INVADJUST URL ", url);
    console.log("Create INVADJUST idempotencyKey ", idempotencyKey);

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
      try {
        // Step 1: Get the record link through async processing
        const recordLink = await getAsyncResultLink(locationHeader, token);
        console.log("Record link retrieved:", recordLink);

        // Step 2: Extract internal ID from record link
        const internalId = recordLink.substring(
          recordLink.lastIndexOf("/") + 1
        );
        console.log("Created record internal ID:", internalId);

        return NextResponse.json({
          success: true,
          internalId,
          recordLink,
        });
      } catch (asyncError) {
        console.error("Async processing failed:", asyncError);
        return NextResponse.json(
          {
            error: "Async processing failed",
            details: asyncError.message,
          },
          { status: 500 }
        );
      }
    }
    // Handle other successful responses
    if (response.ok) {
      const result = await response.json();
      return NextResponse.json(result);
    }
    // Handle errors
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
  } catch (error) {
    console.error("Error creating record:", error);
    return NextResponse.json(
      { error: "Failed to create record", details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to get async result link (matches your Kotlin logic)
async function getAsyncResultLink(locationHeader, token) {
  let jobUrl = locationHeader.trim();
  let attempts = 0;
  const maxAttempts = 12; // 12 attempts * 5s = 60s timeout

  while (attempts < maxAttempts) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 3000)); // 5s delay

    try {
      const jobResponse = await fetch(jobUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!jobResponse.ok) {
        throw new Error(`Job status request failed: ${jobResponse.status}`);
      }

      const jobResult = await jobResponse.json();

      // Check if job is completed and succeeded
      if (jobResult.completed && jobResult.progress === "succeeded") {
        // Step 1: Extract task link
        const taskLink = jobResult.task.links.find(
          (link) => link.rel === "self"
        )?.href;

        if (!taskLink) {
          throw new Error("Task self link not found");
        }

        // Step 2: Fetch task details
        const taskResponse = await fetch(taskLink, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!taskResponse.ok) {
          throw new Error(`Task request failed: ${taskResponse.status}`);
        }

        const taskResult = await taskResponse.json();

        // Get first item from task
        if (!taskResult.items || taskResult.items.length === 0) {
          throw new Error("No items in task result");
        }

        const firstItem = taskResult.items[0];
        const subTaskLink = firstItem.links.find(
          (link) => link.rel === "self"
        )?.href;

        if (!subTaskLink) {
          throw new Error("Subtask self link not found");
        }

        // Step 3: Fetch subtask details
        const subTaskResponse = await fetch(subTaskLink, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!subTaskResponse.ok) {
          throw new Error(`Subtask request failed: ${subTaskResponse.status}`);
        }

        const subTaskResult = await subTaskResponse.json();

        // Step 4: Find related record link
        const recordLink = subTaskResult.links.find(
          (link) => link.rel === "related"
        )?.href;

        if (!recordLink) {
          throw new Error("Record related link not found");
        }

        return recordLink;
      } else if (jobResult.completed && jobResult.progress !== "succeeded") {
        throw new Error(`Job failed with status: ${jobResult.progress}`);
      }
    } catch (error) {
      console.error(`Polling attempt ${attempts} failed:`, error);
      if (attempts >= maxAttempts) {
        throw new Error("Max polling attempts reached without completion");
      }
    }
  }

  throw new Error("Max polling attempts reached without job completion");
}

// app/api/netsuite/lot-mapping/route.js
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request) {
  try {
    const { accountId, token, mapping } = await request.json();

    // Validate input
    if (!accountId || !token || !mapping) {
      return NextResponse.json(
        { error: "Missing required parameters or invalid format" },
        { status: 400 }
      );
    }

    if (!mapping.old_id || !mapping.new_id) {
      return NextResponse.json(
        { error: "Mapping IDs are required: old_id and new_id" },
        { status: 400 }
      );
    }
    // Execute SuiteQL query
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/customrecord_mig_lot_number_relation`;
    const idempotencyKey = randomUUID();

    const payload = {
      custrecord_mig_lot_number_old_id: parseInt(mapping.old_id),
      custrecord_mig_lot_number_new_id: parseInt(mapping.new_id),
      custrecord_mig_lot_number_name: mapping.refName || "",
    };

    console.log(
      "Creating lot mapping with payload:",
      JSON.stringify(payload, null, 2)
    );

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
      body: JSON.stringify(payload),
    });

    if (response.status === 202) {
      const locationHeader = response.headers.get("Location");
      if (!locationHeader) {
        throw new Error("Location header not found in 202 response");
      }
      try {
        // Step 1: Get the record link through async processing
        const resultUrl = await getAsyncResultLink(locationHeader, token);
        // Step 2: Fetch the result URL to get the record location
        const resultResponse = await fetch(resultUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Handle 204 No Content response
        if (resultResponse.status === 204) {
          const recordLocation = resultResponse.headers.get("Location");

          if (!recordLocation) {
            throw new Error("Location header not found in result response");
          }

          // Step 3: Extract internal ID from record location
          const internalId = recordLocation.substring(
            recordLocation.lastIndexOf("/") + 1
          );

          if (!internalId || isNaN(internalId)) {
            throw new Error("Invalid internal ID format: " + internalId);
          }

          console.log(
            "Created MIG Lot Number Relation internal ID:",
            internalId
          );

          return NextResponse.json({
            success: true,
            internalId,
            message: "Lot mapping created successfully",
          });
        }
        // Handle unexpected responses
        const resultText = await resultResponse.text();
        throw new Error(
          `Unexpected result response: ${resultResponse.status} - ${resultText}`
        );
      } catch (asyncError) {
        console.error("Async processing failed for lot mapping:", asyncError);
        return NextResponse.json(
          {
            error: "Async processing failed for lot mapping",
            details: asyncError.message,
          },
          { status: 500 }
        );
      }
    }
    // Handle other successful responses (non-async)
    if (response.ok) {
      const result = await response.json();
      return NextResponse.json({
        success: true,
        data: result,
        message: "Lot mapping created successfully (sync)",
      });
    }

    // Handle errors
    const errorText = await response.text();
    let errorMessage = `Failed to create lot mapping: HTTP ${response.status}`;

    try {
      const errorResponse = JSON.parse(errorText);
      errorMessage += ` - ${
        errorResponse.error?.message ||
        errorResponse.title ||
        errorText.substring(0, 100)
      }`;
    } catch (e) {
      errorMessage += ` - ${errorText.substring(0, 100)}`;
    }

    throw new Error(errorMessage);
  } catch (error) {
    console.error("Error in lot mapping:", error);
    return NextResponse.json(
      { error: "Failed to get lot mapping", details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to get async result link (matches your Kotlin logic)
async function getAsyncResultLink(locationHeader, token) {
  let jobUrl = locationHeader.trim();
  let attempts = 0;
  const maxAttempts = 12; // 30 attempts * 5s = 2.5 minutes timeout

  while (attempts < maxAttempts) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s delay

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

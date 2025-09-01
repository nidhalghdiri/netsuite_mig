import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { jobUrl, token, recordType } = await request.json();

    if (!jobUrl || !token) {
      return NextResponse.json(
        { error: "Missing jobUrl or token parameters" },
        { status: 400 }
      );
    }
    // Step 1: Get the record link through async processing
    const resultUrl = await getAsyncResultLink(jobUrl, token, recordType);
    console.log("Record link retrieved:", resultUrl);
    // Step 2: Fetch the result URL to get the record location
    const resultResponse = await fetch(resultUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    // Handle 204 No Content response
    if (resultResponse.status !== 204) {
      const errorText = await resultResponse.text();
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch (e) {
        errorDetails = { error: errorText };
      }
      console.log("[Get-Status] ERROR: ", errorDetails);

      // Check if this is an inventory quantity error
      const hasInventoryErrorPattern1 = errorDetails["o:errorDetails"]?.some(
        (detail) =>
          detail.detail?.includes("You only have") &&
          detail.detail?.includes("available")
      );
      const hasInventoryErrorPattern2 = errorDetails["o:errorDetails"]?.some(
        (detail) =>
          detail.detail?.includes("Inventory numbers are not available")
      );
      const hasInventoryErrorPattern3 = errorDetails["o:errorDetails"]?.some(
        (detail) =>
          detail.detail?.includes(
            "You cannot create an inventory detail for this item"
          )
      );
      const isInventoryError =
        hasInventoryErrorPattern1 ||
        hasInventoryErrorPattern2 ||
        hasInventoryErrorPattern3;

      console.log("[Get-Status] isInventoryError: ", isInventoryError);

      return NextResponse.json(
        {
          error: "NetSuite Error",
          details: errorDetails,
          isInventoryError: isInventoryError,
        },
        { status: resultResponse.status }
      );
    }
    const recordLocation = resultResponse.headers.get("Location");
    if (!recordLocation) {
      throw new Error("Location header not found in result response");
    }

    console.log("Record location header:", recordLocation);

    // Step 3: Extract internal ID from record location
    const internalId = recordLocation.substring(
      recordLocation.lastIndexOf("/") + 1
    );

    if (!internalId || isNaN(internalId)) {
      throw new Error("Invalid internal ID format: " + internalId);
    }

    console.log("Created record internal ID:", internalId);

    return NextResponse.json({
      success: true,
      internalId,
    });
  } catch (error) {
    console.error("Error Get Status:", error);
    return NextResponse.json(
      { error: "Failed to get status", details: error.message },
      { status: 500 }
    );
  }
}

async function getAsyncResultLink(locationHeader, token, recordType) {
  let jobUrl = locationHeader.trim();
  let attempts = 0;
  let maxAttempts, delayMs;
  if (recordType == "journalEntry") {
    // Longer timeout for journal entries, especially large ones
    maxAttempts = 30; // Increased from 12
    delayMs = 5000; // 5 seconds between attempts (increased from 3)
  } else if (recordType == "inventoryAdjustment") {
    // Longer timeout for journal entries, especially large ones
    maxAttempts = 90; // Increased from 12
    delayMs = 5000; // 5 seconds between attempts (increased from 3)
  } else {
    // Default settings for other record types
    maxAttempts = 15;
    delayMs = 3000;
  }
  console.log(
    `Starting async processing for ${recordType}, max attempts: ${maxAttempts}, delay: ${delayMs}ms`
  );

  // const maxAttempts = 12; // 30 attempts * 5s = 2.5 minutes timeout

  while (attempts < maxAttempts) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, delayMs)); // 5s delay

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

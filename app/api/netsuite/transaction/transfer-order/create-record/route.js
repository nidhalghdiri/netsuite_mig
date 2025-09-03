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

    console.log("unitMapping", unitMapping);
    console.log("lotNumbers", lotNumbers);

    // Helper function to safely get new_id with error reporting
    const getNewId = (obj, fieldName) => {
      if (!obj) {
        throw new Error(`${fieldName} is undefined`);
      }
      if (!obj.new_id) {
        throw new Error(`${fieldName} is missing new_id property`);
      }
      return obj.new_id;
    };

    try {
      // Transform data using NetSuite's structure
      const transformedData = {
        tranId: recordData.tranId,
        tranDate: recordData.tranDate,
        memo: recordData.memo || "",
        ...(recordData.currency && {
          currency: { id: recordData.currency.id },
        }),
        ...(recordData.department && {
          department: { id: getNewId(recordData.department, "Department") },
        }),
        ...(recordData.firmed && { firmed: recordData.firmed }),
        ...(recordData.incoTerm && { incoTerm: recordData.incoTerm }),
        location: { id: getNewId(recordData.location, "Location") },
        shipAddress: recordData.shipAddress || "",
        subsidiary: { id: getNewId(recordData.subsidiary, "Subsidiary") },
        transferLocation: {
          id: getNewId(recordData.transferLocation, "Transfer Location"),
        },
        ...(recordData.useItemCostAsTransferCost && {
          useItemCostAsTransferCost: recordData.useItemCostAsTransferCost,
        }),
        custbody_mig_old_internal_id: parseFloat(recordData.id) || 0.0,
        orderStatus: { id: "B" },
        item: {
          items: recordData.item.items.map((item, index) => {
            // Validate required item properties
            if (!item.item) {
              throw new Error(`Item at index ${index} is missing item object`);
            }

            return {
              item: { id: getNewId(item.item, `Item at index ${index}`) },
              ...(item.cseg2 && { cseg2: { id: item.cseg2.id } }),
              description: item.description
                ? item.description.substring(0, 40)
                : "",
              ...(item.exchangeRate && { exchangeRate: item.exchangeRate }),
              memo: item.memo ? item.memo.substring(0, 4000) : "",
              units: unitMapping[item.inventoryDetail?.unit] || "",
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              ...(item.inventoryDetail && {
                inventoryDetail: {
                  quantity: item.inventoryDetail.quantity,
                  unit: unitMapping[item.inventoryDetail.unit] || "",
                  inventoryAssignment: {
                    items: item.inventoryDetail.inventoryAssignment.items.map(
                      (ass, assIndex) => {
                        // Check if we have a new_id for this lot number
                        if (ass.issueInventoryNumber && ass.new_id) {
                          return {
                            internalId: ass.new_id,
                            quantity: ass.quantity,
                            receiptInventoryNumber:
                              ass.refName?.toString() || "",
                          };
                        }
                        // Validate required assignment properties
                        if (ass.quantity === undefined) {
                          throw new Error(
                            `Assignment at index ${assIndex} in item ${index} is missing quantity`
                          );
                        }
                        return {
                          quantity: ass.quantity,
                        };
                      }
                    ),
                  },
                },
              }),
            };
          }),
        },
      };

      console.log("Final Payload:", JSON.stringify(transformedData, null, 2));

      // Create record in new instance
      const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${recordType}`;
      const idempotencyKey = randomUUID();
      console.log("Create TRANSFERORDER URL ", url);
      console.log("Create TRANSFERORDER idempotencyKey ", idempotencyKey);

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
    } catch (transformationError) {
      console.error("Error transforming data:", transformationError);
      return NextResponse.json(
        {
          error: "Data transformation failed",
          details: transformationError.message,
        },
        { status: 400 }
      );
    }
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
  const maxAttempts = 200; // 30 attempts * 5s = 2.5 minutes timeout

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

async function getUnitMapping(accountId, token) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/unit-mapping`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          token,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get unit mapping");
    }

    const result = await response.json();
    return result.unitMapping;
  } catch (error) {
    console.error("Error getting unit mapping:", error);
    throw error;
  }
}

// Add this function to your route.js file
async function getLotMapping(accountId, token) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/lot-mapping`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          token,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get lot mapping");
    }

    const result = await response.json();
    return result.lotMapping;
  } catch (error) {
    console.error("Error getting lot mapping:", error);
    throw error;
  }
}

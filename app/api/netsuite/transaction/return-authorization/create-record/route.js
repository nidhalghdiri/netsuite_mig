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

    // console.log("unitMapping", unitMapping);
    // console.log("lotNumbers", lotNumbers);

    // Transform inventory adjustment data for new instance
    // const transformedData = transformInventoryAdjustment(recordData);
    // Transform data using NetSuite's structure
    const lotNumbersToMap = [];

    const transformedData = {
      // Basic fields with defaults
      tranId: recordData?.tranId || "",
      tranDate: recordData?.tranDate || "",
      shippingAddress_text: recordData?.shippingAddress_text || "",
      shipAddress: recordData?.shipAddress || "",
      salesEffectiveDate: recordData?.salesEffectiveDate || "",
      prevRep: recordData?.prevRep || "",
      memo: recordData?.memo || "",
      custbody_og_sales_discount_item:
        recordData?.custbody_og_sales_discount_item || "",
      custbody_og_sales_subtotal: recordData?.custbody_og_sales_subtotal || "",
      custbody_og_sales_total: recordData?.custbody_og_sales_total || "",
      custbody_og_invoice_date: recordData?.custbody_og_invoice_date || "",
      billAddress: recordData?.billAddress || "",
      billingAddress_text: recordData?.billingAddress_text || "",
      custbody_mig_old_internal_id: parseFloat(recordData?.id) || 0.0,

      // Conditional object fields with safety checks
      ...(recordData?.subsidiary?.new_id && {
        subsidiary: { id: recordData.subsidiary.new_id },
      }),
      ...(recordData?.status?.id && {
        status: { id: recordData.status.id },
      }),
      // ...(recordData?.salesRep?.new_id && {
      //   salesRep: { id: recordData.salesRep.new_id },
      // }),
      ...(recordData?.location?.new_id && {
        location: { id: recordData.location.new_id },
      }),
      ...(recordData?.entity?.new_id && {
        entity: { id: recordData.entity.new_id },
      }),
      ...(recordData?.custbody_og_invtype?.id && {
        custbody_og_invtype: { id: recordData.custbody_og_invtype.id },
      }),
      ...(recordData?.currency?.id && {
        currency: { id: recordData.currency.id },
      }),

      // Static field
      orderStatus: { id: "B" },

      // Item array with comprehensive safety
      ...(recordData?.item?.items && {
        item: {
          items: (recordData.item.items || [])
            .filter((item) => item !== null && item !== undefined)
            .map((item) => {
              const mappedItem = {
                amount: parseFloat(item?.amount) || 0.0,
                custcol_og_item_number: item?.custcol_og_item_number || "",
                description: item?.description
                  ? item.description.substring(0, 40)
                  : "",
                quantity: parseFloat(item?.quantity) || 0.0,
                rate: parseFloat(item?.rate) || 0.0,
                ...(item?.item?.new_id && { item: { id: item.item.new_id } }),
                ...(item?.costEstimateType?.id && {
                  costEstimateType: { id: item.costEstimateType.id },
                }),
                ...(item?.location?.new_id && {
                  location: { id: item.location.new_id },
                }),
                // ...(item?.price?.id && { price: { id: item.price.id } }),
                ...(item?.price?.id && { price: { id: "-1" } }),
                ...(item?.inventoryDetail?.unit &&
                  unitMapping?.[item.inventoryDetail.unit] && {
                    units: unitMapping[item.inventoryDetail.unit],
                  }),
              };

              // Handle inventoryDetail only if it exists and has valid data
              if (item?.inventoryDetail) {
                const inventoryAssignmentItems = (
                  item.inventoryDetail.inventoryAssignment?.items || []
                )
                  .filter((ass) => ass !== null && ass !== undefined)
                  .map((ass) => {
                    // Check if we have a new_id for this lot number
                    if (ass?.internalId && ass?.new_id) {
                      return {
                        internalId: ass.new_id,
                        quantity: parseFloat(ass?.quantity) || 0,
                        receiptInventoryNumber:
                          ass?.receiptInventoryNumber || "",
                      };
                    } else if (ass?.internalId) {
                      // If no new_id, we'll need to create a mapping later
                      lotNumbersToMap.push({
                        old_id:
                          lotNumbers?.[item?.line]?.inventorynumberid ||
                          ass.internalId,
                        refName: ass?.receiptInventoryNumber || "",
                        itemId: item?.item?.new_id || "",
                        itemName: item?.description
                          ? item.description.substring(0, 40)
                          : "",
                        quantity: parseFloat(ass?.quantity) || 0,
                        line: item?.line || 0,
                      });

                      // Don't include internalId for new creation
                      return {
                        quantity: parseFloat(ass?.quantity) || 0,
                        receiptInventoryNumber:
                          ass?.receiptInventoryNumber || "",
                      };
                    }
                    return {
                      quantity: parseFloat(ass?.quantity) || 0,
                      receiptInventoryNumber: ass?.receiptInventoryNumber || "",
                    };
                  });

                // Only include inventoryDetail if it has required fields
                if (
                  item.inventoryDetail.item?.new_id &&
                  item.inventoryDetail.location?.new_id
                ) {
                  mappedItem.inventoryDetail = {
                    quantity: parseFloat(item.inventoryDetail.quantity) || 0,
                    itemDescription: item.inventoryDetail.itemDescription || "",
                    ...(item.inventoryDetail.unit &&
                      unitMapping?.[item.inventoryDetail.unit] && {
                        unit: unitMapping[item.inventoryDetail.unit],
                      }),
                    item: { id: item.inventoryDetail.item.new_id },
                    location: { id: item.inventoryDetail.location.new_id },
                    inventoryAssignment: {
                      items: inventoryAssignmentItems,
                    },
                  };
                }
              }

              return mappedItem;
            })
            .filter((item) => item.item && item.item.id), // Only include items with valid item IDs
        },
      }),
    };

    // const transformedData = {
    //   tranId: recordData.tranId,
    //   tranDate: recordData.tranDate,
    //   subsidiary: { id: recordData.subsidiary.new_id },
    //   status: { id: recordData.status.id },
    //   shippingAddress_text: recordData.shippingAddress_text,
    //   shipAddress: recordData.shipAddress,
    //   salesRep: { id: recordData.salesRep.new_id },
    //   salesEffectiveDate: recordData.salesEffectiveDate,
    //   prevRep: recordData.prevRep,
    //   orderStatus: { id: "B" },
    //   memo: recordData.memo,
    //   location: { id: recordData.location.new_id },
    //   entity: { id: recordData.entity.new_id },
    //   custbody_og_sales_discount_item:
    //     recordData.custbody_og_sales_discount_item,
    //   custbody_og_sales_subtotal: recordData.custbody_og_sales_subtotal,
    //   custbody_og_sales_total: recordData.custbody_og_sales_total,
    //   custbody_og_invoice_date: recordData.custbody_og_invoice_date,
    //   custbody_og_invtype: { id: recordData.custbody_og_invtype.id },
    //   currency: { id: recordData.currency.id },
    //   billAddress: recordData.billAddress,
    //   billingAddress_text: recordData.billingAddress_text,
    //   custbody_mig_old_internal_id: parseFloat(recordData.id) || 0.0,
    //   // postingPeriod: { id: "20" },
    //   item: {
    //     items: recordData.item.items.map((item) => ({
    //       item: { id: item.item.new_id },
    //       costEstimateType: { id: item.costEstimateType.id },
    //       amount: parseFloat(item.amount) || 0.0,
    //       custcol_og_item_number: item.custcol_og_item_number,
    //       description: item.description
    //         ? item.description.substring(0, 40)
    //         : "",
    //       location: { id: item.location.new_id },
    //       price: { id: item.price.id },
    //       quantity: item.quantity,
    //       rate: parseFloat(item.rate) || 0.0,
    //       units: unitMapping[item.inventoryDetail.unit],
    //       inventoryDetail: item.inventoryDetail
    //         ? {
    //             item: { id: item.inventoryDetail.item.new_id },
    //             itemDescription: item.inventoryDetail.itemDescription,
    //             location: { id: item.inventoryDetail.location.new_id },
    //             quantity: item.inventoryDetail.quantity,
    //             unit: unitMapping[item.inventoryDetail.unit],
    //             inventoryAssignment: {
    //               items: item.inventoryDetail.inventoryAssignment.items.map(
    //                 (ass) => {
    //                   // Check if we have a new_id for this lot number
    //                   if (ass.internalId && ass.new_id) {
    //                     // Use the new_id if available
    //                     return {
    //                       internalId: ass.new_id,
    //                       quantity: ass.quantity,
    //                       receiptInventoryNumber: ass.receiptInventoryNumber,
    //                     };
    //                   } else if (ass.internalId) {
    //                     // If no new_id, we'll need to create a mapping later
    //                     lotNumbersToMap.push({
    //                       old_id: lotNumbers[item.line].inventorynumberid, // ass.internalId
    //                       refName: ass.receiptInventoryNumber,
    //                       itemId: item.item.new_id,
    //                       itemName: item.description
    //                         ? item.description.substring(0, 40)
    //                         : "",
    //                       quantity: ass.quantity,
    //                       line: item.line,
    //                     });

    //                     // Don't include internalId for new creation
    //                     return {
    //                       quantity: ass.quantity,
    //                       receiptInventoryNumber: ass.receiptInventoryNumber,
    //                     };
    //                   }
    //                   return {
    //                     quantity: ass.quantity,
    //                     receiptInventoryNumber: ass.receiptInventoryNumber,
    //                   };
    //                 }
    //               ),
    //             },
    //           }
    //         : null,
    //     })),
    //   },
    // };

    console.log("Final Payload:", JSON.stringify(transformedData, null, 2));
    console.log(
      "Lot numbers to map:",
      JSON.stringify(lotNumbersToMap, null, 2)
    );

    // Create record in new instance
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${recordType}`;
    const idempotencyKey = randomUUID();
    console.log("Create RETURN AUTH URL ", url);
    console.log("Create RETURN AUTH idempotencyKey ", idempotencyKey);

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

      // try {
      //   // Step 1: Get the record link through async processing
      //   const resultUrl = await getAsyncResultLink(locationHeader, token);
      //   console.log("Record link retrieved:", resultUrl);
      //   // Step 2: Fetch the result URL to get the record location
      //   const resultResponse = await fetch(resultUrl, {
      //     method: "GET",
      //     headers: {
      //       Authorization: `Bearer ${token}`,
      //     },
      //   });

      //   // Handle 204 No Content response
      //   if (resultResponse.status === 204) {
      //     const recordLocation = resultResponse.headers.get("Location");

      //     if (!recordLocation) {
      //       throw new Error("Location header not found in result response");
      //     }

      //     console.log("Record location header:", recordLocation);

      //     // Step 3: Extract internal ID from record location
      //     const internalId = recordLocation.substring(
      //       recordLocation.lastIndexOf("/") + 1
      //     );

      //     if (!internalId || isNaN(internalId)) {
      //       throw new Error("Invalid internal ID format: " + internalId);
      //     }

      //     console.log("Created record internal ID:", internalId);

      //     return NextResponse.json({
      //       success: true,
      //       internalId,
      //       recordLocation,
      //       lotNumbersToMap,
      //     });
      //   }
      //   // Handle unexpected responses
      //   const resultText = await resultResponse.text();
      //   throw new Error(
      //     `Unexpected result response: ${resultResponse.status} - ${resultText}`
      //   );
      // } catch (asyncError) {
      //   console.error("Async processing failed:", asyncError);
      //   return NextResponse.json(
      //     {
      //       error: "Async processing failed",
      //       details: asyncError.message,
      //     },
      //     { status: 500 }
      //   );
      // }
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

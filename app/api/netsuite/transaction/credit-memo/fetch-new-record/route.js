import { NextResponse } from "next/server";

const MAX_PARALLEL_REQUESTS = 5; // To avoid rate limiting

export async function POST(request) {
  const { accountId, token, internalId } = await request.json();
  console.log("[itemReceipt] AccountId: ", accountId);
  console.log("[itemReceipt] token: ", token);
  console.log("[itemReceipt] internalId: ", internalId);

  try {
    // Fetch Inventory Adjustment Fields
    const record = await fetchRecord(
      accountId,
      token,
      "itemReceipt",
      internalId
    );

    console.log("[itemReceipt] New Record : ", record);

    // Fetch Inventory Items
    // if (record.inventory?.links) {
    //   const sublistUrl = record.inventory.links.find(
    //     (l) => l.rel === "self"
    //   )?.href;
    //   if (sublistUrl) {
    //     // First fetch the list of inventory items
    //     const items = await fetchSublist(accountId, token, sublistUrl);

    //     // Then fetch details for each inventory item
    //     record.inventory.items = await processInventoryItems(
    //       accountId,
    //       token,
    //       items
    //     );
    //   }
    // }

    return NextResponse.json(record);
  } catch (error) {
    console.error("Error fetching record:", error);
    return NextResponse.json(
      { error: "Failed to fetch record", details: error.message },
      { status: 500 }
    );
  }
}

async function fetchRecord(accountId, token, recordType, internalId) {
  const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${recordType}/${internalId}`;
  console.log("Fetch New Record URL ", url);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "transient",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    const errorMessage =
      error.message || error.error?.message || "Unknown error occurred";
    throw new Error(`Failed to fetch ${recordType}: ${errorMessage}`);
  }

  return response.json();
}

async function fetchSublist(accountId, token, sublistUrl) {
  const response = await fetch(sublistUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "transient",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    const errorMessage =
      error.message || error.error?.message || "Unknown error occurred";
    throw new Error(`Failed to fetch sublist: ${errorMessage}`);
  }

  const result = await response.json();
  return result.items || [];
}

async function processInventoryItems(accountId, token, items) {
  // Process items in batches to avoid rate limiting
  const batches = [];
  for (let i = 0; i < items.length; i += MAX_PARALLEL_REQUESTS) {
    batches.push(items.slice(i, i + MAX_PARALLEL_REQUESTS));
  }

  const processedItems = [];
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map((item) => processSingleInventoryItem(accountId, token, item))
    );
    processedItems.push(...batchResults);
  }

  return processedItems;
}

async function processSingleInventoryItem(accountId, token, item) {
  try {
    // 1. Fetch full item details if self link exists
    const itemUrl = item.links?.find((l) => l.rel === "self")?.href;
    if (!itemUrl) return item;

    const fullItem = await fetchSublistItem(accountId, token, itemUrl);
    const mergedItem = { ...item, ...fullItem };
    // Process inventoryDetail if it exists
    if (mergedItem.inventoryDetail?.links) {
      const detailUrl = mergedItem.inventoryDetail.links.find(
        (l) => l.rel === "self"
      )?.href;
      if (detailUrl) {
        mergedItem.inventoryDetail = await fetchAndExpandInventoryDetail(
          accountId,
          token,
          detailUrl
        );
      }
    }

    // 3. Expand all references in the item
    return mergedItem;
  } catch (error) {
    console.warn("Error processing inventory item:", error);
    return item; // Return original if processing fails
  }
}

async function fetchAndExpandInventoryDetail(accountId, token, detailUrl) {
  try {
    // Fetch the inventory detail
    const inventoryDetail = await fetchSublistItem(accountId, token, detailUrl);
    if (inventoryDetail.inventoryAssignment?.links) {
      const assignmentUrl = inventoryDetail.inventoryAssignment.links.find(
        (l) => l.rel === "self"
      )?.href;
      if (assignmentUrl) {
        inventoryDetail.inventoryAssignment =
          await fetchAndExpandInventoryAssignment(
            accountId,
            token,
            assignmentUrl
          );
      }
    }
    // Process any nested references in the inventory detail
    return await inventoryDetail;
  } catch (error) {
    console.warn("Error fetching inventory detail:", error);
    return { error: "Failed to fetch inventory detail" };
  }
}
async function fetchAndExpandInventoryAssignment(
  accountId,
  token,
  assignmentUrl
) {
  try {
    // Fetch the assignment list
    const assignmentList = await fetchSublistItem(
      accountId,
      token,
      assignmentUrl
    );

    // Process each assignment item
    if (assignmentList.items && assignmentList.items.length > 0) {
      assignmentList.items = await processAssignmentItems(
        accountId,
        token,
        assignmentList.items
      );
    }

    return assignmentList;
  } catch (error) {
    console.warn("Error fetching inventory assignment:", error);
    return { error: "Failed to fetch inventory assignment" };
  }
}

async function processAssignmentItems(accountId, token, items) {
  const batches = [];
  for (let i = 0; i < items.length; i += MAX_PARALLEL_REQUESTS) {
    batches.push(items.slice(i, i + MAX_PARALLEL_REQUESTS));
  }

  const processedItems = [];
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map((item) => processSingleAssignmentItem(accountId, token, item))
    );
    processedItems.push(...batchResults);
  }

  return processedItems;
}

async function processSingleAssignmentItem(accountId, token, item) {
  try {
    const itemUrl = item.links?.find((l) => l.rel === "self")?.href;
    if (!itemUrl) return item;

    const fullItem = await fetchSublistItem(accountId, token, itemUrl);
    const mergedItem = { ...item, ...fullItem };

    return mergedItem;
  } catch (error) {
    console.warn("Error processing assignment item:", error);
    return item;
  }
}

async function fetchSublistItem(accountId, token, itemUrl) {
  const response = await fetch(itemUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "transient",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    const errorMessage =
      error.message || error.error?.message || "Unknown error occurred";
    throw new Error(`Failed to fetch sublist item: ${errorMessage}`);
  }

  return response.json();
}

import { NextResponse } from "next/server";

// List of fields that contain references we want to expand
const REFERENCE_FIELDS = [
  "class",
  "department",
  "location",
  "transferLocation",
  "toLocation",
  "subsidiary",
  "item",
  "customer",
];

const REFERENCE_FIELD_NEW_ID = {
  class: "custrecord_mig_new_internal_id_class",
  department: "custrecord_mig_new_internal_id_dept",
  location: "custrecord_mig_new_internal_id_location",
  transferLocation: "custrecord_mig_new_internal_id_location",
  toLocation: "custrecord_mig_new_internal_id_location",
  customer: "custentity_mig_new_internal_id",
  subsidiary: "custrecord_mig_new_internal_id",
  account: "custrecord_mig_new_internal_id_account",
  class: "custrecord_mig_new_internal_id_class",
  item: "custitem_mig_new_internal_id",
};

const MAX_PARALLEL_REQUESTS = 5; // To avoid rate limiting

export async function POST(request) {
  const { accountId, token, internalId } = await request.json();
  console.log("[inventoryTransfer] AccountId: ", accountId);
  console.log("[inventoryTransfer] token: ", token);
  console.log("[inventoryTransfer] internalId: ", internalId);

  try {
    // Fetch Inventory Adjustment Fields
    const record = await fetchRecord(
      accountId,
      token,
      "inventoryTransfer",
      internalId
    );

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
    // // Get lot mapping if we have new credentials
    // let lotMapping = {};
    // try {
    //   // Check if we have inventory details
    //   const hasInventoryDetails = record.inventory?.items?.some(
    //     (item) => item.inventoryDetail
    //   );

    //   if (hasInventoryDetails) {
    //     lotMapping = await getLotMapping(accountId, token);
    //     console.log("lotMapping", lotMapping);
    //   }
    // } catch (error) {
    //   console.error("Failed to get lot mapping, proceeding without it:", error);
    // }

    // const expandedRecord = await expandReferences(accountId, token, record);
    // console.log("lotMapping: ", lotMapping);

    // // Apply lot mapping to inventory details
    // if (Object.keys(lotMapping).length > 0) {
    //   const lotNumbers = await getLotNumbers(accountId, token, internalId);
    //   console.log("lotNumbers : ", JSON.stringify(lotNumbers, null, 2));
    //   applyLotMapping(expandedRecord, lotMapping, lotNumbers);
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
    throw new Error(`Failed to fetch ${recordType}: ${error.error.message}`);
  }

  return response.json();
}

async function fetchSublist(accountId, token, sublistUrl) {
  try {
    const response = await fetch(sublistUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "transient",
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.error?.message ||
          errorData.message ||
          JSON.stringify(errorData);
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(`Failed to fetch sublist: ${errorMessage}`);
    }

    const result = await response.json();
    return result.items || [];
  } catch (error) {
    console.error("Error in fetchSublist:", error);
    throw new Error(`Failed to fetch sublist: ${error.message}`);
  }
}

async function expandReferences(accountId, token, record) {
  const expanded = { ...record };

  for (const field of REFERENCE_FIELDS) {
    if (!record[field]?.id) continue;

    try {
      // Determine record type from field name
      var recordType = "";
      var newIdField = "";
      if (field === "item") {
        recordType = "inventoryItem";
        newIdField = REFERENCE_FIELD_NEW_ID[field];
      } else if (field === "transferLocation") {
        recordType = "location";
        newIdField = REFERENCE_FIELD_NEW_ID["location"];
      } else if (field === "toLocation") {
        recordType = "location";
        newIdField = REFERENCE_FIELD_NEW_ID["location"];
      } else {
        recordType = field;
        newIdField = REFERENCE_FIELD_NEW_ID[field];
      }

      // Fetch the referenced record
      const refRecord = await fetchRecord(
        accountId,
        token,
        recordType,
        record[field].id
      );

      // Add the full record data to our expanded record
      expanded[field] = {
        ...record[field],
        // ...refRecord,
        new_id: refRecord[newIdField],
        // Preserve the original reference structure
        links: record[field].links,
        refName: record[field].refName,
        id: record[field].id,
      };
    } catch (error) {
      console.warn(`Failed to expand ${field} reference:`, error);
      // Keep the original reference if expansion fails
      expanded[field] = record[field];
    }
  }

  return expanded;
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
    return await expandReferences(accountId, token, mergedItem);
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
    return await expandReferences(accountId, token, inventoryDetail);
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

    return await expandReferences(accountId, token, mergedItem);
  } catch (error) {
    console.warn("Error processing assignment item:", error);
    return item;
  }
}

async function fetchSublistItem(accountId, token, itemUrl) {
  try {
    const response = await fetch(itemUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "transient",
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.error?.message ||
          errorData.message ||
          JSON.stringify(errorData);
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(`Failed to fetch sublist item: ${errorMessage}`);
    }

    return response.json();
  } catch (error) {
    console.error("Error in fetchSublistItem:", error);
    throw new Error(`Failed to fetch sublist item: ${error.message}`);
  }
}

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

async function getLotNumbers(accountId, token, tranId) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/lot-number`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          token,
          tranId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get lot Numbers");
    }

    const result = await response.json();
    return result.lotNumbers;
  } catch (error) {
    console.error("Error getting lot mapping:", error);
    throw error;
  }
}

function applyLotMapping(record, lotMapping, lotNumbers) {
  if (!record.inventory?.items) return;

  record.inventory.items.forEach((item) => {
    var item_line = item.line;
    // console.log(
    //   "Process Item Line: [" +
    //     item_line +
    //     "] ==> " +
    //     JSON.stringify(lotNumbers[item_line])
    // );
    if (item.inventoryDetail?.inventoryAssignment?.items) {
      item.inventoryDetail.inventoryAssignment.items.forEach((assignment) => {
        // Handle receiptInventoryNumber
        // if (lotNumbers[item_line]) {
        //   const oldId = lotNumbers[item_line].inventorynumberid;
        //   if (lotMapping[oldId]) {
        //     assignment.old_id = oldId;
        //     assignment.new_id = lotMapping[oldId];
        //   }
        // }
        // Handle issueInventoryNumber
        var issueInventoryNumber = assignment.issueInventoryNumber;
        const oldId = issueInventoryNumber.id;
        if (lotMapping[oldId]) {
          assignment.old_id = oldId;
          assignment.new_id = lotMapping[oldId];
          assignment.refName = issueInventoryNumber.refName;
        }
      });
    }
  });
}

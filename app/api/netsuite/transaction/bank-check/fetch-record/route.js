import { NextResponse } from "next/server";

// List of fields that contain references we want to expand
const REFERENCE_FIELDS = [
  "account",
  "class",
  "department",
  "location",
  "transferLocation",
  "subsidiary",
  "item",
  "customer",
  "employee",
  "entity",
  "aracct",
  "doc",
];

const REFERENCE_FIELD_NEW_ID = {
  class: "custrecord_mig_new_internal_id_class",
  department: "custrecord_mig_new_internal_id_dept",
  location: "custrecord_mig_new_internal_id_location",
  transferLocation: "custrecord_mig_new_internal_id_location",
  customer: "custentity_mig_new_internal_id",
  subsidiary: "custrecord_mig_new_internal_id",
  account: "custrecord_mig_new_internal_id_account",
  class: "custrecord_mig_new_internal_id_class",
  item: "custitem_mig_new_internal_id",
  employee: "custentity_mig_new_internal_id",
  aracct: "custrecord_mig_new_internal_id_account",
  doc: "custbody_mig_new_internal_id",
};

const MAX_PARALLEL_REQUESTS = 5; // To avoid rate limiting

export async function POST(request) {
  const { accountId, token, internalId } = await request.json();
  console.log("[check] AccountId: ", accountId);
  console.log("[check] token: ", token);
  console.log("[check] internalId: ", internalId);

  try {
    // Fetch Inventory Adjustment Fields
    const record = await fetchRecord(accountId, token, "check", internalId);

    // Fetch Apply Transactions
    // if (record.apply?.links) {
    //   const sublistUrl = record.apply.links.find((l) => l.rel === "self")?.href;
    //   if (sublistUrl) {
    //     // First fetch the list of item items
    //     const items = await fetchSublist(accountId, token, sublistUrl);

    //     // Then fetch details for each inventory item
    //     record.apply.items = await processLineItems(accountId, token, items);
    //     console.log("record.apply.items Before: ", record.apply.items);
    //     if (
    //       record.apply &&
    //       record.apply.items &&
    //       Array.isArray(record.apply.items)
    //     ) {
    //       record.apply.items = record.apply.items.filter(
    //         (item) => item.doc && Object.keys(item.doc).length > 0
    //       );

    //       // If no items remain after filtering, remove the apply section entirely
    //       if (record.apply.items.length === 0) {
    //         delete record.apply;
    //       }
    //     }
    //     console.log("record.apply.items After: ", record.apply.items);
    //   }
    // }
    // // Fetch Credit Transactions
    // if (record.credit?.links) {
    //   const sublistUrl = record.credit.links.find(
    //     (l) => l.rel === "self"
    //   )?.href;
    //   if (sublistUrl) {
    //     // First fetch the list of item items
    //     const items = await fetchSublist(accountId, token, sublistUrl);

    //     // Then fetch details for each inventory item
    //     record.credit.items = await processLineItems(accountId, token, items);
    //   }
    // }
    // // Fetch Deposit Transactions
    // if (record.credit?.links) {
    //   const sublistUrl = record.credit.links.find(
    //     (l) => l.rel === "self"
    //   )?.href;
    //   if (sublistUrl) {
    //     // First fetch the list of item items
    //     const items = await fetchSublist(accountId, token, sublistUrl);

    //     // Then fetch details for each inventory item
    //     record.credit.items = await processLineItems(accountId, token, items);
    //   }
    // }

    // const expandedRecord = await expandReferences(accountId, token, record);

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
      } else if (field === "salesRep") {
        recordType = "employee";
        newIdField = REFERENCE_FIELD_NEW_ID["employee"];
      } else if (field === "aracct") {
        recordType = "account";
        newIdField = REFERENCE_FIELD_NEW_ID["account"];
      } else if (field === "entity") {
        recordType = "customer";
        newIdField = REFERENCE_FIELD_NEW_ID["customer"];
      } else if (field === "doc") {
        if (record.type == "Invoice") {
          recordType = "invoice";
          newIdField = REFERENCE_FIELD_NEW_ID["doc"];
        } else if (record.type === "CreditMemo") {
          recordType = "creditmemo";
          newIdField = REFERENCE_FIELD_NEW_ID["doc"];
        } else {
          // Default to invoice if type is not specified
          recordType = "invoice";
          newIdField = REFERENCE_FIELD_NEW_ID["invoice"];
        }
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
      // Validate the reference has a new_id
      if (!refRecord[newIdField]) {
        throw new Error(`No new_id found for ${field} reference`);
      }

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

async function processLineItems(accountId, token, items) {
  // Process items in batches to avoid rate limiting
  const batches = [];
  for (let i = 0; i < items.length; i += MAX_PARALLEL_REQUESTS) {
    batches.push(items.slice(i, i + MAX_PARALLEL_REQUESTS));
  }

  const processedItems = [];
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map((item) => processSingleLineItem(accountId, token, item))
    );
    processedItems.push(...batchResults.filter((item) => item !== null));
  }

  return processedItems;
}

async function processSingleLineItem(accountId, token, item) {
  try {
    // 1. Fetch full item details if self link exists
    const itemUrl = item.links?.find((l) => l.rel === "self")?.href;
    if (!itemUrl) return null; // Remove if no self link

    const fullItem = await fetchSublistItem(accountId, token, itemUrl);
    const mergedItem = { ...item, ...fullItem };

    // 3. Expand all references in the item
    return await expandReferences(accountId, token, mergedItem);
  } catch (error) {
    console.warn("Error processing inventory item:", error);
    return item; // Return original if processing fails
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

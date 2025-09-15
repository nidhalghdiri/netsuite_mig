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
};

const MAX_PARALLEL_REQUESTS = 5; // To avoid rate limiting

export async function POST(request) {
  const { accountId, token, internalId } = await request.json();
  console.log("[journalEntry] AccountId: ", accountId);
  console.log("[journalEntry] token: ", token);
  console.log("[journalEntry] internalId: ", internalId);

  try {
    // Fetch Inventory Adjustment Fields
    const record = await fetchRecord(
      accountId,
      token,
      "journalEntry",
      internalId
    );

    // Fetch Inventory Items
    // if (record.line?.links) {
    //   const sublistUrl = record.line.links.find((l) => l.rel === "self")?.href;
    //   if (sublistUrl) {
    //     // First fetch the list of item items
    //     const items = await fetchSublist(accountId, token, sublistUrl);

    //     // Then fetch details for each inventory item
    //     record.line.items = await processLineItems(accountId, token, items);
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
      } else if (field === "entity") {
        recordType = "customer";
        newIdField = REFERENCE_FIELD_NEW_ID["customer"];
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
    processedItems.push(...batchResults);
  }

  return processedItems;
}

async function processSingleLineItem(accountId, token, item) {
  try {
    // 1. Fetch full item details if self link exists
    const itemUrl = item.links?.find((l) => l.rel === "self")?.href;
    if (!itemUrl) return item;

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

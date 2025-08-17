import { NextResponse } from "next/server";

// List of fields that contain references we want to expand
const REFERENCE_FIELDS = [
  "account",
  "subsidiary",
  "location",
  "department",
  "class",
  "item",
  "adjLocation",
  "customer",
];

const REFERENCE_FIELD_NEW_ID = {
  account: "custrecord_mig_sandbox_new_internal_id_a",
  subsidiary: "custrecord_mig_sandbox_new_internal_id",
  location: "custrecord_mig_sandbox_new_internal_id_l",
  department: "custrecord_mig_sandbox_new_internal_id_d",
  class: "custrecord_mig_sandbox_new_internal_id_c",
  item: "custrecord_mig_sandbox_new_internal_id_i",
  adjLocation: "custrecord_mig_sandbox_new_internal_id_l",
  customer: "custrecord_mig_sandbox_new_internal_id_e",
};

// List of sublists to fetch
const SUBLISTS = [
  "inventory", // The inventory sublist containing line items
];

const MAX_PARALLEL_REQUESTS = 5; // To avoid rate limiting

export async function POST(request) {
  const { accountId, token, internalId } = await request.json();
  console.log("[InventoryAdjustment] AccountId: ", accountId);
  console.log("[InventoryAdjustment] token: ", token);
  console.log("[InventoryAdjustment] internalId: ", internalId);

  try {
    const record = await fetchRecord(
      accountId,
      token,
      "inventoryAdjustment",
      internalId
    );

    console.log("[InventoryAdjustment] RECORD: ", record);

    // 2. Process inventory sublist if exists
    if (record.inventory?.links) {
      const sublistUrl = record.inventory.links.find(
        (l) => l.rel === "self"
      )?.href;
      if (sublistUrl) {
        // First fetch the list of inventory items
        const items = await fetchSublist(accountId, token, sublistUrl);

        // Then fetch details for each inventory item
        record.inventory.items = await processInventoryItems(
          accountId,
          token,
          items
        );
      }
    }

    const expandedRecord = await expandReferences(accountId, token, record);

    return NextResponse.json(expandedRecord);
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
    throw new Error(`Failed to fetch sublist: ${error.error.message}`);
  }

  const result = await response.json();
  return result.items || [];
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
      } else if (field === "adjLocation") {
        recordType = "location";
        newIdField = REFERENCE_FIELD_NEW_ID["location"];
      } else if (field === "inventory") {
        recordType = "inventoryAdjustment-inventoryElement";
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
    if (itemUrl) {
      const fullItem = await fetchSublistItem(accountId, token, itemUrl);

      // 2. Merge with original item data
      const mergedItem = { ...item, ...fullItem };

      // 3. Expand all references in the item
      return await expandReferences(accountId, token, mergedItem);
    }
    return item;
  } catch (error) {
    console.warn("Error processing inventory item:", error);
    return item; // Return original if processing fails
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
    throw new Error(`Failed to fetch sublist item: ${error.error.message}`);
  }

  return response.json();
}

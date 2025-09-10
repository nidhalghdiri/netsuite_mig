import { apiRequest } from "./apiClient";

const MAX_PARALLEL_REQUESTS = 1; // To avoid rate limiting
const REQUEST_DELAY_MS = 1000; // Add delay between batches
const referenceCache = new Map();

const REFERENCE_FIELDS = [
  "account",
  "subsidiary",
  "location",
  "department",
  "class",
  "item",
  "adjLocation",
  "customer",
  "transferLocation",
  "toLocation",
  "employee",
  "entity",
  "salesRep",
  "aracct",
  "doc",
];

const REFERENCE_FIELD_NEW_ID = {
  account: "custrecord_mig_sandbox_new_internal_id_a",
  subsidiary: "custrecord_mig_sandbox_new_internal_id",
  location: "custrecord_mig_sandbox_new_internal_id_l",
  department: "custrecord_mig_sandbox_new_internal_id_d",
  class: "custrecord_mig_sandbox_new_internal_id_c",
  item: "custitem_mig_sandbox_new_intenral_id_i",
  adjLocation: "custrecord_mig_sandbox_new_internal_id_l",
  customer: "custentity_mig_sandbox_new_internal_id_e",
  transferLocation: "custrecord_mig_sandbox_new_internal_id_l",
  toLocation: "custrecord_mig_sandbox_new_internal_id_l",
  employee: "custentity_mig_sandbox_new_internal_id_e",
  entity: "custentity_mig_sandbox_new_internal_id_e",
  salesRep: "custentity_mig_sandbox_new_internal_id_e",
  aracct: "custrecord_mig_sandbox_new_internal_id_a",
  doc: "custbody_mig_new_internal_id",
  vendor: "custentity_mig_sandbox_new_internal_id_e",
};
const RECORDS = {
  InvAdjst: "inventory-adjustment",
  TrnfrOrd: "transfer-order",
  InvTrnfr: "inventory-transfer",
  CustInvc: "invoice",
  Journal: "journal",
  CustPymt: "customer-payment",
  RtnAuth: "return-authorization",
  Check: "bank-check",
  Deposit: "deposit",
  ItemRcpt: "item-receipt",
  CustCred: "credit-memo",
  PurchOrd: "purchase-order",
  VendBill: "vendor-bill",
};
export async function createTransaction(
  oldAccountID,
  oldToken,
  newAccountID,
  newToken,
  type,
  recordType,
  transactionData,
  unitMapping,
  lotNumbers
) {
  try {
    const response = await apiRequest(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/transaction/${RECORDS[type]}/create-record`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`, // Recommended for security
        },
        body: JSON.stringify({
          accountId: newAccountID,
          oldAccountId: oldAccountID,
          token: newToken,
          oldToken: oldToken,
          recordType: recordType, //"inventoryAdjustment"
          recordData: transactionData,
          unitMapping,
          lotNumbers,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create Transaction");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error Creating Transaction:", error);
    throw error;
  }
}
export async function transformTransaction(
  oldAccountID,
  oldToken,
  newAccountID,
  newToken,
  type,
  recordType,
  transactionData,
  unitMapping,
  lotNumbers,
  transformURL
) {
  try {
    const response = await apiRequest(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/transaction/${RECORDS[type]}/transform-record`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`, // Recommended for security
        },
        body: JSON.stringify({
          accountId: newAccountID,
          oldAccountId: oldAccountID,
          token: newToken,
          oldToken: oldToken,
          recordType: recordType, //"inventoryAdjustment"
          recordData: transactionData,
          unitMapping,
          lotNumbers,
          transformURL,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create Transaction");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error Creating Transaction:", error);
    throw error;
  }
}
export async function getInternalID(url, token, recordType) {
  try {
    const response = await apiRequest(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/get-status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Recommended for security
        },
        body: JSON.stringify({
          jobUrl: url,
          token: token,
          recordType: recordType,
        }),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(JSON.stringify(result));
    }

    return result;
  } catch (error) {
    console.error("Error getting internal id:", error);
    throw error;
  }
}

export async function fetchNewTransaction(
  recordType,
  accountId,
  token,
  internalId
) {
  try {
    console.log("[Utils] Record Type: ", RECORDS[recordType]);
    console.log("[Utils] accountId: ", accountId);
    console.log("[Utils] token: ", token);
    console.log("[Utils] internalId: ", internalId);

    const response = await apiRequest(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/transaction/${RECORDS[recordType]}/fetch-new-record`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: accountId,
          token: token,
          internalId: internalId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch New transaction");
    }
    const recordData = await response.json();

    const sublists = [];
    if (recordType == "InvAdjst" || recordType == "InvTrnfr") {
      sublists.push("inventory");
    } else if (
      recordType == "TrnfrOrd" ||
      recordType == "CustInvc" ||
      recordType == "PurchOrd" ||
      recordType == "VendBill" ||
      recordType == "ItemRcpt" ||
      recordType == "RtnAuth"
    ) {
      sublists.push("item");
    } else if (recordType == "CustPymt") {
      sublists.push("apply", "credit");
    } else if (recordType == "Journal") {
      sublists.push("line");
    } else if (recordType == "Check") {
      sublists.push("expense");
    }
    for (let i = 0; i < sublists.length; i++) {
      const sublistName = sublists[i];
      if (recordData[sublistName]?.links) {
        const sublistUrl = recordData[sublistName].links.find(
          (l) => l.rel === "self"
        )?.href;
        if (sublistUrl) {
          const items = await fetchSublistItem(
            accountId,
            token,
            sublistUrl,
            RECORDS[recordType]
          );

          recordData[sublistName].items = await processInventoryItems(
            accountId,
            token,
            items.items,
            RECORDS[recordType]
          );
        }
      }
    }
    return recordData;
  } catch (error) {
    console.error("Error getting New Transaction:", error);
    throw error;
  }
}

export async function updateTransaction(
  oldAccountID,
  oldToken,
  type,
  recordType,
  transId,
  newTransaction
) {
  try {
    const response = await apiRequest(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/transaction/update-record`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${oldToken}`, // Recommended for security
        },
        body: JSON.stringify({
          accountId: oldAccountID,
          token: oldToken,
          recordType: type, //"inventoryAdjustment"
          internalId: transId,
          newId: newTransaction.id,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create Transaction");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error Creating Transaction:", error);
    throw error;
  }
}

// Handle Inventory & Items

export async function getUnitMapping(accountId, token) {
  try {
    const response = await apiRequest(
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

export async function getLotNumbers(accountId, token, tranId) {
  try {
    const response = await apiRequest(
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

// Function to create lot number mapping records
export async function createLotNumberMappings(
  accountId,
  token,
  createdRecord,
  lotNumbersToMap,
  newLotNumbers,
  recordType
) {
  try {
    // Extract the new lot number IDs from the created record
    const newLotMappings = [];
    var sublist = "inventory";
    if (
      recordType == "TrnfrOrd" ||
      recordType == "CustInvc" ||
      recordType == "RtnAuth" ||
      recordType == "ItemRcpt" ||
      recordType == "PurchOrd" ||
      recordType == "VendBill" ||
      recordType == "CustCred"
    ) {
      sublist = "item";
    }
    if (createdRecord[sublist] && createdRecord[sublist].items) {
      for (const item of createdRecord[sublist].items) {
        if (item.inventoryDetail && item.inventoryDetail.inventoryAssignment) {
          for (const assignment of item.inventoryDetail.inventoryAssignment
            .items) {
            // Find the corresponding old lot number
            const oldLot = lotNumbersToMap.find(
              (lot) =>
                lot.refName == assignment?.receiptInventoryNumber &&
                lot.itemId == item.item.id
            );

            if (oldLot) {
              newLotMappings.push({
                old_id: oldLot.old_id,
                new_id: newLotNumbers[item.line].inventorynumberid,
                refName: oldLot.refName,
                itemId: oldLot.itemId,
                itemName: item.item.refName,
              });
            }
          }
        }
      }
    }

    console.log("newLotMappings: ", JSON.stringify(newLotMappings, null, 2));

    // Create mapping records for each lot number
    for (const mapping of newLotMappings) {
      var lotCreated = await createLotMappingRecord(accountId, token, mapping);
      console.log("Lot Created ID: ", lotCreated);
    }

    // console.log("Created lot number mappings:", newLotMappings);
  } catch (error) {
    console.error("Error creating lot number mappings:", error);
    // Don't throw error here as the transaction was created successfully
  }
}

// Function to create a single lot mapping record
const createLotMappingRecord = async (accountId, token, mappingData) => {
  try {
    const response = await apiRequest(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/lot-mapping/create-lot-mapping`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId,
          token,
          mapping: mappingData,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create lot mapping");
    }

    const result = await response.json();
    console.log("MSG:", result.message);

    const createdLotId = await getInternalID(result.jobUrl, token, "");

    return createdLotId;
  } catch (error) {
    console.error("Error creating lot mapping:", error);
    throw error;
  }
};

// Transaction Functions
export async function fetchSublist(accountId, token, sublistUrl) {
  try {
    const response = await apiRequest(sublistUrl, {
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

export async function processInventoryItems(
  accountId,
  token,
  items,
  recordType
) {
  console.log("processInventoryItems called with:", {
    itemsCount: items ? items.length : 0,
    recordType,
  });

  if (!items || !Array.isArray(items)) {
    console.error("Invalid items parameter:", items);
    return [];
  }
  const processedItems = [];

  for (let i = 0; i < items.length; i++) {
    console.log(`Processing item ${i + 1}/${items.length}:`, items[i]);
    // Add delay between batches (except the first one)
    try {
      // Add delay between batches (except the first one)
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const processedItem = await processSingleInventoryItem(
        accountId,
        token,
        items[i],
        recordType
      );

      processedItems.push(processedItem);
      console.log(`Successfully processed item ${i + 1}`);
    } catch (error) {
      console.error(`Error processing item ${i + 1}:`, error);
      // Push the original item if processing fails
      processedItems.push(items[i]);
    }
  }

  console.log("Finished processing all items");
  return processedItems;
}

async function processSingleInventoryItem(accountId, token, item, recordType) {
  try {
    // 1. Fetch full item details if self link exists
    const itemUrl = item.links?.find((l) => l.rel === "self")?.href;
    if (!itemUrl) return item;

    // console.log("4. [Record UI] Processing Item - itemUrl ", itemUrl);
    // console.log("fullItem - recordType", recordType);
    const fullItem = await fetchSublistItem(
      accountId,
      token,
      itemUrl,
      recordType
    );
    console.log("5. [Record UI] Processing Item - fullItem ", fullItem);

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
          detailUrl,
          recordType
        );
      }
    }

    // 3. Expand all references in the item

    return await expandReferences(accountId, token, mergedItem, recordType);
  } catch (error) {
    console.warn("Error processing inventory item:", error);
    return item; // Return original if processing fails
  }
}

async function fetchAndExpandInventoryDetail(
  accountId,
  token,
  detailUrl,
  recordType
) {
  try {
    // Fetch the inventory detail

    const inventoryDetail = await fetchSublistItem(
      accountId,
      token,
      detailUrl,
      recordType
    );
    if (inventoryDetail.inventoryAssignment?.links) {
      const assignmentUrl = inventoryDetail.inventoryAssignment.links.find(
        (l) => l.rel === "self"
      )?.href;
      if (assignmentUrl) {
        inventoryDetail.inventoryAssignment =
          await fetchAndExpandInventoryAssignment(
            accountId,
            token,
            assignmentUrl,
            recordType
          );
      }
    }
    // console.log(
    //   "expandReferences process fetchAndExpandInventoryDetail",
    //   recordType
    // );
    // Process any nested references in the inventory detail
    return await expandReferences(
      accountId,
      token,
      inventoryDetail,
      recordType
    );
  } catch (error) {
    console.warn("Error fetching inventory detail:", error);
    return { error: "Failed to fetch inventory detail" };
  }
}
async function fetchAndExpandInventoryAssignment(
  accountId,
  token,
  assignmentUrl,
  recordType
) {
  try {
    // Fetch the assignment list
    const assignmentList = await fetchSublistItem(
      accountId,
      token,
      assignmentUrl,
      recordType
    );

    // Process each assignment item
    if (assignmentList.items && assignmentList.items.length > 0) {
      assignmentList.items = await processAssignmentItems(
        accountId,
        token,
        assignmentList.items,
        recordType
      );
    }

    return assignmentList;
  } catch (error) {
    console.warn("Error fetching inventory assignment:", error);
    return { error: "Failed to fetch inventory assignment" };
  }
}

async function processAssignmentItems(accountId, token, items, recordType) {
  const batches = [];
  for (let i = 0; i < items.length; i += MAX_PARALLEL_REQUESTS) {
    batches.push(items.slice(i, i + MAX_PARALLEL_REQUESTS));
  }

  const processedItems = [];
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map((item) =>
        processSingleAssignmentItem(accountId, token, item, recordType)
      )
    );
    processedItems.push(...batchResults);
  }

  return processedItems;
}

async function processSingleAssignmentItem(accountId, token, item, recordType) {
  try {
    const itemUrl = item.links?.find((l) => l.rel === "self")?.href;
    if (!itemUrl) return item;
    // console.log("fullItem - recordType", recordType);
    const fullItem = await fetchSublistItem(
      accountId,
      token,
      itemUrl,
      recordType
    );
    const mergedItem = { ...item, ...fullItem };

    // console.log(
    //   "expandReferences process processSingleAssignmentItem",
    //   recordType
    // );
    return await expandReferences(accountId, token, mergedItem, recordType);
  } catch (error) {
    console.warn("Error processing assignment item:", error);
    return item;
  }
}

export async function fetchSublistItem(accountId, token, itemUrl, type) {
  try {
    // Validate parameters
    if (!itemUrl) {
      throw new Error("Item URL is required");
    }

    if (!type) {
      console.warn(
        "Record type not provided, attempting to extract from itemUrl"
      );
      // Try to extract type from URL as fallback
      const match = itemUrl.match(/record\/v1\/([^\/]+)/);
      type = match ? match[1] : "unknown";
    }

    const response = await apiRequest(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/transaction/fetch-item`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemUrl: itemUrl,
          token: token,
        }),
      }
    );

    if (!response.ok) {
      // Handle error response
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error in fetchSublistItem:", error);
    throw new Error(`Failed to fetch sublist item: ${error.message}`);
  }
}
export async function fetchPurchaseId(
  accountId,
  token,
  internalId,
  recordType
) {
  try {
    // Validate parameters

    const response = await apiRequest(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/transaction/${RECORDS[recordType]}/fetch-purchase`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId: accountId,
          token: token,
          internalId: internalId,
        }),
      }
    );

    if (!response.ok) {
      // Handle error response
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error in fetchSublistItem:", error);
    throw new Error(`Failed to fetch sublist item: ${error.message}`);
  }
}

export async function transformPurchaseToReceipt(
  accountId,
  token,
  purchase_id,
  receipt_data,
  recordType,
  unitMapping,
  lotNumbers
) {
  try {
    // Validate parameters

    const response = await apiRequest(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/transaction/${RECORDS[recordType]}/receipt-purchase`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId: accountId,
          token: token,
          purchase_id: purchase_id,
          recordData: receipt_data,
          unitMapping: unitMapping,
          lotNumbers: lotNumbers,
        }),
      }
    );

    if (!response.ok) {
      // Handle error response
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error in fetchSublistItem:", error);
    throw new Error(`Failed to fetch sublist item: ${error.message}`);
  }
}
export async function transformPurchaseToBill(
  accountId,
  token,
  purchase_id,
  bill_data,
  recordType,
  unitMapping,
  lotNumbers
) {
  try {
    // Validate parameters

    const response = await apiRequest(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/transaction/${RECORDS[recordType]}/bill-purchase`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId: accountId,
          token: token,
          purchase_id: purchase_id,
          recordData: bill_data,
          unitMapping: unitMapping,
          lotNumbers: lotNumbers,
        }),
      }
    );

    if (!response.ok) {
      // Handle error response
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error in fetchSublistItem:", error);
    throw new Error(`Failed to fetch sublist item: ${error.message}`);
  }
}

export async function expandReferences(accountId, token, record, recType) {
  const expanded = { ...record };

  for (const field of REFERENCE_FIELDS) {
    if (!record[field]?.id || record[field]?.id == "-1") continue;

    try {
      // Check if we have this reference in cache
      const cacheKey = `${field}_${record[field].id}`;
      if (referenceCache.has(cacheKey)) {
        expanded[field] = referenceCache.get(cacheKey);
        continue;
      }

      // Determine record type from field name
      var recordType = "";
      var newIdField = "";

      // console.log("expandReferences recType: ", recType);

      if (field === "item") {
        recordType = "inventoryItem";
        newIdField = REFERENCE_FIELD_NEW_ID[field];
      } else if (field === "adjLocation") {
        recordType = "location";
        newIdField = REFERENCE_FIELD_NEW_ID["location"];
      } else if (field === "transferLocation") {
        recordType = "location";
        newIdField = REFERENCE_FIELD_NEW_ID["location"];
      } else if (field === "toLocation") {
        recordType = "location";
        newIdField = REFERENCE_FIELD_NEW_ID["location"];
      } else if (field === "inventory") {
        recordType = "inventoryAdjustment-inventoryElement";
        // Note: inventory field doesn't have a newIdField mapping in your examples
      } else if (field === "salesRep") {
        recordType = "employee";
        newIdField = REFERENCE_FIELD_NEW_ID["employee"];
      } else if (field === "aracct") {
        recordType = "account";
        newIdField = REFERENCE_FIELD_NEW_ID["account"];
      } else if (field === "entity") {
        if (
          recType == "bank-check" ||
          recType == "purchase-order" ||
          recType == "vendor-bill"
        ) {
          recordType = "vendor";
          newIdField = REFERENCE_FIELD_NEW_ID["vendor"];
        } else {
          recordType = "customer";
          newIdField = REFERENCE_FIELD_NEW_ID["customer"];
        }
      } else if (field === "doc") {
        if (record.type == "Invoice") {
          recordType = "invoice";
          newIdField = REFERENCE_FIELD_NEW_ID["doc"];
        } else if (record.type == "CreditMemo") {
          recordType = "creditmemo";
          newIdField = REFERENCE_FIELD_NEW_ID["doc"];
        } else {
          // Default to invoice if type is not specified
          recordType = "invoice";
          newIdField =
            REFERENCE_FIELD_NEW_ID["invoice"] || REFERENCE_FIELD_NEW_ID["doc"];
        }
      } else {
        recordType = field;
        newIdField = REFERENCE_FIELD_NEW_ID[field];
      }

      // Fetch the referenced record
      const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${recordType}/${record[field].id}`;
      console.log("expandReferences recType URL: ", url);
      // console.log("refRecord - recordType", recType);
      const refRecord = await fetchSublistItem(accountId, token, url, recType);

      // Add the full record data to our expanded record
      const expandedRef = {
        ...record[field],
        // ...refRecord,
        new_id: refRecord[newIdField],
        // Preserve the original reference structure
        links: record[field].links,
        refName: record[field].refName,
        id: record[field].id,
        ...(field == "item" && { baseunit: refRecord["baseUnit"] }),
      };

      // Add to cache for future use
      referenceCache.set(cacheKey, expandedRef);

      // Add to our expanded record
      expanded[field] = expandedRef;
    } catch (error) {
      console.warn(
        `Failed to expand ${field} reference:`,
        error.message || error
      );
      // Keep the original reference if expansion fails
      expanded[field] = {
        ...record[field],
        expansionError: error.message,
        expanded: false,
      };
    }
  }

  return expanded;
}

export async function getLotMapping(accountId, token) {
  try {
    const response = await apiRequest(
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

// Function to apply lot mapping to inventory details
export function applyLotMapping(record, lotMapping, lotNumbers, type) {
  // if (!record.inventory?.items && !record.item?.items) return;

  let sublist_name;

  if (record?.inventory) {
    sublist_name = "inventory";
  } else {
    sublist_name = "item";
  }

  record[sublist_name].items.forEach((item) => {
    var item_line = item.line;
    //       const RECORDS = {
    //   InvAdjst: "inventory-adjustment",
    //   TrnfrOrd: "transfer-order",
    //   InvTrnfr: "inventory-transfer",
    //   CustInvc: "invoice",
    //   Journal: "journal",
    //   CustPymt: "customer-payment",
    //   RtnAuth: "return-authorization",
    // };

    if (item.inventoryDetail?.inventoryAssignment?.items) {
      item.inventoryDetail.inventoryAssignment.items.forEach((assignment) => {
        if (type == "InvAdjst" || type == "ItemRcpt") {
          // Handle issueInventoryNumber
          if (lotNumbers[item_line]) {
            const oldId = lotNumbers[item_line].inventorynumberid;
            if (lotMapping[oldId]) {
              assignment.old_id = oldId;
              assignment.new_id = lotMapping[oldId];
            }
          }
        }
        if (type == "PurchOrd" || type == "VendBill") {
          // Handle issueInventoryNumber
          if (lotNumbers[item_line]) {
            const oldId = lotNumbers[item_line].inventorynumberid;
            if (lotMapping[oldId]) {
              assignment.old_id = oldId;
              assignment.new_id = lotMapping[oldId];
            }
          }
        } else if (type == "InvTrnfr") {
          var issueInventoryNumber = assignment.issueInventoryNumber;
          const oldId = issueInventoryNumber.id;
          if (lotMapping[oldId]) {
            assignment.old_id = oldId;
            assignment.new_id = lotMapping[oldId];
            assignment.refName = issueInventoryNumber.refName;
          }
        } else if (type == "TrnfrOrd") {
          var issueInventoryNumber = assignment.issueInventoryNumber;
          const oldId = issueInventoryNumber.id;
          if (lotMapping[oldId]) {
            assignment.old_id = oldId;
            assignment.new_id = lotMapping[oldId];
            assignment.refName = issueInventoryNumber.refName;
          }
        } else if (type == "CustInvc") {
          var issueInventoryNumber = assignment.issueInventoryNumber;
          const oldId = issueInventoryNumber.id;
          if (lotMapping[oldId]) {
            assignment.old_id = oldId;
            assignment.new_id = lotMapping[oldId];
            assignment.refName = issueInventoryNumber.refName;
          }
        } else if (type == "RtnAuth") {
          if (lotNumbers[item_line]) {
            const oldId = lotNumbers[item_line].inventorynumberid;
            if (lotMapping[oldId]) {
              assignment.old_id = oldId;
              assignment.new_id = lotMapping[oldId];
            }
          }
        } else if (type == "CustCred") {
          if (lotNumbers[item_line]) {
            const oldId = lotNumbers[item_line].inventorynumberid;
            if (lotMapping[oldId]) {
              assignment.old_id = oldId;
              assignment.new_id = lotMapping[oldId];
            }
          }
        }
      });
    }
  });
}

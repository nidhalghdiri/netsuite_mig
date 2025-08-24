const RECORDS = {
  InvAdjst: "inventory-adjustment",
  TrnfrOrd: "transfer-order",
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
    console.log("[Creating Transaction] oldAccountID = ", oldAccountID);
    console.log("[Creating Transaction] oldToken = ", oldToken);
    console.log("[Creating Transaction] newAccountID = ", newAccountID);
    console.log("[Creating Transaction] newToken = ", newToken);
    console.log("[Creating Transaction] recordType = ", recordType);
    console.log(
      "[Creating Transaction] transactionData = ",
      JSON.stringify(transactionData)
    );
    console.log(
      "[Creating Transaction] unitMapping = ",
      JSON.stringify(unitMapping)
    );
    console.log(
      "[Creating Transaction] lotNumbers = ",
      JSON.stringify(lotNumbers)
    );

    const response = await fetch(
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

export async function fetchNewTransaction(
  recordType,
  accountId,
  token,
  internalId
) {
  try {
    const response = await fetch(
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
    return recordData;
  } catch (error) {
    console.error("Error getting New Transaction:", error);
    throw error;
  }
}

export async function getUnitMapping(accountId, token) {
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

export async function getLotNumbers(accountId, token, tranId) {
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

// Function to create lot number mapping records
export async function createLotNumberMappings(
  accountId,
  token,
  createdRecord,
  lotNumbersToMap,
  newLotNumbers
) {
  try {
    // Extract the new lot number IDs from the created record
    const newLotMappings = [];

    if (createdRecord.inventory && createdRecord.inventory.items) {
      for (const item of createdRecord.inventory.items) {
        if (item.inventoryDetail && item.inventoryDetail.inventoryAssignment) {
          for (const assignment of item.inventoryDetail.inventoryAssignment
            .items) {
            // Find the corresponding old lot number
            const oldLot = lotNumbersToMap.find(
              (lot) => lot.refName === assignment.receiptInventoryNumber
            );

            if (oldLot) {
              newLotMappings.push({
                old_id: oldLot.old_id,
                new_id: newLotNumbers[item.line].inventorynumberid,
                refName: oldLot.refName,
              });
            }
          }
        }
      }
    }

    console.log("newLotMappings: ", JSON.stringify(newLotMappings, null, 2));

    // Create mapping records for each lot number
    for (const mapping of newLotMappings) {
      await createLotMappingRecord(accountId, token, mapping);
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
    const response = await fetch(
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
    console.log("Lot mapping created:", result);
    return result;
  } catch (error) {
    console.error("Error creating lot mapping:", error);
    throw error;
  }
};

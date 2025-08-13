// lib/netsuiteAPI.js

import { getSession } from "./storage";

function getToken(instanceType) {
  return instanceType === "old"
    ? getSession("old").token
    : getSession("new").token;
}

// Base function to fetch record data
export async function fetchRecordData(recordType, instanceType) {
  try {
    // Determine API endpoint based on record type and instance
    const token = getToken(instanceType);
    console.log("fetchRecordData instanceType: ", instanceType);
    console.log("fetchRecordData token: ", token);

    if (!token) {
      throw new Error(
        `Authentication token not configured for ${instanceType} instance`
      );
    }
    const baseUrl =
      instanceType === "old"
        ? process.env.NEXT_PUBLIC_OLD_NS_API_BASE
        : process.env.NEXT_PUBLIC_NEW_NS_API_BASE;

    const endpoint = getRecordEndpoint(recordType);
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "transient",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${recordType} from ${instanceType} instance: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.items || data;
  } catch (error) {
    console.error(
      `Error fetching ${recordType} from ${instanceType} instance:`,
      error
    );
    throw new Error(`Failed to fetch ${recordType} data: ${error.message}`);
  }
}

// Map record types to API endpoints
function getRecordEndpoint(recordType) {
  const endpoints = {
    "sales-orders": "salesorder",
    purchases: "purchaseorder",
    invoices: "invoice",
    customers: "customer",
  };

  return endpoints[recordType] || "unknown";
}

// Compare records between instances (example implementation)
export function compareRecords(oldRecords, newRecords, keyField = "id") {
  const oldMap = new Map(
    oldRecords.map((record) => [record[keyField], record])
  );
  const newMap = new Map(
    newRecords.map((record) => [record[keyField], record])
  );

  const missingInNew = oldRecords.filter(
    (record) => !newMap.has(record[keyField])
  );
  const missingInOld = newRecords.filter(
    (record) => !oldMap.has(record[keyField])
  );

  const commonRecords = oldRecords.filter((record) =>
    newMap.has(record[keyField])
  );

  const differences = commonRecords
    .map((record) => {
      const newRecord = newMap.get(record[keyField]);
      const diffFields = {};

      Object.keys(record).forEach((field) => {
        if (record[field] !== newRecord[field]) {
          diffFields[field] = {
            old: record[field],
            new: newRecord[field],
          };
        }
      });

      return {
        id: record[keyField],
        differences: diffFields,
      };
    })
    .filter((item) => Object.keys(item.differences).length > 0);

  return {
    missingInNew,
    missingInOld,
    differences,
    matchCount: commonRecords.length - differences.length,
    oldCount: oldRecords.length,
    newCount: newRecords.length,
  };
}

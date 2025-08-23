// app/api/netsuite/lot-mapping/route.js
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { accountId, token, tranId } = await request.json();

    // Validate input
    if (!accountId || !token) {
      return NextResponse.json(
        { error: "Missing required parameters or invalid format" },
        { status: 400 }
      );
    }

    // Construct SuiteQL query for lot mapping
    const suiteQLQuery = `SELECT
	InventoryAssignment.transaction AS transaction,
	InventoryAssignment.transactionline AS transactionline,
	InventoryAssignment.InventoryNumber AS InventoryNumberID,
	BUILTIN.DF( InventoryAssignment.InventoryNumber ) AS InventoryNumberName,
	InventoryAssignment.quantity AS quantity
FROM
	InventoryAssignment
WHERE
	InventoryAssignment.transaction = '${tranId}'`;

    // Execute SuiteQL query
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "transient",
      },
      body: JSON.stringify({ q: suiteQLQuery }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SuiteQL query failed: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();

    // Transform results into a mapping object
    const lotNumbers = {};
    if (result.items && result.items.length > 0) {
      console.log("lotNumbers Response: ", JSON.stringify(result.items));
      result.items.forEach((item) => {
        // Map by both old ID and name for flexibility
        lotNumbers[item.transactionline] = item;
      });
    }

    return NextResponse.json({ lotNumbers });
  } catch (error) {
    console.error("Error in lot Numbers:", error);
    return NextResponse.json(
      { error: "Failed to get lot Numbers", details: error.message },
      { status: 500 }
    );
  }
}

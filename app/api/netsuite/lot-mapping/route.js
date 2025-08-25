// app/api/netsuite/lot-mapping/route.js
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { accountId, token } = await request.json();

    // Validate input
    if (!accountId || !token) {
      return NextResponse.json(
        { error: "Missing required parameters or invalid format" },
        { status: 400 }
      );
    }

    // Construct SuiteQL query for lot mapping
    const suiteQLQuery = `
    SELECT 
      CUSTOMRECORD_MIG_LOT_NUMBER_RELATION.custrecord_mig_lot_number_name AS lot_name, 
      CUSTOMRECORD_MIG_LOT_NUMBER_RELATION.custrecord_mig_lot_number_old_id AS lot_old_id, 
      CUSTOMRECORD_MIG_LOT_NUMBER_RELATION.custrecord_mig_lot_number_new_id AS lot_new_id
    FROM 
      CUSTOMRECORD_MIG_LOT_NUMBER_RELATION
    `;

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
    const lotMapping = {};
    if (result.items && result.items.length > 0) {
      console.log("lotMapping Response: ", JSON.stringify(result.items));
      result.items.forEach((item) => {
        // Map by both old ID and name for flexibility
        lotMapping[item.lot_old_id] = item.lot_new_id;
        // lotMapping[item.lot_name] = item.lot_new_id;
      });
    }

    return NextResponse.json({ lotMapping });
  } catch (error) {
    console.error("Error in lot mapping:", error);
    return NextResponse.json(
      { error: "Failed to get lot mapping", details: error.message },
      { status: 500 }
    );
  }
}

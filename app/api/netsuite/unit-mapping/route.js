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

    // Construct SuiteQL query
    const suiteQLQuery = `
      SELECT 
        BUILTIN_RESULT.TYPE_STRING(CUSTOMRECORD_MIG_UNITS_OF_MEASURE_RELATI.custrecord_mig_unit_of_measure_item) AS unit_of_measure_item, 
        BUILTIN_RESULT.TYPE_INTEGER(CUSTOMRECORD_MIG_UNITS_OF_MEASURE_RELATI.custrecord_mig_unit_of_measure_old_id) AS unit_of_measure_old_id, 
        BUILTIN_RESULT.TYPE_INTEGER(CUSTOMRECORD_MIG_UNITS_OF_MEASURE_RELATI.custrecord_mig_unit_of_measur_sandbox_id) AS unit_of_measur_sandbox_id
      FROM 
        CUSTOMRECORD_MIG_UNITS_OF_MEASURE_RELATI
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
    const unitMapping = {};
    if (result.items && result.items.length > 0) {
      result.items.forEach((item) => {
        unitMapping[item.unit_of_measure_old_id] =
          item.unit_of_measur_sandbox_id;
      });
    }

    return NextResponse.json({ unitMapping });
  } catch (error) {
    console.error("Error in unit mapping:", error);
    return NextResponse.json(
      { error: "Failed to get unit mapping", details: error.message },
      { status: 500 }
    );
  }
}

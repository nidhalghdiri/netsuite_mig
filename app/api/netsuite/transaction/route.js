import { NextResponse } from "next/server";
export async function POST(request) {
  try {
    const { accountID, token } = await request.json();

    console.log("POST fetchMigrationData Account: ", accountID);
    console.log("POST fetchMigrationData token: ", token);

    // Step 1: Fetch all transactions with pagination
    const allTransactions = await fetchAllTransactions(accountID, token);
    // Calculate statistics
    const statistics = calculateStatistics(allTransactions);

    return NextResponse.json({
      statistics,
      transactions: allTransactions,
      total: allTransactions.length,
    });
  } catch (error) {
    console.error("NetSuite API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction data", details: error.message },
      { status: 500 }
    );
  }
}

async function fetchAllTransactions(account, token) {
  let allItems = [];
  let offset = 0;
  const limit = 1000; // NetSuite's max per page
  let hasMore = true;

  while (hasMore) {
    const query = `
            SELECT  
                transaction.*
            FROM 
                transaction, 
                transactionLine
            WHERE 
                transaction.ID = transactionLine.transaction
                AND transactionLine.mainline = 'T'
                AND transaction.trandate BETWEEN TO_TIMESTAMP('01/01/2020', 'DD/MM/YYYY HH24:MI:SS') AND TO_TIMESTAMP('01/01/2020', 'DD/MM/YYYY HH24:MI:SS')
            ORDER BY 
                transaction.createddate DESC`;
    const response = await fetchNetSuiteData(
      account,
      token,
      query,
      offset,
      limit
    );

    allItems = [...allItems, ...response.items];
    hasMore = response.hasMore;
    offset += limit;

    // Optional: Add delay to avoid rate limiting
    if (offset > 100000) break;
  }

  return allItems;
}

async function fetchNetSuiteData(account, token, query, offset, limit) {
  const url = `https://${account}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=${limit}&offset=${offset}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "transient",
    },
    body: JSON.stringify({ q: query }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`NetSuite API error: ${error.error.message}`);
  }

  return response.json();
}

// Calculate statistics from all transactions
function calculateStatistics(transactions) {
  const byType = {};
  let total = transactions.length;

  transactions.forEach((transaction) => {
    const type = transaction.type;
    if (!byType[type]) {
      byType[type] = 0;
    }
    byType[type]++;
  });

  return {
    totalTransactions: total,
    processed: 0, // Will be updated during migration
    remaining: total,
    successRate: 0,
    byType,
  };
}

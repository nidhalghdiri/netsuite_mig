import { NextResponse } from "next/server";
export async function POST(request) {
  try {
    const { accountID, token } = await request.json();

    if (!accountID || !token) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    console.log("POST fetchMigrationData Account: ", accountID);
    console.log("POST fetchMigrationData token: ", token);

    // Step 1: Fetch all transactions with pagination
    const allTransactions = await fetchAllTransactions(accountID, token);
    if (!allTransactions || allTransactions.length === 0) {
      return NextResponse.json({
        statistics: getDefaultStatistics(),
        transactions: [],
        total: 0,
      });
    }
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
function getDefaultStatistics() {
  return {
    totalTransactions: 0,
    processed: 0,
    remaining: 0,
    successRate: 0,
    byType: {},
  };
}

async function fetchAllTransactions(account, token) {
  let allItems = [];
  let offset = 0;
  const limit = 1000; // NetSuite's max per page
  let hasMore = true;

  while (hasMore) {
    // const query = `
    //         SELECT
    //             transaction.*
    //         FROM
    //             transaction,
    //             transactionLine
    //         WHERE
    //             transaction.ID = transactionLine.transaction
    //             AND transactionLine.mainline = 'T'
    //             AND transaction.trandate BETWEEN TO_TIMESTAMP('01/01/2020', 'DD/MM/YYYY HH24:MI:SS') AND TO_TIMESTAMP('01/01/2020', 'DD/MM/YYYY HH24:MI:SS')
    //             AND transaction.id IN ('2226', '2326', '2426', '2526', '2626', '2726', '2861', '2862', '2864', '2865', '2874', '2875', '2876', '2908', '2997', '4941', '4956', '7875', '8776', '9185', '9429', '9433', '9436', '16140', '17071', '17189', '17293', '17293', '17399', '17918', '18321', '19350', '19356', '19368', '19385', '21184', '22107', '23917', '53679', '74034', '74035')
    //         ORDER BY
    //             transaction.createddate ASC`;
    const query = `
            SELECT transaction.*
            FROM transaction
            WHERE transaction.ID IN (
                SELECT DISTINCT transaction.ID
                FROM transaction
                INNER JOIN transactionLine ON transaction.ID = transactionLine.transaction
                WHERE transactionLine.mainline = 'T'
                AND transaction.trandate BETWEEN TO_TIMESTAMP('03/01/2020', 'DD/MM/YYYY') AND TO_TIMESTAMP('04/01/2020', 'DD/MM/YYYY')
                AND NOT (transaction.type IN ('Deposit', 'FxReval'))
)
ORDER BY transaction.createddate ASC;`;
    const response = await fetchNetSuiteData(
      account,
      token,
      query,
      offset,
      limit
    );
    if (!response?.items) {
      throw new Error("Invalid response format from NetSuite");
    }

    const transactions = response.items.map((trx) => ({
      ...trx,
      mig_status: "Pending",
      steps: {
        fetch: {
          status: "completed",
          timestamp: "2020-01-15 09:30:22",
        },
        create: {
          status: "completed",
          timestamp: "2020-01-15 09:32:45",
        },
        relate: {
          status: "completed",
          timestamp: "2020-01-15 09:35:18",
        },
        compare: {
          status: "completed",
          timestamp: "2020-01-15 09:38:02",
          mismatches: 2,
        },
      },
      details: {
        createdFrom: "Quote-QT-789",
        relatedRecords: [
          { id: "INV-1001", type: "Invoice", status: "linked" },
          { id: "FUL-1001", type: "Fulfillment", status: "linked" },
        ],
        files: 3,
        fields: [
          {
            name: "Amount",
            oldValue: "2450.75",
            newValue: "2450.75",
            status: "match",
          },
          {
            name: "Customer",
            oldValue: "John Doe Inc.",
            newValue: "John Doe Inc.",
            status: "match",
          },
          {
            name: "Item",
            oldValue: "SKU-1001",
            newValue: "SKU-1001",
            status: "match",
          },
          {
            name: "Quantity",
            oldValue: "10",
            newValue: "8",
            status: "mismatch",
          },
          {
            name: "Discount",
            oldValue: "5%",
            newValue: "0%",
            status: "mismatch",
          },
        ],
      },
    }));

    allItems = [...allItems, ...transactions];
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
  if (!transactions || !Array.isArray(transactions)) {
    return getDefaultStatistics();
  }
  const byType = {};
  let total = transactions.length;

  transactions.forEach((transaction) => {
    const type = transaction.type || "unknown";
    byType[type] = (byType[type] || 0) + 1;
  });

  return {
    totalTransactions: total,
    processed: 0, // Will be updated during migration
    remaining: total,
    successRate: 0,
    byType,
  };
}

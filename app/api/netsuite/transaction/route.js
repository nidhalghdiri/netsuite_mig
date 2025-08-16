import { NextResponse } from "next/server";
export async function POST(request) {
  try {
    const { accountID, token } = await request.json();

    console.log("POST fetchMigrationData Account: ", accountID);
    console.log("POST fetchMigrationData token: ", token);

    const transactionsQuery = `
            SELECT  
                transaction.id, 
                transaction.entity as customer_id, 
                transaction.tranid, 
                transaction.trandate, 
                transaction.currency, 
                transaction.type, 
                transaction.title as sub_type, 
                transaction.memo, 
                transaction.status, 
                transaction.foreigntotal as total, 
                transaction.foreignamountpaid as paid_amount, 
                transaction.foreignamountunpaid as unpaid_amount, 
                transaction.foreignpaymentamountused as used_amount, 
                transaction.foreignpaymentamountunused as unused_amount, 
                transaction.externalId as external_id 
            FROM 
                transaction, 
                transactionLine, 
                customer  
            WHERE 
                transaction.ID = transactionLine.transaction 
                AND transaction.entity = customer.id 
                AND transactionLine.subsidiary IN ('10', '12') 
                AND transactionLine.mainline = 'T' 
                AND transaction.type IN ('CashSale', 'CustCred', 'CustInvc', 'SalesOrd', 'RtnAuth', 'Estimate') 
                AND NOT(transaction.type IN ('Estimate:B', 'Estimate:X')) 
                AND (transaction.trandate BETWEEN BUILTIN.RELATIVE_RANGES('TYTD', 'START', 'DATE') 
                AND BUILTIN.RELATIVE_RANGES('TYTD', 'END', 'DATE')) 
            ORDER BY 
                transaction.trandate DESC`;

    const transactionsResponse = await fetchNetSuiteData(
      accountID,
      token,
      transactionsQuery
    );

    return NextResponse.json({
      transactions: transactionsResponse,
    });
  } catch (error) {
    console.error("NetSuite API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction data", details: error.message },
      { status: 500 }
    );
  }
}

async function fetchNetSuiteData(account, token, query) {
  const url = `https://${account}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;

  const requestData = {
    url,
    method: "POST",
  };

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

function calculateStatistics(response) {
  const byType = {
    salesOrders: 0,
    invoices: 0,
    purchases: 0,
    creditMemos: 0,
    others: 0,
  };

  let totalTransactions = 0;
  let processed = 0;

  response.items.forEach((item) => {
    totalTransactions += item.total;
    processed += item.processed;

    switch (item.type) {
      case "SalesOrd":
        byType.salesOrders = item.total;
        break;
      case "Invoice":
        byType.invoices = item.total;
        break;
      case "PurchOrd":
        byType.purchases = item.total;
        break;
      case "CustCred":
        byType.creditMemos = item.total;
        break;
      default:
        byType.others += item.total;
    }
  });

  const remaining = totalTransactions - processed;
  const successRate =
    processed > 0
      ? Math.round((processed / totalTransactions) * 10000) / 100
      : 0;

  return {
    totalTransactions,
    processed,
    remaining,
    successRate,
    byType,
  };
}

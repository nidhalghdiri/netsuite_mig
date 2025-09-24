// dashboard/[transactionType]/page.js
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getSession, isSessionValid } from "@/lib/storage";
import {
  FiDatabase,
  FiRefreshCw,
  FiCheckCircle,
  FiXCircle,
  FiChevronDown,
  FiChevronRight,
  FiDollarSign,
} from "react-icons/fi";
import { apiRequest } from "@/lib/apiClient";

export default function TransactionTypePage() {
  const params = useParams();
  const transactionType = params.transactionType;

  const [oldData, setOldData] = useState([]);
  const [newData, setNewData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [itemDetails, setItemDetails] = useState({});

  // Map URL transaction types to NetSuite internal types
  const typeMapping = {
    invoices: "CustInvc",
    "inventory-adjustment": "InvAdjst",
    "transfer-order": "TrnfrOrd",
    "inventory-transfer": "InvTrnfr",
    "purchase-order": "PurchOrd",
  };

  const fetchTransactionData = async () => {
    setLoading(true);
    setError(null);

    try {
      const nsType = typeMapping[transactionType];
      if (!nsType) {
        throw new Error("Invalid transaction type");
      }

      // Get sessions
      const oldSession = getSession("old");
      const newSession = getSession("new");

      if (!oldSession?.token || !newSession?.token) {
        throw new Error("Please connect to both instances first");
      }

      // Fetch data from both instances
      const [oldResponse, newResponse] = await Promise.all([
        fetchSuiteQLData(oldSession, nsType, "old", "5319757"),
        fetchSuiteQLData(newSession, nsType, "new", "11661334"),
      ]);

      console.log("oldResponse: ", oldResponse);
      console.log("newResponse: ", newResponse);
      setOldData(oldResponse);
      setNewData(newResponse);
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch transaction data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuiteQLData = async (
    session,
    recordType,
    instanceType,
    accountId
  ) => {
    var stockAcct = instanceType == "old" ? "379" : "319";
    // Build SuiteQL query based on record type
    const query = `SELECT transaction.id AS id, 
        transaction.custbody_mig_old_internal_id AS old_id, 
        transaction.custbody_mig_new_internal_id AS new_id, 
        transaction.trandate AS trandate, 
        transaction.tranid, 
        transaction.type, 
        transaction.createddate, 
        SUM(TransactionAccountingLine.netamount) AS amount 
      FROM transaction, TransactionAccountingLine, transactionLine 
      WHERE transactionLine.transaction = TransactionAccountingLine.transaction 
        AND transactionLine.id = TransactionAccountingLine.transactionline 
        AND transaction.id = transactionLine.transaction 
        AND transaction.type IN ('${recordType}') 
        AND transaction.trandate BETWEEN TO_DATE('2020-01-01', 'YYYY-MM-DD HH24:MI:SS') 
        AND TO_DATE('2020-01-31', 'YYYY-MM-DD HH24:MI:SS') 
        AND transactionLine.mainline = 'F' 
        AND TransactionAccountingLine.account = '${stockAcct}' 
      GROUP BY transaction.id, transaction.custbody_mig_old_internal_id, transaction.custbody_mig_new_internal_id, transaction.trandate, transaction.tranid, 
        transaction.type, transaction.createddate
      ORDER BY transaction.createddate ASC`;

    try {
      const response = await apiRequest(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/suiteql`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: accountId,
            token: session.token,
            query: query,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch data from ${instanceType} instance`);
      }

      const data = await response.json();
      return data.result.items;
    } catch (error) {
      console.error(`Error fetching from ${instanceType} instance:`, error);
      throw error;
    }
  };

  const fetchItemDetails = async (transactionId, instanceType) => {
    // If we already have the details, don't fetch again
    if (itemDetails[transactionId]) return;

    try {
      const session = getSession(instanceType);
      const accountId = instanceType === "old" ? "5319757" : "11661334";
      const nsType = typeMapping[transactionType];

      // Query to get detailed item information for a specific transaction
      const query = `SELECT 
          BUILTIN.DF(transactionLine.item) AS item_name,
          transactionLine.item AS item_id,
          transactionLine.quantity,
          transactionLine.rate, 
          TransactionAccountingLine.netamount AS amount, 
          BUILTIN.DF(transactionLine.location) AS location,  
          BUILTIN.DF(transactionLine.department) AS department 
        FROM transaction, TransactionAccountingLine, transactionLine 
        WHERE  
        transactionLine.transaction = TransactionAccountingLine.transaction 
        AND transactionLine.id = TransactionAccountingLine.transactionline 
        AND transaction.id = transactionLine.transaction 
        AND transaction.id = '${transactionId}'`;

      const response = await apiRequest(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/suiteql`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: accountId,
            token: session.token,
            query: query,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch item details for transaction ${transactionId}`
        );
      }

      const data = await response.json();

      // Update item details state
      setItemDetails((prev) => ({
        ...prev,
        [transactionId]: data.result.items,
      }));
    } catch (error) {
      console.error("Error fetching item details:", error);
    }
  };

  const toggleRowExpansion = async (
    documentNumber,
    oldInstance,
    newInstance
  ) => {
    // Toggle the expanded state
    setExpandedRows((prev) => ({
      ...prev,
      [documentNumber]: !prev[documentNumber],
    }));

    // If we're expanding and don't have item details yet, fetch them
    if (!expandedRows[documentNumber]) {
      if (oldInstance && oldInstance.id) {
        await fetchItemDetails(oldInstance.id, "old");
      }
      if (newInstance && newInstance.id) {
        await fetchItemDetails(newInstance.id, "new");
      }
    }
  };

  useEffect(() => {
    if (transactionType) {
      fetchTransactionData();
    }
  }, [transactionType]);

  // Create a mapping using the old_id and new_id fields to properly relate transactions
  const createDataMapping = () => {
    const mappedData = [];

    // Create maps for lookup by ID
    const oldById = {};
    oldData.forEach((item) => {
      oldById[item.id] = item;
    });

    const newById = {};
    newData.forEach((item) => {
      newById[item.id] = item;
    });

    // Create maps for lookup by cross-reference IDs
    const oldByNewId = {};
    oldData.forEach((item) => {
      if (item.new_id) {
        oldByNewId[item.new_id] = item;
      }
    });

    const newByOldId = {};
    newData.forEach((item) => {
      if (item.old_id) {
        newByOldId[item.old_id] = item;
      }
    });

    // First, match transactions that have direct references
    const matchedIds = new Set();

    // Match using old_id -> new_id references
    oldData.forEach((oldItem) => {
      if (oldItem.new_id && newById[oldItem.new_id]) {
        mappedData.push({
          documentNumber: oldItem.tranid,
          oldInstance: oldItem,
          newInstance: newById[oldItem.new_id],
          matchType: "direct",
        });
        matchedIds.add(oldItem.id);
        matchedIds.add(oldItem.new_id);
      }
    });

    // Match using new_id -> old_id references
    newData.forEach((newItem) => {
      if (
        newItem.old_id &&
        oldById[newItem.old_id] &&
        !matchedIds.has(newItem.id)
      ) {
        mappedData.push({
          documentNumber: newItem.tranid,
          oldInstance: oldById[newItem.old_id],
          newInstance: newItem,
          matchType: "direct",
        });
        matchedIds.add(newItem.id);
        matchedIds.add(newItem.old_id);
      }
    });

    // Add unmatched transactions
    oldData.forEach((oldItem) => {
      if (!matchedIds.has(oldItem.id)) {
        mappedData.push({
          documentNumber: oldItem.tranid,
          oldInstance: oldItem,
          newInstance: null,
          matchType: "unmatched",
        });
      }
    });

    newData.forEach((newItem) => {
      if (!matchedIds.has(newItem.id)) {
        mappedData.push({
          documentNumber: newItem.tranid,
          oldInstance: null,
          newInstance: newItem,
          matchType: "unmatched",
        });
      }
    });

    return mappedData;
  };

  const mappedData = createDataMapping();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FiRefreshCw className="animate-spin text-2xl text-blue-500 mr-2" />
        <span>Loading transaction data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex items-center">
          <FiXCircle className="text-red-500 mr-2" />
          <h3 className="text-red-800 font-medium">Error</h3>
        </div>
        <p className="text-red-700 mt-1">{error}</p>
        <button
          onClick={fetchTransactionData}
          className="mt-3 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 capitalize">
          {transactionType.replace(/-/g, " ")} Comparison
        </h2>
        <button
          onClick={fetchTransactionData}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <FiRefreshCw className="mr-2" />
          Refresh Data
        </button>
      </div>

      <div className="bg-white text-black rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Old Instance ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  New Instance ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Old Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  New Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Difference
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mappedData.map((item, index) => {
                const oldAmount = item.oldInstance
                  ? parseFloat(item.oldInstance.amount)
                  : 0;
                const newAmount = item.newInstance
                  ? parseFloat(item.newInstance.amount)
                  : 0;
                const difference = oldAmount - newAmount;
                const amountsMatch = oldAmount === newAmount;
                const isExpanded = expandedRows[item.documentNumber];

                return (
                  <>
                    <tr
                      key={index}
                      className={
                        amountsMatch
                          ? "bg-green-50 cursor-pointer"
                          : "bg-red-50 cursor-pointer hover:bg-red-100"
                      }
                      onClick={() =>
                        toggleRowExpansion(
                          item.documentNumber,
                          item.oldInstance,
                          item.newInstance
                        )
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {amountsMatch ? (
                          <FiCheckCircle className="text-green-500" />
                        ) : (
                          <FiXCircle className="text-red-500" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        <div className="flex items-center">
                          {!amountsMatch &&
                            (isExpanded ? (
                              <FiChevronDown className="mr-1" />
                            ) : (
                              <FiChevronRight className="mr-1" />
                            ))}
                          {item.documentNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.oldInstance
                          ? item.oldInstance.trandate
                          : item.newInstance
                          ? item.newInstance.trandate
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.oldInstance ? item.oldInstance.id : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.newInstance ? item.newInstance.id : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.oldInstance ? `$${oldAmount.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.newInstance ? `$${newAmount.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.oldInstance && item.newInstance ? (
                          <span
                            className={
                              difference === 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {difference === 0 ? "" : difference > 0 ? "+" : ""}$
                            {Math.abs(difference).toFixed(2)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>

                    {/* Expanded row with item details */}
                    {isExpanded && !amountsMatch && (
                      <tr className="bg-gray-50">
                        <td colSpan="8" className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Old Instance Item Details */}
                            <div>
                              <h4 className="font-semibold mb-2 text-gray-700">
                                Old Instance Items
                              </h4>
                              {item.oldInstance &&
                              itemDetails[item.oldInstance.id] ? (
                                <div className="bg-white rounded-md shadow-sm p-3">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="text-left py-2">Item</th>
                                        <th className="text-right py-2">
                                          Amount
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {itemDetails[item.oldInstance.id].map(
                                        (detail, idx) => (
                                          <tr
                                            key={idx}
                                            className="border-b border-gray-100"
                                          >
                                            <td className="py-2">
                                              {detail.item_name || "N/A"}
                                            </td>
                                            <td className="text-right py-2">
                                              $
                                              {parseFloat(
                                                detail.amount || 0
                                              ).toFixed(2)}
                                            </td>
                                          </tr>
                                        )
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-gray-500 italic">
                                  Loading item details...
                                </div>
                              )}
                            </div>

                            {/* New Instance Item Details */}
                            <div>
                              <h4 className="font-semibold mb-2 text-gray-700">
                                New Instance Items
                              </h4>
                              {item.newInstance &&
                              itemDetails[item.newInstance.id] ? (
                                <div className="bg-white rounded-md shadow-sm p-3">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="text-left py-2">Item</th>
                                        <th className="text-right py-2">
                                          Amount
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {itemDetails[item.newInstance.id].map(
                                        (detail, idx) => (
                                          <tr
                                            key={idx}
                                            className="border-b border-gray-100"
                                          >
                                            <td className="py-2">
                                              {detail.item_name || "N/A"}
                                            </td>
                                            <td className="text-right py-2">
                                              $
                                              {parseFloat(
                                                detail.amount || 0
                                              ).toFixed(2)}
                                            </td>
                                          </tr>
                                        )
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-gray-500 italic">
                                  {item.newInstance
                                    ? "Loading item details..."
                                    : "No transaction in new instance"}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Difference analysis */}
                          {item.oldInstance &&
                            item.newInstance &&
                            itemDetails[item.oldInstance.id] &&
                            itemDetails[item.newInstance.id] && (
                              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                                <h4 className="font-semibold mb-2 text-blue-800">
                                  Difference Analysis
                                </h4>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium">
                                      Total Old Amount:
                                    </span>{" "}
                                    ${oldAmount.toFixed(2)}
                                  </div>
                                  <div>
                                    <span className="font-medium">
                                      Total New Amount:
                                    </span>{" "}
                                    ${newAmount.toFixed(2)}
                                  </div>
                                  <div
                                    className={
                                      difference === 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }
                                  >
                                    <span className="font-medium">
                                      Difference:
                                    </span>{" "}
                                    ${Math.abs(difference).toFixed(2)}
                                    {difference > 0
                                      ? " (Old > New)"
                                      : difference < 0
                                      ? " (New > Old)"
                                      : ""}
                                  </div>
                                </div>
                              </div>
                            )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center">
        <div className="w-4 h-4 bg-green-100 rounded mr-2"></div>
        <span className="text-sm text-gray-600">Matching amounts</span>
        <div className="w-4 h-4 bg-red-100 rounded mr-2 ml-4"></div>
        <span className="text-sm text-gray-600">Non-matching amounts</span>
        <div className="ml-4 flex items-center text-sm text-gray-600">
          <FiChevronRight className="mr-1" />
          <span>Click to expand and view item details</span>
        </div>
      </div>
    </div>
  );
}

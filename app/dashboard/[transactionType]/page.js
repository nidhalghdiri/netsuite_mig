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
} from "react-icons/fi";
import { apiRequest } from "@/lib/apiClient";

export default function TransactionTypePage() {
  const params = useParams();
  const transactionType = params.transactionType;

  const [oldData, setOldData] = useState([]);
  const [newData, setNewData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Map URL transaction types to NetSuite internal types
  const typeMapping = {
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
      console.log("oldSession", oldSession);
      console.log("newSession", newSession);
      if (!oldSession?.token || !newSession?.token) {
        throw new Error("Please connect to both instances first");
      }

      // Fetch data from both instances
      const [oldResponse, newResponse] = await Promise.all([
        fetchSuiteQLData(oldSession, nsType, "old", "5319757"),
        fetchSuiteQLData(newSession, nsType, "new", "11661334"),
      ]);

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
    // Build SuiteQL query based on record type
    const query = ` SELECT 
                    transaction.id AS id, 
                    transaction.trandate AS trandate, 
                    transaction.tranid AS tranid,
                    transaction.type AS type,
                    transaction.createddate AS createddate,
                    SUM(TransactionAccountingLine.netamount) AS amount
                FROM 
                    transaction, 
                    TransactionAccountingLine, 
                    transactionLine
                WHERE 
                    (((transactionLine.transaction = TransactionAccountingLine.transaction 
                    AND transactionLine.id = TransactionAccountingLine.transactionline) 
                    AND transaction.id = transactionLine.transaction))
                    AND ((TransactionAccountingLine.account IN ('379') 
                    AND transaction.trandate BETWEEN TO_DATE('2020-01-01', 'YYYY-MM-DD HH24:MI:SS') 
                    AND TO_DATE('2020-01-31', 'YYYY-MM-DD HH24:MI:SS') 
                    AND transaction.type IN ('${recordType}') 
                GROUP BY transaction.id, transaction.tranid, transaction.trandate, transaction.type, transaction.createddate
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

      var result = await response.json();
      console.log("fetchSuiteQLData [" + accountId + "]", result);

      return result;
    } catch (error) {
      console.error(`Error fetching from ${instanceType} instance:`, error);
      throw error;
    }
  };

  useEffect(() => {
    if (transactionType) {
      fetchTransactionData();
    }
  }, [transactionType]);

  // Create a mapping of document numbers to match records between instances
  const createDataMapping = () => {
    const mappedData = [];

    // Create maps for quick lookup
    const oldMap = {};
    oldData.forEach((item) => {
      oldMap[item.tranid] = item;
    });

    const newMap = {};
    newData.forEach((item) => {
      newMap[item.tranid] = item;
    });

    // Get all unique document numbers
    const allDocNumbers = new Set([
      ...oldData.map((item) => item.tranid),
      ...newData.map((item) => item.tranid),
    ]);

    // Create paired records
    allDocNumbers.forEach((docNumber) => {
      mappedData.push({
        documentNumber: docNumber,
        oldInstance: oldMap[docNumber] || null,
        newInstance: newMap[docNumber] || null,
      });
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

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-2 divide-x">
          {/* Old Instance Table */}
          <div>
            <div className="bg-gray-50 px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">
                Old Instance
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Internal ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      GL Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mappedData.map((item, index) => (
                    <tr
                      key={`old-${index}`}
                      className={
                        item.oldInstance &&
                        item.newInstance &&
                        item.oldInstance.amount === item.newInstance.amount
                          ? "bg-green-50"
                          : "bg-white"
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.oldInstance ? item.oldInstance.trandate : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.oldInstance ? item.oldInstance.id : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.newInstance ? item.newInstance.id : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.documentNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.oldInstance ? `$${item.oldInstance.amount}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* New Instance Table */}
          <div>
            <div className="bg-gray-50 px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">
                New Instance
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Internal ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Old ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      GL Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mappedData.map((item, index) => (
                    <tr
                      key={`new-${index}`}
                      className={
                        item.oldInstance &&
                        item.newInstance &&
                        item.oldInstance.amount === item.newInstance.amount
                          ? "bg-green-50"
                          : "bg-white"
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.newInstance ? item.newInstance.trandate : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.newInstance ? item.newInstance.id : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.oldInstance ? item.oldInstance.id : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.documentNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.newInstance ? `$${item.newInstance.amount}` : "-"}
                        {item.oldInstance && item.newInstance && (
                          <span className="ml-2">
                            {item.oldInstance.amount ===
                            item.newInstance.amount ? (
                              <FiCheckCircle className="inline text-green-500" />
                            ) : (
                              <FiXCircle className="inline text-red-500" />
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center">
        <div className="w-4 h-4 bg-green-100 rounded mr-2"></div>
        <span className="text-sm text-gray-600">Matching amounts</span>
        <div className="w-4 h-4 bg-white rounded mr-2 ml-4 border border-gray-300"></div>
        <span className="text-sm text-gray-600">
          Non-matching or missing records
        </span>
      </div>
    </div>
  );
}

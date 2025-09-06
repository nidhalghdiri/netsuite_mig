// app/dashboard/page.js
"use client";
import { useState, useEffect } from "react";
import { getSession, isSessionValid } from "@/lib/storage";
import { toast } from "react-toastify";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiFilter,
  FiSearch,
  FiDatabase,
  FiFileText,
  FiChevronDown,
  FiChevronUp,
  FiPlay,
  FiStopCircle,
  FiCircle,
} from "react-icons/fi";
import {
  applyLotMapping,
  createLotNumberMappings,
  createTransaction,
  expandReferences,
  fetchNewTransaction,
  fetchSublist,
  fetchSublistItem,
  getInternalID,
  getLotMapping,
  getLotNumbers,
  getUnitMapping,
  processInventoryItems,
  transformTransaction,
  updateTransaction,
} from "@/lib/utils";

// Mock data service
const fetchMigrationData = async () => {
  try {
    const accountID = "5319757";
    const oldSession = getSession("old");
    console.log("fetchMigrationData oldSession", oldSession);

    if (!oldSession?.token) {
      throw new Error("No valid session token found");
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/transaction`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accountID, token: oldSession.token }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json(); // Await the JSON parsing
    console.log("fetchMigrationData Response: ", data);
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format");
    }
    // Transform transaction types to user-friendly names
    const transactions = Array.isArray(data.transactions)
      ? data.transactions.map((trx) => ({
          ...trx,
          type: trx.type || "unknown",
        }))
      : [];

    // Transform statistics to use friendly names
    const statistics = {
      ...data.statistics,
      byType: Object.fromEntries(
        Object.entries(data.statistics.byType).map(([type, count]) => [
          type,
          count,
        ])
      ),
    };

    return {
      statistics,
      transactions,
      total: data.total,
    };
    // return new Promise((resolve) => {
    //   setTimeout(() => {
    //     resolve({
    //       statistics: {
    //         totalTransactions: 12450,
    //         processed: 8420,
    //         remaining: 4030,
    //         successRate: 98.7,
    //         byType: {
    //           salesOrders: 4520,
    //           invoices: 2870,
    //           purchases: 1860,
    //           creditMemos: 920,
    //           others: 1280,
    //         },
    //       },
    //       transactions: [
    //         {
    //           id: "TRX-1001",
    //           oldId: "OLD-78901",
    //           newId: "NEW-45601",
    //           type: "Sales Order",
    //           date: "2020-01-15",
    //           entity: "John Doe Inc.",
    //           amount: 2450.75,
    //           status: "completed",
    //           steps: {
    //             fetch: {
    //               status: "completed",
    //               timestamp: "2020-01-15 09:30:22",
    //             },
    //             create: {
    //               status: "completed",
    //               timestamp: "2020-01-15 09:32:45",
    //             },
    //             relate: {
    //               status: "completed",
    //               timestamp: "2020-01-15 09:35:18",
    //             },
    //             compare: {
    //               status: "completed",
    //               timestamp: "2020-01-15 09:38:02",
    //               mismatches: 2,
    //             },
    //           },
    //           details: {
    //             createdFrom: "Quote-QT-789",
    //             relatedRecords: [
    //               { id: "INV-1001", type: "Invoice", status: "linked" },
    //               { id: "FUL-1001", type: "Fulfillment", status: "linked" },
    //             ],
    //             files: 3,
    //             fields: [
    //               {
    //                 name: "Amount",
    //                 oldValue: "2450.75",
    //                 newValue: "2450.75",
    //                 status: "match",
    //               },
    //               {
    //                 name: "Customer",
    //                 oldValue: "John Doe Inc.",
    //                 newValue: "John Doe Inc.",
    //                 status: "match",
    //               },
    //               {
    //                 name: "Item",
    //                 oldValue: "SKU-1001",
    //                 newValue: "SKU-1001",
    //                 status: "match",
    //               },
    //               {
    //                 name: "Quantity",
    //                 oldValue: "10",
    //                 newValue: "8",
    //                 status: "mismatch",
    //               },
    //               {
    //                 name: "Discount",
    //                 oldValue: "5%",
    //                 newValue: "0%",
    //                 status: "mismatch",
    //               },
    //             ],
    //           },
    //         },
    //         {
    //           id: "TRX-1002",
    //           oldId: "OLD-78902",
    //           newId: "NEW-45602",
    //           type: "Invoice",
    //           date: "2020-01-15",
    //           entity: "Smith & Co.",
    //           amount: 1200.5,
    //           status: "in-progress",
    //           steps: {
    //             fetch: {
    //               status: "completed",
    //               timestamp: "2020-01-15 10:15:33",
    //             },
    //             create: {
    //               status: "completed",
    //               timestamp: "2020-01-15 10:18:21",
    //             },
    //             relate: { status: "pending", timestamp: "" },
    //             compare: { status: "pending", timestamp: "", mismatches: 0 },
    //           },
    //           details: {
    //             createdFrom: "Sales Order-SO-1002",
    //             relatedRecords: [
    //               { id: "PAY-1002", type: "Payment", status: "pending" },
    //             ],
    //             files: 1,
    //             fields: [],
    //           },
    //         },
    //       ],
    //     });
    //   }, 800);
    // });
  } catch (error) {
    console.error("Error in fetchMigrationData:", error);
    return {
      statistics: getDefaultStatistics(),
      transactions: [],
      total: 0,
      error: error.message,
    };
  }
};
// Default statistics when no data is available
function getDefaultStatistics() {
  return {
    totalTransactions: 0,
    processed: 0,
    remaining: 0,
    successRate: 0,
    byType: {},
  };
}

const StatusBadge = ({ status }) => {
  let bgColor = "";
  let text = "";

  switch (status) {
    case "completed":
      bgColor = "bg-green-100 text-green-800";
      text = "Completed";
      break;
    case "in-progress":
      bgColor = "bg-blue-100 text-blue-800";
      text = "In Progress";
      break;
    case "pending":
      bgColor = "bg-yellow-100 text-yellow-800";
      text = "Pending";
      break;
    case "failed":
      bgColor = "bg-red-100 text-red-800";
      text = "Failed";
      break;
    default:
      bgColor = "bg-gray-100 text-gray-800";
      text = "Unknown";
  }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
      {text}
    </span>
  );
};

const StepIcon = ({ step, status }) => {
  let icon;
  let color;
  let tooltip = `${step}: ${status}`;

  switch (status) {
    case "completed":
      icon = <FiCheckCircle className="text-green-500" />;
      break;
    case "completed-with-issues":
      icon = <FiAlertCircle className="text-yellow-500" />;
      tooltip = `${step}: completed with issues`;
      break;
    case "in-progress":
      icon = <FiRefreshCw className="animate-spin text-blue-500" />;
      break;
    case "error":
      icon = <FiAlertCircle className="text-red-500" />;
      break;
    default:
      icon = <FiCircle className="text-gray-400" />;
  }

  return (
    <div className="relative group">
      {icon}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2">
        {tooltip}
      </div>
    </div>
  );
};

export default function DashboardOverview() {
  const [migrationData, setMigrationData] = useState({
    statistics: getDefaultStatistics(),
    transactions: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [expandedTransaction, setExpandedTransaction] = useState(null);
  const [filters, setFilters] = useState({
    status: "all",
    type: "all",
    search: "",
  });
  const [error, setError] = useState(null);
  const [transactionDetails, setTransactionDetails] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const oldSession = getSession("old");
  const newSession = getSession("new");
  const isOldConnected = isSessionValid(oldSession) && oldSession.token;
  const isNewConnected = isSessionValid(newSession) && newSession.token;

  const loadMigrationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMigrationData();
      setMigrationData(data);
      if (data.error) {
        setError(data.error);
      }
    } catch (error) {
      setError(err.message);
      console.error("Failed to load migration data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOldConnected && isNewConnected) {
      loadMigrationData();
    }
  }, [isOldConnected, isNewConnected]);

  const toggleTransactionDetails = async (trx) => {
    if (expandedTransaction === trx.id) {
      setExpandedTransaction(null);
    } else {
      setExpandedTransaction(trx.id);

      // If we haven't fetched details for this transaction yet, fetch them
      if (!transactionDetails[trx.id]) {
        try {
          await fetchTransaction(trx.id, trx.type);
        } catch (error) {
          console.error("Failed to fetch transaction details:", error);
        }
      }
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const filteredTransactions = migrationData?.transactions.filter((trx) => {
    const matchesStatus =
      filters.status === "all" || trx.status === filters.status;
    const matchesType = filters.type === "all" || trx.type === filters.type;
    const matchesSearch =
      filters.search === "" ||
      trx.id.toLowerCase().includes(filters.search.toLowerCase()) ||
      (trx.entity &&
        trx.entity.toLowerCase().includes(filters.search.toLowerCase()));

    return matchesStatus && matchesType && matchesSearch;
  });

  const RECORDS = {
    InvAdjst: "inventory-adjustment",
    TrnfrOrd: "transfer-order",
    InvTrnfr: "inventory-transfer",
    CustInvc: "invoice",
    Journal: "journal",
    CustPymt: "customer-payment",
    RtnAuth: "return-authorization",
    Check: "bank-check",
    Deposit: "deposit",
    ItemRcpt: "item-receipt",
    CustCred: "credit-memo",
  };
  const RECORDS_TYPE = {
    InvAdjst: "inventoryAdjustment",
    TrnfrOrd: "transferOrder",
    InvTrnfr: "inventoryTransfer",
    CustInvc: "invoice",
    Journal: "journalEntry",
    CustPymt: "customerPayment",
    RtnAuth: "returnAuthorization",
    Check: "check",
    Deposit: "deposit",
    ItemRcpt: "itemReceipt",
    CustCred: "creditMemo",
  };

  const fetchTransaction = async (internalId, recordType) => {
    try {
      const accountID = "5319757";
      const oldSession = getSession("old");
      console.log("fetchMigrationData oldSession", oldSession);

      if (!oldSession?.token) {
        throw new Error("No valid session token found");
      }

      const sublists = [];
      // Get lot mapping if we have new credentials
      let lotMapping = {};
      if (recordType == "InvAdjst" || recordType == "InvTrnfr") {
        sublists.push("inventory");
      } else if (
        recordType == "TrnfrOrd" ||
        recordType == "CustInvc" ||
        recordType == "RtnAuth" ||
        recordType == "ItemRcpt" ||
        recordType == "CustCred"
      ) {
        sublists.push("item");
      } else if (recordType == "CustPymt") {
        sublists.push("apply", "credit");
      } else if (recordType == "Journal") {
        sublists.push("line");
      } else if (recordType == "Check") {
        sublists.push("expense");
      } else if (recordType == "Deposit") {
        sublists.push("cashback");
        sublists.push("other");
        sublists.push("payment");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/transaction/${RECORDS[recordType]}/fetch-record`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: accountID,
            token: oldSession.token,
            internalId: internalId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process transaction");
      }
      const record = await response.json();
      console.log("[Record UI] data: ", record);
      // Fetch Items
      for (let i = 0; i < sublists.length; i++) {
        const sublistName = sublists[i];
        if (record[sublistName]?.links) {
          console.log("Found inventory links, proceeding to fetch sublist");
          const sublistUrl = record[sublistName].links.find(
            (l) => l.rel === "self"
          )?.href;
          console.log("Sublist Url", sublistUrl);
          if (sublistUrl) {
            const items = await fetchSublistItem(
              accountID,
              oldSession.token,
              sublistUrl,
              RECORDS[recordType]
            );

            console.log("2. [Record UI] items: ", items.items);

            record[sublistName].items = await processInventoryItems(
              accountID,
              oldSession.token,
              items.items,
              RECORDS[recordType]
            ); // item-receipt
          }
        }

        try {
          // Check if we have inventory details
          const hasInventoryDetails = record[sublistName]?.items?.some(
            (item) => item.inventoryDetail
          );

          if (hasInventoryDetails) {
            lotMapping = await getLotMapping(accountID, oldSession.token);
            console.log("lotMapping", lotMapping);
          }
        } catch (error) {
          console.error(
            "Failed to get lot mapping, proceeding without it:",
            error
          );
        }
      }

      const expandedRecord = await expandReferences(
        accountID,
        oldSession.token,
        record,
        RECORDS[recordType]
      );
      console.log("lotMapping: ", lotMapping);
      // Apply lot mapping to inventory details
      if (Object.keys(lotMapping).length > 0) {
        const lotNumbers = await getLotNumbers(
          accountID,
          oldSession.token,
          internalId
        );
        console.log("lotNumbers : ", JSON.stringify(lotNumbers, null, 2));
        applyLotMapping(expandedRecord, lotMapping, lotNumbers, recordType);
      }

      // Update transaction details with old data
      setTransactionDetails((prev) => ({
        ...prev,
        [internalId]: {
          ...prev[internalId],
          oldData: expandedRecord,
          steps: {
            ...prev[internalId]?.steps,
            fetch: { status: "completed", timestamp: new Date() },
          },
        },
      }));

      console.log("Final Record Data ", expandedRecord);
      console.log(
        "#### Created From Transaction ####",
        expandedRecord?.createdFrom
      );
      return expandedRecord;
    } catch (error) {
      console.error("Fetching error:", error);
      if (error.name === "AbortError") {
        error.message =
          "Request took too long to complete. The transaction is being processed with many items.";
      }
      // Update transaction details with error
      setTransactionDetails((prev) => ({
        ...prev,
        [internalId]: {
          ...prev[internalId],
          steps: {
            ...prev[internalId]?.steps,
            fetch: {
              status: "error",
              error: error.message,
              timestamp: new Date(),
            },
          },
        },
      }));
      throw error;
    }
  };

  const compareTransactions = (oldData, newData) => {
    if (!oldData || !newData) return [];

    const fieldsToCompare = [
      { key: "tranId", label: "Transaction ID" },
      { key: "tranDate", label: "Date" },
      { key: "memo", label: "Memo" },
      { key: "estimatedTotalValue", label: "Total Value" },
      { key: "subsidiary.refName", label: "Subsidiary" },
      { key: "location.refName", label: "Location" },
    ];

    return fieldsToCompare.map((field) => {
      let oldValue = getNestedValue(oldData, field.key);
      let newValue = getNestedValue(newData, field.key);

      // Format values for display
      if (field.key === "estimatedTotalValue") {
        oldValue = oldValue ? `$${parseFloat(oldValue).toFixed(2)}` : "";
        newValue = newValue ? `$${parseFloat(newValue).toFixed(2)}` : "";
      }

      return {
        name: field.label,
        oldValue: oldValue || "N/A",
        newValue: newValue || "N/A",
        status: oldValue === newValue ? "match" : "mismatch",
      };
    });
  };

  const getNestedValue = (obj, path) => {
    return path.split(".").reduce((acc, part) => acc && acc[part], obj);
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const processTransaction = async (transactionData, recordType) => {
    var transactionId = transactionData.id;
    if (!transactionId) {
      throw new Error("No transaction ID provided");
    }

    setIsProcessing(true);
    setProcessingId(transactionId);
    try {
      console.log("Starting transaction processing...");
      const newAccountID = "11661334-sb1";
      const newSession = getSession("new");
      const oldAccountID = "5319757";
      const oldSession = getSession("old");

      if (!newSession?.token) {
        throw new Error("Not connected to new instance");
      }
      if (!oldSession?.token) {
        throw new Error("Not connected to old instance");
      }
      const oldToken = oldSession?.token;
      const newToken = newSession?.token;

      // Get transaction data if not already fetched
      let transactionData = transactionDetails[transactionId]?.oldData;
      if (!transactionData) {
        transactionData = await fetchTransaction(transactionId, recordType);
      }

      await delay(1000);

      // Step 1: get Unit Mapping
      const unitMapping = await getUnitMapping(oldAccountID, oldToken);
      console.log("unitMapping", unitMapping);

      await delay(1000);

      // Step 2 : get Lot Numbers (Old System)
      const lotNumbers = await getLotNumbers(
        oldAccountID,
        oldToken,
        transactionId
      );
      console.log("lotNumbers", lotNumbers);

      await delay(1000);
      try {
        let createdTransactionURL;
        if (transactionData?.createdFrom && transactionData?.createdFrom?.id) {
          console.log(
            "#### Created From Transaction ####",
            transactionData?.createdFrom
          );
          if (transactionData?.orderId && transactionData?.orderType) {
            var orderUrl = `https://${oldAccountID}.suitetalk.api.netsuite.com/services/rest/record/v1/${
              RECORDS_TYPE[transactionData?.orderType]
            }/${transactionData?.orderId}`;
            var orderData = await fetchSublistItem(
              oldAccountID,
              oldToken,
              orderUrl,
              transactionData?.orderType
            );
            console.log("CreatedFrom Data: ", orderData);
            var orderNewId = orderData.custbody_mig_new_internal_id;
            console.log("CreatedFrom Data New Id: ", orderNewId);

            var url = `https://${newAccountID}.suitetalk.api.netsuite.com/services/rest/record/v1/${
              RECORDS_TYPE[transactionData?.orderType]
            }/${orderNewId}/!transform/${RECORDS_TYPE[recordType]}`;
            console.log("Transform URL: ", url);

            // Step 3 : Create New Transaction
            createdTransactionURL = await transformTransaction(
              oldAccountID,
              oldToken,
              newAccountID,
              newToken,
              recordType,
              RECORDS_TYPE[recordType],
              transactionData,
              unitMapping,
              lotNumbers,
              url
            );
          }
        } else {
          // Step 3 : Create New Transaction
          createdTransactionURL = await createTransaction(
            oldAccountID,
            oldToken,
            newAccountID,
            newToken,
            recordType,
            RECORDS_TYPE[recordType],
            transactionData,
            unitMapping,
            lotNumbers
          );
        }
        console.log("createTransaction URL", createdTransactionURL.jobUrl);
        console.log("MSG: ", createdTransactionURL.message);

        const createdTransactionId = await getInternalID(
          createdTransactionURL.jobUrl,
          newToken,
          RECORDS_TYPE[recordType]
        );
        console.log("createTransaction ID", createdTransactionId);

        // Update step status
        setTransactionDetails((prev) => ({
          ...prev,
          [transactionId]: {
            ...prev[transactionId],
            steps: {
              ...prev[transactionId]?.steps,
              create: { status: "completed", timestamp: new Date() },
            },
          },
        }));
        await delay(1000);

        // Step 4 : Ftech New Transaction

        const newTransaction = await fetchNewTransaction(
          recordType,
          newAccountID,
          newToken,
          createdTransactionId.internalId
        );
        console.log("newTransaction Data", newTransaction);
        if (newTransaction) {
          // Update transaction details with new data
          setTransactionDetails((prev) => ({
            ...prev,
            [transactionId]: {
              ...prev[transactionId],
              newData: newTransaction,
              steps: {
                ...prev[transactionId]?.steps,
                relate: { status: "completed", timestamp: new Date() },
              },
            },
          }));
        } else {
          // Update transaction details with error
          setTransactionDetails((prev) => ({
            ...prev,
            [transactionId]: {
              ...prev[transactionId],
              steps: {
                ...prev[transactionId]?.steps,
                relate: {
                  status: "error",
                  error: "ERROR ERROR",
                  timestamp: new Date(),
                },
              },
            },
          }));
        }

        const lotNumbersToMap = createdTransactionURL.lotNumbersToMap;
        console.log("lotNumbersToMap: ", lotNumbersToMap);

        await delay(1000);

        // Step 5 : get Lot Numbers (New System)
        const newLotNumbers = await getLotNumbers(
          newAccountID,
          newToken,
          newTransaction.id
        );
        console.log("newLotNumbers", newLotNumbers);

        await delay(1000);

        // Step 6 : create Lot Number Mappings

        if (lotNumbersToMap.length > 0) {
          await createLotNumberMappings(
            oldAccountID,
            oldToken,
            newTransaction,
            lotNumbersToMap,
            newLotNumbers,
            recordType
          );
        }

        console.info(
          "Create Transaction [" + transactionData.tranId + "] Process Done!!"
        );

        // Step 7 : Update the New ID in the Old Transaction
        var updatedTransaction = await updateTransaction(
          oldAccountID,
          oldToken,
          recordType,
          RECORDS_TYPE[recordType],
          transactionId,
          newTransaction
        );

        // const updatedTransactionId = await getInternalID(
        //   updatedTransaction.jobUrl,
        //   oldToken,
        //   RECORDS_TYPE[recordType]
        // );
        console.log("Updated Transaction ID", updatedTransaction);

        // Step 8: Compare transactions
        const comparisonResults = compareTransactions(
          transactionData,
          newTransaction
        );
        setTransactionDetails((prev) => ({
          ...prev,
          [transactionId]: {
            ...prev[transactionId],
            comparison: comparisonResults,
            steps: {
              ...prev[transactionId]?.steps,
              compare: {
                status: comparisonResults.every((r) => r.status === "match")
                  ? "completed"
                  : "completed-with-issues",
                timestamp: new Date(),
                results: comparisonResults,
              },
            },
          },
        }));
      } catch (error) {
        try {
          const errorDetails = JSON.parse(error.message);
          if (errorDetails.isInventoryError) {
            // Extract the available quantity from the error message
            const errorMessage =
              errorDetails.details["o:errorDetails"][0].detail;

            // Pattern 1: "You only have X available"
            const availableMatch = errorMessage.match(
              /You only have (\d+) available/
            );
            // Pattern 2: "Inventory numbers are not available" with details
            const negativeInventoryMatch = errorMessage.match(
              /Item:(\d+), Number:([^,]+), Quantity:(\d+), On Hand:(-?\d+), Committed:/
            );

            // Pattern 3: "You cannot create an inventory detail for this item"
            const inventoryDetailError = errorMessage.includes(
              "You cannot create an inventory detail for this item"
            );

            // Pattern 4: "Please enter value(s) for: Serial/Lot Number."
            const inventoryAsseignNotExist = errorMessage.includes(
              "Please enter value(s) for: Serial/Lot Number."
            );

            if (availableMatch) {
              const availableQty = parseInt(availableMatch[1]);
              console.log(
                `Inventory quantity error: ${availableQty} available`
              );
              // Call your function to handle inventory adjustment
              await handleInventoryAdjustment(
                transactionData,
                availableQty,
                errorDetails.details["o:errorDetails"][0]["o:errorPath"],
                unitMapping,
                lotNumbers,
                oldAccountID,
                oldToken,
                newAccountID,
                newToken
              );

              // Update step status to indicate inventory adjustment was handled
              setTransactionDetails((prev) => ({
                ...prev,
                [transactionId]: {
                  ...prev[transactionId],
                  steps: {
                    ...prev[transactionId]?.steps,
                    create: {
                      status: "inventory-adjusted",
                      message:
                        "Inventory adjustment was created to resolve quantity issues",
                      timestamp: new Date(),
                    },
                  },
                },
              }));

              // Optionally retry the transaction or take other action
              return; // Exit early since we're handling this specially
            } else if (negativeInventoryMatch) {
              // Handle the new negative inventory pattern
              const itemId = negativeInventoryMatch[1];
              const lotNumber = negativeInventoryMatch[2];
              const requestedQty = parseInt(negativeInventoryMatch[3]);
              console.log(
                `Negative inventory for Item [${itemId}] error: Requested ${requestedQty} for Lot Number [${lotNumber}]`
              );

              let sublist_name;

              if (transactionData?.inventory) {
                sublist_name = "inventory";
              } else {
                sublist_name = "item";
              }

              // Find the item in transactionData
              const foundItem = transactionData[sublist_name].items.find(
                (item) =>
                  item.item.refName.includes(itemId) || item.item.id == itemId
              );

              if (!foundItem) {
                throw new Error(
                  `Item with ID ${itemId} not found in transaction data`
                );
              }
              // Get the new item ID
              const newItemId = foundItem.item.new_id;

              const newItemName = foundItem.item.refName;
              console.log(
                `Found item: ${foundItem.item.refName}, New ID: ${newItemId}`
              );

              // Find the lot in inventory assignments
              let oldLotId = null;
              let newLotId = null;
              let newLotName = null;
              let locationId = null;
              let locationName = null;
              if (
                foundItem.inventoryDetail &&
                foundItem.inventoryDetail.inventoryAssignment
              ) {
                const foundLot =
                  foundItem.inventoryDetail.inventoryAssignment.items.find(
                    (lot) => lot.issueInventoryNumber.refName == lotNumber
                  );
                if (foundLot) {
                  oldLotId = foundLot.old_id;
                  newLotId = foundLot.new_id;
                  newLotName = foundLot.refName;
                  console.log(`Found lot: ${lotNumber}, New ID: ${newLotId}`);
                }
                locationId = foundItem.inventoryDetail.location.new_id;
                locationName = foundItem.inventoryDetail.location.refName;
              }
              const adjustmentQty = requestedQty;
              // Call function to create inventory adjustment

              await handleNegativeInventoryAdjustment(
                transactionData,
                foundItem,
                newItemId,
                newItemName,
                oldLotId,
                newLotId,
                newLotName,
                locationId,
                locationName,
                adjustmentQty,
                unitMapping,
                lotNumbers,
                oldAccountID,
                oldToken,
                newAccountID,
                newToken
              );
            } else if (inventoryDetailError) {
              // Handle pattern 3: Create inventory adjustment for this item
              console.log(
                "Inventory detail not allowed for this item, creating inventory adjustment"
              );

              // Extract the index from the error path
              const errorPath =
                errorDetails.details["o:errorDetails"][0]["o:errorPath"];
              const indexMatch = errorPath.match(/item\.items\[(\d+)\]/);

              if (indexMatch) {
                const itemIndex = parseInt(indexMatch[1]);

                // Get the problematic item from transaction data
                const problemItem = transactionData.item.items[itemIndex];
                if (!problemItem || !problemItem.inventoryDetail) {
                  throw new Error("Could not find item with inventory detail");
                }

                // Extract necessary information for inventory adjustment
                const itemId = problemItem.item.new_id;
                const itemName = problemItem.item.refName;
                const locationId = problemItem.inventoryDetail.location.new_id;
                const locationName =
                  problemItem.inventoryDetail.location.refName;
                const quantity = problemItem.inventoryDetail.quantity;

                // Extract lot information if available
                let lotId = null;
                let lotName = null;

                if (
                  problemItem.inventoryDetail.inventoryAssignment &&
                  problemItem.inventoryDetail.inventoryAssignment.items.length >
                    0
                ) {
                  const lotAssignment =
                    problemItem.inventoryDetail.inventoryAssignment.items[0];
                  lotId = lotAssignment.issueInventoryNumber.new_id;
                  lotName = lotAssignment.issueInventoryNumber.refName;
                }

                console.log(
                  `Creating inventory adjustment for item ${itemId}, Location ${locationId}, quantity: ${quantity}`
                );
              }
            } else if (inventoryAsseignNotExist) {
              console.log(
                "Inventory Asseigment doesn't exist for this item, creating inventory adjustment"
              );
              const errorPath =
                errorDetails.details["o:errorDetails"][0]["o:errorPath"];
              const indexMatch = errorPath.match(/inventory\.items\[(\d+)\]/);
              if (indexMatch) {
                const itemIndex = parseInt(indexMatch[1]);
                // Get the problematic item from transaction data
                const problemItem = transactionData.inventory.items[itemIndex];
                if (!problemItem || !problemItem.inventoryDetail) {
                  throw new Error("Could not find item with inventory detail");
                }
                // Extract necessary information for inventory adjustment
                const itemId = problemItem.item.new_id;
                const itemName = problemItem.item.refName;
                const locationId = problemItem.inventoryDetail.location.new_id;
                const locationName =
                  problemItem.inventoryDetail.location.refName;
                const quantity = problemItem.inventoryDetail.quantity;

                // Extract lot information if available
                let lotId = null;
                let lotName = null;

                if (
                  problemItem.inventoryDetail.inventoryAssignment &&
                  problemItem.inventoryDetail.inventoryAssignment.items.length >
                    0
                ) {
                  const lotAssignment =
                    problemItem.inventoryDetail.inventoryAssignment.items[0];
                  lotId = lotAssignment.issueInventoryNumber.id;
                  lotName = lotAssignment.issueInventoryNumber.refName;
                  console.log("Handle Lot Not Exist Data : ", {
                    transactionData,
                    problemItem,
                    itemId,
                    itemName,
                    lotId,
                    lotName,
                    locationId,
                    locationName,
                    quantity,
                    unitMapping,
                    lotNumbers,
                  });
                  await handleLotNotExist(
                    transactionData,
                    problemItem,
                    itemId,
                    itemName,
                    lotId,
                    lotName,
                    locationId,
                    locationName,
                    quantity,
                    unitMapping,
                    lotNumbers,
                    oldAccountID,
                    oldToken,
                    newAccountID,
                    newToken
                  );
                }
              }
            }
          }
          // If not an inventory error, rethrow
          throw error;
        } catch (parseError) {
          console.error("parseError: ", parseError);
          // If we can't parse the error, just rethrow the original
          throw error;
        }
      }
    } catch (error) {
      console.error("Processing error:", error);
      // Update step status with error
      setTransactionDetails((prev) => ({
        ...prev,
        [transactionId]: {
          ...prev[transactionId],
          steps: {
            ...prev[transactionId]?.steps,
            create: {
              status: "error",
              error: error.message,
              timestamp: new Date(),
            },
          },
        },
      }));
      throw error;
    } finally {
      setIsProcessing(false);
      setProcessingId(null);
    }
  };

  const handleInventoryAdjustment = async (
    transactionData,
    availableQty,
    errorPath,
    unitMapping,
    lotNumbers,
    oldAccountID,
    oldToken,
    newAccountID,
    newToken
  ) => {
    try {
      console.log("Handling inventory adjustment:", availableQty, errorPath);

      // Parse the error path to extract the item index and assignment ID
      const itemMatch = errorPath.match(/item\.items\[(\d+)\]/);
      const assignmentMatch = errorPath.match(/internalId==(\d+)/);

      const itemIndex = itemMatch ? parseInt(itemMatch[1]) : 0;
      const assignmentId = assignmentMatch
        ? parseInt(assignmentMatch[1])
        : null;

      // Get the specific item from the transaction data
      const item = transactionData.item.items[itemIndex];

      if (
        !item ||
        !item.inventoryDetail ||
        !item.inventoryDetail.inventoryAssignment
      ) {
        console.error("Could not find inventory details for the item");
        return;
      }

      // Find the specific inventory assignment
      const assignment = item.inventoryDetail.inventoryAssignment.items.find(
        (a) => a.new_id == assignmentId
      );

      if (!assignment) {
        console.error("Could not find the specific inventory assignment");
        return;
      }

      // Extract the needed information
      const quantityNeeded = assignment.quantity;
      const assignmentName = assignment.refName;
      const shortfall = quantityNeeded - availableQty;
      const itemId = item.item.new_id;
      const itemBaseUnit = item.item.baseunit;
      const itemName = item.item.refName;
      const locationId = item.inventoryDetail.location
        ? item.inventoryDetail.location.new_id
        : null;
      const locationName = item.inventoryDetail.location
        ? item.inventoryDetail.location.refName
        : null;

      console.log("Inventory adjustment details:", {
        itemId,
        itemName,
        assignmentId,
        quantityNeeded,
        availableQty,
        shortfall,
        locationId,
      });

      var invAdjustData = {
        externalId: `IANEW-${itemId}-${assignmentId}`,
        tranId: `IANEW-${itemId}-${assignmentId}`,
        tranDate: transactionData.tranDate,
        memo: `معالجة مخزون الصنف ${itemId} \n رقم الفاتورة ${transactionData.tranId} \n رقم التاكيد ${assignmentId} \n بكمية ${shortfall}`,
        subsidiary: {
          new_id: transactionData.subsidiary.new_id,
        },
        account: {
          new_id: "3843",
        },
        adjLocation: {
          id: locationId,
          refName: locationName,
          new_id: locationId,
        },
        inventory: {
          items: [
            {
              item: {
                new_id: itemId,
                units: itemBaseUnit,
              },
              location: {
                new_id: locationId,
              },
              adjustQtyBy: shortfall,
              // unitCost: 48.68,
              description: itemName,
              memo: `معالجة مخزون الصنف ${itemId} \n رقم الفاتورة ${transactionData.tranId} \n رقم التاكيد ${assignmentId} \n بكمية ${shortfall}`,
              units: item.units,
              inventoryDetail: {
                inventoryAssignment: {
                  items: [
                    {
                      internalId: assignmentId,
                      quantity: shortfall,
                      receiptInventoryNumber: assignmentName,
                      new_id: assignmentId,
                    },
                  ],
                },
                itemDescription: itemName,
                quantity: shortfall,
                unit: itemBaseUnit,
              },
            },
          ],
        },
      };
      console.log("INVAdjust Data: ", invAdjustData);

      const createdTransactionURL = await createTransaction(
        oldAccountID,
        oldToken,
        newAccountID,
        newToken,
        "InvAdjst",
        RECORDS_TYPE["InvAdjst"],
        invAdjustData,
        unitMapping,
        lotNumbers
      );
      console.log(
        "create InvAdjst Transaction URL",
        createdTransactionURL.jobUrl
      );
      console.log("MSG InvAdjst: ", createdTransactionURL.message);

      const createdTransactionId = await getInternalID(
        createdTransactionURL.jobUrl,
        newToken,
        RECORDS_TYPE["InvAdjst"]
      );
      console.log("create InvAdjst Transactio ID", createdTransactionId);
      return { success: true, adjustmentId: createdTransactionId.internalId };
    } catch (error) {
      console.error("Handle Inventory Adjustment ERROR: ", error);
      throw new Error(`Inventory adjustment failed: ${error.message}`);
    }
  };
  async function handleNegativeInventoryAdjustment(
    transactionData,
    foundItem,
    newItemId,
    newItemName,
    oldLotId,
    newLotId,
    newLotName,
    locationId,
    locationName,
    adjustmentQty,
    unitMapping,
    lotNumbers,
    oldAccountID,
    oldToken,
    newAccountID,
    newToken
  ) {
    try {
      // Build the inventory adjustment object
      var invAdjustData = {
        externalId: `IANEW-${newItemId}-${newLotId}`,
        tranId: `IANEW-${newItemId}-${newLotId}`,
        tranDate: transactionData.tranDate,
        memo: `معالجة مخزون الصنف ${newItemId} \n رقم الفاتورة ${transactionData.tranId} \n رقم التاكيد ${newLotId} \n بكمية ${adjustmentQty}`,
        subsidiary: {
          new_id: transactionData.subsidiary.new_id,
        },
        account: {
          new_id: "3843",
        },
        adjLocation: {
          id: locationId,
          refName: locationName,
          new_id: locationId,
        },
        inventory: {
          items: [
            {
              item: {
                new_id: newItemId,
              },
              location: {
                new_id: locationId,
              },
              adjustQtyBy: adjustmentQty,
              // unitCost: 48.68,
              description: newItemName,
              memo: `معالجة مخزون الصنف ${newItemId} \n رقم الفاتورة ${transactionData.tranId} \n رقم التاكيد ${newLotId} \n بكمية ${adjustmentQty}`,

              units: foundItem.item.baseunit,
              inventoryDetail: {
                inventoryAssignment: {
                  items: [
                    {
                      internalId: newLotId,
                      quantity: adjustmentQty,
                      receiptInventoryNumber: newLotName,
                      new_id: newLotId,
                    },
                  ],
                },
                itemDescription: newItemName,
                quantity: adjustmentQty,
                unit: foundItem.item.baseunit,
              },
            },
          ],
        },
      };
      console.log("INVAdjust Data: ", invAdjustData);

      const createdTransactionURL = await createTransaction(
        oldAccountID,
        oldToken,
        newAccountID,
        newToken,
        "InvAdjst",
        RECORDS_TYPE["InvAdjst"],
        invAdjustData,
        unitMapping,
        lotNumbers
      );
      console.log(
        "create InvAdjst Transaction URL",
        createdTransactionURL.jobUrl
      );
      console.log("MSG InvAdjst: ", createdTransactionURL.message);
      const createdTransactionId = await getInternalID(
        createdTransactionURL.jobUrl,
        newToken,
        RECORDS_TYPE["InvAdjst"]
      );

      console.log("create InvAdjst Transactio ID", createdTransactionId);
      return { success: true, adjustmentId: createdTransactionId.internalId };
    } catch (error) {
      console.error("Handle Negative Inventory Adjustment ERROR: ", error);
      throw new Error(`Inventory adjustment failed: ${error.message}`);
    }
  }
  async function handleLotNotExist(
    transactionData,
    foundItem,
    newItemId,
    newItemName,
    oldLotId,
    newLotName,
    locationId,
    locationName,
    adjustmentQty,
    unitMapping,
    lotNumbers,
    oldAccountID,
    oldToken,
    newAccountID,
    newToken
  ) {
    try {
      // Build the inventory adjustment object
      var invAdjustData = {
        externalId: `IANEW-${newItemId}-${oldLotId}`,
        tranId: `IANEW-${newItemId}-${oldLotId}`,
        tranDate: transactionData.tranDate,
        memo: `اضافة تاكيد الى مخزون الصنف ${newItemId} \n رقم التحويل المخزني ${transactionData.tranId} \n رقم التاكيد ${oldLotId} \n بكمية ${adjustmentQty}`,
        subsidiary: {
          new_id: transactionData.subsidiary.new_id,
        },
        account: {
          new_id: "3843",
        },
        adjLocation: {
          id: locationId,
          refName: locationName,
          new_id: locationId,
        },
        inventory: {
          items: [
            {
              item: {
                new_id: newItemId,
              },
              location: {
                new_id: locationId,
              },
              adjustQtyBy: adjustmentQty,
              // unitCost: 48.68,
              description: newItemName,
              memo: `اضافة تاكيد الى مخزون الصنف ${newItemId} \n رقم التحويل المخزني ${transactionData.tranId} \n رقم التاكيد ${oldLotId} \n بكمية ${adjustmentQty}`,
              units: foundItem.item.baseunit,
              line: foundItem.line,
              inventoryDetail: {
                inventoryAssignment: {
                  items: [
                    {
                      internalId: oldLotId,
                      quantity: adjustmentQty,
                      receiptInventoryNumber: newLotName,
                    },
                  ],
                },
                itemDescription: newItemName,
                quantity: adjustmentQty,
                unit: foundItem.item.baseunit,
              },
            },
          ],
        },
      };
      console.log("INVAdjust Data: ", invAdjustData);

      const createdTransactionURL = await createTransaction(
        oldAccountID,
        oldToken,
        newAccountID,
        newToken,
        "InvAdjst",
        RECORDS_TYPE["InvAdjst"],
        invAdjustData,
        unitMapping,
        lotNumbers
      );
      console.log(
        "create InvAdjst Transaction URL",
        createdTransactionURL.jobUrl
      );
      console.log("MSG InvAdjst: ", createdTransactionURL.message);
      const createdTransactionId = await getInternalID(
        createdTransactionURL.jobUrl,
        newToken,
        RECORDS_TYPE["InvAdjst"]
      );

      console.log("create InvAdjst Transactio ID", createdTransactionId);
      const newTransaction = await fetchNewTransaction(
        "InvAdjst",
        newAccountID,
        newToken,
        createdTransactionId.internalId
      );
      console.log("newTransaction InvAdjst Data", newTransaction);

      const lotNumbersToMap = createdTransactionURL.lotNumbersToMap;
      console.log("lotNumbersToMap InvAdjst:  ", lotNumbersToMap);

      const newLotNumbers = await getLotNumbers(
        newAccountID,
        newToken,
        newTransaction.id
      );
      console.log("newLotNumbers InvAdjst: ", newLotNumbers);

      if (lotNumbersToMap.length > 0) {
        await createLotNumberMappings(
          oldAccountID,
          oldToken,
          newTransaction,
          lotNumbersToMap,
          newLotNumbers,
          "InvAdjst"
        );
      }

      console.info(
        "Create InvAdjst Transaction [" +
          newTransaction.tranId +
          "] Process Done!!"
      );

      return { success: true, adjustmentId: createdTransactionId.internalId };
    } catch (error) {
      console.error("Handle No Lot Number Exist ERROR: ", error);
      throw new Error(
        `No Lot Number Exist,  Inventory adjustment failed: ${error.message}`
      );
    }
  }

  return (
    <div className="max-w-6xl mx-auto text-black">
      {/* Connection Status */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-semibold mb-4">Instance Connections</h2>
          <button
            onClick={loadMigrationData}
            disabled={loading}
            className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md"
          >
            <FiRefreshCw className={`mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh Data
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div
            className={`border rounded-lg p-4 ${
              isOldConnected
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-center mb-2">
              <h3 className="font-medium">Source Instance (Old)</h3>
              {isOldConnected ? (
                <FiCheckCircle className="ml-2 text-green-500" />
              ) : (
                <FiAlertCircle className="ml-2 text-red-500" />
              )}
            </div>
            <p className="text-sm text-gray-600">
              {isOldConnected
                ? `Connected to ${oldSession.account}`
                : "Not connected. Please connect from the home page."}
            </p>
          </div>

          <div
            className={`border rounded-lg p-4 ${
              isNewConnected
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-center mb-2">
              <h3 className="font-medium">Target Instance (New)</h3>
              {isNewConnected ? (
                <FiCheckCircle className="ml-2 text-green-500" />
              ) : (
                <FiAlertCircle className="ml-2 text-red-500" />
              )}
            </div>
            <p className="text-sm text-gray-600">
              {isNewConnected
                ? `Connected to ${newSession.account}`
                : "Not connected. Please connect from the home page."}
            </p>
          </div>
        </div>
      </div>

      {/* Migration Statistics */}
      {migrationData && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Migration Statistics</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {(
                  migrationData.statistics.totalTransactions || 0
                ).toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">Total Transactions</p>
            </div>

            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {migrationData.statistics.processed}
              </div>
              <p className="text-sm text-gray-600">Processed</p>
            </div>

            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 mb-1">
                {migrationData.statistics.remaining}
              </div>
              <p className="text-sm text-gray-600">Remaining</p>
            </div>

            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {migrationData.statistics.successRate}%
              </div>
              <p className="text-sm text-gray-600">Success Rate</p>
            </div>

            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-teal-600 mb-1">
                {Math.round(
                  (migrationData.statistics.processed /
                    migrationData.statistics.totalTransactions) *
                    100
                )}
                %
              </div>
              <p className="text-sm text-gray-600">Completion</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-medium mb-3">Transactions by Type</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(migrationData.statistics.byType || {}).map(
                ([type, count]) => (
                  <div key={type} className="border rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-blue-600 mb-1">
                      {count.toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600 capitalize">{type}</p>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{
                width: `${
                  (migrationData.statistics.processed /
                    migrationData.statistics.totalTransactions) *
                  100
                }%`,
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Transaction Processing */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
          <h2 className="text-xl font-semibold mb-4 md:mb-0">
            Transaction Processing
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full border rounded-md pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="in-progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="failed">Needs Attention</option>
              </select>
              <FiFilter className="absolute right-3 top-2.5 text-gray-400" />
            </div>

            <div className="relative">
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                className="w-full border rounded-md pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="Sales Order">Sales Orders</option>
                <option value="Invoice">Invoices</option>
                <option value="Purchase">Purchases</option>
                <option value="Credit Memo">Credit Memos</option>
                <option value="others">Others</option>
              </select>
              <FiFilter className="absolute right-3 top-2.5 text-gray-400" />
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search transactions..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="w-full border rounded-md pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute right-3 top-2.5 text-gray-400" />
            </div>

            <button
              onClick={() =>
                setFilters({ status: "all", type: "all", search: "" })
              }
              className="w-full bg-gray-100 hover:bg-gray-200 py-2 px-3 rounded-md text-sm"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <FiRefreshCw className="animate-spin mx-auto text-3xl text-blue-500" />
            <p className="mt-3">Loading transaction data...</p>
          </div>
        ) : error ? (
          <div className="text-red-500">Error: {error}</div>
        ) : migrationData ? (
          <div className="border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">
              <div className="col-span-1">Status</div>
              <div className="col-span-2">ID</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Entity</div>
              <div className="col-span-1">Amount</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Actions</div>
              <div className="col-span-2 text-center">Migration Steps</div>
            </div>

            {/* Transaction Rows */}
            <div className="divide-y">
              {filteredTransactions.map((trx) => {
                const details = transactionDetails[trx.id] || {};
                const hasNewId =
                  details.oldData?.custbody_mig_new_internal_id ||
                  trx.custbody_mig_new_internal_id;
                const isCurrentlyProcessing = processingId === trx.id;

                return (
                  <div key={trx.id}>
                    <div
                      className="grid grid-cols-12 gap-2 px-4 py-3 text-sm cursor-pointer hover:bg-blue-50"
                      onClick={() => toggleTransactionDetails(trx)}
                    >
                      <div className="col-span-1 flex items-center">
                        <StatusBadge status={trx.mig_status} />
                      </div>
                      <div className="col-span-2 font-medium">
                        {trx.id} - ${trx.typebaseddocumentnumber}
                      </div>
                      <div className="col-span-2">{trx.type}</div>
                      <div className="col-span-2 truncate">{trx.entity}</div>
                      <div className="col-span-1">${trx.foreigntotal}</div>
                      <div className="col-span-2">{trx.trandate}</div>
                      <div className="col-span-2 flex gap-2">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              console.log("Fetch Transaction Type: ", trx.type);
                              await fetchTransaction(trx.id, trx.type);
                            } catch (error) {
                              console.log(`Fetch failed: ${error.message}`);
                            }
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1 disabled:opacity-70 text-xs"
                          disabled={isProcessing}
                        >
                          <FiDatabase className="text-xs" />
                          Fetch
                        </button>

                        {!hasNewId && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                console.log(
                                  "Process Transaction Type: ",
                                  trx.type
                                );
                                await processTransaction(trx, trx.type);
                              } catch (error) {
                                console.log(
                                  `Processing failed: ${error.message}`
                                );
                              }
                            }}
                            className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-1 disabled:opacity-70 text-xs"
                            disabled={isProcessing || !details.oldData}
                          >
                            {isCurrentlyProcessing ? (
                              <FiRefreshCw className="animate-spin text-xs" />
                            ) : (
                              <FiPlay className="text-xs" />
                            )}
                            {isCurrentlyProcessing ? "Processing" : "Process"}
                          </button>
                        )}

                        {hasNewId && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                console.log(
                                  "View New Transaction: ",
                                  details.oldData.custbody_mig_new_internal_id
                                );
                                console.log("Transaction Type: ", trx.type);
                                console.log(
                                  "Transaction new Token: ",
                                  newSession.token
                                );
                                console.log(
                                  "Transaction new ID: ",
                                  details.oldData.custbody_mig_new_internal_id
                                );

                                const newTransaction =
                                  await fetchNewTransaction(
                                    trx.type,
                                    "11661334-sb1",
                                    newSession.token,
                                    details.oldData.custbody_mig_new_internal_id
                                  );
                                console.log(
                                  "fetchNewTransaction: ",
                                  newTransaction
                                );
                                if (newTransaction) {
                                  // Update transaction details with new data
                                  setTransactionDetails((prev) => ({
                                    ...prev,
                                    [trx.id]: {
                                      ...prev[trx.id],
                                      newData: newTransaction,
                                      steps: {
                                        ...prev[trx.id]?.steps,
                                        relate: {
                                          status: "completed",
                                          timestamp: new Date(),
                                        },
                                      },
                                    },
                                  }));
                                } else {
                                  // Update transaction details with error
                                  setTransactionDetails((prev) => ({
                                    ...prev,
                                    [trx.id]: {
                                      ...prev[trx.id],
                                      steps: {
                                        ...prev[trx.id]?.steps,
                                        relate: {
                                          status: "error",
                                          error: "ERROR ERROR",
                                          timestamp: new Date(),
                                        },
                                      },
                                    },
                                  }));
                                }
                              } catch (error) {
                                console.log(`Fetch failed: ${error.message}`);
                              }
                            }}
                            className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-1 disabled:opacity-70 text-xs"
                            disabled={isProcessing}
                          >
                            <FiDatabase className="text-xs" />
                            View New
                          </button>
                        )}
                      </div>
                      <div className="col-span-2 flex justify-center space-x-1">
                        <StepIcon
                          step="fetch"
                          status={details.steps?.fetch?.status || "pending"}
                        />
                        <StepIcon
                          step="create"
                          status={details.steps?.create?.status || "pending"}
                        />
                        <StepIcon
                          step="relate"
                          status={details.steps?.relate?.status || "pending"}
                        />
                        <StepIcon
                          step="compare"
                          status={details.steps?.compare?.status || "pending"}
                        />
                      </div>
                    </div>

                    {/* Transaction Details */}
                    {expandedTransaction === trx.id && (
                      <div className="bg-gray-50 p-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          {/* IDs */}
                          <div className="border rounded-lg p-4 bg-white">
                            <h4 className="font-medium mb-3">
                              Transaction IDs
                            </h4>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Old ID:</span>
                                <span className="font-medium">{trx.id}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">New ID:</span>
                                <span className="font-medium">
                                  {details.oldData
                                    ?.custbody_mig_new_internal_id ||
                                    "Not created yet"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">
                                  Created From:
                                </span>
                                <span className="font-medium">
                                  {details.oldData?.createdFrom || "N/A"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Status Overview */}
                          <div className="border rounded-lg p-4 bg-white">
                            <h4 className="font-medium mb-3">
                              Migration Status
                            </h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">
                                  Fetch Step:
                                </span>
                                <StatusBadge
                                  status={
                                    details.steps?.fetch?.status || "pending"
                                  }
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">
                                  Create Step:
                                </span>
                                <StatusBadge
                                  status={
                                    details.steps?.create?.status || "pending"
                                  }
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">
                                  Relate Step:
                                </span>
                                <StatusBadge
                                  status={
                                    details.steps?.relate?.status || "pending"
                                  }
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">
                                  Compare Step:
                                </span>
                                <StatusBadge
                                  status={
                                    details.steps?.compare?.status || "pending"
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="border rounded-lg p-4 bg-white">
                            <h4 className="font-medium mb-3">Actions</h4>
                            <div className="space-y-2">
                              <button
                                onClick={() =>
                                  fetchTransaction(trx.id, trx.type)
                                }
                                className="w-full bg-blue-100 text-blue-800 hover:bg-blue-200 py-2 px-3 rounded-md text-sm flex items-center justify-center gap-2"
                              >
                                <FiRefreshCw className="text-xs" />
                                Refresh Old Data
                              </button>

                              {details.oldData
                                ?.custbody_mig_new_internal_id && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const newTransaction =
                                        await fetchNewTransaction(
                                          trx.type,
                                          "11661334-sb1",
                                          newSession.token,
                                          details.oldData
                                            .custbody_mig_new_internal_id
                                        );
                                      if (newTransaction) {
                                        console.log(
                                          "fetchNewTransaction ",
                                          newTransaction
                                        );
                                        // Update transaction details with new data
                                        setTransactionDetails((prev) => ({
                                          ...prev,
                                          [trx.id]: {
                                            ...prev[trx.id],
                                            newData: newTransaction,
                                            steps: {
                                              ...prev[trx.id]?.steps,
                                              relate: {
                                                status: "completed",
                                                timestamp: new Date(),
                                              },
                                            },
                                          },
                                        }));
                                      } else {
                                        // Update transaction details with error
                                        setTransactionDetails((prev) => ({
                                          ...prev,
                                          [trx.id]: {
                                            ...prev[trx.id],
                                            steps: {
                                              ...prev[trx.id]?.steps,
                                              relate: {
                                                status: "error",
                                                error: "ERROR ERROR",
                                                timestamp: new Date(),
                                              },
                                            },
                                          },
                                        }));
                                      }
                                    } catch (error) {
                                      console.log(
                                        `Fetch failed: ${error.message}`
                                      );
                                    }
                                  }}
                                  className="w-full bg-purple-100 text-purple-800 hover:bg-purple-200 py-2 px-3 rounded-md text-sm flex items-center justify-center gap-2"
                                >
                                  <FiDatabase className="text-xs" />
                                  Refresh New Data
                                </button>
                              )}

                              {details.oldData && details.newData && (
                                <button
                                  onClick={() => {
                                    const comparisonResults =
                                      compareTransactions(
                                        details.oldData,
                                        details.newData
                                      );
                                    setTransactionDetails((prev) => ({
                                      ...prev,
                                      [trx.id]: {
                                        ...prev[trx.id],
                                        comparison: comparisonResults,
                                        steps: {
                                          ...prev[trx.id]?.steps,
                                          compare: {
                                            status: comparisonResults.every(
                                              (r) => r.status === "match"
                                            )
                                              ? "completed"
                                              : "completed-with-issues",
                                            timestamp: new Date(),
                                            results: comparisonResults,
                                          },
                                        },
                                      },
                                    }));
                                  }}
                                  className="w-full bg-green-100 text-green-800 hover:bg-green-200 py-2 px-3 rounded-md text-sm flex items-center justify-center gap-2"
                                >
                                  <FiRefreshCw className="text-xs" />
                                  Re-run Comparison
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Field Comparison */}
                        <h4 className="font-medium mb-3">Field Comparison</h4>
                        {details.comparison && details.comparison.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                                    Field
                                  </th>
                                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                                    Old Value
                                  </th>
                                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                                    New Value
                                  </th>
                                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                                    Status
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 bg-white">
                                {details.comparison.map((field, idx) => (
                                  <tr
                                    key={idx}
                                    className={
                                      field.status === "mismatch"
                                        ? "bg-red-50"
                                        : ""
                                    }
                                  >
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                      {field.name}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                      {field.oldValue}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                      {field.newValue}
                                    </td>
                                    <td className="px-4 py-3">
                                      {field.status === "match" ? (
                                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                          Match
                                        </span>
                                      ) : (
                                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                                          Mismatch
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-6 bg-gray-50 rounded-lg border">
                            <p className="text-gray-500">
                              No field comparison data available yet. Process
                              the transaction to generate comparison data.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">1</span> to{" "}
                <span className="font-medium">10</span> of{" "}
                <span className="font-medium">
                  {filteredTransactions.length}
                </span>{" "}
                results
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 border rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Previous
                </button>
                <button className="px-3 py-1 border rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed rounded-lg">
            <FiDatabase className="mx-auto text-3xl text-gray-400" />
            <h3 className="mt-2 font-medium">No Transaction Data</h3>
            <p className="text-gray-600 mt-1">
              Start migration process to see transactions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

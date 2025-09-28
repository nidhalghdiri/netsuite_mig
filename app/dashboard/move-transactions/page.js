// app/dashboard/move-transactions/page.js
"use client";

import { useState, useEffect } from "react";
import { getSession } from "@/lib/storage";
import {
  FiRefreshCw,
  FiPlay,
  FiPause,
  FiCheckCircle,
  FiXCircle,
  FiCalendar,
  FiFilter,
  FiDatabase,
  FiArrowRight,
  FiClock,
} from "react-icons/fi";
import { apiRequest } from "@/lib/apiClient";

export default function MoveTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState("idle");
  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    success: 0,
    failed: 0,
  });
  const [migrationLog, setMigrationLog] = useState([]);
  const [error, setError] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    transactionDateStart: "",
    transactionDateEnd: "",
    createdDateStart: "",
    createdDateEnd: "",
    transactionType: "all",
  });

  const transactionTypes = [
    { value: "all", label: "All Types" },
    { value: "CustInvc", label: "Invoices" },
    { value: "InvAdjst", label: "Inventory Adjustments" },
    { value: "TrnfrOrd", label: "Transfer Orders" },
    { value: "InvTrnfr", label: "Inventory Transfers" },
    { value: "PurchOrd", label: "Purchase Orders" },
    { value: "ItemRcpt", label: "Item Receipts" },
    { value: "RtnAuth", label: "Return Authorizations" },
    { value: "VendBill", label: "Vendor Bills" },
    { value: "Check", label: "Checks" },
    { value: "Deposit", label: "Deposits" },
  ];

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);

    console.log("fetchTransactions", filters);

    try {
      const oldSession = getSession("old");
      if (!oldSession?.token) {
        throw new Error("Please connect to the old instance first");
      }

      // Build the SuiteQL query based on filters
      let query = `SELECT transaction.id, transaction.tranid, transaction.type, 
        transaction.trandate, transaction.createddate, transaction.amount,
        transaction.custbody_mig_new_internal_id as new_id
      FROM transaction 
      WHERE transaction.trandate IS NOT NULL AND transaction.mainline = 'T'`;

      // Add date filters
      if (filters.transactionDateStart) {
        query += ` AND transaction.trandate >= TO_DATE('${filters.transactionDateStart}', 'YYYY-MM-DD') `;
      }
      if (filters.transactionDateEnd) {
        query += ` AND transaction.trandate <= TO_DATE('${filters.transactionDateEnd}', 'YYYY-MM-DD') `;
      }
      if (filters.createdDateStart) {
        query += ` AND transaction.createddate >= TO_DATE('${filters.createdDateStart}', 'YYYY-MM-DD') `;
      }
      if (filters.createdDateEnd) {
        query += ` AND transaction.createddate <= TO_DATE('${filters.createdDateEnd}', 'YYYY-MM-DD') `;
      }

      // Add transaction type filter
      if (filters.transactionType !== "all") {
        query += ` AND transaction.type = '${filters.transactionType}' `;
      }

      // Only fetch transactions that haven't been migrated yet
      query += ` AND transaction.custbody_mig_new_internal_id IS NULL `;
      query += ` ORDER BY transaction.createddate ASC`;

      // Use App Router API route
      const response = await apiRequest(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/suiteql`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: "5319757",
            token: oldSession.token,
            query: query,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data = await response.json();
      console.log("Fetched Data: ", data);
      setTransactions(data.result?.items || []);
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const startMigration = async () => {
    setMigrating(true);
    setMigrationStatus("running");
    setError(null);
    setMigrationLog([]);

    try {
      const oldSession = getSession("old");
      const newSession = getSession("new");

      if (!oldSession?.token || !newSession?.token) {
        throw new Error("Please connect to both instances first");
      }

      // Prepare migration parameters including date ranges
      const migrationParams = {
        oldAccountId: "5319757",
        newAccountId: "11661334",
        oldToken: oldSession.token,
        newToken: newSession.token,
        transactionIds: transactions.map((t) => t.id),
        transactionType:
          filters.transactionType === "all"
            ? "multiple"
            : filters.transactionType,
        // Include date parameters for the RESTlet script
        dateFilters: {
          transactionDateStart: filters.transactionDateStart,
          transactionDateEnd: filters.transactionDateEnd,
          createdDateStart: filters.createdDateStart,
          createdDateEnd: filters.createdDateEnd,
        },
      };
      console.log("migrationParams: ", migrationParams);

      // Call the App Router API route
      const response = await apiRequest(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/restlet/migrate-transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(migrationParams),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start migration");
      }

      const result = await response.json();

      if (result.success) {
        setMigrationLog((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Migration started successfully. Job ID: ${result.jobId}`,
            type: "info",
          },
        ]);

        // Start polling for progress
        startProgressPolling(result.jobId);
      } else {
        throw new Error(result.error || "Failed to start migration");
      }
    } catch (err) {
      setError(err.message);
      setMigrationStatus("error");
      setMigrationLog((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: `Migration failed: ${err.message}`,
          type: "error",
        },
      ]);
      setMigrating(false);
    }
  };

  const startProgressPolling = (jobId) => {
    const pollInterval = setInterval(async () => {
      if (migrationStatus === "paused" || migrationStatus === "completed") {
        clearInterval(pollInterval);
        return;
      }

      try {
        const response = await apiRequest(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/restlet/migration-status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId }),
          }
        );

        if (response.ok) {
          const status = await response.json();

          setProgress({
            processed: status.processed || 0,
            total: status.total || transactions.length,
            success: status.success || 0,
            failed: status.failed || 0,
          });

          // Update log with new entries
          if (status.logs && status.logs.length > 0) {
            setMigrationLog((prev) => [
              ...prev,
              ...status.logs.map((log) => ({
                timestamp: new Date(log.timestamp),
                message: log.message,
                type: log.type,
              })),
            ]);
          }

          // Check if migration is complete
          if (status.status === "completed") {
            setMigrationStatus("completed");
            setMigrating(false);
            clearInterval(pollInterval);

            setMigrationLog((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Migration completed successfully!",
                type: "success",
              },
            ]);

            // Refresh transactions to show updated status
            fetchTransactions();
          } else if (status.status === "error") {
            setMigrationStatus("error");
            setMigrating(false);
            clearInterval(pollInterval);

            setMigrationLog((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: `Migration failed: ${status.error}`,
                type: "error",
              },
            ]);
          }
        }
      } catch (error) {
        console.error("Error polling migration status:", error);
      }
    }, 3000);

    return pollInterval;
  };

  const pauseMigration = () => {
    setMigrationStatus("paused");
    setMigrationLog((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message: "Migration paused",
        type: "info",
      },
    ]);
  };

  const resumeMigration = () => {
    setMigrationStatus("running");
    setMigrationLog((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message: "Migration resumed",
        type: "info",
      },
    ]);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterName]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      transactionDateStart: "",
      transactionDateEnd: "",
      createdDateStart: "",
      createdDateEnd: "",
      transactionType: "all",
    });
  };

  const stats = {
    total: transactions.length,
    migrated: transactions.filter((t) => t.new_id).length,
    pending: transactions.filter((t) => !t.new_id).length,
  };

  useEffect(() => {
    return () => {
      // Cleanup function
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Bulk Transaction Migration
        </h2>
        <button
          onClick={fetchTransactions}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <FiRefreshCw className={`mr-2 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing..." : "Refresh Transactions"}
        </button>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <FiFilter className="mr-2" />
            Transaction Filters
          </h3>
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Transaction Date Range */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Date Range
            </label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={filters.transactionDateStart}
                onChange={(e) =>
                  handleFilterChange("transactionDateStart", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={filters.transactionDateEnd}
                onChange={(e) =>
                  handleFilterChange("transactionDateEnd", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Created Date Range */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Created Date Range
            </label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={filters.createdDateStart}
                onChange={(e) =>
                  handleFilterChange("createdDateStart", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={filters.createdDateEnd}
                onChange={(e) =>
                  handleFilterChange("createdDateEnd", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Type
            </label>
            <select
              value={filters.transactionType}
              onChange={(e) =>
                handleFilterChange("transactionType", e.target.value)
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {transactionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {transactions.length} transactions found matching filters
          </div>
          <button
            onClick={fetchTransactions}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            <FiDatabase className="mr-2" />
            {loading ? "Fetching..." : "Fetch Transactions"}
          </button>
        </div>
      </div>

      {/* Statistics and Migration Controls */}
      <div className="space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <FiDatabase className="text-xl" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">
                  Total Transactions
                </h3>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.total}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <FiCheckCircle className="text-xl" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">
                  Already Migrated
                </h3>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.migrated}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-amber-100 text-amber-600">
                <FiClock className="text-xl" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">
                  Pending Migration
                </h3>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.pending}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Migration Controls */}
        {stats.pending > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Migration Controls
              </h3>
              <div className="flex items-center space-x-2">
                {migrationStatus === "running" ? (
                  <button
                    onClick={pauseMigration}
                    className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                  >
                    <FiPause className="mr-2" />
                    Pause Migration
                  </button>
                ) : migrationStatus === "paused" ? (
                  <button
                    onClick={resumeMigration}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <FiPlay className="mr-2" />
                    Resume Migration
                  </button>
                ) : null}

                <button
                  onClick={startMigration}
                  disabled={migrating || stats.pending === 0}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <FiArrowRight className="mr-2" />
                  {migrating
                    ? "Migrating..."
                    : `Start Migration (${stats.pending} transactions)`}
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {(migrationStatus === "running" ||
              migrationStatus === "paused") && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>
                    Processed: {progress.processed} / {progress.total}
                  </span>
                  <span>
                    Success: {progress.success} | Failed: {progress.failed}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        progress.total > 0
                          ? (progress.processed / progress.total) * 100
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
                <div className="text-center text-sm text-gray-600 mt-2">
                  {migrationStatus === "running"
                    ? "Migration in progress..."
                    : "Migration paused"}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Migration Log */}
        {(migrationLog.length > 0 || migrating) && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Migration Log
            </h3>
            <div className="bg-gray-50 rounded-md p-4 max-h-64 overflow-y-auto">
              {migrationLog.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  <FiRefreshCw className="animate-spin mx-auto text-2xl mb-2" />
                  <p>Starting migration...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {migrationLog.map((log, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div
                        className={`flex-shrink-0 mt-1 ${
                          log.type === "error"
                            ? "text-red-500"
                            : log.type === "success"
                            ? "text-green-500"
                            : "text-blue-500"
                        }`}
                      >
                        {log.type === "error" ? (
                          <FiXCircle />
                        ) : log.type === "success" ? (
                          <FiCheckCircle />
                        ) : (
                          <FiClock />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-gray-600">
                          {log.timestamp.toLocaleTimeString()}
                        </div>
                        <div
                          className={`text-sm ${
                            log.type === "error"
                              ? "text-red-700"
                              : log.type === "success"
                              ? "text-green-700"
                              : "text-gray-700"
                          }`}
                        >
                          {log.message}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
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
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Migration Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((transaction, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.new_id ? (
                      <FiCheckCircle className="text-green-500" />
                    ) : (
                      <FiClock className="text-amber-500" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {transaction.tranid}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.trandate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.createddate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ${parseFloat(transaction.amount || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.new_id ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                        Migrated
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {transactions.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <FiDatabase className="mx-auto text-3xl mb-2" />
            <p>
              No transactions found. Adjust your filters and fetch transactions.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <FiXCircle className="text-red-500 mr-2" />
            <h3 className="text-red-800 font-medium">Error</h3>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}
    </div>
  );
}

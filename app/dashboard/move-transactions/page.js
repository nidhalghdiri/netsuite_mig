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
  const [migrationPhase, setMigrationPhase] = useState(""); // old_system, new_system, updating_old
  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    success: 0,
    failed: 0,
  });
  const [migrationLog, setMigrationLog] = useState([]);
  const [error, setError] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);

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

  // Add log entry helper function
  const addLogEntry = (message, type = "info") => {
    setMigrationLog((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message,
        type,
      },
    ]);
  };

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
        transaction.trandate, transaction.createddate, transaction.foreigntotal AS amount,
        transaction.custbody_mig_new_internal_id as new_id
      FROM transaction 
      WHERE transaction.trandate IS NOT NULL`;

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
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch transactions");
      }

      const data = await response.json();
      console.log("Fetched Data: ", data);
      setTransactions(data.result?.items || []);

      addLogEntry(
        `Fetched ${
          data.result?.items?.length || 0
        } transactions matching filters`,
        "info"
      );
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch transactions:", err);
      addLogEntry(`Failed to fetch transactions: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const startMigration = async () => {
    setMigrating(true);
    setMigrationStatus("running");
    setMigrationPhase("old_system");
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
        dateFilters: {
          transactionDateStart: filters.transactionDateStart,
          transactionDateEnd: filters.transactionDateEnd,
          createdDateStart: filters.createdDateStart,
          createdDateEnd: filters.createdDateEnd,
        },
      };

      console.log("migrationParams: ", migrationParams);
      addLogEntry(
        `Starting migration for ${transactions.length} transactions...`,
        "info"
      );
      addLogEntry(
        "Phase 1: Starting Map/Reduce script in old system...",
        "info"
      );

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
      console.log("Migration started:", result);

      if (result.success) {
        setCurrentTaskId(result.jobId);
        addLogEntry(
          `Phase 1: Map/Reduce script started in old system. Task ID: ${result.jobId}`,
          "info"
        );

        if (result.details) {
          addLogEntry(
            `Processing ${result.details.transactionCount} transactions of type ${result.details.transactionType}`,
            "info"
          );
        }

        // Initialize progress
        setProgress({
          processed: 0,
          total: transactions.length,
          success: 0,
          failed: 0,
        });

        // Start polling for progress
        startProgressPolling(result.jobId, transactions.length);
      } else {
        throw new Error(result.error || "Failed to start migration");
      }
    } catch (err) {
      console.error("Migration start error:", err);
      setError(err.message);
      setMigrationStatus("error");
      addLogEntry(`Migration failed to start: ${err.message}`, "error");
      setMigrating(false);
    }
  };

  const startProgressPolling = (jobId, totalTransactions) => {
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    let retryCount = 0;
    const maxRetries = 10;

    const interval = setInterval(async () => {
      if (
        migrationStatus === "paused" ||
        migrationStatus === "completed" ||
        migrationStatus === "error"
      ) {
        clearInterval(interval);
        return;
      }

      try {
        console.log(
          `Polling migration status for phase: ${migrationPhase}, job: ${jobId}`
        );

        // Check current phase and call appropriate status check
        let status;
        if (migrationPhase === "old_system") {
          status = await checkOldSystemStatus(jobId);
        } else if (migrationPhase === "new_system") {
          status = await checkNewSystemStatus(jobId);
        } else if (migrationPhase === "updating_old") {
          status = await checkUpdateOldSystemStatus(jobId);
        }

        if (status && status.success) {
          retryCount = 0; // Reset retry count on successful status check

          // Update progress based on current phase
          updateProgressForPhase(status, totalTransactions);

          // Update log with new entries
          if (status.logs && status.logs.length > 0) {
            status.logs.forEach((log) => {
              addLogEntry(log.message, log.type);
            });
          }

          // Handle phase transitions
          await handlePhaseTransition(
            status,
            jobId,
            totalTransactions,
            interval
          );
        } else {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error(
              `Failed to get migration status after ${maxRetries} attempts`
            );
          }
          console.warn(
            `Status check failed, retry ${retryCount}/${maxRetries}`
          );
        }
      } catch (error) {
        console.error("Error polling migration status:", error);
        addLogEntry(
          `Error checking migration status: ${error.message}`,
          "error"
        );

        retryCount++;
        if (retryCount >= maxRetries) {
          setMigrationStatus("error");
          setMigrating(false);
          clearInterval(interval);
          addLogEntry(
            `Migration failed: Too many failed status checks`,
            "error"
          );
        }
      }
    }, 10000); // Poll every 10 seconds

    setPollingInterval(interval);
  };

  const checkOldSystemStatus = async (taskId) => {
    // Check status of Map/Reduce script in old system
    const response = await apiRequest(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/restlet/migration-status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: taskId,
          phase: "old_system",
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch old system status");
    }

    return await response.json();
  };

  const checkNewSystemStatus = async (batchId) => {
    // Check if new system script is running by querying for recently created transactions
    const newSession = getSession("new");
    if (!newSession?.token) {
      throw new Error("New instance session expired");
    }

    // Query for transactions created in the last hour that match our criteria
    const query = `SELECT COUNT(*) as count 
      FROM transaction 
      WHERE createddate >= TO_DATE('${
        new Date(Date.now() - 60 * 60 * 1000).toISOString().split("T")[0]
      }', 'YYYY-MM-DD')
      AND custbody_mig_old_internal_id IS NOT NULL`;

    const response = await apiRequest(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/netsuite/suiteql`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: "11661334",
          token: newSession.token,
          query: query,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to check new system status");
    }

    const data = await response.json();
    const recentCount = data.result?.items[0]?.count || 0;

    return {
      success: true,
      status: recentCount > 0 ? "processing" : "unknown",
      processed: recentCount,
      logs: [
        {
          message: `New system: ${recentCount} transactions processed recently`,
          type: "info",
        },
      ],
    };
  };

  const checkUpdateOldSystemStatus = async (batchId) => {
    // Check how many transactions have been updated in old system
    const oldSession = getSession("old");
    if (!oldSession?.token) {
      throw new Error("Old instance session expired");
    }

    // Count transactions that have been updated with new IDs
    const query = `SELECT COUNT(*) as updatedCount
      FROM transaction 
      WHERE custbody_mig_new_internal_id IS NOT NULL
      AND trandate BETWEEN TO_DATE('${
        filters.transactionDateStart
      }', 'YYYY-MM-DD') 
      AND TO_DATE('${filters.transactionDateEnd}', 'YYYY-MM-DD')
      ${
        filters.transactionType !== "all"
          ? `AND type = '${filters.transactionType}'`
          : ""
      }`;

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
      throw new Error("Failed to check update status");
    }

    const data = await response.json();
    const updatedCount = data.result?.items[0]?.updatedCount || 0;

    return {
      success: true,
      status: "processing",
      processed: updatedCount,
      logs: [
        {
          message: `Update phase: ${updatedCount} transactions updated with new IDs`,
          type: "info",
        },
      ],
    };
  };

  const updateProgressForPhase = (status, totalTransactions) => {
    setProgress((prev) => ({
      processed: status.processed || prev.processed,
      total: status.total || totalTransactions,
      success: status.success || prev.success,
      failed: status.failed || prev.failed,
    }));
  };

  const handlePhaseTransition = async (
    status,
    jobId,
    totalTransactions,
    interval
  ) => {
    if (migrationPhase === "old_system" && status.status === "completed") {
      // Old system script completed, move to new system phase
      setMigrationPhase("new_system");
      addLogEntry(
        "Phase 1 completed: Old system Map/Reduce finished",
        "success"
      );
      addLogEntry(
        "Phase 2: Data sent to new system, waiting for processing...",
        "info"
      );

      // Reset progress for new phase
      setProgress({
        processed: 0,
        total: totalTransactions,
        success: 0,
        failed: 0,
      });
    } else if (
      migrationPhase === "new_system" &&
      status.processed >= totalTransactions * 0.8
    ) {
      // Assume new system processing is mostly done, move to update phase
      setMigrationPhase("updating_old");
      addLogEntry(
        "Phase 2 completed: New system processing finished",
        "success"
      );
      addLogEntry(
        "Phase 3: Updating old system with new transaction IDs...",
        "info"
      );
    } else if (
      migrationPhase === "updating_old" &&
      status.processed >= totalTransactions
    ) {
      // All transactions updated, migration complete
      setMigrationStatus("completed");
      setMigrating(false);
      clearInterval(interval);

      addLogEntry(
        "Phase 3 completed: All transactions updated successfully!",
        "success"
      );
      addLogEntry("Migration completed successfully!", "success");

      // Refresh transactions to show updated status
      setTimeout(() => {
        fetchTransactions();
      }, 2000);
    }

    // Check for completion or error in any phase
    if (status.status === "completed" && migrationPhase === "updating_old") {
      setMigrationStatus("completed");
      setMigrating(false);
      clearInterval(interval);
      addLogEntry("Migration completed successfully!", "success");

      setTimeout(() => {
        fetchTransactions();
      }, 2000);
    } else if (status.status === "error") {
      setMigrationStatus("error");
      setMigrating(false);
      clearInterval(interval);
      addLogEntry(
        `Migration failed in ${migrationPhase} phase: ${status.error}`,
        "error"
      );
    }
  };

  const pauseMigration = () => {
    setMigrationStatus("paused");
    addLogEntry(`Migration paused during ${migrationPhase} phase`, "info");

    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const resumeMigration = () => {
    setMigrationStatus("running");
    addLogEntry(`Migration resumed during ${migrationPhase} phase`, "info");

    if (currentTaskId) {
      startProgressPolling(currentTaskId, progress.total);
    }
  };

  const stopMigration = () => {
    setMigrationStatus("idle");
    setMigrationPhase("");
    setMigrating(false);
    addLogEntry("Migration stopped", "info");

    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
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

  // Calculate progress percentage
  const progressPercentage =
    progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  // Get phase description for UI
  const getPhaseDescription = () => {
    switch (migrationPhase) {
      case "old_system":
        return "Running Map/Reduce in Old System";
      case "new_system":
        return "Processing in New System";
      case "updating_old":
        return "Updating Old System with New IDs";
      default:
        return "Ready to Start";
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Bulk Transaction Migration
        </h2>
        <button
          onClick={fetchTransactions}
          disabled={loading || migrating}
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
            disabled={loading || migrating}
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
                {migrationStatus === "running" && (
                  <button
                    onClick={pauseMigration}
                    className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                  >
                    <FiPause className="mr-2" />
                    Pause Migration
                  </button>
                )}

                {migrationStatus === "paused" && (
                  <button
                    onClick={resumeMigration}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <FiPlay className="mr-2" />
                    Resume Migration
                  </button>
                )}

                {(migrationStatus === "running" ||
                  migrationStatus === "paused") && (
                  <button
                    onClick={stopMigration}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    <FiXCircle className="mr-2" />
                    Stop Migration
                  </button>
                )}

                {migrationStatus === "idle" && (
                  <button
                    onClick={startMigration}
                    disabled={migrating || stats.pending === 0}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    <FiArrowRight className="mr-2" />
                    {migrating
                      ? "Starting..."
                      : `Start Migration (${stats.pending} transactions)`}
                  </button>
                )}
              </div>
            </div>

            {/* Current Phase Display */}
            {migrationPhase && (
              <div className="mb-4 p-3 bg-blue-50 rounded-md">
                <div className="flex items-center">
                  <FiClock className="text-blue-500 mr-2" />
                  <span className="font-medium text-blue-800">
                    Current Phase: {getPhaseDescription()}
                  </span>
                </div>
                {currentTaskId && (
                  <div className="text-sm text-blue-600 mt-1">
                    Task ID: {currentTaskId}
                  </div>
                )}
              </div>
            )}

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
                  <span>Progress: {progressPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                    style={{
                      width: `${progressPercentage}%`,
                    }}
                  ></div>
                </div>
                <div className="text-center text-sm text-gray-600 mt-2">
                  {migrationStatus === "running"
                    ? `Migration in progress - ${getPhaseDescription()}`
                    : "Migration paused"}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Migration Log */}
        {(migrationLog.length > 0 || migrating) && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Migration Log
              </h3>
              <button
                onClick={() => setMigrationLog([])}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Log
              </button>
            </div>
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
                            : log.type === "warning"
                            ? "text-yellow-500"
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
                              : log.type === "warning"
                              ? "text-yellow-700"
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
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

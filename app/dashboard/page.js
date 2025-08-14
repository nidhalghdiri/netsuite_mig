// app/dashboard/page.js
"use client";
import { useState, useEffect } from "react";
import { getSession, isSessionValid } from "@/lib/storage";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiFileText,
  FiDatabase,
  FiLink,
  FiCheckSquare,
  FiFilter,
  FiSearch,
} from "react-icons/fi";

// Mock data service
const fetchMigrationData = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        statistics: {
          totalTransactions: 12450,
          processed: 8420,
          remaining: 4030,
          successRate: 98.7,
          byType: {
            salesOrders: 4520,
            invoices: 2870,
            purchases: 1860,
            creditMemos: 920,
            others: 1280,
          },
        },
        transactions: [
          {
            id: "TRX-1001",
            oldId: "OLD-78901",
            newId: "NEW-45601",
            type: "Sales Order",
            date: "2020-01-15",
            entity: "John Doe Inc.",
            amount: 2450.75,
            status: "completed",
            steps: {
              fetch: { status: "completed", timestamp: "2020-01-15 09:30:22" },
              create: { status: "completed", timestamp: "2020-01-15 09:32:45" },
              relate: { status: "completed", timestamp: "2020-01-15 09:35:18" },
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
          },
          {
            id: "TRX-1002",
            oldId: "OLD-78902",
            newId: "NEW-45602",
            type: "Invoice",
            date: "2020-01-15",
            entity: "Smith & Co.",
            amount: 1200.5,
            status: "in-progress",
            steps: {
              fetch: { status: "completed", timestamp: "2020-01-15 10:15:33" },
              create: { status: "completed", timestamp: "2020-01-15 10:18:21" },
              relate: { status: "pending", timestamp: "" },
              compare: { status: "pending", timestamp: "", mismatches: 0 },
            },
            details: {
              createdFrom: "Sales Order-SO-1002",
              relatedRecords: [
                { id: "PAY-1002", type: "Payment", status: "pending" },
              ],
              files: 1,
              fields: [],
            },
          },
        ],
      });
    }, 800);
  });
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    completed: { text: "Completed", color: "bg-green-100 text-green-800" },
    "in-progress": {
      text: "In Progress",
      color: "bg-yellow-100 text-yellow-800",
    },
    pending: { text: "Pending", color: "bg-gray-100 text-gray-800" },
    failed: { text: "Needs Attention", color: "bg-red-100 text-red-800" },
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${
        statusConfig[status]?.color || ""
      }`}
    >
      {statusConfig[status]?.text || status}
    </span>
  );
};

const StepIcon = ({ step, status }) => {
  const icons = {
    fetch: <FiDatabase size={16} />,
    create: <FiFileText size={16} />,
    relate: <FiLink size={16} />,
    compare: <FiCheckSquare size={16} />,
  };

  const statusColors = {
    completed: "text-green-500 bg-green-100",
    "in-progress": "text-yellow-500 bg-yellow-100",
    pending: "text-gray-400 bg-gray-100",
    failed: "text-red-500 bg-red-100",
  };

  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center ${statusColors[status]}`}
      title={`${step}: ${status}`}
    >
      {icons[step]}
    </div>
  );
};

export default function DashboardOverview() {
  const [migrationData, setMigrationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedTransaction, setExpandedTransaction] = useState(null);
  const [filters, setFilters] = useState({
    status: "all",
    type: "all",
    search: "",
  });

  const oldSession = getSession("old");
  const newSession = getSession("new");
  const isOldConnected = isSessionValid(oldSession) && oldSession.token;
  const isNewConnected = isSessionValid(newSession) && newSession.token;

  const loadMigrationData = async () => {
    setLoading(true);
    try {
      const data = await fetchMigrationData();
      setMigrationData(data);
    } catch (error) {
      console.error("Failed to load migration data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOldConnected && isNewConnected) {
      loadMigrationData();
    }
  }, [isOldConnected, isNewConnected]);

  const toggleTransactionDetails = (id) => {
    setExpandedTransaction(expandedTransaction === id ? null : id);
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
      trx.entity.toLowerCase().includes(filters.search.toLowerCase());

    return matchesStatus && matchesType && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto">
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
                {migrationData.statistics.totalTransactions.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">Total Transactions</p>
            </div>

            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {migrationData.statistics.processed.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">Processed</p>
            </div>

            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 mb-1">
                {migrationData.statistics.remaining.toLocaleString()}
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
              {Object.entries(migrationData.statistics.byType).map(
                ([type, count]) => (
                  <div key={type} className="border rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-blue-600 mb-1">
                      {count.toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600 capitalize">
                      {type.replace(/([A-Z])/g, " $1")}
                    </p>
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
              <div className="col-span-2 text-center">Migration Steps</div>
            </div>

            {/* Transaction Rows */}
            <div className="divide-y">
              {filteredTransactions.map((trx) => (
                <div key={trx.id}>
                  <div
                    className="grid grid-cols-12 gap-2 px-4 py-3 text-sm cursor-pointer hover:bg-blue-50"
                    onClick={() => toggleTransactionDetails(trx.id)}
                  >
                    <div className="col-span-1 flex items-center">
                      <StatusBadge status={trx.status} />
                    </div>
                    <div className="col-span-2 font-medium">{trx.id}</div>
                    <div className="col-span-2">{trx.type}</div>
                    <div className="col-span-2 truncate">{trx.entity}</div>
                    <div className="col-span-1">
                      ${trx.amount.toLocaleString()}
                    </div>
                    <div className="col-span-2">{trx.date}</div>
                    <div className="col-span-2 flex justify-center space-x-1">
                      <StepIcon step="fetch" status={trx.steps.fetch.status} />
                      <StepIcon
                        step="create"
                        status={trx.steps.create.status}
                      />
                      <StepIcon
                        step="relate"
                        status={trx.steps.relate.status}
                      />
                      <StepIcon
                        step="compare"
                        status={trx.steps.compare.status}
                      />
                    </div>
                  </div>

                  {/* Transaction Details */}
                  {expandedTransaction === trx.id && (
                    <div className="bg-gray-50 p-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {/* IDs */}
                        <div className="border rounded-lg p-4 bg-white">
                          <h4 className="font-medium mb-3">Transaction IDs</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Old ID:</span>
                              <span className="font-medium">{trx.oldId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">New ID:</span>
                              <span className="font-medium">{trx.newId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                Created From:
                              </span>
                              <span className="font-medium">
                                {trx.details.createdFrom}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Related Records */}
                        <div className="border rounded-lg p-4 bg-white">
                          <h4 className="font-medium mb-3">Related Records</h4>
                          <div className="space-y-2">
                            {trx.details.relatedRecords.map((record, idx) => (
                              <div key={idx} className="flex justify-between">
                                <div>
                                  <span className="font-medium">
                                    {record.type}:{" "}
                                  </span>
                                  <span className="text-gray-600">
                                    {record.id}
                                  </span>
                                </div>
                                <StatusBadge status={record.status} />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Attached Files */}
                        <div className="border rounded-lg p-4 bg-white">
                          <h4 className="font-medium mb-3">Attached Files</h4>
                          <div className="flex items-center">
                            <div className="bg-blue-100 text-blue-800 rounded-full w-10 h-10 flex items-center justify-center mr-3">
                              <FiFileText />
                            </div>
                            <div>
                              <p className="font-medium">
                                {trx.details.files} files attached
                              </p>
                              <p className="text-sm text-gray-600">
                                Click to view/download
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Field Comparison */}
                      <h4 className="font-medium mb-3">Field Comparison</h4>
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
                            {trx.details.fields.map((field, idx) => (
                              <tr
                                key={idx}
                                className={
                                  field.status === "mismatch" ? "bg-red-50" : ""
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

                      {trx.details.fields.length === 0 && (
                        <div className="text-center py-6 bg-gray-50 rounded-lg border">
                          <p className="text-gray-500">
                            No field comparison data available yet
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
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

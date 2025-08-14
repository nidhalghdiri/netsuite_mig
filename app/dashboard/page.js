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
  FiBarChart2,
} from "react-icons/fi";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Mock data service (replace with real API calls)
const fetchMigrationData = async (startDate, endDate) => {
  // In real implementation, fetch from your backend API
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        days: [
          {
            date: "2020-01-01",
            status: "completed",
            tasks: {
              fetch: { count: 142, status: "completed" },
              create: { count: 140, status: "completed", errors: 2 },
              relate: { count: 138, status: "completed", errors: 4 },
              compare: { count: 140, status: "completed", mismatches: 7 },
            },
            transactionTypes: {
              salesOrders: 45,
              invoices: 32,
              purchases: 28,
              others: 37,
            },
          },
          {
            date: "2020-01-02",
            status: "in-progress",
            tasks: {
              fetch: { count: 167, status: "completed" },
              create: { count: 165, status: "in-progress", errors: 2 },
              relate: { count: 0, status: "pending" },
              compare: { count: 0, status: "pending" },
            },
            transactionTypes: {
              salesOrders: 52,
              invoices: 41,
              purchases: 35,
              others: 39,
            },
          },
        ],
        summary: {
          totalDays: 731,
          completedDays: 1,
          totalTransactions: 11042,
          migratedTransactions: 309,
          successRate: 99.2,
        },
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
      className={`px-3 py-1 rounded-full text-xs font-medium ${
        statusConfig[status]?.color || ""
      }`}
    >
      {statusConfig[status]?.text || status}
    </span>
  );
};

const TaskCard = ({ task, count, status, errors, mismatches }) => {
  const icons = {
    fetch: <FiDatabase className="text-blue-500" />,
    create: <FiFileText className="text-purple-500" />,
    relate: <FiLink className="text-teal-500" />,
    compare: <FiCheckSquare className="text-amber-500" />,
  };

  const statusIcons = {
    completed: <FiCheckCircle className="text-green-500" />,
    "in-progress": <FiRefreshCw className="text-yellow-500 animate-spin" />,
    pending: <div className="w-5 h-5 rounded-full bg-gray-200" />,
    failed: <FiAlertCircle className="text-red-500" />,
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {icons[task]}
          <div>
            <h4 className="font-medium capitalize">{task}</h4>
            <p className="text-2xl font-bold mt-1">{count || 0}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {statusIcons[status]}
          <span className="text-sm capitalize">{status}</span>
        </div>
      </div>

      {(errors || mismatches) && (
        <div className="mt-3 pt-3 border-t">
          {errors > 0 && (
            <p className="text-red-600 text-sm flex items-center">
              <FiAlertCircle className="mr-1" />
              {errors} migration errors
            </p>
          )}
          {mismatches > 0 && (
            <p className="text-amber-600 text-sm flex items-center">
              <FiAlertCircle className="mr-1" />
              {mismatches} field mismatches
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default function DashboardOverview() {
  const [migrationData, setMigrationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedDays, setExpandedDays] = useState({});
  const [startDate, setStartDate] = useState(new Date(2020, 0, 1));
  const [endDate, setEndDate] = useState(new Date());

  const oldSession = getSession("old");
  const newSession = getSession("new");
  const isOldConnected = isSessionValid(oldSession) && oldSession.token;
  const isNewConnected = isSessionValid(newSession) && newSession.token;

  const toggleDayExpansion = (date) => {
    setExpandedDays((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const loadMigrationData = async () => {
    setLoading(true);
    try {
      const data = await fetchMigrationData(startDate, endDate);
      setMigrationData(data);

      // Auto-expand in-progress days
      const expansionState = {};
      data.days.forEach((day) => {
        if (day.status === "in-progress" || day.status === "failed") {
          expansionState[day.date] = true;
        }
      });
      setExpandedDays(expansionState);
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

      {/* Migration Controls */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Migration Timeline</h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <DatePicker
              selected={startDate}
              onChange={setStartDate}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              className="w-full border rounded-md p-2"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">End Date</label>
            <DatePicker
              selected={endDate}
              onChange={setEndDate}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              className="w-full border rounded-md p-2"
            />
          </div>

          <div>
            <button
              onClick={loadMigrationData}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md disabled:opacity-50"
            >
              Load Timeline
            </button>
          </div>
        </div>
      </div>

      {/* Migration Summary */}
      {migrationData && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Migration Summary</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {migrationData.summary.completedDays}/
                {migrationData.summary.totalDays}
              </div>
              <p className="text-sm text-gray-600">Days Processed</p>
            </div>

            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {migrationData.summary.migratedTransactions.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">Transactions Migrated</p>
            </div>

            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {migrationData.summary.successRate}%
              </div>
              <p className="text-sm text-gray-600">Success Rate</p>
            </div>

            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 mb-1">
                {(
                  migrationData.summary.totalTransactions -
                  migrationData.summary.migratedTransactions
                ).toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">Remaining Transactions</p>
            </div>

            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-teal-600 mb-1">
                {Math.round(
                  (migrationData.summary.completedDays /
                    migrationData.summary.totalDays) *
                    100
                )}
                %
              </div>
              <p className="text-sm text-gray-600">Overall Progress</p>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{
                width: `${
                  (migrationData.summary.completedDays /
                    migrationData.summary.totalDays) *
                  100
                }%`,
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Daily Migration Progress */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Daily Migration Process</h2>
          <span className="text-sm text-gray-500">
            Processing from oldest to newest
          </span>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <FiRefreshCw className="animate-spin mx-auto text-3xl text-blue-500" />
            <p className="mt-3">Loading migration data...</p>
          </div>
        ) : migrationData ? (
          <div className="space-y-4">
            {migrationData.days.map((day) => (
              <div key={day.date} className="border rounded-lg overflow-hidden">
                <div
                  className={`p-4 flex justify-between items-center cursor-pointer ${
                    expandedDays[day.date] ? "bg-blue-50" : "bg-gray-50"
                  }`}
                  onClick={() => toggleDayExpansion(day.date)}
                >
                  <div className="flex items-center space-x-4">
                    <StatusBadge status={day.status} />
                    <div>
                      <h3 className="font-medium">
                        {new Date(day.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </h3>
                      <div className="flex space-x-3 text-sm text-gray-600 mt-1">
                        <span>
                          Sales Orders: {day.transactionTypes.salesOrders}
                        </span>
                        <span>Invoices: {day.transactionTypes.invoices}</span>
                        <span>Purchases: {day.transactionTypes.purchases}</span>
                        <span>Others: {day.transactionTypes.others}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm mr-2">
                      {
                        Object.values(day.tasks).filter(
                          (t) => t.status === "completed"
                        ).length
                      }
                      /4 tasks
                    </span>
                    {expandedDays[day.date] ? (
                      <FiChevronUp />
                    ) : (
                      <FiChevronDown />
                    )}
                  </div>
                </div>

                {expandedDays[day.date] && (
                  <div className="p-4 bg-white">
                    <h4 className="font-medium mb-3">Migration Tasks</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <TaskCard
                        task="fetch"
                        count={day.tasks.fetch.count}
                        status={day.tasks.fetch.status}
                      />
                      <TaskCard
                        task="create"
                        count={day.tasks.create.count}
                        status={day.tasks.create.status}
                        errors={day.tasks.create.errors}
                      />
                      <TaskCard
                        task="relate"
                        count={day.tasks.relate.count}
                        status={day.tasks.relate.status}
                        errors={day.tasks.relate.errors}
                      />
                      <TaskCard
                        task="compare"
                        count={day.tasks.compare.count}
                        status={day.tasks.compare.status}
                        mismatches={day.tasks.compare.mismatches}
                      />
                    </div>

                    <div className="mt-6">
                      <h4 className="font-medium mb-3">
                        Transaction Comparison
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border rounded-lg p-4">
                          <div className="flex justify-between mb-3">
                            <h5 className="font-medium text-gray-700">
                              Field Accuracy
                            </h5>
                            <span className="text-sm font-medium text-green-600">
                              {Math.round(
                                ((day.tasks.compare.count -
                                  (day.tasks.compare.mismatches || 0)) /
                                  day.tasks.compare.count) *
                                  100
                              )}
                              %
                            </span>
                          </div>
                          <div className="space-y-2">
                            {[
                              { field: "Amount", matched: 138, mismatched: 2 },
                              { field: "Items", matched: 135, mismatched: 5 },
                              { field: "Dates", matched: 139, mismatched: 1 },
                              {
                                field: "Partners",
                                matched: 140,
                                mismatched: 0,
                              },
                            ].map((item, idx) => (
                              <div key={idx} className="text-sm">
                                <div className="flex justify-between mb-1">
                                  <span>{item.field}</span>
                                  <span>
                                    {item.matched}/
                                    {item.matched + item.mismatched}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-green-600 h-2 rounded-full"
                                    style={{
                                      width: `${
                                        (item.matched /
                                          (item.matched + item.mismatched)) *
                                        100
                                      }%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="border rounded-lg p-4">
                          <h5 className="font-medium text-gray-700 mb-3">
                            Relationships Status
                          </h5>
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span>Created From links</span>
                              <span className="font-medium">132/140</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Related Records</span>
                              <span className="font-medium">126/140</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Attached Files</span>
                              <span className="font-medium">89/140</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Inventory Details</span>
                              <span className="font-medium">140/140</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed rounded-lg">
            <FiBarChart2 className="mx-auto text-3xl text-gray-400" />
            <h3 className="mt-2 font-medium">No Migration Data</h3>
            <p className="text-gray-600 mt-1">
              Configure your date range and load migration timeline
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

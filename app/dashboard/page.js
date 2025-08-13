// app/dashboard/page.js
"use client";
import { getSession } from "@/lib/storage";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";

export default function DashboardOverview() {
  const oldSession = getSession("old");
  const newSession = getSession("new");

  const isOldConnected = oldSession && oldSession.token;
  const isNewConnected = newSession && newSession.token;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Instance Connections</h2>

        <div className="grid grid-cols-2 gap-4">
          <div
            className={`border rounded-lg p-4 ${
              isOldConnected
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-center mb-2">
              <h3 className="font-medium">Old Instance</h3>
              {isOldConnected ? (
                <FiCheckCircle className="ml-2 text-green-500" />
              ) : (
                <FiAlertCircle className="ml-2 text-red-500" />
              )}
            </div>
            <p className="text-sm text-gray-600">
              {isOldConnected
                ? "Connected successfully"
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
              <h3 className="font-medium">New Instance</h3>
              {isNewConnected ? (
                <FiCheckCircle className="ml-2 text-green-500" />
              ) : (
                <FiAlertCircle className="ml-2 text-red-500" />
              )}
            </div>
            <p className="text-sm text-gray-600">
              {isNewConnected
                ? "Connected successfully"
                : "Not connected. Please connect from the home page."}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">Migration Summary</h2>

        <div className="grid grid-cols-4 gap-4 text-center">
          {["Sales Orders", "Purchases", "Invoices", "Customers"].map(
            (type) => (
              <div
                key={type}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="text-2xl font-bold text-blue-600 mb-1">0</div>
                <p className="text-sm text-gray-600">{type}</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

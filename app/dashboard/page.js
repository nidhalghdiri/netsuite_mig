"use client";
import { useState } from "react";
import Sidebar from "@/components/ui/Sidebar";
import Header from "@/components/ui/Header";
import StatusCard from "@/components/ui/StatusCard";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const stats = [
    { title: "Customers", oldCount: 245, newCount: 245, status: "complete" },
    { title: "Items", oldCount: 1200, newCount: 1198, status: "pending" },
    {
      title: "Sales Orders",
      oldCount: 45000,
      newCount: 32000,
      status: "in-progress",
    },
    {
      title: "Invoices",
      oldCount: 42000,
      newCount: 31000,
      status: "in-progress",
    },
    {
      title: "Payments",
      oldCount: 40000,
      newCount: 30000,
      status: "in-progress",
    },
    {
      title: "Inventory Adjustments",
      oldCount: 1500,
      newCount: 1200,
      status: "in-progress",
    },
  ];

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Fixed sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>
      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Migration Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Overview of data migration status between NetSuite instances
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {stats.map((stat, index) => (
              <StatusCard key={index} {...stat} />
            ))}
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Migration Progress
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    Sales Orders
                  </span>
                  <span className="text-sm font-medium text-gray-700">71%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: "71%" }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    Invoices
                  </span>
                  <span className="text-sm font-medium text-gray-700">74%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: "74%" }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    Payments
                  </span>
                  <span className="text-sm font-medium text-gray-700">75%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: "75%" }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

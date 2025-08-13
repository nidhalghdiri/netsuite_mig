// app/dashboard/layout.js
"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  FiHome,
  FiShoppingCart,
  FiShoppingBag,
  FiFileText,
  FiUser,
  FiLogOut,
} from "react-icons/fi";
import { clearSession } from "@/lib/storage";

const RECORD_TYPES = [
  { id: "", name: "Overview", icon: FiHome },
  { id: "sales-orders", name: "Sales Orders", icon: FiShoppingCart },
  { id: "purchases", name: "Purchases", icon: FiShoppingBag },
  { id: "invoices", name: "Invoices", icon: FiFileText },
  { id: "customers", name: "Customers", icon: FiUser },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const activeRecordType = pathname.split("/").pop() || "";

  const handleLogout = () => {
    clearSession("old");
    clearSession("new");
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-800">NetSuite Migrator</h1>
          <p className="text-sm text-gray-500">Data Comparison Dashboard</p>
        </div>

        <nav className="flex-1 px-2 py-4">
          {RECORD_TYPES.map((record) => (
            <a
              key={record.id}
              href={`/netsuite-mig/dashboard/${record.id}`}
              className={`flex items-center px-4 py-3 mb-1 rounded-lg transition ${
                activeRecordType === record.id
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <record.icon className="mr-3 text-lg" />
              <span className="font-medium">{record.name}</span>
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <FiLogOut className="mr-3 text-lg" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-800 capitalize">
            {RECORD_TYPES.find((r) => r.id === activeRecordType)?.name ||
              "Dashboard"}
          </h2>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

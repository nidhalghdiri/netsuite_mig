"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import Header from "@/components/ui/Header";
import RecordSelector from "@/components/RecordSelector";
import ComparisonView from "@/components/ComparisonView";

const recordTypes = [
  { id: "salesorder", name: "Sales Orders" },
  { id: "purchaseorder", name: "Purchase Orders" },
  { id: "itemfulfillment", name: "Item Fulfillments" },
  { id: "inventoryadjustment", name: "Inventory Adjustments" },
  { id: "journalentry", name: "Journal Entries" },
];

export default function ComparisonPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedSubsidiary, setSelectedSubsidiary] = useState("1");
  const [selectedPeriod, setSelectedPeriod] = useState("1/2023");
  const params = useParams();
  const recordType = params.recordType || "salesorder";

  const subsidiaries = [
    { id: "1", name: "Parent Subsidiary" },
    { id: "2", name: "US Subsidiary" },
    { id: "3", name: "EMEA Subsidiary" },
    { id: "4", name: "APAC Subsidiary" },
  ];

  const periods = [
    { id: "1/2023", name: "January 2023" },
    { id: "2/2023", name: "February 2023" },
    { id: "3/2023", name: "March 2023" },
    { id: "4/2023", name: "April 2023" },
  ];

  const recordTypeName =
    recordTypes.find((rt) => rt.id === recordType)?.name || "Sales Orders";

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      <Sidebar />
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Data Comparison
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Compare records between old and new NetSuite instances
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <RecordSelector
                label="Record Type"
                options={recordTypes}
                value={recordType}
                onChange={(e) =>
                  (window.location.href = `/comparison/${e.target.value}`)
                }
              />
              <RecordSelector
                label="Subsidiary"
                options={subsidiaries}
                value={selectedSubsidiary}
                onChange={(e) => setSelectedSubsidiary(e.target.value)}
              />
              <RecordSelector
                label="Accounting Period"
                options={periods}
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-gray-900">
                Comparing {recordTypeName} -{" "}
                {periods.find((p) => p.id === selectedPeriod)?.name}
              </h2>
              <div className="flex items-center">
                <span className="mr-2 text-sm text-gray-500">Status:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  In Progress
                </span>
              </div>
            </div>

            <ComparisonView
              recordType={recordType}
              subsidiary={selectedSubsidiary}
              period={selectedPeriod}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

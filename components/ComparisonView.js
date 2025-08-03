"use client";
import { useState } from "react";
import { BarLoader } from "react-spinners";

export default function ComparisonView({ recordType, subsidiary, period }) {
  const [oldData, setOldData] = useState([]);
  const [newData, setNewData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Simulate data fetching
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      // Generate mock data based on record type
      const generateMockData = () => {
        const data = [];
        const recordCount = Math.floor(Math.random() * 50) + 10;

        for (let i = 0; i < recordCount; i++) {
          const id = Math.floor(Math.random() * 100000);
          const amount = (Math.random() * 10000).toFixed(2);
          const date = new Date(
            Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)
          );

          data.push({
            id: id.toString(),
            tranId: `${recordType.slice(0, 2).toUpperCase()}${id}`,
            entity: `Customer ${Math.floor(Math.random() * 100)}`,
            amount: `$${amount}`,
            date: date.toLocaleDateString(),
            status: Math.random() > 0.2 ? "Active" : "Inactive",
          });
        }

        return data;
      };

      setOldData(generateMockData());
      setNewData(generateMockData().slice(0, -2)); // New instance has 2 fewer records
      setLoading(false);
    }, 1500);
  }, [recordType, subsidiary, period]);

  const columns = [
    { header: "Tran ID", accessor: "tranId" },
    { header: "Entity", accessor: "entity" },
    { header: "Amount", accessor: "amount" },
    { header: "Date", accessor: "date" },
    { header: "Status", accessor: "status" },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <BarLoader color="#3b82f6" width={200} />
        <p className="mt-4 text-gray-500">Loading {recordType} data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">
              Error loading data: {error.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Old Instance</h3>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              {oldData.length} records
            </span>
          </div>
          <DataTable columns={columns} data={oldData} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">New Instance</h3>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              {newData.length} records
            </span>
          </div>
          <DataTable columns={columns} data={newData} />
        </div>
      </div>

      <div className="mt-8 bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Migration Analysis
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  {oldData.length - newData.length} records missing in new
                  instance
                </li>
                <li>5 records with data discrepancies</li>
                <li>2 records with relationship issues</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

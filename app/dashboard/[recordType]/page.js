// app/dashboard/[recordType]/page.js
"use client";
import { useState, useEffect } from "react";
import { getSession, isSessionValid } from "@/lib/storage";
import { fetchRecordData } from "@/lib/netsuiteAPI";

export default function RecordTypePage({ params }) {
  const { recordType } = params;
  const [oldData, setOldData] = useState([]);
  const [newData, setNewData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Format record type for display
  const formatRecordType = (type) => {
    return type
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const oldSession = getSession("old");
        const newSession = getSession("new");
        console.log("Page: oldSession: ", oldSession);

        if (
          !isSessionValid(oldSession) ||
          !isSessionValid(oldSession).token ||
          !isSessionValid(newSession) ||
          !isSessionValid(newSession).token
        ) {
          throw new Error("Both instances must be connected to fetch data");
        }

        // Fetch data from both instances in parallel
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/records/customer?instance=old`,
            {
              headers: {
                Authorization: `Bearer ${oldSession.token}`,
              },
            }
          );
          const data = await res.json();
          console.log("Old Customers:", data);
        } catch (error) {
          console.error("Fetch Old Customers error:", error);
        }
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/records/customer?instance=new`,
            {
              headers: {
                Authorization: `Bearer ${oldSession.token}`,
              },
            }
          );
          const data = await res.json();
          console.log("New Customers:", data);
        } catch (error) {
          console.error("Fetch Old Customers error:", error);
        }
      } catch (err) {
        console.error(`Error fetching ${recordType} data:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [recordType]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
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
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-xl font-semibold mb-6">
        {formatRecordType(recordType)} Comparison
      </h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Old Instance Data */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-medium text-lg mb-4">Old Instance Data</h3>
          <div className="overflow-x-auto">
            <RecordTable data={oldData} />
          </div>
        </div>

        {/* New Instance Data */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-medium text-lg mb-4">New Instance Data</h3>
          <div className="overflow-x-auto">
            <RecordTable data={newData} />
          </div>
        </div>
      </div>

      {/* Comparison Summary */}
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-lg mb-4">Comparison Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {oldData.length}
            </div>
            <p className="text-sm text-gray-600">Records in Old Instance</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {newData.length}
            </div>
            <p className="text-sm text-gray-600">Records in New Instance</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {Math.min(oldData.length, newData.length)}
            </div>
            <p className="text-sm text-gray-600">Records Migrated</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable table component for displaying records
function RecordTable({ data }) {
  if (data.length === 0) {
    return <p className="text-gray-500">No records found</p>;
  }

  // Extract column names from the first record
  const columns = Object.keys(data[0]);

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.slice(0, 10).map((record, index) => (
          <tr key={index}>
            {columns.map((column) => (
              <td
                key={column}
                className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
              >
                {record[column]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

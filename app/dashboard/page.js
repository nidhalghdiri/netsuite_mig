// src/app/dashboard/page.js
"use client";
import { useState, useEffect } from "react";
import { getSession, withValidSession } from "@/lib/auth";
import { FaSync, FaChartBar, FaDatabase, FaCogs } from "react-icons/fa";
import { FiLogOut } from "react-icons/fi";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [session, setSession] = useState(null);

  // Load session and data
  useEffect(() => {
    const sessionData = getSession();

    setSession(sessionData);

    if (sessionData) {
      // Fetch data using the access token
      withValidSession(sessionData, (validSession) => {
        fetchData(validSession);
      });
    }
  }, []);

  // Fetch data from NetSuite using the access token
  const fetchData = async (session) => {
    try {
      // Example API call to NetSuite REST API
      const response = await fetch(
        `https://${session.accountId}.rest.api.netsuite.com/rest/record/v1/customer`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch data from NetSuite");
      }

      const data = await response.json();

      // Process data and set stats
      setStats({
        customers: {
          old: data.totalRecords,
          new: 0, // Will come from second instance
          migrated: Math.floor(data.totalRecords * 0.75),
        },
        // Other stats...
      });
    } catch (error) {
      console.error("Data fetch error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">NetSuite Migration Dashboard</h1>
          </div>

          <div className="flex items-center gap-4">
            {session && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">1</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Account ID</p>
                    <p className="text-sm font-medium">{session.accountId}</p>
                  </div>
                </div>

                <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                  <FiLogOut className="text-lg" />
                  <span>Disconnect</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ... rest of the dashboard ... */}
    </div>
  );
}

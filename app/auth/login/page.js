// src/app/page.js
"use client";
import { useState, useEffect } from "react";
import { FiArrowRight } from "react-icons/fi";

export default function Home() {
  const [oldInstanceConnected, setOldInstanceConnected] = useState(false);
  const [newInstanceConnected, setNewInstanceConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Simulate connection to NetSuite instances
  const connectInstance = (instance) => {
    setIsLoading(true);

    // Simulate API connection delay
    setTimeout(() => {
      setIsLoading(false);
      if (instance === "old") setOldInstanceConnected(true);
      if (instance === "new") setNewInstanceConnected(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Left Panel - Branding */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white p-8 md:w-2/5">
            <div className="flex items-center gap-3 mb-8">
              <h1 className="text-2xl font-bold">NetSuite Migrator</h1>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold mt-12">
                Unified Migration Platform
              </h2>
              <p className="opacity-90">
                Connect both NetSuite instances to synchronize data and manage
                your migration process.
              </p>

              <ul className="mt-8 space-y-3">
                <li className="flex items-start gap-2">
                  <span className="bg-white text-blue-600 rounded-full p-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span>Compare data between instances</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-white text-blue-600 rounded-full p-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span>Manage migration workflows</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-white text-blue-600 rounded-full p-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span>Monitor progress in real-time</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Panel - Authentication */}
          <div className="p-8 md:w-3/5">
            <div className="text-center mb-10">
              <h1 className="text-2xl font-bold text-gray-800">
                Connect to NetSuite Instances
              </h1>
              <p className="text-gray-600 mt-2">
                Authenticate with both instances to access migration tools
              </p>
            </div>

            <div className="space-y-6">
              {/* Old Instance Connection */}
              <div
                className={`border rounded-xl p-5 transition-all duration-300 ${
                  oldInstanceConnected
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        oldInstanceConnected
                          ? "bg-green-500 text-white"
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      <span className="text-xl font-bold">1</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">
                        Old Instance
                      </h3>
                      <p className="text-sm text-gray-600">
                        {oldInstanceConnected
                          ? "Connected successfully"
                          : "Production environment"}
                      </p>
                    </div>
                  </div>

                  {oldInstanceConnected ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Connected</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => connectInstance("old")}
                      disabled={isLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-70"
                    >
                      {isLoading ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Connecting...
                        </>
                      ) : (
                        <>Connect</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* New Instance Connection */}
              <div
                className={`border rounded-xl p-5 transition-all duration-300 ${
                  newInstanceConnected
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        newInstanceConnected
                          ? "bg-green-500 text-white"
                          : "bg-indigo-100 text-indigo-600"
                      }`}
                    >
                      <span className="text-xl font-bold">2</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">
                        New Instance
                      </h3>
                      <p className="text-sm text-gray-600">
                        {newInstanceConnected
                          ? "Connected successfully"
                          : "Migration target environment"}
                      </p>
                    </div>
                  </div>

                  {newInstanceConnected ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Connected</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => connectInstance("new")}
                      disabled={isLoading}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-70"
                    >
                      {isLoading ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Connecting...
                        </>
                      ) : (
                        <>Connect</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Dashboard Access */}
              <div
                className={`mt-10 pt-6 border-t ${
                  oldInstanceConnected && newInstanceConnected
                    ? "opacity-100"
                    : "opacity-40 pointer-events-none"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-800 text-white flex items-center justify-center">
                      <FiArrowRight className="text-xl" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">
                        Access Migration Dashboard
                      </h3>
                      <p className="text-sm text-gray-600">
                        All instances connected - ready to migrate
                      </p>
                    </div>
                  </div>

                  <a
                    href="/dashboard"
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition flex items-center gap-2"
                  >
                    Go to Dashboard
                    <FiArrowRight className="text-lg" />
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center text-sm text-gray-500">
              <p>
                You need to connect to both instances before accessing migration
                tools
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// src/app/page.js
"use client";
import { useState, useEffect } from "react";
import { getSession, isSessionValid, clearSession } from "@/lib/auth";
import { FiArrowRight } from "react-icons/fi";

export default function Home() {
  const [oldInstanceSession, setOldInstanceSession] = useState(null);
  const [newInstanceSession, setNewInstanceSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check sessions on load
  useEffect(() => {
    const checkSessions = async () => {
      const oldSession = getSession("old");
      const newSession = getSession("new");

      // Validate sessions
      const oldValid = oldSession && isSessionValid(oldSession);
      const newValid = newSession && isSessionValid(newSession);

      setOldInstanceSession(oldValid ? oldSession : null);
      setNewInstanceSession(newValid ? newSession : null);
    };

    checkSessions();
  }, []);

  // Connect to NetSuite instance
  const connectInstance = (instanceType) => {
    setIsLoading(true);
    setError(null);

    const clientId =
      instanceType === "old"
        ? process.env.NEXT_PUBLIC_OLD_NS_CLIENT_ID
        : process.env.NEXT_PUBLIC_NEW_NS_CLIENT_ID;

    const authUrl =
      instanceType === "old"
        ? process.env.NEXT_PUBLIC_OLD_NS_AUTH_URL
        : process.env.NEXT_PUBLIC_NEW_NS_AUTH_URL;

    const accountId =
      instanceType === "old"
        ? process.env.NEXT_PUBLIC_OLD_NS_ACCOUNT_ID
        : process.env.NEXT_PUBLIC_NEW_NS_ACCOUNT_ID;

    const redirectUri = encodeURIComponent(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/oauth/callback`
    );

    // Build authorization URL
    const authUrlWithParams = `${authUrl}?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=rest_webservices&account=${accountId}&state=ykv2XLx1BpT5Q0F3MRPHb94j`;

    // Redirect to NetSuite login
    window.location.href = authUrlWithParams;
  };

  // Disconnect an instance
  const disconnectInstance = (instanceType) => {
    if (instanceType === "old") {
      setOldInstanceSession(null);
      clearSession("old");
    } else {
      setNewInstanceSession(null);
      clearSession("new");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* ... (left panel remains the same) ... */}

          {/* Right Panel - Authentication */}
          <div className="p-8 md:w-3/5">
            {error && (
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
            )}

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
                  oldInstanceSession
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        oldInstanceSession
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
                        {oldInstanceSession
                          ? "Connected successfully"
                          : "Production environment"}
                      </p>
                      {oldInstanceSession && (
                        <p className="text-xs text-gray-500 mt-1">
                          Account: {oldInstanceSession.accountId}
                        </p>
                      )}
                    </div>
                  </div>

                  {oldInstanceSession ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => disconnectInstance("old")}
                        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Disconnect
                      </button>
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
                        "Connect"
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* New Instance Connection - Placeholder */}
              <div
                className={`border rounded-xl p-5 transition-all duration-300 ${
                  newInstanceSession
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        newInstanceSession
                          ? "bg-green-500 text-white"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <span className="text-xl font-bold">2</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">
                        New Instance
                      </h3>
                      <p className="text-sm text-gray-600">Coming soon</p>
                    </div>
                  </div>

                  <button
                    disabled
                    className="px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed"
                  >
                    Connect
                  </button>
                </div>
              </div>

              {/* Dashboard Access */}
              <div
                className={`mt-10 pt-6 border-t ${
                  oldInstanceSession
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
                        {oldInstanceSession
                          ? "Instance connected - ready to migrate"
                          : "Connect to continue"}
                      </p>
                    </div>
                  </div>

                  <a
                    href="/dashboard"
                    className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                      oldInstanceSession
                        ? "bg-gray-800 text-white hover:bg-gray-900"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Go to Dashboard
                    <FiArrowRight className="text-lg" />
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center text-sm text-gray-500">
              <p>
                You need to connect to both instances before accessing all
                migration tools
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

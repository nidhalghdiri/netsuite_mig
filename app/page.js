// src/app/page.js
"use client";
import { useState, useEffect } from "react";
import {
  getSession,
  setSession,
  isSessionValid,
  clearSession,
} from "@/lib/storage";
import { FiArrowRight } from "react-icons/fi";
import Cookies from "js-cookie";
import { getNewClientCredentialsToken } from "@/lib/netsuiteNewM2M";
import { getOldClientCredentialsToken } from "@/lib/netsuiteOldM2M";

const INSTANCE_CONFIG = {
  old: {
    name: "Old Instance",
    description: "Production environment",
    sessionKey: "netsuiteSessionOLD",
  },
  new: {
    name: "New Instance",
    description: "Sandbox environment",
    sessionKey: "netsuiteSessionNEW",
  },
};

export default function Home() {
  const [sessions, setSessions] = useState({
    old: null,
    new: null,
  });
  const [isLoading, setIsLoading] = useState({
    old: false,
    new: false,
    global: false,
  });
  const [error, setError] = useState(null);

  // Check sessions on load
  useEffect(() => {
    const checkSessions = async () => {
      try {
        setIsLoading((prev) => ({ ...prev, global: true }));

        // Check existing sessions first
        const oldSession = getSession("old");
        const newSession = getSession("new");
        console.log("1. Check oldSession: ", oldSession);
        console.log("1. Check newSession: ", newSession);

        if (oldSession && isSessionValid(oldSession)) {
          setSessions((prev) => ({ ...prev, old: oldSession }));
        }
        if (newSession && isSessionValid(newSession)) {
          setSessions((prev) => ({ ...prev, new: newSession }));
        }

        // Fetch new tokens if needed
        if (!oldSession || !isSessionValid(oldSession)) {
          setIsLoading((prev) => ({ ...prev, old: true }));
          const oldAccessToken = await getOldClientCredentialsToken();
          console.log("Old Access Token: ", oldAccessToken);
          if (oldAccessToken) {
            const sessionData = {
              token: oldAccessToken,
              timestamp: Date.now(),
            };
            setSession("old", sessionData);
            setSessions((prev) => ({ ...prev, old: sessionData }));
          }
        }

        if (!newSession || !isSessionValid(newSession)) {
          setIsLoading((prev) => ({ ...prev, new: true }));
          const newAccessToken = await getNewClientCredentialsToken();
          console.log("New Access Token: ", newAccessToken);
          if (newAccessToken) {
            const sessionData = {
              token: newAccessToken,
              timestamp: Date.now(),
            };
            setSession("new", sessionData);
            setSessions((prev) => ({ ...prev, new: sessionData }));
          }
        }
      } catch (error) {
        console.error("Connection check failed:", error);
        setError(
          "Failed to connect to one or more instances. Please try again."
        );
      } finally {
        setIsLoading({ old: false, new: false, global: false });
      }
    };

    checkSessions();
  }, []);

  const connectInstance = async (instanceType) => {
    setIsLoading((prev) => ({ ...prev, [instanceType]: true }));
    setError(null);

    try {
      const token =
        instanceType === "old"
          ? await getOldClientCredentialsToken()
          : await getNewClientCredentialsToken();

      if (token) {
        const sessionData = { token, timestamp: Date.now() };
        setSession(instanceType, sessionData);
        setSessions((prev) => ({ ...prev, [instanceType]: sessionData }));
      }
    } catch (error) {
      console.error(`Error connecting to ${instanceType} instance:`, error);
      setError(
        `Failed to connect to ${instanceType} instance. Please try again.`
      );
    } finally {
      setIsLoading((prev) => ({ ...prev, [instanceType]: false }));
    }
  };

  // Disconnect an instance
  const disconnectInstance = (instanceType) => {
    clearSession(instanceType);
    setSessions((prev) => ({ ...prev, [instanceType]: null }));
  };

  const InstanceConnectionCard = ({ instanceType }) => {
    const config = INSTANCE_CONFIG[instanceType];
    const session = sessions[instanceType];
    const loading = isLoading[instanceType] || isLoading.global;

    return (
      <div
        className={`border rounded-xl p-5 transition-all duration-300 ${
          session ? "border-green-500 bg-green-50" : "border-gray-300"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                session
                  ? "bg-green-500 text-white"
                  : "bg-blue-100 text-blue-600"
              }`}
            >
              <span className="text-xl font-bold">
                {instanceType === "old" ? "1" : "2"}
              </span>
            </div>
            <div>
              <h3 className="font-medium text-gray-800">{config.name}</h3>
              <p className="text-sm text-gray-600">
                {session ? "Connected successfully" : config.description}
              </p>
              {session && (
                <p className="text-xs text-gray-500 mt-1">
                  Last connected: {new Date(session.timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {session ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => disconnectInstance(instanceType)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => connectInstance(instanceType)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-70"
            >
              {loading ? (
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
    );
  };

  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6">
    <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="flex flex-col md:flex-row">
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
            <InstanceConnectionCard instanceType="old" />
            <InstanceConnectionCard instanceType="new" />

            <div
              className={`mt-10 pt-6 border-t ${
                sessions.old && sessions.new
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
                      {sessions.old && sessions.new
                        ? "Instances connected - ready to migrate"
                        : "Connect both instances to continue"}
                    </p>
                  </div>
                </div>

                <a
                  href="/dashboard"
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    sessions.old && sessions.new
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
  </div>;
}

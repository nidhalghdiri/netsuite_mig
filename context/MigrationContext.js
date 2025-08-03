"use client";
import { createContext, useContext, useState } from "react";

const MigrationContext = createContext();

export function MigrationProvider({ children }) {
  const [migrationStatus, setMigrationStatus] = useState({
    salesOrders: { status: "pending", progress: 0 },
    invoices: { status: "pending", progress: 0 },
    payments: { status: "pending", progress: 0 },
  });

  const [activeWorkflows, setActiveWorkflows] = useState([]);

  const startMigration = (workflowType) => {
    setActiveWorkflows([...activeWorkflows, workflowType]);

    // Simulate migration progress
    const interval = setInterval(() => {
      setMigrationStatus((prev) => {
        const newProgress = Math.min(prev[workflowType].progress + 5, 100);
        const newStatus = newProgress === 100 ? "complete" : "in-progress";

        return {
          ...prev,
          [workflowType]: { status: newStatus, progress: newProgress },
        };
      });

      if (migrationStatus[workflowType].progress >= 100) {
        clearInterval(interval);
        setActiveWorkflows(activeWorkflows.filter((w) => w !== workflowType));
      }
    }, 500);
  };

  return (
    <MigrationContext.Provider
      value={{
        migrationStatus,
        activeWorkflows,
        startMigration,
      }}
    >
      {children}
    </MigrationContext.Provider>
  );
}

export function useMigration() {
  return useContext(MigrationContext);
}

import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { API_URL } from "./api/client.js";
import { db } from "./api/offlineDb";
import "./index.css";
// 👇 ADD THIS LINE BACK - This is likely where your layout grid lives!
import "./styles.css"; 

const Root = () => {
  useEffect(() => {
    const syncOfflineData = async () => {
      if (!navigator.onLine) return;

      const legacySales = await db.pendingSales.toArray();
      for (const legacySale of legacySales) {
        await db.pendingOperations.add({
          operationId: `legacy-sale-${legacySale.id}`,
          path: legacySale.path,
          options: legacySale.options,
          entity: "sales",
          action: "post",
          status: "pending",
          retryCount: 0,
          createdAt: legacySale.timestamp || Date.now()
        });
        await db.pendingSales.delete(legacySale.id);
      }

      const pending = await db.pendingOperations.toArray();
      if (pending.length === 0) return;

      console.log(`📡 Online! Syncing ${pending.length} pending transactions...`);

      for (const item of pending) {
        try {
          const response = await fetch(`${API_URL}${item.path}`, {
            ...item.options,
            body: item.options.body === undefined ? undefined : JSON.stringify(item.options.body),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("bms_token")}`,
                ...(localStorage.getItem("bms_impersonation")
                  ? { "x-business-id": localStorage.getItem("bms_impersonation") }
                  : {}),
                "X-Operation-Id": item.operationId
            }
          });

          if (!response.ok) {
            throw new Error(`Sync failed with status ${response.status}`);
          }

          await db.pendingOperations.delete(item.id);
        } catch (e) {
          console.error("Sync failed for item", item.id, e);
          await db.pendingOperations.update(item.id, {
            status: "failed",
            retryCount: (item.retryCount || 0) + 1,
            lastError: e.message,
            lastAttemptAt: Date.now()
          });
        }
      }
    };

    window.addEventListener('online', syncOfflineData);
    syncOfflineData();

    return () => window.removeEventListener('online', syncOfflineData);
  }, []);

  return <App />;
};

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
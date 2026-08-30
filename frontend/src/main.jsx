import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { API_URL } from "./api/client.js";
import { clearQueuedOperations, db } from "./api/offlineDb";
import "./index.css";
// 👇 ADD THIS LINE BACK - This is likely where your layout grid lives!
import "./styles.css"; 

const Root = () => {
  useEffect(() => {
    const syncOfflineData = async () => {
      if (!navigator.onLine) return;

      // Ignore stale queued operations so the POS works online only.
      await clearQueuedOperations();
      return;
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
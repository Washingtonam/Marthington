import {
  db,
  cacheCollection,
  getCachedCollection,
  getOfflineSnapshotCollection,
  queueOperation
} from "./offlineDb";

export const API_URL = "https://marthington.onrender.com/api";

let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach(p => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  refreshQueue = [];
};

const doRefresh = async () => {
  const refresh = localStorage.getItem("bms_refresh");
  if (!refresh) throw new Error("No refresh token");

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Refresh failed");
  }

  const data = await res.json().catch(() => ({}));

  if (data.token) {
    localStorage.setItem("bms_token", data.token);
  }
  if (data.refreshToken) {
    localStorage.setItem("bms_refresh", data.refreshToken);
  }

  return data.token;
};

const getSnapshotFallback = async (path) => {
  if (path.startsWith("/products")) return getOfflineSnapshotCollection("products");
  if (path.startsWith("/services")) return getOfflineSnapshotCollection("services");
  if (path.startsWith("/customers")) return getOfflineSnapshotCollection("customers");
  if (path.startsWith("/suppliers")) return getOfflineSnapshotCollection("suppliers");
  if (path === "/branches" || path.startsWith("/branches?")) return getOfflineSnapshotCollection("branches");
  if (path.startsWith("/branches/inventory")) return getOfflineSnapshotCollection("branchInventory");
  if (path.startsWith("/expenses")) return getOfflineSnapshotCollection("expenses");
  if (path.startsWith("/sales")) return getOfflineSnapshotCollection("sales");
  if (path.startsWith("/invoices")) return getOfflineSnapshotCollection("invoices");
  if (path === "/business") return getOfflineSnapshotCollection("business");
  return null;
};

const request = async (path, options = {}) => {
  const token = localStorage.getItem("bms_token");
  const impersonation = localStorage.getItem("bms_impersonation");
  const isFormData = options.body instanceof FormData;
  const method = options.method || "GET";
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const operationId = isMutation
    ? (options.headers?.["X-Operation-Id"] || `${Date.now()}-${crypto.randomUUID()}`)
    : null;

  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(impersonation ? { "x-business-id": impersonation } : {}),
    ...(operationId ? { "X-Operation-Id": operationId } : {}),
    ...options.headers
  };

  try {
    let response;
    try {
      response = await fetch(`${API_URL}${path}`, { ...options, headers });
    } catch (networkError) {
      networkError.isNetworkError = true;
      throw networkError;
    }

    // If the server returns a 5xx, try to read its body to surface message, then jump to catch
    if (response.status >= 500) {
      let body = null;
      try {
        body = await response.json();
      } catch (e) {
        try {
          body = await response.text();
        } catch (ee) {
          body = null;
        }
      }
      const msg = (body && (body.message || body.error)) || body || "Server Error";
      throw new Error(msg);
    }

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      // If token expired, try to refresh and retry once
      if (data && data.message === "Token expired") {
        if (isRefreshing) {
          // Queue this request until refresh completes
          return new Promise((resolve, reject) => {
            refreshQueue.push({ resolve, reject });
          }).then(async (token) => {
            const tokenHeader = token ? { Authorization: `Bearer ${token}` } : {};
            const headers = {
              ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
              ...(tokenHeader || {}),
              ...(localStorage.getItem("bms_impersonation") ? { "x-business-id": localStorage.getItem("bms_impersonation") } : {}),
              ...(operationId ? { "X-Operation-Id": operationId } : {}),
              ...options.headers
            };

            const retryRes = await fetch(`${API_URL}${path}`, { ...options, headers });
            if (retryRes.status >= 500) {
              let body = null;
              try { body = await retryRes.json(); } catch (e) { try { body = await retryRes.text(); } catch (ee) { body = null; } }
              const msg = (body && (body.message || body.error)) || body || "Server Error";
              throw new Error(msg);
            }
            const retryData = await retryRes.json().catch(() => ({}));
            if (retryRes.status === 401) {
              localStorage.clear();
              window.location.replace("/login");
              return;
            }
            if (!retryRes.ok) {
              const e = new Error(retryData.message || "Request failed.");
              e.body = retryData;
              throw e;
            }
            return retryData;
          });
        }

        isRefreshing = true;
        try {
          const newToken = await doRefresh();
          processQueue(null, newToken);

          const tokenHeader = newToken ? { Authorization: `Bearer ${newToken}` } : {};
          const headers = {
            ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
            ...(tokenHeader || {}),
            ...(localStorage.getItem("bms_impersonation") ? { "x-business-id": localStorage.getItem("bms_impersonation") } : {}),
            ...(operationId ? { "X-Operation-Id": operationId } : {}),
            ...options.headers
          };

          const retryRes = await fetch(`${API_URL}${path}`, { ...options, headers });
          if (retryRes.status >= 500) {
            let body = null;
            try { body = await retryRes.json(); } catch (e) { try { body = await retryRes.text(); } catch (ee) { body = null; } }
            const msg = (body && (body.message || body.error)) || body || "Server Error";
            throw new Error(msg);
          }
          const retryData = await retryRes.json().catch(() => ({}));
          if (retryRes.status === 401) {
            localStorage.clear();
            window.location.replace("/login");
            return;
          }
          if (!retryRes.ok) {
            const e = new Error(retryData.message || "Request failed.");
            e.body = retryData;
            throw e;
          }
          return retryData;
        } catch (err) {
          processQueue(err, null);
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            throw err;
          }
          localStorage.clear();
          window.location.replace("/login");
          return;
        } finally {
          isRefreshing = false;
        }
      }

      // Other 401 -> force logout
      localStorage.clear();
      window.location.replace("/login");
      return;
    }

    if (!response.ok) {
      const e = new Error(data.message || "Request failed.");
      e.body = data;
      throw e;
    }

    // Cache successful reads so screens can render while offline.
    if (!options.method || options.method === "GET") {
      await cacheCollection(path, data);
    }

    // Keep the legacy product table populated for existing POS consumers.
    if (path.includes("/products") && (!options.method || options.method === "GET")) {
       // Ensure data is an array before saving
       const productsArray = Array.isArray(data) ? data : (data.products || []);
       if (productsArray.length > 0) {
         await db.products.clear(); // Fresh sync
         await db.products.bulkPut(productsArray);
       }
    }

    return data;

  } catch (err) {
    console.warn(`Network fail for ${path}, checking offline database...`);

    // OFFLINE FALLBACK: return the last successful response for any GET.
    if (!options.method || options.method === "GET") {
      const cached = await getCachedCollection(path);
      if (cached !== null) return cached;

      const snapshotFallback = await getSnapshotFallback(path);
      if (snapshotFallback !== null) return snapshotFallback;
    }

    const canQueue = isMutation && (err.isNetworkError || navigator.onLine === false);

    if (canQueue && !path.startsWith("/auth/")) {
      const operationId = await queueOperation({
        path,
        options,
        entity: path.split("/")[1] || "unknown",
        action: method.toLowerCase(),
        operationId
      });
      return { success: true, offline: true, pending: true, operationId };
    }

    throw err;
  }
};

export default request;
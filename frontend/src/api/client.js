import { db } from "./offlineDb";

const API_URL = "https://marthington.onrender.com/api";

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

const request = async (path, options = {}) => {
  const token = localStorage.getItem("bms_token");
  const impersonation = localStorage.getItem("bms_impersonation");
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(impersonation ? { "x-business-id": impersonation } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });

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

    // SUCCESS: If we are fetching products, save them to IndexedDB for next time
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

    // OFFLINE FALLBACK: Load inventory from IndexedDB
    if (path.includes("/products") && (!options.method || options.method === "GET")) {
      const localProducts = await db.products.toArray();
      if (localProducts.length > 0) {
        return localProducts; // Return the cached inventory
      }
    }

    // OFFLINE POST: Queue sales if network is dead
    if (options.method === "POST" && path.includes("/sales")) {
      await db.pendingSales.add({
        path,
        options: {
            ...options,
            body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body
        },
        timestamp: Date.now()
      });
      return { success: true, offline: true };
    }

    throw err;
  }
};

export default request;
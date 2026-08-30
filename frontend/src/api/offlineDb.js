import Dexie from 'dexie';

export const db = new Dexie('MarthingtonOffline');

db.version(1).stores({
  products: '_id, name, sellingPrice, stock',
  pendingSales: '++id, data, timestamp',
  userSession: 'id, token, userData'
});

db.version(2).stores({
  products: '_id, name, sellingPrice, stock',
  pendingSales: '++id, data, timestamp',
  userSession: 'id, token, userData',
  cachedCollections: 'key, updatedAt',
  pendingOperations: '++id, operationId, entity, action, status, createdAt'
});

db.version(3).stores({
  products: '_id, name, sellingPrice, stock',
  pendingSales: '++id, data, timestamp',
  userSession: 'id, token, userData',
  cachedCollections: 'key, updatedAt',
  pendingOperations: '++id, operationId, entity, action, status, createdAt',
  offlineSnapshot: 'key, syncedAt'
});

export const cacheCollection = async (key, data) => {
  await db.cachedCollections.put({
    key,
    data,
    updatedAt: Date.now()
  });
};

export const getCachedCollection = async (key) => {
  const cached = await db.cachedCollections.get(key);
  return cached?.data ?? null;
};

export const queueOperation = async ({ path, options, entity, action, operationId, businessId = null }) => {
  const resolvedOperationId = operationId || `${Date.now()}-${crypto.randomUUID()}`;
  const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;

  await db.pendingOperations.add({
    operationId: resolvedOperationId,
    businessId,
    path,
    options: {
      ...options,
      body,
      headers: {
        ...(options.headers || {}),
        "X-Operation-Id": resolvedOperationId
      }
    },
    entity,
    action,
    status: "pending",
    retryCount: 0,
    createdAt: Date.now()
  });

  return resolvedOperationId;
};

export const saveOfflineSnapshot = async (snapshot) => {
  const syncedAt = snapshot.syncedAt || new Date().toISOString();
  const collections = {
    business: snapshot.business,
    products: snapshot.products || [],
    services: snapshot.services || [],
    customers: snapshot.customers || [],
    suppliers: snapshot.suppliers || [],
    branches: snapshot.branches || [],
    branchInventory: snapshot.branchInventory || [],
    sales: snapshot.sales || [],
    expenses: snapshot.expenses || [],
    invoices: snapshot.invoices || [],
    budgets: snapshot.budgets || []
  };

  await db.transaction("rw", db.offlineSnapshot, db.cachedCollections, db.products, async () => {
    await db.offlineSnapshot.clear();
    await db.offlineSnapshot.bulkPut(Object.entries(collections).map(([key, data]) => ({ key, data, syncedAt })));
    await db.cachedCollections.bulkPut(Object.entries(collections).map(([key, data]) => ({
      key: `snapshot:${key}`,
      data,
      updatedAt: Date.now()
    })));
    await db.products.clear();
    await db.products.bulkPut(collections.products);
  });

  return syncedAt;
};

export const getOfflineSnapshotCollection = async (key) => {
  const snapshot = await db.offlineSnapshot.get(key);
  return snapshot?.data ?? null;
};

export const clearQueuedOperations = async () => {
  try {
    await db.pendingOperations.clear();
  } catch (error) {
    console.warn("Failed to clear pendingOperations:", error);
  }

  try {
    await db.pendingSales.clear();
  } catch (error) {
    console.warn("Failed to clear pendingSales:", error);
  }
};

export const getOfflineSnapshotMeta = async () => {
  const snapshot = await db.offlineSnapshot.get("business");
  return snapshot?.syncedAt || null;
};
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

export const queueOperation = async ({ path, options, entity, action, operationId }) => {
  const resolvedOperationId = operationId || `${Date.now()}-${crypto.randomUUID()}`;
  const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;

  await db.pendingOperations.add({
    operationId: resolvedOperationId,
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
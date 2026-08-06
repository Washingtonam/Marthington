# Marthington BMS

## Backend

### Requirements
- Node.js 18+
- MongoDB
- Redis

### Install dependencies
```bash
cd backend
npm install
```

### Start backend API
```bash
cd backend
npm run dev
```

### Start worker process
```bash
cd backend
npm run worker
```

### Notes
- The worker uses Redis for the branch import queue.
- The admin UI supports operation log search, filtering, sorting, pagination, and retry.
- The worker is intentionally separated from the API server so it can be run independently.

## Redis (Docker)
```bash
docker run -p 6379:6379 --name marthington-redis -d redis:6.2
```

## Important backend files
- `backend/src/server.js`: API server entrypoint.
- `backend/src/worker.js`: worker entrypoint for background import jobs.
- `backend/src/queues/importQueue.js`: Bull queue definition.
- `backend/src/workers/branchImport.worker.js`: branch import processor.
- `backend/src/modules/admin/admin.controller.js`: operation log filtering and retry APIs.
- `backend/src/pages/AdminOperationLogs.jsx`: improved admin UI for logs.

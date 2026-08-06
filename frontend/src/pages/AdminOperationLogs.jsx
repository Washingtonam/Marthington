import React, { useEffect, useState, useRef } from "react";
import { getOperationLogs, retryOperationLog, getOperationLog } from "../api/admin.js";

const AdminOperationLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [operationTypeFilter, setOperationTypeFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const pollRef = useRef(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildQuery = (p = page) => {
    const q = [];
    q.push(`page=${p}`);
    q.push(`limit=${pageSize}`);
    q.push(`sortBy=${encodeURIComponent(sortBy)}`);
    q.push(`sortDir=${encodeURIComponent(sortDir)}`);
    if (search) q.push(`search=${encodeURIComponent(search)}`);
    if (fromDate) q.push(`from=${encodeURIComponent(fromDate)}`);
    if (toDate) q.push(`to=${encodeURIComponent(toDate)}`);
    if (userFilter) q.push(`user=${encodeURIComponent(userFilter)}`);
    if (branchFilter) q.push(`branch=${encodeURIComponent(branchFilter)}`);
    if (operationTypeFilter) q.push(`operationType=${encodeURIComponent(operationTypeFilter)}`);
    return q.join("&");
  };

  const load = async (p = page) => {
    try {
      setLoading(true);
      const res = await getOperationLogs(buildQuery(p));
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    load(page);
  }, [page]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPage(1);
      load(1);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [sortBy, sortDir, fromDate, toDate, userFilter, branchFilter, operationTypeFilter, pageSize]);

  const handleRetry = async (id) => {
    try {
      await retryOperationLog(id);
      await load(page);
      alert("Retry enqueued");
    } catch (err) {
      alert(err.message || "Failed to enqueue retry");
    }
  };

  const openDetails = async (id) => {
    try {
      const res = await getOperationLog(id);
      setSelectedLog(res.log);
      setShowModal(true);

      if (res.log?.status === "in_progress") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const up = await getOperationLog(id);
            setSelectedLog(up.log);
            if (up.log?.status !== "in_progress") {
              clearInterval(pollRef.current);
              pollRef.current = null;
              await load(page);
            }
          } catch (e) {
            console.warn("Polling failed", e);
          }
        }, 2000);
      }
    } catch (err) {
      alert(err.message || "Failed to load details");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedLog(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Operation Logs</h1>
          <p className="max-w-2xl text-sm text-slate-500">View, inspect, and retry bulk import jobs</p>
        </div>
      </div>

      <div className="mt-6">
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-500">{error}</div>}

        {!loading && !error && (
          <div>
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by job id, branch id, or operation type"
                className="form-input"
              />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="form-select">
                <option value="createdAt">Created At</option>
                <option value="status">Status</option>
                <option value="operationType">Operation Type</option>
              </select>
              <select value={sortDir} onChange={(e) => setSortDir(e.target.value)} className="form-select">
                <option value="desc">Newest</option>
                <option value="asc">Oldest</option>
              </select>
            </div>

            <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="form-input" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="form-input" />
              <input
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="Filter by user id"
                className="form-input"
              />
              <input
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                placeholder="Filter by branch id"
                className="form-input"
              />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm">Page size</label>
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="form-select w-28">
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <input
                value={operationTypeFilter}
                onChange={(e) => setOperationTypeFilter(e.target.value)}
                placeholder="Operation type"
                className="form-input"
              />
            </div>

            <div className="overflow-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => {
                    const totalP = l.metadata?.totalProducts || 0;
                    const processed = l.metadata?.processed || 0;
                    const percent = totalP > 0 ? Math.min(100, Math.round((processed / totalP) * 100)) : 0;
                    return (
                      <tr key={l._id} className="border-t">
                        <td>
                          <button className="text-blue-600" onClick={() => openDetails(l._id)}>{l._id}</button>
                        </td>
                        <td>{l.operationType}</td>
                        <td>
                          <span className={`px-2 py-1 rounded text-sm ${l.status === 'completed' ? 'bg-green-100 text-green-800' : l.status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {l.status}
                          </span>
                        </td>
                        <td style={{ minWidth: 180 }}>
                          <div className="w-full bg-slate-100 rounded-full h-3">
                            <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{processed}/{totalP} ({percent}%)</div>
                        </td>
                        <td>{new Date(l.createdAt).toLocaleString()}</td>
                        <td>
                          {l.status === "failed" && (
                            <button onClick={() => handleRetry(l._id)} className="ghost-button">Retry</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm text-slate-500">Total: {total}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      placeholder="Go to page"
                      className="form-input w-28"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = Number(e.target.value || 1);
                          if (v >= 1) setPage(Math.min(Math.max(1, v), totalPages));
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
                  <div className="flex items-center gap-1 flex-wrap">
                    {page > 4 && (
                      <button className="btn" onClick={() => setPage(1)}>1</button>
                    )}
                    {page > 5 && <div className="px-2">...</div>}
                    {Array.from({ length: Math.min(7, totalPages) }, (_, index) => {
                      const pageNumber = Math.min(Math.max(1, page - 3 + index), totalPages);
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setPage(pageNumber)}
                          className={`px-3 py-1 rounded ${pageNumber === page ? "bg-black text-white" : "hover:bg-gray-100"}`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                    {page < totalPages - 4 && <div className="px-2">...</div>}
                    {page < totalPages - 3 && (
                      <button className="btn" onClick={() => setPage(totalPages)}>{totalPages}</button>
                    )}
                  </div>
                  <button className="btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="bg-white p-6 rounded-xl shadow-lg z-10 w-full max-w-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">Operation {selectedLog._id}</h3>
                <p className="text-sm text-slate-500">{selectedLog.operationType} - {selectedLog.status}</p>
              </div>
              <div>
                <button className="btn" onClick={closeModal}>Close</button>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-semibold">Metadata</h4>
              <pre className="bg-slate-50 p-3 rounded mt-2 text-sm">{JSON.stringify(selectedLog.metadata || {}, null, 2)}</pre>
            </div>

            {selectedLog.metadata?.totalProducts && (
              <div className="mt-4">
                <h4 className="font-semibold">Progress</h4>
                <div className="w-full bg-slate-100 rounded-full h-4 mt-2">
                  <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${Math.min(100, Math.round((selectedLog.metadata.processed || 0) / (selectedLog.metadata.totalProducts || 1) * 100))}%` }} />
                </div>
                <div className="text-sm text-slate-500 mt-2">{(selectedLog.metadata.processed || 0)}/{selectedLog.metadata.totalProducts} processed</div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              {selectedLog.status === 'failed' && (
                <button onClick={() => handleRetry(selectedLog._id)} className="btn btn-primary">Retry</button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminOperationLogs;

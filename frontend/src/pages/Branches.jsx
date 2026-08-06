import { useEffect, useState } from "react";
import { getBranches, createBranch, updateBranch, deleteBranch } from "../api/branches.js";

const Branches = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const loadBranches = async () => {
    try {
      setLoading(true);
      const data = await getBranches();
      setBranches(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createBranch({ name, address, phone });
    setName("");
    setAddress("");
    setPhone("");
    await loadBranches();
  };

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <span className="text-sm uppercase tracking-[0.3em] text-slate-500">Branch Management</span>
          <h1 className="mt-2 text-4xl font-semibold text-slate-900">Branches</h1>
        </div>
        <p className="max-w-2xl text-sm text-slate-500">
          Create and manage branch offices, assign managers, and track each branch separately.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <div className="page-card">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Branch list</h2>
              <p className="text-sm text-slate-500">Browse all branches for your business.</p>
            </div>
          </div>
          {loading ? (
            <div className="text-sm text-slate-500">Loading branches...</div>
          ) : branches.length === 0 ? (
            <div className="text-sm text-slate-500">No branches exist yet.</div>
          ) : (
            <div className="space-y-3">
              {branches.map((branch) => (
                <div key={branch._id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{branch.name}</h3>
                      <p className="text-sm text-slate-500">{branch.address || "No address provided"}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-600">
                      {branch.status}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-slate-600">
                    {branch.phone && <p>{branch.phone}</p>}
                    {branch.manager?.name && <p>Manager: {branch.manager.name}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="page-card">
          <h2 className="text-xl font-semibold">Create new branch</h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input mt-2 w-full"
                placeholder="Branch name"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Address</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="form-input mt-2 w-full"
                placeholder="Branch address"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input mt-2 w-full"
                placeholder="Branch phone"
              />
            </label>
            <button onClick={handleCreate} className="btn btn-primary w-full">
              Create Branch
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Branches;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getHistory, deleteSchema, deleteAllSchemas } from "../api/schemas";

const History = () => {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, type: null, id: null });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getHistory();
        setItems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmModal({ show: true, type: "single", id });
  };

  const handleDeleteAll = () => {
    setConfirmModal({ show: true, type: "all", id: null });
  };

  const confirmDelete = async () => {
    if (confirmModal.type === "single") {
      setDeleting(confirmModal.id);
      try {
        await deleteSchema(confirmModal.id);
        setItems((prev) => prev.filter((item) => item._id !== confirmModal.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete schema");
      } finally {
        setDeleting(null);
      }
    } else if (confirmModal.type === "all") {
      setDeletingAll(true);
      try {
        await deleteAllSchemas();
        setItems([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete all schemas");
      } finally {
        setDeletingAll(false);
      }
    }
    setConfirmModal({ show: false, type: null, id: null });
  };

  const cancelDelete = () => {
    setConfirmModal({ show: false, type: null, id: null });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Schema History</h1>
          <p className="text-slate mt-2">All your saved schemas in one place.</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {deletingAll ? "Deleting All..." : "Delete All"}
          </button>
        )}
      </div>

      {loading && <div className="data-card p-6">Loading history...</div>}
      {error && <div className="data-card p-6 text-amber">{error}</div>}

      {!loading && !error && (
        <div className="grid gap-4">
          {items.length === 0 && (
            <div className="data-card p-6 text-slate">No schemas generated yet.</div>
          )}
          {items.map((item) => (
            <Link
              key={item._id}
              to={`/schema/${item._id}`}
              className="data-card p-5 hover:shadow-soft transition group"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink flex-1">{item.inputText.slice(0, 60)}...</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-wave">
                    {item.workloadType}
                  </span>
                  {item.version && (
                    <span className="text-xs uppercase tracking-[0.2em] text-slate">
                      v{item.version}
                    </span>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, item._id)}
                    disabled={deleting === item._id}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition opacity-0 group-hover:opacity-100"
                  >
                    {deleting === item._id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate mt-2">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-blush/70 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-mist rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-wave/20 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/15 border border-red-400/40 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-ink mb-2">
                  {confirmModal.type === "all" ? "Delete All Schemas?" : "Delete Schema?"}
                </h3>
                <p className="text-slate text-sm">
                  {confirmModal.type === "all"
                    ? "Are you sure you want to delete ALL schemas? This action cannot be undone and will remove all version history."
                    : "Are you sure you want to delete this schema? This action cannot be undone."}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2.5 bg-blush text-ink rounded-lg hover:bg-blush/80 font-medium transition border border-wave/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition shadow-lg shadow-red-500/30"
              >
                {confirmModal.type === "all" ? "Delete All" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;

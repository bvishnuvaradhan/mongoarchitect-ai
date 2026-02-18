import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getHistory, deleteSchema, deleteAllSchemas } from "../api/schemas";

const History = () => {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

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
    
    if (!window.confirm("Are you sure you want to delete this schema?")) {
      return;
    }

    setDeleting(id);
    try {
      await deleteSchema(id);
      setItems((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete schema");
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL schemas? This cannot be undone.")) {
      return;
    }

    setDeletingAll(true);
    try {
      await deleteAllSchemas();
      setItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete all schemas");
    } finally {
      setDeletingAll(false);
    }
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
    </div>
  );
};

export default History;

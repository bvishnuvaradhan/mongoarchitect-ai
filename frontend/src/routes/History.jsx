import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getHistory } from "../api/schemas";

const History = () => {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Schema History</h1>
        <p className="text-slate mt-2">All your saved schemas in one place.</p>
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
              className="data-card p-5 hover:shadow-soft transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">{item.inputText.slice(0, 60)}...</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-wave">
                    {item.workloadType}
                  </span>
                  {item.version && (
                    <span className="text-xs uppercase tracking-[0.2em] text-slate">
                      v{item.version}
                    </span>
                  )}
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

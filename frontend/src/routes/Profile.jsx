import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../state/auth";
import { getHistory } from "../api/schemas";

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentSchemas, setRecentSchemas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const history = await getHistory();
        
        // Compute stats
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthCount = history.filter(
          (s) => new Date(s.createdAt) >= thisMonthStart
        ).length;

        // Find favorite workload
        const workloadCounts = {};
        history.forEach((s) => {
          const wl = s.workloadType || "general";
          workloadCounts[wl] = (workloadCounts[wl] || 0) + 1;
        });
        const favoriteWorkload = Object.entries(workloadCounts).sort(
          (a, b) => b[1] - a[1]
        )[0]?.[0] || "None";

        // Find favorite model
        const modelCounts = {};
        history.forEach((s) => {
          const m = s.model || "unknown";
          modelCounts[m] = (modelCounts[m] || 0) + 1;
        });
        const favoriteModel = Object.entries(modelCounts).sort(
          (a, b) => b[1] - a[1]
        )[0]?.[0] || "None";

        setStats({
          total: history.length,
          thisMonth: thisMonthCount,
          favoriteWorkload,
          favoriteModel
        });

        // Get recent 5 schemas
        const sorted = [...history].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setRecentSchemas(sorted.slice(0, 5));
      } catch (err) {
        console.error("Failed to load profile data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Profile</h1>
        <p className="text-slate mt-2">Your account details and usage summary.</p>
      </div>

      {/* Account Information */}
      <div className="data-card p-6 space-y-4">
        <h2 className="font-display text-xl">Account Information</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate">Email</p>
            <p className="font-semibold text-ink">{user?.email || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-slate">Member Since</p>
            <p className="font-semibold text-ink">{formatDate(user?.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Usage Overview */}
      <div className="data-card p-6 space-y-4">
        <h2 className="font-display text-xl">Usage Overview</h2>
        {loading ? (
          <p className="text-slate">Loading statistics...</p>
        ) : stats ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-ink/5">
              <p className="text-sm text-slate">Total Schemas</p>
              <p className="text-2xl font-display text-ink mt-1">{stats.total}</p>
            </div>
            <div className="p-4 rounded-lg bg-ink/5">
              <p className="text-sm text-slate">This Month</p>
              <p className="text-2xl font-display text-ink mt-1">{stats.thisMonth}</p>
            </div>
            <div className="p-4 rounded-lg bg-ink/5">
              <p className="text-sm text-slate">Favorite Workload</p>
              <p className="text-lg font-display text-ink mt-1 capitalize">
                {stats.favoriteWorkload}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-ink/5">
              <p className="text-sm text-slate">Favorite Model</p>
              <p className="text-lg font-display text-ink mt-1 capitalize">
                {stats.favoriteModel}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-slate">No usage data available.</p>
        )}
      </div>

      {/* Recent Activity */}
      <div className="data-card p-6 space-y-4">
        <h2 className="font-display text-xl">Recent Activity</h2>
        {loading ? (
          <p className="text-slate">Loading recent schemas...</p>
        ) : recentSchemas.length > 0 ? (
          <div className="space-y-2">
            {recentSchemas.map((schema) => (
              <Link
                key={schema._id}
                to={`/schema/${schema._id}`}
                className="block p-3 rounded-lg border border-slate/20 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink truncate">
                      {schema.prompt?.substring(0, 60) || "Untitled Schema"}
                      {schema.prompt?.length > 60 && "..."}
                    </p>
                    <p className="text-sm text-slate mt-1">
                      <span className="capitalize">{schema.workloadType || "general"}</span>
                      {schema.model && (
                        <>
                          {" · "}
                          <span className="capitalize">{schema.model}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <p className="text-sm text-slate whitespace-nowrap">
                    {formatRelativeTime(schema.createdAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-slate">No schemas generated yet.</p>
        )}
      </div>

      {/* Account Actions */}
      <div className="data-card p-6 space-y-4">
        <h2 className="font-display text-xl">Account Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg border border-slate/20 hover:border-slate/40 text-ink font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;

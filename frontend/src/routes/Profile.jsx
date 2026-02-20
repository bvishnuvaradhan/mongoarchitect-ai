import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../state/auth";
import { getHistory } from "../api/schemas";
import { changePassword } from "../api/auth";

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentSchemas, setRecentSchemas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

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

        // Get recent 3 schemas
        const sorted = [...history].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setRecentSchemas(sorted.slice(0, 3));
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

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess("");
        setPasswordError("");
      }, 1500);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
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
        
        <div className="pt-4 border-t border-slate/20">
          <button
            onClick={() => setShowPasswordForm(true)}
            className="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Change Password
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="data-card w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl">Change Password</h2>
              <button
                onClick={() => {
                  setShowPasswordForm(false);
                  setPasswordError("");
                  setPasswordSuccess("");
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                className="text-slate hover:text-ink transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm text-slate mb-1">Current Password</label>
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate/20 px-4 py-2"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate mb-1">New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate/20 px-4 py-2"
                  required
                  minLength={8}
                />
                <p className="text-xs text-slate mt-1">Must be at least 8 characters</p>
              </div>
              
              <div>
                <label className="block text-sm text-slate mb-1">Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate/20 px-4 py-2"
                  required
                />
              </div>
              
              {passwordError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-600">{passwordError}</p>
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-green-600">{passwordSuccess}</p>
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPasswordError("");
                    setPasswordSuccess("");
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate/20 hover:border-slate/40 text-ink font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {passwordLoading ? "Changing..." : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                      {(() => {
                        const text = schema.inputText || "Untitled Schema";
                        // Extract only the first line before any "Workload Type:" or "Refinement:" markers
                        const firstLine = text.split('\n')[0];
                        const cleanText = firstLine.split(/Workload Type:|Refinement:/)[0].trim();
                        const display = cleanText.substring(0, 60);
                        return display + (cleanText.length > 60 ? "..." : "");
                      })()}
                    </p>
                    {schema.model && (
                      <p className="text-sm text-slate mt-1 capitalize">{schema.model}</p>
                    )}
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

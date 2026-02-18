import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import { getHistory } from "../api/schemas";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalSchemas: 0,
    recentSchemas: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getHistory();
        setStats({
          totalSchemas: data.length,
          recentSchemas: data.slice(0, 5),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="text-slate mt-2">
          Welcome to MongoDB Architect AI. Design intelligent schemas using natural language.
        </p>
      </div>

      {/* Quick Actions */}
      <section className="grid gap-4 md:grid-cols-3">
        <Link
          to="/chat"
          className="data-card p-6 hover:shadow-soft transition cursor-pointer group"
        >
          <div className="text-3xl mb-2">✨</div>
          <h3 className="font-semibold text-ink group-hover:text-wave transition">
            New Schema
          </h3>
          <p className="text-sm text-slate mt-1">Create a new schema with AI guidance</p>
        </Link>

        <Link
          to="/history"
          className="data-card p-6 hover:shadow-soft transition cursor-pointer group"
        >
          <div className="text-3xl mb-2">📋</div>
          <h3 className="font-semibold text-ink group-hover:text-wave transition">
            Schema History
          </h3>
          <p className="text-sm text-slate mt-1">View all your saved schemas</p>
        </Link>

        <Link
          to="/compare"
          className="data-card p-6 hover:shadow-soft transition cursor-pointer group"
        >
          <div className="text-3xl mb-2">🔍</div>
          <h3 className="font-semibold text-ink group-hover:text-wave transition">
            Compare Schemas
          </h3>
          <p className="text-sm text-slate mt-1">Compare different schema versions</p>
        </Link>
      </section>

      {/* Stats */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="data-card p-6">
          <div className="flex items-baseline justify-between">
            <p className="text-sm uppercase tracking-[0.3em] text-wave font-semibold">
              Total Schemas
            </p>
            {!loading && (
              <p className="font-display text-4xl text-ink">{stats.totalSchemas}</p>
            )}
          </div>
          <p className="text-sm text-slate mt-4">
            {stats.totalSchemas === 0
              ? "Create your first schema to get started"
              : `You have generated ${stats.totalSchemas} schema${stats.totalSchemas !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="data-card p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-wave font-semibold">
            Recent Activity
          </p>
          <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-slate">Loading...</p>
            ) : stats.recentSchemas.length === 0 ? (
              <p className="text-sm text-slate">No schemas yet</p>
            ) : (
              stats.recentSchemas.map((schema) => (
                <Link
                  key={schema._id}
                  to={`/schema/${schema._id}`}
                  className="block text-sm p-2 rounded hover:bg-mist/50 transition text-slate hover:text-wave truncate"
                >
                  {schema.inputText.slice(0, 50)}...
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="data-card p-6 text-amber">
          <p>{error}</p>
        </div>
      )}

      {/* About Section */}
      <section className="data-card p-8">
        <h2 className="font-display text-2xl mb-4">How It Works</h2>
        <div className="grid gap-6 md:grid-cols-3 text-sm text-slate">
          <div>
            <div className="text-lg font-semibold text-wave mb-2">1. Describe</div>
            <p>Use natural language to describe your data model and requirements.</p>
          </div>
          <div>
            <div className="text-lg font-semibold text-wave mb-2">2. Generate</div>
            <p>AI analyzes your requirements and generates an optimal MongoDB schema.</p>
          </div>
          <div>
            <div className="text-lg font-semibold text-wave mb-2">3. Refine</div>
            <p>Chat with the AI to refine and improve your schema iteratively.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;

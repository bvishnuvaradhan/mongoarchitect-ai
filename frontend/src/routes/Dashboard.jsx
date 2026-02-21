import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getHistory } from "../api/schemas";
import { analyzeCostEstimation } from "../api/costEstimation";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalSchemas: 0,
    recentSchemas: [],
    recentlyModified: 0,
    atRiskSchemas: 0,
    optimizationPotential: 0,
    optimizationSavings: 0,
    costSummary: null,
    costTrend: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadStats = async () => {
      try {
        const schemas = await getHistory();
        // Simulate recently modified and at-risk schemas
        const recentlyModified = schemas.filter(s => s.updatedAt && Date.now() - new Date(s.updatedAt).getTime() < 7*24*60*60*1000).length;
        const atRiskSchemas = schemas.filter(s => s.riskLevel === 'high' || s.riskLevel === 'critical').length;
        // Simulate optimization potential and cost
        let optimizationPotential = 0, optimizationSavings = 0, costSummary = null, costTrend = [];
        if (schemas.length > 0) {
          // Use the most recent schema for cost estimation
          try {
            const costData = await analyzeCostEstimation(schemas[0]._id);
            costSummary = costData?.analysis?.current_metrics || null;
            optimizationPotential = costData?.analysis?.recommendations?.filter(r => r.priority === 'high' || r.priority === 'critical').length || 0;
            optimizationSavings = costData?.analysis?.summary?.annual_savings || 0;
            costTrend = costData?.analysis?.trend_30d || [];
          } catch {}
        }
        setStats({
          totalSchemas: schemas.length,
          recentSchemas: schemas.slice(0, 5),
          recentlyModified,
          atRiskSchemas,
          optimizationPotential,
          optimizationSavings,
          costSummary,
          costTrend,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  // Mini cost trend SVG
  const renderCostTrend = () => {
    const trend = stats.costTrend || [];
    if (!trend.length) return <div className="text-xs text-slate">No data</div>;
    const max = Math.max(...trend.map(d => d.cost));
    const min = Math.min(...trend.map(d => d.cost));
    const w = 120, h = 36, pad = 6;
    const points = trend.map((d, i) => {
      const x = pad + (w-2*pad) * (i/(trend.length-1));
      const y = h - pad - ((d.cost-min)/(max-min||1))*(h-2*pad);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={w} height={h} className="block">
        <polyline fill="none" stroke="#38bdf8" strokeWidth="2" points={points} />
        <circle cx={w-pad} cy={h-pad-((trend[trend.length-1].cost-min)/(max-min||1))*(h-2*pad)} r="3" fill="#38bdf8" />
      </svg>
    );
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl bg-gradient-to-r from-wave/10 to-amber/10 p-6 mb-2 flex flex-col gap-2 shadow-soft">
        <h1 className="font-display text-3xl text-wave">Welcome back 👋</h1>
        <p className="text-lg text-ink/80">Hope you're having a productive day! What would you like to work on next?</p>
      </div>
      <div>
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="text-slate mt-2">What’s going on right now?</p>
      </div>
      {/* Quick Actions Panel */}
      <section className="flex flex-wrap gap-4">
        <Link to="/chat" className="flex-1 min-w-[180px] data-card p-4 flex items-center gap-3 hover:shadow-soft transition cursor-pointer">
          <span className="text-2xl">➕</span> <span className="font-semibold">Generate New Schema</span>
        </Link>
        <Link to="/compare" className="flex-1 min-w-[180px] data-card p-4 flex items-center gap-3 hover:shadow-soft transition cursor-pointer">
          <span className="text-2xl">⚖️</span> <span className="font-semibold">Compare Schemas</span>
        </Link>
        <Link to="/advisor" className="flex-1 min-w-[180px] data-card p-4 flex items-center gap-3 hover:shadow-soft transition cursor-pointer">
          <span className="text-2xl">🧠</span> <span className="font-semibold">Get Modeling Advice</span>
        </Link>
      </section>
      {/* Recent Activity Section */}
      <section>
        <div className="font-bold text-lg mb-2">Recent Activity</div>
        <div className="data-card p-4">
          {loading ? (
            <div className="text-slate">Loading...</div>
          ) : stats.recentSchemas.length === 0 ? (
            <div className="text-slate">No recent activity</div>
          ) : (
            <ul className="divide-y divide-mist/40">
              {stats.recentSchemas.map((schema) => (
                <li key={schema._id} className="py-2 flex items-center gap-3">
                  <span className="text-wave">📦</span>
                  <Link to={`/schema/${schema._id}`} className="flex-1 truncate hover:text-wave">
                    {(schema.inputText || '')
                      .replace(/\bworkload\b:?[^\n\r]*/gi, '')
                      .replace(/\brefinements?\b:?[^\n\r]*/gi, '')
                      .replace(/\s{2,}/g, ' ')
                      .trim()
                      .slice(0, 50)}...
                  </Link>
                  <span className="text-xs text-slate ml-2">{schema.updatedAt ? new Date(schema.updatedAt).toLocaleString() : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Link to="/history" className="px-4 py-2 rounded bg-wave text-white text-sm font-semibold shadow-soft hover:bg-wave/90 transition">
            View Full History
          </Link>
        </div>
      </section>
      {error && (
        <div className="data-card p-6 text-amber">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

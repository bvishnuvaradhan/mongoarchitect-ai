import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Sparkline from "../components/analytics/Sparkline";
import { getHistory } from "../api/schemas";

const sum = (values) => values.reduce((total, value) => total + value, 0);
const avg = (values) => (values.length ? sum(values) / values.length : 0);
const toTimestamp = (value) => (value ? new Date(value).getTime() : 0);
const parseDateInput = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};
const toStartOfDay = (value) => {
  const date = parseDateInput(value);
  return date ? date.setHours(0, 0, 0, 0) : null;
};
const toEndOfDay = (value) => {
  const date = parseDateInput(value);
  return date ? date.setHours(23, 59, 59, 999) : null;
};
const formatStat = (value) => (Number.isFinite(value) ? value.toFixed(1) : "n/a");
const formatDelta = (value) => {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
};

const countSchemaFields = (schema) => {
  if (!schema || typeof schema !== "object") return 0;
  let count = 0;
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    Object.keys(node).forEach((key) => {
      count += 1;
      walk(node[key]);
    });
  };
  walk(schema);
  return count;
};

const maxSchemaDepth = (schema) => {
  if (!schema || typeof schema !== "object") return 0;
  const walk = (node, depth = 1) => {
    if (!node || typeof node !== "object") return depth;
    const depths = Object.values(node).map((value) => walk(value, depth + 1));
    return Math.max(depth, ...depths);
  };
  return walk(schema, 1);
};

const tally = (items) => {
  const counts = new Map();
  items.forEach((item) => {
    if (!item) return;
    counts.set(item, (counts.get(item) || 0) + 1);
  });
  return counts;
};

const topEntries = (counts, limit = 5) => {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
};

const resolveRootId = (item, lookup) => {
  let current = item;
  const visited = new Set();

  while (current?.parentId && lookup.has(current.parentId)) {
    if (visited.has(current.parentId)) break;
    visited.add(current.parentId);
    current = lookup.get(current.parentId);
  }

  return current?.parentId || current?._id || item._id;
};

const pickLatest = (items) => {
  return items.reduce((latest, item) => {
    if (!latest) return item;
    const latestVersion = typeof latest.version === "number" ? latest.version : null;
    const currentVersion = typeof item.version === "number" ? item.version : null;

    if (latestVersion !== null && currentVersion !== null) {
      return currentVersion > latestVersion ? item : latest;
    }

    return toTimestamp(item.createdAt) > toTimestamp(latest.createdAt) ? item : latest;
  }, null);
};

const riskTier = (score) => {
  if (!Number.isFinite(score)) return "unknown";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
};

const buildTrend = (items, selector) =>
  items
    .map((item) => selector(item))
    .filter((value) => Number.isFinite(value));

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const computeFallbackRisk = ({ depth, fields, warnings, unboundedRisks }) => {
  const score = depth * 8 + fields / 10 + warnings * 6 + unboundedRisks * 12;
  return clamp(score, 0, 100);
};

const computeFallbackPerformance = ({ depth, fields, indexes, warnings, unboundedRisks }) => {
  const penalty = depth * 6 + fields / 8 + warnings * 4 + unboundedRisks * 8;
  const boost = indexes * 5;
  return clamp(100 - penalty + boost, 0, 100);
};

const trendStats = (values) => {
  if (!values.length) {
    return { hasData: false };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const last = values[values.length - 1];
  const prev = values.length > 1 ? values[values.length - 2] : null;
  const delta = prev === null ? null : last - prev;

  return {
    hasData: true,
    min,
    max,
    last,
    delta,
  };
};

const tooltipText = (label, stats) => {
  if (!stats?.hasData) return `${label}: Not enough data`;
  const deltaLabel = stats.delta === null ? "n/a" : formatDelta(stats.delta);
  return `${label} | Min ${formatStat(stats.min)} | Max ${formatStat(stats.max)} | Last ${formatStat(stats.last)} | Delta ${deltaLabel}`;
};

const Analytics = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const lastParamsRef = useRef("");
  const [scope, setScope] = useState(() => searchParams.get("scope") || "all");
  const [workloadFilter, setWorkloadFilter] = useState(
    () => searchParams.get("workload") || "all"
  );
  const [riskFilter, setRiskFilter] = useState(
    () => searchParams.get("risk") || "all"
  );
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [startDate, setStartDate] = useState(
    () => searchParams.get("start") || ""
  );
  const [endDate, setEndDate] = useState(() => searchParams.get("end") || "");

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const data = await getHistory();
        setHistory(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();

    if (scope !== "all") params.set("scope", scope);
    if (workloadFilter !== "all") params.set("workload", workloadFilter);
    if (riskFilter !== "all") params.set("risk", riskFilter);
    if (query) params.set("q", query);
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);

    const next = params.toString();
    if (next !== searchParams.toString()) {
      lastParamsRef.current = next;
      setSearchParams(params, { replace: true });
    }
  }, [
    scope,
    workloadFilter,
    riskFilter,
    query,
    startDate,
    endDate,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    const current = searchParams.toString();
    if (current === lastParamsRef.current) {
      return;
    }

    const nextScope = searchParams.get("scope") || "all";
    const nextWorkload = searchParams.get("workload") || "all";
    const nextRisk = searchParams.get("risk") || "all";
    const nextQuery = searchParams.get("q") || "";
    const nextStart = searchParams.get("start") || "";
    const nextEnd = searchParams.get("end") || "";

    setScope(nextScope);
    setWorkloadFilter(nextWorkload);
    setRiskFilter(nextRisk);
    setQuery(nextQuery);
    setStartDate(nextStart);
    setEndDate(nextEnd);
  }, [
    searchParams,
  ]);

  const historyLookup = useMemo(
    () => new Map(history.map((item) => [item._id, item])),
    [history]
  );

  const scopedHistory = useMemo(() => {
    if (scope === "all") return history;
    const grouped = new Map();

    history.forEach((item) => {
      const rootId = resolveRootId(item, historyLookup);
      if (!grouped.has(rootId)) grouped.set(rootId, []);
      grouped.get(rootId).push(item);
    });

    return Array.from(grouped.values())
      .map((items) => pickLatest(items))
      .filter(Boolean);
  }, [history, historyLookup, scope]);

  const workloadOptions = useMemo(() => {
    const values = Array.from(
      new Set(history.map((item) => item.workloadType).filter(Boolean))
    );
    return values.sort();
  }, [history]);

  const filteredHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const startTs = toStartOfDay(startDate);
    const endTs = toEndOfDay(endDate);
    const normalizedStart =
      startTs !== null && endTs !== null && startTs > endTs ? endTs : startTs;
    const normalizedEnd =
      startTs !== null && endTs !== null && startTs > endTs ? startTs : endTs;

    return scopedHistory
      .filter((item) => {
        const createdAt = toTimestamp(item.createdAt);
        if (normalizedStart !== null && createdAt < normalizedStart) {
          return false;
        }
        if (normalizedEnd !== null && createdAt > normalizedEnd) {
          return false;
        }

        if (workloadFilter !== "all" && item.workloadType !== workloadFilter) {
          return false;
        }

        const tier = riskTier(item.result?.futureRiskScore);
        if (riskFilter !== "all" && tier !== riskFilter) {
          return false;
        }

        if (normalizedQuery) {
          const haystack = `${item.inputText || ""}`.toLowerCase();
          if (!haystack.includes(normalizedQuery)) return false;
        }

        return true;
      })
      .sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
  }, [scopedHistory, workloadFilter, riskFilter, query, startDate, endDate]);

  const analytics = useMemo(() => {
    if (!filteredHistory.length) {
      return null;
    }

    const collectionsCounts = [];
    const fieldCounts = [];
    const depthCounts = [];
    const versionCounts = [];
    const riskScores = [];
    const performanceScores = [];
    const indexCounts = [];
    const workloadCounts = tally(
      filteredHistory.map((item) => item.workloadType)
    );
    const entityCounts = tally(
      filteredHistory.flatMap((item) => item.result?.entities || [])
    );
    const warningCounts = tally(
      filteredHistory.flatMap((item) => item.result?.warnings || [])
    );
    const growthRiskCounts = tally(
      filteredHistory.flatMap((item) =>
        Object.entries(item.result?.growthRiskMap || {})
          .filter(([, value]) => value === "unbounded")
          .map(([key]) => key)
      )
    );

    let embedCount = 0;
    let referenceCount = 0;
    let shardingSchemas = 0;
    const shardingTargets = tally(
      filteredHistory.flatMap((item) =>
        (item.result?.autoSharding || []).map((entry) => entry.collection)
      )
    );

    filteredHistory.forEach((item) => {
      const schema = item.result?.schema || {};
      const warningsCount = item.result?.warnings?.length || 0;
      const unboundedCount = Object.values(item.result?.growthRiskMap || {}).filter(
        (value) => value === "unbounded"
      ).length;
      const fieldCount =
        item.result?.metrics?.fields ?? countSchemaFields(schema);
      const depthCount =
        item.result?.metrics?.depth ?? maxSchemaDepth(schema);
      const indexCount = Array.isArray(item.result?.indexes)
        ? item.result.indexes.length
        : 0;
      const fallbackRisk = computeFallbackRisk({
        depth: depthCount,
        fields: fieldCount,
        warnings: warningsCount,
        unboundedRisks: unboundedCount,
      });
      const fallbackPerformance = computeFallbackPerformance({
        depth: depthCount,
        fields: fieldCount,
        indexes: indexCount,
        warnings: warningsCount,
        unboundedRisks: unboundedCount,
      });

      collectionsCounts.push(Object.keys(schema).length);
      fieldCounts.push(fieldCount);
      depthCounts.push(depthCount);
      if (typeof item.version === "number") {
        versionCounts.push(item.version);
      }
      if (typeof item.result?.futureRiskScore === "number") {
        riskScores.push(item.result.futureRiskScore);
      } else {
        riskScores.push(fallbackRisk);
      }
      if (typeof item.result?.performanceIndex === "number") {
        performanceScores.push(item.result.performanceIndex);
      } else {
        performanceScores.push(fallbackPerformance);
      }
      indexCounts.push(indexCount);

      if (item.result?.autoSharding?.length) {
        shardingSchemas += 1;
      }

      Object.values(item.result?.decisions || {}).forEach((value) => {
        if (value === "embed") embedCount += 1;
        if (value === "reference") referenceCount += 1;
      });
    });

    const totalRelations = embedCount + referenceCount;
    const embedRatio = totalRelations ? (embedCount / totalRelations) * 100 : 0;
    const refRatio = totalRelations ? (referenceCount / totalRelations) * 100 : 0;

    const trends = {
      collections: buildTrend(filteredHistory, (item) =>
        Number.isFinite(item.result?.metrics?.collections)
          ? item.result?.metrics?.collections
          : Object.keys(item.result?.schema || {}).length
      ),
      fields: buildTrend(filteredHistory, (item) =>
        Number.isFinite(item.result?.metrics?.fields)
          ? item.result?.metrics?.fields
          : countSchemaFields(item.result?.schema || {})
      ),
      risk: buildTrend(filteredHistory, (item) => {
        if (Number.isFinite(item.result?.futureRiskScore)) {
          return item.result.futureRiskScore;
        }
        const warningsCount = item.result?.warnings?.length || 0;
        const unboundedCount = Object.values(item.result?.growthRiskMap || {}).filter(
          (value) => value === "unbounded"
        ).length;
        const fields =
          item.result?.metrics?.fields ?? countSchemaFields(item.result?.schema || {});
        const depth =
          item.result?.metrics?.depth ?? maxSchemaDepth(item.result?.schema || {});
        return computeFallbackRisk({
          depth,
          fields,
          warnings: warningsCount,
          unboundedRisks: unboundedCount,
        });
      }),
      performance: buildTrend(filteredHistory, (item) => {
        if (Number.isFinite(item.result?.performanceIndex)) {
          return item.result.performanceIndex;
        }
        const warningsCount = item.result?.warnings?.length || 0;
        const unboundedCount = Object.values(item.result?.growthRiskMap || {}).filter(
          (value) => value === "unbounded"
        ).length;
        const fields =
          item.result?.metrics?.fields ?? countSchemaFields(item.result?.schema || {});
        const depth =
          item.result?.metrics?.depth ?? maxSchemaDepth(item.result?.schema || {});
        const indexes = Array.isArray(item.result?.indexes)
          ? item.result.indexes.length
          : 0;
        return computeFallbackPerformance({
          depth,
          fields,
          indexes,
          warnings: warningsCount,
          unboundedRisks: unboundedCount,
        });
      }),
    };

    const trendMeta = {
      collections: trendStats(trends.collections),
      fields: trendStats(trends.fields),
      risk: trendStats(trends.risk),
      performance: trendStats(trends.performance),
    };

    return {
      totalSchemas: filteredHistory.length,
      avgCollections: avg(collectionsCounts),
      avgFields: avg(fieldCounts),
      avgDepth: avg(depthCounts),
      avgVersion: avg(versionCounts),
      avgRefinements: avg(versionCounts.map((value) => Math.max(0, value - 1))),
      avgRisk: avg(riskScores),
      avgPerformance: avg(performanceScores),
      avgIndexes: avg(indexCounts),
      embedRatio,
      refRatio,
      topEntities: topEntries(entityCounts, 5),
      workloadMix: topEntries(workloadCounts, 5),
      topWarnings: topEntries(warningCounts, 5),
      topGrowthRisks: topEntries(growthRiskCounts, 5),
      shardingSchemas,
      shardingTargets: topEntries(shardingTargets, 5),
      trends,
      trendMeta,
    };
  }, [filteredHistory, scopedHistory.length]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Analytics</h1>
        <p className="text-slate mt-2">Insights across all generated schemas.</p>
      </div>

      {loading && (
        <div className="data-card p-6 text-slate">Loading analytics...</div>
      )}

      {error && (
        <div className="data-card p-6 text-amber">{error}</div>
      )}

      {!loading && !error && history.length > 0 && (
        <div className="data-card p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-2 min-w-[180px]">
              <label className="text-xs uppercase tracking-[0.2em] text-wave font-semibold">
                Workload
              </label>
              <select
                value={workloadFilter}
                onChange={(event) => setWorkloadFilter(event.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-mist border border-slate/20 text-sm text-ink"
              >
                <option value="all">All workloads</option>
                {workloadOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 min-w-[160px]">
              <label className="text-xs uppercase tracking-[0.2em] text-wave font-semibold">
                Risk tier
              </label>
              <select
                value={riskFilter}
                onChange={(event) => setRiskFilter(event.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-mist border border-slate/20 text-sm text-ink"
              >
                <option value="all">All tiers</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 min-w-[220px]">
              <label className="text-xs uppercase tracking-[0.2em] text-wave font-semibold">
                Date range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-mist border border-slate/20 text-sm text-ink"
                />
                <span className="text-slate text-xs">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-mist border border-slate/20 text-sm text-ink"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-[200px]">
              <label className="text-xs uppercase tracking-[0.2em] text-wave font-semibold">
                Version scope
              </label>
              <div className="inline-flex rounded-full bg-blush/60 p-1">
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`px-3 py-1 text-xs rounded-full transition ${
                    scope === "all"
                      ? "bg-wave text-white"
                      : "text-ink hover:bg-white/60"
                  }`}
                >
                  All versions
                </button>
                <button
                  type="button"
                  onClick={() => setScope("latest")}
                  className={`px-3 py-1 text-xs rounded-full transition ${
                    scope === "latest"
                      ? "bg-wave text-white"
                      : "text-ink hover:bg-white/60"
                  }`}
                >
                  Latest only
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setWorkloadFilter("all");
                setRiskFilter("all");
                setScope("all");
                setStartDate("");
                setEndDate("");
              }}
              className="px-4 py-2 rounded-xl border border-slate/20 text-sm text-ink hover:bg-blush/60 transition"
            >
              Reset filters
            </button>
          </div>
          <p className="text-xs text-slate mt-4">
            Showing {filteredHistory.length} of {scopedHistory.length} entries
          </p>
        </div>
      )}

      {!loading && !error && analytics && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="data-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-wave font-semibold">Schemas</p>
                <span
                  className="text-xs text-slate border border-slate/20 rounded-full w-5 h-5 flex items-center justify-center"
                  title={tooltipText("Schemas", analytics.trendMeta.collections)}
                >
                  i
                </span>
              </div>
              <p className="text-3xl font-bold text-ink mt-2">{analytics.totalSchemas}</p>
              <p className="text-xs text-slate mt-2">Avg versions: {analytics.avgVersion.toFixed(1)}</p>
              <p className="text-xs text-slate">Avg refinements: {analytics.avgRefinements.toFixed(1)}</p>
              <div className="mt-4">
                <Sparkline
                  values={analytics.trends.collections}
                  tooltip={tooltipText("Schemas", analytics.trendMeta.collections)}
                />
              </div>
            </div>
            <div className="data-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-wave font-semibold">Complexity</p>
                <span
                  className="text-xs text-slate border border-slate/20 rounded-full w-5 h-5 flex items-center justify-center"
                  title={tooltipText("Complexity", analytics.trendMeta.fields)}
                >
                  i
                </span>
              </div>
              <p className="text-3xl font-bold text-ink mt-2">{analytics.avgCollections.toFixed(1)}</p>
              <p className="text-xs text-slate mt-2">Avg fields: {analytics.avgFields.toFixed(1)}</p>
              <div className="mt-4">
                <Sparkline
                  values={analytics.trends.fields}
                  stroke="#C76A44"
                  fill="rgba(199, 106, 68, 0.2)"
                  tooltip={tooltipText("Complexity", analytics.trendMeta.fields)}
                />
              </div>
            </div>
            <div className="data-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-wave font-semibold">Risk</p>
                <span
                  className="text-xs text-slate border border-slate/20 rounded-full w-5 h-5 flex items-center justify-center"
                  title={tooltipText("Risk", analytics.trendMeta.risk)}
                >
                  i
                </span>
              </div>
              <p className="text-3xl font-bold text-ink mt-2">{analytics.avgRisk.toFixed(1)}</p>
              <p className="text-xs text-slate mt-2">Avg depth: {analytics.avgDepth.toFixed(1)}</p>
              <div className="mt-4">
                <Sparkline
                  values={analytics.trends.risk}
                  stroke="#C64B5A"
                  fill="rgba(198, 75, 90, 0.18)"
                  tooltip={tooltipText("Risk", analytics.trendMeta.risk)}
                />
              </div>
            </div>
            <div className="data-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-wave font-semibold">Performance</p>
                <span
                  className="text-xs text-slate border border-slate/20 rounded-full w-5 h-5 flex items-center justify-center"
                  title={tooltipText("Performance", analytics.trendMeta.performance)}
                >
                  i
                </span>
              </div>
              <p className="text-3xl font-bold text-ink mt-2">{analytics.avgPerformance.toFixed(1)}</p>
              <p className="text-xs text-slate mt-2">Avg indexes: {analytics.avgIndexes.toFixed(1)}</p>
              <div className="mt-4">
                <Sparkline
                  values={analytics.trends.performance}
                  stroke="#2A9D8F"
                  fill="rgba(42, 157, 143, 0.2)"
                  tooltip={tooltipText("Performance", analytics.trendMeta.performance)}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="data-card p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-wave font-semibold">Embed vs Reference</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between text-ink">
                  <span>Embed</span>
                  <span>{analytics.embedRatio.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-blush/60 overflow-hidden">
                  <div className="h-full bg-wave" style={{ width: `${analytics.embedRatio}%` }} />
                </div>
                <div className="flex items-center justify-between text-ink">
                  <span>Reference</span>
                  <span>{analytics.refRatio.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-blush/60 overflow-hidden">
                  <div className="h-full bg-amber" style={{ width: `${analytics.refRatio}%` }} />
                </div>
              </div>
            </div>

            <div className="data-card p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-wave font-semibold">Top Entities</p>
              <div className="mt-4 space-y-2 text-sm">
                {analytics.topEntities.length === 0 && (
                  <p className="text-slate">No data yet.</p>
                )}
                {analytics.topEntities.map(([entity, count]) => (
                  <div key={entity} className="flex items-center justify-between text-ink">
                    <span>{entity}</span>
                    <span className="text-slate">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="data-card p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-wave font-semibold">Workload Mix</p>
              <div className="mt-4 space-y-2 text-sm">
                {analytics.workloadMix.map(([workload, count]) => (
                  <div key={workload} className="flex items-center justify-between text-ink">
                    <span>{workload}</span>
                    <span className="text-slate">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="data-card p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-wave font-semibold">Warnings Heatmap</p>
              <div className="mt-4 space-y-2 text-sm">
                {analytics.topWarnings.length === 0 && (
                  <p className="text-slate">No warnings captured.</p>
                )}
                {analytics.topWarnings.map(([warning, count]) => (
                  <div key={warning} className="flex items-center justify-between text-ink">
                    <span className="truncate max-w-[70%]">{warning}</span>
                    <span className="text-slate">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="data-card p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-wave font-semibold">Growth Risks</p>
              <div className="mt-4 space-y-2 text-sm">
                {analytics.topGrowthRisks.length === 0 && (
                  <p className="text-slate">No unbounded risks yet.</p>
                )}
                {analytics.topGrowthRisks.map(([relation, count]) => (
                  <div key={relation} className="flex items-center justify-between text-ink">
                    <span className="truncate max-w-[70%]">{relation}</span>
                    <span className="text-slate">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="data-card p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-wave font-semibold">Sharding Suggestions</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between text-ink">
                  <span>Schemas with suggestions</span>
                  <span className="text-slate">{analytics.shardingSchemas}</span>
                </div>
                {analytics.shardingTargets.length === 0 && (
                  <p className="text-slate">No sharding hints yet.</p>
                )}
                {analytics.shardingTargets.map(([collection, count]) => (
                  <div key={collection} className="flex items-center justify-between text-ink">
                    <span>{collection}</span>
                    <span className="text-slate">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && !error && history.length > 0 && !analytics && (
        <div className="data-card p-6 text-slate">
          No analytics match the current filters.
        </div>
      )}
    </div>
  );
};

export default Analytics;

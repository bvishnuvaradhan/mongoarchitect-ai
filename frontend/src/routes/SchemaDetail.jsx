import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import JsonPanel from "../components/JsonPanel";
import { getSchemaById, refineSchema } from "../api/schemas";

const SchemaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  /* ================================
     STATE
  ================================== */

  const [versionHistory, setVersionHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [refinementText, setRefinementText] = useState("");
  const [refining, setRefining] = useState(false);

  /* ================================
     LOAD VERSION CHAIN
  ================================== */

  const loadVersions = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError("");

    try {
      const data = await getSchemaById(id);

      const chain = [data];
      let current = data;

      // Load full parent chain
      while (current?.parentId) {
        const parent = await getSchemaById(current.parentId);
        chain.unshift(parent);
        current = parent;
      }

      setVersionHistory(chain);
      setCurrentIndex(chain.length - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schema");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  /* ================================
     METRICS ENGINE
  ================================== */

  const computeMetrics = useCallback((schema) => {
    let fieldCount = 0;
    let maxDepth = 0;

    const traverse = (obj, depth = 1) => {
      if (!obj || typeof obj !== "object") return;
      maxDepth = Math.max(maxDepth, depth);

      for (const key in obj) {
        fieldCount++;
        if (typeof obj[key] === "object" && obj[key] !== null) {
          traverse(obj[key], depth + 1);
        }
      }
    };

    traverse(schema);

    const collectionCount = schema && typeof schema === "object" 
      ? Object.keys(schema).length 
      : 0;

    return {
      collectionCount,
      fieldCount,
      depth: maxDepth,
    };
  }, []);

  /* ================================
     DIFF ENGINE (cleaner format)
  ================================== */

  const buildDiff = useCallback((before, after, prefix = "") => {
    const lines = [];

    const beforeKeys =
      before && typeof before === "object" ? Object.keys(before) : [];
    const afterKeys =
      after && typeof after === "object" ? Object.keys(after) : [];

    const keys = Array.from(new Set([...beforeKeys, ...afterKeys])).sort();

    for (const key of keys) {
      const path = prefix ? `${prefix}.${key}` : key;

      const beforeVal = before?.[key];
      const afterVal = after?.[key];

      // Added
      if (beforeVal === undefined && afterVal !== undefined) {
        lines.push({ type: "added", text: `+ ${path}` });
        continue;
      }

      // Removed
      if (beforeVal !== undefined && afterVal === undefined) {
        lines.push({ type: "removed", text: `- ${path}` });
        continue;
      }

      // Nested object
      if (
        beforeVal !== null &&
        afterVal !== null &&
        typeof beforeVal === "object" &&
        typeof afterVal === "object" &&
        !Array.isArray(beforeVal) &&
        !Array.isArray(afterVal)
      ) {
        lines.push(...buildDiff(beforeVal, afterVal, path));
        continue;
      }

      // Modified
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        lines.push({ type: "modified", text: `~ ${path}` });
      }
    }

    return lines;
  }, []);

  /* ================================
     DERIVED STATE & METRICS
  ================================== */

  const currentSchema = versionHistory[currentIndex];
  const previousSchema = currentIndex > 0 ? versionHistory[currentIndex - 1] : null;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < versionHistory.length - 1;

  const currentMetrics = useMemo(
    () => computeMetrics(currentSchema?.result?.schema),
    [currentSchema, computeMetrics]
  );

  const previousMetrics = useMemo(
    () => computeMetrics(previousSchema?.result?.schema),
    [previousSchema, computeMetrics]
  );

  const structuralWarning = useMemo(() => {
    if (!previousMetrics || !currentMetrics || !hasPrevious) return null;

    if (currentMetrics.fieldCount > previousMetrics.fieldCount * 2) {
      return "⚠ Possible schema over-expansion detected.";
    }

    if (currentMetrics.depth > previousMetrics.depth + 2) {
      return "⚠ Sudden nesting depth increase detected.";
    }

    return null;
  }, [currentMetrics, previousMetrics, hasPrevious]);

  const diffLines = useMemo(() => {
    if (!previousSchema) return [];

    const previous = previousSchema?.result?.schema;
    const current = currentSchema?.result?.schema;

    if (!previous || !current) return [];

    return buildDiff(previous, current);
  }, [currentSchema, previousSchema, buildDiff]);

  const warningsDiff = useMemo(() => {
    if (!previousSchema || !hasPrevious) return null;

    const previousWarnings = previousSchema?.result?.warnings ?? [];
    const currentWarnings = currentSchema?.result?.warnings ?? [];

    const resolved = previousWarnings.filter(w => !currentWarnings.includes(w));
    const added = currentWarnings.filter(w => !previousWarnings.includes(w));
    const persistent = currentWarnings.filter(w => previousWarnings.includes(w));

    return { resolved, added, persistent };
  }, [currentSchema, previousSchema, hasPrevious]);

  /* ================================
     REFINEMENT & EXPORT
  ================================== */

  const handleRefine = async () => {
    if (!refinementText.trim()) return;

    try {
      setRefining(true);
      setError("");

      const refined = await refineSchema(
        currentSchema._id,
        refinementText,
        currentSchema.workloadType
      );

      navigate(`/schema/${refined._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setRefining(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob(
      [JSON.stringify(currentSchema, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schema-v${currentIndex + 1}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ================================
     RENDER STATES
  ================================== */

  if (loading) {
    return <div className="p-6">Loading schema...</div>;
  }

  if (error) {
    return <div className="p-6 text-amber-600">{error}</div>;
  }

  if (!currentSchema) return null;

  /* ================================
     UI
  ================================== */

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* ============================
          FIXED TOP BAR
      ============================ */}
      <div className="sticky top-0 z-10 bg-mist/90 backdrop-blur border-b border-wave/20">
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <Link to="/history" className="text-wave font-semibold text-sm">
            ← Back
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate">
              V{currentIndex + 1} / {versionHistory.length}
            </span>
            <button
              disabled={!hasPrevious}
              onClick={() => setCurrentIndex((index) => index - 1)}
              className="px-3 py-1 rounded-lg bg-blush hover:bg-blush/80 disabled:opacity-40 text-sm text-ink border border-wave/20"
            >
              ←
            </button>
            <button
              disabled={!hasNext}
              onClick={() => setCurrentIndex((index) => index + 1)}
              className="px-3 py-1 rounded-lg bg-blush hover:bg-blush/80 disabled:opacity-40 text-sm text-ink border border-wave/20"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* ============================
          SCROLLABLE CONTENT
      ============================ */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Original Requirement */}
        {versionHistory.length > 0 && versionHistory[0]?.inputText && (
          <div className="data-card p-5 bg-gradient-to-br from-wave/10 to-amber/10 border border-wave/30">
            <h3 className="text-wave font-semibold text-sm uppercase tracking-wide mb-3">
              📝 Original Requirement
            </h3>
            <p className="text-ink text-sm leading-relaxed mb-3">
              {versionHistory[0].inputText.split('\n').filter(line => !line.toLowerCase().startsWith('refinement:')).join(' ').trim()}
            </p>
            {versionHistory.length > 1 && (
              <div className="mt-3 pt-3 border-t border-wave/20">
                <div className="text-xs text-wave uppercase tracking-wide mb-2">Refinement History</div>
                <div className="space-y-1">
                  {versionHistory.slice(1, currentIndex + 1).map((version, idx) => (
                    version.refinementText && (
                      <div key={idx} className="text-xs text-slate">
                        <span className="font-medium text-wave">v{idx + 2}:</span> {version.refinementText}
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schema Metrics Panel */}
        <div className="data-card p-5 bg-gradient-to-br from-wave/10 to-amber/10 border border-wave/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-wave font-semibold text-sm uppercase tracking-wide">
              📊 Schema Metrics
            </h3>
            <button
              onClick={handleExport}
              className="text-xs text-wave hover:underline font-medium"
            >
              Export JSON ↓
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-blush rounded-lg p-3 border border-wave/20">
              <div className="text-xs text-slate uppercase tracking-wide mb-1">Collections</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-wave">{currentMetrics.collectionCount}</span>
                {previousMetrics && currentMetrics.collectionCount !== previousMetrics.collectionCount && (
                  <span className={`text-xs ${currentMetrics.collectionCount > previousMetrics.collectionCount ? 'text-amber' : 'text-red-400'}`}>
                    {currentMetrics.collectionCount > previousMetrics.collectionCount ? '+' : ''}{currentMetrics.collectionCount - previousMetrics.collectionCount}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-blush rounded-lg p-3 border border-wave/20">
              <div className="text-xs text-slate uppercase tracking-wide mb-1">Total Fields</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-wave">{currentMetrics.fieldCount}</span>
                {previousMetrics && currentMetrics.fieldCount !== previousMetrics.fieldCount && (
                  <span className={`text-xs ${currentMetrics.fieldCount > previousMetrics.fieldCount ? 'text-amber' : 'text-red-400'}`}>
                    {currentMetrics.fieldCount > previousMetrics.fieldCount ? '+' : ''}{currentMetrics.fieldCount - previousMetrics.fieldCount}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-blush rounded-lg p-3 border border-wave/20">
              <div className="text-xs text-slate uppercase tracking-wide mb-1">Max Depth</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-wave">{currentMetrics.depth}</span>
                {previousMetrics && currentMetrics.depth !== previousMetrics.depth && (
                  <span className={`text-xs ${currentMetrics.depth > previousMetrics.depth ? 'text-amber' : 'text-amber'}`}>
                    {currentMetrics.depth > previousMetrics.depth ? '+' : ''}{currentMetrics.depth - previousMetrics.depth}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-blush rounded-lg p-3 border border-wave/20">
              <div className="text-xs text-slate uppercase tracking-wide mb-1">Version</div>
              <div className="text-2xl font-bold text-wave">{currentIndex + 1}</div>
            </div>
          </div>

          {structuralWarning && (
            <div className="mt-4 px-3 py-2 bg-amber/10 border border-amber/30 rounded-lg text-amber text-sm">
              {structuralWarning}
            </div>
          )}

          {(() => {
            // Check multiple possible locations for refinement summary
            const summary = currentSchema?.result?.refinementSummary 
              || currentSchema?.result?.explanations?.refinementSummary
              || currentSchema?.result?.explanations?.Limitations
              || currentSchema?.result?.explanations?.["Refinement Limitations"]
              || currentSchema?.result?.explanations?.Refinement
              || currentSchema?.result?.explanations?.refinement
              || currentSchema?.result?.explanations?.["Depth Calculation"]
              || currentSchema?.result?.explanations?.normalization;
            
            // Only show Alternatives - actual actionable suggestions, not trade-off explanations
            const alternatives = currentSchema?.result?.explanations?.Alternatives
              || currentSchema?.result?.explanations?.["Future Refinement"];
            
            return summary && (
              <div className="mt-4 px-3 py-2 bg-wave/10 border border-wave/30 rounded-lg text-sm">
                <div className="text-xs text-wave uppercase tracking-wide mb-2 font-semibold">🔄 Refinement Result</div>
                <div className="text-ink leading-relaxed space-y-2">
                  <div>{summary}</div>
                  {alternatives && (
                    <div className="pt-2 border-t border-wave/20 text-slate text-xs">
                      <span className="font-semibold">Suggestion:</span> {alternatives}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {currentSchema?.refinementText && (
            <div className="mt-4 px-3 py-2 bg-mist border border-wave/20 rounded-lg text-sm">
              <div className="text-xs text-slate uppercase tracking-wide mb-1">Requested Change</div>
              <div className="text-ink italic">{currentSchema.refinementText}</div>
            </div>
          )}
        </div>

        {/* Advanced Analytics */}
        <div className="data-card p-5 bg-gradient-to-br from-wave/5 to-amber/10 border border-wave/20">
          <h3 className="text-wave font-semibold text-sm uppercase tracking-wide">📈 Advanced Analytics</h3>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-blush rounded-lg p-3 border border-wave/20">
              <div className="text-xs text-slate uppercase tracking-wide mb-1">Future Risk</div>
              <div className="text-2xl font-bold text-wave">
                {currentSchema?.result?.futureRiskScore ?? "N/A"}
              </div>
            </div>
            <div className="bg-blush rounded-lg p-3 border border-wave/20">
              <div className="text-xs text-slate uppercase tracking-wide mb-1">Performance</div>
              <div className="text-2xl font-bold text-wave">
                {currentSchema?.result?.performanceIndex ?? "N/A"}
              </div>
            </div>
            <div className="bg-blush rounded-lg p-3 border border-wave/20">
              <div className="text-xs text-slate uppercase tracking-wide mb-1">Growth Map</div>
              <div className="text-2xl font-bold text-wave">
                {currentSchema?.result?.growthRiskMap ? Object.keys(currentSchema.result.growthRiskMap).length : "N/A"}
              </div>
            </div>
            <div className="bg-blush rounded-lg p-3 border border-wave/20">
              <div className="text-xs text-slate uppercase tracking-wide mb-1">Sharding Hints</div>
              <div className="text-2xl font-bold text-wave">
                {currentSchema?.result?.autoSharding ? currentSchema.result.autoSharding.length : "N/A"}
              </div>
            </div>
          </div>
        </div>

        {/* Schema JSON */}
        <div className="data-card p-5">
          <h3 className="text-wave font-semibold text-sm uppercase tracking-wide">
            Schema JSON
          </h3>

          <pre className="mt-4 text-xs bg-mist/60 p-4 rounded-xl overflow-auto max-h-96">
            {JSON.stringify(currentSchema?.result?.schema, null, 2)}
          </pre>
        </div>

        {/* Decision Panels */}
        <div className="grid gap-6 md:grid-cols-2">
          <JsonPanel title="Decisions" data={currentSchema?.result?.decisions} />
          <JsonPanel
            title="Explanations"
            data={currentSchema?.result?.explanations}
          />
          <JsonPanel title="Confidence" data={currentSchema?.result?.confidence} />
          <JsonPanel title="Indexes" data={currentSchema?.result?.indexes} />
          <JsonPanel title="Growth Risk Map" data={currentSchema?.result?.growthRiskMap} />
          <JsonPanel title="Query Cost Analysis" data={currentSchema?.result?.queryCostAnalysis} />
          <JsonPanel title="Auto Sharding" data={currentSchema?.result?.autoSharding} />
        </div>

        {/* Warnings */}
        <div className="data-card p-6">
          <h3 className="text-wave font-semibold text-sm uppercase tracking-wide">
            ⚠ Warnings
          </h3>

          {warningsDiff && (warningsDiff.resolved.length > 0 || warningsDiff.added.length > 0) ? (
            <div className="mt-4 space-y-4">
              {warningsDiff.resolved.length > 0 && (
                <div className="bg-amber/10 border border-amber/30 rounded-lg p-3">
                  <div className="text-xs font-semibold text-amber uppercase tracking-wide mb-2">
                    ✅ Warnings Resolved ({warningsDiff.resolved.length})
                  </div>
                  <ul className="text-sm space-y-1">
                    {warningsDiff.resolved.map((warning, idx) => (
                      <li key={idx} className="text-ink line-through opacity-60">• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {warningsDiff.added.length > 0 && (
                <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-3">
                  <div className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">
                    ⚠️ New Warnings ({warningsDiff.added.length})
                  </div>
                  <ul className="text-sm space-y-1">
                    {warningsDiff.added.map((warning, idx) => (
                      <li key={idx} className="text-ink">• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {warningsDiff.persistent.length > 0 && (
                <div className="bg-mist border border-wave/20 rounded-lg p-3">
                  <div className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">
                    🔄 Persistent Warnings ({warningsDiff.persistent.length})
                  </div>
                  <ul className="text-sm space-y-1">
                    {warningsDiff.persistent.map((warning, idx) => (
                      <li key={idx} className="text-ink opacity-75">• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <ul className="mt-3 text-sm space-y-2 text-ink">
              {(currentSchema?.result?.warnings ?? []).length === 0 && (
                <li>No warnings detected.</li>
              )}
              {(currentSchema?.result?.warnings ?? []).map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Diff Section (cleaner format) */}
        {hasPrevious && (
          <div className="data-card p-6">
            <h3 className="text-wave font-semibold text-sm uppercase tracking-wide">
              📊 Schema Diff
            </h3>
            <div className="mt-1 text-xs text-slate-500">
              Changes from version {currentIndex} to version {currentIndex + 1}
            </div>

            <div className="mt-4 text-xs bg-mist/60 p-4 rounded-xl max-h-80 overflow-auto font-mono">
              {diffLines.length === 0 ? (
                <div className="text-slate">
                  No structural changes detected between versions.
                  {currentSchema?.refinementText && (
                    <div className="mt-3 px-3 py-2 bg-amber/10 border border-amber/30 rounded text-amber">
                      <strong>Note:</strong> A refinement was requested ("{currentSchema.refinementText}") 
                      but no schema structure changes were applied. The backend may need to process this refinement differently.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {diffLines.map((line, index) => (
                    <div
                      key={`${line.type}-${index}`}
                      className={
                        line.type === "added"
                          ? "text-amber font-semibold"
                          : line.type === "removed"
                          ? "text-red-400"
                          : "text-wave"
                      }
                    >
                      {line.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================
          FIXED REFINE SECTION
      ============================ */}
      <div className="sticky bottom-0 z-10 border-t border-wave/20 bg-mist/95 backdrop-blur p-4 space-y-3 shadow-lg">
        <h3 className="text-wave font-semibold text-xs uppercase tracking-wide">
          🔄 Refine Schema
        </h3>

        <textarea
          className="w-full min-h-[56px] rounded-xl border border-wave/30 bg-blush px-4 py-2 text-sm text-ink placeholder-slate/60 focus:outline-none focus:ring-2 focus:ring-wave/50"
          placeholder="Describe the changes you want..."
          value={refinementText}
          onChange={(event) => setRefinementText(event.target.value)}
        />

        <div className="flex justify-end">
          <button
            disabled={!refinementText.trim() || refining}
            onClick={handleRefine}
            className="rounded-full bg-wave text-white px-5 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-wave/90 transition"
          >
            {refining ? "Refining..." : "Apply refinement"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchemaDetail;

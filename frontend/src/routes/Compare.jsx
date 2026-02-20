import { useMemo, useState } from "react";

import { compareModels } from "../api/schemas";

const MODELS = [
  { id: "claude", label: "Claude (Anthropic)", badge: "border-cyan-500/40 text-cyan-200" },
  { id: "gpt", label: "GPT-4 (OpenAI)", badge: "border-orange-400/40 text-orange-200" },
  { id: "gemini", label: "Gemini (Google)", badge: "border-yellow-400/40 text-yellow-200" },
  { id: "groq", label: "Groq", badge: "border-blue-400/40 text-blue-200" },
  { id: "llama", label: "LLaMA (Meta)", badge: "border-violet-400/40 text-violet-200" },
  { id: "mistral", label: "Mistral", badge: "border-indigo-400/40 text-indigo-200" }
];

const WORKLOADS = [
  { id: "balanced", label: "Balanced" },
  { id: "read-heavy", label: "Read-Heavy" },
  { id: "write-heavy", label: "Write-Heavy" },
  { id: "analytical", label: "Analytical" }
];

const getModelLabel = (modelId) => {
  return MODELS.find((model) => model.id === modelId)?.label || modelId;
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

const countRelationships = (relationships) => {
  if (!relationships || typeof relationships !== "object") return 0;
  return Object.keys(relationships).length;
};

const Compare = () => {
  const [requirement, setRequirement] = useState("");
  const [analysisText, setAnalysisText] = useState("");
  const [workloadType, setWorkloadType] = useState("balanced");
  const model1 = "groq"; // Fixed to default chat model
  const [model2, setModel2] = useState("claude");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const model1Label = useMemo(() => getModelLabel(model1), [model1]);
  const model2Label = useMemo(() => getModelLabel(model2), [model2]);

  const handleCompare = async (event) => {
    event.preventDefault();
    setError("");

    if (!requirement.trim()) {
      setError("Please describe your requirement.");
      return;
    }

    if (model2 === "groq") {
      setError("Please choose a different model to compare against Groq.");
      return;
    }

    try {
      setLoading(true);
      const data = await compareModels(
        requirement.trim(),
        workloadType,
        model1,
        model2,
        analysisText.trim()
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  const renderFieldDiffs = (modelDiffs, otherLabel, currentLabel) => {
    if (!modelDiffs) return null;

    const { onlyCollections, missingCollections, fieldDifferences } = modelDiffs;

    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-ink">Extra collections in {currentLabel}</p>
          {onlyCollections?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {onlyCollections.map((collection) => (
                <span
                  key={collection}
                  className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200"
                >
                  {collection}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate">None</p>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-ink">Missing collections (only in {otherLabel})</p>
          {missingCollections?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {missingCollections.map((collection) => (
                <span
                  key={collection}
                  className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200"
                >
                  {collection}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate">None</p>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-ink">Field differences per common collection</p>
          {fieldDifferences && Object.keys(fieldDifferences).length ? (
            <div className="mt-3 space-y-3">
              {Object.entries(fieldDifferences).map(([collection, diffs]) => (
                <div key={collection} className="rounded-lg border border-wave/20 bg-blush/70 p-3">
                  <p className="text-sm font-semibold text-wave">{collection}</p>
                  {diffs.extraFields?.length ? (
                    <p className="mt-1 text-xs text-emerald-200">
                      Extra: {diffs.extraFields.join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate">Extra: none</p>
                  )}
                  {diffs.missingFields?.length ? (
                    <p className="mt-1 text-xs text-rose-200">
                      Missing: {diffs.missingFields.join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate">Missing: none</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate">No field-level differences found.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl">Compare AI Model Schemas</h1>
        <p className="text-slate mt-2">
          Compare our default model (Groq) against other AI models to see how they approach the same requirement.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <form onSubmit={handleCompare} className="data-card p-6 space-y-5">
          <div>
            <label htmlFor="requirement" className="block text-sm font-semibold text-ink">
              Requirement
            </label>
            <textarea
              id="requirement"
              rows={6}
              className="mt-2 w-full rounded-lg border border-wave/30 bg-blush px-4 py-3 text-ink placeholder-slate/60 focus:outline-none focus:ring-2 focus:ring-wave"
              placeholder="Describe the app, entities, and access patterns..."
              value={requirement}
              onChange={(event) => setRequirement(event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="workload" className="block text-sm font-semibold text-ink">
                Workload
              </label>
              <select
                id="workload"
                value={workloadType}
                onChange={(event) => setWorkloadType(event.target.value)}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-wave/30 bg-blush px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wave"
              >
                {WORKLOADS.map((workload) => (
                  <option key={workload.id} value={workload.id}>
                    {workload.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="model1" className="block text-sm font-semibold text-ink">
                Model 1 <span className="text-xs text-slate">(Default)</span>
              </label>
              <select
                id="model1"
                value={model1}
                disabled
                className="mt-2 w-full rounded-lg border border-wave/30 bg-blush/50 px-3 py-2 text-ink opacity-75 cursor-not-allowed"
              >
                {MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="model2" className="block text-sm font-semibold text-ink">
                Model 2 <span className="text-xs text-slate">(Compare with)</span>
              </label>
              <select
                id="model2"
                value={model2}
                onChange={(event) => setModel2(event.target.value)}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-wave/30 bg-blush px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wave"
              >
                {MODELS.filter((model) => model.id !== "groq").map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="analysis" className="block text-sm font-semibold text-ink">
              Analysis focus (optional)
            </label>
            <textarea
              id="analysis"
              rows={3}
              className="mt-2 w-full rounded-lg border border-wave/30 bg-blush px-4 py-3 text-ink placeholder-slate/60 focus:outline-none focus:ring-2 focus:ring-wave"
              placeholder="What should the comparison emphasize?"
              value={analysisText}
              onChange={(event) => setAnalysisText(event.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-wave px-6 py-3 text-white font-semibold hover:bg-wave/80 disabled:opacity-50"
          >
            {loading ? "Comparing Models..." : "Compare Models"}
          </button>
        </form>

        <div className="data-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-ink">Comparison Snapshot</h2>
          {!result ? (
            <p className="text-sm text-slate">Run a comparison to see the summary and diffs.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-wave/30 bg-wave/10 px-3 py-1 text-xs text-wave">
                  Similarity: {result.comparison?.similarityScore?.toFixed(1) ?? "0.0"}%
                </span>
                <span className="rounded-full border border-wave/30 bg-wave/10 px-3 py-1 text-xs text-wave">
                  {model1Label}: {Object.keys(result.model1?.result?.schema || {}).length} collections
                </span>
                <span className="rounded-full border border-wave/30 bg-wave/10 px-3 py-1 text-xs text-wave">
                  {model2Label}: {Object.keys(result.model2?.result?.schema || {}).length} collections
                </span>
                <span className="rounded-full border border-wave/30 bg-wave/10 px-3 py-1 text-xs text-wave">
                  {model1Label}: {countSchemaFields(result.model1?.result?.schema)} fields
                </span>
                <span className="rounded-full border border-wave/30 bg-wave/10 px-3 py-1 text-xs text-wave">
                  {model2Label}: {countSchemaFields(result.model2?.result?.schema)} fields
                </span>
                <span className="rounded-full border border-wave/30 bg-wave/10 px-3 py-1 text-xs text-wave">
                  {model1Label}: {countRelationships(result.model1?.result?.relationships)} relations
                </span>
                <span className="rounded-full border border-wave/30 bg-wave/10 px-3 py-1 text-xs text-wave">
                  {model2Label}: {countRelationships(result.model2?.result?.relationships)} relations
                </span>
              </div>

              <details className="rounded-lg border border-wave/20 bg-blush/60 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-ink">
                  Read comparison analysis
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate">
                  {result.analysis}
                </pre>
              </details>
            </div>
          )}

          {error && <p className="text-sm text-amber">{error}</p>}
        </div>
      </section>

      {result && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="data-card p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  MODELS.find((model) => model.id === model1)?.badge
                }`}
              >
                {model1Label}
              </span>
              <span className="text-xs text-slate">Workload: {workloadType}</span>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink">Schema totals</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-wave/30 px-3 py-1 text-ink">
                  Collections: {Object.keys(result.model1?.result?.schema || {}).length}
                </span>
                <span className="rounded-full border border-wave/30 px-3 py-1 text-ink">
                  Fields: {countSchemaFields(result.model1?.result?.schema)}
                </span>
                <span className="rounded-full border border-wave/30 px-3 py-1 text-ink">
                  Relations: {countRelationships(result.model1?.result?.relationships)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink">Collections</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.keys(result.model1?.result?.schema || {}).map((collection) => (
                  <span key={collection} className="rounded-full border border-wave/30 px-3 py-1 text-xs text-ink">
                    {collection}
                  </span>
                ))}
              </div>
            </div>

            <details className="rounded-lg border border-wave/20 bg-blush/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Relationships
              </summary>
              {result.model1?.result?.relationships && Object.keys(result.model1.result.relationships).length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(result.model1.result.relationships).map(([key, value]) => (
                    <span
                      key={key}
                      className="rounded-full border border-wave/30 px-3 py-1 text-xs text-ink"
                    >
                      {typeof value === "string" ? value : JSON.stringify(value)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate">No relationships reported.</p>
              )}
            </details>

            <details className="rounded-lg border border-wave/20 bg-blush/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Warnings
              </summary>
              {result.model1?.result?.warnings?.length ? (
                <ul className="mt-2 space-y-2 text-xs text-amber">
                  {result.model1.result.warnings.map((warning) => (
                    <li key={warning} className="rounded-md border border-amber/40 bg-amber/10 px-3 py-2">
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate">No warnings reported.</p>
              )}
            </details>

            <details className="rounded-lg border border-wave/20 bg-blush/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Differences for {model1Label}
              </summary>
              <div className="mt-3">
                {renderFieldDiffs(result.detailedComparison?.model1, model2Label, model1Label)}
              </div>
            </details>

            <details className="rounded-lg border border-wave/20 bg-blush/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Full schema JSON
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate">
                {JSON.stringify(result.model1?.result?.schema, null, 2)}
              </pre>
            </details>
          </div>

          <div className="data-card p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  MODELS.find((model) => model.id === model2)?.badge
                }`}
              >
                {model2Label}
              </span>
              <span className="text-xs text-slate">Workload: {workloadType}</span>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink">Schema totals</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-wave/30 px-3 py-1 text-ink">
                  Collections: {Object.keys(result.model2?.result?.schema || {}).length}
                </span>
                <span className="rounded-full border border-wave/30 px-3 py-1 text-ink">
                  Fields: {countSchemaFields(result.model2?.result?.schema)}
                </span>
                <span className="rounded-full border border-wave/30 px-3 py-1 text-ink">
                  Relations: {countRelationships(result.model2?.result?.relationships)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink">Collections</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.keys(result.model2?.result?.schema || {}).map((collection) => (
                  <span key={collection} className="rounded-full border border-wave/30 px-3 py-1 text-xs text-ink">
                    {collection}
                  </span>
                ))}
              </div>
            </div>

            <details className="rounded-lg border border-wave/20 bg-blush/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Relationships
              </summary>
              {result.model2?.result?.relationships && Object.keys(result.model2.result.relationships).length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(result.model2.result.relationships).map(([key, value]) => (
                    <span
                      key={key}
                      className="rounded-full border border-wave/30 px-3 py-1 text-xs text-ink"
                    >
                      {typeof value === "string" ? value : JSON.stringify(value)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate">No relationships reported.</p>
              )}
            </details>

            <details className="rounded-lg border border-wave/20 bg-blush/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Warnings
              </summary>
              {result.model2?.result?.warnings?.length ? (
                <ul className="mt-2 space-y-2 text-xs text-amber">
                  {result.model2.result.warnings.map((warning) => (
                    <li key={warning} className="rounded-md border border-amber/40 bg-amber/10 px-3 py-2">
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate">No warnings reported.</p>
              )}
            </details>

            <details className="rounded-lg border border-wave/20 bg-blush/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Differences for {model2Label}
              </summary>
              <div className="mt-3">
                {renderFieldDiffs(result.detailedComparison?.model2, model1Label, model2Label)}
              </div>
            </details>

            <details className="rounded-lg border border-wave/20 bg-blush/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Full schema JSON
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate">
                {JSON.stringify(result.model2?.result?.schema, null, 2)}
              </pre>
            </details>
          </div>
        </section>
      )}
    </div>
  );
};

export default Compare;

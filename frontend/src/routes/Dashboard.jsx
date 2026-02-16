import { useState } from "react";
import { Link } from "react-router-dom";

import JsonPanel from "../components/JsonPanel";
import { generateSchema } from "../api/schemas";

const Dashboard = () => {
  const [inputText, setInputText] = useState("");
  const [workloadType, setWorkloadType] = useState("balanced");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await generateSchema(inputText, workloadType);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const schemaEntries = result ? Object.entries(result.result.schema ?? {}) : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Schema Studio</h1>
        <p className="text-slate mt-2">
          Describe your data model, select a workload profile, and let the AI craft a MongoDB schema.
        </p>
      </div>

      <section className="data-card p-6 space-y-4">
        <textarea
          className="w-full min-h-[140px] rounded-2xl border border-slate/20 px-4 py-3"
          placeholder="Describe your requirements. Example: Users place orders, orders contain products, and we need frequent order history lookups."
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm font-semibold text-slate">Workload profile</label>
          <select
            className="rounded-full border border-slate/20 px-4 py-2"
            value={workloadType}
            onChange={(event) => setWorkloadType(event.target.value)}
            aria-label="Workload profile"
          >
            <option value="read-heavy">Read-heavy</option>
            <option value="write-heavy">Write-heavy</option>
            <option value="balanced">Balanced</option>
          </select>
          <button
            className="ml-auto rounded-full bg-wave text-white px-6 py-2 font-semibold shadow-soft"
            onClick={handleGenerate}
            disabled={loading || !inputText.trim()}
          >
            {loading ? "Generating..." : "Generate schema"}
          </button>
        </div>
        {error && <p className="text-sm text-amber">{error}</p>}
      </section>

      {result && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl">Latest Result</h2>
            <Link className="text-wave font-semibold" to={`/schema/${result._id}`}>
              View full detail
            </Link>
          </div>

          <div className="grid gap-6">
            <div className="data-card p-5">
              <h3 className="text-sm uppercase tracking-[0.3em] text-wave font-semibold">
                Schema JSON
              </h3>
              <pre className="mt-4 text-xs bg-mist/60 p-4 rounded-xl overflow-auto text-slate">
                {JSON.stringify(result.result.schema, null, 2)}
              </pre>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <JsonPanel title="Decisions" data={result.result.decisions} />
              <JsonPanel title="Explanations" data={result.result.explanations} />
              <JsonPanel title="Confidence" data={result.result.confidence} />
              <JsonPanel title="Indexes" data={result.result.indexes} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <JsonPanel title="Warnings" data={result.result.warnings} />
            <JsonPanel title="Why not" data={result.result.whyNot} />
          </div>

          <div className="data-card p-6">
            <h3 className="text-sm uppercase tracking-[0.3em] text-wave font-semibold">Visual map</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {schemaEntries.map(([collection, fields]) => (
                <div key={collection} className="rounded-2xl border border-slate/20 p-4 bg-mist/40">
                  <p className="font-semibold text-ink">{collection}</p>
                  <ul className="text-sm text-slate mt-2 space-y-1">
                    {Object.keys(fields).map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Dashboard;

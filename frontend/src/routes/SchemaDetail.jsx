import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import JsonPanel from "../components/JsonPanel";
import { getSchemaById, refineSchema } from "../api/schemas";

const SchemaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [schema, setSchema] = useState(null);
  const [error, setError] = useState("");
  const [refinementText, setRefinementText] = useState("");
  const [refining, setRefining] = useState(false);
  const [previousSchema, setPreviousSchema] = useState(null);
  const [diffLines, setDiffLines] = useState([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const data = await getSchemaById(id);
        setSchema(data);
        if (data.parentId) {
          const parent = await getSchemaById(data.parentId);
          setPreviousSchema(parent);
        } else {
          setPreviousSchema(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load schema");
      }
    };
    load();
  }, [id]);

  const buildDiff = (before, after, prefix = "") => {
    const lines = [];
    const beforeKeys = before && typeof before === "object" ? Object.keys(before) : [];
    const afterKeys = after && typeof after === "object" ? Object.keys(after) : [];
    const keys = Array.from(new Set([...beforeKeys, ...afterKeys])).sort();

    for (const key of keys) {
      const path = prefix ? `${prefix}.${key}` : key;
      const beforeVal = before ? before[key] : undefined;
      const afterVal = after ? after[key] : undefined;

      if (beforeVal === undefined && afterVal !== undefined) {
        lines.push(`+ ${path}: ${JSON.stringify(afterVal)}`);
        continue;
      }
      if (beforeVal !== undefined && afterVal === undefined) {
        lines.push(`- ${path}: ${JSON.stringify(beforeVal)}`);
        continue;
      }
      if (
        beforeVal &&
        afterVal &&
        typeof beforeVal === "object" &&
        typeof afterVal === "object" &&
        !Array.isArray(beforeVal) &&
        !Array.isArray(afterVal)
      ) {
        lines.push(...buildDiff(beforeVal, afterVal, path));
        continue;
      }
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        lines.push(`- ${path}: ${JSON.stringify(beforeVal)}`);
        lines.push(`+ ${path}: ${JSON.stringify(afterVal)}`);
      }
    }

    return lines;
  };

  useEffect(() => {
    if (!previousSchema || !schema) {
      setDiffLines([]);
      return;
    }
    const lines = buildDiff(previousSchema.result.schema, schema.result.schema);
    setDiffLines(lines);
  }, [previousSchema, schema]);

  if (error) {
    return <div className="data-card p-6 text-amber">{error}</div>;
  }

  if (!schema) {
    return <div className="data-card p-6">Loading schema...</div>;
  }

  const handleRefine = async () => {
    if (!id || !refinementText.trim()) return;
    setRefining(true);
    setError("");
    try {
      const refined = await refineSchema(id, refinementText, schema.workloadType);
      navigate(`/schema/${refined._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl">Schema Detail</h1>
          <p className="text-slate mt-2">{schema.inputText}</p>
        </div>
        <Link className="text-wave font-semibold" to="/history">Back to history</Link>
      </div>

      <div className="grid gap-6">
        <div className="data-card p-5">
          <h3 className="text-sm uppercase tracking-[0.3em] text-wave font-semibold">Schema JSON</h3>
          <pre className="mt-4 text-xs bg-mist/60 p-4 rounded-xl overflow-auto text-slate">
            {JSON.stringify(schema.result.schema, null, 2)}
          </pre>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <JsonPanel title="Decisions" data={schema.result.decisions} />
          <JsonPanel title="Explanations" data={schema.result.explanations} />
          <JsonPanel title="Confidence" data={schema.result.confidence} />
          <JsonPanel title="Indexes" data={schema.result.indexes} />
        </div>
      </div>

      <section className="data-card p-6 space-y-4">
        <div>
          <h3 className="text-sm uppercase tracking-[0.3em] text-wave font-semibold">Refine schema</h3>
          <p className="text-sm text-slate mt-2">
            Add a new instruction to evolve this schema. Example: “Add exam attempts and audit logs.”
          </p>
        </div>
        <textarea
          className="w-full min-h-[120px] rounded-2xl border border-slate/20 px-4 py-3"
          placeholder="Describe the changes you want..."
          value={refinementText}
          onChange={(event) => setRefinementText(event.target.value)}
        />
        <div className="flex items-center justify-end">
          <button
            className="rounded-full bg-wave text-white px-6 py-2 font-semibold shadow-soft"
            onClick={handleRefine}
            disabled={refining || !refinementText.trim()}
          >
            {refining ? "Refining..." : "Apply refinement"}
          </button>
        </div>
      </section>
      <div className="data-card p-6">
        <h3 className="text-sm uppercase tracking-[0.3em] text-wave font-semibold">Warnings</h3>
        <ul className="mt-3 text-sm text-slate space-y-2">
          {schema.result.warnings.length === 0 && <li>No warnings detected.</li>}
          {schema.result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>

      {previousSchema && (
        <section className="data-card p-6 space-y-4">
          <div>
            <h3 className="text-sm uppercase tracking-[0.3em] text-wave font-semibold">Schema diff</h3>
            <p className="text-sm text-slate mt-2">
              Comparing version {previousSchema.version ?? 1} with version {schema.version ?? 1}.
            </p>
          </div>
          <pre className="text-xs bg-mist/60 p-4 rounded-xl overflow-auto text-slate">
            {diffLines.length ? diffLines.join("\n") : "No structural changes detected."}
          </pre>
        </section>
      )}
    </div>
  );
};

export default SchemaDetail;

import { useState, useEffect } from 'react';
import { simulateQueryLatency } from '../api/queryLatency';
import { getHistory } from '../api/schemas';

export default function QueryLatencySimulator() {
  const [schemas, setSchemas] = useState([]);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSchemas();
  }, []);

  async function loadSchemas() {
    setLoadingSchemas(true);
    try {
      const data = await getHistory();
      setSchemas(data);
    } catch (err) {
      console.error('Failed to load schemas:', err);
      setSchemas([]);
    } finally {
      setLoadingSchemas(false);
    }
  }

  async function handleAnalyze(schema) {
    setSelectedSchema(schema);
    setLoading(true);
    setError(null);
    setSimulation(null);

    try {
      const result = await simulateQueryLatency(schema._id);
      setSimulation(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getLatencyColor(status) {
    if (status === '❌') return 'text-red-600 bg-red-50';
    if (status === '⚠️') return 'text-amber bg-amber/10';
    return 'text-green-600 bg-green-50';
  }

  function formatLoad(load) {
    if (load >= 1000000) {
      return `${(load / 1000000).toFixed(1)}M`;
    }
    if (load >= 1000) {
      return `${(load / 1000).toFixed(0)}K`;
    }
    return load;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-wave">Query Latency Simulator</h1>
        <p className="text-slate mt-2">
          Simulate query performance across different patterns and load levels
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schema List */}
        <div className="lg:col-span-1">
          <div className="data-card">
            <div className="p-4 border-b border-wave/20">
              <h2 className="text-lg font-semibold text-ink">Your Schemas</h2>
              <p className="text-sm text-slate mt-1">Select to analyze</p>
            </div>
            <div className="divide-y divide-wave/10 max-h-[calc(100vh-300px)] overflow-y-auto">
              {loadingSchemas ? (
                <div className="p-4 text-center text-slate">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wave mx-auto mb-2"></div>
                  Loading...
                </div>
              ) : schemas.length === 0 ? (
                <div className="p-4 text-center text-slate">
                  No schemas found.
                </div>
              ) : (
                schemas.map((schema) => (
                  <button
                    key={schema._id}
                    onClick={() => handleAnalyze(schema)}
                    className={`w-full text-left p-4 hover:bg-blush/40 transition-colors ${
                      selectedSchema?._id === schema._id ? 'bg-blush border-l-4 border-wave' : ''
                    }`}
                  >
                    <div className="font-medium text-ink truncate">
                      {schema.inputText?.substring(0, 40)}...
                    </div>
                    <div className="text-sm text-slate mt-1">
                      {schema.createdAt ? new Date(schema.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Simulation Results */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="data-card p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wave mx-auto"></div>
              <p className="mt-4 text-slate">Simulating latency...</p>
            </div>
          )}

          {error && (
            <div className="data-card p-6 border-l-4 border-amber">
              <div className="flex items-start">
                <svg className="h-6 w-6 text-amber mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-ink">Analysis Failed</h3>
                  <p className="text-slate text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && !simulation && (
            <div className="data-card p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-ink">No schema selected</h3>
              <p className="mt-1 text-sm text-slate">Select a schema to simulate query latency</p>
            </div>
          )}

          {simulation && simulation.success && (
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-2 space-y-6">
              {/* Schema Metrics Card */}
              <div className="data-card p-6">
                <h3 className="text-lg font-semibold text-ink mb-4">📊 Schema Metrics</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-wave/10 p-3 rounded">
                    <p className="text-xs text-slate uppercase tracking-wide">Field Depth</p>
                    <p className="text-lg font-bold text-ink mt-1">{simulation.schema_metrics.field_depth}</p>
                    <p className="text-xs text-slate mt-1">levels</p>
                  </div>
                  <div className="bg-wave/10 p-3 rounded">
                    <p className="text-xs text-slate uppercase tracking-wide">References</p>
                    <p className="text-lg font-bold text-ink mt-1">{simulation.schema_metrics.references}</p>
                    <p className="text-xs text-slate mt-1">lookups</p>
                  </div>
                  <div className="bg-wave/10 p-3 rounded">
                    <p className="text-xs text-slate uppercase tracking-wide">Arrays</p>
                    <p className="text-lg font-bold text-ink mt-1">{simulation.schema_metrics.arrays}</p>
                    <p className="text-xs text-slate mt-1">fields</p>
                  </div>
                  <div className="bg-wave/10 p-3 rounded">
                    <p className="text-xs text-slate uppercase tracking-wide">Indexes</p>
                    <p className="text-lg font-bold text-ink mt-1">{simulation.schema_metrics.indexes}</p>
                    <p className="text-xs text-slate mt-1">assumed</p>
                  </div>
                </div>
              </div>

              {/* Query Simulations */}
              <div className="space-y-4">
                {simulation.query_simulations.map((query, qidx) => (
                  <div key={qidx} className="data-card p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-ink">{query.name}</h3>
                      <p className="text-sm text-slate mt-1">{query.description}</p>
                      {query.indexed && (
                        <span className="inline-block mt-2 bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                          Indexed
                        </span>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-wave/20">
                            <th className="text-left py-3 text-slate font-semibold">Load</th>
                            {query.latencies.map((lat, idx) => (
                              <th key={idx} className="text-left py-3 text-slate font-semibold">
                                {formatLoad(lat.load)} users
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-wave/10">
                            <td className="py-3 font-medium text-ink">Query Time</td>
                            {query.latencies.map((lat, idx) => (
                              <td key={idx} className="py-3">
                                <div className={`inline-block px-3 py-2 rounded font-semibold text-sm ${getLatencyColor(lat.status)}`}>
                                  {lat.display}
                                </div>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              {simulation.recommendations.length > 0 && (
                <div className="data-card p-6">
                  <h3 className="text-lg font-semibold text-ink mb-4">💡 Optimization Recommendations</h3>
                  <div className="space-y-3">
                    {simulation.recommendations.map((rec, idx) => (
                      <div key={idx} className={`p-4 rounded border-l-4 ${
                        rec.severity === 'high' ? 'border-red-500 bg-red-50' :
                        rec.severity === 'medium' ? 'border-amber bg-amber/10' :
                        'border-green-500 bg-green-50'
                      }`}>
                        <div className="flex items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-ink">{rec.issue}</p>
                            <p className="text-sm text-slate mt-1">{rec.suggestion}</p>
                            <p className="text-xs font-medium mt-2 text-wave">Impact: {rec.impact}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="data-card p-4 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-bold">✅</span>
                  <span className="text-slate">&lt;50ms (excellent)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber font-bold">⚠️</span>
                  <span className="text-slate">50-200ms (acceptable)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-600 font-bold">❌</span>
                  <span className="text-slate">&gt;200ms (slow)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

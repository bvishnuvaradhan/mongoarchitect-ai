import { useState, useEffect } from 'react';
import { getEvolutionTimeline } from '../api/evolution';
import { getHistory } from '../api/schemas';

export default function SchemaEvolution() {
  const [schemas, setSchemas] = useState([]);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [evolution, setEvolution] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(true);
  const [error, setError] = useState(null);
  const [months, setMonths] = useState(12);

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
    setEvolution(null);

    try {
      const result = await getEvolutionTimeline(schema._id, months);
      setEvolution(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getRiskColor(riskLevel) {
    if (riskLevel.includes('High')) return 'text-red-600';
    if (riskLevel.includes('Medium')) return 'text-amber';
    return 'text-green-600';
  }

  function getRiskBgColor(riskLevel) {
    if (riskLevel.includes('High')) return 'bg-red-50';
    if (riskLevel.includes('Medium')) return 'bg-amber/10';
    return 'bg-green-50';
  }

  function getRecommendationStatus(status) {
    if (status.includes('⚠️')) return 'bg-amber/20 text-amber';
    return 'bg-wave/20 text-wave';
  }



  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-wave">Schema Evolution Timeline</h1>
        <p className="text-slate mt-2">
          Project how your schema will evolve and predict scalability issues
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

        {/* Evolution Analysis */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="data-card p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wave mx-auto"></div>
              <p className="mt-4 text-slate">Analyzing evolution...</p>
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

          {!loading && !error && !evolution && (
            <div className="data-card p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-ink">No schema selected</h3>
              <p className="mt-1 text-sm text-slate">Select a schema to see evolution timeline</p>
            </div>
          )}

          {evolution && evolution.success && (
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
              <div className="space-y-6">
                {/* Risk Assessment */}
                <div className={`data-card p-6 border-l-4 ${
                  evolution.risk_level.includes('High') ? 'border-red-500' :
                  evolution.risk_level.includes('Medium') ? 'border-amber' :
                  'border-wave'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-ink">Risk Assessment</h3>
                      <p className="text-slate mt-1">Current scalability risk level</p>
                    </div>
                    <p className={`text-2xl font-bold ${getRiskColor(evolution.risk_level)}`}>
                      {evolution.risk_level}
                    </p>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  {evolution.recommendations.map((rec, idx) => (
                    <div key={idx} className={`data-card p-4 ${getRiskBgColor(rec.status)}`}>
                      <p className="text-xs text-slate uppercase tracking-wide">{rec.title}</p>
                      <p className="text-lg font-bold text-ink mt-2">{rec.current}</p>
                      <p className={`text-xs mt-1 font-medium ${getRecommendationStatus(rec.status)}`}>
                        {rec.status} {rec.threshold}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Predictions Table - Specific Actions */}
                {evolution.predictions && evolution.predictions.length > 0 && (
                  <div className="data-card p-6">
                    <h3 className="text-lg font-semibold text-ink mb-4">🎯 Recommended Actions</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-wave/20">
                            <th className="text-left py-3 text-slate font-semibold">Month</th>
                            <th className="text-left py-3 text-slate font-semibold">Problem</th>
                            <th className="text-left py-3 text-slate font-semibold">Recommended Fix</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evolution.predictions.map((pred, idx) => (
                            <tr key={idx} className="border-b border-wave/10 hover:bg-blush/20 transition-colors">
                              <td className="py-3">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-wave/20 text-wave font-semibold text-xs">
                                  M{pred.month}
                                </span>
                              </td>
                              <td className="py-3 text-ink font-medium">{pred.problem}</td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  {pred.fix === 'split' && <span className="text-lg">📋</span>}
                                  {pred.fix === 'compound_index' && <span className="text-lg">🔍</span>}
                                  {pred.fix === 'shard' && <span className="text-lg">⚡</span>}
                                  {pred.fix === 'convert_reference' && <span className="text-lg">🔗</span>}
                                  {pred.fix === 'archive' && <span className="text-lg">📦</span>}
                                  <span className="bg-wave/20 text-wave px-3 py-1 rounded-full font-medium text-xs">
                                    {pred.action}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Timeline Table */}
                {evolution.timeline.length > 0 && (
                  <div className="data-card p-6">
                    <h3 className="text-lg font-semibold text-ink mb-4">⏱️ Evolution Timeline</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-wave/20">
                            <th className="text-left py-3 text-slate font-semibold">Month</th>
                            <th className="text-left py-3 text-slate font-semibold">Issues</th>
                            <th className="text-left py-3 text-slate font-semibold">Suggestions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evolution.timeline.map((item, idx) => (
                            <tr key={idx} className="border-b border-wave/10 hover:bg-blush/20 transition-colors">
                              <td className="py-3 text-wave font-semibold">M{item.month}</td>
                              <td className="py-3">
                                <div className="space-y-1">
                                  {item.issues.map((issue, aidx) => (
                                    <p key={aidx} className="text-ink">{issue}</p>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="space-y-1">
                                  {item.suggestions.map((suggestion, sidx) => (
                                    <span key={sidx} className="inline-block bg-wave/20 text-wave text-xs px-2 py-1 rounded mr-1 mb-1">
                                      {suggestion}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {evolution.timeline.length === 0 && (
                  <div className="data-card p-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-wave" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-2 text-lg font-medium text-ink">Schema is stable!</h3>
                    <p className="mt-1 text-sm text-slate">No scalability issues predicted for the next {months} months</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

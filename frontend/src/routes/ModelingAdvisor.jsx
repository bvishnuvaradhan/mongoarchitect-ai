import { useState, useEffect } from 'react';
import { analyzeSchema } from '../api/advisor';
import { getHistory } from '../api/schemas';

export default function ModelingAdvisor() {
  const [schemas, setSchemas] = useState([]);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [analysis, setAnalysis] = useState(null);
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
    setAnalysis(null);

    try {
      const result = await analyzeSchema(schema._id);
      setAnalysis(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getPriorityBadge(priority) {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-amber/20 text-amber';
      case 'low':
        return 'bg-wave/20 text-wave';
      default:
        return 'bg-blush text-slate';
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-wave">MongoDB Modeling Advisor</h1>
        <p className="text-slate mt-2">
          Get expert recommendations for MongoDB data modeling patterns
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schema List */}
        <div className="lg:col-span-1">
          <div className="data-card">
            <div className="p-4 border-b border-wave/20">
              <h2 className="text-lg font-semibold text-ink">Your Schemas</h2>
              <p className="text-sm text-slate mt-1">Select a schema to analyze</p>
            </div>
            <div className="divide-y divide-wave/10 max-h-[calc(100vh-300px)] overflow-y-auto">
              {loadingSchemas ? (
                <div className="p-4 text-center text-slate">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wave mx-auto mb-2"></div>
                  Loading schemas...
                </div>
              ) : schemas.length === 0 ? (
                <div className="p-4 text-center text-slate">
                  No schemas found. Generate a schema first.
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
                      {schema.inputText?.substring(0, 60)}
                      {schema.inputText?.length > 60 ? '...' : ''}
                    </div>
                    <div className="text-sm text-slate mt-1">
                      {schema.createdAt ? new Date(schema.createdAt).toLocaleDateString() : 'No date'}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Analysis Results */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="data-card p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wave mx-auto"></div>
              <p className="mt-4 text-slate">Analyzing schema...</p>
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
                  <button
                    onClick={() => setError(null)}
                    className="mt-3 text-sm text-wave hover:text-amber font-medium"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && !analysis && (
            <div className="data-card p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-ink">No schema selected</h3>
              <p className="mt-1 text-sm text-slate">Select a schema from the list to see recommendations</p>
            </div>
          )}

          {analysis && analysis.success && (
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
              <div className="space-y-6">
              {/* Summary */}
              <div className="data-card p-6">
                <h2 className="text-xl font-semibold text-ink mb-4">Analysis Summary</h2>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-wave">{analysis.summary.total_patterns}</div>
                    <div className="text-sm text-slate mt-1">Total Patterns</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">{analysis.summary.high_priority}</div>
                    <div className="text-sm text-slate mt-1">High Priority</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber">{analysis.summary.medium_priority}</div>
                    <div className="text-sm text-slate mt-1">Medium Priority</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-wave">{analysis.summary.low_priority}</div>
                    <div className="text-sm text-slate mt-1">Low Priority</div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {analysis.recommendations.length === 0 ? (
                <div className="data-card p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-ink">Schema looks good!</h3>
                  <p className="mt-1 text-sm text-slate">No specific pattern recommendations at this time</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {analysis.recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className={`data-card overflow-hidden border-l-4 ${
                        rec.priority === 'high'
                          ? 'border-red-500'
                          : rec.priority === 'medium'
                          ? 'border-amber'
                          : 'border-wave'
                      }`}
                    >
                      <div className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-semibold text-ink">{rec.pattern}</h3>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityBadge(rec.priority)}`}>
                                {rec.priority.toUpperCase()}
                              </span>
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blush text-slate">
                                {rec.confidence} confidence
                              </span>
                            </div>
                            <p className="text-sm text-slate mt-1">Collection: {rec.collection}</p>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-ink mb-4">{rec.description}</p>

                        {/* Reasons */}
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-ink mb-2">Why this pattern?</h4>
                          <ul className="space-y-1">
                            {rec.reasons.map((reason, ridx) => (
                              <li key={ridx} className="text-sm text-slate flex items-start">
                                <svg className="h-5 w-5 text-wave mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Implementation */}
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-ink mb-2">Implementation</h4>
                          <div className="bg-wave/10 rounded-lg p-4 space-y-2">
                            {rec.implementation.map((impl, iidx) => (
                              <div key={iidx} className="text-sm font-mono text-ink">
                                {impl.includes('db.') || impl.includes('{{') ? (
                                  <code className="block bg-wave/30 text-wave p-2 rounded overflow-x-auto font-semibold">
                                    {impl}
                                  </code>
                                ) : (
                                  <span className="text-slate">• {impl}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Benefits */}
                        <div>
                          <h4 className="text-sm font-semibold text-ink mb-2">Benefits</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {rec.benefits.map((benefit, bidx) => (
                              <div key={bidx} className="bg-wave/10 text-wave text-sm px-3 py-2 rounded-lg font-medium">
                                {benefit}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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

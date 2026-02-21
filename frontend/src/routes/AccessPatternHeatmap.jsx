import { useState, useEffect } from 'react';
import { analyzeAccessPatterns } from '../api/accessPatterns';
import { getHistory } from '../api/schemas';

export default function AccessPatternHeatmap() {
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
      const result = await analyzeAccessPatterns(schema._id);
      setAnalysis(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getHeatmapColor(percentage) {
    if (percentage >= 80) return '#ef4444';
    if (percentage >= 60) return '#f97316';
    if (percentage >= 40) return '#f59e0b';
    if (percentage >= 20) return '#eab308';
    return '#22c55e';
  }

  function getQueryFrequencyColor(frequency) {
    if (frequency > 900) return '#ef4444';  // Red
    if (frequency >= 700) return '#f59e0b'; // Yellow
    return '#22c55e';  // Green
  }

  function getPriorityColor(priority) {
    if (priority === 'high') return 'border-red-500 bg-red-50';
    if (priority === 'medium') return 'border-amber bg-amber/10';
    return 'border-green-500 bg-green-50';
  }

  // Horizontal Bar Chart for Query Frequency
  function renderQueryFrequencyChart() {
    if (!analysis || !analysis.most_filtered_fields) return null;

    const data = analysis.most_filtered_fields.slice(0, 8);
    const maxFreq = Math.max(...data.map(d => d.filter_frequency));
    const width = 700;
    const height = 300;
    const barHeight = 30;
    const padding = { top: 20, right: 100, bottom: 20, left: 200 };

    return (
      <svg width={width} height={height} className="w-full">
        <text x={width/2} y={15} textAnchor="middle" fontSize="14" fontWeight="600" fill="#1e293b">
          Most Filtered Fields (Queries/Day)
        </text>
        
        {data.map((field, i) => {
          const barWidth = ((field.filter_frequency / maxFreq) * (width - padding.left - padding.right));
          const y = padding.top + i * (barHeight + 5);
          const color = getQueryFrequencyColor(field.filter_frequency);
          
          return (
            <g key={i}>
              {/* Field label */}
              <text x={padding.left - 10} y={y + barHeight/2 + 4} textAnchor="end" fontSize="12" fill="#64748b">
                {field.collection}.{field.field}
              </text>
              
              {/* Bar */}
              <rect
                x={padding.left}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                rx="4"
              />
              
              {/* Frequency value */}
              <text x={padding.left + barWidth + 8} y={y + barHeight/2 + 4} fontSize="12" fontWeight="600" fill={color}>
                {field.filter_frequency}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  // Stacked Bar Chart for Read/Write Distribution
  function renderReadWriteChart() {
    if (!analysis || !analysis.collection_write_patterns) return null;

    const data = analysis.collection_write_patterns;
    const width = 600;
    const height = 250;
    const barWidth = 60;
    const padding = { top: 40, right: 20, bottom: 60, left: 60 };
    const chartHeight = height - padding.top - padding.bottom;

    return (
      <svg width={width} height={height} className="w-full">
        <text x={width/2} y={20} textAnchor="middle" fontSize="14" fontWeight="600" fill="#1e293b">
          Read vs Write Distribution
        </text>
        
        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map((val) => (
          <g key={val}>
            <line
              x1={padding.left}
              y1={padding.top + chartHeight - (val/100 * chartHeight)}
              x2={width - padding.right}
              y2={padding.top + chartHeight - (val/100 * chartHeight)}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text
              x={padding.left - 10}
              y={padding.top + chartHeight - (val/100 * chartHeight) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#94a3b8"
            >
              {val}%
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((coll, i) => {
          const x = padding.left + i * (barWidth + 20);
          const writeHeight = (coll.write_percentage / 100) * chartHeight;
          const readHeight = ((100 - coll.write_percentage) / 100) * chartHeight;
          
          return (
            <g key={i}>
              {/* Read (blue) */}
              <rect
                x={x}
                y={padding.top}
                width={barWidth}
                height={readHeight}
                fill="#3b82f6"
              />
              
              {/* Write (orange) */}
              <rect
                x={x}
                y={padding.top + readHeight}
                width={barWidth}
                height={writeHeight}
                fill="#f97316"
              />
              
              {/* Collection name */}
              <text
                x={x + barWidth/2}
                y={height - padding.bottom + 15}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
                transform={`rotate(-20 ${x + barWidth/2} ${height - padding.bottom + 15})`}
              >
                {coll.collection}
              </text>
              
              {/* Write percentage */}
              <text
                x={x + barWidth/2}
                y={padding.top + readHeight + writeHeight/2 + 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="white"
              >
                {coll.write_percentage}%
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${width - padding.right - 100}, ${padding.top})`}>
          <rect x="0" y="0" width="15" height="15" fill="#3b82f6" />
          <text x="20" y="12" fontSize="11" fill="#64748b">Read</text>
          <rect x="0" y="20" width="15" height="15" fill="#f97316" />
          <text x="20" y="32" fontSize="11" fill="#64748b">Write</text>
        </g>
      </svg>
    );
  }

  // Line Graph for Array Growth Projection
  function renderArrayGrowthChart() {
    if (!analysis || !analysis.array_growth_projection) return null;

    const projection = analysis.array_growth_projection.projection;
    const width = 600;
    const height = 250;
    const padding = { top: 40, right: 40, bottom: 50, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxSize = Math.max(...projection.map(p => p.size_mb), 16);

    const points = projection.map((p, i) => ({
      x: padding.left + (i / (projection.length - 1)) * chartWidth,
      y: padding.top + chartHeight - (p.size_mb / maxSize) * chartHeight
    }));

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <svg width={width} height={height} className="w-full">
        <text x={width/2} y={20} textAnchor="middle" fontSize="14" fontWeight="600" fill="#1e293b">
          Array Growth Projection (6 Months)
        </text>

        {/* Grid lines */}
        {[0, 4, 8, 12, 16].map((val) => (
          <g key={val}>
            <line
              x1={padding.left}
              y1={padding.top + chartHeight - (val/maxSize * chartHeight)}
              x2={width - padding.right}
              y2={padding.top + chartHeight - (val/maxSize * chartHeight)}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text
              x={padding.left - 10}
              y={padding.top + chartHeight - (val/maxSize * chartHeight) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#94a3b8"
            >
              {val}MB
            </text>
          </g>
        ))}

        {/* Danger zone (>12MB) */}
        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight - (12/maxSize * chartHeight)}
          fill="#fee2e2"
          opacity="0.3"
        />
        <line
          x1={padding.left}
          y1={padding.top + chartHeight - (12/maxSize * chartHeight)}
          x2={width - padding.right}
          y2={padding.top + chartHeight - (12/maxSize * chartHeight)}
          stroke="#ef4444"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        <text
          x={width - padding.right - 5}
          y={padding.top + chartHeight - (12/maxSize * chartHeight) - 5}
          textAnchor="end"
          fontSize="10"
          fill="#ef4444"
          fontWeight="600"
        >
          12MB Danger
        </text>

        {/* 16MB MongoDB Hard Limit */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight - (16/maxSize * chartHeight)}
          x2={width - padding.right}
          y2={padding.top + chartHeight - (16/maxSize * chartHeight)}
          stroke="#dc2626"
          strokeWidth="3"
          strokeDasharray="8,4"
        />
        <text
          x={width - padding.right - 5}
          y={padding.top + chartHeight - (16/maxSize * chartHeight) - 5}
          textAnchor="end"
          fontSize="11"
          fill="#dc2626"
          fontWeight="700"
        >
          🔴 16MB MONGODB LIMIT
        </text>

        {/* Line */}
        <path d={pathData} stroke="#3b82f6" strokeWidth="3" fill="none" />

        {/* Points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#3b82f6" />
        ))}

        {/* X-axis labels */}
        {projection.map((p, i) => (
          <text
            key={i}
            x={points[i].x}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fontSize="10"
            fill="#64748b"
          >
            M{p.month}
          </text>
        ))}

        {/* Y-axis label */}
        <text x={15} y={height/2} textAnchor="middle" fontSize="11" fill="#64748b" transform={`rotate(-90 15 ${height/2})`}>
          Document Size (MB)
        </text>

        {/* Field name */}
        <text x={padding.left} y={padding.top - 10} fontSize="11" fill="#64748b" fontStyle="italic">
          {analysis.array_growth_projection.field}
        </text>
      </svg>
    );
  }

  // Side-by-side Bar Chart for Index Impact
  function renderIndexImpactChart() {
    if (!analysis || !analysis.index_commands || analysis.index_commands.length === 0) return null;

    const commands = analysis.index_commands.slice(0, 5);
    const width = 700;
    const height = 300;
    const barHeight = 40;
    const padding = { top: 40, right: 80, bottom: 20, left: 180 };
    const maxTime = Math.max(...commands.flatMap(c => [c.before_ms, c.after_ms]));

    return (
      <svg width={width} height={height} className="w-full">
        <text x={width/2} y={20} textAnchor="middle" fontSize="14" fontWeight="600" fill="#1e293b">
          Index Impact (Before vs After)
        </text>

        {commands.map((cmd, i) => {
          const y = padding.top + i * (barHeight + 15);
          const beforeWidth = (cmd.before_ms / maxTime) * (width - padding.left - padding.right);
          const afterWidth = (cmd.after_ms / maxTime) * (width - padding.left - padding.right);
          
          return (
            <g key={i}>
              {/* Label */}
              <text x={padding.left - 10} y={y + 15} textAnchor="end" fontSize="11" fill="#64748b">
                {cmd.collection}.{cmd.fields.join('+')}
              </text>
              
              {/* Before bar (red) */}
              <rect
                x={padding.left}
                y={y}
                width={beforeWidth}
                height={15}
                fill="#ef4444"
                opacity="0.7"
                rx="2"
              />
              <text x={padding.left + beforeWidth + 5} y={y + 12} fontSize="10" fill="#ef4444" fontWeight="600">
                {cmd.before_ms}ms
              </text>
              
              {/* After bar (green) */}
              <rect
                x={padding.left}
                y={y + 18}
                width={afterWidth}
                height={15}
                fill="#22c55e"
                rx="2"
              />
              <text x={padding.left + afterWidth + 5} y={y + 30} fontSize="10" fill="#22c55e" fontWeight="600">
                {cmd.after_ms}ms
              </text>
              
              {/* Improvement */}
              <text x={width - padding.right + 10} y={y + 20} fontSize="11" fontWeight="700" fill="#0ea5e9">
                {cmd.improvement}
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${padding.left}, ${height - 15})`}>
          <rect x="0" y="0" width="12" height="12" fill="#ef4444" opacity="0.7" />
          <text x="17" y="10" fontSize="10" fill="#64748b">Without Index</text>
          <rect x="110" y="0" width="12" height="12" fill="#22c55e" />
          <text x="127" y="10" fontSize="10" fill="#64748b">With Index</text>
        </g>
      </svg>
    );
  }

  // Index Coverage Ratio Chart (NEW)
  function renderIndexCoverageChart() {
    if (!analysis || !analysis.summary) return null;

    const total = analysis.summary.high_filter_fields;
    const indexed = analysis.summary.recommended_indexes;
    const coverage = analysis.summary.index_coverage_percent || 0;
    const width = 300;
    const height = 250;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 70;

    // Arc for coverage
    const coverageAngle = (coverage / 100) * 360;
    const coverageRad = (coverageAngle * Math.PI) / 180;
    
    const arcPath = `
      M ${centerX} ${centerY - radius}
      A ${radius} ${radius} 0 ${coverageAngle > 180 ? 1 : 0} 1 
      ${centerX + radius * Math.sin(coverageRad)} ${centerY - radius * Math.cos(coverageRad)}
      L ${centerX} ${centerY}
      Z
    `;

    const color = coverage >= 70 ? '#22c55e' : coverage >= 40 ? '#f59e0b' : '#ef4444';

    return (
      <svg width={width} height={height} className="w-full">
        <text x={centerX} y={20} textAnchor="middle" fontSize="14" fontWeight="600" fill="#1e293b">
          Index Coverage Ratio
        </text>

        {/* Background circle */}
        <circle cx={centerX} cy={centerY} r={radius} fill="#e2e8f0" />
        
        {/* Coverage arc */}
        <path d={arcPath} fill={color} opacity="0.8" />

        {/* Center text */}
        <text x={centerX} y={centerY - 5} textAnchor="middle" fontSize="32" fontWeight="700" fill={color}>
          {Math.round(coverage)}%
        </text>
        <text x={centerX} y={centerY + 15} textAnchor="middle" fontSize="11" fill="#64748b">
          Coverage
        </text>

        {/* Stats below */}
        <text x={centerX} y={height - 40} textAnchor="middle" fontSize="11" fill="#64748b">
          <tspan fontWeight="600" fill="#1e293b">{indexed}</tspan> of <tspan fontWeight="600" fill="#1e293b">{total}</tspan> high-frequency fields covered
        </text>
        <text x={centerX} y={height - 25} textAnchor="middle" fontSize="9" fill="#94a3b8" fontStyle="italic">
          (Compound indexes cover multiple fields)
        </text>
        
        <text x={centerX} y={height - 20} textAnchor="middle" fontSize="10" fill={color} fontWeight="600">
          {coverage >= 70 ? '✓ Excellent coverage' : coverage >= 40 ? '⚠ Needs improvement' : '✗ Poor coverage'}
        </text>
      </svg>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-wave">Access Pattern Heatmap</h1>
        <p className="text-slate mt-2">
          Analyze collection usage patterns to optimize indexing and storage
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

        {/* Analysis Results */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="data-card p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wave mx-auto"></div>
              <p className="mt-4 text-slate">Analyzing patterns...</p>
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

          {!loading && !error && !analysis && (
            <div className="data-card p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-ink">No schema selected</h3>
              <p className="mt-1 text-sm text-slate">Select a schema to analyze access patterns</p>
            </div>
          )}

          {analysis && analysis.success && (
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-2 space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-6 gap-3">
                <div className="data-card p-4 bg-wave/10">
                  <p className="text-xs text-slate uppercase tracking-wide">Fields</p>
                  <p className="text-2xl font-bold text-ink mt-1">{analysis.summary.total_fields_analyzed}</p>
                </div>
                <div className="data-card p-4 bg-wave/10">
                  <p className="text-xs text-slate uppercase tracking-wide">Arrays</p>
                  <p className="text-2xl font-bold text-ink mt-1">{analysis.summary.total_arrays}</p>
                </div>
                <div className="data-card p-4 bg-wave/10">
                  <p className="text-xs text-slate uppercase tracking-wide">Collections</p>
                  <p className="text-2xl font-bold text-ink mt-1">{analysis.summary.total_collections}</p>
                </div>
                <div className="data-card p-4 bg-amber/10">
                  <p className="text-xs text-slate uppercase tracking-wide">High Filter</p>
                  <p className="text-2xl font-bold text-amber mt-1">{analysis.summary.high_filter_fields}</p>
                </div>
                <div className="data-card p-4 bg-red-50">
                  <p className="text-xs text-slate uppercase tracking-wide">Write Heavy</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{analysis.summary.write_heavy_collections}</p>
                </div>
                <div className="data-card p-4 bg-green-50">
                  <p className="text-xs text-slate uppercase tracking-wide">Coverage</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{analysis.summary.index_coverage_percent?.toFixed(0) || 0}%</p>
                </div>
              </div>

              {/* Index Storage Estimates (Atlas-style) */}
              {analysis.index_storage_estimates && (
                <div className="data-card p-6 bg-gradient-to-br from-wave/5 to-blush/20">
                  <h3 className="text-lg font-semibold text-ink mb-4">📊 Index Storage Analysis</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate uppercase tracking-wide">Data Size</p>
                      <p className="text-2xl font-bold text-ink mt-1">{analysis.index_storage_estimates.data_size_gb} GB</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate uppercase tracking-wide">Index Size</p>
                      <p className="text-2xl font-bold text-wave mt-1">{analysis.index_storage_estimates.index_size_gb} GB</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate uppercase tracking-wide">Total Storage</p>
                      <p className="text-2xl font-bold text-ink mt-1">{analysis.index_storage_estimates.total_size_gb} GB</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate uppercase tracking-wide">Index Ratio</p>
                      <p className={`text-2xl font-bold mt-1 ${
                        analysis.index_storage_estimates.status === 'healthy' ? 'text-green-600' : 
                        analysis.index_storage_estimates.status === 'warning' ? 'text-amber' : 'text-red-600'
                      }`}>
                        {analysis.index_storage_estimates.index_ratio_percent}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-start gap-2">
                    {analysis.index_storage_estimates.status === 'healthy' ? (
                      <span className="text-green-600">✓</span>
                    ) : analysis.index_storage_estimates.status === 'warning' ? (
                      <span className="text-amber">⚠️</span>
                    ) : (
                      <span className="text-red-600">🚨</span>
                    )}
                    <p className="text-sm text-slate flex-1">
                      {analysis.index_storage_estimates.recommendation}
                      {analysis.index_storage_estimates.status !== 'healthy' && (
                        <span className="block mt-1 text-xs">
                          Ideal: 20-40% • Acceptable: 40-60% • Risk: 60%+ • Over-indexed: 80%+
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Write Amplification Analysis */}
              {analysis.write_amplification && (
                <div className="data-card p-6 bg-gradient-to-br from-wave/5 to-amber/5">
                  <h3 className="text-lg font-semibold text-ink mb-4">⚡ Write Amplification Analysis</h3>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate uppercase tracking-wide">Base Write</p>
                      <p className="text-2xl font-bold text-ink mt-1">{analysis.write_amplification.base_write}</p>
                      <p className="text-xs text-slate mt-1">Document only</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate uppercase tracking-wide">Index Updates</p>
                      <p className="text-2xl font-bold text-wave mt-1">{analysis.write_amplification.index_writes}</p>
                      <p className="text-xs text-slate mt-1">Per insert</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate uppercase tracking-wide">Total Cost</p>
                      <p className="text-2xl font-bold text-amber mt-1">{analysis.write_amplification.total_write_cost}</p>
                      <p className="text-xs text-slate mt-1">Operations</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate uppercase tracking-wide">Amplification</p>
                      <p className={`text-2xl font-bold mt-1 ${
                        analysis.write_amplification.status === 'healthy' ? 'text-wave' : 
                        analysis.write_amplification.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {analysis.write_amplification.amplification_factor}x
                      </p>
                    </div>
                  </div>
                  <div className={`p-3 rounded border ${
                    analysis.write_amplification.status === 'healthy' ? 'bg-wave/10 border-wave/30' : 
                    analysis.write_amplification.status === 'warning' ? 'bg-amber/10 border-amber/30' : 
                    'bg-red-50 border-red-200'
                  }`}>
                    <p className={`text-sm font-medium ${
                      analysis.write_amplification.status === 'healthy' ? 'text-wave' : 
                      analysis.write_amplification.status === 'warning' ? 'text-amber-700' : 
                      'text-red-700'
                    }`}>
                      {analysis.write_amplification.warning}
                    </p>
                    {analysis.write_amplification.most_affected_collections.length > 0 && (
                      <div className="mt-2 text-xs text-slate">
                        <p className="font-semibold mb-1">Most affected:</p>
                        {analysis.write_amplification.most_affected_collections.map((coll, i) => (
                          <p key={i}>
                            {coll.collection}: {coll.write_ops_per_sec} ops/sec → {coll.effective_cost} effective ops/sec
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Chart: Query Frequency */}
              <div className="data-card p-6">
                {renderQueryFrequencyChart()}
              </div>

              {/* Charts Row: Read/Write + Index Coverage */}
              <div className="grid grid-cols-2 gap-4">
                <div className="data-card p-6">
                  {renderReadWriteChart()}
                </div>
                <div className="data-card p-6 flex items-center justify-center">
                  {renderIndexCoverageChart()}
                </div>
              </div>

              {/* Charts Row: Array Growth + Index Impact */}
              {(analysis.array_growth_projection || (analysis.index_commands && analysis.index_commands.length > 0)) && (
                <div className="grid grid-cols-2 gap-4">
                  {analysis.array_growth_projection && (
                    <div className="data-card p-6">
                      {renderArrayGrowthChart()}
                    </div>
                  )}
                  {analysis.index_commands && analysis.index_commands.length > 0 && (
                    <div className="data-card p-6">
                      {renderIndexImpactChart()}
                    </div>
                  )}
                </div>
              )}

              {/* Query Pattern Classification */}
              {analysis.query_patterns && (
                <div className="data-card p-6">
                  <h3 className="text-lg font-semibold text-ink mb-4">🔍 Query Pattern Classification</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-blue-500 rounded"></div>
                        <p className="font-semibold text-ink">Point Lookups ({analysis.query_patterns.point_lookups.count})</p>
                      </div>
                      <p className="text-xs text-slate mb-3">{analysis.query_patterns.point_lookups.description}</p>
                      <div className="space-y-2">
                        {analysis.query_patterns.point_lookups.queries?.slice(0, 3).map((q, i) => (
                          <div key={i} className="bg-slate-50 p-2 rounded">
                            <p className="text-xs font-mono text-slate-700">{q.field}</p>
                            <p className="text-xs text-slate-500">{q.frequency} queries/day</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <p className="font-semibold text-ink">Range Queries ({analysis.query_patterns.range_queries.count})</p>
                      </div>
                      <p className="text-xs text-slate mb-3">{analysis.query_patterns.range_queries.description}</p>
                      <div className="space-y-2">
                        {analysis.query_patterns.range_queries.queries?.slice(0, 3).map((q, i) => (
                          <div key={i} className="bg-slate-50 p-2 rounded">
                            <p className="text-xs font-mono text-slate-700">{q.field}</p>
                            <p className="text-xs text-slate-500">{q.frequency} queries/day</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-amber rounded"></div>
                        <p className="font-semibold text-ink">Sort Queries ({analysis.query_patterns.sort_queries.count})</p>
                      </div>
                      <p className="text-xs text-slate mb-3">{analysis.query_patterns.sort_queries.description}</p>
                      <div className="space-y-2">
                        {analysis.query_patterns.sort_queries.queries?.slice(0, 3).map((q, i) => (
                          <div key={i} className="bg-slate-50 p-2 rounded">
                            <p className="text-xs font-mono text-slate-700">{q.field}</p>
                            <p className="text-xs text-slate-500">{q.frequency} queries/day</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-purple-500 rounded"></div>
                        <p className="font-semibold text-ink">Aggregations ({analysis.query_patterns.aggregations.count})</p>
                      </div>
                      <p className="text-xs text-slate mb-3">{analysis.query_patterns.aggregations.description}</p>
                      <div className="space-y-2">
                        {analysis.query_patterns.aggregations.collections?.slice(0, 3).map((collection, i) => (
                          <div key={i} className="bg-slate-50 p-2 rounded">
                            <p className="text-xs font-mono text-slate-700">{collection}</p>
                            <p className="text-xs text-slate-500">Collection with $lookup references</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MongoDB Index Commands */}
              {analysis.index_commands && analysis.index_commands.length > 0 && (
                <div className="data-card p-6">
                  <h3 className="text-lg font-semibold text-ink mb-4">🔧 MongoDB Index Commands</h3>
                  <p className="text-sm text-slate mb-4">Production-ready index definitions</p>
                  
                  <div className="space-y-3">
                    {analysis.index_commands.map((cmd, idx) => (
                      <div key={idx} className="bg-slate-900 text-green-400 p-4 rounded font-mono text-sm">
                        <div className="flex items-start justify-between">
                          <code className="flex-1">{cmd.command}</code>
                          <span className="ml-4 text-xs bg-green-500 text-white px-2 py-1 rounded font-sans">
                            {cmd.improvement}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-2 font-sans">
                          {cmd.reason} • {cmd.before_ms}ms → {cmd.after_ms}ms
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-3 bg-amber/10 border border-amber/30 rounded">
                    <p className="text-sm text-amber-700">
                      <span className="font-semibold">⚠️ Index Overhead Warning:</span> {analysis.summary.recommended_indexes} indexes recommended. 
                      Too many indexes slow writes. Monitor write performance after applying.
                    </p>
                  </div>
                </div>
              )}

              {/* Array Growth Risk */}
              {analysis.array_growth_projection && (
                <div className="data-card p-6">
                  <h3 className="text-lg font-semibold text-ink mb-4">📈 Array Growth Risk</h3>
                  <div className="bg-red-50 border border-red-200 p-4 rounded mb-4">
                    <div className="flex items-start gap-3">
                      <svg className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <p className="font-semibold text-red-900">{analysis.array_growth_projection.field}</p>
                        <p className="text-sm text-red-700 mt-1">
                          {analysis.array_growth_projection.current_updates_per_day} updates/day
                        </p>
                        <p className="text-sm text-red-800 mt-2 font-medium">
                          Risk: {analysis.array_growth_projection.risk_level}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-green-400 p-4 rounded font-mono text-sm">
                    <div className="text-slate-400 text-xs mb-2 font-sans">Recommended Solution:</div>
                    <code className="whitespace-pre">{analysis.array_growth_projection.split_command}</code>
                  </div>
                </div>
              )}

              {/* Index Selectivity Analysis */}
              {analysis?.selectivity_analysis?.selectivity_analysis?.length > 0 && (
                <div className="data-card p-6">
                  <h3 className="text-lg font-semibold text-ink mb-4">🎯 Index Selectivity Analysis</h3>
                  <p className="text-sm text-slate mb-4">
                    Selectivity measures how well an index narrows down results. Low selectivity = weak index.
                  </p>
                  
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-mist/50 p-4 rounded">
                      <p className="text-xs text-slate uppercase tracking-wide mb-1">Total Indexes</p>
                      <p className="text-2xl font-bold text-ink">{analysis.selectivity_analysis.selectivity_analysis.length}</p>
                    </div>
                    <div className="bg-amber/10 p-4 rounded border border-amber/20">
                      <p className="text-xs text-slate uppercase tracking-wide mb-1">Weak Indexes</p>
                      <p className="text-2xl font-bold text-amber">{analysis.selectivity_analysis.weak_index_count || 0}</p>
                    </div>
                    <div className="bg-wave/10 p-4 rounded border border-wave/20">
                      <p className="text-xs text-slate uppercase tracking-wide mb-1">Strong Indexes</p>
                      <p className="text-2xl font-bold text-wave">
                        {analysis.selectivity_analysis.selectivity_analysis.length - (analysis.selectivity_analysis.weak_index_count || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Selectivity Table */}
                  <div className="space-y-2">
                    {analysis.selectivity_analysis.selectivity_analysis.map((sel, idx) => (
                      <div key={idx} className={`p-3 rounded border ${sel.weak_index ? 'border-amber/30 bg-amber/10' : 'border-mist/30 bg-mist/20'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-mono text-sm font-semibold text-ink">
                              {sel.collection}.{sel.field}
                            </p>
                            <p className="text-xs text-slate mt-1">{sel.recommendation}</p>
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${
                              sel.selectivity_percent >= 80 ? 'text-wave' :
                              sel.selectivity_percent >= 50 ? 'text-ink' :
                              sel.selectivity_percent >= 30 ? 'text-amber' :
                              'text-amber'
                            }`}>
                              {sel.selectivity_percent}%
                            </div>
                            <p className="text-xs text-slate mt-1">
                              ~{sel.estimated_unique_values.toLocaleString()} unique
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {analysis.selectivity_analysis.weak_index_count > 0 && (
                    <div className="mt-4 p-3 bg-amber/10 border border-amber/30 rounded">
                      <p className="text-sm text-amber">
                        <span className="font-semibold">⚠️ Weak Indexes Detected:</span> {analysis.selectivity_analysis.weak_index_count} indexes 
                        have low selectivity (&lt;20%). Consider using compound indexes or removing them.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Shard Key Recommendations */}
              {analysis.shard_key_recommendations && analysis.shard_key_recommendations.length > 0 && (
                <div className="data-card p-6">
                  <h3 className="text-lg font-semibold text-ink mb-4">🗂️ Shard Key Recommendations</h3>
                  <p className="text-sm text-slate mb-4">
                    High-volume collections should be sharded to distribute load across multiple servers.
                  </p>
                  
                  <div className="space-y-4">
                    {analysis.shard_key_recommendations.map((rec, idx) => (
                      <div key={idx} className="border border-wave/30 bg-wave/10 p-4 rounded">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-ink text-base">{rec.collection}</p>
                            <p className="text-xs text-slate mt-1">
                              {rec.ops_per_sec.toFixed(1)} ops/sec • {rec.write_percentage.toFixed(1)}% writes
                            </p>
                          </div>
                          <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                            rec.strategy === 'hashed' ? 'bg-amber/20 text-amber' : 'bg-wave/20 text-wave'
                          }`}>
                            {rec.strategy}
                          </span>
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-sm font-semibold text-ink mb-1">Recommended Shard Key:</p>
                          <p className="font-mono text-sm text-wave">{rec.shard_key}</p>
                        </div>
                        
                        <p className="text-sm text-slate mb-3">{rec.reason}</p>
                        
                        <div className="bg-blush border border-wave/20 p-3 rounded font-mono text-xs">
                          <code className="text-wave">{rec.command}</code>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-3 bg-wave/10 border border-wave/30 rounded">
                    <p className="text-sm text-ink">
                      <span className="font-semibold text-wave">💡 Sharding Benefits:</span> Distributes data and load, 
                      enables horizontal scaling, and improves performance for high-volume collections.
                    </p>
                  </div>
                </div>
              )}

              {/* Latency Projection at Scale */}
              {analysis?.latency_projection && (
                <div className="data-card p-6">
                  <h3 className="text-lg font-semibold text-ink mb-4">⚡ Performance at 5M Users</h3>
                  <p className="text-sm text-slate mb-4">
                    Projected read/write latency at {analysis.latency_projection.target_users?.toLocaleString() || 'N/A'} users 
                    ({analysis.latency_projection.scale_factor || 'N/A'}x current scale)
                  </p>

                  {/* Status Banner */}
                  <div className={`p-4 rounded mb-6 border ${
                    analysis.latency_projection?.status === 'critical' ? 'bg-amber/20 border-amber' :
                    analysis.latency_projection?.status === 'warning' ? 'bg-amber/10 border-amber/30' :
                    'bg-wave/10 border-wave/30'
                  }`}>
                    <p className={`font-semibold ${
                      analysis.latency_projection?.status === 'critical' ? 'text-amber' :
                      analysis.latency_projection?.status === 'warning' ? 'text-amber' :
                      'text-wave'
                    }`}>
                      {analysis.latency_projection?.warning || 'Performance projection unavailable'}
                    </p>
                  </div>

                  {/* Current vs Projected Metrics */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Current Metrics */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate mb-3">Current ({analysis.latency_projection?.current_users?.toLocaleString() || 'N/A'} users)</h4>
                      <div className="space-y-3">
                        <div className="bg-mist/50 p-3 rounded">
                          <p className="text-xs text-slate mb-1">Read Latency</p>
                          <p className="text-xl font-bold text-wave">{analysis.latency_projection?.current_metrics?.read_latency_ms || 0}ms</p>
                        </div>
                        <div className="bg-mist/50 p-3 rounded">
                          <p className="text-xs text-slate mb-1">Write Latency</p>
                          <p className="text-xl font-bold text-wave">{analysis.latency_projection?.current_metrics?.write_latency_ms || 0}ms</p>
                        </div>
                        <div className="bg-mist/50 p-3 rounded">
                          <p className="text-xs text-slate mb-1">Read Ops/Sec</p>
                          <p className="text-sm font-semibold text-ink">{analysis.latency_projection?.current_metrics?.read_ops_per_sec || 0}</p>
                        </div>
                        <div className="bg-mist/50 p-3 rounded">
                          <p className="text-xs text-slate mb-1">Write Ops/Sec</p>
                          <p className="text-sm font-semibold text-ink">{analysis.latency_projection?.current_metrics?.write_ops_per_sec || 0}</p>
                        </div>
                      </div>
                    </div>

                    {/* Projected Metrics */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate mb-3">Projected ({analysis.latency_projection?.target_users?.toLocaleString() || 'N/A'} users)</h4>
                      <div className="space-y-3">
                        <div className={`p-3 rounded border ${
                          (analysis.latency_projection?.projected_metrics?.read_latency_ms || 0) > 100 ? 'bg-amber/20 border-amber' :
                          (analysis.latency_projection?.projected_metrics?.read_latency_ms || 0) > 75 ? 'bg-amber/10 border-amber/30' :
                          'bg-wave/10 border-wave/30'
                        }`}>
                          <p className="text-xs text-slate mb-1">Read Latency</p>
                          <p className={`text-xl font-bold ${
                            (analysis.latency_projection?.projected_metrics?.read_latency_ms || 0) > 100 ? 'text-amber' :
                            (analysis.latency_projection?.projected_metrics?.read_latency_ms || 0) > 75 ? 'text-amber' :
                            'text-wave'
                          }`}>
                            {analysis.latency_projection?.projected_metrics?.read_latency_ms || 0}ms
                          </p>
                        </div>
                        <div className={`p-3 rounded border ${
                          (analysis.latency_projection?.projected_metrics?.write_latency_ms || 0) > 50 ? 'bg-amber/20 border-amber' :
                          (analysis.latency_projection?.projected_metrics?.write_latency_ms || 0) > 30 ? 'bg-amber/10 border-amber/30' :
                          'bg-wave/10 border-wave/30'
                        }`}>
                          <p className="text-xs text-slate mb-1">Write Latency</p>
                          <p className={`text-xl font-bold ${
                            (analysis.latency_projection?.projected_metrics?.write_latency_ms || 0) > 50 ? 'text-amber' :
                            (analysis.latency_projection?.projected_metrics?.write_latency_ms || 0) > 30 ? 'text-amber' :
                            'text-wave'
                          }`}>
                            {analysis.latency_projection?.projected_metrics?.write_latency_ms || 0}ms
                          </p>
                        </div>
                        <div className="bg-mist/50 p-3 rounded">
                          <p className="text-xs text-slate mb-1">Read Ops/Sec</p>
                          <p className="text-sm font-semibold text-ink">{analysis.latency_projection?.projected_metrics?.read_ops_per_sec || 0}</p>
                        </div>
                        <div className="bg-mist/50 p-3 rounded">
                          <p className="text-xs text-slate mb-1">Write Ops/Sec</p>
                          <p className="text-sm font-semibold text-ink">{analysis.latency_projection?.projected_metrics?.write_ops_per_sec || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  {analysis.latency_projection?.recommendations?.some(r => r) && (
                    <div>
                      <h4 className="text-sm font-semibold text-ink mb-3">Scale Readiness Actions</h4>
                      <ul className="space-y-2">
                        {analysis.latency_projection.recommendations.filter(r => r).map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-slate">
                            <span className="text-wave mt-0.5">✓</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Recommendations */}
              {analysis?.recommendations?.length > 0 && (
                <div className="data-card p-6">
                  <h3 className="text-lg font-semibold text-ink mb-4">💡 Optimization Roadmap</h3>
                  <div className="space-y-4">
                    {analysis.recommendations.map((rec, idx) => (
                      <div key={idx} className={`p-4 rounded border-l-4 ${getPriorityColor(rec.priority)}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                                rec.priority === 'high' ? 'bg-red-200 text-red-700' : 
                                rec.priority === 'medium' ? 'bg-amber/30 text-amber' : 
                                'bg-green-200 text-green-700'
                              }`}>
                                {rec.priority}
                              </span>
                              <span className="text-xs text-slate uppercase tracking-wide">{rec.category}</span>
                            </div>
                            <p className="font-semibold text-ink text-base">{rec.title}</p>
                            <p className="text-sm text-slate mt-2">{rec.action}</p>
                            {rec.warning && (
                              <p className="text-xs text-amber-700 mt-2 font-medium">⚠️ {rec.warning}</p>
                            )}
                            <p className="text-xs font-medium mt-2 text-wave">💪 Impact: {rec.impact}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

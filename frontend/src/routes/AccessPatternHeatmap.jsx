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
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);
  const [hoveredIndexCommand, setHoveredIndexCommand] = useState(null);
  const [hoveredGrowthPoint, setHoveredGrowthPoint] = useState(null);

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
    if (priority === 'high') return 'border-l-4 border-red-500 bg-red-900/20';
    if (priority === 'medium') return 'border-l-4 border-amber-500 bg-amber-900/20';
    return 'border-l-4 border-green-500 bg-green-900/20';
  }

  // Horizontal Bar Chart for Query Frequency
  function renderQueryFrequencyChart() {
    if (!analysis || !analysis.most_filtered_fields) return null;

    const data = analysis.most_filtered_fields.slice(0, 8);
    const maxFreq = Math.max(...data.map(d => d.filter_frequency));

    return (
      <div className="w-full">
        <h3 className="text-sm font-semibold text-slate-900 mb-6">
          Most Filtered Fields (Queries/Day)
        </h3>
        
        <div className="space-y-4">
          {data.map((field, i) => {
            const percentage = (field.filter_frequency / maxFreq) * 100;
            const color = getQueryFrequencyColor(field.filter_frequency);
            const isHovered = hoveredBarIndex === i;
            
            // Determine text color based on bar color for accessibility
            let bgClass, textColorClass, hoverBgClass;
            if (color === '#ef4444') { // red
              bgClass = 'bg-red-500';
              hoverBgClass = 'hover:bg-red-600';
              textColorClass = 'text-white'; // white text on red
            } else if (color === '#f97316') { // orange
              bgClass = 'bg-orange-500';
              hoverBgClass = 'hover:bg-orange-600';
              textColorClass = 'text-white'; // white text on orange
            } else if (color === '#eab308') { // yellow
              bgClass = 'bg-yellow-400';
              hoverBgClass = 'hover:bg-yellow-500';
              textColorClass = 'text-slate-900'; // dark text on yellow
            } else { // green
              bgClass = 'bg-green-500';
              hoverBgClass = 'hover:bg-green-600';
              textColorClass = 'text-white'; // white text on green
            }
            
            return (
              <div
                key={i}
                className="relative"
                onMouseEnter={() => setHoveredBarIndex(i)}
                onMouseLeave={() => setHoveredBarIndex(null)}
              >
                <div className="flex items-center gap-4 mb-1">
                  <div className="w-40 text-xs font-medium text-slate-600 truncate">
                    {field.collection}.{field.field}
                  </div>
                  
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-8 bg-slate-700 rounded-md overflow-hidden relative">
                      <div
                        className={`h-full ${bgClass} ${hoverBgClass} transition-all duration-200 flex items-center justify-end pr-3 ${ isHovered ? 'shadow-md' : ''}`}
                        style={{ width: `${percentage}%`, minWidth: '40px' }}
                      >
                        <span className={`text-xs font-bold ${textColorClass} whitespace-nowrap`}>
                          {field.filter_frequency}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Tooltip on hover */}
                {isHovered && (
                  <div className="absolute left-40 top-0 z-50 bg-slate-900 text-white text-xs rounded-md px-3 py-2 whitespace-nowrap shadow-lg">
                    <div className="font-semibold">{field.collection}.{field.field}</div>
                    <div className="text-slate-300">{field.filter_frequency} queries/day</div>
                    {field.update_patterns && field.update_patterns.length > 0 && (
                      <div className="text-slate-400 mt-1">
                        Updates: {field.update_patterns.join(', ')}
                      </div>
                    )}
                    {/* Tooltip arrow */}
                    <div className="absolute right-full top-2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-slate-900"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Stacked Bar Chart for Read/Write Distribution
  function renderReadWriteChart() {
    if (!analysis || !analysis.collection_write_patterns) return null;

    const data = analysis.collection_write_patterns;

    return (
      <div className="w-full">
        <h3 className="text-sm font-semibold text-slate-900 mb-6">
          Read vs Write Distribution
        </h3>
        
        <div className="space-y-6">
          {data.map((collection, idx) => {
            const readPercentage = 100 - collection.write_percentage;
            
            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndexCommand(`readwrite-${idx}`)}
                onMouseLeave={() => setHoveredIndexCommand(null)}
                className="relative"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-32 text-xs font-medium text-slate-600 truncate">
                    {collection.collection}
                  </div>
                  <div className="flex-1 h-10 bg-slate-700 rounded-md overflow-hidden flex shadow-sm">
                    {/* Read portion (blue) */}
                    <div
                      className="h-full bg-blue-500 flex items-center justify-center transition-all duration-200"
                      style={{ width: `${readPercentage}%`, minWidth: '30px' }}
                    >
                      {readPercentage > 15 && (
                        <span className="text-xs font-bold text-white">{readPercentage.toFixed(0)}%</span>
                      )}
                    </div>
                    
                    {/* Write portion (orange) */}
                    <div
                      className="h-full bg-orange-500 flex items-center justify-center transition-all duration-200"
                      style={{ width: `${collection.write_percentage}%`, minWidth: '30px' }}
                    >
                      {collection.write_percentage > 15 && (
                        <span className="text-xs font-bold text-white">{collection.write_percentage.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Tooltip on hover */}
                {hoveredIndexCommand === `readwrite-${idx}` && (
                  <div className="absolute left-32 top-1 z-50 bg-slate-900 text-white text-xs rounded-md px-3 py-2 whitespace-nowrap shadow-lg">
                    <div className="font-semibold">{collection.collection}</div>
                    <div className="text-slate-300">
                      <div>📖 Read: {readPercentage.toFixed(1)}%</div>
                      <div>✍️ Write: {collection.write_percentage.toFixed(1)}%</div>
                    </div>
                    {/* Tooltip arrow */}
                    <div className="absolute right-full top-2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-slate-900"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex gap-6 mt-6 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-xs font-medium text-slate-600">Read</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span className="text-xs font-medium text-slate-600">Write</span>
          </div>
        </div>
      </div>
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
      y: padding.top + chartHeight - (p.size_mb / maxSize) * chartHeight,
      size_mb: p.size_mb,
      month: p.month
    }));

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <div className="w-full relative">
        <svg width={width} height={height} className="w-full">
          <text x={width/2} y={20} textAnchor="middle" fontSize="14" fontWeight="600" fill="#f1f5f9">
            Array Growth Projection (6 Months)
          </text>
          
          {/* Field name label */}
          <text x={padding.left} y={35} fontSize="12" fill="#94a3b8" fontStyle="italic">
            {analysis.array_growth_projection.field}
          </text>

        {/* Grid lines */}
        {[0, 4, 8, 12, 16].map((val) => (
          <g key={val}>
            <line
              x1={padding.left}
              y1={padding.top + chartHeight - (val/maxSize * chartHeight)}
              x2={width - padding.right}
              y2={padding.top + chartHeight - (val/maxSize * chartHeight)}
              stroke="#475569"
              strokeWidth="1"
            />
            <text
              x={padding.left - 10}
              y={padding.top + chartHeight - (val/maxSize * chartHeight) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#cbd5e1"
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
          fill="#7f1d1d"
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
          <g key={i}
            onMouseEnter={() => setHoveredGrowthPoint(i)}
            onMouseLeave={() => setHoveredGrowthPoint(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" />
            <circle 
              cx={p.x} cy={p.y} r="8" 
              fill="none" 
              stroke="#60a5fa" 
              strokeWidth="2"
              opacity={hoveredGrowthPoint === i ? "0.8" : "0"}
              className="transition-opacity duration-200"
            />
          </g>
        ))}

        {/* X-axis labels */}
        {projection.map((p, i) => (
          <text
            key={i}
            x={points[i].x}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fontSize="10"
            fill="#cbd5e1"
          >
            M{p.month}
          </text>
        ))}

        {/* Y-axis label */}
        <text x={15} y={height/2} textAnchor="middle" fontSize="11" fill="#cbd5e1" transform={`rotate(-90 15 ${height/2})`}>
          Document Size (MB)
        </text>
        </svg>
        
        {/* Tooltip */}
        {hoveredGrowthPoint !== null && points[hoveredGrowthPoint] && (
          <div 
            className="absolute z-50 bg-slate-900 text-white text-xs rounded-md px-3 py-2 whitespace-nowrap shadow-lg"
            style={{
              left: `${points[hoveredGrowthPoint].x}px`,
              top: `${points[hoveredGrowthPoint].y - 50}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="font-semibold">Month {points[hoveredGrowthPoint].month}</div>
            <div className="text-blue-300">{points[hoveredGrowthPoint].size_mb.toFixed(2)} MB</div>
            <div className="absolute left-1/2 top-full w-0 h-0 border-t-4 border-l-4 border-r-4 border-t-slate-900 border-l-transparent border-r-transparent" style={{transform: 'translateX(-50%)'}}></div>
          </div>
        )}
      </div>
    );
  }

  // Side-by-side Bar Chart for Index Impact
  function renderIndexImpactChart() {
    if (!analysis || !analysis.index_commands || analysis.index_commands.length === 0) return null;

    const commands = analysis.index_commands.slice(0, 5);
    const maxTime = Math.max(...commands.flatMap(c => [c.before_ms, c.after_ms]));

    return (
      <div className="w-full">
        <h3 className="text-sm font-semibold text-slate-900 mb-6">
          Index Impact (Before vs After)
        </h3>
        
        <div className="space-y-5">
          {commands.map((cmd, idx) => {
            const beforePercent = (cmd.before_ms / maxTime) * 100;
            const afterPercent = (cmd.after_ms / maxTime) * 100;
            const improvement = ((cmd.before_ms - cmd.after_ms) / cmd.before_ms * 100).toFixed(0);
            
            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndexCommand(`index-${idx}`)}
                onMouseLeave={() => setHoveredIndexCommand(null)}
                className="relative"
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-40 text-xs font-medium text-slate-600 truncate">
                    {cmd.collection}.{cmd.fields.join('+')}
                  </div>
                </div>
                
                {/* Before bar */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-12 text-xs text-slate-500 font-medium">Before</div>
                  <div className="flex-1 h-6 bg-slate-700 rounded overflow-hidden relative">
                    <div
                      className="h-full bg-red-500 flex items-center justify-end pr-2 transition-all duration-200"
                      style={{ width: `${beforePercent}%`, minWidth: '40px' }}
                    >
                      <span className="text-xs font-bold text-white whitespace-nowrap">{cmd.before_ms}ms</span>
                    </div>
                  </div>
                </div>
                
                {/* After bar */}
                <div className="flex items-center gap-2">
                  <div className="w-12 text-xs text-slate-500 font-medium">After</div>
                  <div className="flex-1 h-6 bg-slate-700 rounded overflow-hidden relative">
                    <div
                      className="h-full bg-green-500 flex items-center justify-end pr-2 transition-all duration-200"
                      style={{ width: `${afterPercent}%`, minWidth: '40px' }}
                    >
                      <span className="text-xs font-bold text-white whitespace-nowrap">{cmd.after_ms}ms</span>
                    </div>
                  </div>
                </div>
                
                {/* Improvement badge */}
                <div className="mt-2 text-right">
                  <span className="text-xs font-bold bg-blue-500 text-white px-2 py-1 rounded">
                    ↓ {improvement}% faster
                  </span>
                </div>
                
                {/* Tooltip on hover */}
                {hoveredIndexCommand === `index-${idx}` && (
                  <div className="absolute left-40 top-0 z-50 bg-slate-900 text-white text-xs rounded-md px-3 py-2 whitespace-nowrap shadow-lg">
                    <div className="font-semibold">{cmd.collection}</div>
                    <div className="text-slate-300 mt-1">
                      <div>Index: {cmd.fields.join(' + ')}</div>
                      <div className="mt-1">⏱️ {cmd.before_ms}ms → {cmd.after_ms}ms</div>
                      <div className="text-blue-300 font-semibold mt-1">{improvement}% improvement</div>
                    </div>
                    {cmd.reason && (
                      <div className="text-slate-400 mt-1 text-xs italic max-w-xs">
                        {cmd.reason}
                      </div>
                    )}
                    {/* Tooltip arrow */}
                    <div className="absolute right-full top-2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-slate-900"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex gap-6 mt-6 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-xs font-medium text-slate-600">Without Index</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-xs font-medium text-slate-600">With Index</span>
          </div>
        </div>
      </div>
    );
  }

  // Index Coverage Ratio Chart (NEW)
  function renderIndexCoverageChart() {
    if (!analysis || !analysis.summary) return null;

    const total = analysis.summary.high_filter_fields;
    const indexed = analysis.summary.recommended_indexes;
    const coverage = analysis.summary.index_coverage_percent || 0;
    const notIndexed = total - indexed;
    
    // Determine status and color
    let statusColor, statusBg, statusText, statusIcon;
    if (coverage >= 70) {
      statusColor = 'text-green-600';
      statusBg = 'bg-green-50 border-green-200';
      statusText = '✓ Excellent coverage';
      statusIcon = '✅';
    } else if (coverage >= 40) {
      statusColor = 'text-amber-600';
      statusBg = 'bg-amber-50 border-amber-200';
      statusText = '⚠ Needs improvement';
      statusIcon = '⚠️';
    } else {
      statusColor = 'text-red-600';
      statusBg = 'bg-red-50 border-red-200';
      statusText = '✗ Poor coverage';
      statusIcon = '🚨';
    }

    return (
      <div className="w-full">
        <h3 className="text-sm font-semibold text-slate-900 mb-6">
          Index Coverage Ratio
        </h3>
        
        <div className="space-y-6">
          {/* Main Coverage Display */}
          <div className="flex items-center justify-center">
            <div className="relative w-40 h-40">
              {/* Donut Chart Background */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                {/* Background circle */}
                <circle cx="60" cy="60" r="50" fill="#1e293b" />
                
                {/* Coverage arc */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke={coverage >= 70 ? '#22c55e' : coverage >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="10"
                  strokeDasharray={`${(coverage / 100) * 314.159} 314.159`}
                  className="transition-all duration-300"
                />
              </svg>
              
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-4xl font-bold ${statusColor}`}>
                  {Math.round(coverage)}%
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  Coverage
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-3 text-center shadow-sm hover:bg-green-900/40 transition-colors">
              <p className="text-2xl font-bold text-green-400">{indexed}</p>
              <p className="text-xs text-green-300 font-medium mt-1">Indexed</p>
            </div>
            <div className="bg-amber-900/30 border-2 border-amber-500 rounded-lg p-3 text-center shadow-sm hover:bg-amber-900/40 transition-colors">
              <p className="text-2xl font-bold text-amber-400">{notIndexed}</p>
              <p className="text-xs text-amber-300 font-medium mt-1">Not Indexed</p>
            </div>
            <div className="bg-blue-900/30 border-2 border-blue-500 rounded-lg p-3 text-center shadow-sm hover:bg-blue-900/40 transition-colors">
              <p className="text-2xl font-bold text-blue-400">{total}</p>
              <p className="text-xs text-blue-300 font-medium mt-1">High-Frequency</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300">Coverage Progress</span>
              <span className="text-xs font-bold text-slate-200">{indexed} of {total}</span>
            </div>
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  coverage >= 70 ? 'bg-green-500' : coverage >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${coverage}%` }}
              ></div>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`p-4 rounded-lg border-2 ${coverage >= 70 ? 'bg-green-900/20 border-green-500' : coverage >= 40 ? 'bg-amber-900/20 border-amber-500' : 'bg-red-900/20 border-red-500'}`}>
            <p className={`text-sm font-semibold ${statusColor}`}>
              {statusIcon} {statusText}
            </p>
            <p className={`text-xs mt-2 ${coverage >= 70 ? 'text-green-200' : coverage >= 40 ? 'text-amber-200' : 'text-red-200'}`}>
              {coverage >= 70
                ? 'Most high-frequency fields are properly indexed. Maintain this level.'
                : coverage >= 40
                ? 'Some important fields lack indexes. Add indexes to improve query performance.'
                : 'Many high-frequency fields are not indexed. This impacts performance significantly.'}
            </p>
          </div>

          {/* Indexing Guidelines */}
          <div className="bg-blue-900/20 border-2 border-blue-500 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-300 mb-2">📋 Indexing Guidelines</p>
            <ul className="space-y-1 text-xs text-blue-200">
              {coverage >= 70 && (
                <li>✓ Excellent - Your high-frequency fields are well indexed</li>
              )}
              {coverage >= 40 && coverage < 70 && (
                <>
                  <li>• Create single-field indexes for the {notIndexed} remaining fields</li>
                  <li>• Consider compound indexes for common filter combinations</li>
                </>
              )}
              {coverage < 40 && (
                <>
                  <li>🚨 Priority: Index all {Math.ceil(notIndexed / 2)} most frequently queried fields</li>
                  <li>• Start with point-lookup fields (match operations)</li>
                  <li>• Then add range query indexes (comparison operators)</li>
                </>
              )}
              <li>• Compound indexes can improve multiple field coverage</li>
            </ul>
          </div>
        </div>
      </div>
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
                <div className="data-card p-4 bg-red-900/30 border border-red-500">
                  <p className="text-xs text-red-300 uppercase tracking-wide">Write Heavy</p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{analysis.summary.write_heavy_collections}</p>
                </div>
                <div className="data-card p-4 bg-green-900/30 border border-green-500">
                  <p className="text-xs text-green-300 uppercase tracking-wide">Coverage</p>
                  <p className="text-2xl font-bold text-green-400 mt-1">{analysis.summary.index_coverage_percent?.toFixed(0) || 0}%</p>
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
                  <div className={`p-3 rounded border-2 ${
                    analysis.write_amplification.status === 'healthy' ? 'bg-green-900/20 border-green-500' : 
                    analysis.write_amplification.status === 'warning' ? 'bg-amber-900/20 border-amber-500' : 
                    'bg-red-900/20 border-red-500'
                  }`}>
                    <p className={`text-sm font-medium ${
                      analysis.write_amplification.status === 'healthy' ? 'text-green-400' : 
                      analysis.write_amplification.status === 'warning' ? 'text-amber-400' : 
                      'text-red-400'
                    }`}>
                      {analysis.write_amplification.warning}
                    </p>
                    {analysis.write_amplification.most_affected_collections.length > 0 && (
                      <div className="mt-2 text-xs text-slate-300">
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
                          <div key={i} className="bg-slate-800 border border-blue-500/30 p-2 rounded">
                            <p className="text-xs font-mono text-blue-300">{q.field}</p>
                            <p className="text-xs text-slate-400">{q.frequency} queries/day</p>
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
                          <div key={i} className="bg-slate-800 border border-green-500/30 p-2 rounded">
                            <p className="text-xs font-mono text-green-300">{q.field}</p>
                            <p className="text-xs text-slate-400">{q.frequency} queries/day</p>
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
                          <div key={i} className="bg-slate-800 border border-amber-500/30 p-2 rounded">
                            <p className="text-xs font-mono text-amber-300">{q.field}</p>
                            <p className="text-xs text-slate-400">{q.frequency} queries/day</p>
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
                          <div key={i} className="bg-slate-800 border border-purple-500/30 p-2 rounded">
                            <p className="text-xs font-mono text-purple-300">{collection}</p>
                            <p className="text-xs text-slate-400">Collection with $lookup references</p>
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

                  <div className="mt-4 p-3 bg-amber-900/20 border border-amber-500 rounded">
                    <p className="text-sm text-amber-300">
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
                  <div className="bg-red-900/20 border-2 border-red-500 p-4 rounded mb-4">
                    <div className="flex items-start gap-3">
                      <svg className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <p className="font-semibold text-red-300">{analysis.array_growth_projection.field}</p>
                        <p className="text-sm text-red-200 mt-1">
                          {analysis.array_growth_projection.current_updates_per_day} updates/day
                        </p>
                        <p className="text-sm text-red-300 mt-2 font-medium">
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
                      <div key={idx} className="border-2 border-blue-500/50 bg-blue-900/20 p-4 rounded hover:bg-blue-900/30 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-white text-base">{rec.collection}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {rec.ops_per_sec.toFixed(1)} ops/sec • {rec.write_percentage.toFixed(1)}% writes
                            </p>
                          </div>
                          <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                            rec.strategy === 'hashed' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                          }`}>
                            {rec.strategy}
                          </span>
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-sm font-semibold text-blue-300 mb-1">Recommended Shard Key:</p>
                          <p className="font-mono text-sm text-blue-400">{rec.shard_key}</p>
                        </div>
                        
                        <p className="text-sm text-slate-300 mb-3">{rec.reason}</p>
                        
                        <div className="bg-slate-900 border border-blue-500/30 p-3 rounded font-mono text-xs">
                          <code className="text-green-400">{rec.command}</code>
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
                      <div key={idx} className={`p-4 rounded ${getPriorityColor(rec.priority)}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                                rec.priority === 'high' ? 'bg-red-500 text-white' : 
                                rec.priority === 'medium' ? 'bg-amber-500 text-white' : 
                                'bg-green-500 text-white'
                              }`}>
                                {rec.priority}
                              </span>
                              <span className="text-xs text-slate-400 uppercase tracking-wide">{rec.category}</span>
                            </div>
                            <p className="font-semibold text-white text-base">{rec.title}</p>
                            <p className="text-sm text-slate-300 mt-2">{rec.action}</p>
                            {rec.warning && (
                              <p className="text-xs text-amber-400 mt-2 font-medium">⚠️ {rec.warning}</p>
                            )}
                            <p className="text-xs font-medium mt-2 text-blue-400">💪 Impact: {rec.impact}</p>
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

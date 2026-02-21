/**
 * Cost Estimation Dashboard
 * 
 * MongoDB Atlas cost projections with optimization recommendations
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { analyzeCostEstimation } from '../api/costEstimation';

export default function CostEstimator() {
  const { schemaId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [costData, setCostData] = useState(null);
  const [founderMode, setFounderMode] = useState(false);
  const [showTooltip, setShowTooltip] = useState({});

  useEffect(() => {
    const fetchCostEstimation = async () => {
      try {
        setLoading(true);
        const data = await analyzeCostEstimation(schemaId);
        setCostData(data);
      } catch (err) {
        setError(err.message || 'Failed to load cost estimation');
      } finally {
        setLoading(false);
      }
    };

    if (schemaId) {
      fetchCostEstimation();
    }
  }, [schemaId]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-wave';
      case 'warning': return 'text-amber';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusEmoji = (cost) => {
    if (cost < 10000) return '✅';
    if (cost < 20000) return '⚠️';
    return '❌';
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      critical: 'bg-red-500/20 text-red-400 border-red-500/30',
      high: 'bg-amber/20 text-amber border-amber/30',
      medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      low: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return styles[priority] || styles.low;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blush via-mist to-blush flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-wave mx-auto mb-4"></div>
          <p className="text-ink/70 text-lg">💰 Calculating Atlas costs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blush via-mist to-blush flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
          <p className="text-red-300">{error}</p>
          <button
            onClick={() => navigate(`/schema/${schemaId}`)}
            className="mt-6 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 transition-colors"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const { analysis, schema_name } = costData || {};
  const { current_metrics, projections, milestones, recommendations, summary, sensitivity, tier_reference, breakeven } = analysis || {};

  // Debug logging
  console.log('Cost Estimator - Recommendations:', recommendations);
  console.log('Cost Estimator - Recommendations length:', recommendations?.length);

  // Ensure we always show tier reference and sensitivity analysis
  const hasTierReference = tier_reference && tier_reference.length > 0;
  const hasSensitivity = sensitivity && sensitivity.length > 0;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blush via-mist to-blush p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/schema/${schemaId}`)}
            className="flex items-center gap-2 text-ink/60 hover:text-wave transition-colors mb-4"
          >
            ← Back to Schema
          </button>
          
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <span className="text-5xl">💰</span>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-wave to-amber bg-clip-text text-transparent">
                MongoDB Atlas Cost Estimator
              </h1>
            </div>
            <button
              onClick={() => setFounderMode(!founderMode)}
              disabled
              className={`px-4 py-2 rounded-lg border transition-all opacity-50 cursor-not-allowed ${
                founderMode
                  ? 'bg-amber/20 border-amber/50 text-amber font-semibold'
                  : 'bg-ink/10 border-ink/20 text-ink/60'
              }`}
              title="Founder Mode coming soon"
            >
              {founderMode ? '👤 Founder Mode' : '⚙️ Technical Mode'}
            </button>
          </div>
          <p className="text-ink/60 text-lg">{schema_name}</p>
        </div>

        {/* Enterprise Features Overview - Hidden in Founder Mode */}
        {!founderMode && (
          <div className="bg-gradient-to-br from-wave/10 to-amber/10 border-2 border-wave/30 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            Enterprise-Grade Cost Intelligence
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 bg-wave/5 rounded-lg">
              <span className="text-2xl flex-shrink-0">1️⃣</span>
              <div>
                <div className="font-semibold text-wave mb-1">Clear Tier Capacity Thresholds</div>
                <div className="text-sm text-ink/60">See exactly when storage/IOPS limits trigger tier upgrades</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-amber/5 rounded-lg">
              <span className="text-2xl flex-shrink-0">2️⃣</span>
              <div>
                <div className="font-semibold text-amber mb-1">Storage Inclusion Explanation</div>
                <div className="text-sm text-ink/60">Base cost includes storage up to tier limit, overages billed separately</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-wave/5 rounded-lg">
              <span className="text-2xl flex-shrink-0">3️⃣</span>
              <div>
                <div className="font-semibold text-wave mb-1">Amplification → Cost Connection</div>
                <div className="text-sm text-ink/60">See how reducing write amplification 7x→5x saves ₹X annually</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-amber/5 rounded-lg">
              <span className="text-2xl flex-shrink-0">4️⃣</span>
              <div>
                <div className="font-semibold text-amber mb-1">Growth Sensitivity Simulation</div>
                <div className="text-sm text-ink/60">Compare 3 scenarios: conservative, current, aggressive growth</div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-wave/5 to-amber/5 backdrop-blur-sm border border-wave/20 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-wave/10 rounded-lg">
                <span className="text-2xl">📈</span>
              </div>
              <h3 className="text-lg font-semibold text-ink">Month 1</h3>
            </div>
            <div className="text-3xl font-bold text-wave mb-1">
              ₹{summary?.month_1_cost?.toLocaleString('en-IN') || '0'}
            </div>
            <p className="text-sm text-ink/60">Initial monthly cost</p>
          </div>

          <div className="bg-gradient-to-br from-amber/5 to-wave/5 backdrop-blur-sm border border-amber/20 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber/10 rounded-lg">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-lg font-semibold text-ink">Month 6</h3>
            </div>
            <div className="text-3xl font-bold text-amber mb-1">
              ₹{summary?.month_6_cost?.toLocaleString('en-IN') || '0'}
            </div>
            <p className="text-sm text-ink/60">Mid-year projection</p>
          </div>

          <div className="bg-gradient-to-br from-red-500/5 to-amber/5 backdrop-blur-sm border border-red-500/20 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <span className="text-2xl">📉</span>
              </div>
              <h3 className="text-lg font-semibold text-ink">Month 12</h3>
            </div>
            <div className="text-3xl font-bold text-red-400 mb-1">
              ₹{summary?.month_12_cost?.toLocaleString('en-IN') || '0'}
            </div>
            <p className="text-sm text-ink/60">Year-end projection</p>
          </div>
        </div>

        {/* Current State Snapshot - Section 1 */}
        <div className="bg-gradient-to-br from-wave/5 to-amber/5 backdrop-blur-sm border border-wave/20 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-ink mb-6 flex items-center gap-3">
            <span className="text-3xl">📸</span>
            Current State Snapshot
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-2">💾</div>
              <div className="text-2xl font-bold text-ink mb-1">
                {current_metrics?.total_storage_gb?.toFixed(2)} GB
              </div>
              <p className="text-sm text-ink/60">Storage</p>
              <p className="text-xs text-ink/40 mt-1">
                Total data size
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-2">📑</div>
              <div className={`text-2xl font-bold mb-1 ${
                current_metrics?.index_ratio_pct > 40 ? 'text-red-400' : 
                current_metrics?.index_ratio_pct > 30 ? 'text-amber' : 
                'text-wave'
              }`}>
                {current_metrics?.index_ratio_pct?.toFixed(1)}%
              </div>
              <p className="text-sm text-ink/60">Index Ratio</p>
              <p className="text-xs text-ink/40 mt-1">
                {current_metrics?.index_ratio_pct > 40 ? '🔴 High' : 
                 current_metrics?.index_ratio_pct > 30 ? '🟡 Monitor' : 
                 '🟢 Healthy'}
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-2">✍️</div>
              <div className="text-2xl font-bold text-ink mb-1">
                {current_metrics?.write_iops?.toFixed(0)}
              </div>
              <p className="text-sm text-ink/60">Effective Write IOPS</p>
              <p className="text-xs text-ink/40 mt-1">
                {(current_metrics?.write_iops / 7)?.toFixed(0)} raw × 7x
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-2">👁️</div>
              <div className="text-2xl font-bold text-ink mb-1">
                {current_metrics?.read_ru?.toFixed(0)}
              </div>
              <p className="text-sm text-ink/60">Read ops/sec</p>
              <p className="text-xs text-ink/40 mt-1">
                Request units
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-2">🔄</div>
              <div className="text-2xl font-bold text-amber mb-1">
                7x
              </div>
              <p className="text-sm text-ink/60">Amplification</p>
              <p className="text-xs text-ink/40 mt-1">
                Write factor
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-2">🏢</div>
              <div className="text-2xl font-bold text-wave mb-1">
                {current_metrics?.current_tier || 'M2'}
              </div>
              <p className="text-sm text-ink/60">Current Tier</p>
              <p className="text-xs text-ink/40 mt-1">
                {current_metrics?.current_tier_name || 'Shared'}
              </p>
            </div>
          </div>
        </div>

        {/* Tier Capacity Comparison - Section 2 */}
        {breakeven && (
          <div className="bg-gradient-to-br from-amber/5 to-wave/5 backdrop-blur-sm border border-amber/20 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-ink mb-4 flex items-center gap-3">
              <span className="text-3xl">⚖️</span>
              Tier Capacity vs Current Usage
            </h2>
            
            {breakeven.month !== null ? (
              <>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-semibold text-red-400 mb-2">
                    ⚠️ Break-Even Alert: Month {breakeven.month}
                  </h3>
                  <p className="text-ink/80 mb-2">
                    Current {current_metrics?.current_tier_name || 'tier'} will become insufficient due to <strong>{breakeven.constraint}</strong> constraint.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <span className="text-ink/60">Storage at Month {breakeven.month}: </span>
                      <span className="font-bold text-amber">{breakeven.storage_gb?.toFixed(2)} GB</span>
                      <span className="text-ink/40"> / {breakeven.storage_limit_gb} GB limit</span>
                    </div>
                    <div>
                      <span className="text-ink/60">IOPS at Month {breakeven.month}: </span>
                      <span className="font-bold text-amber">{breakeven.write_iops?.toFixed(0)}</span>
                      <span className="text-ink/40"> / {breakeven.iops_limit} limit</span>
                    </div>
                  </div>
                  <p className="text-sm text-ink/60 mt-3">
                    → Upgrade to <strong className="text-wave">{breakeven.upgrade_to_tier}</strong> required
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-wave/10 border border-wave/30 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-semibold text-wave mb-2">
                  ✅ {breakeven.message}
                </h3>
                <p className="text-ink/60 text-sm">
                  Your current tier has sufficient capacity for the projected 12-month growth.
                </p>
              </div>
            )}

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wave/20">
                    <th className="text-left py-3 px-4 font-semibold text-ink">Metric</th>
                    <th className="text-right py-3 px-4 font-semibold text-wave">Current</th>
                    <th className="text-right py-3 px-4 font-semibold text-amber">Tier Limit</th>
                    <th className="text-right py-3 px-4 font-semibold text-ink">% Used</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-wave/10">
                    <td className="py-3 px-4 text-ink">Storage</td>
                    <td className="py-3 px-4 text-right font-mono text-wave">{current_metrics?.total_storage_gb?.toFixed(2)} GB</td>
                    <td className="py-3 px-4 text-right font-mono text-amber">
                      {analysis?.projections?.[0]?.included_storage_gb || 10} GB
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-bold ${
                        ((current_metrics?.total_storage_gb / (analysis?.projections?.[0]?.included_storage_gb || 10)) * 100) > 80 
                          ? 'text-red-400' 
                          : ((current_metrics?.total_storage_gb / (analysis?.projections?.[0]?.included_storage_gb || 10)) * 100) > 60 
                            ? 'text-amber'
                            : 'text-wave'
                      }`}>
                        {((current_metrics?.total_storage_gb / (analysis?.projections?.[0]?.included_storage_gb || 10)) * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-wave/10">
                    <td className="py-3 px-4 text-ink">Effective Write IOPS</td>
                    <td className="py-3 px-4 text-right font-mono text-wave">{current_metrics?.write_iops?.toFixed(0)}</td>
                    <td className="py-3 px-4 text-right font-mono text-amber">
                      {analysis?.projections?.[0]?.max_iops || 2000}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-bold ${
                        ((current_metrics?.write_iops / (analysis?.projections?.[0]?.max_iops || 2000)) * 100) > 80 
                          ? 'text-red-400' 
                          : ((current_metrics?.write_iops / (analysis?.projections?.[0]?.max_iops || 2000)) * 100) > 60 
                            ? 'text-amber'
                            : 'text-wave'
                      }`}>
                        {((current_metrics?.write_iops / (analysis?.projections?.[0]?.max_iops || 2000)) * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-wave/5 rounded-lg border border-wave/20">
              <p className="text-sm text-ink/70">
                <strong className="text-wave">💡 Key Insight:</strong> Upgrades trigger when <strong>either</strong> Storage OR IOPS exceeds tier limits. Universal scaling principle.
              </p>
            </div>
          </div>
        )}

        {/* Monthly Cost Projections - Hidden in Founder Mode */}
        {!founderMode && (
        <div className="bg-gradient-to-br from-wave/5 to-amber/5 backdrop-blur-sm border border-wave/20 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-ink mb-6 flex items-center gap-3">
            <span className="text-3xl">📈</span>
            12-Month Cost Projection
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-wave/20">
                  <th className="px-3 py-3 text-left font-semibold text-ink/70">Month</th>
                  <th className="px-3 py-3 text-left font-semibold text-ink/70">Tier</th>
                  <th className="px-3 py-3 text-left font-semibold text-ink/70">Constraint</th>
                  <th className="px-3 py-3 text-right font-semibold text-ink/70">Storage</th>
                  <th className="px-3 py-3 text-right font-semibold text-ink/70">IOPS</th>
                  <th className="px-3 py-3 text-right font-semibold text-ink/70">Base</th>
                  <th className="px-3 py-3 text-right font-semibold text-ink/70">Storage</th>
                  <th className="px-3 py-3 text-right font-semibold text-ink/70">IOPS</th>
                  <th className="px-3 py-3 text-right font-semibold text-ink/70">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wave/10">
                {projections?.slice(1).map((projection) => {
                  // 3-tier constraint system: Normal (<75%), Approaching (75-90%), Exceeds (>100%)
                  const getConstraintStatus = (utilization) => {
                    if (utilization > 100) return 'exceeds';
                    if (utilization >= 75) return 'approaching';
                    return 'normal';
                  };
                  
                  const storageStatus = getConstraintStatus(projection.storage_utilization_pct);
                  const iopsStatus = getConstraintStatus(projection.iops_utilization_pct);
                  
                  // Determine worst constraint
                  const hasExceeds = storageStatus === 'exceeds' || iopsStatus === 'exceeds';
                  const hasApproaching = storageStatus === 'approaching' || iopsStatus === 'approaching';
                  
                  const constraintIcon = 
                    hasExceeds ? '🔴' :
                    hasApproaching ? '🟡' : '🟢';
                  const constraintText = 
                    hasExceeds ? (
                      storageStatus === 'exceeds' && iopsStatus === 'exceeds' ? 'Exceeds Both' :
                      storageStatus === 'exceeds' ? 'Exceeds Storage' : 'Exceeds IOPS'
                    ) :
                    hasApproaching ? (
                      storageStatus === 'approaching' && iopsStatus === 'approaching' ? 'Approaching Both' :
                      storageStatus === 'approaching' ? 'Approaching Storage' : 'Approaching IOPS'
                    ) : 'Normal';
                  const constraintColor = 
                    hasExceeds ? 'text-red-400' :
                    hasApproaching ? 'text-amber' : 'text-wave/50';

                  return (
                    <tr key={projection.month} className="hover:bg-wave/5 transition-colors">
                      <td className="px-3 py-3 font-medium text-ink">
                        M{projection.month}
                        {projection.storage_utilization_pct > 80 && <span className="ml-1 text-amber">⚠️</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col">
                          <span className="px-2 py-1 bg-wave/10 text-wave rounded text-xs font-semibold inline-block w-fit">
                            {projection.tier}
                          </span>
                          <span className="text-xs text-ink/40 mt-1">{projection.tier_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <span>{constraintIcon}</span>
                          <span className={`text-xs font-medium ${constraintColor}`}>
                            {constraintText}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-ink/70">
                        <div className="flex flex-col items-end">
                          <span>{projection.storage_gb?.toFixed(2)} GB</span>
                          {projection.storage_overage_gb > 0 ? (
                            <span className="text-xs text-amber">+{projection.storage_overage_gb?.toFixed(2)} overage</span>
                          ) : (
                            <span className="text-xs text-wave">✓ Included</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-ink/70">
                        <div className="flex flex-col items-end">
                          <span>{projection.write_iops?.toFixed(0)}</span>
                          <span className={`text-xs ${projection.iops_status === 'included' ? 'text-wave' : 'text-amber'}`}>
                            {projection.iops_status === 'included' ? '✓ Included' : 'Overage'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-ink/70">
                        ₹{projection.base_cost?.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {projection.storage_cost > 0 ? (
                          <span className="text-amber">₹{projection.storage_cost?.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-wave/50">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {projection.iops_cost > 0 ? (
                          <span className="text-amber">₹{projection.iops_cost?.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-wave/50">—</span>
                        )}
                      </td>
                      <td className={`px-3 py-3 text-right font-bold ${getStatusColor(projection.status)}`}>
                        {getStatusEmoji(projection.total_cost_inr)} ₹{projection.total_cost_inr?.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-wave/5 rounded-lg border border-wave/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink/70">Total Year 1 Cost</span>
              <span className="text-2xl font-bold text-wave">
                ₹{summary?.total_year_cost?.toLocaleString('en-IN') || '0'}
              </span>
            </div>
          </div>
        </div>
        )}

        {/* Tier Capacity Reference - Hidden in Founder Mode */}
        {hasTierReference && !founderMode ? (
          <div className="bg-gradient-to-br from-wave/5 to-amber/5 backdrop-blur-sm border border-wave/20 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-ink flex items-center gap-3">
                <span className="text-3xl">📊</span>
                Atlas Tier Capacity Reference
              </h2>
              <span className="px-3 py-1 bg-wave/10 text-wave text-xs font-semibold rounded">
                1️⃣ TIER THRESHOLDS
              </span>
            </div>
            <p className="text-sm text-ink/60 mb-6">
              <strong>💡 Key Insight:</strong> Tier upgrades occur when storage OR IOPS exceed capacity limits
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wave/20">
                    <th className="px-4 py-3 text-left font-semibold text-ink/70">Tier</th>
                    <th className="px-4 py-3 text-left font-semibold text-ink/70">Name</th>
                    <th className="px-4 py-3 text-right font-semibold text-ink/70">
                      <div className="flex items-center justify-end gap-2">
                        <span>Included Storage</span>
                        <span className="px-2 py-1 bg-amber/10 text-amber text-xs rounded">2️⃣ INCLUDED</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-ink/70">Max IOPS</th>
                    <th className="px-4 py-3 text-right font-semibold text-ink/70">Base Cost/Month</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wave/10">
                  {tier_reference.map((tier) => (
                    <tr key={tier.tier} className="hover:bg-wave/5 transition-colors">
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-wave/10 text-wave rounded text-xs font-semibold">
                          {tier.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink/70">{tier.name}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-medium text-wave">{tier.included_storage_gb} GB</span>
                          <span className="text-xs text-ink/40">Storage costs ₹0 up to this limit</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-ink/70">{tier.max_iops.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-medium text-wave">
                        ₹{tier.base_cost_inr.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 p-4 bg-amber/5 rounded-lg border border-amber/20">
              <p className="text-sm text-ink/70">
                <strong className="text-amber">💡 How it works:</strong> Base tier cost includes storage up to the limit shown above. 
                Storage beyond this limit is billed at overage rates (₹30-75/GB depending on tier). 
                M2/M5 have fixed IOPS (included). M10+ charge for IOPS overages.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-wave/5 border border-wave/20 rounded-lg p-6 mb-8">
            <p className="text-ink/60 text-center">Loading tier capacity data...</p>
          </div>
        )}

        {/* Sensitivity Analysis */}
        {hasSensitivity ? (
          <div className="bg-gradient-to-br from-amber/5 to-wave/5 backdrop-blur-sm border border-amber/20 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-ink flex items-center gap-3">
                <span className="text-3xl">🔄</span>
                Cost Sensitivity Analysis
              </h2>
              <span className="px-3 py-1 bg-amber/10 text-amber text-xs font-semibold rounded">
                4️⃣ GROWTH SCENARIOS
              </span>
            </div>
            <p className="text-sm text-ink/60 mb-6">
              <strong>💡 Key Insight:</strong> See how different growth rates impact Month 12 costs - make data-driven scaling decisions
            </p>

            <div className="space-y-4">
              {sensitivity.map((scenario, idx) => (
                <div
                  key={idx}
                  className={`p-5 rounded-lg border-l-4 ${
                    scenario.name === 'Current Trajectory' 
                      ? 'bg-wave/5 border-wave' 
                      : scenario.name === 'Conservative Growth'
                      ? 'bg-green-500/5 border-green-500'
                      : scenario.name === 'Peak Load'
                      ? 'bg-red-500/5 border-red-500'
                      : 'bg-red-500/5 border-red-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-ink text-lg">{scenario.name}</h3>
                      {scenario.is_peak_load && (
                        <span className="px-2 py-1 bg-red-500/20 text-red-500 text-xs rounded font-semibold">
                          Traffic Spike
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-ink/60 mb-4">{scenario.description}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <div className="text-xs text-ink/60 mb-1">Growth Rate</div>
                      <div className="font-semibold text-ink">{scenario.growth_rate_pct}% / month</div>
                    </div>
                    {scenario.is_peak_load && scenario.month_12_iops_peak && (
                      <div>
                        <div className="text-xs text-ink/60 mb-1">Peak IOPS (M12)</div>
                        <div className="font-semibold text-red-500">{scenario.month_12_iops_peak} IOPS</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-ink/60 mb-1">Month 12 Tier</div>
                      <div className="flex flex-col">
                        <div className="font-semibold text-wave">{scenario.month_12_tier}</div>
                        <div className="text-xs text-ink/40">{scenario.month_12_tier_name}</div>
                      </div>
                    </div>
                    {!scenario.is_peak_load && (
                      <div>
                        <div className="text-xs text-ink/60 mb-1">Month 12 Storage</div>
                        <div className="font-semibold text-ink">{scenario.month_12_storage_gb} GB</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-ink/60 mb-1">Month 12 Cost</div>
                      <div className="font-bold text-wave">₹{scenario.month_12_cost.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  {scenario.vs_baseline_savings_inr && scenario.vs_baseline_savings_inr !== 0 && (
                    <div className="mt-3 pt-3 border-t border-wave/20">
                      <span className="text-sm">
                        {scenario.vs_baseline_savings_inr > 0 ? '💰 Saves' : scenario.is_peak_load ? '⚠️ Requires' : '⚠️ Costs'}{' '}
                        <span className="font-semibold">
                          ₹{Math.abs(scenario.vs_baseline_savings_inr).toLocaleString('en-IN')}/month
                        </span>
                        {' '}
                        {scenario.is_peak_load 
                          ? 'higher tier during peak' 
                          : 'vs current trajectory'
                        }
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-wave/5 border border-wave/20 rounded-lg p-6 mb-8">
            <p className="text-ink/60 text-center">Loading sensitivity analysis...</p>
          </div>
        )}

        {/* Cost Milestones */}
        {milestones && milestones.length > 0 && (
          <div className="bg-gradient-to-br from-amber/5 to-wave/5 backdrop-blur-sm border border-amber/20 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-ink mb-6 flex items-center gap-3">
              <span className="text-3xl">🎯</span>
              Cost Milestones
            </h2>

            <div className="space-y-4">
              {milestones.map((milestone, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-4 bg-gradient-to-r from-amber/5 to-transparent rounded-lg border-l-4 border-amber"
                >
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className="text-xl font-bold text-amber">M{milestone.month}</div>
                    <div className="text-xs text-ink/60">{milestone.type === 'tier_upgrade' ? '⬆️' : '⚠️'}</div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-ink mb-1">{milestone.description}</div>
                    <div className="text-sm text-ink/60">
                      Cost Impact: <span className="font-medium text-amber">
                        ₹{milestone.cost_impact?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optimization Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="bg-gradient-to-br from-wave/5 to-amber/5 backdrop-blur-sm border border-wave/20 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-ink flex items-center gap-3">
                <span className="text-3xl">💡</span>
                Cost Optimization Recommendations
              </h2>
              <span className="px-3 py-1 bg-wave/10 text-wave text-xs font-semibold rounded">
                3️⃣ AMPLIFICATION → COST
              </span>
            </div>
            
            <div className="mb-6 p-4 bg-amber/5 border border-amber/20 rounded-lg">
              <p className="text-sm text-ink/70">
                <strong className="text-amber">💡 Performance → Money:</strong> Each optimization below shows the exact cost impact. 
                Reducing write amplification, optimizing indexes, and implementing data archival directly delay tier upgrades and reduce monthly costs.
              </p>
            </div>

            <div className="space-y-4">
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-5 bg-gradient-to-r from-wave/5 to-transparent rounded-lg border-l-4 border-wave hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">✅</span>
                      <h3 className="font-bold text-ink text-lg">{rec.title}</h3>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityBadge(rec.priority)}`}>
                      {rec.priority.toUpperCase()}
                    </span>
                  </div>
                  
                  <p className="text-ink/70 mb-4 ml-8">{rec.description}</p>
                  
                  {/* Amplification Calculation Chain - Make it mechanically clear */}
                  {rec.calculation_chain && (
                    <div className="ml-8 mb-4 p-4 bg-gradient-to-r from-wave/10 to-amber/10 border border-wave/30 rounded-lg">
                      <h4 className="text-sm font-semibold text-wave mb-3 flex items-center gap-2">
                        <span>⚙️</span>
                        Mechanical Calculation Chain: Performance → Effective IOPS → Tier → Cost
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                        <div className="flex items-center">
                          <div className="flex-1">
                            <div className="text-ink/60 mb-1">1. Current Writes</div>
                            <div className="font-bold text-ink">{rec.calculation_chain.current_writes_per_sec}/sec</div>
                          </div>
                          <span className="text-2xl text-wave mx-2">×</span>
                        </div>
                        <div className="flex items-center">
                          <div className="flex-1">
                            <div className="text-ink/60 mb-1">2. Amplification</div>
                            <div className="font-bold text-red-400">{rec.calculation_chain.current_amplification}x</div>
                          </div>
                          <span className="text-2xl text-wave mx-2">=</span>
                        </div>
                        <div className="flex items-center">
                          <div className="flex-1">
                            <div className="text-ink/60 mb-1">3. Effective IOPS</div>
                            <div className="font-bold text-amber">{rec.calculation_chain.current_effective_iops}</div>
                          </div>
                          <span className="text-2xl text-wave mx-2">→</span>
                        </div>
                        <div className="flex items-center">
                          <div className="flex-1">
                            <div className="text-ink/60 mb-1">4. Tier Needed</div>
                            <div className="font-bold text-wave">Upgrade</div>
                          </div>
                          <span className="text-2xl text-wave mx-2">→</span>
                        </div>
                        <div>
                          <div className="text-ink/60 mb-1">5. Cost Impact</div>
                          <div className="font-bold text-red-400">Higher</div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-wave/20">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                          <div className="flex items-center">
                            <div className="flex-1">
                              <div className="text-ink/60 mb-1">1. Same Writes</div>
                              <div className="font-bold text-ink">{rec.calculation_chain.current_writes_per_sec}/sec</div>
                            </div>
                            <span className="text-2xl text-green-500 mx-2">×</span>
                          </div>
                          <div className="flex items-center">
                            <div className="flex-1">
                              <div className="text-ink/60 mb-1">2. Reduced to</div>
                              <div className="font-bold text-green-500">{rec.calculation_chain.target_amplification}x</div>
                            </div>
                            <span className="text-2xl text-green-500 mx-2">=</span>
                          </div>
                          <div className="flex items-center">
                            <div className="flex-1">
                              <div className="text-ink/60 mb-1">3. Effective IOPS</div>
                              <div className="font-bold text-green-500">{rec.calculation_chain.target_effective_iops}</div>
                            </div>
                            <span className="text-2xl text-green-500 mx-2">→</span>
                          </div>
                          <div className="flex items-center">
                            <div className="flex-1">
                              <div className="text-ink/60 mb-1">4. Tier Delayed</div>
                              <div className="font-bold text-green-500">Stay Lower</div>
                            </div>
                            <span className="text-2xl text-green-500 mx-2">→</span>
                          </div>
                          <div>
                            <div className="text-ink/60 mb-1">5. Cost Saved</div>
                            <div className="font-bold text-green-500">₹{rec.monthly_savings_inr?.toLocaleString('en-IN')}/mo</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 text-xs text-ink/60">
                        <strong className="text-wave">🔄 IOPS Reduction:</strong> {rec.calculation_chain.iops_reduction} ({rec.calculation_chain.iops_reduction_pct}%) fewer effective operations keeps you under tier IOPS threshold for {rec.delay_upgrade_months || 'multiple'} months longer
                      </div>
                      
                      {rec.delay_upgrade_months > 0 && rec.annual_savings_inr && (
                        <div className="mt-2 p-2 bg-green-500/10 rounded text-xs text-ink/70">
                          <strong className="text-green-600">💰 Impact:</strong> Prevents tier upgrade → saves <strong>₹{rec.annual_savings_inr.toLocaleString('en-IN')} annually</strong>. 
                          Delaying higher tier costs by {rec.delay_upgrade_months} months provides sustained cost reduction.
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 ml-8 mb-4">
                    {rec.current_ratio_pct !== undefined && (
                      <div className="bg-blush rounded-lg p-3 border border-wave/10">
                        <div className="text-xs text-ink/60 mb-1">Index Ratio</div>
                        <div className="font-semibold text-red-400">{rec.current_ratio_pct}% → {rec.target_ratio_pct}%</div>
                      </div>
                    )}
                    {rec.current_growth_pct !== undefined && (
                      <div className="bg-blush rounded-lg p-3 border border-wave/10">
                        <div className="text-xs text-ink/60 mb-1">Growth Rate</div>
                        <div className="font-semibold text-amber">{rec.current_growth_pct}% → {rec.target_growth_pct}%</div>
                      </div>
                    )}
                    {rec.current_iops !== undefined && (
                      <div className="bg-blush rounded-lg p-3 border border-wave/10">
                        <div className="text-xs text-ink/60 mb-1">Write IOPS</div>
                        <div className="font-semibold text-wave">{rec.current_iops} → {rec.target_iops}</div>
                      </div>
                    )}
                    {rec.amplification_reduction && (
                      <div className="bg-blush rounded-lg p-3 border border-wave/10">
                        <div className="text-xs text-ink/60 mb-1">Write Amplification</div>
                        <div className="font-semibold text-wave">{rec.amplification_reduction}</div>
                      </div>
                    )}
                    {rec.current_tier && (
                      <div className="bg-blush rounded-lg p-3 border border-wave/10">
                        <div className="text-xs text-ink/60 mb-1">Current Tier (M12)</div>
                        <div className="font-semibold text-wave">{rec.current_tier}</div>
                      </div>
                    )}
                    {rec.delay_upgrade_months > 0 && (
                      <div className="bg-blush rounded-lg p-3 border border-wave/10">
                        <div className="text-xs text-ink/60 mb-1">Delays Upgrade By</div>
                        <div className="font-semibold text-green-500">{rec.delay_upgrade_months} months</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Savings Summary */}
                  <div className="ml-8 pt-4 border-t border-wave/20">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2 relative">
                        <span className="text-lg">💰</span>
                        <div 
                          className="cursor-help"
                          onMouseEnter={() => setShowTooltip({...showTooltip, [`rec-${rec.title}`]: true})}
                          onMouseLeave={() => setShowTooltip({...showTooltip, [`rec-${rec.title}`]: false})}
                        >
                          <div className="text-xs text-ink/60">
                            % of Annual Cost
                            <span className="ml-1 inline-block text-wave">ⓘ</span>
                          </div>
                          <div className="font-bold text-wave text-lg">{rec.potential_savings_percent}%</div>
                          {showTooltip[`rec-${rec.title}`] && (
                            <div className="absolute top-full mt-2 bg-ink/90 text-wave text-xs rounded p-2 whitespace-nowrap z-10">
                              {rec.potential_savings_percent}% of ₹{(summary?.month_12_cost * 12)?.toLocaleString('en-IN')} annual projection
                            </div>
                          )}
                        </div>
                      </div>
                      {(rec.potential_savings_inr || rec.monthly_savings_inr) && (rec.potential_savings_inr > 0 || rec.monthly_savings_inr > 0) && (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">�</span>
                          <div>
                            <div className="text-xs text-ink/60">Monthly Impact</div>
                            <div className="font-bold text-wave">
                              ₹{(rec.monthly_savings_inr || rec.potential_savings_inr)?.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      )}
                      {rec.annual_savings_inr && rec.annual_savings_inr > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🎯</span>
                          <div>
                            <div className="text-xs text-ink/60">Annual Savings</div>
                            <div className="font-bold text-xl text-green-600">₹{rec.annual_savings_inr.toLocaleString('en-IN')}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 px-3 py-1 bg-wave/10 rounded text-xs font-medium text-wave inline-block">
                      {rec.category.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debug: Show if recommendations exist but are empty */}
        {recommendations !== undefined && recommendations.length === 0 && (
          <div className="bg-wave/5 border border-wave/20 rounded-lg p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-lg font-semibold text-ink mb-2">No Immediate Optimizations Needed</h3>
            <p className="text-sm text-ink/60">
              Your current configuration is well-optimized. Continue monitoring as your workload grows.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

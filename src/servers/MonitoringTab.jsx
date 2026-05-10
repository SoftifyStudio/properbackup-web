import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchMetrics } from '../api/bufferClient.js';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

const RANGE_OPTIONS = [
  { label: '1h',  hours: 1 },
  { label: '6h',  hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d',  hours: 168 },
  { label: '30d', hours: 720 },
];

const CORE_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#e11d48', '#84cc16',
  '#0ea5e9', '#d946ef', '#22c55e', '#eab308', '#a855f7', '#f43f5e',
  '#2dd4bf', '#fb923c', '#818cf8', '#fb7185', '#a3e635', '#38bdf8',
  '#c084fc', '#4ade80', '#fbbf24', '#f472b6', '#34d399', '#facc15',
  '#7c3aed', '#059669',
];

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CoreTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg px-3 py-2 text-xs max-h-64 overflow-y-auto">
      <div className="font-medium text-text2 mb-1">{formatDate(label)}</div>
      {payload.filter(e => e.value != null).map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-text3">{entry.name}:</span>
          <span className="font-semibold text-text1">
            {entry.name.includes('RAM') ? `${entry.value.toFixed(0)} MB` : `${entry.value.toFixed(1)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MonitoringTab({ serverId }) {
  const { token } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rangeIdx, setRangeIdx] = useState(2);
  const [visibleCores, setVisibleCores] = useState(new Set());
  const [showAllCores, setShowAllCores] = useState(true);
  const [coreFilter, setCoreFilter] = useState('');

  const range = RANGE_OPTIONS[rangeIdx];

  const coreCount = useMemo(() => {
    if (data.length === 0) return 0;
    return data[data.length - 1].coreCount || 0;
  }, [data]);

  const loadMetrics = useCallback(async () => {
    if (!serverId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const from = new Date(now.getTime() - range.hours * 3600000);
      const res = await fetchMetrics(serverId, token, from.toISOString(), now.toISOString(), 2000);
      const points = (res.metrics || []).map((m) => {
        const point = {
          time: new Date(m.recordedAt).getTime(),
          cpu: m.cpuPercent,
          agentCpu: m.agentCpuPercent || 0,
          ramUsed: m.ramUsedMb,
          ramTotal: m.ramTotalMb,
          ramPercent: m.ramTotalMb > 0 ? (m.ramUsedMb / m.ramTotalMb) * 100 : 0,
          coreCount: m.coreCount || 1,
        };
        if (m.perCoreCpu && Array.isArray(m.perCoreCpu)) {
          m.perCoreCpu.forEach((val, idx) => { point[`core${idx}`] = val; });
        }
        return point;
      });
      setData(points);
      if (points.length > 0) {
        const cores = points[points.length - 1].coreCount || 1;
        setVisibleCores(new Set(Array.from({ length: cores }, (_, i) => i)));
        setShowAllCores(true);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [serverId, token, range.hours]);

  useEffect(() => {
    loadMetrics();
    const id = setInterval(loadMetrics, 15000);
    return () => clearInterval(id);
  }, [loadMetrics]);

  const toggleCore = (idx) => {
    setVisibleCores(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
    setShowAllCores(false);
  };

  const toggleAllCores = () => {
    if (showAllCores) {
      setVisibleCores(new Set());
      setShowAllCores(false);
    } else {
      setVisibleCores(new Set(Array.from({ length: coreCount }, (_, i) => i)));
      setShowAllCores(true);
    }
  };

  const latestCpu = data.length > 0 ? data[data.length - 1].cpu : null;
  const latestAgentCpu = data.length > 0 ? data[data.length - 1].agentCpu : null;
  const latestRam = data.length > 0 ? data[data.length - 1].ramUsed : null;
  const latestRamTotal = data.length > 0 ? data[data.length - 1].ramTotal : null;
  const avgCpu = data.length > 0 ? data.reduce((s, d) => s + d.cpu, 0) / data.length : 0;
  const avgAgentCpu = data.length > 0 ? data.reduce((s, d) => s + d.agentCpu, 0) / data.length : 0;
  const maxCpu = data.length > 0 ? Math.max(...data.map((d) => d.cpu)) : 0;
  const maxAgentCpu = data.length > 0 ? Math.max(...data.map((d) => d.agentCpu)) : 0;

  const tickFmt = range.hours <= 24 ? formatTime : formatDate;

  const latestPerCore = useMemo(() => {
    if (data.length === 0 || coreCount === 0) return [];
    const last = data[data.length - 1];
    return Array.from({ length: coreCount }, (_, i) => ({ idx: i, value: last[`core${i}`] ?? null }));
  }, [data, coreCount]);

  const filteredPerCore = useMemo(() => {
    if (!coreFilter.trim()) return latestPerCore;
    const terms = coreFilter.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
    return latestPerCore.filter(({ idx, value }) => {
      const pct = value ?? 0;
      return terms.some(term => {
        if (term.startsWith('>')) { const th = parseFloat(term.slice(1)); return !isNaN(th) && pct > th; }
        if (term.startsWith('<')) { const th = parseFloat(term.slice(1)); return !isNaN(th) && pct < th; }
        const num = parseInt(term, 10);
        if (!isNaN(num)) return idx === num;
        return `core ${idx}`.includes(term) || `c${idx}`.includes(term);
      });
    });
  }, [latestPerCore, coreFilter]);

  return (
    <div className="space-y-6 min-h-[calc(100vh-180px)]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text1">Server Monitoring</h2>
          <p className="text-xs text-text4 mt-0.5">
            {coreCount > 0 ? `${coreCount} cores \u00b7 ` : ''}Real-time agent and server resource usage
          </p>
        </div>
        <div className="flex items-center gap-1 bg-surface rounded-lg p-0.5 border border-border">
          {RANGE_OPTIONS.map((opt, idx) => (
            <button
              key={opt.label}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                rangeIdx === idx
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-text3 hover:text-text1 hover:bg-panel'
              }`}
              onClick={() => setRangeIdx(idx)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>


      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading && data.length === 0 && (
        <div className="flex items-center justify-center py-16 text-text4 text-sm">Loading metrics...</div>
      )}
      {!loading && data.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-text4">
          <svg className="w-12 h-12 mb-3 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 16l4-6 4 4 5-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm font-medium text-text3">No metrics data yet</p>
          <p className="text-xs text-text4 mt-1">Agent reports CPU/RAM every 10s</p>
        </div>
      )}

      {/* === SIDE-BY-SIDE: Agent vs Server === */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* -- AGENT (left, green) -- */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wider">ProperBackup Agent</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SummaryCard label="CPU Now" value={latestAgentCpu !== null ? `${latestAgentCpu.toFixed(1)}%` : '--'} color="text-emerald-600" accent="emerald" />
              <SummaryCard label="Average" value={avgAgentCpu > 0 ? `${avgAgentCpu.toFixed(1)}%` : '--'} color="text-emerald-500" accent="emerald" />
              <SummaryCard label="Peak" value={maxAgentCpu > 0 ? `${maxAgentCpu.toFixed(1)}%` : '--'} color="text-emerald-500" accent="emerald" />
            </div>
            <div className="bg-panel border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-emerald-700">Agent CPU Usage</span>
                <span className="text-[10px] text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">our process only</span>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="agentCpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" tickFormatter={tickFmt} stroke="#9ca3af" fontSize={10} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#9ca3af" fontSize={10} width={40} />
                    <Tooltip content={<CoreTooltip />} />
                    <Area type="monotone" dataKey="agentCpu" name="Agent CPU %" stroke="#10b981" fill="url(#agentCpuGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* -- SERVER (right, blue) -- */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider">Server (Total)</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SummaryCard label="CPU Now" value={latestCpu !== null ? `${latestCpu.toFixed(1)}%` : '--'} color="text-blue-600" accent="blue" />
              <SummaryCard label="Average" value={avgCpu > 0 ? `${avgCpu.toFixed(1)}%` : '--'} color="text-blue-500" accent="blue" />
              <SummaryCard label="Peak" value={maxCpu > 0 ? `${maxCpu.toFixed(1)}%` : '--'} color="text-blue-500" accent="blue" />
            </div>
            <div className="bg-panel border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-700">Server CPU Usage</span>
                <span className="text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">all processes</span>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="serverCpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" tickFormatter={tickFmt} stroke="#9ca3af" fontSize={10} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#9ca3af" fontSize={10} width={40} />
                    <Tooltip content={<CoreTooltip />} />
                    <Area type="monotone" dataKey="cpu" name="Server CPU %" stroke="#3b82f6" fill="url(#serverCpuGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === COMBINED OVERLAY CHART === */}
      {data.length > 0 && (
        <div className="bg-panel border border-border rounded-xl p-4">
          <div className="flex items-center gap-4 mb-3">
            <h3 className="text-sm font-semibold text-text2">Direct Comparison</h3>
            <div className="flex items-center gap-3 text-[11px] text-text3">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 rounded" />Agent</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 rounded" />Server</span>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="overlaySrvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="overlayAgtGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tickFormatter={tickFmt} stroke="#9ca3af" fontSize={11} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#9ca3af" fontSize={11} width={40} />
                <Tooltip content={<CoreTooltip />} />
                <Area type="monotone" dataKey="cpu" name="Server CPU %" stroke="#3b82f6" fill="url(#overlaySrvGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="agentCpu" name="Agent CPU %" stroke="#10b981" fill="url(#overlayAgtGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* === SERVER DETAILS: Per-Core + RAM side by side === */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {coreCount > 0 && (
            <div className="bg-panel border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-text2">Per-Core CPU ({coreCount} cores)</h3>
                <button className="text-[11px] px-2 py-0.5 rounded border border-border text-text3 hover:bg-surface transition-colors" onClick={toggleAllCores}>
                  {showAllCores ? 'Hide All' : 'Show All'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {Array.from({ length: coreCount }, (_, i) => {
                  const active = visibleCores.has(i);
                  const color = CORE_COLORS[i % CORE_COLORS.length];
                  const val = latestPerCore[i]?.value;
                  return (
                    <button key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border transition-all ${active ? 'border-transparent text-white shadow-sm' : 'border-border text-text4 bg-surface hover:bg-panel'}`} style={active ? { backgroundColor: color } : {}} onClick={() => toggleCore(i)} title={val != null ? `Core ${i}: ${val.toFixed(1)}%` : `Core ${i}`}>
                      <span className="font-medium">C{i}</span>
                      {val != null && <span className="opacity-80">{val.toFixed(0)}%</span>}
                    </button>
                  );
                })}
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <defs>
                      {Array.from({ length: coreCount }, (_, i) => (
                        <linearGradient key={i} id={`coreGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CORE_COLORS[i % CORE_COLORS.length]} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={CORE_COLORS[i % CORE_COLORS.length]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" tickFormatter={tickFmt} stroke="#9ca3af" fontSize={10} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#9ca3af" fontSize={10} width={40} />
                    <Tooltip content={<CoreTooltip />} />
                    {Array.from({ length: coreCount }, (_, i) => {
                      if (!visibleCores.has(i)) return null;
                      return (<Area key={i} type="monotone" dataKey={`core${i}`} name={`Core ${i}`} stroke={CORE_COLORS[i % CORE_COLORS.length]} fill={`url(#coreGrad${i})`} strokeWidth={1.5} dot={false} connectNulls />);
                    })}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="bg-panel border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text2">Memory Usage</h3>
              <span className="text-[11px] text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">
                {latestRam !== null ? `${latestRam.toFixed(0)} / ${(latestRamTotal || 0).toFixed(0)} MB` : '--'}
              </span>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ramTotalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d1d5db" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#d1d5db" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" tickFormatter={tickFmt} stroke="#9ca3af" fontSize={10} />
                  <YAxis tickFormatter={(v) => `${v} MB`} stroke="#9ca3af" fontSize={10} width={50} />
                  <Tooltip content={<CoreTooltip />} />
                  <Area type="monotone" dataKey="ramTotal" name="Total RAM" stroke="#d1d5db" fill="url(#ramTotalGradient)" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                  <Area type="monotone" dataKey="ramUsed" name="Used RAM" stroke="#8b5cf6" fill="url(#ramGradient)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Per-Core Detail Table */}
      {data.length > 0 && coreCount > 0 && (
        <div className="bg-panel border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-text2">Core Details (current)</h3>
            <input
              type="text"
              placeholder="Filter: core #, >50, <10"
              value={coreFilter}
              onChange={(e) => setCoreFilter(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-border bg-surface text-text1 placeholder:text-text4 w-48 focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-text4 font-medium">Core</th>
                  <th className="text-right py-2 px-3 text-text4 font-medium">Usage</th>
                  <th className="text-left py-2 px-3 text-text4 font-medium w-full">Load</th>
                </tr>
              </thead>
              <tbody>
                {filteredPerCore.map(({ idx, value }) => {
                  const pct = value ?? 0;
                  const color = CORE_COLORS[idx % CORE_COLORS.length];
                  const barColor = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : color;
                  return (
                    <tr key={idx} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="font-medium text-text2">Core {idx}</span>
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={`font-semibold ${pct > 80 ? 'text-red-600' : pct > 50 ? 'text-amber-600' : 'text-text1'}`}>
                          {value != null ? `${value.toFixed(1)}%` : '--'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredPerCore.length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-center text-text4">No cores match filter</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {coreFilter && (
            <div className="mt-2 text-[11px] text-text4">
              Showing {filteredPerCore.length} of {coreCount} cores
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, color, accent }) {
  const borderClass = accent === 'emerald' ? 'border-emerald-200' : accent === 'blue' ? 'border-blue-200' : 'border-border';
  return (
    <div className={`bg-panel border ${borderClass} rounded-xl px-3 py-2.5`}>
      <div className="text-[10px] text-text4 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${color || 'text-text1'}`}>
        {value}
        {sub && <span className="text-xs font-normal text-text4 ml-1">{sub}</span>}
      </div>
    </div>
  );
}

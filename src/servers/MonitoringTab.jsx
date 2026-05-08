import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchMetrics } from '../api/bufferClient.js';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, AreaChart,
} from 'recharts';

const RANGE_OPTIONS = [
  { label: '1h',  hours: 1 },
  { label: '6h',  hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d',  hours: 168 },
  { label: '30d', hours: 720 },
];

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <div className="font-medium text-text2 mb-1">{formatDate(label)}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-text3">{entry.name}:</span>
          <span className="font-semibold text-text1">
            {entry.name.includes('CPU') ? `${entry.value.toFixed(1)}%` : `${entry.value.toFixed(0)} MB`}
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

  const range = RANGE_OPTIONS[rangeIdx];

  const loadMetrics = useCallback(async () => {
    if (!serverId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const from = new Date(now.getTime() - range.hours * 3600000);
      const res = await fetchMetrics(serverId, token, from.toISOString(), now.toISOString(), 2000);
      const points = (res.metrics || []).map((m) => ({
        time: new Date(m.recordedAt).getTime(),
        cpu: m.cpuPercent,
        ramUsed: m.ramUsedMb,
        ramTotal: m.ramTotalMb,
        ramPercent: m.ramTotalMb > 0 ? (m.ramUsedMb / m.ramTotalMb) * 100 : 0,
      }));
      setData(points);
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

  const latestCpu = data.length > 0 ? data[data.length - 1].cpu : null;
  const latestRam = data.length > 0 ? data[data.length - 1].ramUsed : null;
  const latestRamTotal = data.length > 0 ? data[data.length - 1].ramTotal : null;
  const avgCpu = data.length > 0 ? data.reduce((s, d) => s + d.cpu, 0) / data.length : 0;
  const maxCpu = data.length > 0 ? Math.max(...data.map((d) => d.cpu)) : 0;
  const maxRam = data.length > 0 ? Math.max(...data.map((d) => d.ramUsed)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text1">Agent Monitoring</h2>
          <p className="text-xs text-text4 mt-0.5">CPU and memory usage over time</p>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="CPU Now" value={latestCpu !== null ? `${latestCpu.toFixed(1)}%` : '--'} color="text-blue-600" />
        <SummaryCard label="CPU Avg" value={avgCpu > 0 ? `${avgCpu.toFixed(1)}%` : '--'} color="text-blue-500" />
        <SummaryCard label="RAM Now" value={latestRam !== null ? `${latestRam.toFixed(0)} MB` : '--'} sub={latestRamTotal ? `/ ${latestRamTotal.toFixed(0)} MB` : ''} color="text-purple-600" />
        <SummaryCard label="Peak RAM" value={maxRam > 0 ? `${maxRam.toFixed(0)} MB` : '--'} color="text-purple-500" />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading / No data */}
      {loading && data.length === 0 && (
        <div className="flex items-center justify-center py-16 text-text4 text-sm">
          Loading metrics...
        </div>
      )}
      {!loading && data.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-text4">
          <svg className="w-12 h-12 mb-3 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 16l4-6 4 4 5-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm font-medium text-text3">No metrics data yet</p>
          <p className="text-xs text-text4 mt-1">Agent will start reporting CPU/RAM usage automatically</p>
        </div>
      )}

      {/* CPU Chart */}
      {data.length > 0 && (
        <div className="bg-panel border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text2 mb-3">CPU Usage</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tickFormatter={range.hours <= 24 ? formatTime : formatDate} stroke="#9ca3af" fontSize={11} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#9ca3af" fontSize={11} width={45} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="cpu" name="CPU %" stroke="#3b82f6" fill="url(#cpuGradient)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* RAM Chart */}
      {data.length > 0 && (
        <div className="bg-panel border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text2 mb-3">Memory Usage</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ramTotalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d1d5db" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#d1d5db" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tickFormatter={range.hours <= 24 ? formatTime : formatDate} stroke="#9ca3af" fontSize={11} />
                <YAxis tickFormatter={(v) => `${v} MB`} stroke="#9ca3af" fontSize={11} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="ramTotal" name="Total RAM" stroke="#d1d5db" fill="url(#ramTotalGradient)" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                <Area type="monotone" dataKey="ramUsed" name="Used RAM" stroke="#8b5cf6" fill="url(#ramGradient)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, color }) {
  return (
    <div className="bg-panel border border-border rounded-xl px-4 py-3">
      <div className="text-[11px] text-text4 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold mt-1 ${color || 'text-text1'}`}>
        {value}
        {sub && <span className="text-xs font-normal text-text4 ml-1">{sub}</span>}
      </div>
    </div>
  );
}

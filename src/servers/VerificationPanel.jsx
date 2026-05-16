import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchVerification, downloadAuditReport } from '../api/bufferClient.js';

function StatusBadge({ status }) {
  const colors = {
    passed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full border ${colors[status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {(status || 'unknown').toUpperCase()}
    </span>
  );
}

function SummaryCard({ summary }) {
  if (!summary) return null;
  const { total, passed, failed, status } = summary;
  const color = status === 'healthy' ? 'border-emerald-200 bg-emerald-50' : status === 'degraded' ? 'border-red-200 bg-red-50' : 'border-border bg-surface';
  const dotColor = status === 'healthy' ? 'bg-emerald-500' : status === 'degraded' ? 'bg-red-500' : 'bg-gray-400';
  const label = status === 'healthy' ? 'All verified' : status === 'degraded' ? 'Issues detected' : 'No verifications yet';

  return (
    <div className={`rounded-xl border px-5 py-4 ${color}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor} ${status === 'healthy' ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-semibold text-text1">{label}</span>
      </div>
      <div className="flex gap-6">
        <div>
          <span className="text-2xl font-bold text-text1">{total}</span>
          <span className="text-xs text-text3 ml-1">total</span>
        </div>
        <div>
          <span className="text-2xl font-bold text-emerald-600">{passed}</span>
          <span className="text-xs text-text3 ml-1">passed</span>
        </div>
        {failed > 0 && (
          <div>
            <span className="text-2xl font-bold text-red-600">{failed}</span>
            <span className="text-xs text-text3 ml-1">failed</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerificationPanel({ serverId }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchVerification(serverId, token);
      setData(res);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [serverId, token]);

  useEffect(() => { load(); }, [load]);

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const blob = await downloadAuditReport(serverId, token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ProperBackup-Audit-Report-${serverId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-text3 text-sm py-8 justify-center">
        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        Loading verification data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-text1 font-bold text-base">Restore Verification</h2>
          <p className="text-text3 text-sm mt-0.5">Automatic integrity checks after each backup</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost text-xs py-1.5 px-3"
            onClick={load}
          >
            Refresh
          </button>
          <button
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            onClick={handleDownloadReport}
            disabled={downloading}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v8M7 9L4 6M7 9l3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 10v2h10v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {downloading ? 'Generating...' : 'Audit Report PDF'}
          </button>
        </div>
      </div>

      <SummaryCard summary={data?.summary} />

      {data?.results?.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface text-text3 text-xs font-medium">
                <th className="text-left px-4 py-2.5">Archive</th>
                <th className="text-left px-4 py-2.5">Path</th>
                <th className="text-center px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Detail</th>
                <th className="text-right px-4 py-2.5">Verified</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r, i) => (
                <tr key={i} className="border-t border-border hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-text3 truncate max-w-[200px]" title={r.objectName}>
                    {r.objectName?.slice(-30)}
                  </td>
                  <td className="px-4 py-2 text-text2">{r.pathId}</td>
                  <td className="px-4 py-2 text-center"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-2 text-text3 text-xs truncate max-w-[250px]" title={r.detail}>{r.detail || '—'}</td>
                  <td className="px-4 py-2 text-right text-text4 text-xs whitespace-nowrap">
                    {r.verifiedAt ? new Date(r.verifiedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(!data?.results || data.results.length === 0) && (
        <div className="text-center text-text3 text-sm py-8">
          <svg className="w-10 h-10 mx-auto mb-3 text-text4" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
            <path d="M14 20l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          No verification results yet. Results will appear after the agent uploads backups.
        </div>
      )}
    </div>
  );
}

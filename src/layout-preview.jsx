import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AgentStatusCard, { AgentStatusStyles } from './servers/AgentStatusCard.jsx';
import './index.css';

const scenarios = {
  idle_connected: {
    label: 'Idle + Connected',
    agentStatus: { phase: 'idle', detail: 'Scan complete' },
    sseConnected: true,
  },
  scanning: {
    label: 'Scanning',
    agentStatus: { phase: 'scanning', detail: 'Scanning /home', totalFiles: 1500, scannedFiles: 450, currentFile: '/home/user/report.pdf' },
    sseConnected: true,
  },
  disconnected: {
    label: 'Disconnected',
    agentStatus: { phase: 'idle', detail: '' },
    sseConnected: false,
  },
};

function MoreMenuPreview({ activeTab, setTab }) {
  const [open, setOpen] = useState(false);
  const isSecondary = ['monitoring', 'settings'].includes(activeTab);
  return (
    <div className="relative">
      <button
        className={`btn-ghost text-xs py-1.5 px-2.5 flex items-center gap-1.5 ${isSecondary ? 'ring-1 ring-accent/40 font-semibold' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="3" r="1.2" fill="currentColor"/>
          <circle cx="8" cy="8" r="1.2" fill="currentColor"/>
          <circle cx="8" cy="13" r="1.2" fill="currentColor"/>
        </svg>
        {isSecondary && <span className="capitalize">{activeTab}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[160px] z-50">
          {['monitoring', 'settings'].map(key => (
            <button key={key} className={`w-full text-left px-3 py-2 text-xs hover:bg-surface transition-colors ${activeTab === key ? 'text-accent font-semibold bg-accent/5' : 'text-text2'}`}
              onClick={() => { setTab(key); setOpen(false); }}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LayoutPreview() {
  const [scenario, setScenario] = useState('idle_connected');
  const [tab, setTab] = useState('files');
  const current = scenarios[scenario];

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <AgentStatusStyles />

      {/* Scenario selector */}
      <div className="bg-white border-b border-border px-6 py-3">
        <span className="text-xs font-bold text-text4 mr-3">Scenario:</span>
        {Object.entries(scenarios).map(([key, val]) => (
          <button key={key} onClick={() => setScenario(key)}
            className={`text-xs px-3 py-1 rounded-lg border mr-2 ${scenario === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
            {val.label}
          </button>
        ))}
      </div>

      {/* AppHeader — faithful replica of real AppHeader.jsx */}
      <header className="shrink-0 relative z-20 border-b border-border/80 bg-panel shadow-[0_4px_24px_-8px_rgba(15,24,40,0.12),inset_0_-1px_0_rgba(15,108,189,0.06)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/35 to-transparent" />
        <div className="relative flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-surface text-text2 shadow-sm transition hover:border-accent/30 hover:bg-accentLight/50 hover:text-accent">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accentHover shadow-md shadow-accent/25 ring-2 ring-white">
                <svg className="h-[18px] w-[18px] text-white" viewBox="0 0 16 16" fill="none"><path d="M2 5a2 2 0 012-2h3l1.5 1.5H12a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" fill="currentColor"/></svg>
              </div>
              <div className="min-w-0 leading-tight">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="truncate text-[15px] font-bold tracking-tight text-text1 sm:text-base">ProperBackup</span>
                  <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-text4 sm:inline">PANEL</span>
                </div>
              </div>
            </div>
            <div className="ml-1 hidden min-w-0 items-center gap-2 border-l border-border/70 pl-3 sm:flex sm:ml-2 sm:pl-4">
              <span className="badge bg-accentLight text-accent text-xs">Demo VPS - Minecraft Server</span>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${current.sseConnected ? 'text-success' : 'text-text4'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${current.sseConnected ? 'bg-success animate-pulse' : 'bg-text4'}`} />
                {current.sseConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1.5 sm:gap-2">
            <span className="badge hidden border border-amber-200/90 bg-gradient-to-b from-amber-50 to-amber-100/90 px-2.5 py-1 text-[11px] font-semibold text-amber-950 shadow-sm sm:inline-flex">Serviceman mode</span>
            <div className="hidden h-8 w-px bg-border/90 sm:block" />
            <div className="flex items-center gap-2 text-xs text-text2 border border-border/70 rounded-xl bg-surface/90 px-2 py-1 shadow-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accentHover text-[11px] font-bold text-white shadow-sm shadow-accent/30">D</span>
              <span className="text-xs font-medium text-text2">demo@properbackup.com</span>
              <span className="text-[10px] font-bold text-accent bg-accentLight px-2 py-0.5 rounded-full">Trial: 30d</span>
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-panel px-2.5 py-1.5 text-xs font-semibold text-text2 shadow-sm transition hover:border-danger/25 hover:bg-dangerLight/60 hover:text-danger sm:px-3">
              <svg className="h-3.5 w-3.5 shrink-0 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Unified bar: tabs + verification + health score + more menu */}
      <div className="shrink-0 px-6 py-2 border-b border-border bg-panel flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg px-1 py-0.5 bg-accent/5">
          <button className={`btn-ghost text-xs py-1.5 ${tab === 'files' ? 'ring-1 ring-accent/40 font-semibold' : ''}`} onClick={() => setTab('files')}>Files</button>
          <button className={`btn-ghost text-xs py-1.5 ${tab === 'timeline' ? 'ring-1 ring-accent/40 font-semibold' : ''}`} onClick={() => setTab('timeline')}>Timeline</button>
          <button className={`btn-ghost text-xs py-1.5 ${tab === 'activity' ? 'ring-1 ring-accent/40 font-semibold' : ''}`} onClick={() => setTab('activity')}>Activity</button>
        </div>
        <div className="flex-1" />
        <span className="text-[11px] text-text4">Awaiting first verification · 16 files protected</span>
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs bg-amber-50 border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="font-semibold text-amber-600">80% Safe</span>
        </div>
        <MoreMenuPreview activeTab={tab} setTab={setTab} />
      </div>

      {/* Agent status card — below tabs bar */}
      <div className="shrink-0 px-6 pt-4 pb-3 w-full mx-auto max-w-6xl">
        <AgentStatusCard
          agentStatus={current.agentStatus}
          recentFiles={['/home/user/notes.md', '/home/user/report.pdf']}
          sseConnected={current.sseConnected}
        />
      </div>

      {/* Tab content */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-6 w-full mx-auto max-w-6xl">
        {tab === 'files' && <FilesContent />}
        {tab === 'timeline' && <TimelineContent />}
        {tab === 'activity' && <ActivityContent />}
        {tab === 'monitoring' && <div className="text-center text-text4 py-20 border border-dashed border-border rounded-xl">Monitoring content</div>}
        {tab === 'settings' && <div className="text-center text-text4 py-20 border border-dashed border-border rounded-xl">Settings content</div>}
      </main>
    </div>
  );
}

/* ── Files Tab Content ── */
function FilesContent() {
  const files = [
    { name: '/home/user/Documents/report-2026.pdf', status: 'current', size: '2.4 MiB', modified: '2 hours ago' },
    { name: '/home/user/Documents/budget.xlsx', status: 'changed', size: '156 KiB', modified: '45 min ago' },
    { name: '/home/user/Pictures/vacation/IMG_001.jpg', status: 'current', size: '4.8 MiB', modified: '3 days ago' },
    { name: '/home/user/Documents/notes.md', status: 'new', size: '12 KiB', modified: 'just now' },
    { name: '/home/user/Music/playlist.m3u', status: 'current', size: '1.2 KiB', modified: '1 week ago' },
    { name: '/home/user/Projects/app/index.js', status: 'changed', size: '8.7 KiB', modified: '1 hour ago' },
    { name: '/home/user/Downloads/archive.zip', status: 'deleted', size: '340 MiB', modified: '5 days ago' },
    { name: '/home/user/Documents/presentation.pptx', status: 'current', size: '15.2 MiB', modified: '1 day ago' },
  ];
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? files : files.filter(f => f.status === filter);
  const statusColors = { current: 'text-emerald-600 bg-emerald-50', changed: 'text-amber-600 bg-amber-50', new: 'text-blue-600 bg-blue-50', deleted: 'text-red-600 bg-red-50' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          {['all', 'current', 'changed', 'new', 'deleted'].map(s => (
            <button key={s}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${filter === s ? 'bg-accent/15 text-accent font-semibold' : 'text-text3 hover:text-text2 hover:bg-surface/80'}`}
              onClick={() => setFilter(s)}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'all' && <span className="ml-1 text-text4">({files.filter(f => f.status === s).length})</span>}
            </button>
          ))}
        </div>
        <span className="text-xs text-text4">{files.length} files indexed</span>
      </div>
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {filtered.map((f, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 text-xs ${i > 0 ? 'border-t border-border/50' : ''} hover:bg-surface/50 transition-colors`}>
            <svg className="w-4 h-4 text-text4 shrink-0" viewBox="0 0 16 16" fill="none"><path d="M3 3.5A1.5 1.5 0 014.5 2H9l3.5 3.5V12.5A1.5 1.5 0 0111 14H4.5A1.5 1.5 0 013 12.5v-9z" stroke="currentColor" strokeWidth="1.2"/></svg>
            <span className="flex-1 min-w-0 truncate text-text1 font-medium" style={{ fontFamily: 'ui-monospace, monospace' }}>{f.name}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColors[f.status]}`}>{f.status}</span>
            <span className="text-text4 w-16 text-right" style={{ fontFamily: 'ui-monospace, monospace' }}>{f.size}</span>
            <span className="text-text4 w-20 text-right">{f.modified}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Timeline Tab Content ── */
function TimelineContent() {
  const days = [
    { date: '2026-05-11', snaps: [
      { time: '06:20 AM', size: '85.0 MiB', flag: 'A' },
      { time: '11:30 AM', size: '120.0 MiB', flag: 'A' },
    ]},
    { date: '2026-05-10', snaps: [
      { time: '10:00 AM', size: '60.0 MiB', flag: 'A' },
    ]},
    { date: '2026-05-09', snaps: [
      { time: '08:00 AM', size: '30.0 MiB', flag: 'D' },
      { time: '04:45 PM', size: '64.0 MiB', flag: 'A' },
    ]},
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5 text-xs">
        <span className="text-text3"><span className="font-semibold text-text1">5</span> snapshots</span>
        <span className="text-text3"><span className="font-semibold text-emerald-600">4</span> backups</span>
        <span className="text-text3"><span className="font-semibold text-orange-500">1</span> deleted</span>
        <span className="text-text3">Total: <span className="font-bold text-text1" style={{ fontFamily: 'ui-monospace, monospace' }}>359.0 MiB</span></span>
        <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200/60 rounded-full px-2.5 py-0.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold tracking-wider">Live</span>
        </span>
      </div>
      <div className="space-y-3">
        {days.map((day, di) => (
          <div key={day.date} className="bg-white rounded-xl border border-border p-4"
            style={{ marginLeft: di * 12, opacity: 1 - di * 0.15, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-text1">{day.date}</span>
              <span className="text-[11px] text-text4">{day.snaps.length} snapshot{day.snaps.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-wrap gap-6">
              {day.snaps.map((snap, si) => (
                <div key={si} className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
                  <span className="text-xs font-medium text-text2">{snap.time}</span>
                  <div className={`w-6 h-6 rounded-full ${snap.flag === 'A' ? 'bg-emerald-500' : 'bg-orange-500'} flex items-center justify-center`}>
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="2" fill="currentColor"/></svg>
                  </div>
                  <span className="text-[10px] text-text4" style={{ fontFamily: 'ui-monospace, monospace' }}>{snap.size}</span>
                  <span className={`text-[9px] font-bold uppercase ${snap.flag === 'A' ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {snap.flag === 'A' ? 'Backup' : 'Deleted'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Activity Tab Content ── */
function ActivityContent() {
  const events = [
    { time: '12:45 PM', type: 'scan', desc: 'Full scan completed — 16 files indexed', icon: '🔍' },
    { time: '12:44 PM', type: 'upload', desc: 'Snapshot sealed: snap-2026-05-11-002.enc (120.0 MiB)', icon: '📦' },
    { time: '12:30 PM', type: 'scan', desc: 'Scan started — detecting file changes', icon: '🔍' },
    { time: '11:30 AM', type: 'upload', desc: 'Snapshot sealed: snap-2026-05-11-001.enc (85.0 MiB)', icon: '📦' },
    { time: '11:15 AM', type: 'connect', desc: 'Agent connected — monitoring started', icon: '🟢' },
    { time: '10:00 AM', type: 'disconnect', desc: 'Agent disconnected — connection lost', icon: '🔴' },
    { time: '09:45 AM', type: 'scan', desc: 'Quick scan completed — no changes detected', icon: '🔍' },
    { time: '09:00 AM', type: 'connect', desc: 'Agent connected — session started', icon: '🟢' },
  ];
  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {events.map((e, i) => (
        <div key={i} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border/50' : ''}`}>
          <span className="text-sm mt-0.5">{e.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text1 font-medium">{e.desc}</p>
          </div>
          <span className="text-[11px] text-text4 shrink-0">{e.time}</span>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<LayoutPreview />);

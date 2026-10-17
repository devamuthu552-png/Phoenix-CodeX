import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Shield, Trash2, ArrowDown, Filter } from 'lucide-react';
import { SystemEvent } from '../types/telemetry.ts';

interface TerminalLogcatProps {
  events: SystemEvent[];
  localLogs: string[];
  onClearLogs: () => void;
}

export const TerminalLogcat: React.FC<TerminalLogcatProps> = ({
  events,
  localLogs,
  onClearLogs,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'BOOT' | 'CACHE' | 'SMS' | 'UID0'>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Combine system events and runtime logs
  const combinedLogs = [
    ...events.map((e) => ({
      timestamp: new Date(e.timestamp).toLocaleTimeString(),
      tag: e.eventType,
      message: e.details,
      level: e.eventType.includes('SMS') ? 'WARN' : e.eventType.includes('BOOT') ? 'CYAN' : 'INFO',
    })),
    ...localLogs.map((l) => {
      const match = l.match(/\[(.*?)\] \[(.*?)\] (.*)/);
      return {
        timestamp: match ? match[1] : new Date().toLocaleTimeString(),
        tag: match ? match[2] : 'DAEMON_UID0',
        message: match ? match[3] : l,
        level: l.includes('[ERROR]') ? 'ERROR' : l.includes('[WARN]') ? 'WARN' : l.includes('[SUCCESS]') ? 'SUCCESS' : 'INFO',
      };
    }),
  ];

  const filteredLogs = combinedLogs.filter((log) => {
    if (filter === 'ALL') return true;
    if (filter === 'BOOT') return log.tag.includes('BOOT');
    if (filter === 'CACHE') return log.tag.includes('CACHE');
    if (filter === 'SMS') return log.tag.includes('SMS');
    if (filter === 'UID0') return log.tag.includes('UID') || log.tag.includes('DAEMON');
    return true;
  });

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs.length, autoScroll]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl flex flex-col h-60 shadow-2xl overflow-hidden font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200 text-[11px] tracking-wider uppercase">
            Root Daemon Logcat / Audit Terminal
          </span>
          <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
            UID 0 PRIVILEGED
          </span>
        </div>

        {/* Filter buttons & Controls */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10px]">
            {(['ALL', 'BOOT', 'CACHE', 'SMS'] as const).map((tag) => (
              <button
                key={tag}
                onClick={() => setFilter(tag)}
                className={`px-2 py-0.5 rounded font-bold transition-colors ${
                  filter === tag ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1 rounded border transition-colors ${
              autoScroll ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Toggle Auto-Scroll"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClearLogs}
            className="p-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-red-400 border border-slate-700 transition-colors"
            title="Clear Logcat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 text-[11px] leading-relaxed select-text">
        {filteredLogs.map((log, idx) => {
          let colorClass = 'text-slate-300';
          if (log.level === 'ERROR') colorClass = 'text-red-400 font-bold';
          else if (log.level === 'WARN') colorClass = 'text-amber-300';
          else if (log.level === 'SUCCESS') colorClass = 'text-emerald-400 font-bold';
          else if (log.level === 'CYAN') colorClass = 'text-cyan-300 font-semibold';

          return (
            <div key={idx} className="flex items-start gap-2 hover:bg-slate-900/60 py-0.5 px-1 rounded">
              <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
              <span className="text-cyan-500 font-semibold shrink-0 select-none">[{log.tag}]</span>
              <span className={`${colorClass} break-all`}>{log.message}</span>
            </div>
          );
        })}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};

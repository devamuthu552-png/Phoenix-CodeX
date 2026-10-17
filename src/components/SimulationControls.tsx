import React from 'react';
import { Device } from '../types/telemetry.ts';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Power,
  MessageSquareWarning,
  Play,
  Pause,
  Database,
  Radio,
  HardDriveDownload,
  Terminal,
} from 'lucide-react';

interface SimulationControlsProps {
  device: Device;
  isSimulatingMove: boolean;
  onToggleMoveSimulation: () => void;
  onSimulateNetworkDrop: () => void;
  onSimulateReconnectAndFlush: () => void;
  onSimulateReboot: () => void;
  onTriggerEmergencySms: () => void;
  onOpenSmsInspector: () => void;
  onOpenDaemonInspector: () => void;
  cachedPacketsCount: number;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  device,
  isSimulatingMove,
  onToggleMoveSimulation,
  onSimulateNetworkDrop,
  onSimulateReconnectAndFlush,
  onSimulateReboot,
  onTriggerEmergencySms,
  onOpenSmsInspector,
  onOpenDaemonInspector,
  cachedPacketsCount,
}) => {
  const isOffline = device.status === 'OFFLINE' || device.status === 'CACHING';
  const isRebooting = device.status === 'REBOOTING';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3">
      {/* Header with Daemon Status and Quick Action */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Root Daemon Control & Testing Dock
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenDaemonInspector}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-colors"
            title="Inspect Python daemon source code, boot receiver, and system architecture"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Architecture & Code</span>
          </button>
        </div>
      </div>

      {/* Primary 4 Simulation Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* 1. Offline Mode / Network Drop */}
        <button
          onClick={isOffline ? onSimulateReconnectAndFlush : onSimulateNetworkDrop}
          disabled={isRebooting}
          className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
            isOffline
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
              : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600 text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Module B: Cache
            </span>
            {isOffline ? (
              <WifiOff className="w-4 h-4 text-amber-400" />
            ) : (
              <Wifi className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <span className="text-xs font-bold leading-tight">
            {isOffline ? 'Reconnect & Auto-Flush' : 'Simulate Network Drop'}
          </span>
          <span className="text-[10px] text-slate-400 mt-1">
            {isOffline
              ? `${cachedPacketsCount} packets queued in local SQLite`
              : 'Test local queue fallback'}
          </span>
        </button>

        {/* 2. Reconnect & Flush Queue */}
        <button
          onClick={onSimulateReconnectAndFlush}
          disabled={isRebooting || cachedPacketsCount === 0}
          className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
            cachedPacketsCount > 0
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 ring-1 ring-emerald-500/30'
              : 'bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Auto-Flush Engine
            </span>
            <HardDriveDownload className={`w-4 h-4 ${cachedPacketsCount > 0 ? 'text-emerald-400' : 'text-slate-600'}`} />
          </div>
          <span className="text-xs font-bold leading-tight">
            Flush Local Queue ({cachedPacketsCount})
          </span>
          <span className="text-[10px] text-slate-400 mt-1">
            Commit to PostgreSQL DB
          </span>
        </button>

        {/* 3. Reboot & ACTION_BOOT_COMPLETED */}
        <button
          onClick={onSimulateReboot}
          disabled={isRebooting}
          className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
            isRebooting
              ? 'bg-blue-500/20 border-blue-500 text-blue-300 animate-pulse'
              : 'bg-slate-800/60 border-slate-700/80 hover:border-blue-500/60 text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Module D: Boot
            </span>
            <Power className={`w-4 h-4 ${isRebooting ? 'text-blue-400 animate-spin' : 'text-blue-400'}`} />
          </div>
          <span className="text-xs font-bold leading-tight">
            {isRebooting ? 'Rebooting OS...' : 'Trigger Reboot (BOOT_COMPLETED)'}
          </span>
          <span className="text-[10px] text-slate-400 mt-1">
            {device.bootRecoveryCount} successful auto-wakes
          </span>
        </button>

        {/* 4. Emergency SMS Fallback */}
        <button
          onClick={onTriggerEmergencySms}
          disabled={isRebooting}
          className="flex flex-col items-start p-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-left transition-all"
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-red-400">
              Module C: Cellular
            </span>
            <MessageSquareWarning className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-xs font-bold leading-tight">
            Dispatch Emergency SMS
          </span>
          <span className="text-[10px] text-slate-400 mt-1">
            AES-256 encrypted baseband PDU
          </span>
        </button>
      </div>

      {/* Movement Simulation & Auto-Stream Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMoveSimulation}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs border transition-all ${
              isSimulatingMove
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {isSimulatingMove ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Telemetry Generator</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Start Telemetry Generator (5s Loop)</span>
              </>
            )}
          </button>

          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            Daemon loop interval: <span className="text-cyan-400 font-semibold">5.0s</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSmsInspector}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700 rounded-lg transition-colors"
          >
            <MessageSquareWarning className="w-3 h-3 text-red-400" />
            <span>SMS Logs ({device.smsFallbacksTriggered || 0})</span>
          </button>
        </div>
      </div>
    </div>
  );
};

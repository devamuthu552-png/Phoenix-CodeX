import React from 'react';
import { Device } from '../types/telemetry.ts';
import {
  Gauge,
  Battery,
  BatteryCharging,
  Compass,
  ArrowUpRight,
  ShieldCheck,
  Signal,
  Wifi,
  WifiOff,
  Database,
  Clock,
  Layers,
} from 'lucide-react';

interface TelemetryGaugesProps {
  device: Device;
  cachedPacketsCount: number;
}

export const TelemetryGauges: React.FC<TelemetryGaugesProps> = ({ device, cachedPacketsCount }) => {
  const getStatusBadge = () => {
    switch (device.status) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE (HTTPS PINGS)
          </span>
        );
      case 'CACHING':
      case 'OFFLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            OFFLINE (LOCAL CACHING)
          </span>
        );
      case 'REBOOTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-spin" />
            REBOOTING (WAITING BOOT_COMPLETED)
          </span>
        );
      case 'EMERGENCY_SMS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            EMERGENCY SMS DISPATCHED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
            {device.status}
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
      {/* Top Device Identity Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">{device.name}</h2>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold">
              {device.privilegeLevel}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{device.model}</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
        </div>
      </div>

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mt-3">
        {/* Speed */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Speed</span>
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-white">
              {device.lastSpeed?.toFixed(1) || '0.0'}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">km/h</span>
          </div>
        </div>

        {/* Heading */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Heading</span>
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-1 flex items-baseline">
            <span className="text-lg font-bold font-mono text-white">
              {Math.round(device.lastHeading || 0)}°
            </span>
            <span className="text-[10px] text-slate-400 ml-1">
              {device.lastHeading > 315 || device.lastHeading <= 45
                ? 'N'
                : device.lastHeading <= 135
                ? 'E'
                : device.lastHeading <= 225
                ? 'S'
                : 'W'}
            </span>
          </div>
        </div>

        {/* Altitude */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Altitude</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-white">
              {device.lastAltitude?.toFixed(1) || '0.0'}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">m MSL</span>
          </div>
        </div>

        {/* Battery & Power */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Battery</span>
            {device.isCharging ? (
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Battery
                className={`w-3.5 h-3.5 ${
                  device.batteryLevel < 20
                    ? 'text-red-400'
                    : device.batteryLevel < 50
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              />
            )}
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-white">
              {device.batteryLevel}%
            </span>
            <span className="text-[10px] text-slate-400 ml-1">
              {device.isCharging ? 'Charging' : 'Discharging'}
            </span>
          </div>
        </div>

        {/* Offline Cache Queue Counter */}
        <div
          className={`border rounded-xl p-2.5 flex flex-col justify-between transition-all ${
            cachedPacketsCount > 0
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
              : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider">Local Queue</span>
            <Database className={`w-3.5 h-3.5 ${cachedPacketsCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-white">
              {cachedPacketsCount}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">packets</span>
          </div>
        </div>

        {/* Network & Baseband */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Network</span>
            <Signal className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-1 truncate">
            <span className="text-xs font-bold font-mono text-slate-200 block truncate" title={device.networkType}>
              {device.networkType.split(' ')[0]}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Acc: ±{device.lastAccuracy?.toFixed(1) || '2.0'}m
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

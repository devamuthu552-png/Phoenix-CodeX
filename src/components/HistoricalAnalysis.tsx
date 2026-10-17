import React, { useState } from 'react';
import { TelemetryPoint, Device } from '../types/telemetry.ts';
import {
  X,
  History,
  TrendingUp,
  Download,
  Calendar,
  Layers,
  MapPin,
  Play,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface HistoricalAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  device: Device;
  historyRoute: TelemetryPoint[];
  onScrubPosition?: (point: TelemetryPoint) => void;
}

export const HistoricalAnalysis: React.FC<HistoricalAnalysisProps> = ({
  isOpen,
  onClose,
  device,
  historyRoute,
  onScrubPosition,
}) => {
  const [sliderIndex, setSliderIndex] = useState<number>(historyRoute.length - 1);

  if (!isOpen) return null;

  // Calculate metrics
  const totalPoints = historyRoute.length;
  const maxSpeed = historyRoute.reduce((max, p) => Math.max(max, p.speed || 0), 0);
  const avgSpeed = totalPoints > 0
    ? (historyRoute.reduce((acc, p) => acc + (p.speed || 0), 0) / totalPoints).toFixed(1)
    : '0.0';

  const currentScrubbedPoint = historyRoute[sliderIndex] || historyRoute[historyRoute.length - 1];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = Number(e.target.value);
    setSliderIndex(idx);
    if (historyRoute[idx] && onScrubPosition) {
      onScrubPosition(historyRoute[idx]);
    }
  };

  const exportGeoJson = () => {
    const geoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            deviceId: device.id,
            name: device.name,
            totalPoints,
            exportedAt: new Date().toISOString(),
          },
          geometry: {
            type: 'LineString',
            coordinates: historyRoute.map((p) => [p.longitude, p.latitude, p.altitude || 0]),
          },
        },
        ...historyRoute.map((p, i) => ({
          type: 'Feature',
          properties: {
            index: i,
            speed: p.speed,
            heading: p.heading,
            battery: p.battery,
            isOfflineCached: p.isOfflineCached,
            capturedAt: p.capturedAt,
          },
          geometry: {
            type: 'Point',
            coordinates: [p.longitude, p.latitude, p.altitude || 0],
          },
        })),
      ],
    };

    const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apextrack-${device.id}-route.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const headers = ['id', 'deviceId', 'latitude', 'longitude', 'altitude', 'speed', 'heading', 'accuracy', 'battery', 'isOfflineCached', 'capturedAt'];
    const rows = historyRoute.map((p) => [
      p.id || '',
      p.deviceId,
      p.latitude,
      p.longitude,
      p.altitude || 0,
      p.speed || 0,
      p.heading || 0,
      p.accuracy || 2.5,
      p.battery || 100,
      p.isOfflineCached ? 'true' : 'false',
      p.capturedAt,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apextrack-${device.id}-route.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                PostgreSQL Historical Route Analysis
                <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  PERSISTENT CLOUD SQL
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {device.name} • {totalPoints} persisted telemetry coordinates
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportGeoJson}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>GeoJSON</span>
            </button>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Analytics Top Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-950/40 border-b border-slate-800 text-xs">
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 font-mono text-[10px] uppercase">Logged Points</span>
            <div className="text-lg font-bold font-mono text-cyan-400 mt-0.5">{totalPoints}</div>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 font-mono text-[10px] uppercase">Peak Speed</span>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">{maxSpeed.toFixed(1)} km/h</div>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 font-mono text-[10px] uppercase">Average Speed</span>
            <div className="text-lg font-bold font-mono text-white mt-0.5">{avgSpeed} km/h</div>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 font-mono text-[10px] uppercase">Offline Sync Ratio</span>
            <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
              {historyRoute.filter((p) => p.isOfflineCached).length} / {totalPoints}
            </div>
          </div>
        </div>

        {/* Timeline Scrubber */}
        {totalPoints > 1 && (
          <div className="p-4 bg-slate-950/60 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Historical Route Playback Scrubber:</span>
              </span>
              <span className="font-mono text-cyan-300 font-bold">
                Point #{sliderIndex + 1} of {totalPoints} (
                {currentScrubbedPoint ? new Date(currentScrubbedPoint.capturedAt).toLocaleTimeString() : ''})
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={totalPoints - 1}
              value={sliderIndex}
              onChange={handleSliderChange}
              className="w-full accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            {currentScrubbedPoint && (
              <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-400 pt-1">
                <span>Lat: {currentScrubbedPoint.latitude.toFixed(5)}</span>
                <span>Lng: {currentScrubbedPoint.longitude.toFixed(5)}</span>
                <span>Speed: {currentScrubbedPoint.speed?.toFixed(1) || 0} km/h</span>
                <span>Alt: {currentScrubbedPoint.altitude?.toFixed(1) || 0}m</span>
                <span>
                  Source:{' '}
                  <span className={currentScrubbedPoint.isOfflineCached ? 'text-amber-400' : 'text-emerald-400'}>
                    {currentScrubbedPoint.isOfflineCached ? 'OFFLINE_CACHE_FLUSH' : 'LIVE_HTTPS_PING'}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Route Coordinates Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                <th className="pb-2">#</th>
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">Coordinates</th>
                <th className="pb-2">Speed</th>
                <th className="pb-2">Heading</th>
                <th className="pb-2">Battery</th>
                <th className="pb-2">Origin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {historyRoute.slice(-50).reverse().map((point, i) => (
                <tr key={point.id || i} className="hover:bg-slate-800/40">
                  <td className="py-2 text-slate-500 font-bold">{totalPoints - i}</td>
                  <td className="py-2 text-slate-300">
                    {new Date(point.capturedAt).toLocaleTimeString()}
                  </td>
                  <td className="py-2 text-cyan-300">
                    {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                  </td>
                  <td className="py-2 text-slate-200">
                    {point.speed ? `${point.speed.toFixed(1)} km/h` : '0.0'}
                  </td>
                  <td className="py-2 text-slate-400">
                    {point.heading ? `${Math.round(point.heading)}°` : '0°'}
                  </td>
                  <td className="py-2 text-slate-200">
                    {point.battery ? `${point.battery}%` : '100%'}
                  </td>
                  <td className="py-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        point.isOfflineCached
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {point.isOfflineCached ? 'OFFLINE CACHE' : 'LIVE PING'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

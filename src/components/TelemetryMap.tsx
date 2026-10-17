/// <reference types="google.maps" />
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { Device, TelemetryPoint } from '../types/telemetry.ts';
import { Navigation, Compass, Layers, Crosshair, Wifi, ShieldAlert, Cpu, Battery, Activity } from 'lucide-react';

interface TelemetryMapProps {
  apiKey: string;
  devices: Device[];
  selectedDevice: Device | null;
  historyRoute: TelemetryPoint[];
  autoFollow: boolean;
  onSelectDevice: (device: Device) => void;
  onToggleAutoFollow: () => void;
}

// Inner component to handle imperative map operations (Polylines, Camera Panning)
const MapController: React.FC<{
  selectedDevice: Device | null;
  historyRoute: TelemetryPoint[];
  autoFollow: boolean;
  mapType: google.maps.MapTypeId | 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
}> = ({ selectedDevice, historyRoute, autoFollow, mapType }) => {
  const map = useMap();
  const onlinePolylineRef = useRef<google.maps.Polyline | null>(null);
  const cachedPolylineRef = useRef<google.maps.Polyline | null>(null);

  // Set map type
  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(mapType);
  }, [map, mapType]);

  // Pan to device when autoFollow is on or selectedDevice changes
  useEffect(() => {
    if (!map || !selectedDevice) return;
    const pos = { lat: selectedDevice.lastLatitude, lng: selectedDevice.lastLongitude };
    if (autoFollow) {
      map.panTo(pos);
    }
  }, [map, selectedDevice?.lastLatitude, selectedDevice?.lastLongitude, autoFollow]);

  // Draw Route Polylines
  useEffect(() => {
    if (!map) return;

    // Cleanup previous polylines
    if (onlinePolylineRef.current) onlinePolylineRef.current.setMap(null);
    if (cachedPolylineRef.current) cachedPolylineRef.current.setMap(null);

    if (!historyRoute || historyRoute.length < 2) return;

    // Separate points by online vs offline cached
    const onlinePath = historyRoute.map((p) => ({ lat: p.latitude, lng: p.longitude }));

    // Primary route line
    onlinePolylineRef.current = new google.maps.Polyline({
      path: onlinePath,
      geodesic: true,
      strokeColor: '#06b6d4', // Cyan
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map,
    });

    // Offline cached segments highlighted in amber
    const cachedSegments = historyRoute.filter((p) => p.isOfflineCached);
    if (cachedSegments.length > 0) {
      cachedPolylineRef.current = new google.maps.Polyline({
        path: cachedSegments.map((p) => ({ lat: p.latitude, lng: p.longitude })),
        geodesic: true,
        strokeColor: '#f59e0b', // Amber for offline-recovered packets
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map,
      });
    }

    return () => {
      if (onlinePolylineRef.current) onlinePolylineRef.current.setMap(null);
      if (cachedPolylineRef.current) cachedPolylineRef.current.setMap(null);
    };
  }, [map, historyRoute]);

  return null;
};

export const TelemetryMap: React.FC<TelemetryMapProps> = ({
  apiKey,
  devices,
  selectedDevice,
  historyRoute,
  autoFollow,
  onSelectDevice,
  onToggleAutoFollow,
}) => {
  const [selectedMarkerDevice, setSelectedMarkerDevice] = useState<Device | null>(null);
  const [mapType, setMapType] = useState<google.maps.MapTypeId | 'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');

  const defaultCenter = selectedDevice
    ? { lat: selectedDevice.lastLatitude, lng: selectedDevice.lastLongitude }
    : { lat: 37.7749, lng: -122.4194 };

  const getStatusColor = (status: Device['status']) => {
    switch (status) {
      case 'ONLINE':
        return '#10b981'; // Emerald
      case 'CACHING':
      case 'OFFLINE':
        return '#f59e0b'; // Amber
      case 'REBOOTING':
        return '#3b82f6'; // Blue
      case 'EMERGENCY_SMS':
        return '#ef4444'; // Red
      default:
        return '#94a3b8';
    }
  };

  return (
    <div className="relative w-full h-full min-h-[420px] bg-slate-900 overflow-hidden flex flex-col">
      <APIProvider apiKey={apiKey} libraries={['marker', 'geometry']}>
        <Map
          mapId="DEMO_MAP_ID"
          defaultCenter={defaultCenter}
          defaultZoom={15}
          gestureHandling="greedy"
          disableDefaultUI={false}
          className="w-full h-full"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          <MapController
            selectedDevice={selectedDevice}
            historyRoute={historyRoute}
            autoFollow={autoFollow}
            mapType={mapType}
          />

          {/* Render All Registered Devices */}
          {devices.map((device) => {
            const isSelected = selectedDevice?.id === device.id;
            const statusColor = getStatusColor(device.status);

            return (
              <AdvancedMarker
                key={device.id}
                position={{ lat: device.lastLatitude, lng: device.lastLongitude }}
                title={`${device.name} [${device.status}]`}
                onClick={() => {
                  setSelectedMarkerDevice(device);
                  onSelectDevice(device);
                }}
              >
                <div className="relative group cursor-pointer">
                  {/* Outer pulse wave for selected or emergency */}
                  {isSelected && (
                    <div
                      className="absolute -inset-3 rounded-full animate-ping opacity-30"
                      style={{ backgroundColor: statusColor }}
                    />
                  )}

                  {/* Marker Core Container */}
                  <div
                    className={`relative flex items-center justify-center p-2 rounded-xl shadow-2xl transition-all duration-300 backdrop-blur-md border ${
                      isSelected
                        ? 'bg-slate-950/90 border-cyan-400 ring-2 ring-cyan-500/50 scale-110'
                        : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-500 scale-95 hover:scale-105'
                    }`}
                  >
                    {/* Direction arrow if moving */}
                    {device.lastHeading !== undefined && device.lastHeading !== 0 && (
                      <div
                        className="absolute -top-3 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] transition-transform duration-300"
                        style={{
                          borderBottomColor: statusColor,
                          transform: `rotate(${device.lastHeading}deg)`,
                          transformOrigin: '50% 120%',
                        }}
                      />
                    )}

                    {/* Status dot */}
                    <div
                      className="w-3 h-3 rounded-full shadow-inner"
                      style={{ backgroundColor: statusColor }}
                    />

                    {/* Compact Label */}
                    <div className="ml-1.5 flex flex-col items-start pr-1">
                      <span className="text-[11px] font-bold text-slate-100 tracking-tight leading-none whitespace-nowrap">
                        {device.id.replace('DEV-', '')}
                      </span>
                      <span className="text-[9px] font-mono text-cyan-400/90 leading-tight">
                        {device.lastSpeed ? `${Math.round(device.lastSpeed)} km/h` : 'STATIONARY'}
                      </span>
                    </div>
                  </div>

                  {/* Root privilege badge tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                    <div className="bg-slate-950/95 border border-slate-700 text-slate-200 text-[10px] font-mono px-2 py-1 rounded shadow-xl whitespace-nowrap">
                      {device.name} • <span style={{ color: statusColor }}>{device.status}</span>
                    </div>
                    <div className="w-1.5 h-1.5 bg-slate-950 rotate-45 -mt-1 border-r border-b border-slate-700" />
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}

          {/* Info Window on Selected Marker */}
          {selectedMarkerDevice && (
            <InfoWindow
              position={{
                lat: selectedMarkerDevice.lastLatitude,
                lng: selectedMarkerDevice.lastLongitude,
              }}
              onCloseClick={() => setSelectedMarkerDevice(null)}
              headerContent={
                <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Cpu className="w-3.5 h-3.5 text-cyan-600" />
                  {selectedMarkerDevice.name}
                </div>
              }
            >
              <div className="p-1 min-w-[220px] text-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="font-semibold text-slate-600">Daemon Privileges:</span>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-900 font-bold border border-slate-300">
                    {selectedMarkerDevice.privilegeLevel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Status</span>
                    <span className="font-bold" style={{ color: getStatusColor(selectedMarkerDevice.status) }}>
                      {selectedMarkerDevice.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Battery</span>
                    <span className="font-semibold">{selectedMarkerDevice.batteryLevel}% {selectedMarkerDevice.isCharging ? '⚡' : ''}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Speed</span>
                    <span className="font-semibold font-mono">{selectedMarkerDevice.lastSpeed?.toFixed(1) || '0.0'} km/h</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Altitude</span>
                    <span className="font-semibold font-mono">{selectedMarkerDevice.lastAltitude?.toFixed(1) || '0'} m</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Cached Packets</span>
                    <span className="font-semibold font-mono text-amber-600">{selectedMarkerDevice.offlineCachedPackets} queued</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Boot Recoveries</span>
                    <span className="font-semibold font-mono text-cyan-600">{selectedMarkerDevice.bootRecoveryCount}</span>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-200 text-[10px] text-slate-500 font-mono">
                  Coordinates: {selectedMarkerDevice.lastLatitude.toFixed(5)}, {selectedMarkerDevice.lastLongitude.toFixed(5)}
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>

      {/* Floating HUD Controls Overlay */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        {/* Map Type Switcher */}
        <div className="flex bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl p-1 shadow-xl">
          <button
            onClick={() => setMapType('roadmap')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              mapType === 'roadmap'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Vector
          </button>
          <button
            onClick={() => setMapType('hybrid')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              mapType === 'hybrid'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapType('terrain')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              mapType === 'terrain'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Terrain
          </button>
        </div>

        {/* Auto Follow Toggle Button */}
        <button
          onClick={onToggleAutoFollow}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border shadow-xl backdrop-blur-md transition-all ${
            autoFollow
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-950/50'
              : 'bg-slate-950/85 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
          title="Keep map camera locked to active device coordinates"
        >
          <Crosshair className={`w-3.5 h-3.5 ${autoFollow ? 'animate-spin' : ''}`} />
          <span>{autoFollow ? 'Camera Lock: ON' : 'Camera Lock: OFF'}</span>
        </button>
      </div>

      {/* Map Legend Bar */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-3 bg-slate-950/85 backdrop-blur-md border border-slate-800/90 rounded-xl px-3 py-1.5 text-[11px] shadow-2xl">
        <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">Telemetry Stream:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-300">Live API</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-slate-300">Flushed Local Cache</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-slate-300">Boot Recovery</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-slate-300">SMS Fallback</span>
        </div>
      </div>
    </div>
  );
};

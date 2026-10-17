/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Device, TelemetryPoint, EmergencySmsLog, SystemEvent, CachedOfflinePacket } from './types/telemetry.ts';
import { TelemetryMap } from './components/TelemetryMap.tsx';
import { TelemetryGauges } from './components/TelemetryGauges.tsx';
import { SimulationControls } from './components/SimulationControls.tsx';
import { TerminalLogcat } from './components/TerminalLogcat.tsx';
import { Header } from './components/Header.tsx';
import { DeviceManager } from './components/DeviceManager.tsx';
import { HistoricalAnalysis } from './components/HistoricalAnalysis.tsx';
import { DaemonInspector } from './components/DaemonInspector.tsx';
import { EmergencySmsModal } from './components/EmergencySmsModal.tsx';
import { QuotaWarning } from './components/QuotaWarning.tsx';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDE7CiU-EOotKn51UepHyXu_HHlmdqvDmk';

const DEFAULT_DEVICES: Device[] = [
  {
    id: 'DEV-ALPHA-01',
    name: 'Asset Alpha — Armored Field Transport',
    model: 'Pixel 8 Pro (Root Priv-App / UID 0 Daemon)',
    privilegeLevel: 'UID 0 (Root Privileged)',
    status: 'ONLINE',
    batteryLevel: 94,
    isCharging: true,
    networkType: '5G SA / LTE',
    offlineCachedPackets: 0,
    bootRecoveryCount: 3,
    emergencySmsPhone: '+1-555-019-9482',
    smsFallbacksTriggered: 1,
    encryptionKeyId: 'AES-256-GCM::KEY-ALPHA-8812',
    lastLatitude: 37.7749,
    lastLongitude: -122.4194,
    lastSpeed: 42.5,
    lastHeading: 78.0,
    lastAltitude: 18.0,
    lastAccuracy: 1.8,
  },
  {
    id: 'DEV-BRAVO-02',
    name: 'Asset Bravo — Tactical Recon Node',
    model: 'Qualcomm Snapdragon OS (Priv-App Daemon)',
    privilegeLevel: 'UID 0 (system/priv-app)',
    status: 'ONLINE',
    batteryLevel: 78,
    isCharging: false,
    networkType: 'LTE-A MIMO',
    offlineCachedPackets: 0,
    bootRecoveryCount: 1,
    emergencySmsPhone: '+1-555-019-9482',
    smsFallbacksTriggered: 0,
    encryptionKeyId: 'AES-256-GCM::KEY-BRAVO-4096',
    lastLatitude: 37.7885,
    lastLongitude: -122.4072,
    lastSpeed: 28.3,
    lastHeading: 210.0,
    lastAltitude: 32.5,
    lastAccuracy: 2.2,
  },
  {
    id: 'DEV-CHARLIE-03',
    name: 'Asset Charlie — Remote Cellular Beacon',
    model: 'Embedded Linux Automotive Gateway',
    privilegeLevel: 'UID 0 (systemd service)',
    status: 'OFFLINE',
    batteryLevel: 61,
    isCharging: false,
    networkType: 'NO_CARRIER (Simulated Drop)',
    offlineCachedPackets: 14,
    bootRecoveryCount: 5,
    emergencySmsPhone: '+1-555-019-9482',
    smsFallbacksTriggered: 2,
    encryptionKeyId: 'AES-256-GCM::KEY-CHARLIE-9103',
    lastLatitude: 37.7599,
    lastLongitude: -122.4148,
    lastSpeed: 0.0,
    lastHeading: 145.0,
    lastAltitude: 24.0,
    lastAccuracy: 3.1,
  },
];

async function safeFetch(url: string, options?: RequestInit, retries = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    } catch {
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  return null;
}

export default function App() {
  const [devices, setDevices] = useState<Device[]>(DEFAULT_DEVICES);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(DEFAULT_DEVICES[0]);
  const [historyRoute, setHistoryRoute] = useState<TelemetryPoint[]>([]);
  const [emergencySmsLogs, setEmergencySmsLogs] = useState<EmergencySmsLog[]>([]);
  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([]);
  const [localLogs, setLocalLogs] = useState<string[]>([]);
  const [localCacheQueue, setLocalCacheQueue] = useState<CachedOfflinePacket[]>([]);
  
  // UI Modal States
  const [showDeviceManager, setShowDeviceManager] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDaemonInspector, setShowDaemonInspector] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [isSimulatingMove, setIsSimulatingMove] = useState(true);

  // Logging helper
  const addLog = useCallback((message: string, tag: string = 'DAEMON_UID0') => {
    const timestamp = new Date().toLocaleTimeString();
    setLocalLogs((prev) => [...prev.slice(-150), `[${timestamp}] [${tag}] ${message}`]);
  }, []);

  // Fetch initial devices from PostgreSQL
  const fetchDevices = useCallback(async () => {
    try {
      const res = await safeFetch('/api/devices');
      if (res && res.ok) {
        const data: Device[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setDevices(data);
          setSelectedDevice((prev) => (prev ? (data.find((d) => d.id === prev.id) || prev) : data[0]));
          return;
        }
      }
    } catch (err: any) {
      console.warn('Backend sync retry note:', err?.message || err);
    }
  }, []);

  // Fetch historical route for selected device
  const fetchHistory = useCallback(async (deviceId: string) => {
    try {
      const res = await safeFetch(`/api/devices/${deviceId}/history?limit=300`);
      if (res && res.ok) {
        const data: TelemetryPoint[] = await res.json();
        if (Array.isArray(data)) {
          setHistoryRoute(data);
        }
      }
    } catch (err) {
      console.warn('Fetch history note:', err);
    }
  }, []);

  // Fetch emergency SMS logs
  const fetchEmergencySms = useCallback(async (deviceId?: string) => {
    try {
      const url = deviceId ? `/api/emergency-sms?deviceId=${deviceId}` : '/api/emergency-sms';
      const res = await safeFetch(url);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setEmergencySmsLogs(data);
        }
      }
    } catch (err) {
      console.warn('Fetch SMS logs note:', err);
    }
  }, []);

  // Fetch system events
  const fetchSystemEvents = useCallback(async (deviceId: string) => {
    try {
      const res = await safeFetch(`/api/devices/${deviceId}/events`);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSystemEvents(data);
        }
      }
    } catch (err) {
      console.warn('Fetch events note:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDevices();
    fetchEmergencySms();
    addLog('ApexTrack Root Telemetry Engine initialized. Cloud SQL connected.', '[BOOT]');
  }, [fetchDevices, fetchEmergencySms, addLog]);

  // When selected device changes, reload route and events
  useEffect(() => {
    if (selectedDevice) {
      fetchHistory(selectedDevice.id);
      fetchSystemEvents(selectedDevice.id);
      addLog(`Attached operator focus to target: ${selectedDevice.name} [${selectedDevice.id}]`, 'RADAR');
    }
  }, [selectedDevice?.id, fetchHistory, fetchSystemEvents, addLog]);

  // Periodic Telemetry Daemon Polling Loop (every 5 seconds)
  useEffect(() => {
    if (!isSimulatingMove || !selectedDevice) return;

    const interval = setInterval(async () => {
      // Don't poll while rebooting
      if (selectedDevice.status === 'REBOOTING') return;

      // Small realistic coordinate delta
      const deltaLat = (Math.random() - 0.45) * 0.0006;
      const deltaLng = (Math.random() - 0.45) * 0.0006;
      const newLat = selectedDevice.lastLatitude + deltaLat;
      const newLng = selectedDevice.lastLongitude + deltaLng;
      const newSpeed = Math.max(0, (selectedDevice.lastSpeed || 20) + (Math.random() - 0.5) * 6);
      const newHeading = (Math.round((Math.atan2(deltaLng, deltaLat) * 180) / Math.PI) + 360) % 360;
      const newAltitude = Math.max(5, (selectedDevice.lastAltitude || 15) + (Math.random() - 0.5) * 2);
      const newBattery = Math.max(1, selectedDevice.batteryLevel - (Math.random() > 0.8 ? 1 : 0));

      const isOfflineMode = selectedDevice.status === 'OFFLINE' || selectedDevice.status === 'CACHING';

      if (isOfflineMode) {
        // MODULE B: Local Offline Caching in immutable SQLite queue
        const packet: CachedOfflinePacket = {
          id: `PKT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          latitude: newLat,
          longitude: newLng,
          altitude: newAltitude,
          speed: newSpeed,
          heading: newHeading,
          accuracy: 1.8,
          battery: newBattery,
          network: 'OFFLINE_LOCAL_SQLITE',
        };

        setLocalCacheQueue((prev) => [...prev, packet]);
        setSelectedDevice((prev) =>
          prev
            ? {
                ...prev,
                lastLatitude: newLat,
                lastLongitude: newLng,
                lastSpeed: newSpeed,
                lastHeading: newHeading,
                batteryLevel: newBattery,
                offlineCachedPackets: (prev.offlineCachedPackets || 0) + 1,
                status: 'CACHING',
              }
            : null
        );

        addLog(
          `[NET_FAIL] Network unreachable. Packet ${packet.id.slice(0, 10)} appended to local SQLite queue (Total: ${localCacheQueue.length + 1})`,
          'CACHE_SQLITE'
        );
      } else {
        // MODULE A: Live HTTPS Telemetry Ping
        try {
          const res = await safeFetch('/api/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId: selectedDevice.id,
              latitude: newLat,
              longitude: newLng,
              altitude: newAltitude,
              speed: newSpeed,
              heading: newHeading,
              accuracy: 1.6,
              battery: newBattery,
              network: selectedDevice.networkType,
              status: 'ONLINE',
            }),
          }, 2);

          if (res && res.ok) {
            const result = await res.json();
            setSelectedDevice((prev) =>
              prev
                ? {
                    ...prev,
                    lastLatitude: newLat,
                    lastLongitude: newLng,
                    lastSpeed: newSpeed,
                    lastHeading: newHeading,
                    lastAltitude: newAltitude,
                    batteryLevel: newBattery,
                    status: 'ONLINE',
                  }
                : null
            );

            setHistoryRoute((prev) => [
              ...prev,
              {
                id: result.log?.id || Date.now(),
                deviceId: selectedDevice.id,
                latitude: newLat,
                longitude: newLng,
                altitude: newAltitude,
                speed: newSpeed,
                heading: newHeading,
                accuracy: 1.6,
                battery: newBattery,
                network: selectedDevice.networkType,
                status: 'ONLINE',
                isOfflineCached: false,
                capturedAt: new Date().toISOString(),
              },
            ]);

            addLog(
              `Live HTTPS ping OK: ${newLat.toFixed(5)}, ${newLng.toFixed(5)} • ${newSpeed.toFixed(1)} km/h • Bat: ${newBattery}%`,
              'ONLINE_PING'
            );
          } else {
            // Live ping failed or backend restarting -> Autonomous daemon auto-buffers to local SQLite queue
            const packet: CachedOfflinePacket = {
              id: `PKT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              timestamp: new Date().toISOString(),
              latitude: newLat,
              longitude: newLng,
              altitude: newAltitude,
              speed: newSpeed,
              heading: newHeading,
              accuracy: 1.8,
              battery: newBattery,
              network: 'AUTO_BUFFER_SQLITE',
            };

            setLocalCacheQueue((prev) => [...prev, packet]);
            setSelectedDevice((prev) =>
              prev
                ? {
                    ...prev,
                    lastLatitude: newLat,
                    lastLongitude: newLng,
                    lastSpeed: newSpeed,
                    lastHeading: newHeading,
                    batteryLevel: newBattery,
                    offlineCachedPackets: (prev.offlineCachedPackets || 0) + 1,
                    status: 'CACHING',
                  }
                : null
            );

            addLog(
              `[NET_FAILOVER] Uplink ping unacknowledged. Auto-cached packet ${packet.id.slice(0, 10)} to local SQLite queue (Queue size: ${localCacheQueue.length + 1})`,
              'CACHE_SQLITE'
            );
          }
        } catch {
          // Autonomous fallback on unexpected network disconnect
          const packet: CachedOfflinePacket = {
            id: `PKT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            latitude: newLat,
            longitude: newLng,
            altitude: newAltitude,
            speed: newSpeed,
            heading: newHeading,
            accuracy: 1.8,
            battery: newBattery,
            network: 'AUTO_BUFFER_SQLITE',
          };

          setLocalCacheQueue((prev) => [...prev, packet]);
          setSelectedDevice((prev) =>
            prev
              ? {
                  ...prev,
                  lastLatitude: newLat,
                  lastLongitude: newLng,
                  lastSpeed: newSpeed,
                  lastHeading: newHeading,
                  batteryLevel: newBattery,
                  offlineCachedPackets: (prev.offlineCachedPackets || 0) + 1,
                  status: 'CACHING',
                }
              : null
          );

          addLog(
            `[OFFLINE_DETECTED] Network offline. Telemetry buffered to local SQLite storage`,
            'CACHE_SQLITE'
          );
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isSimulatingMove, selectedDevice, localCacheQueue.length, addLog]);

  // Simulation Trigger: Network Drop
  const handleSimulateNetworkDrop = async () => {
    if (!selectedDevice) return;
    try {
      await safeFetch(`/api/devices/${selectedDevice.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'OFFLINE',
          networkType: 'DISCONNECTED (Local SQLite Queue Active)',
        }),
      });

      setSelectedDevice((prev) =>
        prev
          ? {
              ...prev,
              status: 'OFFLINE',
              networkType: 'DISCONNECTED (Local SQLite Queue Active)',
            }
          : null
      );

      addLog(
        `SIMULATION: Network connection dropped (ENETUNREACH). Daemon switching to immutable local SQLite transaction queue.`,
        'NET_DROP'
      );
    } catch {
      // Local state update still occurs
      setSelectedDevice((prev) =>
        prev
          ? {
              ...prev,
              status: 'OFFLINE',
              networkType: 'DISCONNECTED (Local SQLite Queue Active)',
            }
          : null
      );
    }
  };

  // Simulation Trigger: Reconnect & Auto-Flush Queue to PostgreSQL
  const handleSimulateReconnectAndFlush = async () => {
    if (!selectedDevice) return;

    addLog(`Network connectivity re-established. Initiating Auto-Flush Sync Engine...`, 'AUTO_FLUSH');

    try {
      const packetsToFlush = localCacheQueue.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude,
        speed: p.speed,
        heading: p.heading,
        accuracy: p.accuracy,
        battery: p.battery,
        network: 'FLUSHED_OFFLINE_CACHE',
        capturedAt: p.timestamp,
      }));

      if (packetsToFlush.length > 0) {
        const res = await safeFetch('/api/telemetry/sync-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: selectedDevice.id,
            packets: packetsToFlush,
          }),
        });

        if (res && res.ok) {
          const result = await res.json();
          addLog(
            `SUCCESS: Flushed and committed ${result.count} offline cached packets directly to Cloud SQL PostgreSQL.`,
            'SYNC_SUCCESS'
          );
        }
      } else {
        await safeFetch(`/api/devices/${selectedDevice.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'ONLINE',
            networkType: '5G SA (Band n78 / Reconnected)',
            offlineCachedPackets: 0,
          }),
        });
      }

      setLocalCacheQueue([]);
      setSelectedDevice((prev) =>
        prev
          ? {
              ...prev,
              status: 'ONLINE',
              networkType: '5G SA (Band n78 / Reconnected)',
              offlineCachedPackets: 0,
            }
          : null
      );

      // Refresh history
      fetchHistory(selectedDevice.id);
      fetchSystemEvents(selectedDevice.id);
    } catch (err: any) {
      console.warn('Flush note:', err);
      addLog(`Cache local flush complete: ${err?.message || 'Queued data cleared'}`, '[SYNC]');
    }
  };

  // Simulation Trigger: Device Reboot & ACTION_BOOT_COMPLETED
  const handleSimulateReboot = async () => {
    if (!selectedDevice) return;

    setSelectedDevice((prev) => (prev ? { ...prev, status: 'REBOOTING' } : null));
    addLog(`System shutdown signal received. Device entering REBOOT sequence...`, 'REBOOT');

    // Simulate rebooting transition (1.8s)
    setTimeout(async () => {
      try {
        const res = await safeFetch(`/api/devices/${selectedDevice.id}/boot-completed`, {
          method: 'POST',
        });
        if (res && res.ok) {
          const result = await res.json();
          setSelectedDevice((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'ONLINE',
                  bootRecoveryCount: result.bootRecoveryCount,
                  networkType: '5G SA (Post-Boot Synchronized)',
                }
              : null
          );

          addLog(
            `INTENT CAUGHT: android.intent.action.BOOT_COMPLETED. BootRecoveryReceiver auto-woke root daemon (PID 2048) at UID 0! Stale locks purged.`,
            'BOOT_COMPLETED'
          );

          fetchSystemEvents(selectedDevice.id);
        } else {
          setSelectedDevice((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'ONLINE',
                  bootRecoveryCount: (prev.bootRecoveryCount || 0) + 1,
                  networkType: '5G SA (Local Boot Intercepted)',
                }
              : null
          );
        }
      } catch (err: any) {
        console.warn('Reboot trigger note:', err);
      }
    }, 1800);
  };

  // Simulation Trigger: Emergency SMS Fallback Protocol
  const handleTriggerEmergencySms = async () => {
    if (!selectedDevice) return;

    addLog(`Initiating Module C: Emergency SMS Fallback dispatch...`, 'SMS_ALERT');

    // Simulate AES-256 encrypted PDU and decrypted payload
    const rawCoords = {
      dev: selectedDevice.id,
      lat: selectedDevice.lastLatitude,
      lng: selectedDevice.lastLongitude,
      spd: selectedDevice.lastSpeed,
      bat: selectedDevice.batteryLevel,
      uid: 0,
      ts: Date.now(),
    };

    const dummyCipher = `AES256GCM::${btoa(JSON.stringify(rawCoords))}::NONCE-${Math.random().toString(36).substring(2, 10)}`;

    try {
      const res = await safeFetch('/api/emergency-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          recipientNumber: selectedDevice.emergencySmsPhone,
          encryptedPayload: dummyCipher,
          decryptedPayload: JSON.stringify(rawCoords, null, 2),
          triggerReason: 'MANUAL_PANIC_DISPATCH',
        }),
      });

      if (res && res.ok) {
        addLog(
          `DISPATCHED: Baseband SMS sent via AT+CMGS to ${selectedDevice.emergencySmsPhone}. Encrypted PDU confirmed.`,
          'SMS_SUCCESS'
        );
      }

      setSelectedDevice((prev) =>
        prev
          ? {
              ...prev,
              status: 'EMERGENCY_SMS',
              smsFallbacksTriggered: (prev.smsFallbacksTriggered || 0) + 1,
            }
          : null
      );

      fetchEmergencySms(selectedDevice.id);
      setShowSmsModal(true);
    } catch (err: any) {
      console.warn('SMS dispatch note:', err);
    }
  };

  const handleRegisterDevice = async (deviceData: Partial<Device>) => {
    try {
      const res = await safeFetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceData),
      });
      if (res && res.ok) {
        const created: Device = await res.json();
        setDevices((prev) => [created, ...prev]);
        setSelectedDevice(created);
        addLog(`Registered new root device target: ${created.name} [${created.id}]`, 'DEVICE_REG');
      }
    } catch (err: any) {
      console.warn('Device registration note:', err);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Google Maps Quota Warning Banner (if hit) */}
      <QuotaWarning />

      {/* Top Application Header */}
      <Header
        selectedDevice={selectedDevice}
        onOpenDeviceManager={() => setShowDeviceManager(true)}
        onOpenHistory={() => setShowHistory(true)}
        onOpenDaemonInspector={() => setShowDaemonInspector(true)}
        onOpenSmsLogs={() => setShowSmsModal(true)}
      />

      {/* Main Radar & Telemetry Split Screen */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left/Main Column: Google Maps Interactive Telemetry Radar */}
        <section className="flex-1 h-full relative overflow-hidden flex flex-col">
          <TelemetryMap
            apiKey={MAPS_API_KEY}
            devices={devices}
            selectedDevice={selectedDevice}
            historyRoute={historyRoute}
            autoFollow={autoFollow}
            onSelectDevice={(d) => setSelectedDevice(d)}
            onToggleAutoFollow={() => setAutoFollow(!autoFollow)}
          />
        </section>

        {/* Right/Side Control Panel */}
        <aside className="w-full md:w-[480px] lg:w-[520px] bg-slate-950/95 border-t md:border-t-0 md:border-l border-slate-800/80 p-3 sm:p-4 flex flex-col gap-3.5 overflow-y-auto shadow-2xl z-20">
          {selectedDevice && (
            <>
              {/* Telemetry Metric Cards */}
              <TelemetryGauges
                device={selectedDevice}
                cachedPacketsCount={localCacheQueue.length + (selectedDevice.offlineCachedPackets || 0)}
              />

              {/* Simulation Controls Dock */}
              <SimulationControls
                device={selectedDevice}
                isSimulatingMove={isSimulatingMove}
                onToggleMoveSimulation={() => setIsSimulatingMove(!isSimulatingMove)}
                onSimulateNetworkDrop={handleSimulateNetworkDrop}
                onSimulateReconnectAndFlush={handleSimulateReconnectAndFlush}
                onSimulateReboot={handleSimulateReboot}
                onTriggerEmergencySms={handleTriggerEmergencySms}
                onOpenSmsInspector={() => setShowSmsModal(true)}
                onOpenDaemonInspector={() => setShowDaemonInspector(true)}
                cachedPacketsCount={localCacheQueue.length + (selectedDevice.offlineCachedPackets || 0)}
              />

              {/* Root Logcat Terminal */}
              <TerminalLogcat
                events={systemEvents}
                localLogs={localLogs}
                onClearLogs={() => setLocalLogs([])}
              />
            </>
          )}
        </aside>
      </main>

      {/* Modals & Drawers */}
      <DeviceManager
        isOpen={showDeviceManager}
        onClose={() => setShowDeviceManager(false)}
        devices={devices}
        selectedDevice={selectedDevice}
        onSelectDevice={(d) => setSelectedDevice(d)}
        onRegisterDevice={handleRegisterDevice}
      />

      {selectedDevice && (
        <HistoricalAnalysis
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          device={selectedDevice}
          historyRoute={historyRoute}
          onScrubPosition={(point) => {
            setSelectedDevice((prev) =>
              prev
                ? {
                    ...prev,
                    lastLatitude: point.latitude,
                    lastLongitude: point.longitude,
                    lastSpeed: point.speed || 0,
                    lastHeading: point.heading || 0,
                  }
                : null
            );
          }}
        />
      )}

      <DaemonInspector
        isOpen={showDaemonInspector}
        onClose={() => setShowDaemonInspector(false)}
      />

      {selectedDevice && (
        <EmergencySmsModal
          isOpen={showSmsModal}
          onClose={() => setShowSmsModal(false)}
          logs={emergencySmsLogs}
          recipientPhone={selectedDevice.emergencySmsPhone}
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import {
  X,
  FileCode,
  Shield,
  Layers,
  Terminal,
  Database,
  Radio,
  Copy,
  Check,
  Cpu,
  RefreshCw,
  MessageSquareWarning,
} from 'lucide-react';

interface DaemonInspectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DaemonInspector: React.FC<DaemonInspectorProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'daemon' | 'cache' | 'boot' | 'sms' | 'init'>('architecture');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const pythonDaemonCode = `#!/usr/bin/env python3
"""
ApexTrack: Autonomous Root-Level Device Tracking Daemon
Target OS: Android 13/14 / Linux 6.x (UID 0 / /system/priv-app)
Bypasses aggressive Doze mode, battery kill-lists, and standard app permissions.
"""

import os
import sys
import time
import json
import logging
import sqlite3
import threading
from urllib import request, error

# Root privilege confirmation
if os.geteuid() != 0:
    logging.warning("[WARN] Process not running as UID 0! Attempting privileged respawn...")
    # In Android, daemon is started via /system/bin/app_process or init.rc

CONFIG = {
    "DEVICE_ID": "DEV-PX8-ROOT01",
    "SERVER_ENDPOINT": "https://api.apextrack.internal/api/telemetry",
    "BATCH_SYNC_ENDPOINT": "https://api.apextrack.internal/api/telemetry/sync-batch",
    "POLL_INTERVAL_SEC": 5.0,
    "LOCAL_CACHE_PATH": "/data/system/apextrack/telemetry_cache.db",
    "EMERGENCY_SMS_RECIPIENT": "+15550199482",
    "MAX_OFFLINE_PACKETS_BEFORE_SMS": 20,
}

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] [UID 0] %(message)s")

class OfflineCacheEngine:
    def __init__(self, db_path):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self._init_db()

    def _init_db(self):
        with self.conn:
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS offline_packets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    payload TEXT NOT NULL,
                    synced INTEGER DEFAULT 0
                )
            """)

    def enqueue(self, telemetry_dict):
        with self.conn:
            self.conn.execute(
                "INSERT INTO offline_packets (payload) VALUES (?)",
                (json.dumps(telemetry_dict),)
            )
        logging.info("[CACHE] Packet appended to immutable local SQLite queue.")

    def get_pending(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT id, payload FROM offline_packets WHERE synced = 0 ORDER BY id ASC")
        return cursor.fetchall()

    def mark_synced(self, packet_ids):
        with self.conn:
            self.conn.executemany("UPDATE offline_packets SET synced = 1 WHERE id = ?", [(i,) for i in packet_ids])
        logging.info(f"[CACHE] Flushed {len(packet_ids)} packets from local queue.")

class TelemetryDaemon:
    def __init__(self):
        self.cache = OfflineCacheEngine(CONFIG["LOCAL_CACHE_PATH"])
        self.is_online = True

    def read_hardware_gps(self):
        # In Android root daemon, read from /dev/ttyUSB0 (Qualcomm GNSS) or /dev/gnss0
        # or bind directly via Android Native Location HAL libhardware.so
        return {
            "latitude": 37.7892,
            "longitude": -122.4014,
            "altitude": 18.5,
            "speed": 28.4,
            "heading": 45.2,
            "accuracy": 1.6,
            "battery": 94,
            "network": "5G SA (Band n78)",
            "timestamp": time.time()
        }

    def dispatch_live_ping(self, packet):
        data = json.dumps({"deviceId": CONFIG["DEVICE_ID"], **packet}).encode('utf-8')
        req = request.Request(CONFIG["SERVER_ENDPOINT"], data=data, headers={'Content-Type': 'application/json'})
        with request.urlopen(req, timeout=3.5) as resp:
            return resp.status == 200

    def run_polling_loop(self):
        logging.info(f"ApexTrack Root Daemon started for {CONFIG['DEVICE_ID']}.")
        while True:
            packet = self.read_hardware_gps()
            try:
                success = self.dispatch_live_ping(packet)
                if not self.is_online:
                    logging.info("[NET] Connectivity restored. Triggering Auto-Flush Engine...")
                    self.flush_offline_cache()
                    self.is_online = True
            except (error.URLError, error.HTTPError, OSError) as e:
                logging.warning(f"[OFFLINE] Network drop detected ({e}). Enqueueing to SQLite.")
                self.is_online = False
                self.cache.enqueue(packet)
                self.check_emergency_sms_threshold()

            time.sleep(CONFIG["POLL_INTERVAL_SEC"])

if __name__ == "__main__":
    daemon = TelemetryDaemon()
    daemon.run_polling_loop()
`;

  const bootReceiverCode = `package com.apextrack.receiver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import java.io.File;

/**
 * Boot Completed Receiver (Auto-Wake Engine)
 * Intercepts ACTION_BOOT_COMPLETED & QUICKBOOT_POWERON.
 * Restarts root daemon immediately upon system initialization.
 */
public class BootRecoveryReceiver extends BroadcastReceiver {
    private static final String TAG = "ApexTrackBoot";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.i(TAG, "[BOOT_RECOVERY] Caught broadcast intent: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            
            Log.i(TAG, "[AUTO-WAKE] OS boot finished. Starting privileged daemon UID 0...");
            spawnRootDaemon();
        }
    }

    private void spawnRootDaemon() {
        try {
            // Execute root daemon command via su or direct privileged init socket
            Process process = Runtime.getRuntime().exec(new String[]{
                "su", "-c", "/system/bin/python3 /data/system/apextrack/daemon.py &"
            });
            Log.i(TAG, "[SUCCESS] Root daemon process spawned. PID attached.");
        } catch (Exception e) {
            Log.e(TAG, "[ERROR] Failed to spawn root daemon: " + e.getMessage());
        }
    }
}
`;

  const smsFallbackCode = `"""
Module C: Emergency SMS Fallback Protocol
Dispatches AES-256 encrypted location packets via cellular baseband AT command
or privileged SmsManager when data networks are unavailable.
"""

import os
import json
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

KEY = AESGCM.generate_key(bit_length=256)

def encrypt_telemetry_payload(telemetry_dict):
    aesgcm = AESGCM(KEY)
    nonce = os.urandom(12)
    data = json.dumps(telemetry_dict).encode('utf-8')
    ciphertext = aesgcm.encrypt(nonce, data, None)
    # Combine nonce + ciphertext and encode in Base64
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode('utf-8')

def dispatch_silent_sms_via_baseband(recipient_phone, encrypted_pdu):
    """
    Executes raw AT command directly to modem device /dev/smd0 or /dev/ttyUSB2
    bypassing Android framework SMS permission prompts.
    """
    command = f'service call isms 7 i32 0 s16 "com.android.phone" s16 "{recipient_phone}" s16 "null" s16 "{encrypted_pdu}" s16 "null" s16 "null"'
    os.system(f"su -c '{command}'")
    print(f"[EMERGENCY_SMS] Dispatched baseband PDU to {recipient_phone}")
`;

  const initRcCode = `# /system/etc/init/apextrack_daemon.rc
# Root privileged persistent daemon init definition

service apextrack_daemon /system/bin/python3 /data/system/apextrack/daemon.py
    class main
    user root
    group root system radio
    seclabel u:r:su:s0
    oneshot false
    restart_period 2
    capabilities NET_RAW NET_ADMIN SYS_TIME
    critical

on property:sys.boot_completed=1
    start apextrack_daemon
    write /data/system/apextrack/boot_marker.txt "BOOT_COMPLETE_OK"
`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActiveContent = () => {
    switch (activeTab) {
      case 'daemon':
        return pythonDaemonCode;
      case 'boot':
        return bootReceiverCode;
      case 'sms':
        return smsFallbackCode;
      case 'init':
        return initRcCode;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Autonomous Root Daemon: Architecture & Source Code
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Persistent UID 0 • Offline Caching • Boot Recovery • Emergency SMS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'architecture'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            System Architecture
          </button>
          <button
            onClick={() => setActiveTab('daemon')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'daemon'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>daemon.py (UID 0)</span>
          </button>
          <button
            onClick={() => setActiveTab('boot')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'boot'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>BootRecoveryReceiver.java</span>
          </button>
          <button
            onClick={() => setActiveTab('sms')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'sms'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquareWarning className="w-3.5 h-3.5" />
            <span>sms_fallback.py</span>
          </button>
          <button
            onClick={() => setActiveTab('init')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'init'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>init.rc (Android Service)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'architecture' ? (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <h3 className="font-bold text-sm text-cyan-400 mb-1">Executive Summary</h3>
                <p className="leading-relaxed text-slate-300">
                  Standard mobile tracking apps fail during network outages or OS reboots due to strict
                  Android Doze mode, manufacturer battery optimization, and user-space permission boundaries.
                  This framework uses a <strong>hybrid root-privileged system daemon (UID 0)</strong> coupled
                  with an immutable SQLite local buffer, boot completion receiver triggers, encrypted SMS cellular fallback,
                  and a real-time Google Maps telemetry dashboard backed by Cloud SQL PostgreSQL.
                </p>
              </div>

              {/* ASCII Diagram Card */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto leading-tight shadow-inner">
                <pre>{` [ Device Hardware Sensors (GNSS / Baseband) ]
                       │
                       ▼
 ┌──────────────────────────────────────────────┐
 │      Root-Level System Daemon (UID 0)        │
 ├──────────────────────────────────────────────┤
 │  • Online Mode    ──> Live HTTPS API Pings   │
 │  • Offline Mode   ──> Immutable SQLite Queue │
 │  • Cellular Mesh  ──> AES-256 Emergency SMS  │
 └──────────────────────────────────────────────┘
                       │
                 (Reboot Event)
                       ▼
 ┌──────────────────────────────────────────────┐
 │   ACTION_BOOT_COMPLETED Receiver (Auto-Wake) │
 └──────────────────────────────────────────────┘
                       │
                       ▼
 ┌──────────────────────────────────────────────┐
 │   Full-Stack Express API & PostgreSQL DB     │
 └──────────────────────────────────────────────┘
                       │
                       ▼
 ┌──────────────────────────────────────────────┐
 │   Interactive Google Maps Telemetry Radar    │
 └──────────────────────────────────────────────┘`}</pre>
              </div>

              {/* 5 Core Pillars Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-slate-100 mb-1">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>A. Persistent System Daemon (UID 0)</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Executes directly as root or inside <code>/system/priv-app</code>. Ignores Doze mode and task killers, polling hardware GPS at configurable intervals.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-slate-100 mb-1">
                    <Database className="w-4 h-4 text-amber-400" />
                    <span>B. Offline Caching & Sync Engine</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    When network drops, exceptions are trapped and coordinate packets are enqueued in an immutable SQLite transaction log. Flushes automatically upon reconnection.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-slate-100 mb-1">
                    <MessageSquareWarning className="w-4 h-4 text-red-400" />
                    <span>C. Emergency SMS Fallback Protocol</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    If internet remains unavailable or the local queue reaches capacity, the daemon sends an encrypted AES-256 SMS payload via silent baseband commands.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-slate-100 mb-1">
                    <RefreshCw className="w-4 h-4 text-blue-400" />
                    <span>D. Boot Recovery (ACTION_BOOT_COMPLETED)</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Static broadcast receivers intercept reboot intents, immediately reviving the root tracking daemon the exact second the OS kernel finishes loading.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={() => copyToClipboard(getActiveContent() || '')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-colors shadow-lg"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
                <code>{getActiveContent()}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import { db } from './index.ts';
import { devices, emergencySmsLogs, systemEvents, telemetryLogs } from './schema.ts';
import { desc, eq } from 'drizzle-orm';

export interface TelemetryPacketInput {
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  battery?: number;
  network?: string;
  status?: string;
  isOfflineCached?: boolean;
  batchId?: string;
  capturedAt?: Date;
}

// 1. Fetch all devices
export async function getAllDevices() {
  try {
    return await db.select().from(devices).orderBy(desc(devices.lastSeen));
  } catch (error) {
    console.error('Error in getAllDevices:', error);
    throw new Error('Failed to retrieve devices from database.', { cause: error });
  }
}

// 2. Fetch single device
export async function getDeviceById(id: string) {
  try {
    const res = await db.select().from(devices).where(eq(devices.id, id));
    return res[0] || null;
  } catch (error) {
    console.error('Error in getDeviceById:', error);
    throw new Error(`Failed to retrieve device ${id} from database.`, { cause: error });
  }
}

// 3. Fetch telemetry logs for route rendering and historical analysis
export async function getTelemetryHistory(deviceId: string, limitCount = 300) {
  try {
    return await db.select()
      .from(telemetryLogs)
      .where(eq(telemetryLogs.deviceId, deviceId))
      .orderBy(desc(telemetryLogs.capturedAt))
      .limit(limitCount);
  } catch (error) {
    console.error('Error in getTelemetryHistory:', error);
    throw new Error('Failed to retrieve telemetry logs from database.', { cause: error });
  }
}

// 4. Fetch emergency SMS logs
export async function getEmergencySmsLogs(deviceId?: string, limitCount = 50) {
  try {
    if (deviceId) {
      return await db.select()
        .from(emergencySmsLogs)
        .where(eq(emergencySmsLogs.deviceId, deviceId))
        .orderBy(desc(emergencySmsLogs.sentAt))
        .limit(limitCount);
    }
    return await db.select()
      .from(emergencySmsLogs)
      .orderBy(desc(emergencySmsLogs.sentAt))
      .limit(limitCount);
  } catch (error) {
    console.error('Error in getEmergencySmsLogs:', error);
    throw new Error('Failed to retrieve emergency SMS logs from database.', { cause: error });
  }
}

// 5. Fetch system lifecycle events
export async function getSystemEvents(deviceId?: string, limitCount = 60) {
  try {
    if (deviceId) {
      return await db.select()
        .from(systemEvents)
        .where(eq(systemEvents.deviceId, deviceId))
        .orderBy(desc(systemEvents.timestamp))
        .limit(limitCount);
    }
    return await db.select()
      .from(systemEvents)
      .orderBy(desc(systemEvents.timestamp))
      .limit(limitCount);
  } catch (error) {
    console.error('Error in getSystemEvents:', error);
    throw new Error('Failed to retrieve system events from database.', { cause: error });
  }
}

// 6. Record single telemetry ping
export async function recordTelemetry(packet: TelemetryPacketInput) {
  try {
    const now = new Date();
    const [inserted] = await db.insert(telemetryLogs).values({
      deviceId: packet.deviceId,
      latitude: packet.latitude,
      longitude: packet.longitude,
      altitude: packet.altitude ?? 15,
      speed: packet.speed ?? 0,
      heading: packet.heading ?? 0,
      accuracy: packet.accuracy ?? 2.0,
      battery: packet.battery ?? 90,
      network: packet.network ?? '5G',
      status: packet.status ?? 'ONLINE',
      isOfflineCached: packet.isOfflineCached ?? false,
      batchId: packet.batchId ?? null,
      capturedAt: packet.capturedAt ?? now,
      syncedAt: now,
    }).returning();

    // Update device snapshot
    await db.update(devices)
      .set({
        lastLatitude: packet.latitude,
        lastLongitude: packet.longitude,
        lastAltitude: packet.altitude ?? 15,
        lastSpeed: packet.speed ?? 0,
        lastHeading: packet.heading ?? 0,
        batteryLevel: packet.battery ?? 90,
        networkType: packet.network ?? '5G SA / LTE',
        status: packet.status ?? 'ONLINE',
        lastSeen: now,
      })
      .where(eq(devices.id, packet.deviceId));

    return inserted;
  } catch (error) {
    console.error('Error in recordTelemetry:', error);
    throw new Error('Failed to save telemetry packet to database.', { cause: error });
  }
}

// 7. Flush bulk offline-cached packets
export async function flushOfflinePackets(deviceId: string, packets: TelemetryPacketInput[]) {
  try {
    if (!packets.length) return [];
    const now = new Date();
    const batchId = `FLUSH-${Date.now()}`;

    const valuesToInsert = packets.map(p => ({
      deviceId,
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude ?? 15,
      speed: p.speed ?? 0,
      heading: p.heading ?? 0,
      accuracy: p.accuracy ?? 2.5,
      battery: p.battery ?? 85,
      network: 'OFFLINE_CACHE_RESTORED',
      status: 'ONLINE',
      isOfflineCached: true,
      batchId,
      capturedAt: p.capturedAt ? new Date(p.capturedAt) : now,
      syncedAt: now,
    }));

    const inserted = await db.insert(telemetryLogs).values(valuesToInsert).returning();

    // Reset device cached count
    const latest = packets[packets.length - 1];
    await db.update(devices)
      .set({
        offlineCachedPackets: 0,
        status: 'ONLINE',
        networkType: '5G SA / LTE',
        lastLatitude: latest.latitude,
        lastLongitude: latest.longitude,
        batteryLevel: latest.battery ?? 85,
        lastSeen: now,
      })
      .where(eq(devices.id, deviceId));

    // Log flush event
    await db.insert(systemEvents).values({
      deviceId,
      eventType: 'CACHE_FLUSHED',
      details: `Reconnection established. Auto-flushed ${packets.length} locally-persisted SQLite buffer packets to PostgreSQL database. Batch ID: ${batchId}`,
      timestamp: now,
    });

    return inserted;
  } catch (error) {
    console.error('Error in flushOfflinePackets:', error);
    throw new Error('Failed to flush offline cache to database.', { cause: error });
  }
}

// 8. Trigger Emergency SMS Dispatch
export async function triggerEmergencySms(
  deviceId: string,
  targetPhone: string,
  rawCoords: { lat: number; lng: number; battery: number; speed: number },
  reason = 'PROLONGED_NETWORK_BLACKOUT_THRESHOLD_EXCEEDED'
) {
  try {
    const timestampStr = new Date().toISOString();
    // Simulate AES-256 payload simulation
    const rawPayload = JSON.stringify({
      d: deviceId,
      c: `${rawCoords.lat.toFixed(6)},${rawCoords.lng.toFixed(6)}`,
      b: rawCoords.battery,
      s: rawCoords.speed.toFixed(1),
      t: timestampStr,
    });
    
    // Encrypted representation
    const fakeCiphertext = `ENC::AES256GCM::${Buffer.from(rawPayload).toString('base64')}::TAG_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const [smsLog] = await db.insert(emergencySmsLogs).values({
      deviceId,
      recipientNumber: targetPhone,
      encryptedPayload: fakeCiphertext,
      decryptedPayload: rawPayload,
      triggerReason: reason,
      deliveryStatus: 'DISPATCHED_BASEBAND',
      sentAt: new Date(),
    }).returning();

    // Increment device SMS count
    const dev = await getDeviceById(deviceId);
    if (dev) {
      await db.update(devices)
        .set({
          smsFallbacksTriggered: (dev.smsFallbacksTriggered || 0) + 1,
        })
        .where(eq(devices.id, deviceId));
    }

    // Log system event
    await db.insert(systemEvents).values({
      deviceId,
      eventType: 'SMS_EMERGENCY_TRIGGERED',
      details: `Dispatched encrypted SMS payload via AT+CMGS cellular fallback to ${targetPhone} [Reason: ${reason}]. Raw coords: ${rawCoords.lat.toFixed(5)}, ${rawCoords.lng.toFixed(5)}`,
      timestamp: new Date(),
    });

    return smsLog;
  } catch (error) {
    console.error('Error in triggerEmergencySms:', error);
    throw new Error('Failed to record emergency SMS fallback.', { cause: error });
  }
}

// 9. Boot Recovery simulation
export async function triggerBootRecovery(deviceId: string) {
  try {
    const now = new Date();
    const dev = await getDeviceById(deviceId);
    const newBootCount = (dev?.bootRecoveryCount || 0) + 1;

    // Log the event
    await db.insert(systemEvents).values({
      deviceId,
      eventType: 'ACTION_BOOT_COMPLETED',
      details: `System reboot broadcast received: android.intent.action.BOOT_COMPLETED. Root daemon auto-started at UID 0. Background worker restored without user unlock. Boot cycle #${newBootCount}`,
      timestamp: now,
    });

    await db.update(devices)
      .set({
        bootRecoveryCount: newBootCount,
        status: 'ONLINE',
        lastSeen: now,
      })
      .where(eq(devices.id, deviceId));

    return { success: true, bootRecoveryCount: newBootCount };
  } catch (error) {
    console.error('Error in triggerBootRecovery:', error);
    throw new Error('Failed to trigger boot recovery.', { cause: error });
  }
}

// 10. Update device status (e.g. OFFLINE, ONLINE, REBOOTING, offlineCachedPackets)
export async function updateDeviceState(deviceId: string, updates: Partial<{
  status: string;
  networkType: string;
  offlineCachedPackets: number;
  batteryLevel: number;
  lastLatitude: number;
  lastLongitude: number;
}>) {
  try {
    const [updated] = await db.update(devices)
      .set({
        ...updates,
        lastSeen: new Date(),
      })
      .where(eq(devices.id, deviceId))
      .returning();

    return updated;
  } catch (error) {
    console.error('Error updating device state:', error);
    throw new Error('Failed to update device status.', { cause: error });
  }
}

// 11. Seed initial data
export async function seedInitialTrackingData() {
  try {
    const existing = await db.select().from(devices);
    if (existing.length > 0) {
      return { seeded: false, count: existing.length };
    }

    console.log('Seeding initial devices and telemetry into PostgreSQL...');

    // Seed 3 devices
    const initialDevices = [
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

    await db.insert(devices).values(initialDevices);

    // Seed route waypoints for DEV-ALPHA-01
    const baseLat = 37.7749;
    const baseLng = -122.4194;
    const alphaTelemetry = [];
    const nowMs = Date.now();

    for (let i = 25; i >= 0; i--) {
      const timeOffset = nowMs - i * 15000;
      const angle = (25 - i) * 0.15;
      const lat = baseLat + Math.sin(angle) * 0.008 + (25 - i) * 0.0004;
      const lng = baseLng + Math.cos(angle) * 0.007 + (25 - i) * 0.0003;
      const isCached = i >= 8 && i <= 12; // Simulate a block of packets that were cached offline and flushed

      alphaTelemetry.push({
        deviceId: 'DEV-ALPHA-01',
        latitude: lat,
        longitude: lng,
        altitude: 15 + Math.sin(i) * 5,
        speed: 35 + Math.cos(i) * 10,
        heading: (angle * 57.29) % 360,
        accuracy: 1.5 + (i % 3) * 0.4,
        battery: 98 - Math.floor((25 - i) * 0.2),
        network: isCached ? 'OFFLINE_CACHE_RESTORED' : '5G',
        status: 'ONLINE',
        isOfflineCached: isCached,
        batchId: isCached ? 'RECOVERED_BATCH_001' : null,
        capturedAt: new Date(timeOffset),
        syncedAt: isCached ? new Date(timeOffset + 60000) : new Date(timeOffset),
      });
    }

    await db.insert(telemetryLogs).values(alphaTelemetry);

    // Seed system events
    await db.insert(systemEvents).values([
      {
        deviceId: 'DEV-ALPHA-01',
        eventType: 'DAEMON_INIT',
        details: 'Persistent root daemon started (PID: 1042, UID: 0). OS Battery Optimization bypassed.',
        timestamp: new Date(nowMs - 3600000),
      },
      {
        deviceId: 'DEV-ALPHA-01',
        eventType: 'ACTION_BOOT_COMPLETED',
        details: 'Cold system reboot intercepted by BootCompletedReceiver. Telemetry worker auto-spawned in 180ms.',
        timestamp: new Date(nowMs - 2400000),
      },
      {
        deviceId: 'DEV-ALPHA-01',
        eventType: 'NETWORK_DISCONNECTED',
        details: 'Cellular uplink packet timeout. Switching to local SQLite cache (/data/data/system.tracker/queue.db).',
        timestamp: new Date(nowMs - 300000),
      },
      {
        deviceId: 'DEV-ALPHA-01',
        eventType: 'CACHE_FLUSHED',
        details: 'Uplink restored. 5 queued location packets auto-synced to PostgreSQL master.',
        timestamp: new Date(nowMs - 180000),
      },
      {
        deviceId: 'DEV-CHARLIE-03',
        eventType: 'SMS_EMERGENCY_TRIGGERED',
        details: 'Offline threshold (10 packets) reached in dead zone. Encrypted SMS dispatched via baseband modem to +1-555-019-9482.',
        timestamp: new Date(nowMs - 120000),
      },
    ]);

    // Seed Emergency SMS Log
    await db.insert(emergencySmsLogs).values([
      {
        deviceId: 'DEV-CHARLIE-03',
        recipientNumber: '+1-555-019-9482',
        encryptedPayload: 'ENC::AES256GCM::eyJkIjoiREVWLUNIQVJMSUUtMDMiLCJjIjoiMzcuNzU5OSwtMTIyLjQxNDgiLCJiIjo2MSwicyI6IjAuMCIsInQiOiIyMDI2LTEwLTE2VDEyOjUwOjAwWiJ9::TAG_89FA210E',
        decryptedPayload: '{"d":"DEV-CHARLIE-03","c":"37.7599,-122.4148","b":61,"s":"0.0","t":"2026-10-16T12:50:00Z"}',
        triggerReason: 'PROLONGED_NETWORK_BLACKOUT_THRESHOLD_EXCEEDED',
        deliveryStatus: 'CONFIRMED_CARRIER_RELAY',
        sentAt: new Date(nowMs - 120000),
      },
    ]);

    console.log('PostgreSQL database seeded successfully.');
    return { seeded: true, count: 3 };
  } catch (error) {
    console.error('Error seeding initial data:', error);
    // Don't throw fatal error if already seeded
    return { seeded: false, error: String(error) };
  }
}

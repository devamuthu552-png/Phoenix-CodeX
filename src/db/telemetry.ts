import { db } from './index.ts';
import { devices, telemetryLogs, emergencySmsLogs, systemEvents } from './schema.ts';
import { eq, desc, asc, and, gte, lte } from 'drizzle-orm';

// Fetch all registered devices
export async function getDevices() {
  try {
    return await db.select().from(devices).orderBy(desc(devices.lastSeen));
  } catch (error) {
    console.error('Failed to get devices:', error);
    throw new Error('Database query failed. Please try again.', { cause: error });
  }
}

// Fetch single device
export async function getDeviceById(id: string) {
  try {
    const rows = await db.select().from(devices).where(eq(devices.id, id));
    return rows[0] || null;
  } catch (error) {
    console.error(`Failed to get device ${id}:`, error);
    throw new Error('Database query failed. Please try again.', { cause: error });
  }
}

// Upsert device status and coordinates
export async function upsertDevice(data: {
  id: string;
  name?: string;
  model?: string;
  privilegeLevel?: string;
  status?: string;
  batteryLevel?: number;
  isCharging?: boolean;
  networkType?: string;
  offlineCachedPackets?: number;
  bootRecoveryCount?: number;
  emergencySmsPhone?: string;
  smsFallbacksTriggered?: number;
  lastLatitude?: number;
  lastLongitude?: number;
  lastSpeed?: number;
  lastHeading?: number;
  lastAltitude?: number;
  lastAccuracy?: number;
}) {
  try {
    const existing = await getDeviceById(data.id);
    if (!existing) {
      const created = await db
        .insert(devices)
        .values({
          id: data.id,
          name: data.name || data.id,
          model: data.model || 'Android Root Daemon Target',
          privilegeLevel: data.privilegeLevel || 'UID 0 (Root)',
          status: data.status || 'ONLINE',
          batteryLevel: data.batteryLevel ?? 95,
          isCharging: data.isCharging ?? false,
          networkType: data.networkType || '5G SA / LTE',
          offlineCachedPackets: data.offlineCachedPackets ?? 0,
          bootRecoveryCount: data.bootRecoveryCount ?? 0,
          emergencySmsPhone: data.emergencySmsPhone || '+1-555-019-9482',
          smsFallbacksTriggered: data.smsFallbacksTriggered ?? 0,
          lastLatitude: data.lastLatitude ?? 37.7749,
          lastLongitude: data.lastLongitude ?? -122.4194,
          lastSpeed: data.lastSpeed ?? 0,
          lastHeading: data.lastHeading ?? 0,
          lastAltitude: data.lastAltitude ?? 12,
          lastAccuracy: data.lastAccuracy ?? 2.1,
          lastSeen: new Date(),
        })
        .returning();
      return created[0];
    }

    const updated = await db
      .update(devices)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.model && { model: data.model }),
        ...(data.privilegeLevel && { privilegeLevel: data.privilegeLevel }),
        ...(data.status && { status: data.status }),
        ...(data.batteryLevel !== undefined && { batteryLevel: data.batteryLevel }),
        ...(data.isCharging !== undefined && { isCharging: data.isCharging }),
        ...(data.networkType && { networkType: data.networkType }),
        ...(data.offlineCachedPackets !== undefined && { offlineCachedPackets: data.offlineCachedPackets }),
        ...(data.bootRecoveryCount !== undefined && { bootRecoveryCount: data.bootRecoveryCount }),
        ...(data.emergencySmsPhone && { emergencySmsPhone: data.emergencySmsPhone }),
        ...(data.smsFallbacksTriggered !== undefined && { smsFallbacksTriggered: data.smsFallbacksTriggered }),
        ...(data.lastLatitude !== undefined && { lastLatitude: data.lastLatitude }),
        ...(data.lastLongitude !== undefined && { lastLongitude: data.lastLongitude }),
        ...(data.lastSpeed !== undefined && { lastSpeed: data.lastSpeed }),
        ...(data.lastHeading !== undefined && { lastHeading: data.lastHeading }),
        ...(data.lastAltitude !== undefined && { lastAltitude: data.lastAltitude }),
        ...(data.lastAccuracy !== undefined && { lastAccuracy: data.lastAccuracy }),
        lastSeen: new Date(),
      })
      .where(eq(devices.id, data.id))
      .returning();

    return updated[0];
  } catch (error) {
    console.error('Failed to upsert device:', error);
    throw new Error('Database operation failed. Please try again.', { cause: error });
  }
}

// Ingest single live telemetry packet
export async function recordTelemetry(packet: {
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
  capturedAt?: Date;
}) {
  try {
    const inserted = await db
      .insert(telemetryLogs)
      .values({
        deviceId: packet.deviceId,
        latitude: packet.latitude,
        longitude: packet.longitude,
        altitude: packet.altitude ?? 0,
        speed: packet.speed ?? 0,
        heading: packet.heading ?? 0,
        accuracy: packet.accuracy ?? 2.5,
        battery: packet.battery ?? 100,
        network: packet.network || '5G',
        status: packet.status || 'ONLINE',
        isOfflineCached: packet.isOfflineCached ?? false,
        capturedAt: packet.capturedAt || new Date(),
        syncedAt: new Date(),
      })
      .returning();

    // Update device last coordinate
    await db
      .update(devices)
      .set({
        lastLatitude: packet.latitude,
        lastLongitude: packet.longitude,
        lastSpeed: packet.speed ?? 0,
        lastHeading: packet.heading ?? 0,
        lastAltitude: packet.altitude ?? 0,
        lastAccuracy: packet.accuracy ?? 2.5,
        status: packet.status || 'ONLINE',
        batteryLevel: packet.battery ?? 100,
        networkType: packet.network || '5G',
        lastSeen: new Date(),
      })
      .where(eq(devices.id, packet.deviceId));

    return inserted[0];
  } catch (error) {
    console.error('Failed to record telemetry:', error);
    throw new Error('Database operation failed. Please try again.', { cause: error });
  }
}

// Batch flush offline cached logs (Auto-Flush Queue)
export async function recordBatchTelemetry(
  deviceId: string,
  packets: Array<{
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    battery?: number;
    network?: string;
    capturedAt: string | Date;
  }>
) {
  try {
    if (!packets.length) return [];
    const batchId = `SYNC-BATCH-${Date.now()}`;
    const insertValues = packets.map((p) => ({
      deviceId,
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude ?? 0,
      speed: p.speed ?? 0,
      heading: p.heading ?? 0,
      accuracy: p.accuracy ?? 2.5,
      battery: p.battery ?? 100,
      network: p.network || 'OFFLINE_CACHED',
      status: 'OFFLINE_CACHED',
      isOfflineCached: true,
      batchId,
      capturedAt: new Date(p.capturedAt),
      syncedAt: new Date(),
    }));

    const inserted = await db.insert(telemetryLogs).values(insertValues).returning();

    // Reset offline cache counter on device
    const lastP = packets[packets.length - 1];
    await db
      .update(devices)
      .set({
        offlineCachedPackets: 0,
        status: 'ONLINE',
        lastLatitude: lastP.latitude,
        lastLongitude: lastP.longitude,
        lastSpeed: lastP.speed ?? 0,
        lastHeading: lastP.heading ?? 0,
        lastAltitude: lastP.altitude ?? 0,
        lastSeen: new Date(),
      })
      .where(eq(devices.id, deviceId));

    // Record system event
    await db.insert(systemEvents).values({
      deviceId,
      eventType: 'OFFLINE_CACHE_FLUSHED',
      details: `Flushed batch ${batchId} containing ${packets.length} cached packets from local SQLite/JSON storage to PostgreSQL.`,
    });

    return inserted;
  } catch (error) {
    console.error('Failed to record batch telemetry:', error);
    throw new Error('Database batch operation failed.', { cause: error });
  }
}

// Historical route queries for analysis
export async function getHistoricalRoute(
  deviceId: string,
  limit: number = 300,
  startTime?: Date,
  endTime?: Date
) {
  try {
    let query = db
      .select()
      .from(telemetryLogs)
      .where(eq(telemetryLogs.deviceId, deviceId))
      .orderBy(asc(telemetryLogs.capturedAt))
      .limit(limit);

    if (startTime && endTime) {
      query = db
        .select()
        .from(telemetryLogs)
        .where(
          and(
            eq(telemetryLogs.deviceId, deviceId),
            gte(telemetryLogs.capturedAt, startTime),
            lte(telemetryLogs.capturedAt, endTime)
          )
        )
        .orderBy(asc(telemetryLogs.capturedAt))
        .limit(limit);
    }

    return await query;
  } catch (error) {
    console.error('Failed to fetch historical route:', error);
    throw new Error('Database query failed. Please try again.', { cause: error });
  }
}

// Emergency SMS fallback logger
export async function recordEmergencySms(
  deviceId: string,
  recipientNumber: string,
  encryptedPayload: string,
  decryptedPayload: string,
  triggerReason: string
) {
  try {
    const inserted = await db
      .insert(emergencySmsLogs)
      .values({
        deviceId,
        recipientNumber,
        encryptedPayload,
        decryptedPayload,
        triggerReason,
        deliveryStatus: 'DISPATCHED_BASEBAND',
      })
      .returning();

    // Increment device SMS fallback counter
    const device = await getDeviceById(deviceId);
    if (device) {
      await db
        .update(devices)
        .set({
          smsFallbacksTriggered: (device.smsFallbacksTriggered || 0) + 1,
          status: 'EMERGENCY_SMS',
          lastSeen: new Date(),
        })
        .where(eq(devices.id, deviceId));
    }

    await db.insert(systemEvents).values({
      deviceId,
      eventType: 'EMERGENCY_SMS_DISPATCH',
      details: `Silent emergency SMS dispatched to ${recipientNumber} via root baseband AT command. Trigger: ${triggerReason}`,
    });

    return inserted[0];
  } catch (error) {
    console.error('Failed to record emergency SMS:', error);
    throw new Error('Database operation failed.', { cause: error });
  }
}

export async function getEmergencySmsLogs(deviceId?: string) {
  try {
    if (deviceId) {
      return await db
        .select()
        .from(emergencySmsLogs)
        .where(eq(emergencySmsLogs.deviceId, deviceId))
        .orderBy(desc(emergencySmsLogs.sentAt))
        .limit(50);
    }
    return await db.select().from(emergencySmsLogs).orderBy(desc(emergencySmsLogs.sentAt)).limit(50);
  } catch (error) {
    console.error('Failed to fetch emergency SMS logs:', error);
    throw new Error('Database query failed.', { cause: error });
  }
}

export async function recordSystemEvent(
  deviceId: string,
  eventType: string,
  details: string
) {
  try {
    return await db
      .insert(systemEvents)
      .values({
        deviceId,
        eventType,
        details,
      })
      .returning();
  } catch (error) {
    console.error('Failed to record system event:', error);
    throw new Error('Database operation failed.', { cause: error });
  }
}

export async function getSystemEvents(deviceId?: string) {
  try {
    if (deviceId) {
      return await db
        .select()
        .from(systemEvents)
        .where(eq(systemEvents.deviceId, deviceId))
        .orderBy(desc(systemEvents.timestamp))
        .limit(100);
    }
    return await db.select().from(systemEvents).orderBy(desc(systemEvents.timestamp)).limit(100);
  } catch (error) {
    console.error('Failed to get system events:', error);
    throw new Error('Database query failed.', { cause: error });
  }
}

// Initial seed function if tables are empty
export async function seedInitialDataIfEmpty() {
  try {
    const existing = await db.select().from(devices);
    if (existing.length > 0) return;

    console.log('Seeding initial root daemon devices and telemetry routes...');

    // 1. Pixel 8 Pro - UID 0 Root Daemon
    await db.insert(devices).values({
      id: 'DEV-PX8-ROOT01',
      name: 'Google Pixel 8 Pro (Daemon UID 0)',
      model: 'Pixel 8 Pro / Linux kernel 6.1.75-android14-root',
      privilegeLevel: 'UID 0 (Root)',
      status: 'ONLINE',
      batteryLevel: 94,
      isCharging: false,
      networkType: '5G SA (Band n78 / RSRP -82dBm)',
      offlineCachedPackets: 0,
      bootRecoveryCount: 3,
      emergencySmsPhone: '+1-555-019-9482',
      smsFallbacksTriggered: 1,
      lastLatitude: 37.7892,
      lastLongitude: -122.4014,
      lastSpeed: 28.4,
      lastHeading: 45.2,
      lastAltitude: 18.5,
      lastAccuracy: 1.6,
      lastSeen: new Date(),
    });

    // 2. Samsung Galaxy S24 Ultra - /system/priv-app
    await db.insert(devices).values({
      id: 'DEV-S24-PRIV02',
      name: 'Samsung S24 Ultra (/system/priv-app)',
      model: 'SM-S928B / Knox Bypass / Privileged System Daemon',
      privilegeLevel: '/system/priv-app',
      status: 'CACHING',
      batteryLevel: 68,
      isCharging: true,
      networkType: 'NO_NETWORK (Local SQLite Caching)',
      offlineCachedPackets: 18,
      bootRecoveryCount: 1,
      emergencySmsPhone: '+1-555-014-8821',
      smsFallbacksTriggered: 2,
      lastLatitude: 37.7612,
      lastLongitude: -122.4215,
      lastSpeed: 42.1,
      lastHeading: 182.0,
      lastAltitude: 24.0,
      lastAccuracy: 2.8,
      lastSeen: new Date(),
    });

    // 3. Motorola Defy Tactical
    await db.insert(devices).values({
      id: 'DEV-MOTO-TACTICAL',
      name: 'Motorola Defy Tactical (Field Unit 09)',
      model: 'Defy Satellite / Linux Kernel 5.15-rt-embedded',
      privilegeLevel: 'Kernel Module & UID 0',
      status: 'ONLINE',
      batteryLevel: 87,
      isCharging: false,
      networkType: 'Iridium Satellite / LTE-M',
      offlineCachedPackets: 0,
      bootRecoveryCount: 5,
      emergencySmsPhone: '+1-555-018-3390',
      smsFallbacksTriggered: 0,
      lastLatitude: 37.7989,
      lastLongitude: -122.4662,
      lastSpeed: 14.5,
      lastHeading: 270.5,
      lastAltitude: 85.0,
      lastAccuracy: 1.2,
      lastSeen: new Date(),
    });

    // Seed historical coordinate path for DEV-PX8-ROOT01
    const baseLat = 37.7749;
    const baseLng = -122.4194;
    const mockWaypoints = [
      { lat: 37.7749, lng: -122.4194, speed: 18, heading: 30, alt: 12 },
      { lat: 37.7770, lng: -122.4160, speed: 22, heading: 40, alt: 14 },
      { lat: 37.7801, lng: -122.4120, speed: 29, heading: 42, alt: 15 },
      { lat: 37.7834, lng: -122.4085, speed: 34, heading: 45, alt: 16 },
      { lat: 37.7865, lng: -122.4045, speed: 31, heading: 46, alt: 17 },
      { lat: 37.7892, lng: -122.4014, speed: 28, heading: 45, alt: 18 },
    ];

    const now = Date.now();
    for (let i = 0; i < mockWaypoints.length; i++) {
      const wp = mockWaypoints[i];
      await db.insert(telemetryLogs).values({
        deviceId: 'DEV-PX8-ROOT01',
        latitude: wp.lat,
        longitude: wp.lng,
        altitude: wp.alt,
        speed: wp.speed,
        heading: wp.heading,
        accuracy: 1.6,
        battery: 95 - i,
        network: '5G SA',
        status: 'ONLINE',
        isOfflineCached: false,
        capturedAt: new Date(now - (mockWaypoints.length - i) * 15000),
        syncedAt: new Date(now - (mockWaypoints.length - i) * 15000),
      });
    }

    // Seed initial system events
    await db.insert(systemEvents).values([
      {
        deviceId: 'DEV-PX8-ROOT01',
        eventType: 'DAEMON_SPAWNED_UID0',
        details: 'Root daemon process (PID 1420) spawned at UID 0. Acquired wake_lock "ApexTrackKeepAlive".',
      },
      {
        deviceId: 'DEV-PX8-ROOT01',
        eventType: 'ACTION_BOOT_COMPLETED',
        details: 'BroadcastReceiver caught android.intent.action.BOOT_COMPLETED. Verified UID 0 privileged execution.',
      },
      {
        deviceId: 'DEV-S24-PRIV02',
        eventType: 'NETWORK_DROPPED',
        details: 'Network connection lost (EHOSTUNREACH). Switched to immutable local SQLite buffer queue.',
      },
    ]);

    console.log('Database seeded successfully.');
  } catch (error) {
    console.error('Seed initial data error:', error);
  }
}

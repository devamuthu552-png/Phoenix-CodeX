import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  getAllDevices,
  getDeviceById,
  getTelemetryHistory,
  getEmergencySmsLogs,
  getSystemEvents,
  recordTelemetry,
  flushOfflinePackets,
  triggerEmergencySms,
  triggerBootRecovery,
  updateDeviceState,
  seedInitialTrackingData,
} from './src/db/tracking.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import { db } from './src/db/index.ts';
import { emergencySmsLogs, systemEvents } from './src/db/schema.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Must strictly run on port 3000 in AI Studio Build environment
const PORT = 3000;

// Enable CORS and iframe support for AI Studio Build preview environment
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// In-memory queue buffer simulation for offline devices
// Maps deviceId -> array of buffered packets waiting for connectivity restoration
const simulatedLocalOfflineCache = new Map<string, any[]>();

// Configuration endpoint for frontend
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    googleMapsApiKey: process.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDE7CiU-EOotKn51UepHyXu_HHlmdqvDmk',
    appUrl: process.env.APP_URL || '',
  });
});

// 1. Devices list
app.get('/api/devices', async (_req: Request, res: Response) => {
  try {
    const devicesList = await getAllDevices();
    res.json(devicesList);
  } catch (error: any) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch devices' });
  }
});

// 2. Single device details
app.get('/api/devices/:id', async (req: Request, res: Response) => {
  try {
    const device = await getDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    const cachedPackets = simulatedLocalOfflineCache.get(req.params.id) || [];
    res.json({
      ...device,
      localCacheBufferSize: cachedPackets.length,
      cachedBufferQueue: cachedPackets,
    });
  } catch (error: any) {
    console.error('Error fetching device:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch device' });
  }
});

// 3. Historical telemetry packets for path rendering & playback
app.get(['/api/devices/:id/telemetry', '/api/devices/:id/history'], async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 300;
    const history = await getTelemetryHistory(req.params.id, limit);
    res.json(history);
  } catch (error: any) {
    console.error('Error fetching telemetry history:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch telemetry' });
  }
});

// 4. Record new telemetry packet
app.post('/api/telemetry', async (req: Request, res: Response) => {
  try {
    const { deviceId, latitude, longitude, altitude, speed, heading, accuracy, battery, network, status } = req.body;
    if (!deviceId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing required telemetry fields (deviceId, latitude, longitude)' });
    }

    const device = await getDeviceById(deviceId);
    if (device && (device.status === 'OFFLINE' || device.status === 'CACHING')) {
      // Simulate local SQLite / JSON queuing on device
      const queue = simulatedLocalOfflineCache.get(deviceId) || [];
      const cachedPacket = {
        deviceId,
        latitude,
        longitude,
        altitude: altitude ?? 15,
        speed: speed ?? 0,
        heading: heading ?? 0,
        accuracy: accuracy ?? 2.0,
        battery: battery ?? Math.max(1, (device.batteryLevel || 100) - 1),
        network: 'LOCAL_SQLITE_BUFFER',
        status: 'OFFLINE_QUEUED',
        isOfflineCached: true,
        capturedAt: new Date(),
      };
      queue.push(cachedPacket);
      simulatedLocalOfflineCache.set(deviceId, queue);

      // Update device offline packet counter in DB
      await updateDeviceState(deviceId, {
        offlineCachedPackets: queue.length,
        batteryLevel: Math.max(1, (device.batteryLevel || 100) - 1),
        lastLatitude: latitude,
        lastLongitude: longitude,
      });

      return res.json({
        cachedLocally: true,
        offlinePacketsCount: queue.length,
        message: 'Network offline. Packet saved to local immutable SQLite cache file.',
        log: cachedPacket,
        ...cachedPacket,
      });
    }

    const saved = await recordTelemetry({
      deviceId,
      latitude,
      longitude,
      altitude,
      speed,
      heading,
      accuracy,
      battery,
      network: network || '5G SA / LTE',
      status: status || 'ONLINE',
      isOfflineCached: false,
    });

    res.json({
      success: true,
      log: saved,
      ...saved,
    });
  } catch (error: any) {
    console.error('Error recording telemetry:', error);
    res.status(500).json({ error: error.message || 'Failed to record telemetry' });
  }
});

// Patch device status
app.patch('/api/devices/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, networkType, offlineCachedPackets } = req.body;
    const updated = await updateDeviceState(req.params.id, {
      status,
      networkType,
      offlineCachedPackets,
    });
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating device status:', error);
    res.status(500).json({ error: error.message || 'Failed to update device status' });
  }
});

// Batch sync offline packets
app.post(['/api/telemetry/sync-batch', '/api/telemetry/flush'], async (req: Request, res: Response) => {
  try {
    const { deviceId, packets } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'Missing deviceId' });
    }

    const packetsToFlush = packets || simulatedLocalOfflineCache.get(deviceId) || [];
    if (!packetsToFlush.length) {
      return res.json({ count: 0, flushedCount: 0, message: 'No packets to flush' });
    }

    const inserted = await flushOfflinePackets(deviceId, packetsToFlush);
    simulatedLocalOfflineCache.delete(deviceId);

    res.json({
      success: true,
      count: inserted.length,
      flushedCount: inserted.length,
      packets: inserted,
    });
  } catch (error: any) {
    console.error('Error flushing batch:', error);
    res.status(500).json({ error: error.message || 'Failed to flush batch' });
  }
});

// Boot completed trigger
app.post('/api/devices/:id/boot-completed', async (req: Request, res: Response) => {
  try {
    const result = await triggerBootRecovery(req.params.id);
    res.json(result);
  } catch (error: any) {
    console.error('Error in boot completed trigger:', error);
    res.status(500).json({ error: error.message || 'Failed to trigger boot recovery' });
  }
});

// Emergency SMS logs endpoint aliases
app.get(['/api/emergency-sms', '/api/sms-logs'], async (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const logs = await getEmergencySmsLogs(deviceId);
    res.json(logs);
  } catch (error: any) {
    console.error('Error fetching SMS logs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch SMS logs' });
  }
});

// Emergency SMS record endpoint
app.post('/api/emergency-sms', async (req: Request, res: Response) => {
  try {
    const { deviceId, recipientNumber, encryptedPayload, decryptedPayload, triggerReason } = req.body;
    const [smsLog] = await db.insert(emergencySmsLogs).values({
      deviceId,
      recipientNumber: recipientNumber || '+1-555-019-9482',
      encryptedPayload,
      decryptedPayload,
      triggerReason: triggerReason || 'EMERGENCY_FALLBACK',
      deliveryStatus: 'DISPATCHED_BASEBAND',
      sentAt: new Date(),
    }).returning();

    // Log system event
    await db.insert(systemEvents).values({
      deviceId,
      eventType: 'SMS_EMERGENCY_TRIGGERED',
      details: `Emergency SMS fallback dispatched to ${recipientNumber}: ${triggerReason}`,
      timestamp: new Date(),
    });

    res.json(smsLog);
  } catch (error: any) {
    console.error('Error recording emergency SMS:', error);
    res.status(500).json({ error: error.message || 'Failed to record emergency SMS' });
  }
});

// Device events endpoint aliases
app.get(['/api/devices/:id/events', '/api/events'], async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id || (req.query.deviceId as string | undefined);
    const events = await getSystemEvents(deviceId);
    res.json(events);
  } catch (error: any) {
    console.error('Error fetching system events:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch events' });
  }
});

// 5. Reconnect & Flush local offline cache
app.post('/api/telemetry/flush', async (req: Request, res: Response) => {
  try {
    const { deviceId, packets: customPackets } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'Missing deviceId' });
    }

    const packetsToFlush = customPackets || simulatedLocalOfflineCache.get(deviceId) || [];
    if (packetsToFlush.length === 0) {
      return res.json({ flushedCount: 0, message: 'No cached packets to flush' });
    }

    const inserted = await flushOfflinePackets(deviceId, packetsToFlush);
    // Clear in-memory queue
    simulatedLocalOfflineCache.delete(deviceId);

    res.json({
      success: true,
      flushedCount: inserted.length,
      packets: inserted,
    });
  } catch (error: any) {
    console.error('Error flushing offline packets:', error);
    res.status(500).json({ error: error.message || 'Failed to flush cache' });
  }
});

// 6. Interactive State & Simulation Controller
app.post('/api/devices/:id/simulate', async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const { action, params } = req.body;
    const device = await getDeviceById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (action === 'NETWORK_DROP') {
      // Simulate network outage
      await updateDeviceState(deviceId, {
        status: 'OFFLINE',
        networkType: 'NO_CARRIER (Cellular Disconnect)',
      });

      return res.json({
        success: true,
        action: 'NETWORK_DROP',
        status: 'OFFLINE',
        message: 'Cellular & Wi-Fi uplink terminated. Daemon entering local SQLite caching mode.',
      });
    }

    if (action === 'NETWORK_RESTORE') {
      // Restore network and auto-flush
      const queued = simulatedLocalOfflineCache.get(deviceId) || [];
      let flushedCount = 0;
      if (queued.length > 0) {
        await flushOfflinePackets(deviceId, queued);
        simulatedLocalOfflineCache.delete(deviceId);
        flushedCount = queued.length;
      } else {
        await updateDeviceState(deviceId, {
          status: 'ONLINE',
          networkType: '5G SA / LTE',
          offlineCachedPackets: 0,
        });
      }

      return res.json({
        success: true,
        action: 'NETWORK_RESTORE',
        status: 'ONLINE',
        flushedCount,
        message: `Network restored. Auto-flushed ${flushedCount} cached packets to PostgreSQL master.`,
      });
    }

    if (action === 'DISPATCH_EMERGENCY_SMS') {
      const targetPhone = params?.targetPhone || device.emergencySmsPhone || '+1-555-019-9482';
      const reason = params?.reason || 'MANUAL_PANIC_OR_PERSISTENT_OUTAGE';
      const smsLog = await triggerEmergencySms(
        deviceId,
        targetPhone,
        {
          lat: device.lastLatitude,
          lng: device.lastLongitude,
          battery: device.batteryLevel,
          speed: device.lastSpeed || 0,
        },
        reason
      );

      return res.json({
        success: true,
        action: 'DISPATCH_EMERGENCY_SMS',
        smsLog,
        message: `Silent encrypted SMS payload dispatched to ${targetPhone} via root AT command fallback.`,
      });
    }

    if (action === 'SIMULATE_BOOT_REBOOT') {
      // Set to REBOOTING first
      await updateDeviceState(deviceId, {
        status: 'REBOOTING',
        networkType: 'RADIO_POWERING_OFF',
      });

      // Execute boot recovery after brief delay
      setTimeout(async () => {
        try {
          await triggerBootRecovery(deviceId);
        } catch (err) {
          console.error('Async boot recovery error:', err);
        }
      }, 2500);

      return res.json({
        success: true,
        action: 'SIMULATE_BOOT_REBOOT',
        status: 'REBOOTING',
        message: 'Device kernel reboot initiated. ACTION_BOOT_COMPLETED broadcast receiver armed.',
      });
    }

    if (action === 'STEP_ROUTE') {
      // Simulate real-time GPS step
      const currentLat = device.lastLatitude;
      const currentLng = device.lastLongitude;
      const currentSpeed = device.lastSpeed || 30;
      const heading = (Number(device.lastHeading) + (Math.random() * 20 - 10) + 360) % 360;
      const headingRad = (heading * Math.PI) / 180;
      
      const speedKmh = Math.max(15, Math.min(85, currentSpeed + (Math.random() * 6 - 3)));
      const distanceDeg = (speedKmh / 3600 / 111) * 5; // Distance in 5 seconds
      const newLat = currentLat + Math.cos(headingRad) * distanceDeg;
      const newLng = currentLng + Math.sin(headingRad) * distanceDeg;
      const newBattery = Math.max(5, device.batteryLevel - (Math.random() > 0.8 ? 1 : 0));

      if (device.status === 'OFFLINE') {
        // Enqueue into offline buffer
        const queue = simulatedLocalOfflineCache.get(deviceId) || [];
        const packet = {
          deviceId,
          latitude: newLat,
          longitude: newLng,
          altitude: 16 + Math.random() * 4,
          speed: speedKmh,
          heading,
          accuracy: 1.8,
          battery: newBattery,
          network: 'SQLITE_BUFFERED_PACKET',
          status: 'OFFLINE_QUEUED',
          isOfflineCached: true,
          capturedAt: new Date(),
        };
        queue.push(packet);
        simulatedLocalOfflineCache.set(deviceId, queue);

        await updateDeviceState(deviceId, {
          offlineCachedPackets: queue.length,
          batteryLevel: newBattery,
          lastLatitude: newLat,
          lastLongitude: newLng,
        });

        // Check if offline threshold exceeded for auto SMS
        let smsDispatched = null;
        if (queue.length === 5 || queue.length === 10) {
          smsDispatched = await triggerEmergencySms(
            deviceId,
            device.emergencySmsPhone,
            { lat: newLat, lng: newLng, battery: newBattery, speed: speedKmh },
            `OFFLINE_BUFFER_LIMIT_REACHED_${queue.length}_PACKETS`
          );
        }

        return res.json({
          success: true,
          action: 'STEP_ROUTE',
          cachedLocally: true,
          offlineCount: queue.length,
          smsDispatched,
          packet,
        });
      } else {
        // Record live packet
        const saved = await recordTelemetry({
          deviceId,
          latitude: newLat,
          longitude: newLng,
          altitude: 16 + Math.random() * 4,
          speed: speedKmh,
          heading,
          accuracy: 1.8,
          battery: newBattery,
          network: device.networkType || '5G SA / LTE',
          status: 'ONLINE',
          isOfflineCached: false,
        });

        return res.json({
          success: true,
          action: 'STEP_ROUTE',
          saved,
        });
      }
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('Error during simulation action:', error);
    res.status(500).json({ error: error.message || 'Simulation execution failed' });
  }
});

// 7. Emergency SMS logs
app.get('/api/sms-logs', async (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const logs = await getEmergencySmsLogs(deviceId);
    res.json(logs);
  } catch (error: any) {
    console.error('Error fetching SMS logs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch SMS logs' });
  }
});

// 8. System lifecycle events
app.get('/api/events', async (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const events = await getSystemEvents(deviceId);
    res.json(events);
  } catch (error: any) {
    console.error('Error fetching system events:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch events' });
  }
});

// 9. Auth Profile Sync (Cloud SQL integration requirement)
app.post('/api/auth/sync', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { uid, email, displayName, photoUrl } = req.body;
    const targetUid = req.user?.uid || uid;
    const targetEmail = req.user?.email || email;

    if (!targetUid || !targetEmail) {
      return res.status(400).json({ error: 'Missing user identification data' });
    }

    const userRecord = await getOrCreateUser(targetUid, targetEmail, displayName, photoUrl);
    res.json({ success: true, user: userRecord });
  } catch (error: any) {
    console.error('Error in /api/auth/sync:', error);
    res.status(500).json({ error: error.message || 'Failed to sync user' });
  }
});

// Seed data on initial server boot
seedInitialTrackingData().catch((err) => {
  console.warn('Initial data seeding notice:', err.message);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tracking Telemetry & Google Maps Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

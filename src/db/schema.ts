import { boolean, doublePrecision, integer, pgTable, real, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Administrative / Operator Users (Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Autonomous Root Devices
export const devices = pgTable('devices', {
  id: text('id').primaryKey(), // e.g. "DEV-01", "DEV-02"
  userId: text('user_id'),
  name: text('name').notNull(),
  model: text('model').notNull(),
  privilegeLevel: text('privilege_level').notNull().default('UID 0 (Root)'),
  status: text('status').notNull().default('ONLINE'), // ONLINE, OFFLINE, REBOOTING
  batteryLevel: integer('battery_level').notNull().default(92),
  isCharging: boolean('is_charging').notNull().default(false),
  networkType: text('network_type').notNull().default('5G SA / LTE'),
  offlineCachedPackets: integer('offline_cached_packets').notNull().default(0),
  bootRecoveryCount: integer('boot_recovery_count').notNull().default(0),
  emergencySmsPhone: text('emergency_sms_phone').notNull().default('+1-555-019-9482'),
  smsFallbacksTriggered: integer('sms_fallbacks_triggered').notNull().default(0),
  encryptionKeyId: text('encryption_key_id').notNull().default('AES-256-GCM::KEY-SEC-4096'),
  lastLatitude: doublePrecision('last_latitude').notNull().default(37.7749),
  lastLongitude: doublePrecision('last_longitude').notNull().default(-122.4194),
  lastSpeed: real('last_speed').default(0),
  lastHeading: real('last_heading').default(0),
  lastAltitude: real('last_altitude').default(15),
  lastAccuracy: real('last_accuracy').default(2.1),
  lastSeen: timestamp('last_seen').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Telemetry Log Packets
export const telemetryLogs = pgTable('telemetry_logs', {
  id: serial('id').primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  altitude: real('altitude').default(0),
  speed: real('speed').default(0),
  heading: real('heading').default(0),
  accuracy: real('accuracy').default(2.5),
  battery: integer('battery').default(100),
  network: text('network').default('5G'),
  status: text('status').default('ONLINE'),
  isOfflineCached: boolean('is_offline_cached').default(false),
  batchId: text('batch_id'),
  capturedAt: timestamp('captured_at').defaultNow(),
  syncedAt: timestamp('synced_at').defaultNow(),
});

// Emergency SMS Fallback Logs
export const emergencySmsLogs = pgTable('emergency_sms_logs', {
  id: serial('id').primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id),
  recipientNumber: text('recipient_number').notNull(),
  encryptedPayload: text('encrypted_payload').notNull(),
  decryptedPayload: text('decrypted_payload').notNull(),
  triggerReason: text('trigger_reason').notNull(),
  deliveryStatus: text('delivery_status').notNull().default('DISPATCHED_BASEBAND'),
  sentAt: timestamp('sent_at').defaultNow(),
});

// System Lifecycle Events (Boot Recovery, Network Drops, Flushes)
export const systemEvents = pgTable('system_events', {
  id: serial('id').primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id),
  eventType: text('event_type').notNull(),
  details: text('details').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

// Relations
export const devicesRelations = relations(devices, ({ many }) => ({
  telemetryLogs: many(telemetryLogs),
  emergencySmsLogs: many(emergencySmsLogs),
  systemEvents: many(systemEvents),
}));

export const telemetryLogsRelations = relations(telemetryLogs, ({ one }) => ({
  device: one(devices, {
    fields: [telemetryLogs.deviceId],
    references: [devices.id],
  }),
}));

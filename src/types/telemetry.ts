export interface Device {
  id: string;
  userId?: string | null;
  name: string;
  model: string;
  privilegeLevel: string;
  status: 'ONLINE' | 'OFFLINE' | 'REBOOTING' | 'CACHING' | 'EMERGENCY_SMS';
  batteryLevel: number;
  isCharging: boolean;
  networkType: string;
  offlineCachedPackets: number;
  bootRecoveryCount: number;
  emergencySmsPhone: string;
  smsFallbacksTriggered: number;
  encryptionKeyId: string;
  lastLatitude: number;
  lastLongitude: number;
  lastSpeed: number;
  lastHeading: number;
  lastAltitude: number;
  lastAccuracy: number;
  lastSeen?: string | Date;
  createdAt?: string | Date;
}

export interface TelemetryPoint {
  id?: number;
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
  batchId?: string | null;
  capturedAt: string | Date;
  syncedAt?: string | Date;
}

export interface EmergencySmsLog {
  id: number;
  deviceId: string;
  recipientNumber: string;
  encryptedPayload: string;
  decryptedPayload: string;
  triggerReason: string;
  deliveryStatus: string;
  sentAt: string | Date;
}

export interface SystemEvent {
  id: number;
  deviceId: string;
  eventType: string;
  details: string;
  timestamp: string | Date;
}

export interface CachedOfflinePacket {
  id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  battery: number;
  network: string;
}

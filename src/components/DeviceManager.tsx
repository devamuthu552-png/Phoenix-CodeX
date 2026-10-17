import React, { useState } from 'react';
import { Device } from '../types/telemetry.ts';
import {
  X,
  Smartphone,
  Plus,
  Shield,
  Battery,
  Wifi,
  Database,
  RefreshCw,
  Check,
} from 'lucide-react';

interface DeviceManagerProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  selectedDevice: Device | null;
  onSelectDevice: (device: Device) => void;
  onRegisterDevice: (deviceData: Partial<Device>) => Promise<void>;
}

export const DeviceManager: React.FC<DeviceManagerProps> = ({
  isOpen,
  onClose,
  devices,
  selectedDevice,
  onSelectDevice,
  onRegisterDevice,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    model: '',
    privilegeLevel: 'UID 0 (Root)',
    emergencySmsPhone: '+1-555-019-9482',
    networkType: '5G SA / LTE',
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.name) return;

    setLoading(true);
    try {
      await onRegisterDevice({
        id: formData.id.toUpperCase().trim(),
        name: formData.name.trim(),
        model: formData.model.trim() || 'Custom Root Daemon Target',
        privilegeLevel: formData.privilegeLevel,
        emergencySmsPhone: formData.emergencySmsPhone,
        networkType: formData.networkType,
        status: 'ONLINE',
        batteryLevel: 98,
        lastLatitude: 37.7749 + (Math.random() - 0.5) * 0.05,
        lastLongitude: -122.4194 + (Math.random() - 0.5) * 0.05,
      });
      setIsAdding(false);
      setFormData({
        id: '',
        name: '',
        model: '',
        privilegeLevel: 'UID 0 (Root)',
        emergencySmsPhone: '+1-555-019-9482',
        networkType: '5G SA / LTE',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Fleet Device Registry (PostgreSQL)
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Manage autonomous root daemons across physical fleet units
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!isAdding ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 font-mono uppercase">
                  Active Units ({devices.length})
                </span>
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Target Device</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {devices.map((device) => {
                  const isSelected = selectedDevice?.id === device.id;

                  return (
                    <div
                      key={device.id}
                      onClick={() => {
                        onSelectDevice(device);
                        onClose();
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-800/80 border-cyan-400 ring-1 ring-cyan-500/50 shadow-lg'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-white">{device.name}</h3>
                          {isSelected && (
                            <span className="flex items-center gap-1 text-[10px] font-bold font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                              <Check className="w-3 h-3" /> ACTIVE RADAR TARGET
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-slate-400">{device.id}</span>
                      </div>

                      <p className="text-xs text-slate-400 font-mono mt-0.5">{device.model}</p>

                      <div className="flex flex-wrap items-center gap-3 mt-3 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Shield className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{device.privilegeLevel}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-300">
                          <Battery className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{device.batteryLevel}%</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-300">
                          <Database className="w-3.5 h-3.5 text-amber-400" />
                          <span>{device.offlineCachedPackets} cached</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-300">
                          <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                          <span>{device.bootRecoveryCount} boots</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-sm text-cyan-400">New Root Daemon Registration</span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Device ID / Target Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DEV-PIXEL9-ROOT"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Device Friendly Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pixel 9 Pro (UID 0 Field Unit)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Hardware / Kernel Specification</label>
                <input
                  type="text"
                  placeholder="e.g. Linux Kernel 6.1-android15 / Qualcomm X75"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Privilege Execution Level</label>
                  <select
                    value={formData.privilegeLevel}
                    onChange={(e) => setFormData({ ...formData, privilegeLevel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="UID 0 (Root)">UID 0 (Root Privileged Daemon)</option>
                    <option value="/system/priv-app">/system/priv-app System App</option>
                    <option value="Kernel Module & UID 0">Kernel Module & UID 0</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Emergency SMS Recipient Phone</label>
                  <input
                    type="text"
                    required
                    placeholder="+1-555-019-9482"
                    value={formData.emergencySmsPhone}
                    onChange={(e) => setFormData({ ...formData, emergencySmsPhone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  {loading ? 'Provisioning Device in PostgreSQL...' : 'Register Device to PostgreSQL'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

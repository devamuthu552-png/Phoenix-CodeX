import React from 'react';
import { X, MessageSquareWarning, ShieldCheck, Lock, Unlock, PhoneCall, Radio, Clock } from 'lucide-react';
import { EmergencySmsLog } from '../types/telemetry.ts';

interface EmergencySmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: EmergencySmsLog[];
  recipientPhone: string;
}

export const EmergencySmsModal: React.FC<EmergencySmsModalProps> = ({
  isOpen,
  onClose,
  logs,
  recipientPhone,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-red-950/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30">
              <MessageSquareWarning className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Emergency SMS Fallback Protocol (Module C)
                <span className="text-[10px] font-mono font-normal bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full border border-red-500/30">
                  CELLULAR BASEBAND
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Encrypted payload dispatch when IP data connection drops
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

        {/* Info Banner */}
        <div className="bg-slate-950/70 p-3 border-b border-slate-800 text-xs text-slate-300 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-cyan-400" />
            <span>Designated Trusted Receiver:</span>
            <span className="font-mono text-cyan-300 font-bold bg-slate-800 px-2 py-0.5 rounded">
              {recipientPhone}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cipher: AES-256-GCM (12B Nonce)</span>
          </div>
        </div>

        {/* SMS Dispatch Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Radio className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-sm font-medium">No emergency SMS transmissions recorded yet.</p>
              <p className="text-xs text-slate-600 mt-1">
                Click &ldquo;Dispatch Emergency SMS&rdquo; in the control dock to simulate a cellular baseband PDU.
              </p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 shadow-lg space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-200">#{log.id}</span>
                    <span className="font-mono text-slate-400">[{log.deviceId}]</span>
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-300 font-mono text-[10px] rounded border border-red-500/30">
                      {log.triggerReason}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-[11px] font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(log.sentAt).toLocaleTimeString()}</span>
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px]">
                      {log.deliveryStatus}
                    </span>
                  </div>
                </div>

                {/* Encrypted Raw Baseband PDU */}
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 mb-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Transmitted Cellular Baseband PDU (Encrypted Base64)</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded font-mono text-[11px] text-amber-300/90 break-all border border-slate-800">
                    {log.encryptedPayload}
                  </div>
                </div>

                {/* Decrypted Payload */}
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 mb-1">
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Decrypted Telemetry Coordinates (Receiver View)</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded font-mono text-[11px] text-emerald-300/90 break-all border border-slate-800">
                    {log.decryptedPayload}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

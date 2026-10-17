import React, { useState, useEffect } from 'react';

export const QuotaWarning: React.FC = () => {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handler);
    };
  }, []);

  if (!quotaExceeded) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm flex items-center justify-center justify-between">
      <div className="flex-1 text-center">
        <span>
          Google Maps Platform quota reached. If you are the app owner, visit{' '}
          <a
            href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold text-amber-950 hover:text-amber-800"
          >
            maps developer site
          </a>{' '}
          for instructions to update your account.
        </span>
      </div>
      <button
        onClick={() => setQuotaExceeded(false)}
        className="text-amber-800 hover:text-amber-950 font-bold ml-4 text-xs px-2 py-0.5 rounded border border-amber-300"
        aria-label="Dismiss quota notice"
      >
        Dismiss
      </button>
    </div>
  );
};

import { useState } from 'react';

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm text-white font-mono bg-slate-700/50 rounded px-3 py-2 overflow-x-auto">
          {value}
        </code>
        <button
          onClick={handleCopy}
          title="Copy to clipboard"
          className="flex-shrink-0 p-2 text-slate-400 hover:text-white transition-colors"
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function SetupCompleteStep({ result, hostingMode }) {
  const openDashboard = () => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal('https://nolongerevil.com/dashboard');
    }
  };

  const sshLabel = result?.sshMode === 'disable'
    ? 'SSH disabled'
    : result?.sshMode === 'password'
    ? 'SSH enabled (password changed)'
    : 'SSH unchanged (default password)';

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-2xl animate-pulse-slow">
              <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white">Setup Complete!</h1>
          <p className="text-xl text-slate-400">Your Nest Thermostat is configured and ready</p>
        </div>

        <div className="card space-y-6">
          {/* Device info */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Device Details</h2>

            {result?.serial && (
              <CopyField label="Serial Number" value={result.serial} />
            )}

            {result?.cloudregisterurl && (
              <CopyField label="Server URL" value={result.cloudregisterurl} />
            )}

            <div className="flex items-center gap-2 pt-1">
              <div className={`w-2 h-2 rounded-full ${
                result?.sshMode === 'disable' ? 'bg-green-400' : 'bg-yellow-400'
              }`} />
              <span className="text-sm text-slate-300">{sshLabel}</span>
            </div>
          </div>

          {/* Next steps */}
          <div className="space-y-3 pt-2 border-t border-slate-700">
            <h2 className="text-lg font-semibold text-white">Next Steps</h2>

            <div className="flex gap-4 p-4 bg-slate-700/50 rounded-lg">
              <div className="flex-shrink-0 w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Re-attach to wall plate</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  The thermostat is booting. Re-attach after 3–5 minutes.
                </p>
              </div>
            </div>

            {hostingMode === 'hosted' && (
              <div className="flex gap-4 p-4 bg-slate-700/50 rounded-lg">
                <div className="flex-shrink-0 w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-1">Create your account</h3>
                  <p className="text-xs text-slate-300 mb-2">
                    Visit the No Longer Evil dashboard to register and link your device.
                  </p>
                  <button onClick={openDashboard} className="btn-primary text-xs px-4 py-1.5">
                    Open Dashboard
                  </button>
                </div>
              </div>
            )}

            {hostingMode === 'selfhosted' && (
              <div className="flex gap-4 p-4 bg-slate-700/50 rounded-lg">
                <div className="flex-shrink-0 w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Check Home Assistant</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Your thermostat will appear in Home Assistant once it connects (within 1–2 minutes).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center">
          <p className="text-slate-400 text-sm">
            Made with ❤️ by{' '}
            <button
              onClick={() => window.electronAPI?.openExternal('https://hackhouse.io')}
              className="text-primary-400 hover:text-primary-300 transition-colors underline"
            >
              Hack House
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SetupCompleteStep;

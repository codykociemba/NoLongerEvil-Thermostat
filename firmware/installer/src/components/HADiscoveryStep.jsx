import { useState, useEffect, useRef } from 'react';

const NLE_PORT = '9543';

function HADiscoveryStep({ onNext, onBack }) {
  const [tab, setTab] = useState('ha'); // 'ha' | 'server'

  // HA tab
  const [haStatus, setHaStatus] = useState('discovering'); // discovering | found | addon_missing | not_found | idle
  const [haIp, setHaIp] = useState('');
  const [haMessage, setHaMessage] = useState('Scanning for Home Assistant...');

  // NLE Server tab
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState(NLE_PORT);

  const cleanupRef = useRef(null);
  const hasDiscovered = useRef(false);

  const runDiscovery = async () => {
    setHaStatus('discovering');
    setHaMessage('Scanning for Home Assistant...');

    const cleanup = window.electronAPI.onDiscoveryProgress(p => setHaMessage(p.message));
    cleanupRef.current = cleanup;

    try {
      const result = await window.electronAPI.discoverHomeAssistant();

      if (result.success) {
        setHaIp(result.haIp);
        if (result.addonFound) {
          setHaStatus('found');
          setHaMessage(`Add-on found at ${result.haIp}`);
        } else {
          setHaStatus('addon_missing');
          setHaMessage(`Home Assistant at ${result.haIp} — NLE add-on not running`);
        }
      } else {
        if (result.error === 'Cancelled') { setHaStatus('idle'); return; }
        setHaStatus('not_found');
        setHaMessage(result.error || 'Home Assistant not found on your network');
      }
    } catch (e) {
      setHaStatus('not_found');
      setHaMessage(e.message);
    } finally {
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    }
  };

  useEffect(() => {
    if (!hasDiscovered.current) {
      hasDiscovered.current = true;
      runDiscovery();
    }
    return () => {
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
      window.electronAPI.cancelDiscovery();
    };
  }, []);

  const handleTabChange = (newTab) => {
    if (newTab === tab) return;
    if (haStatus === 'discovering') {
      window.electronAPI.cancelDiscovery();
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
      setHaStatus('idle');
    }
    setTab(newTab);
  };

  const canContinue = tab === 'ha'
    ? haIp.trim().length > 0
    : serverIp.trim().length > 0 && serverPort.trim().length > 0;

  const handleContinue = () => {
    if (tab === 'ha') {
      onNext(`http://${haIp.trim()}:${NLE_PORT}/entry`);
    } else {
      onNext(`http://${serverIp.trim()}:${serverPort.trim()}/entry`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Server Configuration</h1>
          <p className="text-slate-400">Where should your thermostat send its data?</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => handleTabChange('ha')}
            className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'ha'
                ? 'border-primary-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Home Assistant
          </button>
          <button
            onClick={() => handleTabChange('server')}
            className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'server'
                ? 'border-primary-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            NLE Server
          </button>
        </div>

        <div className="card space-y-5">
          {/* ── Home Assistant tab ── */}
          {tab === 'ha' && (
            <div className="space-y-4">
              {/* Discovery status banner */}
              {haStatus === 'discovering' && (
                <div className="flex items-center gap-3 py-1">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <p className="text-sm text-slate-300">{haMessage}</p>
                </div>
              )}
              {haStatus === 'found' && (
                <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-green-400">{haMessage}</p>
                </div>
              )}
              {haStatus === 'addon_missing' && (
                <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-yellow-400">{haMessage}</p>
                </div>
              )}
              {(haStatus === 'not_found' || haStatus === 'idle') && haMessage && haStatus !== 'idle' && (
                <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-400">{haMessage}</p>
                </div>
              )}

              {/* HA IP input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">Home Assistant IP Address</label>
                  {haStatus !== 'discovering' && (
                    <button
                      onClick={() => { hasDiscovered.current = true; runDiscovery(); }}
                      className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      Auto-detect
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={haIp}
                  onChange={e => setHaIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                />
              </div>

              {haIp.trim() && (
                <p className="text-xs text-slate-500 font-mono">
                  http://{haIp.trim()}:{NLE_PORT}/entry
                </p>
              )}
            </div>
          )}

          {/* ── NLE Server tab ── */}
          {tab === 'server' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Enter the IP address and port of your standalone No Longer Evil server.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Server IP Address</label>
                  <input
                    type="text"
                    value={serverIp}
                    onChange={e => setServerIp(e.target.value)}
                    placeholder="192.168.1.100"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Port</label>
                  <input
                    type="text"
                    value={serverPort}
                    onChange={e => setServerPort(e.target.value)}
                    placeholder={NLE_PORT}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              {serverIp.trim() && serverPort.trim() && (
                <p className="text-xs text-slate-500 font-mono">
                  http://{serverIp.trim()}:{serverPort.trim()}/entry
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button onClick={onBack} className="btn-secondary flex-1">
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="btn-primary flex-1"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default HADiscoveryStep;

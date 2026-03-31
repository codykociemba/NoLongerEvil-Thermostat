import { useState, useEffect, useRef } from 'react';

function NestDiscoveryStep({ onNext, onBack }) {
  const [status, setStatus] = useState('discovering'); // discovering | found | not_found | manual
  const [message, setMessage] = useState('Waiting for Nest to boot...');
  const [devices, setDevices] = useState([]);
  const [manualIp, setManualIp] = useState('');
  const [error, setError] = useState(null);
  const cleanupRef = useRef(null);

  const runDiscovery = async () => {
    setStatus('discovering');
    setMessage('Waiting for Nest to boot and connect to WiFi...');
    setDevices([]);
    setError(null);

    const cleanup = window.electronAPI.onDiscoveryProgress((progress) => {
      setMessage(progress.message);
    });
    cleanupRef.current = cleanup;

    try {
      const result = await window.electronAPI.discoverNest();

      if (result.success && result.devices?.length > 0) {
        setDevices(result.devices);
        setStatus('found');
      } else {
        if (result.error === 'Cancelled') return;
        setStatus('not_found');
        setError(result.error);
      }
    } catch (e) {
      setStatus('not_found');
      setError(e.message);
    } finally {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    }
  };

  useEffect(() => {
    runDiscovery();
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      window.electronAPI.cancelDiscovery();
    };
  }, []);

  const handleManualSubmit = () => {
    const ip = manualIp.trim();
    if (!ip) return;
    onNext(ip);
  };

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Finding Your Nest</h1>
          <p className="text-slate-400">Plug your Nest into its wall mount and power it on</p>
        </div>

        <div className="card space-y-6">
          {/* Instruction */}
          <div className="flex gap-4 p-4 bg-slate-700/50 rounded-lg">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center font-bold text-sm">
              !
            </div>
            <p className="text-sm text-slate-300">
              Remove the Nest from USB and attach it to your wall mount. It will take about
              30–60 seconds to boot and connect to your WiFi network.
            </p>
          </div>

          {/* Discovering */}
          {status === 'discovering' && (
            <div className="flex flex-col items-center py-6 gap-4">
              <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-300 text-center">{message}</p>
            </div>
          )}

          {/* Found — single device */}
          {status === 'found' && devices.length === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <svg className="w-8 h-8 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-white">Nest found</p>
                  <p className="text-sm text-slate-400 font-mono">{devices[0]}</p>
                </div>
              </div>
              <button onClick={() => onNext(devices[0])} className="btn-primary w-full">
                Use this device
              </button>
            </div>
          )}

          {/* Found — multiple devices, let user pick */}
          {status === 'found' && devices.length > 1 && (
            <div className="space-y-3">
              <p className="text-slate-300 text-sm">
                Multiple Nest devices found. Select yours:
              </p>
              {devices.map(ip => (
                <button
                  key={ip}
                  onClick={() => onNext(ip)}
                  className="w-full text-left p-4 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-primary-500 rounded-lg transition-all"
                >
                  <span className="font-mono text-white">{ip}</span>
                </button>
              ))}
            </div>
          )}

          {/* Not found */}
          {status === 'not_found' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-slate-300">
                  {error || 'Could not find Nest on the network. Make sure it is powered on and connected to WiFi.'}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={runDiscovery} className="btn-secondary flex-1">
                  Scan again
                </button>
              </div>
            </div>
          )}

          {/* Manual IP entry — always available */}
          <div className="pt-2 border-t border-slate-700 space-y-3">
            <p className="text-sm text-slate-400">
              Know your Nest's IP address? Enter it directly:
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={manualIp}
                onChange={e => setManualIp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                placeholder="192.168.1.251"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 font-mono"
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualIp.trim()}
                className="btn-primary"
              >
                Use
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={onBack} className="btn-secondary flex-1">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

export default NestDiscoveryStep;

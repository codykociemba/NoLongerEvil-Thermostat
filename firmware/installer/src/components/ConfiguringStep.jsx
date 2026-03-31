import { useState, useEffect, useRef } from 'react';

const STEPS = {
  ssh_connect: 'Connecting via SSH',
  serial: 'Reading device serial',
  url: 'Updating server URL',
  ssh_config: 'Configuring SSH access',
};

// Hosted mode doesn't update URL — show only relevant steps
function getVisibleSteps(cloudregisterurl, sshMode) {
  const steps = ['ssh_connect', 'serial'];
  if (cloudregisterurl) steps.push('url');
  if (sshMode !== 'keep') steps.push('ssh_config');
  return steps;
}

function StepRow({ stepKey, status, message }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
        {status === 'done' && (
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {status === 'active' && (
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        )}
        {status === 'skipped' && (
          <div className="w-2 h-2 rounded-full bg-slate-600" />
        )}
        {status === 'error' && (
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        {status === 'pending' && (
          <div className="w-2 h-2 rounded-full bg-slate-700 border border-slate-600" />
        )}
      </div>
      <div className="flex-1">
        <span className={`text-sm ${
          status === 'done' ? 'text-white' :
          status === 'active' ? 'text-primary-300' :
          status === 'error' ? 'text-red-400' :
          'text-slate-500'
        }`}>
          {message || STEPS[stepKey]}
        </span>
      </div>
    </div>
  );
}

function ConfiguringStep({ nestIp, cloudregisterurl, sshConfig, onSuccess, onBack }) {
  // ssh_connect is always the first step — show it active immediately
  const [stepStatuses, setStepStatuses] = useState({ ssh_connect: 'active' });
  const [stepMessages, setStepMessages] = useState({});
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [running, setRunning] = useState(false);
  const hasStarted = useRef(false);
  const cleanupRef = useRef(null);

  const visibleSteps = getVisibleSteps(cloudregisterurl, sshConfig?.mode);

  const startRun = () => {
    setRunning(true);
    setError(null);
    setStepStatuses({ ssh_connect: 'active' });
    setStepMessages({});
    setDone(false);

    const cleanup = window.electronAPI.onConfigProgress((progress) => {
      if (progress.step && progress.status) {
        setStepStatuses(prev => ({ ...prev, [progress.step]: progress.status }));
        if (progress.message) {
          setStepMessages(prev => ({ ...prev, [progress.step]: progress.message }));
        }
      }
    });
    cleanupRef.current = cleanup;

    window.electronAPI.configureNest({
      nestIp,
      cloudregisterurl: cloudregisterurl || null,
      sshMode: sshConfig?.mode || 'keep',
      newPassword: sshConfig?.mode === 'password' ? sshConfig.password : null,
    }).then(result => {
      if (result.success) {
        setDone(true);
        setTimeout(() => onSuccess({
          serial: result.serial,
          cloudregisterurl: result.cloudregisterurl,
          sshMode: sshConfig?.mode,
        }), 1500);
      } else {
        setError(result.error || 'Configuration failed');
      }
    }).catch(e => {
      setError(e.message || 'Configuration failed');
    }).finally(() => {
      setRunning(false);
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    });
  };

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    startRun();
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Configuring Device</h1>
          <p className="text-slate-400">
            {done ? 'All done!' : `Setting up ${nestIp}...`}
          </p>
        </div>

        <div className="card">
          <div className="divide-y divide-slate-700">
            {visibleSteps.map(stepKey => (
              <StepRow
                key={stepKey}
                stepKey={stepKey}
                status={stepStatuses[stepKey] || 'pending'}
                message={stepMessages[stepKey]}
              />
            ))}
          </div>

          {done && (
            <div className="mt-6 flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-400 font-medium">Configuration complete!</p>
            </div>
          )}

          {error && (
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-red-400">Configuration failed</p>
                  <p className="text-sm text-slate-300 mt-1">{error}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={onBack} className="btn-secondary flex-1">
                  Back
                </button>
                <button
                  onClick={() => { hasStarted.current = false; startRun(); }}
                  className="btn-primary flex-1"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>

        {running && !done && !error && (
          <div className="flex justify-center">
            <button onClick={onBack} className="btn-secondary px-8">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConfiguringStep;

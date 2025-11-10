import { useState, useEffect } from 'react';

function SystemCheck({ onNext, onError, onBack }) {
  const [checking, setChecking] = useState(true);
  const [systemInfo, setSystemInfo] = useState(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    checkSystem();
  }, []);

  const checkSystem = async () => {
    setChecking(true);
    try {
      const result = await window.electronAPI.checkSystem();
      setSystemInfo(result);
      setChecking(false);

      if (result.platform === 'win32' && result.needsWindowsDriver) {
        console.log('Windows driver will be installed during firmware installation when device is in DFU mode');
      }
    } catch (error) {
      onError(error.message || 'Failed to check system requirements');
    }
  };

  const installLibusb = async () => {
    setInstalling(true);
    try {
      const result = await window.electronAPI.installLibusb();
      if (result.success) {
        await checkSystem();
      } else {
        onError(result.error || 'Failed to install libusb');
      }
    } catch (error) {
      onError(error.message || 'Failed to install libusb');
    } finally {
      setInstalling(false);
    }
  };

  const handleContinue = () => {
    onNext(systemInfo);
  };

  const getPlatformName = () => {
    if (!systemInfo) return '';
    const { platform, arch } = systemInfo;
    const platformNames = {
      darwin: 'macOS',
      win32: 'Windows',
      linux: 'Linux'
    };
    return `${platformNames[platform] || platform} (${arch})`;
  };

  const canProceed = systemInfo && systemInfo.ready && !checking;

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">System Check</h1>
          <p className="text-slate-400">
            Verifying your system meets all requirements
          </p>
        </div>

        <div className="card space-y-6">
          {checking ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-300">Checking system...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {systemInfo?.platform === 'win32' && systemInfo?.needsAdmin && !systemInfo?.isAdmin && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex gap-3">
                    <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-red-400">Administrator Privileges Required</h3>
                      <p className="text-sm text-slate-300 font-medium">
                        Please close this application and restart it as Administrator:
                      </p>
                      <ul className="text-sm text-slate-300 space-y-1 ml-4">
                        <li>• Right-click on the application</li>
                        <li>• Select "Run as administrator"</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="font-medium text-white">Operating System</p>
                    <p className="text-sm text-slate-400">{getPlatformName()}</p>
                  </div>
                </div>
                <span className="status-success">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Detected
                </span>
              </div>

              {systemInfo?.needsLibusb && (
                <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="font-medium text-white">libusb Library</p>
                      <p className="text-sm text-slate-400">Required for USB communication</p>
                    </div>
                  </div>
                  {systemInfo?.hasLibusb ? (
                    <span className="status-success">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Installed
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="status-warning">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Missing
                      </span>
                      <button
                        onClick={installLibusb}
                        disabled={installing}
                        className="px-3 py-1 text-sm bg-primary-600 hover:bg-primary-700 rounded-md transition-colors disabled:bg-gray-600"
                      >
                        {installing ? 'Installing...' : 'Install'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {systemInfo?.needsWindowsDriver !== undefined && systemInfo?.platform === 'win32' && (
                <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                    <div>
                      <p className="font-medium text-white">USB Driver (WinUSB)</p>
                      <p className="text-sm text-slate-400">Required for DFU device access</p>
                    </div>
                  </div>
                  {systemInfo?.hasWindowsDriver ? (
                    <span className="status-success">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Installed
                    </span>
                  ) : systemInfo?.isAdmin ? (
                    <span className="status-info">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Will install
                    </span>
                  ) : (
                    <span className="status-warning">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Not Admin
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div>
                    <p className="font-medium text-white">Administrator Access</p>
                    <p className="text-sm text-slate-400">Required for USB device access</p>
                  </div>
                </div>
                {systemInfo?.platform === 'win32' ? (
                  systemInfo?.isAdmin ? (
                    <span className="status-success">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Running as Admin
                    </span>
                  ) : (
                    <span className="status-warning">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Not Admin
                    </span>
                  )
                ) : (
                  <span className="status-info">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Will prompt
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="font-medium text-white">Firmware Files</p>
                    <p className="text-sm text-slate-400">Bootloader and kernel images</p>
                  </div>
                </div>
                {systemInfo?.missingFiles?.length > 0 ? (
                  <span className="status-error">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Missing
                  </span>
                ) : (
                  <span className="status-success">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Ready
                  </span>
                )}
              </div>

              {systemInfo?.missingFiles?.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex gap-3">
                    <svg className="w-6 h-6 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h3 className="font-semibold text-red-400 mb-2">Missing Files</h3>
                      <ul className="text-sm text-slate-300 space-y-1">
                        {systemInfo.missingFiles.map((file, index) => (
                          <li key={index}>• {file}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button onClick={onBack} className="btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!canProceed}
            className="btn-primary"
          >
            Continue to Installation
          </button>
        </div>
      </div>
    </div>
  );
}

export default SystemCheck;

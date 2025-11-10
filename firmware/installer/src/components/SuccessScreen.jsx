import React from 'react';

function SuccessScreen() {
  const openDashboard = () => {
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal('https://nolongerevil.com/dashboard');
    } else {
      window.open('https://nolongerevil.com/dashboard', '_blank');
    }
  };

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

          <h1 className="text-4xl font-bold text-white">
            Installation Complete!
          </h1>
          <p className="text-xl text-slate-400">
            Your Nest Thermostat is now No Longer Evil
          </p>
        </div>

        <div className="card space-y-6">

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Next Steps</h2>

            <div className="space-y-3">
              <div className="flex gap-4 p-4 bg-slate-700/50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Re-attach Nest to back wall plate</h3>
                  <p className="text-sm text-slate-300">
                    Re-attach the Nest to your back wall plate after it's been booted (3-5 minutes)
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-slate-700/50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Create Your Account</h3>
                  <p className="text-sm text-slate-300 mb-2">
                    Visit the No Longer Evil dashboard to register or sign in
                  </p>
                  <button onClick={openDashboard} className="btn-primary text-sm px-4 py-2">
                    Open Dashboard
                  </button>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-slate-700/50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Link Your Device</h3>
                  <p className="text-sm text-slate-300">
                    Follow the instructions on the No Longer Evil dashboard to link your device
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-slate-400 text-sm">
            Made with ❤️ by{' '}
            <button
              onClick={() => {
                if (window.electronAPI && window.electronAPI.openExternal) {
                  window.electronAPI.openExternal('https://hackhouse.io');
                } else {
                  window.open('https://hackhouse.io', '_blank');
                }
              }}
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

export default SuccessScreen;

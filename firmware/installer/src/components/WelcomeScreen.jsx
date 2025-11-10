import React from 'react';

function WelcomeScreen({ onNext }) {
  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-4">

          <p className="text-xl text-slate-400">
            Firmware Installation Wizard
          </p>
        </div>

        <div className="card space-y-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Welcome</h2>
            <p className="text-slate-300 leading-relaxed">
              This installer will flash custom firmware to your Nest Thermostat, giving you complete control over your device.
            </p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="space-y-2">
                <h3 className="font-semibold text-yellow-400">Warning: Experimental Software</h3>
                <p className="text-sm text-slate-300">
                  This software is in the experimental phase. Do not use on thermostats critical for heating or cooling. Flashing may brick your device.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-white">Requirements:</h3>
            <ul className="space-y-2 text-slate-300">
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Nest Learning Thermostat (Gen 1 or Gen 2)</span>
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Micro USB cable</span>
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Device charged to at least 50%</span>
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Administrator/sudo privileges</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-center">
          <button onClick={onNext} className="btn-primary text-lg px-8">
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;

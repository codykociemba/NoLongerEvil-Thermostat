import React from 'react';

function ErrorScreen({ error, onRetry }) {
  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center shadow-2xl">
              <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white">
            Installation Failed
          </h1>
          <p className="text-xl text-slate-400">
            Something went wrong during the installation process
          </p>
        </div>

        <div className="card space-y-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-red-400 mb-2">Error Details</h3>
                <p className="text-sm text-slate-300 font-mono bg-slate-900/50 p-3 rounded">
                  {error || 'An unknown error occurred'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-semibold text-yellow-400 mb-1">Device Safety</h3>
                <p className="text-sm text-slate-300">
                  If your device is not responding after a failed flash, try rebooting it by holding the display for 10-15 seconds.
                  In most cases, the device will return to its previous state and you can try the installation again.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button onClick={onRetry} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErrorScreen;

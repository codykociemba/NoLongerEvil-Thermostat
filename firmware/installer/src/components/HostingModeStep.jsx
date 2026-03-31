import { useState } from 'react';

function HostingModeStep({ onNext, onSkip }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Setup Your Thermostat</h1>
          <p className="text-slate-400">Choose how your thermostat will connect to the internet</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setSelected('hosted')}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
              selected === 'hosted'
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-slate-600 bg-slate-800 hover:border-slate-500'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`mt-1 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                selected === 'hosted' ? 'border-primary-500' : 'border-slate-500'
              }`}>
                {selected === 'hosted' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">Cloud Hosted</h3>
                <p className="text-slate-300 text-sm mt-1">
                  Connect to the hosted cloud service. Easiest setup, your thermostat connects automatically.
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setSelected('selfhosted')}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
              selected === 'selfhosted'
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-slate-600 bg-slate-800 hover:border-slate-500'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`mt-1 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                selected === 'selfhosted' ? 'border-primary-500' : 'border-slate-500'
              }`}>
                {selected === 'selfhosted' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">Self-Hosted</h3>
                <p className="text-slate-300 text-sm mt-1">
                  Connect to your own server. Requires the No Longer Evil
                  server or Home Assistant add-on running on your local network.
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => onNext(selected)}
            disabled={!selected}
            className="btn-primary w-full"
          >
            Continue
          </button>
          <button
            onClick={onSkip}
            className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
          >
            Skip setup — I'll configure this later
          </button>
        </div>
      </div>
    </div>
  );
}

export default HostingModeStep;

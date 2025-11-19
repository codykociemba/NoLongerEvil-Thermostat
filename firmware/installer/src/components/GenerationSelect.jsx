import React, { useState } from 'react';
import nestGen1 from '../assets/nest-gen1.png';
import nestGen2 from '../assets/nest-gen2.png';

function GenerationSelect({ onNext, onBack }) {
  const [selectedGeneration, setSelectedGeneration] = useState(null);

  const handleContinue = () => {
    if (selectedGeneration) {
      onNext(selectedGeneration);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-white">Select Your Nest Generation</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setSelectedGeneration('gen1')}
            className={`card p-6 space-y-4 transition-all ${
              selectedGeneration === 'gen1'
                ? 'ring-4 ring-primary-500 bg-slate-700/50'
                : 'hover:bg-slate-700/30'
            }`}
          >
            <div className="aspect-square rounded-lg overflow-hidden bg-white">
              <img
                src={nestGen1}
                alt="Nest Generation 1"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">Generation 1</h3>
            </div>
            {selectedGeneration === 'gen1' && (
              <div className="flex items-center gap-2 text-primary-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Selected</span>
              </div>
            )}
          </button>

          <button
            onClick={() => setSelectedGeneration('gen2')}
            className={`card p-6 space-y-4 transition-all ${
              selectedGeneration === 'gen2'
                ? 'ring-4 ring-primary-500 bg-slate-700/50'
                : 'hover:bg-slate-700/30'
            }`}
          >
            <div className="aspect-square rounded-lg overflow-hidden bg-white">
              <img
                src={nestGen2}
                alt="Nest Generation 2"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">Generation 2</h3>
            </div>
            {selectedGeneration === 'gen2' && (
              <div className="flex items-center gap-2 text-primary-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Selected</span>
              </div>
            )}
          </button>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-400">Not sure which generation you have?</h3>
              <p className="text-sm text-slate-300">
                Visit our{' '}
                <a
                  href="https://docs.nolongerevil.com/compatibility#how-to-identify-your-nest-thermostat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:text-primary-300 underline"
                >
                  compatibility guide
                </a>
                {' '}to identify your device
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <button onClick={onBack} className="btn-secondary px-6">
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedGeneration}
            className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default GenerationSelect;

import React, { useState } from 'react';
import nestGen1 from '../assets/nest-gen1.png';
import nestGen2 from '../assets/nest-gen2.png';

function GenerationSelect({ onNext, onBack }) {
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [useCustomFirmware, setUseCustomFirmware] = useState(false);
  const [customFiles, setCustomFiles] = useState({
    xload: null,
    uboot: null,
    uimage: null,
    rootfs: null
  });

  const handleFileSelect = async (fileType) => {
    try {
      const result = await window.electronAPI.selectFirmwareFile(fileType);
      if (result.success && result.filePath) {
        setCustomFiles(prev => ({
          ...prev,
          [fileType]: result.filePath
        }));
      }
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  };

  const handleContinue = () => {
    if (selectedGeneration) {
      const config = {
        generation: selectedGeneration,
        customFiles: useCustomFirmware ? customFiles : null
      };
      onNext(config);
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

        {selectedGeneration && (
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Custom Firmware Files</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Optional: Use your own firmware files instead of the bundled ones
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomFirmware}
                  onChange={(e) => setUseCustomFirmware(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {useCustomFirmware && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-300">x-load.bin</label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {customFiles.xload ? customFiles.xload.split('/').pop() : 'No file selected'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleFileSelect('xload')}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
                  >
                    Browse
                  </button>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-300">u-boot.bin</label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {customFiles.uboot ? customFiles.uboot.split('/').pop() : 'No file selected'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleFileSelect('uboot')}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
                  >
                    Browse
                  </button>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-300">uImage</label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {customFiles.uimage ? customFiles.uimage.split('/').pop() : 'No file selected'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleFileSelect('uimage')}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
                  >
                    Browse
                  </button>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-300">RootFS</label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {customFiles.rootfs ? customFiles.rootfs.split('/').pop() : 'No file selected'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleFileSelect('rootfs')}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
                  >
                    Browse
                  </button>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-3">
                  <div className="flex gap-2">
                    <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-xs text-slate-300">
                      Custom firmware files will be used instead of the bundled ones. Make sure your files are compatible with your device.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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

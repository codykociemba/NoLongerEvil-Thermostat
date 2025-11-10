import { useState, useEffect } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import SystemCheck from './components/SystemCheck';
import InstallScreen from './components/InstallScreen';
import SuccessScreen from './components/SuccessScreen';
import ErrorScreen from './components/ErrorScreen';

const SCREENS = {
  WELCOME: 'welcome',
  SYSTEM_CHECK: 'system_check',
  INSTALL: 'install',
  SUCCESS: 'success',
  ERROR: 'error',
};

function App() {
  const [currentScreen, setCurrentScreen] = useState(SCREENS.WELCOME);
  const [systemInfo, setSystemInfo] = useState(null);
  const [error, setError] = useState(null);
  const [platform, setPlatform] = useState(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getPlatformInfo().then(info => {
        console.log('Platform info:', info);
        setPlatform(info.platform);
      });
    }
  }, []);

  const handleNext = (screen, data) => {
    if (data) {
      if (data.error) {
        setError(data.error);
        setCurrentScreen(SCREENS.ERROR);
        return;
      }
      if (screen === SCREENS.SYSTEM_CHECK) {
        setSystemInfo(data);
      }
    }
    setCurrentScreen(screen);
  };

  const handleError = (errorMessage) => {
    setError(errorMessage);
    setCurrentScreen(SCREENS.ERROR);
  };

  const handleRetry = () => {
    setError(null);
    setCurrentScreen(SCREENS.WELCOME);
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Only show custom title bar on macOS (Windows has native title bar) */}
      {platform === 'darwin' && (
        <div className="app-drag w-full h-12 bg-slate-900/50 backdrop-blur-sm border-b border-slate-700/50 flex items-center justify-center px-4">
          <h1 className="text-sm font-semibold text-slate-300">No Longer Evil Thermostat Setup</h1>
        </div>
      )}

      <div className={platform === 'darwin' ? 'h-[calc(100%-3rem)] overflow-auto' : 'h-full overflow-auto'}>
        {currentScreen === SCREENS.WELCOME && (
          <WelcomeScreen onNext={() => handleNext(SCREENS.SYSTEM_CHECK)} />
        )}

        {currentScreen === SCREENS.SYSTEM_CHECK && (
          <SystemCheck
            onNext={(data) => handleNext(SCREENS.INSTALL, data)}
            onError={handleError}
            onBack={() => setCurrentScreen(SCREENS.WELCOME)}
          />
        )}

        {currentScreen === SCREENS.INSTALL && (
          <InstallScreen
            systemInfo={systemInfo}
            onSuccess={() => handleNext(SCREENS.SUCCESS)}
            onError={handleError}
            onBack={() => setCurrentScreen(SCREENS.SYSTEM_CHECK)}
          />
        )}

        {currentScreen === SCREENS.SUCCESS && (
          <SuccessScreen />
        )}

        {currentScreen === SCREENS.ERROR && (
          <ErrorScreen error={error} onRetry={handleRetry} />
        )}
      </div>
    </div>
  );
}

export default App;

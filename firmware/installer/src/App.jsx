import { useState, useEffect } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import SystemCheck from './components/SystemCheck';
import GenerationSelect from './components/GenerationSelect';
import InstallScreen from './components/InstallScreen';
import SuccessScreen from './components/SuccessScreen';
import ErrorScreen from './components/ErrorScreen';
import HostingModeStep from './components/HostingModeStep';
import SSHConfigStep from './components/SSHConfigStep';
import HADiscoveryStep from './components/HADiscoveryStep';
import NestDiscoveryStep from './components/NestDiscoveryStep';
import ConfiguringStep from './components/ConfiguringStep';
import SetupCompleteStep from './components/SetupCompleteStep';

const SCREENS = {
  WELCOME: 'welcome',
  SYSTEM_CHECK: 'system_check',
  GENERATION_SELECT: 'generation_select',
  INSTALL: 'install',
  // Post-flash wizard
  HOSTING_MODE: 'hosting_mode',
  SSH_CONFIG: 'ssh_config',
  HA_DISCOVERY: 'ha_discovery',
  NEST_DISCOVERY: 'nest_discovery',
  CONFIGURING: 'configuring',
  SETUP_COMPLETE: 'setup_complete',
  // Legacy flash-only outcome screens
  SUCCESS: 'success',
  ERROR: 'error',
};

function App() {
  const [currentScreen, setCurrentScreen] = useState(SCREENS.WELCOME);
  const [systemInfo, setSystemInfo] = useState(null);
  const [generation, setGeneration] = useState(null);
  const [customFiles, setCustomFiles] = useState(null);
  const [error, setError] = useState(null);
  const [platform, setPlatform] = useState(null);

  // Wizard state
  const [hostingMode, setHostingMode] = useState(null);    // 'hosted' | 'selfhosted'
  const [sshConfig, setSshConfig] = useState(null);         // { mode, password }
  const [cloudregisterurl, setCloudregisterurl] = useState(null);
  const [nestIp, setNestIp] = useState(null);
  const [wizardResult, setWizardResult] = useState(null);

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
      {platform === 'darwin' && (
        <div className="app-drag w-full h-12 bg-slate-900/50 backdrop-blur-sm border-b border-slate-700/50 flex items-center justify-center px-4">
          <h1 className="text-sm font-semibold text-slate-300">No Longer Evil Thermostat Setup</h1>
        </div>
      )}

      {/* Debug indicator */}
      {import.meta.env.VITE_DEBUG_SKIP_FLASH === 'true' && (
        <div className="text-xs text-yellow-400 text-center py-1 bg-yellow-900/20 border-b border-yellow-700/30">
          ⚠ Debug mode: flash step mocked
        </div>
      )}

      <div className={platform === 'darwin' ? 'h-[calc(100%-3rem)] overflow-auto' : 'h-full overflow-auto'}>
        {currentScreen === SCREENS.WELCOME && (
          <WelcomeScreen onNext={() => handleNext(SCREENS.SYSTEM_CHECK)} />
        )}

        {currentScreen === SCREENS.SYSTEM_CHECK && (
          <SystemCheck
            onNext={(data) => handleNext(SCREENS.GENERATION_SELECT, data)}
            onError={handleError}
            onBack={() => setCurrentScreen(SCREENS.WELCOME)}
          />
        )}

        {currentScreen === SCREENS.GENERATION_SELECT && (
          <GenerationSelect
            onNext={(config) => {
              setGeneration(config.generation);
              setCustomFiles(config.customFiles);
              handleNext(SCREENS.INSTALL);
            }}
            onBack={() => setCurrentScreen(SCREENS.SYSTEM_CHECK)}
          />
        )}

        {currentScreen === SCREENS.INSTALL && (
          <InstallScreen
            systemInfo={systemInfo}
            generation={generation}
            customFiles={customFiles}
            onSuccess={() => handleNext(SCREENS.HOSTING_MODE)}
            onError={handleError}
            onBack={() => setCurrentScreen(SCREENS.GENERATION_SELECT)}
          />
        )}

        {/* ── Post-flash wizard ────────────────────────────────────────── */}

        {currentScreen === SCREENS.HOSTING_MODE && (
          <HostingModeStep
            onNext={(mode) => {
              setHostingMode(mode);
              setCurrentScreen(SCREENS.SSH_CONFIG);
            }}
            onSkip={() => setCurrentScreen(SCREENS.SUCCESS)}
          />
        )}

        {currentScreen === SCREENS.SSH_CONFIG && (
          <SSHConfigStep
            onNext={(config) => {
              setSshConfig(config);
              if (hostingMode === 'selfhosted') {
                setCurrentScreen(SCREENS.HA_DISCOVERY);
              } else {
                setCurrentScreen(SCREENS.NEST_DISCOVERY);
              }
            }}
            onBack={() => setCurrentScreen(SCREENS.HOSTING_MODE)}
          />
        )}

        {currentScreen === SCREENS.HA_DISCOVERY && (
          <HADiscoveryStep
            onNext={(url) => {
              setCloudregisterurl(url);
              setCurrentScreen(SCREENS.NEST_DISCOVERY);
            }}
            onBack={() => setCurrentScreen(SCREENS.SSH_CONFIG)}
          />
        )}

        {currentScreen === SCREENS.NEST_DISCOVERY && (
          <NestDiscoveryStep
            onNext={(ip) => {
              setNestIp(ip);
              setCurrentScreen(SCREENS.CONFIGURING);
            }}
            onBack={() => setCurrentScreen(
              hostingMode === 'selfhosted' ? SCREENS.HA_DISCOVERY : SCREENS.SSH_CONFIG
            )}
          />
        )}

        {currentScreen === SCREENS.CONFIGURING && (
          <ConfiguringStep
            nestIp={nestIp}
            cloudregisterurl={cloudregisterurl}
            sshConfig={sshConfig}
            onSuccess={(result) => {
              setWizardResult(result);
              // Clear password from state immediately after use
              setSshConfig(prev => prev ? { ...prev, password: '' } : null);
              setCurrentScreen(SCREENS.SETUP_COMPLETE);
            }}
            onBack={() => setCurrentScreen(SCREENS.NEST_DISCOVERY)}
          />
        )}

        {currentScreen === SCREENS.SETUP_COMPLETE && (
          <SetupCompleteStep
            result={wizardResult}
            hostingMode={hostingMode}
          />
        )}

        {/* ── Legacy flash-only outcome screens ───────────────────────── */}

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

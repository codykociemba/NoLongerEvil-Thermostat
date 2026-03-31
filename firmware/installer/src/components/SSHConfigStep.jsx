import { useState } from 'react';

// Simple password strength without importing zxcvbn (avoids bundler issues with native deps)
// Returns 0-4 based on length + character variety
function quickStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
const STRENGTH_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-green-400',
  'bg-green-500',
];

function SSHConfigStep({ onNext, onBack }) {
  const [sshMode, setSshMode] = useState('disable');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const strength = quickStrength(password);
  const passwordsMatch = password === confirm;
  const passwordValid = sshMode === 'disable' || (password.length >= 6 && passwordsMatch && strength >= 2);

  const handleNext = () => {
    onNext({
      mode: sshMode,
      password: sshMode === 'password' ? password : '',
    });
  };

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">SSH Access</h1>
          <p className="text-slate-400">Configure remote SSH access to your thermostat</p>
        </div>

        <div className="card space-y-6">
          <div className="space-y-4">
            <button
              onClick={() => setSshMode('disable')}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                sshMode === 'disable'
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-slate-600 hover:border-slate-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  sshMode === 'disable' ? 'border-primary-500' : 'border-slate-500'
                }`}>
                  {sshMode === 'disable' && <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Disable SSH</span>
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Recommended</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-0.5">
                    Removes SSH access from the device. More secure — you won't need it after setup.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSshMode('password')}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                sshMode === 'password'
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-slate-600 hover:border-slate-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  sshMode === 'password' ? 'border-primary-500' : 'border-slate-500'
                }`}>
                  {sshMode === 'password' && <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />}
                </div>
                <div>
                  <span className="font-semibold text-white">Enable SSH with custom password</span>
                  <p className="text-slate-400 text-sm mt-0.5">
                    Keep SSH enabled and change the default password.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {sshMode === 'password' && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">New SSH Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all ${
                            i < strength ? STRENGTH_COLORS[strength] : 'bg-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${strength >= 2 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {STRENGTH_LABELS[strength]}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  className={`w-full bg-slate-700 border rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 ${
                    confirm.length > 0 && !passwordsMatch
                      ? 'border-red-500'
                      : 'border-slate-600'
                  }`}
                />
                {confirm.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-red-400">Passwords do not match</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button onClick={onBack} className="btn-secondary flex-1">
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={!passwordValid}
            className="btn-primary flex-1"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default SSHConfigStep;

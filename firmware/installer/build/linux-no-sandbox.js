// afterPack: wrap the Linux binary so it always starts with --no-sandbox.
// chrome-sandbox cannot be setuid root inside a mounted AppImage (issue #177).
const fs = require('fs');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'linux') return;
  const name = context.packager.executableName;
  const exe = path.join(context.appOutDir, name);
  fs.renameSync(exe, `${exe}.bin`);
  fs.writeFileSync(exe, `#!/bin/sh\nexec "$(dirname "$(readlink -f "$0")")/${name}.bin" --no-sandbox "$@"\n`, { mode: 0o755 });
};

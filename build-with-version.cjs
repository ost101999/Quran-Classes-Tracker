// Builds with version <major>.<minor>.<number of git commits> without touching package.json.
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');

function computeVersion() {
    try {
        const count = Number.parseInt(execFileSync('git', ['rev-list', '--count', 'HEAD'], {
            cwd: __dirname,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim(), 10);
        if (Number.isFinite(count) && count > 0) {
            const [major, minor] = String(pkg.version || '0.0.0').split('.');
            return `${Number.parseInt(major, 10) || 0}.${Number.parseInt(minor, 10) || 0}.${count}`;
        }
    } catch { /* git unavailable */ }
    return pkg.version;
}

if (process.argv.includes('--print-version')) {
    process.stdout.write(computeVersion());
    process.exit(0);
}

const version = computeVersion();

// Lets the installed app find this project folder when the user presses "Update".
try {
    fs.writeFileSync(path.join(__dirname, 'project-meta.json'), JSON.stringify({ projectRoot: __dirname }, null, 2), 'utf8');
} catch { /* optional */ }

console.log(`[Build] Building version ${version}...`);
const result = spawnSync(
    process.execPath,
    [require.resolve('electron-builder/out/cli/cli.js'), `--config.extraMetadata.version=${version}`, ...process.argv.slice(2)],
    { cwd: __dirname, stdio: 'inherit', shell: false }
);
process.exit(result.status ?? 1);

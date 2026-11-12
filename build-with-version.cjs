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

// Keep the new Windows installer only after a successful build produced it.
const args = process.argv.slice(2);
const buildingWindows = args.includes('--win') || (process.platform === 'win32' && !args.includes('--mac') && !args.includes('--linux'));
if (result.status === 0 && buildingWindows) {
    const outputDir = path.resolve(__dirname, pkg.build?.directories?.output || 'dist');
    const prefix = `${pkg.build?.productName || pkg.name} Setup `;
    const currentInstaller = `${prefix}${version}.exe`;
    if (fs.existsSync(path.join(outputDir, currentInstaller))) {
        for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.exe') && entry.name !== currentInstaller) {
                try {
                    fs.unlinkSync(path.join(outputDir, entry.name));
                    console.log(`[Build] Removed old installer: ${entry.name}`);
                } catch (error) {
                    console.warn(`[Build] Could not remove old installer ${entry.name}: ${error.message}`);
                }
            }
        }
    }
}
process.exit(result.status ?? 1);


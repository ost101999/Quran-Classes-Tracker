const { spawn } = require('child_process');
const waitOn = require('wait-on');

// Parse --port argument
let port = 3000;
const portArgIndex = process.argv.indexOf('--port');
if (portArgIndex !== -1 && process.argv.length > portArgIndex + 1) {
  port = parseInt(process.argv[portArgIndex + 1], 10);
}

console.log(`Starting Dev Server on port ${port}...`);

// Set PORT environment variable for Vite and Electron
const env = { ...process.env, PORT: port.toString() };

// 1. Start Vite
const viteProcess = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'dev'], {
  env,
  stdio: 'inherit',
  shell: true,
});

// 2. Wait for Vite to be ready
waitOn({ resources: [`http://localhost:${port}`] }).then(() => {
  console.log(`Dev Server is ready on port ${port}. Starting Electron...`);
  
  // 3. Start Electron
  const electronProcess = spawn(/^win/.test(process.platform) ? 'npx.cmd' : 'npx', ['electron', '.', '--port', port.toString()], {
    env,
    stdio: 'inherit',
    shell: true,
  });

  electronProcess.on('close', (code) => {
    viteProcess.kill();
    process.exit(code);
  });
}).catch((err) => {
  console.error('Error waiting for Dev Server:', err);
  viteProcess.kill();
  process.exit(1);
});

process.on('SIGINT', () => {
  viteProcess.kill();
  process.exit();
});
process.on('SIGTERM', () => {
  viteProcess.kill();
  process.exit();
});

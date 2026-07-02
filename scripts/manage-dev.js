import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const PORT = 5173;
const pidFile = path.resolve(projectRoot, '.dev-server.pid');
const logFile = path.resolve(projectRoot, 'dev-server.log');

function isPortInUse(port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.once('connect', () => {
      client.destroy();
      resolve(true);
    });
    client.once('error', () => {
      resolve(false);
    });
    client.connect(port, '127.0.0.1');
  });
}

function getSavedPid() {
  if (fs.existsSync(pidFile)) {
    try {
      return parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    } catch (e) {
      return null;
    }
  }
  return null;
}

async function startServer() {
  // Run setup-worktree.js first
  try {
    console.log('Running environment setup...');
    execSync('node scripts/setup-worktree.js', { stdio: 'inherit', cwd: projectRoot });
  } catch (e) {
    console.warn('Warning: Environment setup failed, proceeding anyway...');
  }

  const portActive = await isPortInUse(PORT);
  const savedPid = getSavedPid();

  if (portActive) {
    if (savedPid) {
      try {
        process.kill(savedPid, 0);
        console.log(`Dev server is already running (PID: ${savedPid}) and listening on port ${PORT}.`);
        return;
      } catch (e) {
        console.log(`Port ${PORT} is active, but process ${savedPid} is dead. Stale PID file removed.`);
        try { fs.unlinkSync(pidFile); } catch (err) {}
      }
    }
    console.log(`Port ${PORT} is already in use by another process. Assuming dev server is running.`);
    return;
  }

  console.log(`Starting Vite dev server on port ${PORT}...`);
  
  // Ensure log directory exists
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  // Spawn Vite as a detached process
  const child = spawn('npx', ['vite'], {
    detached: true,
    stdio: ['ignore', out, err],
    shell: true,
    cwd: projectRoot
  });

  child.unref();

  // Save PID
  fs.writeFileSync(pidFile, child.pid.toString());
  console.log(`Started dev server in background (PID: ${child.pid}).`);
  console.log(`Log output is directed to: ${logFile}`);
  console.log(`Url: http://localhost:${PORT}`);
}

async function stopServer() {
  const savedPid = getSavedPid();
  let stoppedAny = false;

  if (savedPid) {
    console.log(`Stopping dev server process group with base PID ${savedPid}...`);
    try {
      // Kill process group (mac/linux)
      process.kill(-savedPid, 'SIGTERM');
      stoppedAny = true;
    } catch (e) {
      try {
        process.kill(savedPid, 'SIGTERM');
        stoppedAny = true;
      } catch (err) {
        // Already dead or permission issues
      }
    }
    try { fs.unlinkSync(pidFile); } catch (e) {}
  }

  // Force kill any process listening on port 5173 (especially on macOS)
  try {
    const pids = execSync(`lsof -t -i :${PORT}`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
    if (pids.length > 0) {
      console.log(`Cleaning up remaining processes on port ${PORT}: ${pids.join(', ')}`);
      for (const p of pids) {
        try {
          process.kill(parseInt(p, 10), 'SIGTERM');
          stoppedAny = true;
        } catch (e) {}
      }
    }
  } catch (e) {
    // lsof returns non-zero when no processes are found, which is normal
  }

  if (stoppedAny) {
    console.log('Dev server stopped successfully.');
  } else {
    console.log('No running dev server found on port ' + PORT);
  }
}

async function checkStatus() {
  const portActive = await isPortInUse(PORT);
  const savedPid = getSavedPid();

  if (portActive) {
    console.log(`STATUS: Dev server is RUNNING on http://localhost:${PORT}`);
    if (savedPid) {
      console.log(`PID: ${savedPid}`);
    } else {
      console.log('PID: Unknown (managed by external process)');
    }
  } else {
    console.log(`STATUS: Dev server is STOPPED (port ${PORT} is free)`);
  }
}

const action = process.argv[2];

if (action === 'start') {
  startServer();
} else if (action === 'stop') {
  stopServer();
} else if (action === 'status') {
  checkStatus();
} else {
  console.log('Usage: node scripts/manage-dev.js [start|stop|status]');
  process.exit(1);
}

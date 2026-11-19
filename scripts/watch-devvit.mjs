import { spawn, execFileSync } from 'node:child_process';
import process from 'node:process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmOptions = { stdio: 'inherit', shell: process.platform === 'win32' };

execFileSync(npmCommand, ['run', 'content:generate', '--', '--strict'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const children = [
  spawn(npmCommand, ['run', 'build:client', '--', '--watch'], npmOptions),
  spawn(npmCommand, ['run', 'build:server', '--', '--watch'], npmOptions),
];
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exitCode = exitCode;
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('fontWars Devvit watcher failed to start:', error);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`fontWars build watcher exited (${signal ?? code ?? 'unknown'}).`);
      stop(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

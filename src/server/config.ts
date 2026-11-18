import os from 'node:os';
import path from 'node:path';

export interface Config {
  host: string;
  port: number;
  dataDir: string;
  sectionLevel: number;
  lan: boolean;
}

export function defaultDataDir(): string {
  if (process.env.REVIEW_TOOL_DATA_DIR) return process.env.REVIEW_TOOL_DATA_DIR;
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'review-tool');
  }
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'review-tool');
  return path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share'), 'review-tool');
}

export function loadConfig(argv: string[] = process.argv.slice(2), env = process.env): Config {
  const lan = argv.includes('--host-lan');
  const portArg = argv.find((a) => a.startsWith('--port='))?.slice(7);
  const port = Number(portArg ?? env.PORT ?? 3000);
  return {
    host: lan ? '0.0.0.0' : '127.0.0.1',
    port: Number.isInteger(port) && port >= 0 && port < 65536 ? port : 3000,
    dataDir: defaultDataDir(),
    sectionLevel: Number(env.SECTION_LEVEL ?? 2) || 2,
    lan,
  };
}

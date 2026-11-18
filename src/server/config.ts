import os from 'node:os';
import path from 'node:path';

export interface Config {
  host: string;
  port: number;
  dataDir: string;
  sectionLevel: number;
  /** deepest heading level that Ctrl/Alt+Up/Down navigation stops at (1-6) */
  navMaxLevel: number;
  lan: boolean;
  /** personal access token from the ADO_PAT environment variable (never logged, persisted or exported) */
  adoPat?: string;
  /** TEST HOOK: send Azure DevOps API requests to this origin instead of dev.azure.com */
  adoApiBase?: string;
}

export function defaultDataDir(): string {
  if (process.env.REVIEW_TOOL_DATA_DIR) return process.env.REVIEW_TOOL_DATA_DIR;
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'review-tool');
  }
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'review-tool');
  return path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share'), 'review-tool');
}

function clampLevel(v: string | undefined, dflt: number): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : dflt;
}

export function loadConfig(argv: string[] = process.argv.slice(2), env = process.env): Config {
  const lan = argv.includes('--host-lan');
  const portArg = argv.find((a) => a.startsWith('--port='))?.slice(7);
  const port = Number(portArg ?? env.PORT ?? 3000);
  return {
    host: lan ? '0.0.0.0' : '127.0.0.1',
    port: Number.isInteger(port) && port >= 0 && port < 65536 ? port : 3000,
    dataDir: defaultDataDir(),
    sectionLevel: clampLevel(env.SECTION_LEVEL, 2),
    navMaxLevel: clampLevel(env.NAV_MAX_LEVEL, 6),
    lan,
    adoPat: env.ADO_PAT || undefined,
    adoApiBase: env.REVIEW_TOOL_ADO_API_BASE || undefined,
  };
}

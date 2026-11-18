import { spawn } from 'node:child_process';

/** Result of asking the operating system for a file: a path, or null when the user cancelled. */
export type PickResult = { path: string | null } | { error: string };
export type FilePicker = () => Promise<PickResult>;

const WINDOWS_SCRIPT = [
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  'Add-Type -AssemblyName System.Windows.Forms',
  'Add-Type -AssemblyName System.Drawing',
  '$owner = New-Object System.Windows.Forms.Form',
  '$owner.TopMost = $true',
  '$owner.ShowInTaskbar = $false',
  '$owner.FormBorderStyle = "None"',
  '$owner.Opacity = 0',
  '$owner.Size = New-Object System.Drawing.Size(1, 1)',
  '$owner.StartPosition = "CenterScreen"',
  '$owner.Show()',
  '$owner.Activate()',
  '$d = New-Object System.Windows.Forms.OpenFileDialog',
  "$d.Title = 'Open a markdown document'",
  "$d.Filter = 'Markdown (*.md;*.markdown)|*.md;*.markdown|All files (*.*)|*.*'",
  "if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.FileName) }",
].join('; ');

function command(): { cmd: string; args: string[] } | null {
  if (process.platform === 'win32') return { cmd: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-STA', '-Command', WINDOWS_SCRIPT] };
  if (process.platform === 'darwin') {
    return { cmd: 'osascript', args: ['-e', 'POSIX path of (choose file with prompt "Open a markdown document")'] };
  }
  return { cmd: 'zenity', args: ['--file-selection', '--title=Open a markdown document'] };
}

/** Show the operating system's own file dialog (this app only ever runs on the reviewer's machine). */
export const pickFileNative: FilePicker = () =>
  new Promise((resolve) => {
    const c = command();
    if (!c) return resolve({ error: 'A file dialog is not available on this system.' });
    let out = '';
    let settled = false;
    const done = (r: PickResult) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    const child = spawn(c.cmd, c.args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d: string) => (out += d));
    child.on('error', () => done({ error: 'A file dialog is not available on this system. Type the path instead.' }));
    child.on('close', () => done({ path: out.trim() || null }));
  });


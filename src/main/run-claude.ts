import { spawn } from 'child_process';

/**
 * Run Claude Code CLI with a prompt piped via stdin.
 * This avoids shell argument length limits for long prompts.
 */
export function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p', '--model', 'haiku'], {
      timeout: 60000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${stderr.slice(0, 200)}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', (err) => reject(err));

    // Pipe prompt via stdin
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

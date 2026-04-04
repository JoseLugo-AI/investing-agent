import { spawn } from 'child_process';

/**
 * Run Claude Code CLI with a prompt piped via stdin.
 * This avoids shell argument length limits for long prompts.
 *
 * Uses --output-format json to get structured output from the CLI,
 * then extracts the text content from the JSON envelope.
 */
export function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p', '--model', 'haiku', '--output-format', 'json'], {
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
        // --output-format json wraps the response in a JSON envelope.
        // Extract the text content from it.
        resolve(extractTextFromJsonOutput(stdout));
      }
    });

    proc.on('error', (err) => reject(err));

    // Pipe prompt via stdin
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

/**
 * Extract text content from Claude CLI --output-format json envelope.
 * The envelope looks like: { "type": "result", "result": "...", ... }
 * Falls back to raw string if the envelope can't be parsed.
 */
function extractTextFromJsonOutput(raw: string): string {
  try {
    const envelope = JSON.parse(raw);
    // The CLI json format puts the assistant text in .result
    if (typeof envelope.result === 'string') return envelope.result;
    // Some versions may nest differently
    if (typeof envelope.content === 'string') return envelope.content;
    if (Array.isArray(envelope.content)) {
      const textBlock = envelope.content.find((b: any) => b.type === 'text');
      if (textBlock?.text) return textBlock.text;
    }
  } catch {
    // Not valid JSON envelope — return raw output
  }
  return raw;
}

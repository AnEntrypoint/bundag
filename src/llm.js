import { spawn } from 'child_process';

let clientSingleton = null;

function resolveClaudeBin() {
  // Prefer env override, fall back to PATH `claude`.
  return process.env.BUNGRAPH_CLAUDE_BIN || 'claude';
}

export class LLMClient {
  constructor() {
    this.bin = resolveClaudeBin();
  }

  async generate(system, user, { maxAttempts = 3, timeoutMs = 120000 } = {}) {
    const fullPrompt = system
      ? `${system}\n\n---\n\n${user}\n\nRespond with ONLY a JSON object. No preamble. No code fence.`
      : `${user}\n\nRespond with ONLY a JSON object. No preamble. No code fence.`;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const text = await this.callClaude(fullPrompt, timeoutMs);
      if (process.env.BUNGRAPH_DEBUG_LLM) {
        process.stderr.write('[bungraph] LLM raw: ' + text.slice(0, 500) + '\n');
      }
      const parsed = this.parseJson(text);
      if (parsed) return parsed;
      process.stderr.write(`[bungraph] LLM returned non-JSON (len=${text.length}), retrying ${attempt + 1}/${maxAttempts}...\n`);
    }
    throw new Error('LLM failed to return JSON after retries');
  }

  callClaude(prompt, timeoutMs) {
    return new Promise((resolve, reject) => {
      const args = [
        '-p',
        '--output-format', 'json',
        '--no-session-persistence',
        '--disable-slash-commands',
        '--permission-mode', 'bypassPermissions',
      ];
      // Pass prompt via stdin to avoid shell-escaping issues for long multi-line prompts.
      const proc = spawn(this.bin, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
        shell: false,
      });

      let stdout = '';
      let stderr = '';
      let finished = false;

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          try { proc.kill(); } catch {}
          reject(new Error(`claude -p timed out after ${timeoutMs}ms. stderr: ${stderr.slice(0, 500)}`));
        }
      }, timeoutMs);

      proc.on('error', (e) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (e.code === 'ENOENT') {
          reject(new Error(`Claude CLI not found on PATH. Install Claude Code: https://claude.com/claude-code. Set BUNGRAPH_CLAUDE_BIN to override the binary path.`));
        } else {
          reject(e);
        }
      });

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
        if (process.env.BUNGRAPH_DEBUG_CLAUDE) {
          process.stderr.write('[claude] ' + d.toString());
        }
      });

      proc.on('close', (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`claude -p exited with code ${code}. stderr: ${stderr.slice(0, 500)}`));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.is_error) {
            reject(new Error(`Claude error: ${parsed.result || parsed.api_error_status || 'unknown'}`));
            return;
          }
          resolve(parsed.result || '');
        } catch (e) {
          // Not JSON envelope — return raw
          resolve(stdout);
        }
      });

      proc.stdin.write(prompt);
      proc.stdin.end();
    });
  }

  parseJson(text) {
    if (!text) return null;
    let t = text.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) t = fence[1].trim();
    const first = t.indexOf('{');
    const firstArr = t.indexOf('[');
    if (first === -1 && firstArr === -1) return null;
    const start = first === -1 ? firstArr : firstArr === -1 ? first : Math.min(first, firstArr);
    const openCh = t[start];
    const closeCh = openCh === '{' ? '}' : ']';
    let depth = 0, end = -1, inStr = false, esc = false;
    for (let i = start; i < t.length; i++) {
      const c = t[i];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === openCh) depth++;
      else if (c === closeCh) { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) return null;
    try { return JSON.parse(t.slice(start, end + 1)); } catch { return null; }
  }

  async close() {
    // nothing persistent to clean up
  }
}

export function getLLM() {
  if (!clientSingleton) clientSingleton = new LLMClient();
  return clientSingleton;
}

// Minimal Chrome DevTools Protocol client.
//
// Drives the system Chrome over its debugging WebSocket so browser tests need no
// Playwright/Puppeteer dependency and no browser download. Node 24 has a built-in
// WebSocket, so this file has zero imports beyond node: builtins.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

async function poll(fn, { tries = 60, delay = 250 } = {}) {
  let lastError;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError ?? new Error('poll timed out');
}

export async function launch({ port = 9222, headless = true } = {}) {
  const binary = CHROME_CANDIDATES.find(p => existsSync(p));
  if (!binary) throw new Error('No Chrome or Edge found.');

  const profile = mkdtempSync(join(tmpdir(), 'cdp-profile-'));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-gpu',
    '--window-size=1440,1000',
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new');

  const proc = spawn(binary, args, { stdio: 'ignore', detached: false });

  const target = await poll(async () => {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  });

  const session = await connect(target.webSocketDebuggerUrl);

  return {
    session,
    async close() {
      try {
        await session.close();
      } catch {}
      try {
        proc.kill();
      } catch {}
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };
}

/** Opens a CDP session and returns a `send` function plus event helpers. */
export async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('ws error')), { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method) {
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
    }
  });

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(fn);
  };

  return {
    send,
    on,
    close: () =>
      new Promise(resolve => {
        ws.addEventListener('close', resolve, { once: true });
        ws.close();
      }),
  };
}

/** Attaches to the first page target and returns a page-scoped helper. */
export async function openPage(session) {
  const { targetInfos } = await session.send('Target.getTargets');
  const page = targetInfos.find(t => t.type === 'page');
  const { sessionId } = await session.send('Target.attachToTarget', {
    targetId: page.targetId,
    flatten: true,
  });

  const send = (method, params) => session.send(method, params, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  const consoleErrors = [];
  const pageErrors = [];
  session.on('Runtime.exceptionThrown', p => {
    if (p.sessionId && p.sessionId !== sessionId) return;
    pageErrors.push(p.exceptionDetails?.exception?.description ?? 'exception');
  });
  session.on('Runtime.consoleAPICalled', p => {
    if (p.type !== 'error' && p.type !== 'warning') return;
    const text = (p.args ?? []).map(a => a.value ?? a.description ?? '').join(' ');
    consoleErrors.push(`${p.type}: ${text}`);
  });
  session.on('Log.entryAdded', p => {
    if (p.entry?.level === 'error') consoleErrors.push(`log: ${p.entry.text}`);
  });

  /** Evaluates an expression in the page and returns its JSON value. */
  const evaluate = async expression => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? 'evaluate failed');
    }
    return result.value;
  };

  const goto = async url => {
    await send('Page.navigate', { url });
    await poll(async () => {
      const ready = await evaluate('document.readyState');
      if (ready !== 'complete') throw new Error('not complete');
      return ready;
    });
  };

  /** Waits until an expression evaluates truthy. */
  const waitFor = (expression, opts) =>
    poll(async () => {
      const value = await evaluate(expression);
      if (!value) throw new Error(`not yet: ${expression}`);
      return value;
    }, opts);

  return { send, evaluate, goto, waitFor, consoleErrors, pageErrors };
}

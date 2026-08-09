// Browser tests driven over CDP against a running dev server.
//
// These cover what the Node engine tests cannot: canvas painting, click handling,
// playback timing, theme repaint and hydration. Run with `npm run test:browser`.

import { launch, openPage } from './cdp.mjs';

const BASE = process.env.PDA_URL ?? 'http://localhost:3000';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** Counts non-background pixels so we can tell the canvas actually painted. */
const CANVAS_INK = `(() => {
  const c = document.querySelector('canvas.state-canvas');
  if (!c) return null;
  const ctx = c.getContext('2d');
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const counts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i] << 16) | (data[i+1] << 8) | data[i+2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = data.length / 4;
  return {
    distinctColors: counts.size,
    dominant: sorted[0][0].toString(16).padStart(6, '0'),
    dominantShare: sorted[0][1] / total,
    width: c.width,
    height: c.height,
  };
})()`;

/** Clicks a button whose visible text contains `text`. */
const clickByText = (selector, text) => `(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
    .find(e => e.textContent.includes(${JSON.stringify(text)}));
  if (!el) return false;
  el.click();
  return true;
})()`;

/** Sets a React-controlled input's value and fires the events React listens for. */
const setInput = (selector, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`;

const STATE = `({
  verdict: document.querySelector('.verdict')?.textContent ?? null,
  message: document.querySelector('.sim-message')?.textContent ?? null,
  step: document.querySelector('.playback-label')?.textContent ?? null,
  stackCells: [...document.querySelectorAll('.viz-panel .stack-cell')].map(e => e.textContent),
  branchCards: document.querySelectorAll('.branch-card').length,
  logLines: document.querySelectorAll('.step-item').length,
  tapeCurrent: document.querySelector('.tape-cell.current')?.textContent ?? null,
  errors: [...document.querySelectorAll('.issue-block.error .issue-item')].map(e => e.textContent),
  warnings: [...document.querySelectorAll('.issue-block.warning .issue-item')].map(e => e.textContent),
  playLabel: document.querySelector('.playback-buttons .btn-primary')?.textContent ?? null,
})`;

async function testCanvas(page) {
  section('Canvas actually paints');
  const ink = await page.evaluate(CANVAS_INK);
  check('canvas element exists', ink !== null);
  check('canvas is device-pixel sized', ink.width > 400 && ink.height > 300,
    `${ink.width}x${ink.height}`);
  // A blank fill would be one colour; nodes, edges and labels give many.
  check('diagram drew shapes, not just background', ink.distinctColors > 20,
    `${ink.distinctColors} distinct colours`);
  check('background still dominates (not a solid blob)',
    ink.dominantShare > 0.4 && ink.dominantShare < 0.995,
    `dominant share ${ink.dominantShare.toFixed(3)}`);

  // Resizing must trigger the ResizeObserver repaint, not leave stale geometry.
  const before = ink.width;
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 900, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await page.evaluate(`new Promise(r => setTimeout(r, 400))`);
  const after = await page.evaluate(CANVAS_INK);
  check('canvas resized with the window', after.width !== before,
    `${before} -> ${after.width}`);
  check('canvas still painted after resize', after.distinctColors > 20,
    `${after.distinctColors} colours`);
  await page.send('Emulation.clearDeviceMetricsOverride');
  await page.evaluate(`new Promise(r => setTimeout(r, 300))`);
}

async function testInitialState(page) {
  section('Initial state (balanced parentheses, "(())")');
  const s = await page.evaluate(STATE);
  check('verdict is accepted', s.verdict === 'accepted', s.verdict);
  check('message names the accepting state', /q2/.test(s.message ?? ''), s.message);
  check('no validation errors shown', s.errors.length === 0, s.errors.join(' | '));
  check('step counter starts at 0', /Step 0 \//.test(s.step ?? ''), s.step);
  check('stack shows the bottom marker', s.stackCells.some(c => c.includes('Z₀')),
    JSON.stringify(s.stackCells));
  check('example card is highlighted',
    await page.evaluate(`document.querySelectorAll('.example-card.active').length === 1`));
  check('DPDA mode is selected',
    await page.evaluate(`document.querySelector('.mode-toggle input[value=dpda]').checked`));
}

async function testPlayback(page) {
  section('Playback: step, back, play, pause, reset, scrub');

  const stepNum = `(() => {
    const m = document.querySelector('.playback-label')?.textContent.match(/Step (\\d+) \\/ (\\d+)/);
    return m ? { at: +m[1], last: +m[2] } : null;
  })()`;

  const start = await page.evaluate(stepNum);
  check('trace has multiple steps', start.last >= 4, `last=${start.last}`);

  await page.evaluate(clickByText('.playback-buttons button', 'Forward'));
  const fwd = await page.evaluate(stepNum);
  check('Forward advances one step', fwd.at === start.at + 1, `${start.at} -> ${fwd.at}`);

  const stackAfterFwd = await page.evaluate(`[...document.querySelectorAll('.viz-panel .stack-cell')].map(e=>e.textContent)`);
  check('stack grew after reading "("', stackAfterFwd.length === 2,
    JSON.stringify(stackAfterFwd));

  // Step backward is the capability the old build could not do at all.
  await page.evaluate(clickByText('.playback-buttons button', 'Back'));
  const back = await page.evaluate(stepNum);
  check('Back returns one step', back.at === start.at, `-> ${back.at}`);
  const stackAfterBack = await page.evaluate(`[...document.querySelectorAll('.viz-panel .stack-cell')].map(e=>e.textContent)`);
  check('stack rewound with the step', stackAfterBack.length === 1,
    JSON.stringify(stackAfterBack));

  check('Back is disabled at step 0',
    await page.evaluate(`[...document.querySelectorAll('.playback-buttons button')].find(b=>b.textContent.includes('Back')).disabled`));

  // Play then pause mid-run: the old build had no pause path at all.
  // The slider is inverted, so max means fastest. Use it to keep the test brisk.
  await page.evaluate(`(() => {
    const s = document.querySelector('.playback-speed input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    set.call(s, s.max);
    s.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await page.evaluate(clickByText('.playback-buttons button', 'Play'));
  const label = await page.evaluate(`document.querySelector('.playback-buttons .btn-primary').textContent`);
  check('Play switches the button to Pause', /Pause/.test(label), label);

  await page.evaluate(`new Promise(r => setTimeout(r, 700))`);
  const during = await page.evaluate(stepNum);
  check('playback advanced on its own', during.at > back.at, `${back.at} -> ${during.at}`);

  await page.evaluate(clickByText('.playback-buttons button', 'Pause'));
  const pausedAt = await page.evaluate(stepNum);
  await page.evaluate(`new Promise(r => setTimeout(r, 1200))`);
  const stillPaused = await page.evaluate(stepNum);
  check('Pause genuinely stops advancing', stillPaused.at === pausedAt.at,
    `${pausedAt.at} -> ${stillPaused.at}`);

  await page.evaluate(clickByText('.playback-buttons button', 'End'));
  const atEnd = await page.evaluate(stepNum);
  check('End jumps to the last step', atEnd.at === atEnd.last, `${atEnd.at}/${atEnd.last}`);
  const endState = await page.evaluate(STATE);
  check('log is populated at the end', endState.logLines > 0, `${endState.logLines} lines`);
  check('button offers Replay at the end', /Replay/.test(endState.playLabel ?? ''),
    endState.playLabel);

  await page.evaluate(clickByText('.playback-buttons button', 'Reset'));
  const reset = await page.evaluate(stepNum);
  check('Reset returns to step 0', reset.at === 0, `-> ${reset.at}`);

  // Scrubber must jump directly to an arbitrary step.
  await page.evaluate(setInput('.playback-scrub input', '3'));
  const scrubbed = await page.evaluate(stepNum);
  check('scrubber jumps to an arbitrary step', scrubbed.at === 3, `-> ${scrubbed.at}`);
  await page.evaluate(clickByText('.playback-buttons button', 'Reset'));
}

async function testTheme(page) {
  section('Theme toggle repaints the canvas');
  const before = await page.evaluate(CANVAS_INK);
  const themeBefore = await page.evaluate(`document.documentElement.dataset.theme`);

  await page.evaluate(`document.querySelector('.theme-toggle').click()`);
  await page.evaluate(`new Promise(r => setTimeout(r, 450))`);

  const themeAfter = await page.evaluate(`document.documentElement.dataset.theme`);
  const after = await page.evaluate(CANVAS_INK);

  check('data-theme flipped', themeBefore !== themeAfter, `${themeBefore} -> ${themeAfter}`);
  // The old build left stale colours on the canvas until the next state change.
  check('canvas repainted in the new palette', before.dominant !== after.dominant,
    `bg ${before.dominant} -> ${after.dominant}`);
  check('canvas still has content after repaint', after.distinctColors > 20,
    `${after.distinctColors} colours`);
  check('choice persisted to localStorage',
    await page.evaluate(`localStorage.getItem('theme')`) === themeAfter);

  await page.evaluate(`document.querySelector('.theme-toggle').click()`);
  await page.evaluate(`new Promise(r => setTimeout(r, 350))`);
}

async function testNpdaBranching(page) {
  section('NPDA mode: branching, per-branch stacks, branch selection');

  await page.evaluate(clickByText('.example-card', 'wwᴿ Even Palindrome'));
  await page.evaluate(`new Promise(r => setTimeout(r, 350))`);

  check('NPDA mode auto-selected with the example',
    await page.evaluate(`document.querySelector('.mode-toggle input[value=npda]').checked`));

  const npda = await page.evaluate(STATE);
  check('wwᴿ accepts "abba" in NPDA mode', npda.verdict === 'accepted', npda.verdict);

  // Walk to a step where the frontier has genuinely branched.
  let cards = 0;
  for (let i = 0; i < 6; i += 1) {
    await page.evaluate(clickByText('.playback-buttons button', 'Forward'));
    await page.evaluate(`new Promise(r => setTimeout(r, 120))`);
    cards = await page.evaluate(`document.querySelectorAll('.branch-card').length`);
    if (cards > 1) break;
  }
  check('multiple branch cards render', cards > 1, `${cards} cards`);
  check('each branch card has its own stack',
    await page.evaluate(`[...document.querySelectorAll('.branch-card')]
      .every(c => c.querySelectorAll('.stack-cell').length > 0 || c.textContent.includes('empty'))`));
  check('branch cards show their state name',
    await page.evaluate(`[...document.querySelectorAll('.branch-state')].length > 1`));

  // Selecting a branch must actually change the selection, not just look clickable.
  const selectedBefore = await page.evaluate(`[...document.querySelectorAll('.branch-card')].findIndex(c => c.classList.contains('selected'))`);
  await page.evaluate(`(() => {
    const cards = [...document.querySelectorAll('.branch-card')];
    const target = cards.find(c => !c.classList.contains('selected'));
    if (target) target.click();
    return true;
  })()`);
  await page.evaluate(`new Promise(r => setTimeout(r, 200))`);
  const selectedAfter = await page.evaluate(`[...document.querySelectorAll('.branch-card')].findIndex(c => c.classList.contains('selected'))`);
  check('clicking a branch card selects it', selectedAfter !== selectedBefore,
    `${selectedBefore} -> ${selectedAfter}`);

  // The teaching point: same machine, same input, different verdict per mode.
  await page.evaluate(`document.querySelector('.mode-toggle input[value=dpda]').click()`);
  await page.evaluate(`new Promise(r => setTimeout(r, 350))`);
  const asDpda = await page.evaluate(STATE);
  check('same machine REJECTS "abba" in DPDA mode', asDpda.verdict === 'rejected',
    asDpda.verdict);
  check('single stack panel in DPDA mode',
    await page.evaluate(`document.querySelectorAll('.branch-card').length === 0`));
}

async function testCustomPda(page) {
  section('Custom PDA typed through the real form');

  await page.evaluate(clickByText('.sidebar-section button', 'Clear All'));
  await page.evaluate(`new Promise(r => setTimeout(r, 250))`);

  const inputs = '.sidebar .form-group input.form-input';
  await page.evaluate(setInput(`${inputs}`, 'q0, q1, q2*'));
  await page.evaluate(`new Promise(r => setTimeout(r, 120))`);

  // Fill alphabets by their labels so the test does not depend on field order.
  const setByLabel = (label, value) => `(() => {
    const group = [...document.querySelectorAll('.sidebar .form-group')]
      .find(g => g.querySelector('.form-label')?.textContent.includes(${JSON.stringify(label)}));
    if (!group) return false;
    const el = group.querySelector('input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`;

  check('states field accepted', await page.evaluate(setByLabel('States', 'q0, q1, q2*')));
  check('input alphabet accepted', await page.evaluate(setByLabel('Input Alphabet', 'a, b')));
  check('stack alphabet accepted', await page.evaluate(setByLabel('Stack Alphabet', 'Z0, A')));
  await page.evaluate(`new Promise(r => setTimeout(r, 200))`);

  // Add aⁿbⁿ one transition at a time through the Add Transition form. Filling and
  // clicking are separate evaluates: an async IIFE awaiting inside the page gets
  // collected by CDP before it settles.
  const fillTransition = (from, read, pop, push, to) => `(() => {
    const form = [...document.querySelectorAll('.sidebar-section')]
      .find(s => s.querySelector('.sidebar-title')?.textContent.includes('Add Transition'));
    const fields = form.querySelectorAll('.transition-form input');
    const vals = ${JSON.stringify([from, read, pop, push, to])};
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    fields.forEach((el, i) => {
      set.call(el, vals[i]);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return fields.length;
  })()`;

  const rows = [
    ['q0', 'a', 'Z0', 'AZ0', 'q0'],
    ['q0', 'a', 'A', 'AA', 'q0'],
    ['q0', 'b', 'A', 'ε', 'q1'],
    ['q1', 'b', 'A', 'ε', 'q1'],
    ['q1', 'ε', 'Z0', 'Z0', 'q2'],
  ];
  for (const r of rows) {
    const fieldCount = await page.evaluate(fillTransition(...r));
    if (fieldCount !== 5) {
      check(`transition form has 5 fields`, false, `found ${fieldCount}`);
      break;
    }
    await page.evaluate(`new Promise(r => setTimeout(r, 90))`);
    await page.evaluate(clickByText('.sidebar-section button', 'Add Transition'));
    await page.evaluate(`new Promise(r => setTimeout(r, 140))`);
  }

  const count = await page.evaluate(`document.querySelectorAll('.transition-item').length`);
  check('all 5 transitions were added', count === 5, `${count} rows`);

  await page.evaluate(setInput('.viz-panel .input-row input', 'aabb'));
  await page.evaluate(`new Promise(r => setTimeout(r, 350))`);

  const custom = await page.evaluate(STATE);
  check('hand-built aⁿbⁿ has no errors', custom.errors.length === 0,
    custom.errors.join(' | '));
  check('hand-built aⁿbⁿ accepts "aabb"', custom.verdict === 'accepted', custom.verdict);

  await page.evaluate(setInput('.viz-panel .input-row input', 'aab'));
  await page.evaluate(`new Promise(r => setTimeout(r, 350))`);
  const bad = await page.evaluate(STATE);
  check('hand-built aⁿbⁿ rejects "aab"', bad.verdict === 'rejected', bad.verdict);

  // Play it through in the browser to confirm the run completes end to end.
  await page.evaluate(setInput('.viz-panel .input-row input', 'aabb'));
  await page.evaluate(`new Promise(r => setTimeout(r, 300))`);
  await page.evaluate(clickByText('.playback-buttons button', 'End'));
  await page.evaluate(`new Promise(r => setTimeout(r, 250))`);
  const played = await page.evaluate(STATE);
  check('custom machine logs its steps', played.logLines >= 4, `${played.logLines} lines`);
  check('custom machine still accepted after playing', played.verdict === 'accepted');
}

async function testValidationUx(page) {
  section('Validation surfaces problems where they can be seen');

  // A transition to an undeclared state must error, and the error must sit above
  // the disabled Play button rather than below it.
  await page.evaluate(`(() => {
    const form = [...document.querySelectorAll('.sidebar-section')]
      .find(s => s.querySelector('.sidebar-title')?.textContent.includes('Add Transition'));
    const fields = form.querySelectorAll('.transition-form input');
    const vals = ['q1','a','Z0','Z0','qGhost'];
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    fields.forEach((el,i) => { set.call(el, vals[i]); el.dispatchEvent(new Event('input',{bubbles:true})); });
    return true;
  })()`);
  await page.evaluate(`new Promise(r => setTimeout(r, 80))`);
  await page.evaluate(clickByText('.sidebar-section button', 'Add Transition'));
  await page.evaluate(`new Promise(r => setTimeout(r, 350))`);

  const bad = await page.evaluate(STATE);
  check('unknown target state raises an error', bad.errors.length > 0);
  check('error names the offending state',
    bad.errors.some(e => e.includes('qGhost')), bad.errors.join(' | '));
  check('Play is disabled while the definition is broken',
    await page.evaluate(`document.querySelector('.playback-buttons .btn-primary').disabled`));
  check('error panel renders ABOVE the playback controls',
    await page.evaluate(`(() => {
      const err = document.querySelector('.issue-block.error');
      const play = document.querySelector('.playback');
      if (!err || !play) return false;
      return err.compareDocumentPosition(play) & Node.DOCUMENT_POSITION_FOLLOWING;
    })()`));

  // The list must name the target state, or a typo like this cannot be spotted.
  check('transition list shows the target state',
    await page.evaluate(`[...document.querySelectorAll('.transition-item')]
      .some(r => r.textContent.includes('qGhost'))`));

  // Removing it must recover cleanly.
  const removed = await page.evaluate(`(() => {
    const row = [...document.querySelectorAll('.transition-item')]
      .find(r => r.textContent.includes('qGhost'));
    if (!row) return false;
    row.querySelector('.transition-remove').click();
    return true;
  })()`);
  check('the bad transition row could be removed', removed);
  await page.evaluate(`new Promise(r => setTimeout(r, 350))`);
  const fixed = await page.evaluate(STATE);
  check('removing the bad transition clears the error', fixed.errors.length === 0,
    fixed.errors.join(' | '));
  check('Play is re-enabled after the fix',
    await page.evaluate(`!document.querySelector('.playback-buttons .btn-primary').disabled`));

  // The silent-wrong-answer case: blank stack alphabet must still be correct.
  await page.evaluate(`(() => {
    const group = [...document.querySelectorAll('.sidebar .form-group')]
      .find(g => g.querySelector('.form-label')?.textContent.includes('Stack Alphabet'));
    const el = group.querySelector('input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    set.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await page.evaluate(setInput('.viz-panel .input-row input', 'aabb'));
  await page.evaluate(`new Promise(r => setTimeout(r, 400))`);
  const blank = await page.evaluate(STATE);
  check('blank stack alphabet still accepts "aabb"', blank.verdict === 'accepted',
    blank.verdict);
  check('stack shows Z₀ as one cell, not split',
    blank.stackCells.every(c => !c.includes('0') || c.includes('Z₀')),
    JSON.stringify(blank.stackCells));
}

async function testKeyboard(page) {
  section('Keyboard shortcuts');

  await page.evaluate(clickByText('.example-card', 'Balanced Parentheses'));
  await page.evaluate(`new Promise(r => setTimeout(r, 350))`);
  await page.evaluate(`document.activeElement?.blur()`);

  const stepAt = `(() => {
    const m = document.querySelector('.playback-label')?.textContent.match(/Step (\\d+)/);
    return m ? +m[1] : -1;
  })()`;

  const press = async key => {
    const code = key === 'ArrowRight' ? 39 : key === 'ArrowLeft' ? 37 : key === ' ' ? 32 : 82;
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key, code: key === ' ' ? 'Space' : key,
      windowsVirtualKeyCode: code, nativeVirtualKeyCode: code,
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key, code: key === ' ' ? 'Space' : key,
      windowsVirtualKeyCode: code, nativeVirtualKeyCode: code,
    });
    await page.evaluate(`new Promise(r => setTimeout(r, 180))`);
  };

  const before = await page.evaluate(stepAt);
  await press('ArrowRight');
  const afterRight = await page.evaluate(stepAt);
  check('ArrowRight steps forward', afterRight === before + 1, `${before} -> ${afterRight}`);

  await press('ArrowLeft');
  const afterLeft = await page.evaluate(stepAt);
  check('ArrowLeft steps backward', afterLeft === before, `-> ${afterLeft}`);

  await press('ArrowRight');
  await press('r');
  const afterReset = await page.evaluate(stepAt);
  check('R resets to step 0', afterReset === 0, `-> ${afterReset}`);

  // Typing in a field must not trigger shortcuts.
  await page.evaluate(`document.querySelector('.viz-panel .input-row input').focus()`);
  const beforeTyping = await page.evaluate(stepAt);
  await press('ArrowRight');
  const afterTyping = await page.evaluate(stepAt);
  check('shortcuts ignored while typing in an input', afterTyping === beforeTyping,
    `${beforeTyping} -> ${afterTyping}`);
  await page.evaluate(`document.activeElement?.blur()`);
}

async function run() {
  const browser = await launch({ headless: true });
  const page = await openPage(browser.session);

  try {
    await page.goto(BASE);
    // Wait for a canvas that has actually been sized and painted, rather than a
    // fixed delay — the first paint is a frame or two after mount.
    await page.waitFor(
      `(() => {
        const c = document.querySelector('canvas.state-canvas');
        return c && c.width > 400 && c.height > 300;
      })()`
    );

    await testCanvas(page);
    await testInitialState(page);
    await testPlayback(page);
    await testTheme(page);
    await testNpdaBranching(page);
    await testCustomPda(page);
    await testValidationUx(page);
    await testKeyboard(page);

    section('Console cleanliness');
    const realErrors = page.pageErrors.filter(e => !/favicon/i.test(e));
    check('no uncaught exceptions', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
    const hydration = page.consoleErrors.filter(e => /hydrat|did not match/i.test(e));
    check('no hydration mismatch', hydration.length === 0, hydration.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

run().catch(err => {
  console.error('\nHARNESS ERROR:', err.message);
  process.exit(1);
});

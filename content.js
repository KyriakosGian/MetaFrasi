(() => {
  if (globalThis.__metaFrasiLoaded) return;
  globalThis.__metaFrasiLoaded = true;
  let host, root, selection, settings, pendingId, captureTimer, captureVersion = 0;
  let temporaryLanguage = '', resultText = '', view = 'launcher';
  const $ = id => root.getElementById(id);
  async function send(message) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      if (!response?.ok) throw new Error(response?.error || 'MetaFrasi could not respond. Reload this tab and try again.');
      return response.data;
    } catch (error) {
      if (/context invalidated|receiving end|message port/i.test(error.message)) throw new Error('MetaFrasi was updated. Reload this tab to continue.');
      throw error;
    }
  }
  const css = `
    :host { all: initial !important; position: fixed !important; inset: auto !important; left: var(--metafrasi-left, 8px) !important; top: var(--metafrasi-top, 8px) !important; z-index: 2147483647 !important; width: max-content !important; max-width: calc(100vw - 16px) !important; color-scheme: dark; }
    :host([hidden]) { display: none !important; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .shell { --bg:#1a1a2e; --input:#111122; --fg:#eeeefa; --muted:#b0b0cd; --line:#36364d; --tint:#262342; font:14px/1.55 'Segoe UI',system-ui,sans-serif; color:var(--fg); background:var(--bg); border:1px solid var(--line); border-radius:12px; box-shadow:0 12px 40px #0005; overflow:hidden; text-align:left; }
    .shell.light { --bg:#fff; --input:#f5f4fc; --fg:#1a1930; --muted:#5f5d75; --line:#dcdbea; --tint:#efedff; color-scheme:light; }
    button,select { font:inherit; }
    button { border:0; cursor:pointer; color:inherit; background:transparent; padding:9px 12px; border-radius:6px; }
    button:hover { background:var(--tint); }
    button:focus-visible,select:focus-visible,summary:focus-visible,a:focus-visible { outline:2px solid #9b95ff; outline-offset:-3px; }
    button:disabled { cursor:wait; opacity:.6; }
    .launcher { display:flex; align-items:center; gap:0; padding:3px; }
    .launcher button { padding:5px 8px; font-size:12px; line-height:1.4; border-radius:5px; }
    .primary { color:#fff; background:#6257e8; font-weight:600; }
    .primary:hover { background:#756af5; }
    .arrow { margin-left:3px; border-left:1px solid var(--line); }
    .more { padding:12px; width:290px; border-top:1px solid var(--line); }
    label { display:block; color:var(--muted); font-size:12px; margin-bottom:5px; }
    select { display:block; width:100%; color:var(--fg); background:var(--input); border:1px solid var(--line); border-radius:7px; padding:8px; margin-bottom:8px; }
    .wide { width:100%; text-align:left; }
    .hint { margin:6px 0; font-size:12px; color:var(--muted); }
    .result { width:390px; max-width:calc(100vw - 18px); }
    .heading { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:5px 10px; border-bottom:1px solid var(--line); }
    .heading-title { display:flex; align-items:baseline; gap:7px; min-width:0; white-space:nowrap; }
    .heading button { padding:4px 7px; flex-shrink:0; }
    .brand { color:#b9b4ff; font-size:11px; font-weight:700; letter-spacing:.01em; }
    .light .brand { color:#5146bd; }
    h2 { font-size:11px; margin:0; font-weight:500; overflow:hidden; text-overflow:ellipsis; }
    .body { padding:15px; max-height:min(420px,55vh); overflow:auto; overflow-wrap:anywhere; }
    .output { margin:0; white-space:pre-wrap; unicode-bidi:plaintext; }
    .error { color:#ffb9b9; }
    .light .error { color:#a62929; }
    .footer { display:flex; flex-wrap:wrap; gap:4px; justify-content:space-between; align-items:center; border-top:1px solid var(--line); padding:7px 9px; }
    .meta { color:var(--muted); font-size:11px; line-height:1.5; padding:0 4px; flex:1; min-width:150px; overflow-wrap:anywhere; }
    details { font-size:12px; color:var(--muted); margin-top:14px; }
    summary { cursor:pointer; }
    .source { white-space:pre-wrap; unicode-bidi:plaintext; max-height:140px; overflow:auto; margin:8px 0 0; }
    a { color:#b9b4ff; }
    .light a { color:#5146bd; }
  `;
  function createUI() {
    if (host) return;
    host = document.createElement('div');
    host.setAttribute('data-metafrasi', '');
    root = host.attachShadow({mode: 'closed'});
    const style = document.createElement('style'); style.textContent = css; root.append(style);
    const shell = document.createElement('div'); shell.className = 'shell'; shell.id = 'shell';
    // This template is constant. Page text and model output are assigned with textContent.
    shell.innerHTML = `
      <div id="launcher" class="launcher" role="group" aria-label="MetaFrasi translation">
        <button id="translate" class="primary">Translate</button>
        <button id="expand" class="arrow" aria-label="More translation options" aria-expanded="false" aria-controls="more">▾</button>
        <button id="close-launcher" aria-label="Close MetaFrasi">×</button>
      </div>
      <div id="more" class="more" hidden>
        <label for="language">Translate into</label><select id="language"></select>
        <p class="hint">For this selection only. Your default stays the same.</p>
        <button id="summarize" class="wide">Summarize &amp; Translate</button>
        <button id="settings-menu" class="wide">Settings</button>
      </div>
      <section id="result" class="result" aria-label="MetaFrasi result" hidden>
        <div class="heading"><div class="heading-title"><span class="brand">MetaFrasi</span><h2 id="title">Translation</h2></div><button id="close-result" aria-label="Close MetaFrasi">×</button></div>
        <div class="body"><p id="output" class="output" role="status" aria-live="polite" dir="auto"></p>
          <details id="original"><summary>Original text</summary><p id="source" class="source" dir="auto"></p></details>
        </div>
        <div class="footer"><span id="meta" class="meta"></span><div>
          <button id="setup" hidden>Open Settings</button><button id="back" hidden>Back</button><button id="copy" hidden>Copy</button>
        </div></div>
      </section>`;
    root.append(shell);
    document.documentElement.append(host);
    $('translate').addEventListener('click', () => run('translate'));
    $('summarize').addEventListener('click', () => run('summary'));
    $('expand').addEventListener('click', () => {
      $('more').hidden = !$('more').hidden;
      $('expand').setAttribute('aria-expanded', String(!$('more').hidden));
      position();
    });
    $('language').addEventListener('change', () => { temporaryLanguage = $('language').value; updateLabels(); });
    for (const id of ['settings-menu', 'setup']) $(id).addEventListener('click', () => send({type: 'OPEN_SETTINGS'}).catch(showError));
    for (const id of ['close-launcher', 'close-result']) $(id).addEventListener('click', close);
    $('back').addEventListener('click', () => showLauncher());
    $('copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(resultText); $('copy').textContent = 'Copied'; }
      catch { $('meta').textContent = 'Copy is unavailable here. Select the result and copy it manually.'; }
    });
  }
  function languageName() {
    return settings?.languages.find(([code]) => code === temporaryLanguage)?.[1] || 'English';
  }
  function updateLabels() {
    $('translate').textContent = `Translate to ${languageName()}`;
    $('summarize').textContent = `Summarize in ${languageName()}`;
    position();
  }
  function position() {
    if (!host || host.hidden || !selection) return;
    const bounds = host.getBoundingClientRect();
    const width = window.innerWidth, height = window.innerHeight;
    const left = Math.max(8, Math.min(selection.rect.left, width - bounds.width - 8));
    let top = selection.rect.bottom + 8;
    if (top + bounds.height > height - 8) top = selection.rect.top - bounds.height - 8;
    top = Math.max(8, Math.min(top, height - bounds.height - 8));
    host.style.setProperty('--metafrasi-left', `${left}px`);
    host.style.setProperty('--metafrasi-top', `${top}px`);
  }
  function showLauncher() {
    view = 'launcher'; resultText = '';
    $('launcher').hidden = false; $('result').hidden = true; $('more').hidden = true;
    $('expand').setAttribute('aria-expanded', 'false');
    updateLabels();
  }
  function showError(error) {
    view = 'result';
    $('launcher').hidden = true; $('more').hidden = true; $('result').hidden = false;
    $('output').textContent = error.message; $('output').classList.add('error');
    $('meta').textContent = ''; $('back').hidden = false; $('setup').hidden = false; $('copy').hidden = true;
    position();
  }
  async function run(mode) {
    if (!selection || pendingId) return;
    view = 'result';
    $('launcher').hidden = true; $('more').hidden = true; $('result').hidden = false;
    $('title').textContent = `${mode === 'summary' ? 'Summary' : 'Translation'} · ${languageName()}`;
    $('source').textContent = selection.text; $('original').open = false;
    $('output').classList.remove('error');
    $('output').textContent = mode === 'summary' ? 'Summarizing and translating…' : 'Translating…';
    $('meta').textContent = 'Sending selected text to Google';
    $('meta').removeAttribute('title');
    $('copy').hidden = true; $('copy').textContent = 'Copy'; $('back').hidden = true; $('setup').hidden = true;
    position();
    if (!settings.configured) return showError(new Error('Connect your own Gemini API key in Settings to start translating.'));
    if (selection.text.length > settings.maxLength) return showError(new Error('Select a shorter passage (up to 12,000 characters).'));
    const requestId = crypto.randomUUID();
    pendingId = requestId;
    try {
      const result = await send({type: 'TRANSLATE', text: selection.text, mode, targetLanguage: temporaryLanguage, requestId});
      if (pendingId !== requestId || host.hidden) return;
      resultText = result.text;
      $('output').textContent = result.text;
      const tokens = Number.isFinite(result.tokens) && result.tokens >= 0 ? `${result.tokens} tokens` : 'tokens unavailable';
      $('meta').textContent = result.cached
        ? `0 ms · ${result.model} · 0 tokens (cache)`
        : `${Math.round(result.elapsed)} ms · ${result.model} · ${tokens}`;
      $('meta').title = result.cached ? `No new API request. Original request: ${tokens}.` : 'Total tokens reported by Google for this request.';
      $('copy').hidden = false; $('back').hidden = false;
    } catch (error) {
      if (pendingId === requestId && !host.hidden) showError(error);
    } finally {
      if (pendingId === requestId) pendingId = null;
      position();
    }
  }
  function close() {
    captureVersion++;
    clearTimeout(captureTimer);
    if (pendingId) send({type: 'CANCEL', requestId: pendingId}).catch(() => {});
    pendingId = null;
    if (host) host.hidden = true;
    selection = null;
  }
  async function capture() {
    const candidate = globalThis.MetaFrasiSelection.readSelection();
    if (!candidate) return;
    const version = ++captureVersion;
    let nextSettings;
    try { nextSettings = await send({type: 'GET_SETTINGS'}); } catch { return; }
    if (version !== captureVersion || !nextSettings.enabled) return;
    if (pendingId) send({type: 'CANCEL', requestId: pendingId}).catch(() => {});
    pendingId = null;
    settings = nextSettings; selection = candidate; temporaryLanguage = settings.targetLanguage;
    createUI(); host.hidden = false;
    const light = settings.theme === 'light' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
    $('shell').classList.toggle('light', light);
    $('language').replaceChildren(...settings.languages.map(([code, name]) => {
      const option = document.createElement('option'); option.value = code; option.textContent = name; return option;
    }));
    $('language').value = temporaryLanguage;
    showLauncher();
  }
  document.addEventListener('pointerdown', event => {
    if (!event.composedPath().includes(host)) close();
  }, true);
  document.addEventListener('mouseup', event => {
    if (event.button !== 0 || event.composedPath().includes(host) || globalThis.MetaFrasiSelection.isEditable(event.target)) return;
    clearTimeout(captureTimer); captureTimer = setTimeout(capture, 100);
  });
  document.addEventListener('keyup', event => {
    if (event.composedPath().includes(host)) return;
    if (event.key === 'Shift' || (event.shiftKey && event.key.startsWith('Arrow'))) {
      clearTimeout(captureTimer); captureTimer = setTimeout(capture, 100);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && host && !host.hidden) close();
  }, true);
  window.addEventListener('scroll', event => {
    if (!event.composedPath().includes(host) && view === 'launcher') close();
  }, {passive: true, capture: true});
  window.addEventListener('resize', position);
})();

import {LANGUAGES, languageName, DEFAULTS, DEFAULT_INSTRUCTIONS, MAX_INSTRUCTIONS_LENGTH} from './shared/core.js';

const $ = id => document.getElementById(id);
let state;
let savedKeyCheckFailed = false;
const media = matchMedia('(prefers-color-scheme: light)');
async function send(message) {
  if (!globalThis.chrome?.runtime?.id) throw new Error('Install MetaFrasi in Chrome to connect a key and save settings.');
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'Could not save your changes. Try again.');
  return response.data;
}
function status(id, message, isError = false) {
  const element = $(id); element.textContent = message; element.className = isError ? 'error' : 'success';
}
function theme() {
  const value = $('theme').value;
  document.documentElement.dataset.theme = value === 'system' ? (media.matches ? 'light' : 'dark') : value;
}
function preview() {
  $('button-preview').replaceChildren(document.createTextNode(`Translate to ${languageName($('target-language').value)} `));
  const arrow = document.createElement('span'); arrow.textContent = '▾'; arrow.setAttribute('aria-hidden', 'true'); $('button-preview').append(arrow);
}
function renderKeyState() {
  const hasDraft = Boolean($('api-key').value.trim());
  const configured = state.hasKey && state.cloudConsent;
  $('key-summary').dataset.state = savedKeyCheckFailed ? 'failed' : configured && state.enabled ? 'ready' : 'idle';
  $('key-summary-title').textContent = state.hasKey ? 'API key saved' : 'No API key saved';
  $('key-summary-detail').textContent = savedKeyCheckFailed
    ? 'The saved key could not be verified. Review the message below and check again.'
    : configured ? (state.enabled ? 'Enabled for translation requests.' : 'Translations are paused. Your key is still saved.')
      : state.hasKey ? 'Confirm consent and check the saved key to enable translation requests.' : 'Connect your own Gemini key to enable translation requests.';
  $('key-state').textContent = hasDraft
    ? (state.hasKey ? 'Replacement key not saved. Your existing key stays in use until you choose Replace & save key.' : 'Key not saved yet. Choose Connect & save key.')
    : state.hasKey ? 'Your saved key is kept private, so this field stays empty. Leave it empty to reuse the key, or paste a replacement. Check saved key confirms Google access without generating a translation.'
      : 'Your key stays in this browser profile. It is not synced.';
  $('api-key').placeholder = state.hasKey ? 'Optional: paste a replacement key' : 'Paste your Gemini API key';
  $('connect').textContent = state.hasKey ? (hasDraft ? 'Replace & save key' : 'Check saved key') : 'Connect & save key';
  $('reveal').disabled = !hasDraft;
}
function render(next) {
  state = next;
  $('target-language').replaceChildren(...LANGUAGES.map(([code, name]) => new Option(name, code)));
  $('target-language').value = next.targetLanguage;
  $('theme').value = next.theme; $('enabled').checked = next.enabled; $('consent').checked = next.cloudConsent;
  $('translation-instructions').value = next.instructions;
  $('translation-instructions').maxLength = MAX_INSTRUCTIONS_LENGTH;
  $('api-key').value = ''; $('api-key').type = 'password'; $('reveal').textContent = 'Show'; $('reveal').setAttribute('aria-label', 'Show API key'); $('reveal').setAttribute('aria-pressed', 'false');
  renderKeyState();
  $('disconnect').hidden = !next.hasKey;
  $('model-select').replaceChildren(...(next.models.length ? next.models : [{id: DEFAULTS.model, name: 'Gemini 3.5 Flash-Lite (recommended)'}]).map(model => new Option(model.name, model.id)));
  $('model-select').value = next.model;
  $('model-state').textContent = next.models.length ? `${next.models.length} text models listed for your key. Access and quota are checked when you use one.` : 'Connect your key to discover available models.';
  theme(); preview();
}
function busy(value) {
  for (const element of document.querySelectorAll('form input, form select, form textarea, form button')) element.disabled = value;
  $('reveal').disabled = value || !$('api-key').value.trim();
}
$('connect-form').addEventListener('submit', async event => {
  event.preventDefault(); busy(true); status('connection-status', 'Checking your key and loading models…');
  const checkingSavedKey = state.hasKey && !$('api-key').value.trim();
  try {
    // Connecting changes the key and model list only; retain unsaved preferences.
    const draft = {targetLanguage: $('target-language').value, theme: $('theme').value, enabled: $('enabled').checked, instructions: $('translation-instructions').value};
    const next = await send({type: 'CONNECT', apiKey: $('api-key').value, cloudConsent: $('consent').checked});
    savedKeyCheckFailed = false;
    render(next);
    $('target-language').value = draft.targetLanguage; $('theme').value = draft.theme; $('enabled').checked = draft.enabled; $('translation-instructions').value = draft.instructions;
    theme(); preview();
    status('connection-status', 'Key accepted by Google and saved. Your model list is ready.');
  } catch (error) { if (checkingSavedKey) savedKeyCheckFailed = true; renderKeyState(); status('connection-status', error.message, true); }
  finally { busy(false); }
});
$('preferences-form').addEventListener('submit', async event => {
  event.preventDefault(); busy(true);
  try {
    const draftKey = $('api-key').value;
    const next = await send({type: 'SAVE_PREFERENCES', model: $('model-select').value, targetLanguage: $('target-language').value, theme: $('theme').value, enabled: $('enabled').checked, instructions: $('translation-instructions').value});
    render(next); $('api-key').value = draftKey; renderKeyState(); status('save-status', 'Preferences saved. Select a new passage to use them.');
  } catch (error) { status('save-status', error.message, true); }
  finally { busy(false); }
});
$('disconnect').addEventListener('click', async () => {
  busy(true);
  try { const next = await send({type: 'DISCONNECT'}); savedKeyCheckFailed = false; render(next); status('connection-status', 'Saved key removed. No further translations will be sent.'); }
  catch (error) { status('connection-status', error.message, true); }
  finally { busy(false); }
});
$('clear-cache').addEventListener('click', async () => {
  try { await send({type: 'CLEAR_CACHE'}); status('cache-status', 'Temporary results cleared.'); }
  catch (error) { status('cache-status', error.message, true); }
});
$('reveal').addEventListener('click', () => {
  const reveal = $('api-key').type === 'password'; $('api-key').type = reveal ? 'text' : 'password';
  $('reveal').textContent = reveal ? 'Hide' : 'Show'; $('reveal').setAttribute('aria-label', reveal ? 'Hide API key' : 'Show API key'); $('reveal').setAttribute('aria-pressed', String(reveal));
});
$('api-key').addEventListener('input', () => { $('connection-status').textContent = ''; renderKeyState(); });
function markUnsaved() {
  theme(); preview(); $('save-status').className = ''; $('save-status').textContent = 'You have unsaved preferences.';
}
for (const id of ['target-language', 'model-select', 'theme', 'enabled']) $(id).addEventListener('change', markUnsaved);
$('translation-instructions').addEventListener('input', markUnsaved);
$('reset-instructions').addEventListener('click', () => {
  $('translation-instructions').value = DEFAULT_INSTRUCTIONS;
  markUnsaved();
  $('save-status').textContent = 'Default instructions restored. Choose Save preferences to apply them.';
});
media.addEventListener('change', theme);
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) document.querySelectorAll('nav a').forEach(link => link.classList.toggle('active', link.hash === `#${entry.target.id}`));
}, {rootMargin: '-10% 0px -60% 0px'});
document.querySelectorAll('main section').forEach(section => observer.observe(section));
try { render(await send({type: 'GET_OPTIONS'})); }
catch (error) {
  render({...DEFAULTS, hasKey: false, models: []});
  status('page-status', error.message, true);
  busy(true);
}

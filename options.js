import {LANGUAGES, languageName, DEFAULTS} from './shared/core.js';

const $ = id => document.getElementById(id);
let state;
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
function render(next) {
  state = next;
  $('target-language').replaceChildren(...LANGUAGES.map(([code, name]) => new Option(name, code)));
  $('target-language').value = next.targetLanguage;
  $('theme').value = next.theme; $('enabled').checked = next.enabled; $('consent').checked = next.cloudConsent;
  $('api-key').value = ''; $('api-key').type = 'password'; $('reveal').textContent = 'Show'; $('reveal').setAttribute('aria-pressed', 'false');
  $('api-key').placeholder = next.hasKey ? 'Key saved. Paste a new key to replace it.' : 'Paste your Gemini API key';
  $('key-state').textContent = next.hasKey ? 'A key is saved in this browser profile. Leave the field empty to reuse it.' : 'Your key stays in this browser profile. It is not synced.';
  $('disconnect').hidden = !next.hasKey;
  $('model-select').replaceChildren(...(next.models.length ? next.models : [{id: DEFAULTS.model, name: 'Gemini 3.5 Flash-Lite (recommended)'}]).map(model => new Option(model.name, model.id)));
  $('model-select').value = next.model;
  $('model-state').textContent = next.models.length ? `${next.models.length} text models listed for your key. Access and quota are checked when you use one.` : 'Connect your key to discover available models.';
  theme(); preview();
}
function busy(value) {
  for (const id of ['connect', 'save', 'disconnect']) $(id).disabled = value;
}
$('connect-form').addEventListener('submit', async event => {
  event.preventDefault(); busy(true); status('connection-status', 'Checking your key and loading models…');
  try {
    // Connecting changes the key and model list only; keep unsaved language/theme choices visible.
    const draft = {targetLanguage: $('target-language').value, theme: $('theme').value, enabled: $('enabled').checked};
    const next = await send({type: 'CONNECT', apiKey: $('api-key').value, cloudConsent: $('consent').checked});
    render({...next, ...draft});
    status('connection-status', 'Key accepted by Google and saved. Your model list is ready.');
  } catch (error) { status('connection-status', error.message, true); }
  finally { busy(false); }
});
$('preferences-form').addEventListener('submit', async event => {
  event.preventDefault(); busy(true);
  try {
    const next = await send({type: 'SAVE_PREFERENCES', model: $('model-select').value, targetLanguage: $('target-language').value, theme: $('theme').value, enabled: $('enabled').checked});
    render(next); status('save-status', 'Preferences saved. Select a new passage to use them.');
  } catch (error) { status('save-status', error.message, true); }
  finally { busy(false); }
});
$('disconnect').addEventListener('click', async () => {
  busy(true);
  try { render(await send({type: 'DISCONNECT'})); status('connection-status', 'Saved key removed. No further translations will be sent.'); }
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
for (const id of ['target-language', 'model-select', 'theme', 'enabled']) $(id).addEventListener('change', () => {
  theme(); preview(); $('save-status').className = ''; $('save-status').textContent = 'You have unsaved preferences.';
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

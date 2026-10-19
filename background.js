import {createService, authorizeMessage} from './shared/service.js';
import {createGeminiClient} from './shared/gemini.js';
import {DEFAULTS, languageName} from './shared/core.js';

// Content scripts receive a deliberately small, key-free settings object.
const ready = chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
const service = createService({storage: chrome.storage.local, client: createGeminiClient()});

chrome.runtime.onInstalled.addListener(async ({reason}) => {
  await ready;
  if (reason === 'install') {
    const locale = chrome.i18n.getUILanguage().split('-')[0];
    const existing = await chrome.storage.local.get('settings');
    if (!existing.settings) await chrome.storage.local.set({settings: {...DEFAULTS, targetLanguage: languageName(locale) ? locale : 'en'}});
    await chrome.runtime.openOptionsPage();
  }
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!authorizeMessage(message, sender, chrome.runtime.id, chrome.runtime.getURL('options.html'))) {
    respond({ok: false, error: 'This request is not allowed.'});
    return false;
  }
  const owner = `${sender.tab?.id}:${sender.frameId ?? 0}`;
  (async () => {
    await ready;
    switch (message.type) {
      case 'GET_SETTINGS': return service.getPublic();
      case 'GET_OPTIONS': return service.getOptions();
      case 'CONNECT': return service.connect(message);
      case 'SAVE_PREFERENCES': return service.savePreferences(message);
      case 'DISCONNECT': return service.disconnect();
      case 'CLEAR_CACHE': return service.clearCache();
      case 'TRANSLATE': return service.translate(owner, message);
      case 'CANCEL': return service.cancel(owner, message.requestId);
      case 'OPEN_SETTINGS': await chrome.runtime.openOptionsPage(); return {};
      default: throw new Error('Unknown action.');
    }
  })().then(data => respond({ok: true, data}), error => respond({ok: false, error: error.message || 'Something went wrong. Try again.'}));
  return true;
});

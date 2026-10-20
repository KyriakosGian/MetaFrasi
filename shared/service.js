import {normalizeSettings, normalizeInstructions, MAX_INSTRUCTIONS_LENGTH, publicSettings, validateRequest, recommendedModel, languageName, validModel, ResultCache} from './core.js';

export function createService({storage, client, now = Date.now}) {
  const cache = new ResultCache(40, 20 * 60 * 1000, now);
  const active = new Map();
  let revision = 0;
  let updating = false;
  async function read() { return normalizeSettings((await storage.get('settings')).settings); }
  function cancelAll() {
    revision++;
    for (const entry of active.values()) entry.controller.abort();
    active.clear(); cache.clear();
  }
  async function persist(value) {
    updating = true; cancelAll();
    try { await storage.set(value); }
    finally { revision++; updating = false; }
  }
  return {
    async getPublic() { return publicSettings(await read()); },
    async getOptions() {
      const settings = await read();
      return {...publicSettings(settings), instructions: settings.instructions, hasKey: Boolean(settings.apiKey), cloudConsent: settings.cloudConsent, models: (await storage.get('models')).models || []};
    },
    async connect({apiKey, cloudConsent}) {
      if (cloudConsent !== true) throw new Error('Confirm that selected text may be sent to Google before connecting.');
      const settings = await read();
      const key = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : settings.apiKey;
      const models = await client.listModels(key);
      await persist({settings: {...settings, apiKey: key, cloudConsent: true,
        model: models.some(item => item.id === settings.model) ? settings.model : recommendedModel(models)}, models});
      return this.getOptions();
    },
    async savePreferences(changes) {
      if (!languageName(changes.targetLanguage)) throw new Error('Choose a supported target language.');
      if (!['dark', 'light', 'system'].includes(changes.theme)) throw new Error('Choose a valid appearance.');
      if (!validModel(changes.model)) throw new Error('Choose a valid model.');
      if (changes.instructions !== undefined && (typeof changes.instructions !== 'string' || changes.instructions.length > MAX_INSTRUCTIONS_LENGTH)) {
        throw new Error('Use up to 4,000 characters for your translation instructions.');
      }
      const settings = await read();
      const models = (await storage.get('models')).models || [];
      if (settings.apiKey && !models.some(model => model.id === changes.model)) throw new Error('Refresh the model list and choose one of the available models.');
      await persist({settings: {...settings, model: changes.model, targetLanguage: changes.targetLanguage,
        theme: changes.theme, enabled: changes.enabled !== false,
        instructions: changes.instructions === undefined ? settings.instructions : normalizeInstructions(changes.instructions)}});
      return this.getOptions();
    },
    async disconnect() {
      await persist({settings: {...await read(), apiKey: '', cloudConsent: false}, models: []});
      return this.getOptions();
    },
    clearCache() { cache.clear(); return {}; },
    cancel(owner, requestId) {
      const entry = active.get(owner);
      if (entry && entry.requestId === requestId) entry.controller.abort();
      return {};
    },
    async translate(owner, message) {
      const startedRevision = revision;
      if (updating) throw new Error('Settings are being saved. Try again in a moment.');
      const task = validateRequest(message);
      if (typeof message.requestId !== 'string' || message.requestId.length > 80) throw new Error('Invalid request. Select the passage again.');
      const settings = await read();
      if (updating || startedRevision !== revision) throw new Error('Settings changed. Select the passage again.');
      if (!settings.enabled) throw new Error('MetaFrasi is paused. Enable it in Settings.');
      if (!settings.apiKey || !settings.cloudConsent) throw new Error('Connect your Gemini API key in MetaFrasi Settings first.');
      const id = JSON.stringify([settings.model, settings.instructions, task.mode, task.targetLanguage, task.text]);
      const cached = cache.get(id);
      if (cached) return {...cached, cached: true, elapsed: 0};
      if (active.has(owner)) throw new Error('A translation is already running. Wait for it or close its panel.');
      if (active.size >= 3) throw new Error('Several translations are running. Wait a moment and try again.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      const entry = {requestId: message.requestId, controller};
      active.set(owner, entry);
      const started = now();
      try {
        const result = await client.translate(settings.apiKey, settings.model, task, controller.signal, settings.instructions);
        if (controller.signal.aborted || startedRevision !== revision) throw new Error('The request was cancelled. Try again.');
        const value = {...result, model: settings.model, mode: task.mode, targetLanguage: task.targetLanguage};
        cache.set(id, value);
        return {...value, cached: false, elapsed: now() - started};
      } finally {
        clearTimeout(timer);
        if (active.get(owner) === entry) active.delete(owner);
      }
    }
  };
}

export function authorizeMessage(message, sender, runtimeId, optionsUrl) {
  if (sender.id !== runtimeId || !message || typeof message !== 'object') return false;
  const privileged = ['GET_OPTIONS', 'CONNECT', 'SAVE_PREFERENCES', 'DISCONNECT', 'CLEAR_CACHE'];
  // A section fragment belongs to the same Settings document, including after a reload.
  if (privileged.includes(message.type)) return typeof sender.url === 'string' && sender.url.split('#', 1)[0] === optionsUrl;
  return ['GET_SETTINGS', 'TRANSLATE', 'CANCEL', 'OPEN_SETTINGS'].includes(message.type) &&
    Number.isInteger(sender.tab?.id) && /^https?:\/\//.test(sender.url || '');
}

import {compatibleModels, buildPayload, parseTranslation, validModel} from './core.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/';
export function apiError(status) {
  if (status === 400) return 'Google rejected the request. Check your API key and choose a compatible text model.';
  if (status === 401 || status === 403) return 'Google denied access. Check your API key, project and regional availability in AI Studio.';
  if (status === 404) return 'This model is no longer available. Refresh the model list in Settings.';
  if (status === 429) return 'Your Google project has reached a rate or usage limit. Wait before retrying, or check your quota in AI Studio.';
  if (status >= 500) return 'Google is temporarily unavailable. Please try again later.';
  return 'The request to Google failed. Please try again.';
}
export function createGeminiClient(fetcher = (...args) => fetch(...args)) {
  async function request(path, apiKey, options = {}) {
    if (!apiKey || apiKey.length > 256 || /\s/.test(apiKey)) throw new Error('Enter a valid Google Gemini API key in Settings.');
    let response;
    try {
      response = await fetcher(BASE + path, {
        ...options, credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: {'Content-Type': 'application/json', 'x-goog-api-key': apiKey}
      });
    } catch (error) {
      if (options.signal?.aborted) throw new Error('The request was cancelled or timed out. You can try again.');
      throw new Error('Could not connect to Google. Check your connection and try again.');
    }
    if (!response.ok) throw new Error(apiError(response.status));
    try { return await response.json(); } catch { throw new Error('Google returned an unreadable response. Try again later.'); }
  }
  return {
    async listModels(apiKey) {
      const signal = AbortSignal.timeout(25000);
      const models = [];
      let pageToken = '';
      for (let page = 0; page < 10; page++) {
        const body = await request(`models?pageSize=1000${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`, apiKey, {signal});
        models.push(...(body.models || []));
        pageToken = body.nextPageToken;
        if (!pageToken) break;
      }
      const available = compatibleModels(models);
      if (!available.length) throw new Error('No compatible Gemini text models were found for this key. Check your project in AI Studio.');
      return available;
    },
    async translate(apiKey, model, task, signal) {
      if (!validModel(model)) throw new Error('Choose a valid text model in Settings.');
      const body = await request(`models/${model}:generateContent`, apiKey, {method: 'POST', body: JSON.stringify(buildPayload(task)), signal});
      const count = body.usageMetadata?.totalTokenCount;
      return {text: parseTranslation(body), tokens: Number.isFinite(count) && count >= 0 ? count : null};
    }
  };
}

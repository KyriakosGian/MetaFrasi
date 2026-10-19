# MetaFrasi

Translate the passage you are reading, or get a translated summary. A small, open-source Chrome extension using your own Google Gemini API key.

Version **0.1.0**, initial testing release. English interface. Manifest V3. No runtime dependencies, developer-operated backend or analytics.

[Website](https://kyriakosgian.github.io/MetaFrasi/) · [Releases](https://github.com/KyriakosGian/MetaFrasi/releases) · [Privacy](docs/privacy.html) · [Support](https://github.com/KyriakosGian/MetaFrasi/issues)

## Features

- Double-click a word or drag to select a passage on a webpage.
- Translate into your saved target language with one click.
- Choose another language for the current selection without changing your default.
- Summarize and translate a longer passage in one action.
- Keep the original passage visible on demand and copy the result.
- Connect your own Gemini key and discover compatible text models.
- Choose dark, light or system appearance.
- Pause the selection control and clear temporary results.
- Skip editable fields to coexist with writing tools such as [TypePilot](https://github.com/KyriakosGian/TypePilot).

## Installation

1. Download the release ZIP and extract it, or clone this repository.
2. Open `chrome://extensions/` in desktop Chrome 112 or later.
3. Enable **Developer mode** and choose **Load unpacked**.
4. Select the extracted folder containing `manifest.json`.
5. In MetaFrasi Settings, follow the API key guide and choose **Connect & save key**.
6. Choose your preferred target language, review the model, and choose **Save preferences**.
7. Reload webpages that were open before installation. Select a passage to see the Translate button.

Chrome Web Store submission is planned after testing. No store listing is available yet.

## Google Gemini and cost

MetaFrasi is free software. Google's API is a separate service. Use an eligible free-tier project or your own paid project. Model access, regional conditions, data handling and quotas depend on Google's current terms. Paid projects may incur charges. MetaFrasi does not activate billing or silently switch models.

The default is Gemini 3.5 Flash-Lite when listed for the key. Connection selects an available Flash-Lite alternative when the default is absent. This is model discovery, not a guarantee of free pricing or successful generation. Review the selected model before use. No automatic fallback occurs during a translation.

Quota applies to the Google project, so other apps using the same project can share its limits. Each requested translation sends the selected text plus a short instruction. Recent identical results are reused from a small, temporary in-memory cache. No speculative requests or automatic retries are sent.

[Get a key](https://aistudio.google.com/apikey) · [Pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Limits](https://ai.google.dev/gemini-api/docs/rate-limits) · [Terms](https://ai.google.dev/gemini-api/terms)

## Scope and limitations

- Selected text only, up to 12,000 characters. No full-page, image, subtitle or PDF translation in version 0.1.
- HTTP and HTTPS pages and accessible matching frames. Chrome-protected pages cannot run the content script.
- Writing fields, including standard contenteditable editors, are excluded.
- Source language is inferred by Gemini. Ambiguous isolated words may need a complete sentence.
- AI output can contain mistakes. Summary mode intentionally omits detail.
- Closing a panel aborts a pending request where possible. It cannot recall a request already processed by Google.
- The first language default follows a supported browser UI language, otherwise English. You can change it in Settings.

## Privacy and security

Only a deliberate Translate or Summarize action sends selected text to Google. The full page and its URL are not sent. The API key stays in restricted `chrome.storage.local`, is not synced, and is never returned to content scripts. MetaFrasi does not encrypt the local key. Results are rendered as plain text, never as HTML. Source passages are explicitly treated as untrusted data in the AI instructions, although prompt injection resistance cannot be guaranteed by prompting alone.

The service worker keeps up to 40 cached results for up to 20 minutes, with expiry checked on access. The cache disappears when the worker stops and is cleared on key or preference changes. No selected text is saved to disk by MetaFrasi.

## Development

Node.js 22 or later. No install step is needed for unit tests, checks, packaging or local website preview.

```sh
node --test tests/core.test.js tests/service.test.js tests/gemini.test.js
node scripts/check.mjs
node scripts/package.mjs
node scripts/preview.mjs
```

`dist/metafrasi-0.1.0.zip` is an allowlisted extension package. Tests, development scripts and local artifacts are excluded. A SHA-256 file accompanies it.

Browser integration tests use Playwright with its Chromium browser in a temporary profile, fake credentials and mocked Gemini responses. They never use your personal Chrome profile or a real API key. Set `METAFRASI_PLAYWRIGHT` to an absolute installed Playwright package directory when it is not locally installed, then run:

```sh
node scripts/browser-test.mjs
```

## Structure

- `content.js`, `selection.js`: selection detection and isolated floating UI.
- `background.js`: validated extension messaging and restricted storage setup.
- `shared/`: request validation, Gemini client, settings and cache service.
- `options.*`: API onboarding, model, language and appearance settings.
- `docs/`: static GitHub Pages website, privacy and support pages.
- `tests/`, `scripts/`: tests, verification and reproducible packaging.
- `store-assets/`: draft Chrome Web Store copy and submission checklist.

## Publishing

Push the repository to `KyriakosGian/MetaFrasi`. In GitHub Settings → Pages, choose **GitHub Actions**. The included Pages workflow publishes `docs/`. CI checks the project and builds an extension ZIP on pushes and pull requests. Tagging `v0.1.0` publishes a GitHub Release with the ZIP and checksum. See [release checklist](store-assets/SUBMISSION.md) before submitting to the Chrome Web Store.

## License and credits

[MIT](LICENSE). Created by [KyriakosGian](https://github.com/KyriakosGian). Part of the same collection of tools as [TypePilot](https://github.com/KyriakosGian/TypePilot) and [Tabel](https://github.com/KyriakosGian/Tabel). Visual direction follows TypePilot's dark settings interface.

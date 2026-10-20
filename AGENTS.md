# MetaFrasi development guidance

- Keep the extension, website, comments and documentation in English. Translated user content uses the selected target language.
- Keep the project buildless and dependency-free at runtime. Background scripts are ES modules. Content scripts are classic scripts.
- Do not add analytics, a backend proxy, remote executable code, automatic paid fallback or speculative AI calls.
- Never place real API keys, private user content or personal browser data in files, tests, logs, screenshots or commits.
- Restrict local storage to trusted contexts. Privileged messages must originate from the extension Settings page. Content scripts receive only key-free preferences.
- Render source and model output with textContent. Treat selected text as data, not instructions.
- The Translate action uses the saved target. Dropdown language changes apply only to the current selection. Summary mode uses that same temporary target.
- Do not activate on editable fields. Preserve coexistence with TypePilot.
- Run the dependency-free tests and scripts/check.mjs after functional edits. Use a disposable browser profile and mocked requests for integration tests. Clearly distinguish mocked testing from live Gemini testing.
- Never install test browser binaries inside the project. Reuse an existing shared test browser when available, or use an OS temporary directory and remove the downloaded browsers after testing.
- After verification, remove generated test reports, screenshots, temporary helpers and superseded release ZIPs unless retention is requested. Keep the current distributable and its checksum.
- Keep manifest.json, package.json, shared/core.js and visible version text consistent. Package only allowlisted runtime files.
- The public repository is planned as KyriakosGian/MetaFrasi and the Pages source is docs/. Store submission follows user testing.

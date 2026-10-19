# Release and Chrome Web Store checklist

## Current release gate

This is an initial local testing release. Do not describe mocked integration tests as live Gemini verification. Store submission follows the user's real-browser testing.

- [ ] Test a real free-tier key manually in the user's browser, without copying the key into source, chat, logs or screenshots.
- [ ] Verify a full translation and translated summary, including Greek and another target language.
- [ ] Check a quota error, unavailable model and revoked key.
- [ ] Test coexistence with the installed TypePilot extension.
- [ ] Review layout at different display scales and the supported Chrome version.
- [ ] Publish the GitHub repository, Pages site and tagged test release.
- [ ] Verify public download, support and privacy links.
- [ ] Capture screenshots using neutral text and no visible key.
- [ ] Recheck current Store asset and disclosure requirements before submission.
- [ ] Obtain the user's decision that testing is complete before Store submission.

## Package

Run `node --test tests/*.test.js`, `node scripts/check.mjs` and `node scripts/package.mjs`. Upload the resulting allowlisted ZIP from dist, not the entire repository.

## Reviewer instructions

1. Install MetaFrasi and open Settings.
2. Create a Gemini API key for an eligible Google project. The key is user-provided and not bundled.
3. Connect the key, choose a listed text model and save a target language.
4. On an ordinary webpage, select a non-editable passage and choose Translate.
5. Open the arrow menu to change the temporary language or request a summary.

## Permission purposes

- `storage`: store a personal API key, model list and preferences locally.
- `https://generativelanguage.googleapis.com/*`: list models and request translations directly from Google.
- Content scripts on HTTP/HTTPS pages: detect selected text and display the control and results. Do not read or transmit unselected page content.

## Data disclosure preparation

Selected website content is transmitted to Google only for the requested translation or summary. The user's API key is used to authenticate Google requests and is stored locally. Do not claim that the extension handles no data. Describe these flows accurately in the current Store questionnaire, including applicable website-content and authentication-data categories. No sale of data, unrelated advertising use or creditworthiness use is implemented.

## Planned URLs

- Website: https://kyriakosgian.github.io/MetaFrasi/
- Privacy: https://kyriakosgian.github.io/MetaFrasi/privacy.html
- Support: https://kyriakosgian.github.io/MetaFrasi/support.html
- Repository: https://github.com/KyriakosGian/MetaFrasi

# Chrome Web Store submission kit

Prepared for version 0.1.4 on October 21, 2026. Not submitted. The final live test and the owner's submission approval remain required.

## Upload files

| Field | File |
| --- | --- |
| Extension package | `dist/metafrasi-0.1.4.zip` |
| Package checksum | `dist/metafrasi-0.1.4.zip.sha256` |
| Store icon | `icons/icon128.png`, 128 × 128 PNG with transparent padding |
| Screenshot 1 | `store-assets/screenshots/translation.png`, 1280 × 800 |
| Screenshot 2 | `store-assets/screenshots/summary.png`, 1280 × 800 |
| Screenshot 3 | `store-assets/screenshots/settings.png`, 1280 × 800 |
| Small promotional tile | `store-assets/promo-small.png`, 440 × 280 |
| Listing text | [STORE-LISTING.md](STORE-LISTING.md) |

The screenshots show the actual extension with fictional sample content and mocked Gemini responses. They illustrate the interface, not live latency, token counts or translation quality. No account or real key appears in them. The editable promotional source is `promo-small.svg`. Store assets are excluded from the extension ZIP.

## Listing fields

- Name: MetaFrasi
- Language: English
- Category: Productivity, using the closest available dashboard category.
- Website: https://kyriakosgian.github.io/MetaFrasi/
- Privacy: https://kyriakosgian.github.io/MetaFrasi/privacy.html
- Support: https://kyriakosgian.github.io/MetaFrasi/support.html
- Audience: adults using Gemini for professional or business purposes. Not intended for children.

## Single purpose

Translate user-selected webpage text, or produce a translated summary of that selection, using the user's own Google Gemini API key.

## Permission justifications

**storage**: Store the user's Gemini API key, compatible model list and preferences locally. Access is restricted to trusted extension contexts. The key is not synced and is never returned to content scripts.

**https://generativelanguage.googleapis.com/**: Connect directly to Google's Gemini API to discover text models and perform only the translations or summaries explicitly requested by the user. The key is sent in an HTTPS request header.

**HTTP and HTTPS content-script access**: Detect a user's selection and display an inline translation control and result on the page where the user is reading. Editable fields are excluded. Only the selected passage is submitted after an explicit action. The extension does not upload the page URL, full page or browsing history.

**Remote code**: No. All executable code is included in the extension package. Gemini returns data rendered as plain text. No downloaded code, eval, remote JavaScript, WebAssembly or backend proxy is used.

## Privacy questionnaire

Disclose the following handled data rather than selecting "no user data":

- Website content: the selected passage is sent to Google for the requested translation or summary. User-supplied instructions are also transmitted. Unselected page content and page URLs are not sent.
- Authentication information: the user-provided API key is stored locally and sent only to Google's API for authentication.

The extension does not collect browsing history, analytics, advertising identifiers, payment data or location. Google receives normal network connection information such as the IP address. Users should not select sensitive content for unpaid Gemini services.

Data is used only to provide the described translation function. It is not sold, used for advertising, used to determine creditworthiness, or transferred for unrelated purposes. Confirm each dashboard certification against the final code and privacy policy before submitting. Do not claim that requests to Google are processing by the developer.

## Reviewer instructions

1. Install MetaFrasi and open Settings using the toolbar icon.
2. Use your own Gemini API key for an eligible Google project. No account with MetaFrasi is required and no key is bundled. Google's terms require adults, professional or business use, and Paid Services for API clients offered in the EEA, Switzerland and UK.
3. Paste the key, confirm the data disclosure and choose **Connect & save key**. A successful check displays **API key saved**. The key field becomes empty for privacy; the saved key remains in use. **Check saved key** refreshes models without generating content.
4. Choose a listed model and a default target language, then choose **Save preferences**.
5. On a regular HTTP or HTTPS article, select non-editable text and choose Translate. Review the result, original text, copy control, elapsed time and tokens.
6. Open the arrow menu for a temporary target language or translated summary. Move or resize the result window as needed.
7. In Settings, edit Translation Instructions, save, and try a new selection. Use **Remove saved key** to remove the credential.

If the Store reviewer requires a test credential, the owner must arrange a restricted reviewer key through the dashboard's private review instructions. Never put a real key in this repository or the public listing.

## Final live-user gate

- [ ] Reload version 0.1.4 in Chrome and refresh existing webpages.
- [ ] Confirm the saved-key indicator, close and reopen Settings, then run Check saved key.
- [ ] With an eligible project, translate a passage into Greek and another target language. Review language quality, bullets and a translated summary.
- [ ] Try a replacement key, a rejected key and key removal. Confirm the prior key survives a rejected replacement.
- [ ] Confirm operation beside the user's installed TypePilot on normal pages and writing fields.
- [ ] Check the result window at the user's usual display scaling.
- [ ] Confirm current model availability and account eligibility. No quota-exhausting test is necessary; quota failures have mocked coverage.
- [ ] Owner confirms testing is complete and authorizes Store submission.

## Verification and rebuilding

Run the commands in [README.md](../README.md). The dependency-free checks and packaging require no install step. The browser test uses a disposable profile, fake credentials and mocked responses. Set `METAFRASI_TYPEPILOT` to an existing TypePilot checkout for a coexistence run. Set `METAFRASI_TEST_ARTIFACTS` to an OS temporary directory. Keep only the final screenshots and current ZIP, and remove disposable reports after verification.

Automated results and remaining limitations are recorded in [VALIDATION.md](VALIDATION.md).

## Official requirements reviewed

- [Store image requirements](https://developer.chrome.com/docs/webstore/images): required icon, promotional tile and screenshots.
- [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy): single purpose, permission reasons, remote-code declaration and data use.
- [User-data requirements](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq): disclose even locally handled data.
- [Disclosure requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements).
- [Gemini API terms](https://ai.google.dev/gemini-api/terms): age, professional use, regional paid-service requirements and data handling.

The Google dashboard and policies can change. This kit supports submission preparation; it does not guarantee Store approval.

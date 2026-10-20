# Version 0.1.4 validation

Date: October 21, 2026.

## Automated checks

- 25 dependency-free unit tests passed, covering private settings, authorization, input validation, prompt construction, response parsing, model discovery, errors, cache boundaries and cancellation.
- 20 Chromium integration checks passed in a disposable profile with the TypePilot extension loaded alongside MetaFrasi.
- All Gemini calls were mocked using a fake credential. No real API key, personal browser profile or external Gemini request was used.
- The checks cover translation, summaries, temporary languages, list formatting, editable-field exclusion, window movement and resizing, narrow viewports, HTML-like model output, quota errors, denied access, unavailable models, editable instructions and key-status transitions.
- A delayed key check is tested against both key removal and a newer preference save. It cannot restore the removed key or overwrite the newer preferences.
- Opening Settings, editing instructions and moving the result window do not generate AI requests. Rejected replacement keys leave the saved key unchanged.
- The website demo and mobile layout passed. Settings were exercised in dark/light appearance and at a narrow viewport width.

Test environment: Windows, Chromium 151.0.7922.34. TypePilot coexistence was tested in the disposable profile, not in the owner's personal profile. The declared Chrome 112 minimum was reviewed against the APIs used but not exercised on a separate Chrome 112 installation.

## Assets and package

The three Store screenshots are 1280 × 800 PNG files. The small promotional tile is 440 × 280. The 128 × 128 icon has transparent padding. Images were visually inspected and show neutral sample content.

The dependency-free project check validates syntax, local HTML and Markdown links, visible versions, image dimensions and secret patterns. The ZIP is built from an explicit runtime-file list; screenshots, Store copy, tests, development files and personal browser data are excluded. A SHA-256 checksum accompanies the ZIP.

## Remaining gate

Live Gemini access, current account/model eligibility, actual translation quality and behavior in the owner's usual Chrome profile still require the short manual test in [SUBMISSION.md](SUBMISSION.md). Mocked checks do not establish live latency, quota availability or Store approval. Store submission remains pending the owner's final testing and approval.

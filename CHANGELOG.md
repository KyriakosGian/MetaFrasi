# Changelog

## 0.1.4 - 2026-10-21

- Keep the saved API key status visible after reopening Settings, distinguish paused translation and unsaved replacement keys, and provide an explicit Check saved key action.
- Preserve an unsaved replacement when saving preferences, and retain the previous saved key if replacement validation fails.
- Prevent delayed key checks from restoring a removed key or overwriting newer preferences.
- Handle an unexpected null model response with a readable error.
- Add Store screenshots, promotional artwork, README images and submission instructions.
- Clarify Google's age, professional-use and regional billing requirements.
- Extend mocked browser checks and keep promotional assets outside the extension ZIP.

## 0.1.3 - 2026-10-20

- Add editable Translation Instructions in Settings, with a visible default and Reset to default.
- Apply saved instructions to translation and summary requests while retaining the action, target language and structured response rules.
- Store instructions locally in trusted extension storage. Do not expose them to content scripts or send a request when editing or saving.
- Clear cached results and cancel pending requests when instructions change.
- Keep Settings actions available after reloading a section link.
- Preserve existing settings, document the additional stored and transmitted preference, and add unit and mocked browser coverage.
- Allow browser-test artifacts to be written outside the project using METAFRASI_TEST_ARTIFACTS.

## 0.1.2 - 2026-10-20

- Widen the translation window from 390 to 460 pixels.
- Drag the title bar to move the window and the bottom-right handle to resize it.
- Support arrow-key movement and resizing, with Shift for one-pixel adjustments.
- Keep controls within the viewport and scroll long results inside the resized window.
- Retain the chosen size until the page reloads and preserve a moved position when a pending translation finishes.
- Add browser checks for pointer interactions, keyboard controls, viewport limits and delayed responses.

## 0.1.1 - 2026-10-19

- Reduce the selection button size and place the smaller result title on one line.
- Show elapsed milliseconds, the model and total tokens reported by Google. Cached results display zero new tokens.
- Preserve visible HTML list bullets, ordered numbering, nested indentation and surrounding paragraph breaks in selected text.
- Ask Gemini to retain list structure in full translations and use lists for summaries of list-based sources.
- Add browser coverage for nested lists, partial selections, custom numbering and hidden-content exclusion.

## 0.1.0 - 2026-10-19

Initial testing release.

- Translate selected webpage text into a saved target language.
- Temporarily select another language or request a translated summary.
- Connect a personal Gemini key and discover text models.
- Add dark, light and system themes, plain-text results, cancellation and temporary caching.
- Include a static presentation website, privacy policy, support page, tests and release packaging.
- Chrome Web Store submission remains pending testing.

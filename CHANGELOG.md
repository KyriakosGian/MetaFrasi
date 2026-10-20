# Changelog

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

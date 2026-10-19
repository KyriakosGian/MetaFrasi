const result = document.getElementById('demo-result');
const options = document.getElementById('demo-options');
function show(summary) {
  document.getElementById('demo-title').textContent = summary ? 'Summary · English' : 'Translation · English';
  document.getElementById('demo-output').textContent = summary
    ? 'A simple reading tool helps you understand another language without losing your place.'
    : 'Reading in another language opens up new perspectives. A simple tool can help you understand the essentials without interrupting your reading.';
  result.hidden = false; options.hidden = true; document.getElementById('demo-menu').setAttribute('aria-expanded', 'false');
}
document.getElementById('demo-translate').addEventListener('click', () => show(false));
document.getElementById('demo-summary').addEventListener('click', () => show(true));
document.getElementById('demo-menu').addEventListener('click', () => { options.hidden = !options.hidden; document.getElementById('demo-menu').setAttribute('aria-expanded', String(!options.hidden)); });
document.getElementById('demo-close').addEventListener('click', () => { result.hidden = true; });

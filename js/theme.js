// Follows the system light/dark setting until the user picks one explicitly.
const KEY = 'theme';
const media = matchMedia('(prefers-color-scheme: dark)');

function stored() {
    try { return localStorage.getItem(KEY); } catch { return null; }
}

export function initTheme(button) {
    const root = document.documentElement;
    const current = () => root.dataset.theme || (media.matches ? 'dark' : 'light');
    const label = () => {
        const dark = current() === 'dark';
        button.textContent = dark ? '☀' : '☾';
        button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
        button.title = button.getAttribute('aria-label');
    };

    const saved = stored();
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
    label();
    media.addEventListener('change', label);

    button.addEventListener('click', () => {
        const next = current() === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try { localStorage.setItem(KEY, next); } catch { /* private mode: keep for this visit only */ }
        label();
    });
}

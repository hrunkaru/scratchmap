// Accessible tabs (arrow keys move between tabs); the chosen tab is remembered.
const KEY = 'tab';

export function initTabs(tabs) {
    const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));

    function select(index, focus = false) {
        tabs.forEach((tab, i) => {
            const on = i === index;
            tab.setAttribute('aria-selected', String(on));
            tab.tabIndex = on ? 0 : -1;
            panels[i].hidden = !on;
        });
        if (focus) tabs[index].focus();
        try { localStorage.setItem(KEY, tabs[index].id); } catch { /* storage unavailable */ }
    }

    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(i));
        tab.addEventListener('keydown', event => {
            const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
            if (!step) return;
            event.preventDefault();
            select((i + step + tabs.length) % tabs.length, true);
        });
    });

    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
    select(Math.max(0, tabs.findIndex(t => t.id === saved)));
}

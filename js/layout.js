// Desktop: the sidebar can be collapsed to give the map the full width.
// Phone: the sidebar becomes a bottom sheet that can be tapped or dragged open.
const KEY = 'panel';
const phone = matchMedia('(max-width: 760px)');

export function initLayout({ app, sidebar, panelToggle, handle }, { store }) {
    // Desktop collapse (remembered between visits).
    const setCollapsed = collapsed => {
        app.classList.toggle('is-collapsed', collapsed);
        panelToggle.setAttribute('aria-expanded', String(!collapsed));
        panelToggle.setAttribute('aria-label', collapsed ? 'Show side panel' : 'Hide side panel');
        panelToggle.title = panelToggle.getAttribute('aria-label');
    };
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
    setCollapsed(saved === 'collapsed');
    panelToggle.addEventListener('click', () => {
        const collapsed = !app.classList.contains('is-collapsed');
        setCollapsed(collapsed);
        try { localStorage.setItem(KEY, collapsed ? 'collapsed' : 'open'); } catch { /* ignore */ }
    });

    // Phone bottom sheet.
    let open = false;
    const setOpen = value => {
        open = value;
        sidebar.classList.toggle('is-open', open);
        sidebar.style.transform = '';
        handle.setAttribute('aria-expanded', String(open));
    };
    setOpen(false);

    let drag = null;
    handle.addEventListener('pointerdown', event => {
        if (!phone.matches) return;
        drag = { y: event.clientY, moved: false, closedOffset: sidebar.offsetHeight - handle.offsetHeight };
        handle.setPointerCapture(event.pointerId);
        sidebar.classList.add('is-dragging');
    });
    handle.addEventListener('pointermove', event => {
        if (!drag) return;
        const dy = event.clientY - drag.y;
        if (Math.abs(dy) > 4) drag.moved = true;
        const base = open ? 0 : drag.closedOffset;
        const y = Math.min(drag.closedOffset, Math.max(0, base + dy));
        sidebar.style.transform = `translateY(${y}px)`;
    });
    const endDrag = event => {
        if (!drag) return;
        const dy = event.clientY - drag.y;
        sidebar.classList.remove('is-dragging');
        const moved = drag.moved;
        drag = null;
        if (!moved) setOpen(!open);
        else if (dy < -40) setOpen(true);
        else if (dy > 40) setOpen(false);
        else setOpen(open);
    };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    // Keyboard users activate the handle with Enter/Space (pointer taps are handled above).
    handle.addEventListener('click', event => {
        if (event.detail === 0) setOpen(!open);
    });

    // Picking a country in the list closes the sheet so the map is visible.
    let lastSelected = store.get().selected;
    store.subscribe(s => {
        if (s.selected && s.selected !== lastSelected && open && phone.matches) setOpen(false);
        lastSelected = s.selected;
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && open && !store.get().selected) setOpen(false);
    });
    phone.addEventListener('change', () => setOpen(false));
}

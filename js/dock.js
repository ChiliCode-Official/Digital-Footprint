/**
 * GhostKey — Shared Mobile Dock & Search Overlay
 * Handles: cart badge, search overlay, friends panel toggle
 * Safe to include on every page.
 */

(function () {
    'use strict';

    /* ──────────────────────────────────
       1. CART BADGE (reads from localStorage)
    ─────────────────────────────────── */
    function updateCartBadge() {
        const badge = document.getElementById('dock-cart-badge');
        if (!badge) return;
        try {
            const cart = JSON.parse(localStorage.getItem('gk-cart') || '[]');
            const total = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
            if (total > 0) {
                badge.textContent = total > 99 ? '99+' : total;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        } catch (e) {
            badge.classList.add('hidden');
        }
    }
    updateCartBadge();
    window.addEventListener('storage', updateCartBadge);
    // Also update when custom event fired from cart.js
    document.addEventListener('gk-cart-updated', updateCartBadge);

    /* ──────────────────────────────────
       2. SEARCH OVERLAY (mobile) — Recent Searches
    ─────────────────────────────────── */
    const searchOverlay = document.getElementById('gk-search-overlay');
    const searchOverlayInput = document.getElementById('gk-search-overlay-input');
    const dockSearchBtn = document.getElementById('dock-search-btn');
    const searchCancelBtn = document.getElementById('search-cancel-btn');

    const RECENT_KEY = 'gk-recent-searches';
    const MAX_RECENT = 10;

    /* ── localStorage helpers ── */
    function getRecent() {
        try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
        catch (e) { return []; }
    }

    function saveRecent(term) {
        if (!term || !term.trim()) return;
        let list = getRecent().filter(s => s.toLowerCase() !== term.toLowerCase());
        list.unshift(term.trim());
        if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (e) {}
    }

    function deleteRecent(term) {
        const list = getRecent().filter(s => s !== term);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (e) {}
    }

    /* ── Render the suggestions panel ── */
    function renderSuggestions(query) {
        const container = document.getElementById('gk-search-suggestions');
        if (!container) return;
        const q = (query || '').trim();
        const recent = getRecent();

        if (!q) {
            /* ── Empty input → show recent searches ── */
            if (recent.length === 0) {
                container.innerHTML = `
                    <div class="gk-search-empty">
                        <i class="fa-regular fa-clock" style="font-size:1.8rem; color:rgba(255,255,255,0.15); margin-bottom:8px;"></i>
                        <p style="color:rgba(255,255,255,0.3); font-size:0.85rem; margin:0;">Sin búsquedas recientes</p>
                    </div>`;
                return;
            }
            let html = `<div class="gk-recent-header">
                <span>Recientes</span>
                <button class="gk-recent-clear-all" id="gk-clear-all-btn">Borrar todo</button>
            </div>`;
            html += recent.map(s => `
                <div class="gk-search-suggestion gk-recent-row">
                    <a href="catalogo.html?search=${encodeURIComponent(s)}" class="gk-recent-link" data-term="${escSugg(s)}">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <span>${escSugg(s)}</span>
                    </a>
                    <button class="gk-recent-delete" data-term="${escSugg(s)}" title="Eliminar" aria-label="Eliminar búsqueda">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>`).join('');
            container.innerHTML = html;

            /* Delete individual */
            container.querySelectorAll('.gk-recent-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteRecent(btn.dataset.term);
                    renderSuggestions('');
                });
            });

            /* Save on link click */
            container.querySelectorAll('.gk-recent-link').forEach(link => {
                link.addEventListener('click', () => {
                    saveRecent(link.dataset.term);
                });
            });

            /* Clear all */
            const clearAllBtn = document.getElementById('gk-clear-all-btn');
            if (clearAllBtn) {
                clearAllBtn.addEventListener('click', () => {
                    try { localStorage.removeItem(RECENT_KEY); } catch (e) {}
                    renderSuggestions('');
                });
            }
        } else {
            /* ── Typing → show filtered recent + "Buscar X" row ── */
            const ql = q.toLowerCase();
            const filtered = recent.filter(s => s.toLowerCase().includes(ql));
            let html = '';

            filtered.forEach(s => {
                html += `
                    <div class="gk-search-suggestion gk-recent-row">
                        <a href="catalogo.html?search=${encodeURIComponent(s)}" class="gk-recent-link" data-term="${escSugg(s)}">
                            <i class="fa-solid fa-clock-rotate-left"></i>
                            <span>${escSugg(s)}</span>
                        </a>
                        <button class="gk-recent-delete" data-term="${escSugg(s)}" title="Eliminar" aria-label="Eliminar">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>`;
            });

            /* Always show the "Buscar X" option */
            html += `
                <a class="gk-search-suggestion gk-search-go" href="catalogo.html?search=${encodeURIComponent(q)}" data-term="${escSugg(q)}">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <span>Buscar &ldquo;<strong style="color:#fff">${escSugg(q)}</strong>&rdquo;</span>
                </a>`;

            container.innerHTML = html;

            container.querySelectorAll('.gk-recent-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteRecent(btn.dataset.term);
                    renderSuggestions(searchOverlayInput ? searchOverlayInput.value : '');
                });
            });

            /* Save on any search click */
            container.querySelectorAll('.gk-recent-link, .gk-search-go').forEach(link => {
                link.addEventListener('click', () => {
                    saveRecent(link.dataset.term);
                });
            });
        }
    }

    /* Escape helper to avoid XSS in innerHTML */
    function escSugg(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function openSearchOverlay() {
        if (!searchOverlay) {
            window.location.href = 'catalogo.html';
            return;
        }
        searchOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            if (searchOverlayInput) searchOverlayInput.focus();
            renderSuggestions('');
        }, 300);
    }

    function closeSearchOverlay() {
        if (!searchOverlay) return;
        searchOverlay.classList.remove('open');
        document.body.style.overflow = '';
        if (searchOverlayInput) searchOverlayInput.value = '';
    }

    function doSearch() {
        const q = searchOverlayInput ? searchOverlayInput.value.trim() : '';
        if (q) {
            saveRecent(q);
            window.location.href = `catalogo.html?search=${encodeURIComponent(q)}`;
        }
    }

    if (dockSearchBtn) {
        dockSearchBtn.addEventListener('click', openSearchOverlay);
    }
    if (searchCancelBtn) {
        searchCancelBtn.addEventListener('click', closeSearchOverlay);
    }
    if (searchOverlayInput) {
        searchOverlayInput.addEventListener('input', (e) => {
            renderSuggestions(e.target.value);
        });
        searchOverlayInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSearch();
            if (e.key === 'Escape') closeSearchOverlay();
        });
    }
    if (searchOverlay) {
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) closeSearchOverlay();
        });
    }

    /* Save search when coming back from catalog with ?search= */
    (function() {
        const params = new URLSearchParams(window.location.search);
        const s = params.get('search');
        if (s) saveRecent(s);
    })();

    /* ──────────────────────────────────
       3. FRIENDS PANEL (navbar button)
       Works on any page that has the panel HTML,
       gracefully skips on pages without it.
    ─────────────────────────────────── */
    const friendsPanel = document.getElementById('friends-panel');
    const friendsBackdrop = document.getElementById('friends-backdrop');

    function openFriends() {
        if (!friendsPanel) {
            // Redirect to perfil on pages without the panel
            window.location.href = 'perfil.html';
            return;
        }
        friendsPanel.classList.add('open');
        if (friendsBackdrop) friendsBackdrop.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeFriends() {
        if (!friendsPanel) return;
        friendsPanel.classList.remove('open');
        if (friendsBackdrop) friendsBackdrop.classList.remove('open');
        document.body.style.overflow = '';
    }

    // Navbar button
    const navFriendsBtn = document.getElementById('nav-friends-btn');
    if (navFriendsBtn) {
        navFriendsBtn.addEventListener('click', openFriends);
    }

    // Dock friends button (if still present on any page)
    const dockFriendsBtn = document.getElementById('dock-friends-btn');
    if (dockFriendsBtn) {
        dockFriendsBtn.addEventListener('click', openFriends);
    }

    // Close button inside panel
    const closeFriendsBtn = document.getElementById('close-friends-panel');
    if (closeFriendsBtn) {
        closeFriendsBtn.addEventListener('click', closeFriends);
    }

    // Backdrop click
    if (friendsBackdrop) {
        friendsBackdrop.addEventListener('click', closeFriends);
    }

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeFriends();
            closeSearchOverlay();
        }
    });

    /* ──────────────────────────────────
       4. SEARCH REDIRECT (top navbar desktop)
    ─────────────────────────────────── */
    const mainSearchInput = document.getElementById('main-search-input');
    const mainSearchBtn = document.getElementById('main-search-btn');

    function doTopSearch() {
        const q = (mainSearchInput?.value || '').trim();
        if (q) window.location.href = `catalogo.html?search=${encodeURIComponent(q)}`;
    }

    if (mainSearchBtn) {
        mainSearchBtn.addEventListener('click', doTopSearch);
    }
    if (mainSearchInput) {
        mainSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doTopSearch();
        });
    }

})();

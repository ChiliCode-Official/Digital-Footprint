import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

setPersistence(auth, browserLocalPersistence).catch(console.error);

const PANEL_KEY = 'gkey-friends-panel-collapsed';

const dashboard = document.querySelector('.dashboard-container');
const panel = document.getElementById('friends-panel');
const toggleBtn = document.getElementById('friends-panel-toggle');
const reopenTab = document.getElementById('friends-panel-tab');

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function setPanelCollapsed(collapsed) {
    if (!dashboard || !panel) return;

    dashboard.classList.toggle('friends-panel-collapsed', collapsed);
    panel.classList.toggle('is-collapsed', collapsed);

    if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', String(!collapsed));
        toggleBtn.setAttribute(
            'aria-label',
            collapsed ? 'Mostrar panel de amigos' : 'Ocultar panel de amigos'
        );
    }

    localStorage.setItem(PANEL_KEY, collapsed ? '1' : '0');
}

async function loadRealFriends(currentUser) {
    const friendsContainer = document.getElementById('friends-list');
    const refInput = document.getElementById('ref-link-input');
    const referralBox = document.querySelector('.referral-box');

    // Update referral link
    if (currentUser) {
        const pathname = window.location.pathname;
        const basePath = pathname.substring(0, pathname.lastIndexOf('/') + 1);
        const refUrl = `${window.location.origin}${basePath}index.html?ref=${currentUser.uid}`;
        if (refInput) refInput.value = refUrl;

        // Upgrade referral button to Uiverse marcelodolza animated button if not upgraded yet
        if (referralBox && !document.getElementById('btn-copy-referral')) {
            const oldBox = referralBox.querySelector('div[style*="display:flex"]');
            if (oldBox) oldBox.style.display = 'none';

            const btnHTML = `
                <button class="button" id="btn-copy-referral" type="button">
                  <div class="outline"></div>
                  <div class="state state--default">
                    <div class="icon">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g style="filter: url(#shadow)">
                          <path d="M14.2199 21.63C13.0399 21.63 11.3699 20.8 10.0499 16.83L9.32988 14.67L7.16988 13.95C3.20988 12.63 2.37988 10.96 2.37988 9.78001C2.37988 8.61001 3.20988 6.93001 7.16988 5.60001L15.6599 2.77001C17.7799 2.06001 19.5499 2.27001 20.6399 3.35001C21.7299 4.43001 21.9399 6.21001 21.2299 8.33001L18.3999 16.82C17.0699 20.8 15.3999 21.63 14.2199 21.63ZM7.63988 7.03001C4.85988 7.96001 3.86988 9.06001 3.86988 9.78001C3.86988 10.5 4.85988 11.6 7.63988 12.52L10.1599 13.36C10.3799 13.43 10.5599 13.61 10.6299 13.83L11.4699 16.35C12.3899 19.13 13.4999 20.12 14.2199 20.12C14.9399 20.12 16.0399 19.13 16.9699 16.35L19.7999 7.86001C20.3099 6.32001 20.2199 5.06001 19.5699 4.41001C18.9199 3.76001 17.6599 3.68001 16.1299 4.19001L7.63988 7.03001Z" fill="currentColor"></path>
                        </g>
                        <defs>
                          <filter id="shadow" x="-4" y="-4" width="32" height="32" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                            <feDropShadow dx="0" dy="0" stdDeviation="2" flood-opacity="0.5" />
                          </filter>
                        </defs>
                      </svg>
                    </div>
                    <p>
                      <span style="--i:0">C</span><span style="--i:1">o</span><span style="--i:2">p</span><span style="--i:3">i</span><span style="--i:4">a</span><span style="--i:5">r</span>
                      <span style="--i:6">&nbsp;</span><span style="--i:7">L</span><span style="--i:8">i</span><span style="--i:9">n</span><span style="--i:10">k</span>
                    </p>
                  </div>
                  <div class="state state--sent">
                    <div class="icon">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="1em" width="1em" stroke-width="0.5px" stroke="black">
                        <path fill="currentColor" d="M12 22.75C6.07 22.75 1.25 17.93 1.25 12C1.25 6.07 6.07 1.25 12 1.25C17.93 1.25 22.75 6.07 22.75 12C22.75 17.93 17.93 22.75 12 22.75ZM12 2.75C6.9 2.75 2.75 6.9 2.75 12C2.75 17.1 6.9 21.25 12 21.25C17.1 21.25 21.25 17.1 21.25 12C21.25 6.9 17.1 2.75 12 2.75Z"></path>
                        <path fill="currentColor" d="M10.5795 15.5801C10.3795 15.5801 10.1895 15.5001 10.0495 15.3601L7.21945 12.5301C6.92945 12.2401 6.92945 11.7601 7.21945 11.4701C7.50945 11.1801 7.98945 11.1801 8.27945 11.4701L10.5795 13.7701L15.7195 8.6301C16.0095 8.3401 16.4895 8.3401 16.7795 8.6301C17.0695 8.9201 17.0695 9.4001 16.7795 9.6901L11.1095 15.3601C10.9695 15.5001 10.7795 15.5801 10.5795 15.5801Z"></path>
                      </svg>
                    </div>
                    <p>
                      <span style="--i:5">C</span><span style="--i:6">o</span><span style="--i:7">p</span><span style="--i:8">i</span><span style="--i:9">a</span><span style="--i:10">d</span><span style="--i:11">o</span>
                    </p>
                  </div>
                </button>
            `;
            referralBox.insertAdjacentHTML('beforeend', btnHTML);

            const refBtn = document.getElementById('btn-copy-referral');
            if (refBtn) {
                refBtn.addEventListener('click', () => {
                    const fallbackCopy = () => {
                        if (refInput) {
                            refInput.select();
                            try {
                                document.execCommand('copy');
                                refBtn.classList.add('copied');
                                setTimeout(() => refBtn.classList.remove('copied'), 3000);
                            } catch (e) {
                                console.error("Fallback copy error:", e);
                            }
                        }
                    };

                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(refUrl).then(() => {
                            refBtn.classList.add('copied');
                            setTimeout(() => refBtn.classList.remove('copied'), 3000);
                        }).catch(err => {
                            console.warn("Clipboard API failed, using fallback:", err);
                            fallbackCopy();
                        });
                    } else {
                        fallbackCopy();
                    }
                });
            }
        }
    }

    if (!friendsContainer) return;

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        friendsContainer.innerHTML = '';

        let count = 0;
        querySnapshot.forEach((docSnap) => {
            const uData = docSnap.data();
            const uid = docSnap.id;

            // Don't list self if logged in
            if (currentUser && uid === currentUser.uid) return;

            count++;
            const displayName = uData.displayName || uData.email || "Usuario GhostKey";
            const avatarUrl = uData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=A182E8&color=fff`;

            friendsContainer.innerHTML += `
                <div class="list-item" style="display:flex; align-items:center; gap:10px; margin-bottom: 8px;">
                    <div class="list-icon" style="width:36px; height:36px; border-radius:50%; overflow:hidden; flex-shrink:0;">
                        <img src="${avatarUrl}" alt="${escapeHtml(displayName)}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div class="list-info" style="flex:1; overflow:hidden;">
                        <p class="list-name" style="font-size:0.85rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(displayName)}</p>
                        <p class="list-desc" style="font-size:0.75rem; color:var(--success);"><i class="fa-solid fa-circle" style="font-size:0.5rem;"></i> En línea</p>
                    </div>
                </div>
            `;
        });

        if (count === 0) {
            friendsContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">No se encontraron otros usuarios registrados aún.</p>`;
        }
    } catch (e) {
        console.error("Error loading real friends:", e);
        friendsContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">Conéctate para ver la lista de miembros.</p>`;
    }
}

function initFriendsPanel() {
    if (!panel || !dashboard) return;

    const saved = localStorage.getItem(PANEL_KEY);
    const isCollapsed = saved === null ? true : saved === '1';
    setPanelCollapsed(isCollapsed);

    toggleBtn?.addEventListener('click', () => {
        const currentlyCollapsed = panel.classList.contains('is-collapsed');
        setPanelCollapsed(!currentlyCollapsed);
    });

    reopenTab?.addEventListener('click', () => setPanelCollapsed(false));

    document.querySelectorAll('.fa-users, [data-action="toggle-friends"]').forEach(icon => {
        const parentBtn = icon.closest('button, a, .dock-item');
        if (parentBtn && parentBtn !== toggleBtn) {
            parentBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const currentlyCollapsed = panel.classList.contains('is-collapsed');
                setPanelCollapsed(!currentlyCollapsed);
            });
        }
    });

    onAuthStateChanged(auth, (user) => {
        loadRealFriends(user);
    });

    const searchFriendInput = document.getElementById('search-friend-input');
    if (searchFriendInput) {
        searchFriendInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const friendsContainer = document.getElementById('friends-list');
            if (friendsContainer) {
                const items = friendsContainer.querySelectorAll('.list-item');
                items.forEach(item => {
                    const name = item.querySelector('.list-name').textContent.toLowerCase();
                    if (name.includes(term)) {
                        item.style.display = 'flex';
                    } else {
                        item.style.display = 'none';
                    }
                });
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initFriendsPanel();
});

window.addEventListener('pageshow', (event) => {
    if (event.persisted && auth.currentUser) {
        loadRealFriends(auth.currentUser);
    }
});

export { setPanelCollapsed };

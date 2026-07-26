import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

async function searchAndAddFriend(term, currentUser) {
    const searchResults = document.getElementById('search-friend-results');
    if (!searchResults) return;
    if (!currentUser) {
        searchResults.innerHTML = `<p style="color:var(--warning);font-size:0.8rem;text-align:center;">Inicia sesión para agregar amigos.</p>`;
        return;
    }
    const rawTerm = term.trim();
    if (!rawTerm) {
        searchResults.innerHTML = '';
        return;
    }

    searchResults.innerHTML = `<p style="color:var(--text-muted);font-size:0.8rem;text-align:center;">Buscando usuario...</p>`;

    try {
        let foundUser = null;
        let foundUid = null;

        if (rawTerm.includes('@')) {
            // Query by exact email (lowercase)
            const cleanEmail = rawTerm.toLowerCase();
            const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
            const emailSnap = await getDocs(q);
            if (!emailSnap.empty) {
                const docSnap = emailSnap.docs[0];
                foundUser = docSnap.data();
                foundUid = docSnap.id;
            }
        } else {
            // UID lookup: preserve exact case!
            const uidSnap = await getDoc(doc(db, 'users', rawTerm));
            if (uidSnap.exists()) {
                foundUser = uidSnap.data();
                foundUid = uidSnap.id;
            }
        }

        if (!foundUser || foundUid === currentUser.uid) {
            searchResults.innerHTML = `<p style="color:var(--danger);font-size:0.8rem;text-align:center;">No se encontró ningún usuario con ese correo/UID exacto.</p>`;
            return;
        }

        const name = foundUser.displayName || foundUser.email || 'Usuario';
        const avatar = foundUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name.split('@')[0])}&background=A182E8&color=fff`;

        searchResults.innerHTML = `
            <div style="background:var(--bg-card);border:1px solid var(--glass-border);padding:10px;border-radius:10px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;overflow:hidden;">
                    <img src="${avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
                    <span style="font-size:0.8rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</span>
                </div>
                <button id="btn-send-friend-req" style="background:var(--accent-primary);color:white;border:none;padding:5px 10px;border-radius:8px;font-size:0.75rem;cursor:pointer;font-weight:600;">+ Agregar</button>
            </div>
        `;

        const btnSend = document.getElementById('btn-send-friend-req');
        if (btnSend) {
            btnSend.onclick = async () => {
                btnSend.disabled = true;
                btnSend.textContent = 'Enviando...';
                try {
                    const friendshipId = [currentUser.uid, foundUid].sort().join('_');
                    await setDoc(doc(db, 'friendships', friendshipId), {
                        uid1: currentUser.uid,
                        uid2: foundUid,
                        status: 'solicitada',
                        requesterEmail: currentUser.email || '',
                        recipientEmail: foundUser.email || ''
                    });
                    searchResults.innerHTML = `<p style="color:var(--success);font-size:0.8rem;text-align:center;">¡Solicitud enviada a ${escapeHtml(name)}!</p>`;
                    loadRealFriends(currentUser);
                } catch(e) {
                    console.error('Error sending friend request:', e);
                    searchResults.innerHTML = `<p style="color:var(--danger);font-size:0.8rem;text-align:center;">Error al enviar solicitud.</p>`;
                }
            };
        }
    } catch(e) {
        console.error('Error searching friend:', e);
        searchResults.innerHTML = `<p style="color:var(--danger);font-size:0.8rem;text-align:center;">Error en la búsqueda.</p>`;
    }
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

        // Upgrade referral copy button
        if (referralBox && !document.getElementById('btn-copy-referral')) {
            const oldBox = referralBox.querySelector('div[style*="display:flex"]');
            if (oldBox) oldBox.style.display = 'none';

            const btnHTML = `
                <button class="button" id="btn-copy-referral" type="button">
                  <div class="outline"></div>
                  <div class="state state--default">
                    <p>Copiar Link</p>
                  </div>
                  <div class="state state--sent">
                    <p>Copiado</p>
                  </div>
                </button>
            `;
            referralBox.insertAdjacentHTML('beforeend', btnHTML);

            const refBtn = document.getElementById('btn-copy-referral');
            if (refBtn) {
                refBtn.addEventListener('click', () => {
                    if (refInput) {
                        navigator.clipboard.writeText(refInput.value).then(() => {
                            refBtn.classList.add('state--sent');
                            setTimeout(() => refBtn.classList.remove('state--sent'), 2000);
                        }).catch(() => {
                            refInput.select();
                            document.execCommand('copy');
                        });
                    }
                });
            }
        }
    }

    if (!friendsContainer) return;
    if (!currentUser) {
        friendsContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">Inicia sesión para ver tu lista de amigos.</p>`;
        return;
    }

    try {
        friendsContainer.innerHTML = `<p style="text-align:center;color:var(--text-muted);font-size:0.8rem;">Cargando amigos...</p>`;

        const [snap1, snap2] = await Promise.all([
            getDocs(query(collection(db, 'friendships'), where('uid1', '==', currentUser.uid))),
            getDocs(query(collection(db, 'friendships'), where('uid2', '==', currentUser.uid)))
        ]);

        const allDocs = [...snap1.docs, ...snap2.docs];
        friendsContainer.innerHTML = '';

        let count = 0;
        for (const docSnap of allDocs) {
            const f = docSnap.data();
            const fId = docSnap.id;
            const targetUid = f.uid1 === currentUser.uid ? f.uid2 : f.uid1;

            if (f.status === 'solicitada' && f.uid2 === currentUser.uid) {
                count++;
                const uDoc = await getDoc(doc(db, 'users', targetUid));
                const uData = uDoc.exists() ? uDoc.data() : { email: f.requesterEmail };
                const name = uData.displayName || uData.email || 'Usuario';

                friendsContainer.innerHTML += `
                    <div style="background:rgba(234,179,8,0.1);border:1px solid var(--warning);padding:8px;border-radius:8px;margin-bottom:8px;">
                        <p style="font-size:0.75rem;color:var(--warning);margin-bottom:4px;"><i class="fa-solid fa-user-clock"></i> Solicitud de: <strong>${escapeHtml(name)}</strong></p>
                        <div style="display:flex;gap:6px;">
                            <button class="btn-accept-friend" data-id="${fId}" style="background:var(--success);color:white;border:none;padding:4px 8px;border-radius:5px;font-size:0.7rem;cursor:pointer;flex:1;">Aceptar</button>
                            <button class="btn-reject-friend" data-id="${fId}" style="background:var(--danger);color:white;border:none;padding:4px 8px;border-radius:5px;font-size:0.7rem;cursor:pointer;flex:1;">Rechazar</button>
                        </div>
                    </div>
                `;
            } else if (f.status === 'aceptada') {
                count++;
                const uDoc = await getDoc(doc(db, 'users', targetUid));
                const uData = uDoc.exists() ? uDoc.data() : { email: f.recipientEmail };
                const name = uData.displayName || uData.email || 'Amigo';
                const avatar = uData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name.split('@')[0])}&background=A182E8&color=fff`;

                friendsContainer.innerHTML += `
                    <div class="list-item" style="display:flex; align-items:center; gap:10px; margin-bottom: 8px;">
                        <div class="list-icon" style="width:36px; height:36px; border-radius:50%; overflow:hidden; flex-shrink:0;">
                            <img src="${avatar}" alt="${escapeHtml(name)}" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                        <div class="list-info" style="flex:1; overflow:hidden;">
                            <p class="list-name" style="font-size:0.85rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(name)}</p>
                            <p class="list-desc" style="font-size:0.75rem; color:var(--success);"><i class="fa-solid fa-circle" style="font-size:0.5rem;"></i> Amigo</p>
                        </div>
                    </div>
                `;
            }
        }

        // Attach Accept/Reject Handlers
        document.querySelectorAll('.btn-accept-friend').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                await updateDoc(doc(db, 'friendships', id), { status: 'aceptada' });
                loadRealFriends(currentUser);
            };
        });

        document.querySelectorAll('.btn-reject-friend').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                await updateDoc(doc(db, 'friendships', id), { status: 'rechazada' });
                loadRealFriends(currentUser);
            };
        });

        if (count === 0) {
            friendsContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.82rem;">No tienes amigos ni solicitudes pendientes.<br>Usa el buscador superior para agregar por correo/UID.</p>`;
        }
    } catch (e) {
        console.error("Error loading real friends:", e);
        friendsContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">Error al cargar amigos.</p>`;
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
        // Ensure search results box container exists below search input
        let searchResults = document.getElementById('search-friend-results');
        if (!searchResults) {
            searchResults = document.createElement('div');
            searchResults.id = 'search-friend-results';
            searchResults.style.marginTop = '8px';
            searchFriendInput.parentNode.appendChild(searchResults);
        }

        searchFriendInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchAndAddFriend(searchFriendInput.value, auth.currentUser);
            }
        });

        const searchBtn = document.getElementById('search-friend-btn');
        if (searchBtn) {
            searchBtn.onclick = () => {
                searchAndAddFriend(searchFriendInput.value, auth.currentUser);
            };
        }
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

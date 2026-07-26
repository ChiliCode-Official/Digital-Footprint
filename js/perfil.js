import { auth, db, provider } from './firebase-config.js';
import {
    onAuthStateChanged,
    signOut,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc, getDoc, collection, addDoc, setDoc, updateDoc,
    deleteDoc, increment, serverTimestamp, query, where, getDocs, runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = 'lrodricg30@gmail.com';
let currentUser = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const authGuard     = document.getElementById('auth-guard');
const profileContent= document.getElementById('profile-content');
const clientView    = document.getElementById('client-view');
const adminView     = document.getElementById('admin-view');
const btnLogout     = document.getElementById('logout-btn');
const cardUid       = document.getElementById('card-uid');
const cardName      = document.getElementById('card-name');
const userBalanceEl = document.getElementById('user-balance');
const userAvatars   = document.querySelectorAll('.user-avatar');

// ─── Show / Hide helpers ──────────────────────────────────────────────────────
function showGuard() {
    if (authGuard)      authGuard.style.display      = 'block';
    if (profileContent) profileContent.style.display = 'none';
    if (btnLogout)      btnLogout.style.display       = 'none';
}

function showProfile(user) {
    try {
        if (authGuard)      authGuard.style.display      = 'none';
        if (profileContent) profileContent.style.display = 'block';
        if (btnLogout)      btnLogout.style.display       = 'inline-block';

        if (cardName) cardName.textContent = user.displayName || user.email || '';
        if (cardUid)  cardUid.textContent  = user.uid || '';

        userAvatars.forEach(img => {
            if (img) {
                const nameStr = user.displayName || (user.email ? user.email.split('@')[0] : 'GhostKey');
                img.src = user.photoURL ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(nameStr)}&background=A182E8&color=fff`;
            }
        });

        const mainCard = document.querySelector('.main-container');
        const hintEl = document.getElementById('copy-uid-hint');
        if (mainCard) {
            mainCard.style.cursor = 'pointer';
            mainCard.onclick = () => {
                if (user && user.uid) {
                    navigator.clipboard.writeText(user.uid).then(() => {
                        if (hintEl) {
                            const origHTML = hintEl.innerHTML;
                            hintEl.innerHTML = `<i class="fa-solid fa-check" style="color:var(--success);"></i> <strong style="color:var(--success);">¡UID copiado al portapapeles!</strong>`;
                            setTimeout(() => { hintEl.innerHTML = origHTML; }, 2500);
                        }
                    }).catch(() => {
                        alert("UID de amigo: " + user.uid);
                    });
                }
            };
        }
    } catch(e) {
        console.error('Error rendering profile header:', e);
    }

    try {
        if (user.email === ADMIN_EMAIL) {
            if (adminView)  adminView.style.display  = 'block';
            if (clientView) clientView.style.display = 'none';
            loadAdminData();
        } else {
            if (adminView)  adminView.style.display  = 'none';
            if (clientView) clientView.style.display = 'block';
            loadClientData(user.uid);
        }
    } catch(e) {
        console.error('Error switching profile view:', e);
    }
}

// ─── Auth State ───────────────────────────────────────────────────────────────
setPersistence(auth, browserLocalPersistence).catch(console.error);

onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        showProfile(user);
    } else {
        currentUser = null;
        showGuard();
    }
});

// Handle redirect result (from signInWithRedirect)
getRedirectResult(auth).then(async result => {
    if (result && result.user) {
        await ensureUserDoc(result.user);
    }
}).catch(err => {
    if (err.code !== 'auth/no-auth-event') console.error('Redirect result error:', err);
});

// ─── Logout ───────────────────────────────────────────────────────────────────
window.__perfil_logout = function() {
    signOut(auth)
        .then(() => { window.location.href = 'index.html'; })
        .catch(e => { console.error('Logout error:', e); alert('Error al cerrar sesión: ' + e.message); });
};

// Also attach via addEventListener as belt & suspenders
if (btnLogout) {
    btnLogout.addEventListener('click', window.__perfil_logout);
}

// ─── Google Login ─────────────────────────────────────────────────────────────
async function ensureUserDoc(user) {
    try {
        const ref  = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            await setDoc(ref, {
                email: user.email,
                balance: 0,
                wishlist: [],
                cart: {},
                referralCode: user.uid.substring(0, 8).toUpperCase(),
                referredBy: null
            });
        }
    } catch(e) { console.error('ensureUserDoc error:', e); }
}

window.handleGoogleAuth = async function() {
    const termsCheck = document.getElementById('terms-checkbox');
    if (termsCheck && !termsCheck.checked) {
        alert('Debes aceptar los términos y condiciones para continuar.');
        return;
    }

    try {
        const result = await signInWithPopup(auth, provider);
        await ensureUserDoc(result.user);
        // onAuthStateChanged will fire automatically and call showProfile()
    } catch(err) {
        if (err.code === 'auth/popup-blocked' ||
            err.code === 'auth/operation-not-supported-in-this-environment') {
            // Fallback: redirect
            try {
                await signInWithRedirect(auth, provider);
            } catch(e2) {
                alert('No se pudo iniciar sesión: ' + (e2.message || e2.code));
            }
        } else if (err.code !== 'auth/popup-closed-by-user' &&
                   err.code !== 'auth/cancelled-popup-request') {
            alert('Error al iniciar sesión: ' + (err.message || err.code));
            console.error('Google Auth Error:', err);
        }
    }
};

// Attach to button directly (belt & suspenders — also set via onclick in HTML)
const btnLoginGuard = document.getElementById('login-btn-guard');
if (btnLoginGuard) {
    btnLoginGuard.onclick = window.handleGoogleAuth;
}

// ─── Load Client Data ─────────────────────────────────────────────────────────
async function loadClientData(uid) {
    let data = { balance: 0, wishlist: [], cart: {} };

    // 1. User doc & balance
    try {
        const ref  = doc(db, 'users', uid);
        let   snap = await getDoc(ref);

        if (!snap.exists()) {
            await setDoc(ref, {
                email: (currentUser && currentUser.email) || '',
                balance: 0, wishlist: [], cart: {},
                referralCode: uid.substring(0, 8).toUpperCase(),
                referredBy: null
            });
            snap = await getDoc(ref);
        }

        if (snap.exists()) {
            data = snap.data();
            if (userBalanceEl) {
                userBalanceEl.textContent = (data.balance != null)
                    ? Number(data.balance).toFixed(2) : '0.00';
            }
        }
    } catch(e) {
        console.error('Error loading user balance:', e);
    }

    // 2. Client Orders
    try {
        const tbody           = document.getElementById('client-orders-body');
        const noticeBox       = document.getElementById('pending-orders-notice');
        const deliveredSection= document.getElementById('delivered-section');
        const deliveredContainer = document.getElementById('delivered-products-container');

        let hasPending  = false;
        let hasDelivered= false;

        if (tbody)              tbody.innerHTML = '';
        if (deliveredContainer) deliveredContainer.innerHTML = '';

        const ordersSnap = await getDocs(query(collection(db, 'orders'), where('uid', '==', uid)));

        for (const d of ordersSnap.docs) {
            const o = d.data();
            if (o.status === 'pendiente') hasPending = true;

            let dDate = 'Reciente';
            try {
                if (o.timestamp) {
                    if (typeof o.timestamp.toDate === 'function') {
                        dDate = o.timestamp.toDate().toLocaleDateString();
                    } else if (o.timestamp.seconds) {
                        dDate = new Date(o.timestamp.seconds * 1000).toLocaleDateString();
                    }
                }
            } catch(e) {}

            if (tbody) {
                const statusClass = o.status === 'pendiente' ? 'status-pending' : 'status-confirmed';
                tbody.innerHTML += `
                    <tr>
                        <td>${dDate}</td>
                        <td>${escapeHtml(o.productName || 'Producto')}</td>
                        <td><span class="status-badge ${statusClass}">${(o.status||'PENDIENTE').toUpperCase()}</span></td>
                        <td>${escapeHtml(o.textDelivered || 'Procesando...')}</td>
                    </tr>`;
            }

            if (o.status === 'confirmado' && deliveredContainer) {
                hasDelivered = true;
                let prodImg = 'https://images.unsplash.com/photo-1605901309584-818e25960b8f?auto=format&fit=crop&w=300';
                if (o.productId) {
                    try {
                        const pDoc = await getDoc(doc(db, 'products', o.productId));
                        if (pDoc.exists() && pDoc.data().image) {
                            prodImg = normalizeImageUrl(pDoc.data().image) || prodImg;
                        }
                    } catch(e) {}
                }
                const card = document.createElement('div');
                card.className = 'delivered-card';
                card.innerHTML = `
                    <p class="delivered-tag">ENTREGADO</p>
                    <div class="delivered-wrapper">
                        <div class="delivered-card-image"><img src="${prodImg}" alt="${escapeHtml(o.productName||'Producto')}" onerror="this.src='https://images.unsplash.com/photo-1605901309584-818e25960b8f?auto=format&fit=crop&w=300'"></div>
                        <div class="delivered-content">
                            <p class="delivered-title">${escapeHtml(o.productName||'Producto')}</p>
                            <span style="font-size:0.72rem; color:var(--text-muted); display:block; margin-bottom:4px;">${dDate}</span>
                            <p class="delivered-title delivered-price">$${o.price||0}</p>
                        </div>
                        <button class="delivered-card-btn" data-credential="${escapeHtml(o.textDelivered||'')}">
                            <i class="fa-solid fa-key"></i> OBTENER
                        </button>
                    </div>`;
                deliveredContainer.appendChild(card);
            }
        }

        document.querySelectorAll('.delivered-card-btn').forEach(btn => {
            btn.onclick = () => {
                const text = btn.dataset.credential;
                if (text) {
                    navigator.clipboard.writeText(text)
                        .then(() => alert(`Credencial copiada:\n${text}`))
                        .catch(() => alert(`Credencial:\n${text}`));
                } else {
                    alert('El administrador está procesando tu entrega.');
                }
            };
        });

        if (noticeBox)        noticeBox.style.display       = hasPending  ? 'block' : 'none';
        if (deliveredSection) deliveredSection.style.display = hasDelivered ? 'block' : 'none';
    } catch(e) {
        console.error('Error loading client orders:', e);
    }

    // 3. Client Balance Requests
    try {
        const tbodyRecharges = document.getElementById('client-recharges-body');
        if (tbodyRecharges) {
            tbodyRecharges.innerHTML = '';
            const rechargesSnap = await getDocs(query(collection(db, 'balance_requests'), where('uid', '==', uid)));
            if (rechargesSnap.empty) {
                tbodyRecharges.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:1.5rem;">No has realizado solicitudes de recarga.</td></tr>`;
            } else {
                rechargesSnap.forEach(d => {
                    const r = d.data();
                    let rDate = 'Reciente';
                    try {
                        if (r.timestamp && typeof r.timestamp.toDate === 'function') rDate = r.timestamp.toDate().toLocaleDateString();
                        else if (r.timestamp && r.timestamp.seconds) rDate = new Date(r.timestamp.seconds * 1000).toLocaleDateString();
                    } catch(e) {}
                    let badgeStyle = 'background:rgba(234,179,8,0.15);color:var(--warning);';
                    if (r.status === 'aprobado') badgeStyle = 'background:rgba(34,197,94,0.15);color:var(--success);';
                    else if (r.status === 'rechazado') badgeStyle = 'background:rgba(239,68,68,0.15);color:var(--danger);';
                    
                    tbodyRecharges.innerHTML += `
                        <tr>
                            <td style="padding:10px;">${rDate}</td>
                            <td style="padding:10px;"><strong style="color:var(--success);">$${Number(r.amount||0).toFixed(2)}</strong></td>
                            <td style="padding:10px;"><span class="status-badge" style="background:rgba(161,130,232,0.15);color:var(--accent-primary);">${escapeHtml(r.method||'Transferencia')}</span></td>
                            <td style="padding:10px;"><span class="status-badge" style="${badgeStyle}">${(r.status||'PENDIENTE').toUpperCase()}</span></td>
                        </tr>`;
                });
            }
        }
    } catch(e) {
        console.error('Error loading client recharges:', e);
        const tbodyRecharges = document.getElementById('client-recharges-body');
        if (tbodyRecharges) {
            tbodyRecharges.innerHTML = `<tr><td colspan="4" style="color:var(--danger);text-align:center;padding:1rem;">Error al cargar tus recargas.</td></tr>`;
        }
    }

    // 4. Client Wishlist
    try {
        const wishlistContainer = document.getElementById('wishlist-container');
        if (wishlistContainer) {
            const wishlistIds = data.wishlist || [];
            wishlistContainer.innerHTML = '';
            if (wishlistIds.length === 0) {
                wishlistContainer.innerHTML = `<p style="color:var(--text-muted);padding:1rem;">No tienes productos en tu wishlist.</p>`;
            } else {
                for (const pid of wishlistIds) {
                    try {
                        const pSnap = await getDoc(doc(db, 'products', pid));
                        if (pSnap.exists()) {
                            const p = pSnap.data();
                            const card = document.createElement('a');
                            card.href = `producto.html?id=${pid}`;
                            card.className = 'card';
                            card.style.minWidth = '220px';
                            card.innerHTML = `
                                <div class="card__shine"></div>
                                <div class="card__glow"></div>
                                <div class="card__content">
                                    <div class="card__image" style="background-image:url('${p.image||''}');"></div>
                                    <div class="card__text"><p class="card__title">${escapeHtml(p.name)}</p></div>
                                    <div class="card__footer"><div class="card__price">$${p.price}</div></div>
                                </div>`;
                            wishlistContainer.appendChild(card);
                        }
                    } catch(e) { console.error('Wishlist item error:', e); }
                }
            }
        }
    } catch(e) {
        console.error('Error loading wishlist:', e);
    }
}

// ─── Load Admin Data ──────────────────────────────────────────────────────────
async function loadAdminData() {
    // 1. Pending Orders
    const tbodyOrders = document.getElementById('admin-orders-body');
    if (tbodyOrders) {
        tbodyOrders.innerHTML = '';
        try {
            const snap = await getDocs(query(collection(db, 'orders'), where('status', '==', 'pendiente')));
            if (snap.empty) {
                tbodyOrders.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:1.5rem;">No hay pedidos pendientes.</td></tr>`;
            }
            snap.forEach(d => {
                const o = d.data();
                const pendingCount = typeof o.pendingQuantity === 'number' ? o.pendingQuantity : (o.quantity || 1);
                tbodyOrders.innerHTML += `
                    <tr>
                        <td>${escapeHtml(o.userEmail||'')}</td>
                        <td>${escapeHtml(o.productName||'')} <span style="background:var(--warning);color:#000;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:bold;">Faltan: ${pendingCount} u.</span></td>
                        <td>
                            <div style="display:flex;gap:6px;align-items:center;">
                                <input type="text" id="deliver-${d.id}" placeholder="Código/Credencial" style="padding:6px;border-radius:6px;background:var(--bg-main);border:1px solid var(--glass-border);color:#fff;width:160px;">
                                <button class="btn-primary" onclick="deliverOrder('${d.id}')" style="padding:6px 12px;font-size:0.82rem;">Entregar</button>
                            </div>
                        </td>
                    </tr>`;
            });
        } catch(e) { console.error('Admin orders error:', e); }
    }

    // 2. Pending Recharges
    const tbodyRecharges = document.getElementById('admin-recharge-body');
    if (tbodyRecharges) {
        tbodyRecharges.innerHTML = '';
        try {
            const snap = await getDocs(query(collection(db, 'balance_requests'), where('status', '==', 'pendiente')));
            if (snap.empty) {
                tbodyRecharges.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1.5rem;">No hay solicitudes de recarga pendientes.</td></tr>`;
            }
            snap.forEach(d => {
                const r = d.data();
                let rDate = 'Reciente';
                try {
                    if (r.timestamp && typeof r.timestamp.toDate === 'function')
                        rDate = r.timestamp.toDate().toLocaleDateString();
                } catch(e) {}
                tbodyRecharges.innerHTML += `
                    <tr>
                        <td>${escapeHtml(r.userEmail||'')}</td>
                        <td><span class="status-badge" style="background:rgba(161,130,232,0.15);color:var(--accent-primary);">${escapeHtml(r.method||'Transferencia')}</span></td>
                        <td><strong style="color:var(--success);">$${Number(r.amount||0).toFixed(2)}</strong></td>
                        <td><small style="color:var(--text-muted);">${rDate}</small></td>
                        <td>
                            <div style="display:flex;gap:6px;">
                                <button class="btn-primary" style="padding:6px 12px;background:var(--success);font-size:0.82rem;" onclick="approveRecharge('${d.id}','${r.uid}',${r.amount})">
                                    <i class="fa-solid fa-check"></i> Sí recibí el pago
                                </button>
                                <button class="btn-secondary" style="padding:6px 12px;color:var(--danger);border-color:var(--danger);font-size:0.82rem;" onclick="rejectRecharge('${d.id}')">
                                    <i class="fa-solid fa-xmark"></i> Negar pago
                                </button>
                            </div>
                        </td>
                    </tr>`;
            });
        } catch(e) { console.error('Admin recharges error:', e); }
    }

    // 3. Products / Stock
    const tbodyStock = document.getElementById('admin-stock-body');
    if (tbodyStock) {
        tbodyStock.innerHTML = '';
        try {
            const [qProducts, stockDocs] = await Promise.all([
                getDocs(collection(db, 'products')),
                getDocs(collection(db, 'products_stock'))
            ]);
            const stockMap = {};
            stockDocs.forEach(sd => { stockMap[sd.id] = sd.data(); });

            if (qProducts.empty) {
                tbodyStock.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">No hay productos. Agrega uno arriba.</td></tr>`;
            }
            qProducts.forEach(d => {
                const p = d.data();
                const s = stockMap[d.id] || { status: 'desconocido', credentialsPool: '' };
                const poolCount = (s.credentialsPool || '').split('\n').filter(l => l.trim()).length;
                const statusClass = s.status === 'disponible' ? 'status-confirmed' : (s.status === 'bajo_pedido' ? 'status-pending' : 'status-danger');
                tbodyStock.innerHTML += `
                    <tr>
                        <td><div style="display:flex;align-items:center;gap:8px;">
                            <img src="${p.image||''}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;">
                            <strong>${escapeHtml(p.name||'Sin nombre')}</strong>
                        </div></td>
                        <td>${escapeHtml(p.category||'N/A')}</td>
                        <td>$${p.price||0}</td>
                        <td><small style="color:var(--text-muted);display:block;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.description||'')}</small></td>
                        <td><span class="status-badge ${statusClass}">${s.status==='disponible'?`Disponible (${poolCount})`:s.status}</span></td>
                        <td>
                            <div style="display:flex;gap:6px;">
                                <button class="btn-secondary" style="padding:4px 8px;font-size:0.8rem;" onclick="openEditModal('${d.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                                <button class="btn-secondary" style="padding:4px 8px;font-size:0.8rem;color:var(--danger);" onclick="deleteProduct('${d.id}')"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>`;
            });
        } catch(e) {
            console.error('Admin stock error:', e);
            tbodyStock.innerHTML = `<tr><td colspan="6" style="color:var(--danger);text-align:center;">Error: ${e.message}</td></tr>`;
        }
    }

    // 4. Users
    const tbodyUsers = document.getElementById('admin-users-body');
    if (tbodyUsers) {
        tbodyUsers.innerHTML = '';
        try {
            const qUsers = await getDocs(collection(db, 'users'));
            if (qUsers.empty) {
                tbodyUsers.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:1rem;">No hay usuarios registrados.</td></tr>`;
            }
            qUsers.forEach(uDoc => {
                const u = uDoc.data();
                tbodyUsers.innerHTML += `
                    <tr>
                        <td>${escapeHtml(u.email||'Sin correo')}</td>
                        <td><small style="color:var(--text-muted);">${escapeHtml(uDoc.id)}</small></td>
                        <td>$${Number(u.balance||0).toFixed(2)}</td>
                    </tr>`;
            });
        } catch(e) { console.error('Admin users error:', e); }
    }
}

// ─── Admin Actions ────────────────────────────────────────────────────────────
window.approveRecharge = async function(reqId, uid, amount) {
    if (!confirm(`¿Aprobar $${amount} para este usuario?`)) return;
    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', uid);
            const reqRef = doc(db, 'balance_requests', reqId);
            
            const reqSnap = await transaction.get(reqRef);
            if (!reqSnap.exists()) throw new Error("Solicitud no encontrada.");
            if (reqSnap.data().status !== 'pendiente') throw new Error("La solicitud ya fue procesada.");

            transaction.update(userRef, { balance: increment(Number(amount)) });
            transaction.update(reqRef, { status: 'aprobado' });
        });
        alert('Recarga aprobada exitosamente.');
        loadAdminData();
    } catch(e) { console.error(e); alert('Error al aprobar recarga: ' + e.message); }
};

window.rejectRecharge = async function(reqId) {
    if (!confirm('¿Deseas rechazar este pago?')) return;
    try {
        await updateDoc(doc(db, 'balance_requests', reqId), { status: 'rechazado' });
        alert('Solicitud rechazada.');
        loadAdminData();
    } catch(e) { console.error(e); alert('Error al rechazar.'); }
};

window.deliverOrder = async function(orderId) {
    const input = document.getElementById(`deliver-${orderId}`);
    if (!input || !input.value.trim()) { alert('Ingresa la credencial a entregar.'); return; }
    try {
        await updateDoc(doc(db, 'orders', orderId), { status: 'confirmado', textDelivered: input.value.trim() });
        alert('Pedido entregado.');
        loadAdminData();
    } catch(e) { console.error(e); alert('Error al entregar.'); }
};

function normalizeImageUrl(url) {
    if (!url) return '';
    let clean = url.trim();
    if (clean.includes('imgur.com') && !clean.includes('i.imgur.com')) {
        const parts = clean.split('/');
        const id = parts[parts.length - 1].split('.')[0];
        if (id) return `https://i.imgur.com/${id}.png`;
    }
    return clean;
}

window.createProduct = async function() {
    const name    = document.getElementById('new-prod-name').value.trim();
    const price   = parseFloat(document.getElementById('new-prod-price').value);
    const minQEl  = document.getElementById('new-prod-min-quantity');
    const minQty  = minQEl ? parseInt(minQEl.value) || 1 : 1;
    const category= document.getElementById('new-prod-category').value;
    const rawImg  = document.getElementById('new-prod-img').value.trim();
    const img     = normalizeImageUrl(rawImg);
    const desc    = document.getElementById('new-prod-desc').value.trim();
    const status  = document.getElementById('new-prod-status').value;
    const featured= document.getElementById('new-prod-featured').checked;
    const pool    = document.getElementById('new-prod-pool').value;

    if (!name || isNaN(price)) { alert('Nombre y Precio son obligatorios.'); return; }

    try {
        const pRef = doc(collection(db, 'products'));
        await setDoc(pRef, { name, price, minQuantity: minQty, category, image: img, description: desc, isFeatured: featured });
        await setDoc(doc(db, 'products_stock', pRef.id), { status, credentialsPool: pool });
        alert('Producto creado exitosamente.');
        ['new-prod-name','new-prod-price','new-prod-img','new-prod-desc','new-prod-pool'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        const featEl = document.getElementById('new-prod-featured'); if (featEl) featEl.checked = false;
        loadAdminData();
    } catch(e) { console.error(e); alert('Error creando producto.'); }
};

window.openEditModal = async function(prodId) {
    try {
        const [pSnap, sSnap] = await Promise.all([
            getDoc(doc(db, 'products', prodId)),
            getDoc(doc(db, 'products_stock', prodId))
        ]);
        if (!pSnap.exists()) return;
        const p = pSnap.data();
        const s = sSnap.exists() ? sSnap.data() : { status: 'disponible', credentialsPool: '' };

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        set('edit-prod-id', prodId);
        set('edit-prod-name', p.name||'');
        set('edit-prod-price', p.price||0);
        set('edit-prod-min-quantity', p.minQuantity||1);
        set('edit-prod-category', p.category||'juegos');
        set('edit-prod-img', p.image||'');
        set('edit-prod-desc', p.description||'');
        set('edit-prod-status', s.status||'disponible');
        set('edit-prod-pool', s.credentialsPool||'');
        const featEl = document.getElementById('edit-prod-featured'); if (featEl) featEl.checked = !!p.isFeatured;

        const modal = document.getElementById('edit-product-modal'); if (modal) modal.classList.add('active');
    } catch(e) { console.error(e); }
};

window.closeEditModal = function() {
    const modal = document.getElementById('edit-product-modal'); if (modal) modal.classList.remove('active');
};

window.saveEditedProduct = async function() {
    const prodId  = document.getElementById('edit-prod-id')?.value;
    if (!prodId) return;

    const name    = document.getElementById('edit-prod-name').value.trim();
    const price   = parseFloat(document.getElementById('edit-prod-price').value);
    const minQEl  = document.getElementById('edit-prod-min-quantity');
    const minQty  = minQEl ? parseInt(minQEl.value)||1 : 1;
    const category= document.getElementById('edit-prod-category').value;
    const rawImg  = document.getElementById('edit-prod-img').value.trim();
    const img     = normalizeImageUrl(rawImg);
    const desc    = document.getElementById('edit-prod-desc').value.trim();
    const status  = document.getElementById('edit-prod-status').value;
    const featured= document.getElementById('edit-prod-featured').checked;
    const pool    = document.getElementById('edit-prod-pool').value;

    if (!name || isNaN(price)) { alert('Nombre y Precio son obligatorios.'); return; }

    try {
        await updateDoc(doc(db, 'products', prodId), { name, price, minQuantity: minQty, category, image: img, description: desc, isFeatured: featured });
        await setDoc(doc(db, 'products_stock', prodId), { status, credentialsPool: pool }, { merge: true });
        window.closeEditModal();
        alert('Producto actualizado correctamente.');
        loadAdminData();
    } catch(e) { console.error(e); alert('Error al actualizar.'); }
};

window.deleteProduct = async function(prodId) {
    if (!confirm('¿Eliminar este producto del inventario?')) return;
    try {
        await deleteDoc(doc(db, 'products', prodId));
        await deleteDoc(doc(db, 'products_stock', prodId));
        alert('Producto eliminado.');
        loadAdminData();
    } catch(e) { console.error(e); }
};

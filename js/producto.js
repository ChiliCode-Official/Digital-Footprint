import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, getDocs, collection, serverTimestamp, runTransaction, updateDoc, arrayUnion, arrayRemove, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { updateCartBadge } from './cart.js';

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

const pImage = document.getElementById('p-image');
const pTitle = document.getElementById('p-title');
const pDesc = document.getElementById('p-desc');
const pBadge = document.getElementById('p-badge');
const pPrice = document.getElementById('p-price');

const authMsg = document.getElementById('auth-state-message');
const buyControls = document.getElementById('buy-controls');
const userBalanceDisplay = document.getElementById('user-current-balance');
const btnBuy = document.getElementById('buy-btn');
const buyError = document.getElementById('buy-error');

const btnGift = document.getElementById('btn-toggle-gift');
const giftInputs = document.getElementById('gift-section');
const giftEmail = document.getElementById('gift-email');

let productData = null;
let stockData = null;
let currentUser = null;
let userDocData = null;
let isGiftMode = false;
let currentQty = 1;

if (btnGift) {
    btnGift.addEventListener('click', () => {
        if (!currentUser) {
            buyError.style.display = 'block';
            buyError.textContent = "Debes iniciar sesión para regalar este producto.";
            return;
        }
        const multiModal = document.getElementById('gift-multi-modal');
        if (multiModal) {
            document.getElementById('gift-step-1').style.display = 'block';
            document.getElementById('gift-step-2').style.display = 'none';
            document.getElementById('gift-step-3').style.display = 'none';
            multiModal.classList.add('active');
            
            // Set price in step 2 early
            const totalPrice = productData.price * currentQty;
            const confirmName = document.getElementById('gift-confirm-product-name');
            const confirmPrice = document.getElementById('gift-confirm-price');
            if (confirmName) confirmName.textContent = productData.name;
            if (confirmPrice) confirmPrice.textContent = `$${totalPrice.toFixed(2)} MXN`;

            // Load friends list into the modal
            loadFriendsInGiftModal();
        }
    });
}

async function loadFriendsInGiftModal() {
    if (!currentUser) return;
    const container = document.getElementById('gift-friends-list');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;">Cargando... amigos...</p>';

    try {
        const { query, collection: firestoreCol, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        const [snap1, snap2] = await Promise.all([
            getDocs(query(firestoreCol(db, 'friendships'), where('uid1', '==', currentUser.uid))),
            getDocs(query(firestoreCol(db, 'friendships'), where('uid2', '==', currentUser.uid)))
        ]);

        const friends = [];
        const allDocs = [...snap1.docs, ...snap2.docs];
        
        for (const docSnap of allDocs) {
            const data = docSnap.data();
            if (data.status === 'aceptada') {
                const friendUid = (data.uid1 === currentUser.uid) ? data.uid2 : data.uid1;
                const fallbackEmail = (data.uid1 === currentUser.uid) ? data.recipientEmail : data.requesterEmail;
                friends.push({ uid: friendUid, email: fallbackEmail });
            }
        }

        if (friends.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;">Aún no tienes amigos agregados.<br>Ingresa su correo abajo.</p>';
            return;
        }

        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.75rem;margin-bottom:8px;font-weight:600;">Selecciona un amigo:</p>';
        for (const item of friends) {
            const email = item.email || 'Amigo';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.cssText = 'width:100%;display:flex;align-items:center;gap:10px;background:var(--bg-main);border:1px solid var(--glass-border);border-radius:8px;padding:8px 10px;cursor:pointer;color:var(--text-main);font-family:inherit;font-size:0.85rem;transition:border-color 0.2s;margin-bottom:6px;';
            btn.innerHTML = `<i class="fa-solid fa-user" style="color:var(--accent-primary);"></i> <span>${escapeHtml(email)}</span>`;
            btn.onclick = () => {
                const emailInput = document.getElementById('gift-email-input-modal');
                if (emailInput) {
                    emailInput.value = email;
                    emailInput.style.borderColor = 'var(--accent-primary)';
                    setTimeout(() => emailInput.style.borderColor = 'var(--glass-border)', 1000);
                }
            };
            container.appendChild(btn);
        }
    } catch(e) {
        console.error('Error loading friends in gift modal:', e);
        container.innerHTML = '<p style="color:var(--danger);font-size:0.82rem;text-align:center;">Error al cargar amigos.</p>';
    }
}

const btnNext1 = document.getElementById('btn-gift-next-1');
    const btnConfirmBuy = document.getElementById('btn-gift-confirm-buy');
    let pendingGiftEmail = '';

    if (btnNext1) {
        btnNext1.addEventListener('click', () => {
            const emailInput = document.getElementById('gift-email-input-modal');
            const errEl = document.getElementById('gift-modal-error');
            pendingGiftEmail = emailInput ? emailInput.value.trim() : '';

            if (!pendingGiftEmail) {
                if (errEl) {
                    errEl.textContent = 'Ingresa el correo del amigo.';
                    errEl.style.display = 'block';
                }
                return;
            }
            if (errEl) errEl.style.display = 'none';

            // Proceed to Step 2
            document.getElementById('gift-step-1').style.display = 'none';
            document.getElementById('gift-step-2').style.display = 'block';

            const totalPrice = productData.price * currentQty;
            document.getElementById('gift-confirm-product-name').textContent = `${currentQty}x ${productData.name}`;
            document.getElementById('gift-confirm-email').textContent = pendingGiftEmail;
            document.getElementById('gift-confirm-price').textContent = `$${totalPrice.toFixed(2)} MXN`;
        });
    }

    if (btnConfirmBuy) {
        btnConfirmBuy.addEventListener('click', async () => {
            const totalPrice = productData.price * currentQty;

            // Check Balance
            if (userDocData && userDocData.balance < totalPrice) {
                window.location.href = `pago.html?from=product&amount=${totalPrice}&isGift=true&giftEmail=${encodeURIComponent(pendingGiftEmail)}&productId=${productId}&qty=${currentQty}`;
                return;
            }

            // Perform transaction if enough balance
            btnConfirmBuy.disabled = true;
            btnConfirmBuy.textContent = "Procesando...";

            try {
                await runTransaction(db, async (transaction) => {
                    const userRef = doc(db, 'users', currentUser.uid);
                    const uSnap = await transaction.get(userRef);
                    if (!uSnap.exists()) throw "El usuario no existe!";
                    const currentBal = uSnap.data().balance || 0;
                    
                    if (currentBal < totalPrice) throw "Saldo insuficiente.";

                    let credsToGive = [];
                    const stockRef = doc(db, 'products_stock', productId);
                    const sSnap = await transaction.get(stockRef);
                    
                    if (sSnap.exists() && sSnap.data().status === 'disponible') {
                        let pool = (sSnap.data().credentialsPool || "").split('\n').filter(l => l.trim() !== "");
                        if (pool.length < currentQty) throw "Stock insuficiente.";
                        credsToGive = pool.splice(0, currentQty);
                        transaction.update(stockRef, { credentialsPool: pool.join('\n') });
                    }

                    const newBalance = uSnap.data().balance - totalPrice;
                    transaction.update(userRef, { balance: newBalance });
                    
                    const newOrderRef = doc(collection(db, 'orders'));
                    transaction.set(newOrderRef, {
                        uid: currentUser.uid,
                        userEmail: currentUser.email,
                        productId: productId,
                        productName: productData.name,
                        price: totalPrice,
                        quantity: currentQty,
                        status: stockData.status === 'disponible' ? 'entregado' : 'pendiente',
                        isGift: true,
                        giftRecipient: pendingGiftEmail,
                        textDelivered: stockData.status === 'disponible' ? credsToGive.join('\n') : 'Pendiente',
                        timestamp: serverTimestamp()
                    });
                });

                // Show Astronaut Animation
                document.getElementById('gift-step-2').style.display = 'none';
                document.getElementById('gift-step-3').style.display = 'block';

                const shareBtn = document.getElementById('share-whatsapp-btn');
                if (shareBtn) {
                    shareBtn.onclick = (e) => {
                        e.preventDefault();
                        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
                        const siteUrl = `${window.location.origin}${basePath}`;
                        const message = `Ã‚¡Hola! Ã°Å¸Å½Â Te acabo de regalar *${productData.name}* en GhostKey.\n\nÃ‚¡Nos esforzaremos al mÃƒ¡ximo para que lo recibas super rÃƒ¡pido! Ã°Å¸Å¡â‚¬Ã¢Å“Â¨\n\nVisita GhostKey para ver tus regalos: ${siteUrl}`;
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
                    };
                }

            } catch (e) {
                console.error(e);
                alert("Error: " + String(e));
                btnConfirmBuy.disabled = false;
                btnConfirmBuy.textContent = "Confirmar Regalo";
            }
        });
    }
}

const addCartBtn = document.getElementById('add-cart-btn');
if (addCartBtn) {
    addCartBtn.addEventListener('click', async () => {
        if (isNaN(currentQty) || currentQty <= 0 || !Number.isFinite(currentQty)) {
            alert("Cantidad invÃƒ¡lida.");
            return;
        }
        if (stockData && stockData.status === 'disponible') {
            let pool = stockData.credentialsPool || "";
            let count = pool.split('\n').filter(l => l.trim() !== "").length;
            if (currentQty > count) {
                alert("La cantidad excede el stock disponible.");
                return;
            }
        }
        if (!currentUser) {
            alert("Debes iniciar sesión para usar el carrito.");
            return;
        }
        try {
            const uRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(uRef);
            if (userSnap.exists()) {
                let currentCart = userSnap.data().cart || {};
                let existingQty = currentCart[productId] || 0;
                currentCart[productId] = existingQty + currentQty;
                await updateDoc(uRef, { cart: currentCart });
                updateCartBadge();
                alert("Ã‚¡Producto añadido al carrito!");
            }
        } catch(e) {
            console.error(e);
            alert("Error al añadir al carrito.");
        }
    });
}

function checkAndDisplayStockNotice() {
    const buyNotice = document.getElementById('buy-notice');
    if (!buyNotice) return;
    if (stockData && stockData.status === 'disponible') {
        let pool = stockData.credentialsPool || "";
        let count = pool.split('\n').filter(l => l.trim() !== "").length;
        if (currentQty > count) {
            const immediate = Math.max(0, count);
            const pending = currentQty - immediate;
            buyNotice.style.display = 'block';
            buyNotice.style.background = 'rgba(234,179,8,0.12)';
            buyNotice.style.border = '1px solid var(--warning)';
            buyNotice.style.color = 'var(--warning)';
            buyNotice.style.padding = '10px 14px';
            buyNotice.style.borderRadius = '10px';
            buyNotice.style.fontSize = '0.85rem';
            buyNotice.style.marginTop = '10px';
            buyNotice.innerHTML = `<i class="fa-solid fa-clock"></i> <strong>Aviso de Entrega:</strong> ${immediate > 0 ? `Tienes ${immediate} u. disponible(s) de inmediato. ` : ''}Las ${pending} u. restante(s) se entregarán bajo pedido.`;
        } else {
            buyNotice.style.display = 'none';
        }
    } else {
        buyNotice.style.display = 'none';
    }
}

function updateQtyUI() {
    const qtyDisplay = document.getElementById('qty-display');
    const pPrice = document.getElementById('p-price');
    
    if(qtyDisplay) qtyDisplay.textContent = currentQty;
    
    if(pPrice && productData) {
        const total = productData.price * currentQty;
        pPrice.textContent = `$${total.toFixed(2)}`;
    }

    checkAndDisplayStockNotice();
}

const btnMinus = document.getElementById('btn-qty-minus');
const btnPlus = document.getElementById('btn-qty-plus');

if(btnMinus) {
    btnMinus.addEventListener('click', () => {
        const minQ = productData ? (productData.minQuantity || 1) : 1;
        if (currentQty > minQ) {
            currentQty--;
        } else if (currentQty === minQ) {
            currentQty = 0;
        }
        updateQtyUI();
    });
}

if(btnPlus) {
    btnPlus.addEventListener('click', () => {
        currentQty++;
        updateQtyUI();
    });
}

async function loadProductReviews(pid) {
    const container = document.getElementById('product-reviews-container');
    if (!container) return;

    try {
        const q = query(collection(db, "reviews"), where("productId", "==", pid), orderBy("timestamp", "desc"));
        let snap;
        try {
            snap = await getDocs(q);
        } catch (err) {
            const fallbackQ = query(collection(db, "reviews"), where("productId", "==", pid));
            snap = await getDocs(fallbackQ);
        }

        if (snap.empty) {
            container.innerHTML = `<p style="color: var(--text-muted);">Todavía no hay reseñas para este producto.</p>`;
            return;
        }

        container.innerHTML = '';
        snap.forEach(docSnap => {
            const r = docSnap.data();
            const ratingVal = Math.min(5, Math.max(1, parseInt(r.rating) || 5));
            const starsHtml = '<i class="fa-solid fa-star"></i>'.repeat(ratingVal) + '<i class="fa-regular fa-star"></i>'.repeat(5 - ratingVal);

            const card = document.createElement('div');
            card.className = 'review-card';
            card.style.minWidth = "280px";
            card.innerHTML = `
                <div class="review-stars">${starsHtml}</div>
                <div class="review-body">
                    <p class="text">${escapeHtml(r.text || '')}</p>
                    <span class="username">@${escapeHtml(r.username || 'Usuario')}</span>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (err) {
        console.error("Error loading product reviews:", err);
        container.innerHTML = `<p style="color: var(--danger);">No se pudieron cargar las reseñas.</p>`;
    }
}

loadProductDetails();

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
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;">Cargando amigos...</p>';

    try {
        const { getDoc, doc: firestoreDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const uSnap = await getDoc(firestoreDoc(db, 'users', currentUser.uid));
        const friends = uSnap.exists() ? (uSnap.data().friends || []) : [];

        if (friends.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;">Aún no tienes amigos agregados.<br>Ingresa su correo abajo.</p>';
            return;
        }

        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.75rem;margin-bottom:8px;font-weight:600;">Selecciona un amigo:</p>';
        friends.forEach(friend => {
            const email = friend.email || friend;
            const name = friend.displayName || email;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.cssText = 'width:100%;display:flex;align-items:center;gap:10px;background:var(--bg-main);border:1px solid var(--glass-border);border-radius:8px;padding:8px 10px;cursor:pointer;color:var(--text-main);font-family:inherit;font-size:0.85rem;transition:border-color 0.2s;margin-bottom:6px;';
            btn.innerHTML = `
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=A182E8&color=fff" style="width:28px;height:28px;border-radius:50%;">
                <div style="text-align:left;flex:1;">
                    <div style="font-weight:600;">${name}</div>
                    <div style="color:var(--text-muted);font-size:0.72rem;">${email}</div>
                </div>
                <i class="fa-solid fa-arrow-right" style="color:var(--accent-primary);"></i>
            `;
            btn.addEventListener('click', () => {
                const emailInput = document.getElementById('gift-email-input-modal');
                if (emailInput) emailInput.value = email;
                // Highlight selected
                container.querySelectorAll('button').forEach(b => b.style.borderColor = 'var(--glass-border)');
                btn.style.borderColor = 'var(--accent-primary)';
            });
            btn.addEventListener('mouseenter', () => btn.style.borderColor = 'var(--accent-primary)');
            btn.addEventListener('mouseleave', () => {
                if (document.getElementById('gift-email-input-modal')?.value !== email) {
                    btn.style.borderColor = 'var(--glass-border)';
                }
            });
            container.appendChild(btn);
        });
    } catch(e) {
        console.error('Error loading friends in gift modal:', e);
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;">Error cargando amigos.</p>';
    }
}

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

async function loadProductDetails() {
    if (!productId) {
        if (pTitle) pTitle.textContent = "Producto no especificado";
        if (pDesc) pDesc.textContent = "Selecciona un producto desde el catÃ¡logo para ver sus detalles.";
        return;
    }
    try {
        const pSnap = await getDoc(doc(db, 'products', productId));
        if (pSnap.exists()) {
            productData = { id: pSnap.id, ...pSnap.data() };
            
            // Set initial qty to minQuantity if available
            currentQty = productData.minQuantity || 1;
            updateQtyUI();

            if (pTitle) pTitle.textContent = productData.name || 'Producto';
            if (pDesc) pDesc.textContent = productData.description || 'Sin descripciÃ³n disponible para este producto.';
            if (pPrice) pPrice.textContent = `$${productData.price || 0}`;
            
            if (pImage) {
                const cleanImg = normalizeImageUrl(productData.image) || 'https://images.unsplash.com/photo-1605901309584-818e25960b8f?auto=format&fit=crop&w=800';
                pImage.src = cleanImg;
                pImage.alt = productData.name || 'Producto';
                pImage.onerror = () => {
                    pImage.src = 'https://images.unsplash.com/photo-1605901309584-818e25960b8f?auto=format&fit=crop&w=800';
                };
            }
            
            const sSnap = await getDoc(doc(db, 'products_stock', productId));
            if (sSnap.exists()) {
                stockData = sSnap.data();
                checkAndDisplayStockNotice();
                if (pBadge) {
                    if (stockData.status === 'disponible') {
                        let pool = stockData.credentialsPool || "";
                        let count = pool.split('\n').filter(l => l.trim() !== "").length;
                        if (count > 0) {
                            pBadge.textContent = count >= currentQty ? `En stock (${count})` : `Bajo pedido (En stock: ${count})`;
                            pBadge.style.background = count >= currentQty ? 'var(--success)' : 'var(--warning)';
                        } else {
                            pBadge.textContent = `Bajo pedido`;
                            pBadge.style.background = 'var(--warning)';
                        }
                        if (btnBuy) btnBuy.disabled = false;
                        if (btnGift) btnGift.disabled = false;
                    } else if (stockData.status === 'bajo_pedido') {
                        pBadge.textContent = `Bajo pedido`;
                        pBadge.style.background = 'var(--warning)';
                    } else {
                        pBadge.textContent = `Agotado`;
                        pBadge.style.background = 'var(--danger)';
                        if (btnBuy) btnBuy.disabled = true;
                        if (btnGift) btnGift.disabled = true;
                    }
                }
            } else {
                if (pBadge) {
                    pBadge.textContent = `En stock`;
                    pBadge.style.background = 'var(--success)';
                }
            }
        } else {
            if (pTitle) pTitle.textContent = "Producto no encontrado";
            if (pDesc) pDesc.textContent = "El producto solicitado no existe o fue eliminado del inventario.";
        }
        
        loadProductReviews(productId);
    } catch (err) {
        console.error("Error loading product details:", err);
        if (pTitle) pTitle.textContent = "Error al cargar";
        if (pDesc) pDesc.textContent = "Hubo un error al cargar la informaciÃ³n del producto.";
    }
}

setPersistence(auth, browserLocalPersistence).catch(console.error);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if (authMsg) authMsg.style.display = 'none';
        
        try {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                userDocData = userSnap.data();
                if (userBalanceDisplay) {
                    userBalanceDisplay.textContent = `$${(userDocData.balance || 0).toFixed(2)}`;
                }
                if (buyControls) buyControls.style.display = 'flex';

                const favBtn = document.getElementById('favorite');
                const favWrapper = document.getElementById('favorite-wrapper');
                if (favBtn && favWrapper) {
                    favWrapper.style.display = 'block';
                    const wishlist = userDocData.wishlist || [];
                    favBtn.checked = wishlist.includes(productId);
                    
                    favBtn.onchange = async () => {
                        try {
                            const uRef = doc(db, 'users', currentUser.uid);
                            if (favBtn.checked) {
                                await updateDoc(uRef, { wishlist: arrayUnion(productId) });
                            } else {
                                await updateDoc(uRef, { wishlist: arrayRemove(productId) });
                            }
                        } catch(e) {
                            console.error("Error updating favorite", e);
                            favBtn.checked = !favBtn.checked;
                        }
                    };
                }

                if (productData && userDocData.balance < productData.price) {
                    // Do not disable, let user click to see animation
                }
            }
        } catch (e) {
            console.error("Error checking user balance:", e);
        }
    } else {
        if (authMsg) authMsg.style.display = 'block';
        if (buyControls) buyControls.style.display = 'none';
        currentUser = null;
    }
});



if (btnBuy) {
    btnBuy.addEventListener('click', async () => {
        if (isNaN(currentQty) || currentQty <= 0 || !Number.isFinite(currentQty)) {
            if (buyError) {
                buyError.textContent = "Cantidad invÃ¡lida.";
                buyError.style.display = 'block';
            }
            return;
        }
        
        const buyNotice = document.getElementById('buy-notice');
        if (stockData && stockData.status === 'disponible') {
            let pool = stockData.credentialsPool || "";
            let count = pool.split('\n').filter(l => l.trim() !== "").length;
            if (currentQty > count) {
                const immediate = Math.max(0, count);
                const pending = currentQty - immediate;
                if (buyNotice) {
                    buyNotice.style.display = 'block';
                    buyNotice.style.background = 'rgba(234,179,8,0.12)';
                    buyNotice.style.border = '1px solid var(--warning)';
                    buyNotice.style.color = 'var(--warning)';
                    buyNotice.style.padding = '10px 14px';
                    buyNotice.style.borderRadius = '10px';
                    buyNotice.style.fontSize = '0.85rem';
                    buyNotice.style.marginTop = '10px';
                    buyNotice.innerHTML = `<i class="fa-solid fa-clock"></i> <strong>Aviso de Entrega:</strong> ${immediate > 0 ? `Tienes ${immediate} u. disponible(s) de inmediato. ` : ''}Las ${pending} u. restante(s) se entregarÃ¡n bajo pedido.`;
                }
            } else if (buyNotice) {
                buyNotice.style.display = 'none';
            }
        }
        
        if (buyError) buyError.style.display = 'none';
        
        if (!currentUser) {
            window.location.href = 'index.html'; 
            return;
        }

        const totalPrice = productData.price * currentQty;

        // Regular purchase flow -> Redirect to pago.html with qty
        window.location.href = `pago.html?from=product&amount=${totalPrice}&productId=${productId}&qty=${currentQty}`;
    });

    // Multi-Step Modal Logic
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
                        const message = `Â¡Hola! ðŸŽ Te acabo de regalar *${productData.name}* en GhostKey.\n\nÂ¡Nos esforzaremos al mÃ¡ximo para que lo recibas super rÃ¡pido! ðŸš€âœ¨\n\nVisita GhostKey para ver tus regalos: ${siteUrl}`;
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
            alert("Cantidad invÃ¡lida.");
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
            alert("Debes iniciar sesiÃ³n para usar el carrito.");
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
                alert("Â¡Producto aÃ±adido al carrito!");
            }
        } catch(e) {
            console.error(e);
            alert("Error al aÃ±adir al carrito.");
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
            buyNotice.innerHTML = `<i class="fa-solid fa-clock"></i> <strong>Aviso de Entrega:</strong> ${immediate > 0 ? `Tienes ${immediate} u. disponible(s) de inmediato. ` : ''}Las ${pending} u. restante(s) se entregarÃ¡n bajo pedido.`;
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
            container.innerHTML = `<p style="color: var(--text-muted);">TodavÃ­a no hay reseÃ±as para este producto.</p>`;
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
                <div class="body">
                    <p class="text">${escapeHtml(r.text || '')}</p>
                    <span class="username">@${escapeHtml(r.username || 'Usuario')}</span>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (err) {
        console.error("Error loading product reviews:", err);
        container.innerHTML = `<p style="color: var(--danger);">No se pudieron cargar las reseÃ±as.</p>`;
    }
}

loadProductDetails();

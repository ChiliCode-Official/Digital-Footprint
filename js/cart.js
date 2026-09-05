import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

function getProductTotalPrice(product, quantity, fallbackUnitPrice) {
    if (product?.pricingModel === 'instagram_followers' || /seguidores de instagram/i.test(product?.name || '')) {
        quantity = Math.floor(quantity / 100) * 100;
        if (quantity < 300) return 0;
        if (quantity <= 500) return 25;
        const blocks = Math.ceil(quantity / 1000);
        return blocks === 1 ? 47 : (blocks * 47) - ((blocks - 1) * 7);
    }
    return (fallbackUnitPrice || 0) * quantity;
}

let currentUser = null;
let cartItems = [];

function createCartModalHTML() {
    if (document.getElementById('cart-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'cart-modal';
    modal.className = 'cart-modal';
    modal.innerHTML = `
        <div class="cart-drawer">
            <div class="cart-header">
                <h3 style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-bag-shopping" style="color: var(--accent-primary);"></i> Tu Carrito / Wishlist
                </h3>
                <button id="close-cart-btn" class="btn-secondary" style="padding: 4px 10px; border-radius: 50%;">&times;</button>
            </div>
            <div class="cart-items-list" id="cart-items-container">
                <p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Cargando tu carrito...</p>
            </div>
            <div class="cart-footer">
                <div style="display:flex; justify-content:space-between; font-weight:700; font-size:1.1rem; margin-bottom:1rem;">
                    <span>Total Estimado:</span>
                    <span id="cart-total-price" style="color: var(--accent-primary);">$0.00</span>
                </div>
                <button id="cart-checkout-btn" class="btn-primary" style="width:100%; display:block; text-align:center; padding:12px;">
                    <i class="fa-solid fa-credit-card"></i> Pagar / Recargar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('close-cart-btn')?.addEventListener('click', closeCart);
    
    const container = document.getElementById('cart-items-container');
    if (container) {
        container.addEventListener('click', async (e) => {
            const removeBtn = e.target.closest('.btn-remove-cart');
            if (removeBtn && currentUser) {
                const pid = removeBtn.dataset.pid;
                try {
                    removeBtn.disabled = true;
                    removeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                    const ref = doc(db, 'users', currentUser.uid);
                    await updateDoc(ref, {
                        [`cart.${pid}`]: deleteField()
                    });
                    await updateCartBadge();
                    await loadCartContent();
                } catch (err) {
                    console.error("Error removing from cart:", err);
                    removeBtn.disabled = false;
                    removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                }
            }
        });
    }
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCart();
    });
}

export function openCart() {
    createCartModalHTML();
    const modal = document.getElementById('cart-modal');
    if (modal) {
        modal.classList.add('active');
        loadCartContent();
    }
}

export function closeCart() {
    const modal = document.getElementById('cart-modal');
    if (modal) modal.classList.remove('active');
}

async function loadCartContent() {
    const container = document.getElementById('cart-items-container');
    const totalPriceEl = document.getElementById('cart-total-price');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fa-solid fa-user-slash" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
                <p>Inicia sesión para sincronizar tus artículos guardados y carrito.</p>
            </div>
        `;
        if (totalPriceEl) totalPriceEl.textContent = '$0.00';
        return;
    }

    try {
        const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const cartObj = (uSnap.exists() && uSnap.data().cart) ? uSnap.data().cart : {};
        const cartItems = Object.keys(cartObj);

        if (cartItems.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="fa-solid fa-basket-shopping" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
                    <p>Tu carrito está vacío.</p>
                </div>
            `;
            if (totalPriceEl) totalPriceEl.textContent = '$0.00';
            return;
        }

        container.innerHTML = '';
        let totalSum = 0;

        for (const pid of cartItems) {
            const cartItemObj = cartObj[pid];
            let qty = 0;
            let duration = '';
            if (typeof cartItemObj === 'number') {
                qty = cartItemObj;
            } else if (cartItemObj) {
                qty = parseInt(cartItemObj.qty) || 0;
                duration = cartItemObj.duration || '';
            }
            const pSnap = await getDoc(doc(db, 'products', pid));
            if (pSnap.exists()) {
                const p = pSnap.data();
                
                let unitPrice = p.price || 0;
                if (duration && p.streamingOptions) {
                    const opts = p.streamingOptions.split(',').map(o => o.trim()).filter(o => o);
                    const optMatch = opts.find(o => {
                        if (o.includes(':')) {
                            return o.split(':')[0].trim() === duration;
                        }
                        return o === duration;
                    });
                    if (optMatch && optMatch.includes(':')) {
                        const parsedPrice = parseFloat(optMatch.split(':')[1].trim());
                        if (!isNaN(parsedPrice)) {
                            unitPrice = parsedPrice;
                        }
                    }
                }

                const itemTotal = getProductTotalPrice(p, qty, unitPrice);
                totalSum += itemTotal;

                const sSnap = await getDoc(doc(db, 'products_stock', pid));
                let stockNoticeHtml = '';
                if (sSnap.exists() && sSnap.data().status === 'disponible') {
                    const poolCount = (sSnap.data().credentialsPool || "").split('\n').filter(l => l.trim() !== "").length;
                    if (qty > poolCount) {
                        const immediate = Math.max(0, poolCount);
                        const pending = qty - immediate;
                        stockNoticeHtml = `<div style="font-size:0.75rem; color:var(--warning); margin-top:4px;"><i class="fa-solid fa-clock"></i> ${immediate > 0 ? `${immediate} u. inmediatas, ` : ''}${pending} u. bajo pedido</div>`;
                    }
                }

                let notes = '';
                if (typeof cartItemObj === 'object' && cartItemObj && cartItemObj.notes) {
                    notes = cartItemObj.notes;
                }

                const itemDiv = document.createElement('div');
                itemDiv.className = 'cart-item';
                itemDiv.innerHTML = `
                    <img src="${p.image || 'https://images.unsplash.com/photo-1605901309584-818e25960b8f?auto=format&fit=crop&w=100'}" class="cart-item-img">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${escapeHtml(p.name)} ${duration ? `<span style="font-size:0.8rem; color:var(--text-muted);">(${escapeHtml(duration)})</span>` : ''}</div>
                        <div class="cart-item-price">$${unitPrice.toFixed(2)} x ${qty} = $${itemTotal.toFixed(2)}</div>
                        ${notes ? `<div style="font-size:0.75rem; color:var(--accent-primary); margin-top:2px; word-break:break-word;"><i class="fa-solid fa-pen-to-square"></i> ${escapeHtml(notes)}</div>` : ''}
                        ${stockNoticeHtml}
                    </div>
                    <div style="display:flex; flex-direction:column; gap:5px; align-items:flex-end;">
                        <a href="producto.html?id=${pid}" class="btn-primary" style="padding: 4px 10px; font-size: 0.75rem; text-align:center;">Ver</a>
                        <button class="btn-secondary btn-remove-cart" data-pid="${pid}" style="padding: 4px 10px; font-size: 0.75rem; color:var(--danger); border-color:var(--danger);" title="Eliminar del carrito"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                container.appendChild(itemDiv);
            }
        }

        if (totalPriceEl) totalPriceEl.textContent = `$${totalSum.toFixed(2)}`;

        const checkoutBtn = document.getElementById('cart-checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.onclick = () => {
                window.location.href = `pago.html?from=cart&amount=${totalSum}`;
            };
        }

    } catch (err) {
        console.error("Error loading cart:", err);
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user) {
            updateCartBadge();
        }
    });

    // Global listener for bag/cart icons across all pages
    document.querySelectorAll('.fa-bag-shopping, .fa-shopping-bag, .fa-cart-shopping, .action-btn i.fa-bag-shopping').forEach(icon => {
        const btn = icon.closest('button, a');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                openCart();
            });
        }
    });
});

export async function updateCartBadge() {
    if (!currentUser) return;
    try {
        const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (uSnap.exists()) {
            const cartObj = uSnap.data().cart || {};
            const count = Object.values(cartObj).reduce((sum, val) => {
                let q = 0;
                if (typeof val === 'number') q = val;
                else if (val && val.qty) q = parseInt(val.qty);
                return sum + (q || 0);
            }, 0);
            
            document.querySelectorAll('.fa-bag-shopping, .fa-shopping-bag, .fa-cart-shopping, .action-btn i.fa-bag-shopping').forEach(icon => {
                const parent = icon.closest('a, button');
                if (parent) {
                    let badge = parent.querySelector('.cart-badge-counter');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'cart-badge-counter';
                        badge.style.cssText = 'position:absolute; top:-5px; right:-8px; background:var(--danger); color:white; border-radius:50%; width:18px; height:18px; font-size:0.7rem; display:flex; align-items:center; justify-content:center; pointer-events:none; font-family:sans-serif; font-weight:bold;';
                        parent.style.position = 'relative';
                        parent.appendChild(badge);
                    }
                    badge.textContent = count;
                    badge.style.display = count > 0 ? 'flex' : 'none';
                }
            });
        }
    } catch (err) {
        console.error("Error updating cart badge:", err);
    }
}


// Global listener for removing cart items
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-remove-cart');
    if (btn) {
        if (!currentUser) return;
        const pid = btn.dataset.pid;
        if (!pid) return;
        try {
            const { doc, updateDoc, deleteField } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const uRef = doc(db, 'users', currentUser.uid);
            await updateDoc(uRef, {
                [`cart.${pid}`]: deleteField()
            });
            alert('Producto eliminado del carrito.');
            // Reload cart
            openCart();
            updateCartBadge();
        } catch(err) {
            console.error('Error removing from cart:', err);
        }
    }
});

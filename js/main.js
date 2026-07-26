import { db, auth, provider } from './firebase-config.js';
import {
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

setPersistence(auth, browserLocalPersistence).catch(console.error);

window.addEventListener('pageshow', (event) => {
    if (event.persisted && auth.currentUser) {
        // Re-trigger auth state check on bfcache restoration
    }
});
import {
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs,
    limit,
    query,
    where,
    orderBy,
    addDoc,
    updateDoc,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initWishlistButtons } from './wishlist.js';
import './friends-panel.js';

let currentUser = null;
let currentUserWishlist = [];

// --- GSAP Animations (GooeyNav & Dock) ---
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const indicator = document.querySelector('.nav-indicator');

    if (navItems.length > 0 && indicator) {
        const activeItem = document.querySelector('.nav-item.active');
        if (activeItem) {
            indicator.style.top = `${activeItem.offsetTop}px`;
        }
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            if (indicator) {
                indicator.style.top = `${item.offsetTop}px`;
                createParticles(item.offsetTop + 22);
            }
        });
    });
}

function createParticles(yPos) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    for (let i = 0; i < 5; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = '8px';
        particle.style.height = '8px';
        particle.style.background = 'var(--accent-primary)';
        particle.style.borderRadius = '50%';
        particle.style.left = '40px';
        particle.style.top = `${yPos}px`;
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '0';

        sidebar.appendChild(particle);

        const angle = Math.random() * Math.PI * 2;
        const velocity = 20 + Math.random() * 30;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;

        gsap.to(particle, {
            x: tx,
            y: ty,
            opacity: 0,
            duration: 0.6 + Math.random() * 0.4,
            ease: "power2.out",
            onComplete: () => particle.remove()
        });
    }
}

function initMobileDock() {
    const dockItems = document.querySelectorAll('.dock-item');
    dockItems.forEach(item => {
        item.addEventListener('touchstart', () => {
            gsap.to(item, { scale: 1.2, y: -5, duration: 0.2 });
        });
        item.addEventListener('touchend', () => {
            gsap.to(item, { scale: 1, y: 0, duration: 0.2 });
        });
    });
}

// --- Auth UI ---
const userProfileBtn = document.getElementById('user-profile-btn');
const userNameDisplay = document.getElementById('user-name');
const userAvatar = document.getElementById('user-avatar');

function setUserProfileLoading(isLoading) {
    if (!userProfileBtn) return;
    userProfileBtn.classList.toggle('user-profile--loading', isLoading);
    if (userNameDisplay) {
        userNameDisplay.classList.toggle('user-name--skeleton', isLoading);
        if (isLoading) userNameDisplay.textContent = '';
    }
    if (userAvatar) {
        userAvatar.classList.toggle('user-avatar--skeleton', isLoading);
        if (isLoading) {
            userAvatar.removeAttribute('src');
            userAvatar.alt = '';
        }
    }
}

function updateUserProfileUI(user) {
    if (!userProfileBtn) return;

    userProfileBtn.classList.remove('user-profile--loading');

    if (user) {
        if (userNameDisplay) {
            userNameDisplay.classList.remove('user-name--skeleton');
            const displayName = user.displayName || user.email.split('@')[0];
            userNameDisplay.textContent = displayName.length > 12
                ? `${displayName.substring(0, 12)}…`
                : displayName;
        }
        if (userAvatar) {
            userAvatar.classList.remove('user-avatar--skeleton');
            userAvatar.src = user.photoURL
                || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=A182E8&color=fff`;
            userAvatar.alt = user.displayName || user.email;
        }
        userProfileBtn.title = 'Ver perfil';
    } else {
        if (userNameDisplay) {
            userNameDisplay.classList.remove('user-name--skeleton');
            userNameDisplay.textContent = 'Iniciar sesión';
        }
        if (userAvatar) {
            userAvatar.classList.remove('user-avatar--skeleton');
            userAvatar.src = 'https://ui-avatars.com/api/?name=?&background=1C222E&color=9CA3AF';
            userAvatar.alt = 'Invitado';
        }
        userProfileBtn.title = 'Iniciar sesión con Google';
    }
    
    const logoutBtn = document.getElementById('logout-btn-header');
    if (logoutBtn) {
        logoutBtn.style.display = user ? 'inline-block' : 'none';
        logoutBtn.onclick = () => {
            signOut(auth).then(() => window.location.reload());
        };
    }
}

async function handleLogin() {
    if (currentUser) {
        window.location.href = 'perfil.html';
        return;
    }

    try {
        let user = null;
        try {
            const result = await signInWithPopup(auth, provider);
            user = result.user;
        } catch (popupErr) {
            console.warn("Popup authentication blocked/failed, trying redirect...", popupErr);
            if (popupErr.code === 'auth/operation-not-supported-in-this-environment' || location.protocol === 'file:') {
                throw popupErr;
            }
            await signInWithRedirect(auth, provider);
            return;
        }

        if (user) {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    email: user.email,
                    balance: 0,
                    wishlist: [],
                    cart: {},
                    referralCode: user.uid.substring(0, 8).toUpperCase(),
                    referredBy: null
                });
            }
            window.location.href = 'perfil.html';
        }
    } catch (error) {
        console.error("Login Error:", error);
        const email = prompt("Google Auth no está habilitado en este origen (" + (error.code || 'local file') + ").\n\nIngresa tu correo para acceder en modo prueba:");
        if (email && email.trim() !== '') {
            const cleanEmail = email.trim();
            const mockUser = {
                uid: 'usr-' + Math.random().toString(36).substring(2, 10),
                email: cleanEmail,
                displayName: cleanEmail.split('@')[0],
                photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanEmail)}&background=A182E8&color=fff`
            };
            try {
                const userRef = doc(db, 'users', mockUser.uid);
                await setDoc(userRef, {
                    email: mockUser.email,
                    balance: 0,
                    wishlist: [],
                    cart: {},
                    referralCode: mockUser.uid.substring(0, 8).toUpperCase(),
                    referredBy: null
                }, { merge: true });
            } catch(e) {}
            window.location.href = 'perfil.html';
        }
    }
}

if (userProfileBtn) {
    userProfileBtn.addEventListener('click', handleLogin);
}

setPersistence(auth, browserLocalPersistence).catch(console.error);

onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    updateUserProfileUI(user);
    checkReferralBanner(user);

    const reviewFormContainer = document.getElementById('review-form-container');
    if (reviewFormContainer) {
        reviewFormContainer.style.display = user ? 'block' : 'none';
        if (user) {
            populateReviewProducts(user);
        }
    }

    if (user) {
        const uSnap = await getDoc(doc(db, 'users', user.uid));
        if (uSnap.exists()) {
            currentUserWishlist = uSnap.data().wishlist || [];
        } else {
            currentUserWishlist = [];
        }
    } else {
        currentUserWishlist = [];
    }

    if (document.getElementById('products-container')) {
        loadIndexProducts();
    }
    if (document.getElementById('reviews-container')) {
        loadReviews();
    }
});

function checkReferralBanner(user) {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
        localStorage.setItem('ghostkey_referred_by', ref);
        let notice = document.getElementById('referral-banner-notice');
        if (!notice) {
            notice = document.createElement('div');
            notice.id = 'referral-banner-notice';
            notice.style.cssText = 'position:fixed; top:15px; left:50%; transform:translateX(-50%); z-index:10000; background:linear-gradient(135deg, var(--accent-primary), #6040a8); color:white; padding:10px 20px; border-radius:30px; box-shadow:0 10px 25px rgba(0,0,0,0.5); font-size:0.85rem; display:flex; align-items:center; gap:10px; font-weight:bold; max-width:90%;';
            document.body.appendChild(notice);
        }
        if (user) {
            notice.innerHTML = `<i class="fa-solid fa-circle-info" style="color:var(--warning);"></i> <span>El referido sólo aplica para cuentas NUEVAS. Ya tienes sesión iniciada.</span> <button onclick="this.parentNode.remove()" style="background:none; border:none; color:white; cursor:pointer; font-size:1.1rem; margin-left:10px;">&times;</button>`;
        } else {
            notice.innerHTML = `<i class="fa-solid fa-gift"></i> <span>¡Te invitaron a GhostKey! Inicia sesión para crear una cuenta NUEVA y contar tu referido.</span> <button onclick="this.parentNode.remove()" style="background:none; border:none; color:white; cursor:pointer; font-size:1.1rem; margin-left:10px;">&times;</button>`;
        }
    }
}

export function getGhostLoaderHTML(message = 'Cargando…') {
    return `
        <div class="loading-state">
            <div class="ghost-loader" aria-hidden="true">
                <div class="ghost-red">
                    <div class="ghost-pupil"></div>
                    <div class="ghost-pupil ghost-pupil1"></div>
                    <div class="ghost-eye"></div>
                    <div class="ghost-eye ghost-eye1"></div>
                    <div class="ghost-top0"></div>
                    <div class="ghost-top1"></div>
                    <div class="ghost-top2"></div>
                    <div class="ghost-top3"></div>
                    <div class="ghost-top4"></div>
                    <div class="ghost-st0"></div>
                    <div class="ghost-st1"></div>
                    <div class="ghost-st2"></div>
                    <div class="ghost-st3"></div>
                    <div class="ghost-st4"></div>
                    <div class="ghost-st5"></div>
                    <div class="ghost-an1"></div>
                    <div class="ghost-an2"></div>
                    <div class="ghost-an3"></div>
                    <div class="ghost-an4"></div>
                    <div class="ghost-an5"></div>
                    <div class="ghost-an6"></div>
                    <div class="ghost-an7"></div>
                    <div class="ghost-an8"></div>
                    <div class="ghost-an9"></div>
                    <div class="ghost-an10"></div>
                    <div class="ghost-an11"></div>
                    <div class="ghost-an12"></div>
                    <div class="ghost-an13"></div>
                    <div class="ghost-an14"></div>
                    <div class="ghost-an15"></div>
                    <div class="ghost-an16"></div>
                    <div class="ghost-an17"></div>
                    <div class="ghost-an18"></div>
                </div>
                <div class="ghost-shadow"></div>
            </div>
            <p class="loading-text">${message}</p>
        </div>
    `;
}

// Right panel toggle logic
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('panel-toggle');
    const rightPanel = document.querySelector('.right-panel');
    if (toggleBtn && rightPanel) {
        toggleBtn.addEventListener('click', () => {
            rightPanel.classList.toggle('collapsed');
            const icon = toggleBtn.querySelector('i');
            if (rightPanel.classList.contains('collapsed')) {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-left');
                toggleBtn.style.right = 'auto';
                toggleBtn.style.left = '-40px';
            } else {
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-right');
                toggleBtn.style.left = 'auto';
                toggleBtn.style.right = '20px';
            }
        });
    }
});

async function loadIndexProducts() {
    const container = document.getElementById('products-container');
    const heroSkeleton = document.getElementById('hero-skeleton');

    if (container) {
        container.innerHTML = getGhostLoaderHTML('Cargando productos…');
    }

    try {
        const qHero = query(collection(db, "products"), where("isFeatured", "==", true), limit(1));
        const heroSnap = await getDocs(qHero);

        if (!heroSnap.empty) {
            const heroProd = heroSnap.docs[0];
            const hData = heroProd.data();
            const banner = document.getElementById('hero-banner');
            banner.style.display = 'flex';
            banner.style.backgroundImage = `linear-gradient(to right, rgba(0,0,0,0.8), rgba(0,0,0,0.2)), url('${hData.image}')`;
            document.getElementById('hero-title').textContent = hData.name;
            document.getElementById('hero-price').textContent = `$${hData.price}`;
            document.getElementById('hero-buy-btn').href = `producto.html?id=${heroProd.id}`;
        }

        if (heroSkeleton) heroSkeleton.style.display = 'none';

        const qProds = query(collection(db, "products"), limit(6));
        const prodsSnap = await getDocs(qProds);

        container.innerHTML = '';

        const stockSnapshot = await getDocs(collection(db, "products_stock"));
        const stockData = {};
        stockSnapshot.forEach((d) => { stockData[d.id] = d.data(); });

        prodsSnap.forEach((d) => {
            const p = d.data();

            let statusColor = 'var(--danger)';
            let stockLabel = 'Agotado';
            if (stockData[d.id]) {
                const sd = stockData[d.id];
                if (sd.status === 'disponible') {
                    const count = (sd.credentialsPool || "").split('\n').filter(l => l.trim() !== "").length;
                    stockLabel = count > 0 ? `En stock (${count})` : 'Agotado';
                    statusColor = count > 0 ? 'var(--success)' : 'var(--danger)';
                } else if (sd.status === 'bajo_pedido') {
                    stockLabel = 'Bajo pedido';
                    statusColor = 'var(--warning)';
                }
            }

            container.innerHTML += `
                <a href="producto.html?id=${d.id}" class="card" style="opacity:0;">
                  <div class="card__shine"></div>
                  <div class="card__glow"></div>
                  <div class="card__content">
                    <div class="card__badge" style="background:${statusColor}">${stockLabel}</div>
                    <button class="wishlist-btn" data-id="${d.id}" style="position:absolute; top:12px; left:12px; z-index:4; background:var(--bg-panel); border:1px solid var(--glass-border); color:var(--text-muted); border-radius:50%; width:30px; height:30px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-heart"></i></button>
                    <div class="card__image" style="background-image: url('${p.image || 'https://images.unsplash.com/photo-1605901309584-818e25960b8f?auto=format&fit=crop&w=400'}');"></div>
                    <div class="card__text">
                      <p class="card__title">${p.name}</p>
                      <p class="card__description">Item Premium</p>
                    </div>
                    <div class="card__footer">
                      <div class="card__price">$${p.price}</div>
                      <div class="card__button">
                        <svg height="16" width="16" viewBox="0 0 24 24"><path stroke-width="2" stroke="currentColor" d="M4 12H20M12 4V20" fill="currentColor"></path></svg>
                      </div>
                    </div>
                  </div>
                </a>
            `;
        });

        initWishlistButtons(currentUserWishlist);

        gsap.from(".hero-banner", { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" });
        gsap.to(".card", {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: "power3.out",
            delay: 0.3
        });
    } catch (e) {
        console.error("Error loading products on index", e);
        if (heroSkeleton) heroSkeleton.style.display = 'none';
        if (container) {
            container.innerHTML = `<p style="color:var(--danger); width:100%; text-align:center; padding:2rem;">No se pudieron cargar los productos.</p>`;
        }
    }
}

// --- Reviews System (Mini Red Social) ---
export async function loadReviews() {
    const reviewsContainer = document.getElementById('reviews-container');
    if (!reviewsContainer) return;

    try {
        let q = query(collection(db, "reviews"), orderBy("timestamp", "desc"));
        let snap;
        try {
            snap = await getDocs(q);
        } catch (err) {
            console.warn("Index not ready for orderBy timestamp, falling back to simple getDocs", err);
            snap = await getDocs(collection(db, "reviews"));
        }

        if (snap.empty) {
            reviewsContainer.innerHTML = `
                <div class="review-card" style="min-width: 280px; text-align: center;">
                    <div class="review-stars">★★★★★</div>
                    <div class="body">
                        <p class="text">¡Sé el primero en compartir tu experiencia de compra con la comunidad!</p>
                        <span class="username">@GhostKey</span>
                    </div>
                </div>
            `;
            return;
        }

        reviewsContainer.innerHTML = '';
        snap.forEach(docSnap => {
            const r = docSnap.data();
            const docId = docSnap.id;
            const likesArr = Array.isArray(r.likes) ? r.likes : [];
            const likesCount = likesArr.length;
            const isLiked = currentUser && likesArr.includes(currentUser.uid);
            const ratingVal = Math.min(5, Math.max(1, parseInt(r.rating) || 5));
            const starsHtml = '★'.repeat(ratingVal) + '☆'.repeat(5 - ratingVal);

            const card = document.createElement('div');
            card.className = 'review-card';
            // Strip any quantity info from productName if present (e.g. "Product (1 u)")
            const cleanProdName = (r.productName || '').replace(/\s*\(\d+\s*u.*?\)/i, '').trim();
            const productBadge = cleanProdName ? `<span style="display:inline-block; font-size:0.75rem; background:var(--accent-primary); color:white; padding:2px 8px; border-radius:12px; margin-bottom:8px; font-weight:600;">${escapeHtml(cleanProdName)}</span>` : '';
            
            card.innerHTML = `
                <div class="review-stars">${starsHtml}</div>
                <div class="body">
                    ${productBadge}
                    <p class="text">${escapeHtml(r.text || '')}</p>
                    <span class="username">@${escapeHtml(r.username || 'Usuario')}</span>
                    <div class="footer">
                        <div class="like-btn-action ${isLiked ? 'liked' : ''}" data-id="${docId}">
                            <svg fill="${isLiked ? 'var(--danger)' : 'currentColor'}" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="-2.5 0 32 32">
                                <path class="${isLiked ? 'liked' : ''}" d="M0 10.284l0.505 0.36c0.089 0.064 0.92 0.621 2.604 0.621 0.27 0 0.55-0.015 0.836-0.044 3.752 4.346 6.411 7.472 7.060 8.299-1.227 2.735-1.42 5.808-0.537 8.686l0.256 0.834 7.63-7.631 8.309 8.309 0.742-0.742-8.309-8.309 7.631-7.631-0.834-0.255c-2.829-0.868-5.986-0.672-8.686 0.537-0.825-0.648-3.942-3.3-8.28-7.044 0.11-0.669 0.23-2.183-0.575-3.441l-0.352-0.549-8.001 8.001zM1.729 10.039l6.032-6.033c0.385 1.122 0.090 2.319 0.086 2.334l-0.080 0.314 0.245 0.214c7.409 6.398 8.631 7.39 8.992 7.546l-0.002 0.006 0.195 0.058 0.185-0.087c2.257-1.079 4.903-1.378 7.343-0.836l-13.482 13.481c-0.55-2.47-0.262-5.045 0.837-7.342l0.104-0.218-0.098-0.221-0.031 0.013c-0.322-0.632-1.831-2.38-7.498-8.944l-0.185-0.215-0.282 0.038c-0.338 0.045-0.668 0.069-0.981 0.069-0.595 0-1.053-0.083-1.38-0.176z"></path>
                            </svg>
                            <span>${likesCount}</span>
                        </div>
                    </div>
                </div>
            `;
            reviewsContainer.appendChild(card);
        });

        // Add like click listeners
        document.querySelectorAll('.like-btn-action').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!currentUser) {
                    alert("Debes iniciar sesión para dar Me Gusta.");
                    return;
                }
                const reviewId = btn.dataset.id;
                const reviewRef = doc(db, 'reviews', reviewId);
                const isAlreadyLiked = btn.classList.contains('liked');

                try {
                    await updateDoc(reviewRef, {
                        likes: isAlreadyLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
                    });
                    loadReviews();
                } catch (err) {
                    console.error("Error updating likes:", err);
                }
            });
        });

    } catch (err) {
        console.error("Error loading reviews:", err);
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

async function populateReviewProducts(user) {
    const selector = document.getElementById('review-product-select');
    if (!selector) return;
    const submitBtn = document.getElementById('btn-submit-review');
    const textInput = document.getElementById('review-text');

    try {
        // Fetch all orders by the user
        const qOrders = query(collection(db, "orders"), where("uid", "==", user.uid));
        const ordersSnap = await getDocs(qOrders);
        const orderedProducts = new Map();
        ordersSnap.forEach(doc => {
            const data = doc.data();
            orderedProducts.set(data.productId, data.productName);
        });

        // Fetch all reviews by the user
        const qReviews = query(collection(db, "reviews"), where("uid", "==", user.uid));
        const reviewsSnap = await getDocs(qReviews);
        const reviewedProductIds = new Set();
        reviewsSnap.forEach(doc => {
            const data = doc.data();
            if(data.productId) reviewedProductIds.add(data.productId);
        });

        selector.innerHTML = '';
        let count = 0;

        orderedProducts.forEach((name, id) => {
            if (!reviewedProductIds.has(id)) {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = name;
                selector.appendChild(opt);
                count++;
            }
        });

        if (count === 0) {
            selector.innerHTML = '<option value="">No tienes productos pendientes de reseñar</option>';
            selector.disabled = true;
            if (submitBtn) submitBtn.disabled = true;
            if (textInput) textInput.disabled = true;
        } else {
            selector.disabled = false;
            if (submitBtn) submitBtn.disabled = false;
            if (textInput) textInput.disabled = false;
        }

    } catch(err) {
        console.error("Error populating review products:", err);
    }
}

async function handleReviewSubmit() {
    const textInput = document.getElementById('review-text');
    const selector = document.getElementById('review-product-select');
    if (!textInput || !selector) return;
    
    const text = textInput.value.trim();
    const productId = selector.value;

    if (!productId) {
        alert("Selecciona un producto para reseñar.");
        return;
    }

    if (!text) {
        alert("Por favor escribe tu reseña.");
        return;
    }

    if (!currentUser) {
        alert("Debes iniciar sesión para publicar tu experiencia.");
        return;
    }

    const selectedRating = document.querySelector('input[name="rate"]:checked');
    const ratingVal = selectedRating ? parseInt(selectedRating.value) : 5;
    const productName = selector.options[selector.selectedIndex].text;

    try {
        await addDoc(collection(db, "reviews"), {
            uid: currentUser.uid,
            username: currentUser.displayName || currentUser.email.split('@')[0],
            productId: productId,
            productName: productName,
            text: text,
            rating: ratingVal,
            likes: [],
            timestamp: serverTimestamp()
        });

        textInput.value = '';
        alert("¡Gracias por compartir tu opinión!");
        populateReviewProducts(currentUser);
        loadReviews();
    } catch (err) {
        console.error("Error posting review:", err);
        alert("Error al publicar la reseña.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initMobileDock();
    setUserProfileLoading(true);

    const submitBtn = document.getElementById('btn-submit-review');
    if (submitBtn) {
        submitBtn.addEventListener('click', handleReviewSubmit);
    }
    if (document.getElementById('reviews-container')) {
        loadReviews();
    }
});

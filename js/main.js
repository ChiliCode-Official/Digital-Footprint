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
    if (event.persisted) {
        // Re-trigger auth state check on bfcache restoration
        if (typeof updateUserProfileUI === 'function') {
            updateUserProfileUI(auth.currentUser);
        }
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
            const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=A182E8&color=fff`;
            userAvatar.src = user.photoURL || fallbackUrl;
            userAvatar.alt = user.displayName || user.email;
            // Fallback in case Google photo fails (CORS / expired token on GitHub Pages)
            userAvatar.onerror = () => { userAvatar.src = fallbackUrl; userAvatar.onerror = null; };
        }
        userProfileBtn.title = 'Ver perfil';
    } else {
        if (userNameDisplay) {
            userNameDisplay.classList.remove('user-name--skeleton');
            userNameDisplay.textContent = 'Iniciar sesión';
        }
        if (userAvatar) {
            userAvatar.classList.remove('user-avatar--skeleton');
            userAvatar.src = 'https://ui-avatars.com/api/?name=Invitado&background=1C222E&color=9CA3AF';
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

    const refInput = document.getElementById('ref-link-input');
    const shareBtn = document.getElementById('btn-share-referral') || document.getElementById('btn-copy-referral');
    if (refInput) {
        if (user) {
            const referralLink = `${window.location.origin}/index.html?ref=${user.uid}`;
            refInput.value = referralLink;
            if (shareBtn) {
                shareBtn.onclick = () => {
                    if (navigator.share) {
                        navigator.share({
                            title: 'GhostKey - Tienda Virtual',
                            text: '¡Regístrate en GhostKey usando mi enlace de referido y obtén los mejores productos!',
                            url: referralLink
                        }).catch(console.error);
                    } else {
                        navigator.clipboard.writeText(referralLink)
                            .then(() => alert('¡Enlace de referido copiado!'))
                            .catch(() => alert(`Enlace:\n${referralLink}`));
                    }
                };
            }
        } else {
            refInput.value = 'Inició sesión para ver tu enlace';
            if (shareBtn) {
                shareBtn.onclick = () => {
                    alert('Por favor inicia sesión para obtener tu enlace de referido.');
                };
            }
        }
    }
}


// Inject Auth Modal
function injectAuthModal() {
    if (document.getElementById('auth-modal')) return;
    const modalHtml = `
    <div id="auth-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(5px); z-index:9999; align-items:center; justify-content:center;">
        <div style="background:var(--bg-card); width:90%; max-width:400px; padding:2rem; border-radius:12px; border:1px solid var(--accent-primary); box-shadow:0 0 30px rgba(161,120,232,0.2); position:relative;">
            <button id="close-auth-modal" style="position:absolute; top:12px; right:15px; background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer; transition:color 0.2s;">&times;</button>
            
            <div style="text-align:center; margin-bottom:1.5rem;">
                <img src="https://i.imgur.com/Wq4wBb7.png" style="width:40px; border-radius:8px; margin-bottom:10px;">
                <h2 style="margin:0; font-size:1.5rem; color:var(--text-main);">Bienvenido a GhostKey</h2>
            </div>
            
            <div style="display:flex; gap:10px; margin-bottom:1.5rem;">
                <button id="tab-login" style="flex:1; padding:10px; background:var(--accent-primary); border:none; border-radius:8px; color:#fff; cursor:pointer; font-weight:600; transition:all 0.2s;">Iniciar Sesión</button>
                <button id="tab-register" style="flex:1; padding:10px; background:var(--bg-main); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-muted); cursor:pointer; font-weight:600; transition:all 0.2s;">Registrarse</button>
            </div>
            
            <form id="auth-form" style="display:flex; flex-direction:column; gap:12px;">
                <input type="email" id="auth-email" placeholder="Correo Electrónico" required style="padding:12px; background:var(--bg-main); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:inherit; outline:none; transition:border 0.2s;">
                <input type="password" id="auth-password" placeholder="Contraseña" required style="padding:12px; background:var(--bg-main); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:inherit; outline:none; transition:border 0.2s;">
                <div id="auth-error" style="color:var(--danger); font-size:0.85rem; display:none; text-align:center;"></div>
                <button type="submit" id="auth-submit-btn" style="background:var(--accent-primary); color:#fff; border:none; padding:12px; border-radius:8px; font-weight:700; cursor:pointer; margin-top:5px; transition:background 0.2s;">Ingresar a mi cuenta</button>
            </form>
            
            <div style="margin:25px 0; text-align:center; position:relative;">
                <hr style="border:none; border-top:1px solid var(--glass-border);">
                <span style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:var(--bg-card); padding:0 15px; color:var(--text-muted); font-size:0.85rem;">o</span>
            </div>
            
            <button id="auth-google-btn" type="button" style="width:100%; display:flex; align-items:center; justify-content:center; gap:10px; background:#fff; color:#000; padding:12px; border:none; border-radius:8px; cursor:pointer; font-weight:600; transition:opacity 0.2s;">
                <i class="fa-brands fa-google"></i> Continuar con Google
            </button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Add interactivity
    let isLogin = true;
    const modal = document.getElementById('auth-modal');
    const tabLogin = document.getElementById('tab-login');
    const tabReg = document.getElementById('tab-register');
    const btnSubmit = document.getElementById('auth-submit-btn');
    const form = document.getElementById('auth-form');
    const emailInp = document.getElementById('auth-email');
    const passInp = document.getElementById('auth-password');
    const errDiv = document.getElementById('auth-error');

    document.getElementById('close-auth-modal').onclick = () => modal.style.display = 'none';

    tabLogin.onclick = () => {
        isLogin = true;
        tabLogin.style.background = 'var(--accent-primary)';
        tabLogin.style.color = '#fff';
        tabLogin.style.border = 'none';
        tabReg.style.background = 'var(--bg-main)';
        tabReg.style.color = 'var(--text-muted)';
        tabReg.style.border = '1px solid var(--glass-border)';
        btnSubmit.textContent = 'Ingresar a mi cuenta';
        errDiv.style.display = 'none';
    };

    tabReg.onclick = () => {
        isLogin = false;
        tabReg.style.background = 'var(--accent-primary)';
        tabReg.style.color = '#fff';
        tabReg.style.border = 'none';
        tabLogin.style.background = 'var(--bg-main)';
        tabLogin.style.color = 'var(--text-muted)';
        tabLogin.style.border = '1px solid var(--glass-border)';
        btnSubmit.textContent = 'Crear Cuenta';
        errDiv.style.display = 'none';
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        errDiv.style.display = 'none';
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Procesando...';
        
        try {
            let user = null;
            if (isLogin) {
                const res = await signInWithEmailAndPassword(auth, emailInp.value, passInp.value);
                user = res.user;
            } else {
                const res = await createUserWithEmailAndPassword(auth, emailInp.value, passInp.value);
                user = res.user;
                // Create document for new user
                const userRef = doc(db, 'users', user.uid);
                const referredBy = localStorage.getItem('ghostkey_referred_by') || null;
                await setDoc(userRef, {
                    email: user.email,
                    balance: 0,
                    wishlist: [],
                    cart: {},
                    referralCode: user.uid.substring(0, 8).toUpperCase(),
                    referredBy: referredBy
                });
            }
            if (user) {
                modal.style.display = 'none';
                window.location.href = 'perfil.html';
            }
        } catch (err) {
            errDiv.style.display = 'block';
            if (err.code === 'auth/email-already-in-use') errDiv.textContent = 'El correo ya está registrado.';
            else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') errDiv.textContent = 'Contraseña incorrecta.';
            else if (err.code === 'auth/user-not-found') errDiv.textContent = 'Usuario no encontrado.';
            else errDiv.textContent = 'Error: ' + err.message;
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = isLogin ? 'Ingresar a mi cuenta' : 'Crear Cuenta';
        }
    };

    document.getElementById('auth-google-btn').onclick = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            if (result.user) {
                const userRef = doc(db, 'users', result.user.uid);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    const referredBy = localStorage.getItem('ghostkey_referred_by') || null;
                    await setDoc(userRef, {
                        email: result.user.email,
                        balance: 0,
                        wishlist: [],
                        cart: {},
                        referralCode: result.user.uid.substring(0, 8).toUpperCase(),
                        referredBy: referredBy
                    });
                }
                modal.style.display = 'none';
                window.location.href = 'perfil.html';
            }
        } catch (popupErr) {
            console.warn("Popup error:", popupErr);
            if (popupErr.code === 'auth/operation-not-supported-in-this-environment' || location.protocol === 'file:') {
                errDiv.textContent = "Google Auth no soportado en este entorno.";
                errDiv.style.display = 'block';
            } else {
                await signInWithRedirect(auth, provider);
            }
        }
    };
}

async function handleLogin() {
    if (currentUser) {
        window.location.href = 'perfil.html';
        return;
    }
    
    injectAuthModal();
    const modal = document.getElementById('auth-modal');
    modal.style.display = 'flex';
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
            const navBalance = document.getElementById('nav-balance-label');
            if (navBalance) {
                navBalance.textContent = `$${(uSnap.data().balance || 0).toFixed(2)}`;
            }
        } else {
            currentUserWishlist = [];
        }
    } else {
        currentUserWishlist = [];
    }

    if (document.getElementById('products-container')) {
        loadIndexProducts();
    }
    if (document.getElementById('categories-grid')) {
        loadCategories();
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
            notice.innerHTML = `<i class="fa-solid fa-gift"></i> <span>¡Te invitaron a GhostKey! Inicióa sesión para crear una cuenta NUEVA y contar tu referido.</span> <button onclick="this.parentNode.remove()" style="background:none; border:none; color:white; cursor:pointer; font-size:1.1rem; margin-left:10px;">&times;</button>`;
        }
    }
}

export function getGhostLoaderHTML(message = 'Cargando...…') {
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

// ── CATEGORY GRADIENTS & ICONS ──────────────────────────────────────────────
const CAT_STYLES = [
    { bg: 'linear-gradient(135deg, #1a0f3a, #2d1b69)', icon: 'fa-gamepad' },
    { bg: 'linear-gradient(135deg, #1a0a2e, #3d1057)', icon: 'fa-film' },
    { bg: 'linear-gradient(135deg, #0a1a2e, #1057a8)', icon: 'fa-laptop-code' },
    { bg: 'linear-gradient(135deg, #1a2a0a, #2d5710)', icon: 'fa-user-check' },
    { bg: 'linear-gradient(135deg, #2a1a0a, #572d10)', icon: 'fa-gift' },
    { bg: 'linear-gradient(135deg, #2a0a1a, #571035)', icon: 'fa-music' },
    { bg: 'linear-gradient(135deg, #0a2a1a, #105730)', icon: 'fa-shield-halved' },
    { bg: 'linear-gradient(135deg, #1a1a2a, #2d2d57)', icon: 'fa-bolt' },
];

async function loadCategories() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;
    try {
        const snap = await getDocs(collection(db, 'collections'));
        if (snap.empty) {
            grid.innerHTML = `
                <a href="catalogo.html" class="gk-cat-card">
                    <div class="gk-cat-bg" style="background: linear-gradient(135deg, #1a1a1a, #2d2d2d);"></div>
                    <div class="gk-cat-overlay"></div>
                    <div class="gk-cat-icon"><i class="fa-solid fa-grid"></i></div>
                    <div class="gk-cat-label">Ver Todo</div>
                </a>`;
            return;
        }
        let html = '';
        let i = 0;
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const name = data.name || docSnap.id;
            const style = CAT_STYLES[i % CAT_STYLES.length];
            html += `
                <a href="catalogo.html?cat=${encodeURIComponent(docSnap.id)}" class="gk-cat-card">
                    <div class="gk-cat-bg" style="background: ${style.bg};"></div>
                    <div class="gk-cat-overlay"></div>
                    <div class="gk-cat-icon"><i class="fa-solid ${style.icon}"></i></div>
                    <div class="gk-cat-label">${name}</div>
                </a>`;
            i++;
        });
        // Always add a "Ver Todo" card at the end
        html += `
            <a href="catalogo.html" class="gk-cat-card">
                <div class="gk-cat-bg" style="background: linear-gradient(135deg, #1a1a1a, #2d2d2d);"></div>
                <div class="gk-cat-overlay"></div>
                <div class="gk-cat-icon"><i class="fa-solid fa-grid"></i></div>
                <div class="gk-cat-label">Ver Todo</div>
            </a>`;
        grid.innerHTML = html;
    } catch (e) {
        console.error('Error loading categories:', e);
        grid.innerHTML = `
            <a href="catalogo.html" class="gk-cat-card">
                <div class="gk-cat-bg" style="background: linear-gradient(135deg, #1a1a1a, #2d2d2d);"></div>
                <div class="gk-cat-overlay"></div>
                <div class="gk-cat-icon"><i class="fa-solid fa-grid"></i></div>
                <div class="gk-cat-label">Ver Todo</div>
            </a>`;
    }
}

async function loadIndexProducts() {
    const container = document.getElementById('products-container');
    const heroSkeleton = document.getElementById('hero-skeleton');

    if (container) {
        container.innerHTML = getGhostLoaderHTML('Cargando productos...');
    }

    try {
        let heroProds = [];
        try {
            const qHero = query(collection(db, "products"), where("isFeatured", "==", true), limit(5));
            const heroSnap = await getDocs(qHero);
            heroSnap.forEach(doc => heroProds.push(doc));
        } catch(heroErr) {
            console.warn("Featured query warning:", heroErr);
        }

        const qProds = query(collection(db, "products"), limit(6));
        const prodsSnap = await getDocs(qProds);

        if (heroProds.length === 0 && !prodsSnap.empty) {
            heroProds.push(prodsSnap.docs[0]);
        }

        if (heroProds.length > 0) {
            const banner = document.getElementById('hero-banner');
            const heroBgImg = document.getElementById('hero-bg-img');
            const titleEl = document.getElementById('hero-title');
            const priceEl = document.getElementById('hero-price');
            const buyBtn = document.getElementById('hero-buy-btn');
            
            if (banner) {
                banner.style.display = 'flex';
                let currentHeroIndex = 0;
                
                if (heroBgImg) {
                    heroBgImg.style.transition = 'opacity 0.4s ease';
                }
                if (titleEl) {
                    titleEl.style.transition = 'opacity 0.4s ease';
                }

                const updateHeroUI = () => {
                    const heroProd = heroProds[currentHeroIndex];
                    const hData = heroProd.data();
                    
                    if (heroBgImg) heroBgImg.style.opacity = '0';
                    if (titleEl) titleEl.style.opacity = '0';
                    if (priceEl) priceEl.style.opacity = '0';
                    
                    setTimeout(() => {
                        if (heroBgImg) {
                            heroBgImg.src = hData.image || '';
                            heroBgImg.style.opacity = '1';
                        } else {
                            banner.style.backgroundImage = `linear-gradient(to right, rgba(0,0,0,0.8), rgba(0,0,0,0.2)), url('${hData.image}')`;
                        }
                        if (titleEl) {
                            titleEl.textContent = hData.name;
                            titleEl.style.opacity = '1';
                        }
                        if (priceEl) {
                            priceEl.textContent = `${hData.price} MXN`;
                            priceEl.style.opacity = '1';
                        }
                        if (buyBtn) buyBtn.href = `producto.html?id=${heroProd.id}`;
                    }, 400);

                    currentHeroIndex = (currentHeroIndex + 1) % heroProds.length;
                };

                updateHeroUI();
                
                if (heroProds.length > 1) {
                    if (window.heroInterval) clearInterval(window.heroInterval);
                    window.heroInterval = setInterval(updateHeroUI, 3000);
                }
            }
        }

        if (heroSkeleton) heroSkeleton.style.display = 'none';

        if (container) container.innerHTML = '';

        if (prodsSnap.empty) {
            if (container) container.innerHTML = `<p style="color:var(--text-muted); width:100%; text-align:center; padding:2rem;">No hay productos en el catálogo aún.</p>`;
            return;
        }

        let stockData = {};
        try {
            const stockSnapshot = await getDocs(collection(db, "products_stock"));
            stockSnapshot.forEach((d) => { stockData[d.id] = d.data(); });
        } catch(stockErr) {
            console.warn("Could not fetch stock details:", stockErr);
        }

        prodsSnap.forEach((d) => {
            const p = d.data();

            let badgeBg = 'var(--danger)';
            let stockLabel = 'Agotado';
            if (stockData[d.id]) {
                const sd = stockData[d.id];
                if (sd.status === 'disponible') {
                    const count = (sd.credentialsPool || "").split('\n').filter(l => l.trim() !== "").length;
                    stockLabel = count > 0 ? 'En stock' : 'Agotado';
                    badgeBg = count > 0 ? 'var(--success)' : 'var(--danger)';
                } else if (sd.status === 'bajo_pedido') {
                    stockLabel = 'Bajo pedido';
                    badgeBg = 'var(--warning)';
                }
            }

            const starsHtml = '<i class="fa-solid fa-star"></i>'.repeat(5);

            container.innerHTML += `
                <a href="producto.html?id=${d.id}" class="gk-card">
                    <img class="gk-card-img" src="${p.image || 'https://images.unsplash.com/photo-1605901309584-818e25960b8f?auto=format&fit=crop&w=400'}" alt="${p.name}" loading="lazy">
                    <div class="gk-card-body">
                        <span class="gk-card-badge" style="background:${badgeBg}">${stockLabel}</span>
                        <div class="gk-card-name">${escapeHtml(p.name)}</div>
                        <div class="gk-card-stars">${starsHtml} <span style="color:var(--text-muted); font-size:0.7rem;">(4.8)</span></div>
                        <div class="gk-card-price">$${p.price} <span class="gk-card-original">MXN</span></div>
                    </div>
                </a>
            `;
        });

        initWishlistButtons(currentUserWishlist);
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
                <div class="gk-review-card" style="text-align:center; grid-column:1/-1;">
                    <div style="font-size:2rem;">🤔</div>
                    <p style="color:var(--text-muted);">¡Sé el primero en compartir tu experiencia de compra con la comunidad!</p>
                    <span style="color:var(--text-muted); font-size:0.8rem;">@GhostKey</span>
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
            const starsHtml = '⭐'.repeat(ratingVal) + '☆'.repeat(5 - ratingVal);

            const card = document.createElement('div');
            card.className = 'review-card';
            // Strip any quantity info from productName if present (e.g. "Product (1 u)")
            const cleanProdName = (r.productName || '').replace(/\s*\(\d+\s*u.*?\)/i, '').trim();
            const productBadge = cleanProdName ? `<span style="display:inline-block; font-size:0.75rem; background:var(--accent-primary); color:white; padding:2px 8px; border-radius:12px; margin-bottom:8px; font-weight:600;">${escapeHtml(cleanProdName)}</span>` : '';
            
            card.innerHTML = `
                <div class="review-stars">${starsHtml}</div>
                <div class="review-body">
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
    initGlobalNavFilters();
    setUserProfileLoading(true);

    if (document.getElementById('products-container')) {
        loadIndexProducts();
    }

    const submitBtn = document.getElementById('btn-submit-review');
    if (submitBtn) {
        submitBtn.addEventListener('click', handleReviewSubmit);
    }
    if (document.getElementById('reviews-container')) {
        loadReviews();
    }
});

async function initGlobalNavFilters() {
    const navbar = document.querySelector('.gk-navbar');
    if (!navbar) return;

    // Remove old gk-features if it exists to avoid duplication
    const existing = document.querySelector('.gk-features');
    if (existing && existing.id !== 'global-nav-filters') existing.remove();
    if (document.getElementById('global-nav-filters')) return;

    const filterContainer = document.createElement('div');
    filterContainer.className = 'gk-features';
    filterContainer.id = 'global-nav-filters';
    filterContainer.style.margin = '0';
    filterContainer.style.padding = '12px 16px';
    filterContainer.style.borderBottom = '1px solid var(--glass-border)';

    let html = `<a href="catalogo.html" class="gk-feature"><i class="fa-solid fa-gamepad"></i> Todo</a>`;
    
    try {
        const q = query(collection(db, 'collections'), limit(3));
        const snap = await getDocs(q);
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const icon = data.icon || 'fa-tag';
            html += `<a href="catalogo.html?cat=${encodeURIComponent(docSnap.id)}" class="gk-feature"><i class="fa-solid ${icon}"></i> ${escapeHtml(data.name)}</a>`;
        });
    } catch(e) {
        console.error('Error loading collections for nav:', e);
    }
    
    html += `<a href="info.html" class="gk-feature"><i class="fa-solid fa-circle-info"></i> Ayuda</a>`;
    html += `<a href="pago.html" class="gk-feature"><i class="fa-solid fa-plus"></i> Recargar</a>`;
    
    filterContainer.innerHTML = html;
    
    // Highlight active based on URL
    const urlParams = new URLSearchParams(window.location.search);
    const cat = urlParams.get('cat');
    const isCatalog = window.location.pathname.includes('catalogo.html');
    const links = filterContainer.querySelectorAll('a.gk-feature');
    links.forEach(link => {
        if (isCatalog) {
            if (!cat && link.textContent.includes('Todo')) link.classList.add('active');
            else if (cat && link.href.includes(`cat=${encodeURIComponent(cat)}`)) link.classList.add('active');
        } else {
            if (window.location.href.includes(link.getAttribute('href').split('?')[0]) && !link.textContent.includes('Todo')) {
                link.classList.add('active');
            }
        }
    });

    navbar.insertAdjacentElement('afterend', filterContainer);
}

// Global Referral Share Button Logic
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.share-referral-global-btn');
    if (!btn) return;
    
    // Attempt to share
    try {
        const _auth = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js').then(m => m.getAuth());
        if (!_auth.currentUser) {
            alert('Debes iniciar sesión para compartir tu enlace de referido.');
            return;
        }
        const link = window.location.origin + '/index.html?ref=' + _auth.currentUser.uid;
        
        if (navigator.share) {
            await navigator.share({
                title: 'GhostKey - Juegos Digitales',
                text: '¡Únete a GhostKey con mi enlace y obtén beneficios!',
                url: link
            });
        } else {
            throw new Error('Web Share API no soportada');
        }
    } catch(err) {
        if (err.name !== 'AbortError') {
            const link = window.location.origin + '/index.html?ref=' + (await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js').then(m => m.getAuth().currentUser?.uid || ''));
            navigator.clipboard.writeText(link);
            alert('Enlace copiado al portapapeles: ' + link);
        }
    }
});


// Global Friends Panel Toggle
document.addEventListener('DOMContentLoaded', () => {
    const friendsPanel = document.getElementById('friends-panel');
    const friendsBackdrop = document.getElementById('friends-backdrop');
    function openFriends() {
        if(friendsPanel) friendsPanel.classList.add('open');
        if(friendsBackdrop) friendsBackdrop.classList.add('open');
    }
    function closeFriends() {
        if(friendsPanel) friendsPanel.classList.remove('open');
        if(friendsBackdrop) friendsBackdrop.classList.remove('open');
    }
    
    const navBtn = document.getElementById('nav-friends-btn');
    const dockBtn = document.getElementById('dock-friends-btn');
    const closeBtn = document.getElementById('close-friends-panel');
    
    if (navBtn) navBtn.addEventListener('click', openFriends);
    if (dockBtn) dockBtn.addEventListener('click', openFriends);
    if (closeBtn) closeBtn.addEventListener('click', closeFriends);
    if (friendsBackdrop) friendsBackdrop.addEventListener('click', closeFriends);
});

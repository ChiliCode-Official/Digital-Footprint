import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initWishlistButtons } from './wishlist.js';
import { getGhostLoaderHTML } from './main.js';

const catalogGrid = document.getElementById('catalog-grid');
const filterBtns = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('search-input');
let allProducts = [];
let stockData = {};
let currentUserWishlist = [];

async function fetchUserWishlist(uid) {
    try {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists()) {
            currentUserWishlist = userSnap.data().wishlist || [];
        }
    } catch(e) {
        console.error(e);
    }
}

async function loadProducts() {
    catalogGrid.innerHTML = getGhostLoaderHTML('Cargando catálogo...');
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        allProducts = [];
        querySnapshot.forEach((doc) => {
            allProducts.push({ id: doc.id, ...doc.data() });
        });
        
        const stockSnapshot = await getDocs(collection(db, "products_stock"));
        stockData = {};
        stockSnapshot.forEach((doc) => {
            stockData[doc.id] = doc.data();
        });

        renderProducts(allProducts);
    } catch (e) {
        console.error("Error loading products: ", e);
        catalogGrid.innerHTML = `<p style="color:var(--danger)">Error al cargar el catálogo.</p>`;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeImageUrl(url) {
    if (!url) return '';
    try {
        let clean = url.trim();
        if (clean.includes('imgur.com') && !clean.includes('i.imgur.com')) {
            const parts = clean.split('/');
            const id = parts[parts.length - 1].split('.')[0];
            if (id) return `https://i.imgur.com/${id}.png`;
        }
        return clean;
    } catch(e) {
        return url || '';
    }
}

function renderProducts(products) {
    catalogGrid.innerHTML = '';
    
    if (products.length === 0) {
        catalogGrid.innerHTML = `<p style="color:var(--text-muted); grid-column: 1/-1;">No hay productos que coincidan con la búsqueda.</p>`;
        return;
    }

    products.forEach((prod) => {
        let status = 'Agotado';
        let stockLabel = 'Agotado';
        let statusColor = 'var(--danger)';
        
        if (stockData && stockData[prod.id]) {
            const sd = stockData[prod.id];
            status = sd.status;
            if (status === 'disponible') {
                let pool = sd.credentialsPool || "";
                let count = pool.split('\n').filter(line => line.trim() !== "").length;
                stockLabel = count > 0 ? `En stock (${count})` : 'Agotado';
                statusColor = count > 0 ? 'var(--success)' : 'var(--danger)';
            } else if (status === 'bajo_pedido') {
                stockLabel = 'Bajo pedido';
                statusColor = 'var(--warning)';
            }
        }

        const prodImg = normalizeImageUrl(prod.image) || 'https://images.unsplash.com/photo-1605901309584-818e25960b8f?auto=format&fit=crop&w=400';

        const card = document.createElement('a');
        card.href = `producto.html?id=${prod.id}`;
        card.className = 'card';
        card.style.opacity = 0;
        card.innerHTML = `
            <div class="card__shine"></div>
            <div class="card__glow"></div>
            <div class="card__content">
            <div class="card__badge" style="background:${statusColor}">${stockLabel}</div>
            <button class="wishlist-btn" data-id="${prod.id}" style="position:absolute; top:12px; left:12px; z-index:4; background:var(--bg-panel); border:1px solid var(--glass-border); color:var(--text-muted); border-radius:50%; width:30px; height:30px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-heart"></i></button>
            <div class="card__image" style="background-image: url('${prodImg}');"></div>
            <div class="card__text">
                <p class="card__title">${escapeHtml(prod.name)}</p>
                <p class="card__description">Item Premium</p>
            </div>
            <div class="card__footer">
                <div class="card__price">$${prod.price}</div>
                <div class="card__button">
                <svg height="16" width="16" viewBox="0 0 24 24"><path stroke-width="2" stroke="currentColor" d="M4 12H20M12 4V20" fill="currentColor"></path></svg>
                </div>
            </div>
            </div>
        `;
        catalogGrid.appendChild(card);
    });

    try {
        initWishlistButtons(currentUserWishlist);
    } catch(e) { console.error('Wishlist init error:', e); }

    try {
        if (typeof gsap !== 'undefined') {
            gsap.to('.card', {
                opacity: 1,
                y: -10,
                duration: 0.5,
                stagger: 0.05,
                ease: "power2.out"
            });
        } else {
            document.querySelectorAll('.card').forEach(c => c.style.opacity = 1);
        }
    } catch(e) {
        document.querySelectorAll('.card').forEach(c => c.style.opacity = 1);
    }
}

function handleFilters() {
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyFilters();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
}

function applyFilters() {
    const activeFilterBtn = document.querySelector('.filter-btn.active');
    const activeFilter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'all';
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    let filtered = allProducts;
    
    if (activeFilter !== 'all') {
        filtered = filtered.filter(p => p.category === activeFilter);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(searchTerm));
    }
    
    renderProducts(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
    handleFilters();
});

setPersistence(auth, browserLocalPersistence).catch(console.error);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await fetchUserWishlist(user.uid);
    } else {
        currentUserWishlist = [];
    }
    // Only load products after we know auth state so wishlist renders correctly
    loadProducts();
});

import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initWishlistButtons } from './wishlist.js';
import { getGhostLoaderHTML } from './main.js';

const catalogGrid = document.getElementById('catalog-grid');
const searchInput = document.getElementById('gk-nav-search');
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
    if (catalogGrid) catalogGrid.innerHTML = getGhostLoaderHTML('Cargando catálogo...');
    try {
        let querySnapshot = { forEach: () => {} };
        let stockSnapshot = { forEach: () => {} };

        try { querySnapshot = await getDocs(collection(db, "products")); } catch(e) { console.error("Error fetching products:", e); }
        try { stockSnapshot = await getDocs(collection(db, "products_stock")); } catch(e) { console.warn("Error fetching stock:", e); }

        allProducts = [];
        querySnapshot.forEach((doc) => {
            allProducts.push({ id: doc.id, ...doc.data() });
        });
        
        stockData = {};
        stockSnapshot.forEach((doc) => {
            stockData[doc.id] = doc.data();
        });

        applyFilters(); 
    } catch (e) {
        console.error("Error loading products: ", e);
        if (catalogGrid) catalogGrid.innerHTML = `<p style="color:var(--danger)">Error al cargar el catálogo.</p>`;
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
    if (!catalogGrid) return;
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
            <div class="card__details">
                <p class="card__title">${escapeHtml(prod.name)}</p>
                <div class="card__reviews">
                    <span class="stars">★★★★★</span>
                    <span class="rating">4.8 (1.3k)</span>
                </div>
                <div class="card__price-large">$${prod.price}</div>
                <button class="card__add-btn">
                    Agregar al carrito
                </button>
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
    const urlParams = new URLSearchParams(window.location.search);
    const urlSearch = urlParams.get('search');
    
    if (searchInput) {
        if (urlSearch) {
            searchInput.value = urlSearch;
        }
        searchInput.addEventListener('input', applyFilters);
    }
    
    const priceSelect = document.getElementById('price-select');
    if (priceSelect) {
        priceSelect.addEventListener('change', applyFilters);
    }

    const priceRadios = document.querySelectorAll('input[name="price-filter"]');
    priceRadios.forEach(r => r.addEventListener('change', applyFilters));
    
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', applyFilters);
    }
}

function applyFilters() {
    const urlParams = new URLSearchParams(window.location.search);
    const activeCategory = urlParams.get('cat') || 'all';
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : (urlParams.get('search') || '').toLowerCase();
    
    let filtered = allProducts;
    
    if (activeCategory !== 'all') {
        filtered = filtered.filter(p => p.category === activeCategory);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(searchTerm));
    }
    
    // Apply Price Filter
    const priceSelect = document.getElementById('price-select');
    const checkedPrice = document.querySelector('input[name="price-filter"]:checked');
    const val = priceSelect ? priceSelect.value : (checkedPrice ? checkedPrice.value : 'all');
    
    if (val === 'under-100') filtered = filtered.filter(p => p.price < 100);
    else if (val === '100-500') filtered = filtered.filter(p => p.price >= 100 && p.price <= 500);
    else if (val === 'over-500') filtered = filtered.filter(p => p.price > 500);
    
    // Apply Sort
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        const sortVal = sortSelect.value;
        if (sortVal === 'price-asc') filtered.sort((a,b) => a.price - b.price);
        else if (sortVal === 'price-desc') filtered.sort((a,b) => b.price - a.price);
        else if (sortVal === 'newest') {
            filtered.sort((a,b) => {
                const ta = a.createdAt ? (typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0) : 0;
                const tb = b.createdAt ? (typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0) : 0;
                return tb - ta;
            });
        }
    }
    
    const resultsCount = document.getElementById('results-count');
    if (resultsCount) {
        resultsCount.textContent = filtered.length + ' resultado' + (filtered.length === 1 ? '' : 's');
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
    loadProducts();
});

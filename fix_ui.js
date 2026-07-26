const fs = require('fs');

// 1. Clean up catalogo.html redundant top-bar
let catalogo = fs.readFileSync('c:/Users/lrodr/Documents/GitHub/Digital-Footprint/catalogo.html', 'utf8');
const topBarRegex = /<header class="top-bar">[\s\S]*?<\/header>/;
if (topBarRegex.test(catalogo)) {
    catalogo = catalogo.replace(topBarRegex, '');
    fs.writeFileSync('c:/Users/lrodr/Documents/GitHub/Digital-Footprint/catalogo.html', catalogo, 'utf8');
    console.log('Removed top-bar from catalogo.html');
}

// 2. Add .gk-features and .gk-reviews-grid to style.css if not exists
let style = fs.readFileSync('c:/Users/lrodr/Documents/GitHub/Digital-Footprint/css/style.css', 'utf8');
if (!style.includes('.gk-features {')) {
    const missingCSS = `
/* --- Features strip (global) --- */
.gk-features { display: flex; gap: 12px; overflow-x: auto; padding: 16px 0; margin: 8px 0; scrollbar-width: none; }
.gk-features::-webkit-scrollbar { display: none; }
.gk-feature { display: flex; align-items: center; gap: 8px; background: var(--bg-card); border: 1px solid var(--glass-border); border-radius: 10px; padding: 10px 16px; white-space: nowrap; flex-shrink: 0; font-size: 0.82rem; color: var(--text-muted); text-decoration: none; transition: all 0.2s; }
.gk-feature:hover { border-color: var(--accent-primary); color: var(--text-main); transform: translateY(-2px); }
.gk-feature.active { background: var(--accent-primary); color: #fff; border-color: var(--accent-primary); }
.gk-feature i { font-size: 1.1rem; }
.gk-feature.active i { color: #fff; }
.gk-feature:not(.active) i { color: var(--accent-primary); }

/* --- Reviews Grid (global) --- */
.gk-reviews-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 16px; }
@media(max-width: 768px) { .gk-reviews-grid { grid-template-columns: 1fr; } }
`;
    style += missingCSS;
    
    // Also fix the weird broken character in the rating star from the downloaded file
    style = style.replace(/content: '.*?';/g, (match) => {
        if (match.includes('~') || match.includes('~.')) {
            return "content: '\\u2605';";
        }
        return match;
    });

    fs.writeFileSync('c:/Users/lrodr/Documents/GitHub/Digital-Footprint/css/style.css', style, 'utf8');
    console.log('Added missing CSS to style.css');
}

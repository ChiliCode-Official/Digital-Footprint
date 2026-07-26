const fs = require('fs');
const path = require('path');

const seoTags = `
    <meta name="description" content="Compra cuentas premium, claves de juegos y saldo virtual en GhostKey. Entrega rápida, transacciones seguras y soporte dedicado.">
    <meta name="keywords" content="cuentas premium, claves juegos, saldo virtual, GhostKey, tienda digital, videojuegos">
    <meta name="author" content="GhostKey Oficial">
    <meta property="og:title" content="GhostKey - Tienda Digital Premium">
    <meta property="og:description" content="Compra cuentas premium, claves de juegos y saldo virtual.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://ghostkey.online/">
    <meta property="og:image" content="https://i.imgur.com/LbMnNUg.png">
    <meta name="twitter:card" content="summary_large_image">`;

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('meta name="description"')) {
        content = content.replace(/https:\/\/ghostkey\.app\/?/g, 'https://ghostkey.online/');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated existing tags in ${file}`);
    } else {
        content = content.replace(/(<title>.*?<\/title>)/i, `$1\n${seoTags}`);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Added SEO tags to ${file}`);
    }
});

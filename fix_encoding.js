const fs = require('fs');
const path = require('path');

const files = [
    'js/producto.js',
    'js/catalogo.js',
    'js/perfil.js',
    'js/friends-panel.js',
    'js/main.js',
    'js/pago.js',
    'info.html',
    'index.html',
    'producto.html',
    'catalogo.html',
    'perfil.html'
];

const map = {
    "ÃƒÂ±": "ñ",
    "ÃƒÂ¡": "á",
    "ÃƒÂ©": "é",
    "ÃƒÂ­": "í",
    "ÃƒÂ³": "ó",
    "ÃƒÂº": "ú",
    "Ã‚Â¿": "¿",
    "Ã‚Â¡": "¡",
    "Ã¡": "á",
    "Ã©": "é",
    "Ã­": "í",
    "Ã³": "ó",
    "Ãº": "ú",
    "Ã±": "ñ",
    "Ã‘": "Ñ",
    "Â¿": "¿",
    "Â¡": "¡",
    "reseas": "reseñas",
    "reseï¿½as": "reseñas",
    "Categora": "Categoría",
    "Categora": "Categoría",
    "Categorï¿½a": "Categoría",
    "Aadir": "Añadir",
    "Aadir": "Añadir",
    "Aï¿½adir": "Añadir",
    "Descripcin": "Descripción",
    "Descripcin": "Descripción",
    "Descripciï¿½n": "Descripción",
    "Informacin": "Información",
    "Informacin": "Información",
    "Informaciï¿½n": "Información",
    "Inici": "Inició",
    "Sesin": "Sesión",
    "Sesin": "Sesión",
    "Cargando?": "Cargando...",
    "Cargando": "Cargando...",
    "Cargando...": "Cargando..."
};

files.forEach(f => {
    const fullPath = path.join(__dirname, f);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let originalContent = content;
        for (const [bad, good] of Object.entries(map)) {
            // using split join for global replacement
            content = content.split(bad).join(good);
        }
        
        // Also fix the weird question marks directly using regex for common words
        content = content.replace(/rese[ï¿½]as/g, "reseñas");
        content = content.replace(/Categor[ï¿½]a/g, "Categoría");
        content = content.replace(/A[ï¿½]adir/g, "Añadir");
        content = content.replace(/Descripci[ï¿½]n/g, "Descripción");
        content = content.replace(/Informaci[ï¿½]n/g, "Información");
        content = content.replace(/Sesi[ï¿½]n/g, "Sesión");
        content = content.replace(/Inici[ï¿½]/g, "Inició");
        
        if (content !== originalContent) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log("Fixed", f);
        }
    }
});

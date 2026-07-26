const fs = require('fs');
let css = fs.readFileSync('c:/Users/lrodr/Documents/GitHub/Digital-Footprint/css/style.css', 'utf8');
css = css.replace(/content: '~\.';/g, "content: '\\u2605';");
fs.writeFileSync('c:/Users/lrodr/Documents/GitHub/Digital-Footprint/css/style.css', css, 'utf8');
console.log('Done');

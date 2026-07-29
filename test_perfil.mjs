import fs from 'fs';
import { pathToFileURL } from 'url';

const modulePath = pathToFileURL('c:/Users/lrodr/Documents/GitHub/Digital-Footprint/js/perfil.js').href;

import(modulePath)
  .then(() => console.log('Successfully imported perfil.js'))
  .catch(err => {
    console.error('Failed to import perfil.js:');
    console.error(err);
  });

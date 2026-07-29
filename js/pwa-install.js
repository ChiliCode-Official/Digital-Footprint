document.addEventListener('DOMContentLoaded', () => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
        console.log("PWA already installed");
        return;
    }

    let deferredPrompt = null;
    
    // Detect OS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    // Only show button on mobile for better UX, or let it show on all, but we specifically target mobile
    if (!isIOS && !isAndroid) {
        // Desktop can also install PWA, but user asked specifically about Android/iOS flows. 
        // We will allow it for all devices for fallback.
    }

    // Android: Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        showInstallButton();
    });

    // If iOS, beforeinstallprompt won't fire, so we just show the button automatically
    if (isIOS) {
        showInstallButton();
    } else if (isAndroid && !deferredPrompt) {
        // Sometimes beforeinstallprompt fires before DOMContentLoaded
        // Or if it didn't fire, we still show button and just do a manual fallback or wait
        setTimeout(() => {
            if (!document.getElementById('pwa-install-btn')) {
                showInstallButton();
            }
        }, 1000);
    }

    function showInstallButton() {
        if (document.getElementById('pwa-install-btn')) return;

        const installBtnWrapper = document.createElement('div');
        installBtnWrapper.id = 'pwa-install-wrapper';
        installBtnWrapper.className = 'pwa-btn-wrapper';
        installBtnWrapper.innerHTML = `
          <button id="pwa-install-btn" class="pwa-btn">
            <svg class="pwa-btn-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5v-12M16.5 12 12 16.5 7.5 12M3 20.25h18" stroke="currentColor" fill="none" stroke-width="2"/>
            </svg>
            <div class="pwa-txt-wrapper">
              <div class="pwa-txt-1">
                <span class="pwa-btn-letter">I</span>
                <span class="pwa-btn-letter">n</span>
                <span class="pwa-btn-letter">s</span>
                <span class="pwa-btn-letter">t</span>
                <span class="pwa-btn-letter">a</span>
                <span class="pwa-btn-letter">l</span>
                <span class="pwa-btn-letter">a</span>
                <span class="pwa-btn-letter">r</span>
              </div>
              <div class="pwa-txt-2">
                <span class="pwa-btn-letter">I</span>
                <span class="pwa-btn-letter">n</span>
                <span class="pwa-btn-letter">s</span>
                <span class="pwa-btn-letter">t</span>
                <span class="pwa-btn-letter">a</span>
                <span class="pwa-btn-letter">l</span>
                <span class="pwa-btn-letter">a</span>
                <span class="pwa-btn-letter">n</span>
                <span class="pwa-btn-letter">d</span>
                <span class="pwa-btn-letter">o</span>
              </div>
            </div>
          </button>
        `;

        // Find a place to insert the button below the hero
        const heroSection = document.querySelector('.gk-hero');
        if (heroSection) {
            heroSection.parentNode.insertBefore(installBtnWrapper, heroSection.nextSibling);
        } else {
            // Fallback: append to body as fixed button
            installBtnWrapper.style.position = 'fixed';
            installBtnWrapper.style.bottom = '80px';
            installBtnWrapper.style.left = '50%';
            installBtnWrapper.style.transform = 'translateX(-50%)';
            installBtnWrapper.style.zIndex = '9999';
            document.body.appendChild(installBtnWrapper);
        }

        const installBtn = document.getElementById('pwa-install-btn');
        installBtn.addEventListener('click', async () => {
            if (isIOS) {
                showIOSTutorial();
            } else {
                if (deferredPrompt) {
                    // Show the install prompt
                    deferredPrompt.prompt();
                    // Wait for the user to respond to the prompt
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`User response to the install prompt: ${outcome}`);
                    // We've used the prompt, and can't use it again, throw it away
                    deferredPrompt = null;
                    if (outcome === 'accepted') {
                        installBtn.style.display = 'none';
                    }
                } else {
                    alert("Para instalar en Android, abre las opciones de Chrome (tres puntos) y selecciona 'Instalar aplicación' o 'Añadir a la pantalla de inicio'.");
                }
            }
        });
    }

    function showIOSTutorial() {
        // Create an overlay tutorial for iOS
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(11, 14, 20, 0.9)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'flex-end';
        overlay.style.padding = '20px';
        overlay.style.backdropFilter = 'blur(10px)';
        overlay.style.color = '#fff';
        overlay.style.textAlign = 'center';

        overlay.innerHTML = `
            <div style="background: var(--bg-card); padding: 25px; border-radius: 20px; border: 1px solid var(--glass-border); position: relative; margin-bottom: 20px;">
                <button id="close-ios-tutorial" style="position: absolute; top: 10px; right: 15px; background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;">&times;</button>
                <h3 style="margin-bottom: 15px; font-size: 1.3rem;">Instalar en iOS</h3>
                <p style="margin-bottom: 15px; color: var(--text-muted);">Instala GhostKey en tu iPhone para una experiencia nativa.</p>
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; text-align: left; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px;">
                    <i class="fa-solid fa-arrow-up-from-bracket" style="font-size: 24px; color: var(--accent-primary);"></i>
                    <p style="margin: 0;"><strong>Paso 1:</strong> Toca el botón <b>Compartir</b> en la barra inferior de Safari.</p>
                </div>
                <div style="display: flex; align-items: center; gap: 15px; text-align: left; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px;">
                    <i class="fa-regular fa-square-plus" style="font-size: 24px; color: var(--accent-primary);"></i>
                    <p style="margin: 0;"><strong>Paso 2:</strong> Desliza hacia abajo y toca <b>"Agregar a Inicio"</b>.</p>
                </div>
                <div style="margin-top: 20px;">
                    <i class="fa-solid fa-arrow-down" style="font-size: 30px; color: var(--accent-primary); animation: bounce 1.5s infinite;"></i>
                </div>
            </div>
            <style>
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(10px); }
                }
            </style>
        `;

        document.body.appendChild(overlay);

        document.getElementById('close-ios-tutorial').addEventListener('click', () => {
            overlay.remove();
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }
});

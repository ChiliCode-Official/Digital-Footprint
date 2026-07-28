import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, getDocs, setDoc, collection, addDoc, updateDoc, serverTimestamp, runTransaction, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
let userData = null;

// URL Params
const urlParams = new URLSearchParams(window.location.search);
const from = urlParams.get('from'); // 'cart', 'profile', 'product'
const targetAmount = parseFloat(urlParams.get('amount')) || 0;
const productId = urlParams.get('productId');
const qty = parseInt(urlParams.get('qty')) || 1;
const isGift = urlParams.get('isGift') === 'true';
const giftEmail = urlParams.get('giftEmail');

// UI Elements
const pagoContent = document.getElementById('pago-content');
const authMsg = document.getElementById('auth-state-message');
const dynamicArea = document.getElementById('dynamic-payment-area');
const actionArea = document.getElementById('action-area');
const titleEl = document.getElementById('pago-title');
const subEl = document.getElementById('pago-subtitle');
const errorEl = document.getElementById('pago-error');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        authMsg.style.display = 'none';
        pagoContent.style.display = 'grid';
        
        try {
            const userRef = doc(db, 'users', user.uid);
            const uSnap = await getDoc(userRef);
            if (uSnap.exists()) {
                userData = uSnap.data();
                initializePaymentLogic();
            } else {
                showError("No se encontró la información del usuario.");
            }
        } catch(e) {
            console.error(e);
            showError("Error al cargar datos del usuario.");
        }
    } else {
        authMsg.style.display = 'block';
        pagoContent.style.display = 'none';
    }
});

function showError(msg) {
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    }
}

function initializePaymentLogic() {
    const currentBalance = userData.balance || 0;
    const isPurchase = (from === 'cart' || from === 'product');
    
    // DECISION TREE
    if (isPurchase && currentBalance >= targetAmount && targetAmount > 0) {
        // MODE: CONFIRM PURCHASE WITH BALANCE
        setupPurchaseMode(currentBalance, targetAmount);
    } else {
        // MODE: RECHARGE BALANCE
        setupRechargeMode(currentBalance, targetAmount);
    }
}

function setupPurchaseMode(balance, amount) {
    titleEl.innerHTML = '<i class="fa-solid fa-bag-shopping"></i> Confirmar Compra';
    subEl.textContent = 'Tienes saldo suficiente para esta operación.';
    
    const remaining = balance - amount;
    
    dynamicArea.innerHTML = `
        <div class="confirm-box">
            <h3 style="font-size: 1.5rem; margin-bottom: 10px;">Resumen</h3>
            <p>Saldo Actual: <strong style="color: var(--accent-primary);">$${balance.toFixed(2)}</strong></p>
            <p>Total a Pagar: <strong style="color: var(--danger);">-$${amount.toFixed(2)}</strong></p>
            <hr style="border: 0; border-top: 1px solid var(--glass-border); margin: 10px 0;">
            <p>Saldo Restante: <strong>$${remaining.toFixed(2)}</strong></p>
            <p style="margin-top: 1rem; font-weight: bold; color: var(--accent-primary);">¿Estás seguro que confirmas tu compra?</p>
        </div>
    `;
    
    actionArea.innerHTML = `
        <button id="btn-confirm-purchase" class="btn-primary" style="width:100%; padding: 14px; font-size: 1.1rem;">
            <i class="fa-solid fa-check"></i> Confirmar y Comprar
        </button>
        <button id="btn-cancel" class="btn-secondary" style="width:100%; padding: 14px; margin-top: 10px;">
            Cancelar
        </button>
    `;
    
    document.getElementById('btn-cancel').onclick = () => window.history.back();
    document.getElementById('btn-confirm-purchase').onclick = processPurchase;
}

let selectedAccount = null;

async function setupRechargeMode(balance, suggestedAmount) {
    titleEl.innerHTML = '<i class="fa-solid fa-wallet"></i> Depositar Saldo';
    if (from === 'cart' || from === 'product') {
        subEl.innerHTML = `<span style="color:var(--warning);"><i class="fa-solid fa-triangle-exclamation"></i> Saldo insuficiente.</span> Selecciona tu método y monto para abonar.`;
    } else {
        subEl.textContent = 'Selecciona tu método de pago y la cantidad a depositar.';
    }
    
    const defaultVal = suggestedAmount > 0 ? suggestedAmount : '';
    
    dynamicArea.innerHTML = `
        <div style="margin-bottom: 1.2rem;">
            <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 8px;">1. Método de Depósito</label>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;" id="payment-method-selector">
                <button type="button" class="r-method-opt active" data-method="transferencia" style="flex: 1; min-width: 140px; padding: 12px; border-radius: 10px; border: 2px solid var(--accent-primary); background: rgba(161, 130, 232, 0.15); color: white; cursor: pointer; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
                    <i class="fa-solid fa-building-columns" style="color: var(--accent-primary);"></i> Transferencia
                </button>
                <button type="button" class="r-method-opt" data-method="efectivo" style="flex: 1; min-width: 140px; padding: 12px; border-radius: 10px; border: 1px solid var(--glass-border); background: var(--bg-card); color: var(--text-muted); cursor: pointer; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
                    <i class="fa-solid fa-store" style="color: var(--warning);"></i> Efectivo / OXXO
                </button>
            </div>
        </div>

        <div style="margin-bottom: 1.2rem;">
            <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 8px;">2. Monto a Depositar ($ MXN)</label>
            <div class="recharge-options" id="recharge-btns" style="display: flex; flex-wrap: wrap; gap: 10px;">
                <div class="r-opt" data-val="100" style="flex: 1; min-width: 60px; text-align: center;">$100</div>
                <div class="r-opt" data-val="200" style="flex: 1; min-width: 60px; text-align: center;">$200</div>
                <div class="r-opt" data-val="500" style="flex: 1; min-width: 60px; text-align: center;">$500</div>
                <div class="r-opt" data-val="1200" style="flex: 1; min-width: 60px; text-align: center;">$1200</div>
            </div>
            <input type="number" id="custom-recharge-amount" class="brutalist-input" placeholder="Monto personalizado (Min. $15)" style="width: 100%; margin-top: 10px; font-size: 1.05rem; padding: 12px; border-radius: 10px;" min="15" value="${defaultVal}">
        </div>

        <div id="bank-info-box" style="background: rgba(161, 130, 232, 0.08); border: 1px solid var(--accent-primary); padding: 1rem; border-radius: 12px; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: var(--accent-primary); font-size: 0.85rem;" id="pm-bank-title"><i class="fa-solid fa-credit-card"></i> Cuenta CLABE Oficial (STP / GhostKey)</strong>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-main); padding: 8px 12px; border-radius: 8px;">
                <span style="font-family: monospace; font-size: 0.95rem; font-weight: bold; letter-spacing: 1px;" id="pm-clabe-display">646180157012345678</span>
                <button type="button" id="btn-copy-clabe-pago" class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;"><i class="fa-solid fa-copy"></i> Copiar</button>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;" id="pm-guide-text">Realiza la transferencia y haz clic en Confirmar para notificar al Administrador.</p>
        </div>
    `;
    
    actionArea.innerHTML = `
        <div class="pos-anim-container-btn" id="btn-process-recharge" style="margin: 0 auto;">
          <div class="pos-left-side-btn">
            <div class="pos-card-btn">
              <div class="pos-card-line-btn"></div>
              <div class="pos-buttons-btn"></div>
            </div>
            <div class="pos-post-btn">
              <div class="pos-post-line-btn"></div>
              <div class="pos-screen-btn">
                <div class="pos-icon-btn">!</div>
              </div>
              <div class="pos-numbers-btn"></div>
              <div class="pos-numbers-line2-btn"></div>
            </div>
          </div>
          <div class="pos-right-side-btn">
            <div class="pos-new-btn" id="btn-process-text">Confirmar Pago</div>
            <svg class="pos-arrow-btn" xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 451.846 451.847">
              <path d="M345.441 248.292L151.154 442.573c-12.359 12.365-32.397 12.365-44.75 0-12.354-12.354-12.354-32.391 0-44.744L278.318 225.92 106.409 54.017c-12.354-12.359-12.354-32.394 0-44.748 12.354-12.359 32.391-12.359 44.75 0l194.287 194.284c6.177 6.18 9.262 14.271 9.262 22.366 0 8.099-3.091 16.196-9.267 22.373z" class="active-path" fill="#4b953b"></path>
            </svg>
          </div>
        </div>
    `;

    // Load account logic from Firestore filtered by tipo
    async function loadAccountForTipo(tipo) {
        const clabeDisplay = document.getElementById('pm-clabe-display');
        const bankTitle = document.getElementById('pm-bank-title');
        
        try {
            const snap = await getDocs(collection(db, "payment_methods"));
            let foundDoc = null;
            
            snap.forEach(dSnap => {
                const dData = dSnap.data();
                if (!foundDoc && (dData.tipo === tipo || (!dData.tipo && tipo === 'transferencia'))) {
                    foundDoc = { id: dSnap.id, ...dData };
                }
            });

            if (foundDoc) {
                selectedAccount = foundDoc;
                if (clabeDisplay) clabeDisplay.textContent = foundDoc.clabe || '646180157012345678';
                if (bankTitle) bankTitle.innerHTML = `<i class="fa-solid fa-credit-card"></i> ${escapeHtml(foundDoc.banco || 'Cuenta Oficial GhostKey')}`;
            } else {
                // Default fallback if no method configured in admin for this tipo
                selectedAccount = {
                    clabe: '646180157012345678',
                    banco: tipo === 'transferencia' ? 'STP / GhostKey' : 'OXXO / STP GhostKey',
                    beneficiario: 'GhostKey Oficial'
                };
                if (clabeDisplay) clabeDisplay.textContent = selectedAccount.clabe;
                if (bankTitle) bankTitle.innerHTML = `<i class="fa-solid fa-credit-card"></i> ${selectedAccount.banco}`;
            }
        } catch (e) {
            console.error("Error loading account for tipo:", e);
            selectedAccount = { clabe: '646180157012345678', banco: 'STP / GhostKey' };
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Initial load for default active method ('transferencia')
    await loadAccountForTipo('transferencia');
    
    // Select Method logic
    const methodBtns = document.querySelectorAll('.r-method-opt');
    const guideText = document.getElementById('pm-guide-text');
    methodBtns.forEach(mBtn => {
        mBtn.onclick = async () => {
            methodBtns.forEach(b => {
                b.classList.remove('active');
                b.style.borderColor = 'var(--glass-border)';
                b.style.background = 'var(--bg-card)';
                b.style.color = 'var(--text-muted)';
            });
            mBtn.classList.add('active');
            mBtn.style.borderColor = 'var(--accent-primary)';
            mBtn.style.background = 'rgba(161, 130, 232, 0.15)';
            mBtn.style.color = 'white';

            const methodKey = mBtn.dataset.method;
            const isTransfer = methodKey === 'transferencia';
            if (guideText) {
                guideText.textContent = isTransfer 
                    ? 'Realiza la transferencia interbancaria SPEI y confirma tu depósito.'
                    : 'Deposita en cualquier OXXO/Ventanilla a la cuenta CLABE y confirma tu pago.';
            }

            await loadAccountForTipo(methodKey);
        };
    });

    // Select Amount logic
    const inputAmount = document.getElementById('custom-recharge-amount');
    const rOpts = document.querySelectorAll('.r-opt');
    rOpts.forEach(btn => {
        btn.onclick = () => {
            rOpts.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            inputAmount.value = btn.getAttribute('data-val');
        };
    });

    // Copy CLABE button
    const copyClabeBtn = document.getElementById('btn-copy-clabe-pago');
    if (copyClabeBtn) {
        copyClabeBtn.onclick = () => {
            const clabeText = selectedAccount ? selectedAccount.clabe : '646180157012345678';
            navigator.clipboard.writeText(clabeText).then(() => {
                copyClabeBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copiado`;
                setTimeout(() => { copyClabeBtn.innerHTML = `<i class="fa-solid fa-copy"></i> Copiar`; }, 2000);
            });
        };
    }
    
    document.getElementById('btn-process-recharge').onclick = processRecharge;
}

async function processRecharge() {
    const input = document.getElementById('custom-recharge-amount');
    const amount = parseFloat(input.value);
    const selectedMethodBtn = document.querySelector('.r-method-opt.active');
    const methodKey = selectedMethodBtn ? selectedMethodBtn.dataset.method : 'transferencia';
    const methodLabel = methodKey === 'transferencia' ? 'Transferencia SPEI' : 'Efectivo / OXXO';
    
    if (isNaN(amount) || !Number.isFinite(amount) || amount < 15) {
        showError("El monto debe ser un número válido mayor o igual a $15 MXN.");
        return;
    }
    
    if (!currentUser) {
        showError("Debes iniciar sesión para realizar esta operación.");
        return;
    }
    
    const btn = document.getElementById('btn-process-recharge');
    const textEl = document.getElementById('btn-process-text');
    if (btn) {
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.7';
    }
    if (textEl) textEl.textContent = 'Procesando...';
    
    try {
        const reqRef = doc(collection(db, 'balance_requests'));
        // methodLabel already declared above with null-safe check
        
        await setDoc(reqRef, {
            uid: currentUser.uid,
            userEmail: currentUser.email,
            amount: amount,
            method: methodLabel,
            status: 'pendiente',
            timestamp: serverTimestamp()
        });
        
        if (btn) {
            btn.classList.add('expanding');
        }
        
        setTimeout(() => {
            setupWaitingScreen(reqRef.id, amount, methodLabel);
        }, 600);
        
    } catch (e) {
        console.error("Error in processRecharge:", e);
        showError("Error al registrar la solicitud: " + (e.message || "Fallo en Firestore"));
        if (btn) {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        }
        if (textEl) textEl.textContent = 'Confirmar Pago';
    }
}

function setupWaitingScreen(requestId, amount, methodLabel) {
    const posStatusText = document.getElementById('pos-status-text');
    if (posStatusText) posStatusText.textContent = 'Esperando tu Pago';
    
    titleEl.innerHTML = '<i class="fa-solid fa-clock-rotate-left" style="color:var(--warning);"></i> Solicitud Enviada';
    subEl.textContent = 'Estamos esperando la confirmación de tu depósito por el administrador.';

    dynamicArea.innerHTML = `
        <div style="background: var(--bg-card); border: 1px solid var(--accent-primary); border-radius: 16px; padding: 2rem 1.5rem; text-align: center; box-shadow: var(--shadow-glow); display: flex; flex-direction: column; align-items: center; gap: 20px;">
            <div class="pos-anim-container">
             <div class="pos-left-side">
              <div class="pos-card">
               <div class="pos-card-line"></div>
               <div class="pos-buttons"></div>
              </div>
              <div class="pos-post">
               <div class="pos-post-line"></div>
               <div class="pos-screen">
                <div class="pos-dollar">$</div>
               </div>
               <div class="pos-numbers"></div>
               <div class="pos-numbers-line2"></div>
              </div>
             </div>
             <div class="pos-right-side">
              <div class="pos-new">Procesando...</div>
               <svg viewBox="0 0 451.846 451.847" height="512" width="512" xmlns="http://www.w3.org/2000/svg" class="pos-arrow"><path fill="#cfcfcf" data-old_color="#000000" class="active-path" data-original="#000000" d="M345.441 248.292L151.154 442.573c-12.359 12.365-32.397 12.365-44.75 0-12.354-12.354-12.354-32.391 0-44.744L278.318 225.92 106.409 54.017c-12.354-12.359-12.354-32.394 0-44.748 12.354-12.359 32.391-12.359 44.75 0l194.287 194.284c6.177 6.18 9.262 14.271 9.262 22.366 0 8.099-3.091 16.196-9.267 22.373z"></path></svg>
             </div>
            </div>
            
            <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 5px; color: #fff;">Esperando tu pago...</h3>
            <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 0.5rem;">
                Monto: <strong style="color:#fff;">$${amount.toFixed(2)} MXN</strong> | Método: <strong style="color:var(--accent-primary);">${methodLabel}</strong>
            </p>
            <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px;">
                El administrador verificará la recepción del dinero para abonar los créditos a tu saldo.
            </p>
        </div>
    `;

    actionArea.innerHTML = `
        <a href="perfil.html" class="btn-secondary" style="display:block; text-align:center; padding: 12px; text-decoration:none; border-radius:10px;">
            <i class="fa-solid fa-user"></i> Ir a Mi Perfil
        </a>
    `;

    // Listen to real-time status changes in Firestore
    onSnapshot(doc(db, 'balance_requests', requestId), (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        
        if (data.status === 'aprobado') {
            titleEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--success);"></i> ¡Pago Aprobado!';
            subEl.textContent = 'El saldo ha sido acreditado exitosamente a tu cuenta.';
            if (posStatusText) posStatusText.textContent = 'Pago Exitoso';

            dynamicArea.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.1); border: 2px solid var(--success); border-radius: 16px; padding: 1.5rem; text-align: center;">
                    <i class="fa-solid fa-circle-check" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
                    <h3 style="font-size: 1.3rem; color: #fff; margin-bottom: 6px;">¡Créditos Abonados!</h3>
                    <p style="font-size: 1.2rem; font-weight: bold; color: var(--success); margin-bottom: 1rem;">
                        +$${amount.toFixed(2)} MXN
                    </p>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">
                        El dinero ya está disponible en tu saldo GhostKey.
                    </p>
                </div>
            `;
            
            actionArea.innerHTML = `
                <a href="catalogo.html" class="btn-primary" style="display:block; text-align:center; padding: 14px; font-size: 1.05rem; text-decoration:none; border-radius:12px;">
                    <i class="fa-solid fa-gamepad"></i> Ir al Catálogo a Comprar
                </a>
            `;
        } else if (data.status === 'rechazado') {
            titleEl.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:var(--danger);"></i> Pago Rechazado';
            subEl.textContent = 'No pudimos verificar la recepción de tu pago.';
            if (posStatusText) posStatusText.textContent = 'Pago Rechazado';

            const waMsg = `Hola, mi solicitud de recarga por $${amount} MXN (${currentUser.email}) fue rechazada. ¿Me ayudan por favor?`;
            const waUrl = `https://wa.me/5211234567890?text=${encodeURIComponent(waMsg)}`;

            dynamicArea.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.1); border: 2px solid var(--danger); border-radius: 16px; padding: 1.5rem; text-align: center;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.8rem; color: var(--danger); margin-bottom: 0.8rem;"></i>
                    <h3 style="font-size: 1.15rem; color: #fff; margin-bottom: 8px;">Lo sentimos</h3>
                    <p style="font-size: 0.88rem; color: var(--text-main); margin-bottom: 1.2rem; line-height: 1.5;">
                        Tu pago no pudo ser confirmado. ¿Tienes alguna duda o sugerencia?
                    </p>
                    <a href="${waUrl}" target="_blank" class="btn-primary" style="display:inline-flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:12px; background: #25D366; color:#000; font-weight:700; text-decoration:none; border-radius:10px;">
                        <i class="fa-brands fa-whatsapp" style="font-size:1.3rem;"></i> Contactar por WhatsApp
                    </a>
                </div>
            `;

            actionArea.innerHTML = `
                <a href="perfil.html" class="btn-secondary" style="display:block; text-align:center; padding: 12px; text-decoration:none; border-radius:10px;">
                    Volver a Mi Perfil
                </a>
            `;
        }
    });
}

async function processPurchase() {
    const btn = document.getElementById('btn-confirm-purchase');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
    errorEl.style.display = 'none';

    try {
        if (from === 'cart') {
            await processCartPurchase();
        } else if (from === 'product') {
            await processSinglePurchase();
        } else {
            throw new Error("Origen de compra inválido.");
        }
    } catch (e) {
        console.error(e);
        showError(e.message || String(e));
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar y Comprar';
    }
}

async function processCartPurchase() {
    const cartObj = userData.cart || {};
    const cartItems = Object.keys(cartObj);
    if (cartItems.length === 0) throw new Error("El carrito está vacío.");

    let finalTotal = 0;
    
    await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', currentUser.uid);
        const uSnap = await transaction.get(userRef);
        const userData = uSnap.data();
        const currentBal = userData.balance || 0;
        const referredBy = userData.referredBy;
        
        let calculatedTotal = 0;
        const productsData = [];

        // Fetch all product data and stock in transaction
        for (const pid of cartItems) {
            let pQtyObj = cartObj[pid];
            let pQty = 0;
            let duration = '';
            if (typeof pQtyObj === 'number') {
                pQty = pQtyObj;
            } else if (pQtyObj) {
                pQty = parseInt(pQtyObj.qty) || 0;
                duration = pQtyObj.duration || '';
            }
            if (isNaN(pQty) || !Number.isFinite(pQty) || pQty <= 0) {
                throw new Error("Cantidad inválida en el carrito.");
            }
            const pRef = doc(db, 'products', pid);
            const pSnap = await transaction.get(pRef);
            if (pSnap.exists()) {
                const p = pSnap.data();
                const price = parseFloat(p.price);
                if (isNaN(price) || !Number.isFinite(price) || price < 0) {
                    throw new Error(`Precio inválido en producto: ${p.name}`);
                }
                calculatedTotal += (price * pQty);
                productsData.push({ id: pid, qty: pQty, price: price, name: p.name, duration: duration });
            }
        }
        
        if (currentBal < calculatedTotal) throw new Error("Saldo insuficiente (el carrito pudo haber cambiado de precio).");
        finalTotal = calculatedTotal;

        // Process each product
        for (const prod of productsData) {
            const stockRef = doc(db, 'products_stock', prod.id);
            const sSnap = await transaction.get(stockRef);
            
            let credsToGive = [];
            let availableCount = 0;
            let pendingQty = prod.qty;
            let oStatus = "confirmado";
            
            if (sSnap.exists() && sSnap.data().status === 'disponible') {
                let pool = (sSnap.data().credentialsPool || "").split('\n').filter(l => l.trim() !== "");
                availableCount = Math.min(pool.length, prod.qty);
                if (availableCount > 0) {
                    credsToGive = pool.splice(0, availableCount);
                    transaction.update(stockRef, { credentialsPool: pool.join('\n') });
                }
                pendingQty = prod.qty - availableCount;
                if (pendingQty > 0) {
                    oStatus = "pendiente";
                    if (availableCount === 0) {
                        credsToGive = ["Se agotó el stock. El administrador procesará tu entrega pronto."];
                    } else {
                        credsToGive.push(`[Nota: Se entregaron ${availableCount} credencial(es). Faltan ${pendingQty} por entregar por el administrador.]`);
                    }
                }
            } else if (sSnap.exists() && sSnap.data().status === 'bajo_pedido') {
                oStatus = "pendiente";
                credsToGive = ["El administrador procesará tu entrega pronto."];
                pendingQty = prod.qty;
            } else {
                oStatus = "pendiente";
                credsToGive = ["Entrega pendiente de verificación."];
                pendingQty = prod.qty;
            }

            const newOrderRef = doc(collection(db, 'orders'));
            const orderPayload = {
                uid: currentUser.uid,
                userEmail: currentUser.email,
                productId: prod.id,
                productName: prod.name,
                price: prod.price * prod.qty,
                quantity: prod.qty,
                deliveredQuantity: availableCount,
                pendingQuantity: pendingQty,
                method: 'creditos',
                status: oStatus,
                textDelivered: credsToGive.join('\n'),
                isGift: false,
                timestamp: serverTimestamp()
            };
            if (prod.duration) orderPayload.streamingDuration = prod.duration;
            transaction.set(newOrderRef, orderPayload);
        }

        // Deduct balance and clear cart
        transaction.update(userRef, { 
            balance: currentBal - calculatedTotal,
            cart: {}
        });

        if (referredBy) {
            const referrerRef = doc(db, 'users', referredBy);
            const referrerSnap = await transaction.get(referrerRef);
            if (referrerSnap.exists()) {
                const rData = referrerSnap.data();
                const bonus = calculatedTotal * 0.03;
                transaction.update(referrerRef, { balance: (rData.balance || 0) + bonus });
            }
        }
    });

    showPremiumSuccess(`¡Compra realizada! Se descontaron ${finalTotal.toFixed(2)}.`, "perfil.html");
}

async function processSinglePurchase() {
    if (!productId) throw new Error("Producto inválido.");
    
    let productName = "Producto";
    
    await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', currentUser.uid);
        const uSnap = await transaction.get(userRef);
        const userData = uSnap.data();
        const currentBal = userData.balance || 0;
        const referredBy = userData.referredBy;
        
        const pRef = doc(db, 'products', productId);
        const pSnap = await transaction.get(pRef);
        if (!pSnap.exists()) throw new Error("Producto no encontrado.");
        
        const pData = pSnap.data();
        productName = pData.name;
        
        const parsedQty = parseInt(qty);
        if (isNaN(parsedQty) || !Number.isFinite(parsedQty) || parsedQty <= 0) {
            throw new Error("Cantidad inválida.");
        }
        const parsedPrice = parseFloat(pData.price);
        if (isNaN(parsedPrice) || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
            throw new Error("Precio inválido en el producto.");
        }
        
        const actualPrice = parsedPrice * parsedQty;
        
        if (currentBal < actualPrice) throw new Error("Saldo insuficiente.");

        const stockRef = doc(db, 'products_stock', productId);
        const sSnap = await transaction.get(stockRef);
        
        let credsToGive = [];
        let availableCount = 0;
        let pendingQty = parsedQty;
        let oStatus = "confirmado";
        
        if (sSnap.exists() && sSnap.data().status === 'disponible') {
            let pool = (sSnap.data().credentialsPool || "").split('\n').filter(l => l.trim() !== "");
            availableCount = Math.min(pool.length, parsedQty);
            if (availableCount > 0) {
                credsToGive = pool.splice(0, availableCount);
                transaction.update(stockRef, { credentialsPool: pool.join('\n') });
            }
            pendingQty = parsedQty - availableCount;
            if (pendingQty > 0) {
                oStatus = "pendiente";
                if (availableCount === 0) {
                    credsToGive = ["Se agotó el stock instantáneo. Espera confirmación del admin."];
                } else {
                    credsToGive.push(`[Nota: Se entregaron ${availableCount} credencial(es). Faltan ${pendingQty} por entregar por el administrador.]`);
                }
            }
        } else if (sSnap.exists() && sSnap.data().status === 'bajo_pedido') {
            oStatus = "pendiente";
            credsToGive = ["El administrador procesará tu entrega pronto."];
            pendingQty = parsedQty;
        } else {
            oStatus = "pendiente";
            credsToGive = ["Entrega pendiente."];
            pendingQty = parsedQty;
        }

        transaction.update(userRef, { balance: currentBal - actualPrice });
        
        if (referrerSnap && referrerSnap.exists()) {
            const rData = referrerSnap.data();
            const bonus = actualPrice * 0.03;
            transaction.update(referrerRef, { balance: (rData.balance || 0) + bonus });
        }
        
        const newOrderRef = doc(collection(db, 'orders'));
        transaction.set(newOrderRef, {
            uid: currentUser.uid,
            userEmail: currentUser.email,
            productId: productId,
            productName: pData.name,
            price: actualPrice,
            quantity: parsedQty,
            deliveredQuantity: availableCount,
            pendingQuantity: pendingQty,
            method: 'creditos',
            status: oStatus,
            textDelivered: credsToGive.join('\n'),
            isGift: isGift,
            giftEmail: isGift ? giftEmail : null,
            timestamp: serverTimestamp()
        });
    });

    if (isGift) {
        showAstronautModal(productName, giftEmail);
    } else {
        showPremiumSuccess("Tu compra fue procesada correctamente.", "perfil.html");
    }
}

function showAstronautModal(productName, email) {
    const modal = document.getElementById('gift-confirmation-modal');
    const nameEl = document.getElementById('gift-friend-name');
    const shareBtn = document.getElementById('share-whatsapp-btn');
    
    if(nameEl) nameEl.textContent = email;
    
    if (shareBtn) {
        shareBtn.onclick = (e) => {
            e.preventDefault();
            const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            const siteUrl = `${window.location.origin}${basePath}`;
            const message = `¡Hola! 🎁 Te acabo de regalar *${productName}* en GhostKey.\n\n¡Nos esforzaremos al máximo para que lo recibas super rápido! 🚀✨\n\nVisita GhostKey para ver tus regalos: ${siteUrl}`;
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
        };
    }
    
    if(modal) {
        modal.classList.add('active');
        document.getElementById('pago-content').style.display = 'none'; // hide payment area
    }
}


function showPremiumSuccess(message, redirectUrl) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(10, 10, 15, 0.85)';
    modal.style.backdropFilter = 'blur(10px)';
    modal.style.zIndex = '999999';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.4s ease';

    modal.innerHTML = `
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); padding: 40px; border-radius: 20px; text-align: center; transform: scale(0.8); transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 10px 40px rgba(34, 197, 94, 0.2);">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; box-shadow: 0 0 20px rgba(34, 197, 94, 0.4);">
                <i class="fa-solid fa-check" style="color: #22c55e; font-size: 2.5rem;"></i>
            </div>
            <h2 style="color: white; margin-bottom: 10px; font-size: 1.5rem; font-weight: 600;">¡Compra Exitosa!</h2>
            <p style="color: rgba(255,255,255,0.7); font-size: 0.95rem; max-width: 250px; margin: 0 auto;">${message}</p>
        </div>
    `;

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modal.firstElementChild.style.transform = 'scale(1)';
    });

    setTimeout(() => {
        window.location.href = redirectUrl;
    }, 2500);
}

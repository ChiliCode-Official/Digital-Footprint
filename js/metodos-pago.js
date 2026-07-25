import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = 'lrodricg30@gmail.com';
let currentUser = null;

const adminContainer = document.getElementById('admin-payment-container');
const paymentList = document.getElementById('payment-methods-list');
const btnSave = document.getElementById('btn-save-payment-method');
const toast = document.getElementById('toast');

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (adminContainer) {
        adminContainer.style.display = (user && user.email === ADMIN_EMAIL) ? 'block' : 'none';
    }
    loadPaymentMethods();
});

export async function loadPaymentMethods() {
    if (!paymentList) return;

    try {
        const snap = await getDocs(collection(db, "payment_methods"));

        if (snap.empty) {
            paymentList.innerHTML = `
                <div class="payment-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <i class="fa-solid fa-credit-card" style="font-size: 3rem; color: var(--accent-primary); margin-bottom: 1rem;"></i>
                    <h3>No hay métodos de pago registrados.</h3>
                    <p style="color: var(--text-muted); margin-top: 5px;">${currentUser && currentUser.email === ADMIN_EMAIL ? 'Agrega uno desde el panel superior.' : 'Contacta al administrador para recargar saldo.'}</p>
                </div>
            `;
            return;
        }

        paymentList.innerHTML = '';
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const docId = docSnap.id;
            const bankName = data.banco || data.bank || 'Transferencia Interbancaria';
            const beneficiario = data.beneficiario || 'GhostKey Oficial';
            const concepto = data.concepto || 'Recarga de Saldo';
            const clabe = data.clabe || '000000000000000000';

            const card = document.createElement('div');
            card.className = 'payment-card';
            card.innerHTML = `
                <div class="payment-card__header">
                    <div class="payment-card__bank">
                        <i class="fa-solid fa-building-columns"></i> ${escapeHtml(bankName)}
                    </div>
                    ${currentUser && currentUser.email === ADMIN_EMAIL ? `
                        <button class="delete-pm-btn" data-id="${docId}" style="background: transparent; border: none; color: var(--danger); cursor: pointer; font-size: 1rem;" title="Eliminar Método">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    ` : ''}
                </div>

                <div class="payment-detail-group">
                    <div class="payment-detail-label">Nombre del Beneficiario</div>
                    <div class="payment-detail-value">${escapeHtml(beneficiario)}</div>
                </div>

                <div class="payment-detail-group">
                    <div class="payment-detail-label">Concepto Recomendado</div>
                    <div class="payment-detail-value">${escapeHtml(concepto)}</div>
                </div>

                <div class="payment-detail-group" style="margin-bottom: 0;">
                    <div class="payment-detail-label">Cuenta CLABE</div>
                    <div class="clabe-box" data-clabe="${escapeHtml(clabe)}">
                        <span class="clabe-number">${escapeHtml(clabe)}</span>
                        <button class="clabe-copy-btn">
                            <i class="fa-solid fa-copy"></i> Copiar
                        </button>
                    </div>
                </div>
            `;

            paymentList.appendChild(card);
        });

        // Add Click to Copy listeners with animation
        document.querySelectorAll('.clabe-box').forEach(box => {
            box.addEventListener('click', () => {
                const clabeText = box.dataset.clabe;
                copyCLABE(clabeText, box);
            });
        });

        // Add Delete listeners for Admin
        document.querySelectorAll('.delete-pm-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm("¿Deseas eliminar este método de pago?")) return;
                const id = btn.dataset.id;
                try {
                    await deleteDoc(doc(db, "payment_methods", id));
                    showToast("Método de pago eliminado");
                    loadPaymentMethods();
                } catch (err) {
                    console.error("Error deleting payment method:", err);
                }
            });
        });

    } catch (err) {
        console.error("Error loading payment methods:", err);
    }
}

function copyCLABE(clabeText, boxElement) {
    navigator.clipboard.writeText(clabeText).then(() => {
        boxElement.classList.add('copied');
        const copyBtn = boxElement.querySelector('.clabe-copy-btn');
        if (copyBtn) {
            copyBtn.classList.add('copied-btn');
            copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copiado`;
        }

        showToast("¡Cuenta CLABE copiada al portapapeles!");

        setTimeout(() => {
            boxElement.classList.remove('copied');
            if (copyBtn) {
                copyBtn.classList.remove('copied-btn');
                copyBtn.innerHTML = `<i class="fa-solid fa-copy"></i> Copiar`;
            }
        }, 2000);
    }).catch(err => {
        console.error("Copy failed:", err);
    });
}

function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

async function savePaymentMethod() {
    const bank = document.getElementById('pm-bank').value.trim();
    const beneficiario = document.getElementById('pm-beneficiario').value.trim();
    const concepto = document.getElementById('pm-concepto').value.trim();
    const clabe = document.getElementById('pm-clabe').value.trim();
    const tipo = document.getElementById('pm-tipo') ? document.getElementById('pm-tipo').value : 'transferencia';

    if (!bank || !beneficiario || !clabe) {
        alert("Banco, Beneficiario y Cuenta CLABE son obligatorios.");
        return;
    }

    try {
        await addDoc(collection(db, "payment_methods"), {
            banco: bank,
            beneficiario: beneficiario,
            concepto: concepto || "Recarga de saldo",
            clabe: clabe,
            tipo: tipo,
            timestamp: serverTimestamp()
        });

        document.getElementById('pm-bank').value = '';
        document.getElementById('pm-beneficiario').value = '';
        document.getElementById('pm-concepto').value = '';
        document.getElementById('pm-clabe').value = '';

        showToast("Método de pago guardado exitosamente");
        loadPaymentMethods();
    } catch (err) {
        console.error("Error saving payment method:", err);
        alert("Error al guardar el método de pago.");
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

if (btnSave) {
    btnSave.addEventListener('click', savePaymentMethod);
}

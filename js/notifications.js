import { db } from './firebase-config.js';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let unsubscribe = null;
let unsubscribeEmail = null;
let currentUserId = null;
let initialLoad = true;

/**
 * Requests permission and initializes the notification listener for the user.
 */
export async function initNotifications(userId, userEmail) {
    currentUserId = userId;
    
    // Request permission if supported
    if ("Notification" in window) {
        if (Notification.permission === "default") {
            try {
                await Notification.requestPermission();
            } catch (e) {
                console.warn("Error requesting notification permission:", e);
            }
        }
    }

    // Stop previous listener if any
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    if (unsubscribeEmail) {
        unsubscribeEmail();
        unsubscribeEmail = null;
    }

    if (!userId) return;

    initialLoad = true;

    const notifRef = collection(db, 'notifications');
    const q1 = query(notifRef, where('userId', '==', userId), where('read', '==', false));
    
    const handleNotification = (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                if (!initialLoad && Notification.permission === "granted") {
                    try {
                        const n = new Notification(data.title || "GhostKey", {
                            body: data.body || "",
                            icon: "https://i.imgur.com/LbMnNUg.png"
                        });
                        n.onclick = () => { window.focus(); n.close(); };
                    } catch (e) {
                        console.warn("Could not show native notification", e);
                    }
                }
                try {
                    updateDoc(doc(db, 'notifications', change.doc.id), { read: true });
                } catch (e) {
                    console.error("Error updating notification status:", e);
                }
            }
        });
        if (initialLoad) initialLoad = false;
    };

    unsubscribe = onSnapshot(q1, handleNotification, (error) => {
        console.warn("Error listening to user ID notifications:", error);
    });

    if (userEmail) {
        const q2 = query(notifRef, where('userEmail', '==', userEmail), where('read', '==', false));
        unsubscribeEmail = onSnapshot(q2, handleNotification, (error) => {
            console.warn("Error listening to user Email notifications:", error);
        });
}

/**
 * Creates a new notification in Firestore.
 */
export async function sendNotification(userId, title, body, type = 'general', userEmail = null) {
    if (!userId && !userEmail) return;
    try {
        await addDoc(collection(db, 'notifications'), {
            userId: userId || null,
            userEmail: userEmail || null,
            title: title,
            body: body,
            type: type,
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (e) {
        console.error("Error sending notification:", e);
    }
}

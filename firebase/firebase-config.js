// PROPERTYMANAGER - Firebase & Firestore Module Configuration
// Uses Firebase SDK v10 via official CDN ES Modules

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Primary Firebase Configuration for shopmanage-c77a1
const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyD_ha2S7AcZHH_zNCruVc9cYpC3hrfDA4Y",
    authDomain: "shopmanage-c77a1.firebaseapp.com",
    projectId: "shopmanage-c77a1",
    storageBucket: "shopmanage-c77a1.firebasestorage.app",
    messagingSenderId: "830639386929",
    appId: "1:830639386929:web:0e142acfe30fc1bbe88010",
    measurementId: "G-MXTM2LKCDT"
};

// Retrieve saved config from localStorage if custom config was set
function getFirebaseConfig() {
    const saved = localStorage.getItem("propertymanager_firebase_config");
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.warn("Invalid saved firebase config, falling back to default.", e);
        }
    }
    return DEFAULT_FIREBASE_CONFIG;
}

let app;
let db;
let analytics;

try {
    const config = getFirebaseConfig();
    if (!getApps().length) {
        app = initializeApp(config);
    } else {
        app = getApp();
    }
    db = getFirestore(app);

    isSupported().then(supported => {
        if (supported && config.measurementId) {
            analytics = getAnalytics(app);
        }
    }).catch(e => console.warn("Analytics not supported in this environment:", e));
} catch (error) {
    console.error("Firebase Initialization Error:", error);
}

// Export raw Firestore & Analytics instances and SDK helpers
export {
    app,
    db,
    analytics,
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    Timestamp
};

// High-level Helper Wrappers for Application Use
export async function fetchCollection(collectionName, constraints = []) {
    try {
        const colRef = collection(db, collectionName);
        const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;
        const snapshot = await getDocs(q);
        const results = [];
        snapshot.forEach(docSnap => {
            results.push({ id: docSnap.id, ...docSnap.data() });
        });
        return results;
    } catch (error) {
        console.error(`Error fetching collection ${collectionName}:`, error);
        throw error;
    }
}

export async function fetchDocument(collectionName, docId) {
    try {
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching document ${collectionName}/${docId}:`, error);
        throw error;
    }
}

export async function createDocument(collectionName, data, customId = null) {
    try {
        const payload = {
            ...data,
            createdAt: data.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        if (customId) {
            const docRef = doc(db, collectionName, customId);
            await setDoc(docRef, payload);
            return customId;
        } else {
            const colRef = collection(db, collectionName);
            const docRef = await addDoc(colRef, payload);
            return docRef.id;
        }
    } catch (error) {
        console.error(`Error creating document in ${collectionName}:`, error);
        throw error;
    }
}

export async function updateDocument(collectionName, docId, data) {
    try {
        const docRef = doc(db, collectionName, docId);
        const payload = {
            ...data,
            updatedAt: serverTimestamp()
        };
        await updateDoc(docRef, payload);
        return true;
    } catch (error) {
        console.error(`Error updating document ${collectionName}/${docId}:`, error);
        throw error;
    }
}

export async function deleteDocument(collectionName, docId) {
    try {
        const docRef = doc(db, collectionName, docId);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error(`Error deleting document ${collectionName}/${docId}:`, error);
        throw error;
    }
}

export function subscribeCollection(collectionName, callback, constraints = []) {
    const colRef = collection(db, collectionName);
    const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;
    return onSnapshot(q, (snapshot) => {
        const results = [];
        snapshot.forEach(docSnap => {
            results.push({ id: docSnap.id, ...docSnap.data() });
        });
        callback(results);
    }, (error) => {
        console.error(`Realtime subscription error for ${collectionName}:`, error);
    });
}

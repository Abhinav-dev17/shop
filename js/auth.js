/* ==========================================================================
   PROPERTYMANAGER - Client Hashing Auth & Setup Module
   ========================================================================== */

import { fetchDocument, fetchCollection, createDocument, updateDocument } from "../firebase/firebase-config.js";
import { setCurrentUser, getCurrentUser, showToast } from "./common.js";

// Generate a random hex salt (16 bytes)
export function generateSalt() {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Hash password + salt using SHA-256 with Web Crypto API
export async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check if app system initialization (meta/init) exists
export async function checkAppInitialization() {
    try {
        const initMeta = await fetchDocument("meta", "init");
        return initMeta && initMeta.initialized === true;
    } catch (e) {
        console.warn("Meta init document read error (might be clean collection):", e);
        return false;
    }
}

// Initialize Super Owner Account
export async function createSuperOwner(username, password) {
    const isInit = await checkAppInitialization();
    if (isInit) {
        throw new Error("System is already initialized.");
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
        throw new Error("Username and password are required.");
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    // Create staff document
    const staffId = await createDocument("staff", {
        username: trimmedUsername,
        passwordHash,
        salt,
        role: "superowner"
    });

    // Create meta/init flag
    await createDocument("meta", {
        initialized: true,
        createdBy: trimmedUsername
    }, "init");

    return { id: staffId, username: trimmedUsername, role: "superowner" };
}

// Login with Username & Password
export async function loginUser(username, password) {
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
        throw new Error("Please enter username and password.");
    }

    const staffList = await fetchCollection("staff");
    const userDoc = staffList.find(u => u.username.toLowerCase() === trimmedUsername.toLowerCase());

    if (!userDoc) {
        throw new Error("Invalid username or password.");
    }

    const computedHash = await hashPassword(password, userDoc.salt);
    if (computedHash !== userDoc.passwordHash) {
        throw new Error("Invalid username or password.");
    }

    const sessionObj = {
        id: userDoc.id,
        username: userDoc.username,
        role: userDoc.role
    };

    setCurrentUser(sessionObj);
    return sessionObj;
}

// Change Current Logged-in User's Password
export async function changePassword(currentPassword, newPassword) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        throw new Error("No active user session.");
    }

    const userDoc = await fetchDocument("staff", currentUser.id);
    if (!userDoc) {
        throw new Error("User record not found in Firestore.");
    }

    const currentHash = await hashPassword(currentPassword, userDoc.salt);
    if (currentHash !== userDoc.passwordHash) {
        throw new Error("Current password is incorrect.");
    }

    const newSalt = generateSalt();
    const newHash = await hashPassword(newPassword, newSalt);

    await updateDocument("staff", currentUser.id, {
        passwordHash: newHash,
        salt: newSalt
    });

    return true;
}

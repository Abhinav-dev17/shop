/* ==========================================================================
   PROPERTYMANAGER - Staff Account & Role Management Module
   ========================================================================== */

import { subscribeCollection, createDocument, deleteDocument } from "../firebase/firebase-config.js";
import { checkPagePermission, renderHeaderAndNavigation, formatDate, openModal, closeModal, showConfirmDialog, showToast, getCurrentUser, ROLES_META, escapeHTML } from "./common.js";
import { generateSalt, hashPassword } from "./auth.js";

let staffList = [];

document.addEventListener("DOMContentLoaded", () => {
    if (!checkPagePermission("staff")) return;
    renderHeaderAndNavigation("staff");

    setupEvents();
    subscribeData();
});

function setupEvents() {
    document.getElementById("add-staff-btn")?.addEventListener("click", () => {
        document.getElementById("staff-form")?.reset();
        openModal("staff-modal");
    });

    document.getElementById("staff-modal-close")?.addEventListener("click", () => {
        closeModal("staff-modal");
    });

    document.getElementById("staff-modal-cancel")?.addEventListener("click", () => {
        closeModal("staff-modal");
    });

    document.getElementById("staff-form")?.addEventListener("submit", handleFormSubmit);
}

function subscribeData() {
    subscribeCollection("staff", (data) => {
        staffList = data;
        renderStaffList();
    });
}

function renderStaffList() {
    const container = document.getElementById("staff-list-container");
    if (!container) return;

    const currentUser = getCurrentUser();

    if (staffList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <div class="empty-state-title">No staff accounts</div>
            </div>
        `;
        return;
    }

    container.innerHTML = staffList.map(u => {
        const isSelf = currentUser && currentUser.id === u.id;
        const roleMeta = ROLES_META[u.role] || { title: u.role, badgeClass: "badge-gray" };

        return `
            <div class="item-card">
                <div class="card-top-row">
                    <span class="card-title" style="font-size:1.1rem;">
                        👤 ${escapeHTML(u.username)} ${isSelf ? '<span style="font-size:0.75rem; color:var(--color-blue);">(You)</span>' : ''}
                    </span>
                    <span class="badge ${roleMeta.badgeClass}">${escapeHTML(roleMeta.title)}</span>
                </div>

                <div class="card-subtitle">
                    📅 Created: ${formatDate(u.createdAt)}
                </div>

                <div class="card-actions">
                    ${!isSelf ? `<button class="action-btn action-btn-delete" data-id="${u.id}" data-name="${escapeHTML(u.username)}">🗑 Delete Staff Account</button>` : '<span style="font-size:0.8rem; color:var(--color-text-muted);">Active Super Owner</span>'}
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll(".action-btn-delete").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const name = e.currentTarget.dataset.name;
            handleDeleteStaff(id, name);
        });
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const username = document.getElementById("staff-username").value.trim();
    const password = document.getElementById("staff-password").value.trim();
    const role = document.getElementById("staff-role-select").value;

    if (!username || !password) {
        showToast("Username and password are required.", "error");
        return;
    }

    if (password.length < 6) {
        showToast("Password must be at least 6 characters.", "warning");
        return;
    }

    // Check duplicate username
    const exists = staffList.some(s => s.username.toLowerCase() === username.toLowerCase());
    if (exists) {
        showToast(`Staff username "${username}" already exists.`, "error");
        return;
    }

    try {
        const salt = generateSalt();
        const passwordHash = await hashPassword(password, salt);

        await createDocument("staff", {
            username,
            passwordHash,
            salt,
            role
        });

        showToast(`Staff account "${username}" created!`, "success");
        closeModal("staff-modal");
        document.getElementById("staff-form").reset();
    } catch (err) {
        showToast("Failed to create staff account.", "error");
    }
}

function handleDeleteStaff(id, username) {
    showConfirmDialog(
        "Remove Staff Account?",
        `Are you sure you want to remove staff account "${username}"? They will be immediately blocked from logging into PropertyManager.`,
        async () => {
            try {
                await deleteDocument("staff", id);
                showToast(`Staff account "${username}" removed.`, "info");
            } catch (err) {
                showToast("Error deleting staff account.", "error");
            }
        }
    );
}

/* ==========================================================================
   PROPERTYMANAGER - Common Shared Utilities & RBAC Controller
   ========================================================================== */

export const SESSION_KEY = "propertymanager_session";

// Centrally defined Role Access Permissions
export const PAGE_ACCESS = {
    dashboard: ["superowner", "owner", "manager", "accountant"],
    buildings: ["superowner", "owner"],
    shops: ["superowner", "owner", "manager"],
    income: ["superowner", "owner", "manager", "accountant"],
    works: ["superowner", "owner", "manager"],
    expenses: ["superowner", "owner", "manager", "accountant"],
    reports: ["superowner", "owner", "accountant", "reportsonly"],
    staff: ["superowner"]
};

// Available User Roles Metadata
export const ROLES_META = {
    superowner: { title: "Super Owner", badgeClass: "badge-blue" },
    owner: { title: "Owner", badgeClass: "badge-green" },
    manager: { title: "Manager", badgeClass: "badge-orange" },
    accountant: { title: "Accountant", badgeClass: "badge-gray" },
    reportsonly: { title: "Reports Viewer", badgeClass: "badge-gray" }
};

// Session Management
export function getCurrentUser() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.error("Error reading session:", e);
        return null;
    }
}

export function setCurrentUser(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "index.html";
}

// Page Permission Guard
export function checkPagePermission(pageName) {
    const user = getCurrentUser();
    if (!user) {
        if (pageName !== "login") {
            window.location.href = "index.html";
        }
        return false;
    }

    const allowedRoles = PAGE_ACCESS[pageName];
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        console.warn(`User role '${user.role}' unauthorized for page '${pageName}'`);
        // Redirect to first permitted page
        const firstPermitted = Object.keys(PAGE_ACCESS).find(p => PAGE_ACCESS[p].includes(user.role)) || "index";
        showToast("Access restricted for your account role.", "warning");
        setTimeout(() => {
            window.location.href = firstPermitted + ".html";
        }, 1200);
        return false;
    }
    return true;
}

// Formatters
export function formatCurrency(amount) {
    const num = Number(amount) || 0;
    return "₹" + num.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0
    });
}

export function formatDate(val) {
    if (!val) return "-";
    let dateObj;
    if (val.toDate && typeof val.toDate === "function") {
        dateObj = val.toDate();
    } else if (val instanceof Date) {
        dateObj = val;
    } else if (typeof val === "string" || typeof val === "number") {
        dateObj = new Date(val);
    } else if (val.seconds) {
        dateObj = new Date(val.seconds * 1000);
    } else {
        return "-";
    }

    if (isNaN(dateObj.getTime())) return "-";

    const day = String(dateObj.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();

    return `${day} ${month} ${year}`;
}

export function formatDateInput(val) {
    if (!val) return "";
    let dateObj;
    if (val.toDate && typeof val.toDate === "function") {
        dateObj = val.toDate();
    } else if (val instanceof Date) {
        dateObj = val;
    } else if (typeof val === "string" || typeof val === "number") {
        dateObj = new Date(val);
    } else if (val.seconds) {
        dateObj = new Date(val.seconds * 1000);
    } else {
        return "";
    }
    if (isNaN(dateObj.getTime())) return "";
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Toast Notifications
export function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "ℹ️";
    if (type === "success") icon = "✓";
    if (type === "error") icon = "⚠️";
    if (type === "warning") icon = "🔔";

    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <span>${icon}</span>
            <span>${escapeHTML(message)}</span>
        </div>
        <button style="background:none; border:none; color:inherit; cursor:pointer; font-size:1.1rem;" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "toastOut 0.3s forwards";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Utility to HTML Escape strings
export function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Modal Helpers
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("active");
    }
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove("active");
    }
}

// Confirmation Dialog Modal
export function showConfirmDialog(title, message, onConfirm) {
    let modal = document.getElementById("confirm-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "confirm-modal";
        modal.className = "modal-backdrop";
        modal.innerHTML = `
            <div class="modal-container" style="max-width: 400px;">
                <div class="modal-header">
                    <h3 class="modal-title" id="confirm-title">Confirm Action</h3>
                    <button class="modal-close-btn" id="confirm-cancel-x">✕</button>
                </div>
                <div class="modal-body" id="confirm-body">
                    Are you sure?
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="confirm-cancel-btn">Cancel</button>
                    <button class="btn btn-danger" id="confirm-ok-btn">Confirm Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById("confirm-title").innerText = title;
    document.getElementById("confirm-body").innerText = message;

    const okBtn = document.getElementById("confirm-ok-btn");
    const cancelBtn = document.getElementById("confirm-cancel-btn");
    const closeX = document.getElementById("confirm-cancel-x");

    const handleClose = () => closeModal("confirm-modal");

    okBtn.onclick = () => {
        handleClose();
        if (typeof onConfirm === "function") onConfirm();
    };

    cancelBtn.onclick = handleClose;
    closeX.onclick = handleClose;

    openModal("confirm-modal");
}

// Render Shell Navigation (Desktop Sidebar & Mobile Nav Bars)
export function renderHeaderAndNavigation(currentPage) {
    const user = getCurrentUser();
    if (!user) return;

    const role = user.role;
    const isAllowed = (page) => PAGE_ACCESS[page] && PAGE_ACCESS[page].includes(role);

    // 1. Desktop Sidebar Injection
    const sidebarEl = document.getElementById("desktop-sidebar");
    if (sidebarEl) {
        const navLinksHtml = [
            isAllowed("dashboard") ? `<a href="dashboard.html" class="sidebar-link ${currentPage === 'dashboard' ? 'active' : ''}"><span class="icon">📊</span> Dashboard</a>` : '',
            isAllowed("buildings") ? `<a href="buildings.html" class="sidebar-link ${currentPage === 'buildings' ? 'active' : ''}"><span class="icon">🏢</span> Buildings</a>` : '',
            isAllowed("shops") ? `<a href="shops.html" class="sidebar-link ${currentPage === 'shops' ? 'active' : ''}"><span class="icon">🏪</span> Shops</a>` : '',
            isAllowed("income") ? `<a href="income.html" class="sidebar-link ${currentPage === 'income' ? 'active' : ''}"><span class="icon">💰</span> Income</a>` : '',
            isAllowed("works") ? `<a href="works.html" class="sidebar-link ${currentPage === 'works' ? 'active' : ''}"><span class="icon">🛠️</span> Works & Maintenance</a>` : '',
            isAllowed("expenses") ? `<a href="expenses.html" class="sidebar-link ${currentPage === 'expenses' ? 'active' : ''}"><span class="icon">📉</span> Expenses</a>` : '',
            isAllowed("reports") ? `<a href="reports.html" class="sidebar-link ${currentPage === 'reports' ? 'active' : ''}"><span class="icon">📈</span> Reports</a>` : '',
        ].join('');

        const adminLinksHtml = [
            isAllowed("staff") ? `<a href="staff.html" class="sidebar-link ${currentPage === 'staff' ? 'active' : ''}"><span class="icon">👥</span> Staff</a>` : '',
            `<a href="#" id="desktop-pwd-link" class="sidebar-link"><span class="icon">🔑</span> Change Password</a>`
        ].join('');

        sidebarEl.innerHTML = `
            <div class="sidebar-header">
                <div class="brand-title">PROPERTYMANAGER</div>
                <div class="brand-subtitle">Commercial Property Management</div>
            </div>
            <div class="sidebar-nav">
                <div class="nav-section-label">Management</div>
                ${navLinksHtml}
                <div class="nav-section-label">Administration</div>
                ${adminLinksHtml}
            </div>
            <div class="sidebar-footer">
                <div class="user-info">
                    <div class="user-name">${escapeHTML(user.username)}</div>
                    <div class="user-role">${ROLES_META[user.role]?.title || user.role}</div>
                </div>
                <button class="btn-logout" id="sidebar-logout-btn" title="Logout">🚪</button>
            </div>
        `;

        document.getElementById("sidebar-logout-btn")?.addEventListener("click", clearSession);
        document.getElementById("desktop-pwd-link")?.addEventListener("click", (e) => {
            e.preventDefault();
            openModal("password-modal");
        });
    }

    // 2. Mobile Top Header Injection
    const mobileHeaderEl = document.getElementById("mobile-header");
    if (mobileHeaderEl) {
        mobileHeaderEl.innerHTML = `
            <button class="mobile-header-btn" id="mobile-header-home">☰</button>
            <div class="mobile-brand">
                <span class="mobile-brand-title">PROPERTYMANAGER</span>
                <span class="mobile-brand-sub">Commercial Property</span>
            </div>
            <button class="mobile-header-btn" id="mobile-header-logout" title="Logout">🚪</button>
        `;
        document.getElementById("mobile-header-home")?.addEventListener("click", () => {
            toggleMoreSheet(true);
        });
        document.getElementById("mobile-header-logout")?.addEventListener("click", clearSession);
    }

    // 3. Mobile Bottom Navigation Injection
    const bottomNavEl = document.getElementById("mobile-bottom-nav");
    if (bottomNavEl) {
        bottomNavEl.innerHTML = `
            ${isAllowed("dashboard") ? `
                <a href="dashboard.html" class="bottom-nav-item ${currentPage === 'dashboard' ? 'active' : ''}">
                    <div class="icon-box">📊</div>
                    <span>Dashboard</span>
                </a>
            ` : ''}
            ${isAllowed("buildings") ? `
                <a href="buildings.html" class="bottom-nav-item ${currentPage === 'buildings' ? 'active' : ''}">
                    <div class="icon-box">🏢</div>
                    <span>Buildings</span>
                </a>
            ` : ''}
            ${isAllowed("shops") ? `
                <a href="shops.html" class="bottom-nav-item ${currentPage === 'shops' ? 'active' : ''}">
                    <div class="icon-box">🏪</div>
                    <span>Shops</span>
                </a>
            ` : ''}
            ${isAllowed("income") ? `
                <a href="income.html" class="bottom-nav-item ${currentPage === 'income' ? 'active' : ''}">
                    <div class="icon-box">💰</div>
                    <span>Income</span>
                </a>
            ` : ''}
            <button class="bottom-nav-item" id="mobile-more-btn">
                <div class="icon-box">⋯</div>
                <span>More</span>
            </button>
        `;

        document.getElementById("mobile-more-btn")?.addEventListener("click", () => toggleMoreSheet(true));
    }

    // 4. Inject Mobile "More" Bottom Sheet Component
    injectMoreSheet(role);
    injectPasswordModal();
}

function injectMoreSheet(role) {
    let sheetBackdrop = document.getElementById("more-sheet-backdrop");
    if (!sheetBackdrop) {
        sheetBackdrop = document.createElement("div");
        sheetBackdrop.id = "more-sheet-backdrop";
        sheetBackdrop.className = "more-sheet-backdrop";
        document.body.appendChild(sheetBackdrop);
    }

    const isAllowed = (page) => PAGE_ACCESS[page] && PAGE_ACCESS[page].includes(role);

    sheetBackdrop.innerHTML = `
        <div class="more-sheet">
            <div class="sheet-handle-bar"></div>
            <div class="sheet-header">
                <div class="sheet-title">Menu & Options</div>
                <button class="modal-close-btn" id="sheet-close-x">✕</button>
            </div>
            <div class="sheet-body">
                ${isAllowed("works") ? `<a href="works.html" class="sheet-menu-item"><span class="icon">🛠️</span> Works & Maintenance</a>` : ''}
                ${isAllowed("expenses") ? `<a href="expenses.html" class="sheet-menu-item"><span class="icon">📉</span> Expenses</a>` : ''}
                ${isAllowed("reports") ? `<a href="reports.html" class="sheet-menu-item"><span class="icon">📈</span> Reports</a>` : ''}
                ${isAllowed("staff") ? `<a href="staff.html" class="sheet-menu-item"><span class="icon">👥</span> Staff Accounts</a>` : ''}
                <a href="#" id="mobile-change-pwd-btn" class="sheet-menu-item"><span class="icon">🔑</span> Change Password</a>
                <a href="#" id="mobile-logout-sheet-btn" class="sheet-menu-item logout-item"><span class="icon">🚪</span> Logout</a>
            </div>
        </div>
    `;

    document.getElementById("sheet-close-x")?.addEventListener("click", () => toggleMoreSheet(false));
    sheetBackdrop.addEventListener("click", (e) => {
        if (e.target === sheetBackdrop) toggleMoreSheet(false);
    });

    document.getElementById("mobile-logout-sheet-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        clearSession();
    });

    document.getElementById("mobile-change-pwd-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        toggleMoreSheet(false);
        openModal("password-modal");
    });
}

export function toggleMoreSheet(open) {
    const sheetBackdrop = document.getElementById("more-sheet-backdrop");
    if (sheetBackdrop) {
        if (open) sheetBackdrop.classList.add("active");
        else sheetBackdrop.classList.remove("active");
    }
}

// Inject Change Password Modal Component (Shared across all pages)
function injectPasswordModal() {
    if (document.getElementById("password-modal")) return;

    const modal = document.createElement("div");
    modal.id = "password-modal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title">Change Password</h3>
                <button class="modal-close-btn" onclick="closeModal('password-modal')">✕</button>
            </div>
            <form id="change-password-form">
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Current Password <span class="required">*</span></label>
                        <input type="password" id="pwd-current" class="form-control" placeholder="Enter current password" required />
                    </div>
                    <div class="form-group">
                        <label class="form-label">New Password <span class="required">*</span></label>
                        <input type="password" id="pwd-new" class="form-control" placeholder="Enter new password" required />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Confirm New Password <span class="required">*</span></label>
                        <input type="password" id="pwd-confirm" class="form-control" placeholder="Re-enter new password" required />
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal('password-modal')">Cancel</button>
                    <button type="submit" class="btn btn-primary">Update Password</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("change-password-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const current = document.getElementById("pwd-current").value.trim();
        const newPwd = document.getElementById("pwd-new").value.trim();
        const confirmPwd = document.getElementById("pwd-confirm").value.trim();

        if (newPwd !== confirmPwd) {
            showToast("New passwords do not match.", "error");
            return;
        }

        if (newPwd.length < 6) {
            showToast("New password must be at least 6 characters.", "warning");
            return;
        }

        try {
            const { changePassword } = await import("./auth.js");
            const success = await changePassword(current, newPwd);
            if (success) {
                showToast("Password updated successfully!", "success");
                closeModal("password-modal");
                document.getElementById("change-password-form").reset();
            }
        } catch (err) {
            showToast(err.message || "Failed to update password.", "error");
        }
    });
}

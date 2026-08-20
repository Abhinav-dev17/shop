/* ==========================================================================
   PROPERTYMANAGER - Shops Controller Module
   ========================================================================== */

import { subscribeCollection, createDocument, updateDocument, deleteDocument } from "../firebase/firebase-config.js";
import { checkPagePermission, renderHeaderAndNavigation, formatCurrency, openModal, closeModal, showConfirmDialog, showToast, escapeHTML } from "./common.js";

let shopsList = [];
let buildingsList = [];

document.addEventListener("DOMContentLoaded", () => {
    if (!checkPagePermission("shops")) return;
    renderHeaderAndNavigation("shops");

    setupEvents();
    subscribeData();
});

function setupEvents() {
    document.getElementById("add-shop-btn")?.addEventListener("click", () => {
        openShopForm();
    });

    document.getElementById("shop-modal-close")?.addEventListener("click", () => {
        closeModal("shop-modal");
    });

    document.getElementById("shop-modal-cancel")?.addEventListener("click", () => {
        closeModal("shop-modal");
    });

    document.getElementById("shop-filter-building")?.addEventListener("change", renderShopsList);
    document.getElementById("shop-filter-status")?.addEventListener("change", renderShopsList);
    document.getElementById("shop-search-input")?.addEventListener("input", renderShopsList);

    document.getElementById("shop-form")?.addEventListener("submit", handleFormSubmit);
}

function subscribeData() {
    subscribeCollection("buildings", (data) => {
        buildingsList = data;
        populateBuildingSelects();
        renderShopsList();
    });

    subscribeCollection("shops", (data) => {
        shopsList = data;
        renderShopsList();
    });
}

function populateBuildingSelects() {
    const filterSelect = document.getElementById("shop-filter-building");
    const formSelect = document.getElementById("shop-building-select");

    const currentFilterVal = filterSelect.value;
    const currentFormVal = formSelect.value;

    filterSelect.innerHTML = `<option value="all">All Buildings</option>` + 
        buildingsList.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');

    formSelect.innerHTML = `<option value="">Select Building...</option>` + 
        buildingsList.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');

    filterSelect.value = currentFilterVal || "all";
    formSelect.value = currentFormVal || "";
}

function renderShopsList() {
    const container = document.getElementById("shops-list-container");
    if (!container) return;

    const buildingFilter = document.getElementById("shop-filter-building")?.value || "all";
    const statusFilter = document.getElementById("shop-filter-status")?.value || "all";
    const searchTerm = document.getElementById("shop-search-input")?.value.toLowerCase().trim() || "";

    const filtered = shopsList.filter(s => {
        const matchBuilding = buildingFilter === "all" || s.buildingId === buildingFilter;
        const matchStatus = statusFilter === "all" || s.status === statusFilter;
        const matchSearch = !searchTerm || (s.shopNumber && s.shopNumber.toLowerCase().includes(searchTerm));
        return matchBuilding && matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏪</div>
                <div class="empty-state-title">No shops found</div>
                <div class="empty-state-text">No commercial shop units match your current filters.</div>
                <button class="btn btn-primary" onclick="document.getElementById('add-shop-btn').click()">+ Add Shop</button>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(s => {
        const bldg = buildingsList.find(b => b.id === s.buildingId);
        const buildingName = bldg ? bldg.name : "Unknown Building";

        let statusBadgeClass = "badge-orange";
        if (s.status === "Occupied") statusBadgeClass = "badge-green";
        if (s.status === "Under Work") statusBadgeClass = "badge-red";

        return `
            <div class="item-card">
                <div class="card-top-row">
                    <div style="font-size:0.85rem; color:var(--color-blue); font-weight:600;">
                        🏢 ${escapeHTML(buildingName)}
                    </div>
                    <span class="badge ${statusBadgeClass}">● ${escapeHTML(s.status || 'Vacant')}</span>
                </div>

                <div class="card-title" style="font-size:1.15rem; font-family:var(--font-mono);">
                    Shop ${escapeHTML(s.shopNumber)}
                </div>

                <div class="card-subtitle">
                    <span>${s.floor ? escapeHTML(s.floor) + ' Floor' : 'Floor N/A'}</span>
                    •
                    <span>${s.areaSqft ? escapeHTML(s.areaSqft) + ' sqft' : 'Area N/A'}</span>
                </div>

                <div class="card-main-info">
                    <div>
                        <span style="font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase;">Standard Rent: </span>
                        <span class="card-amount income-val">${formatCurrency(s.monthlyRent)}</span>
                        <span style="font-size:0.75rem; color:var(--color-text-muted);">/mo</span>
                    </div>
                    ${s.deposit ? `<div style="font-size:0.8rem; color:var(--color-text-muted);">Deposit: <span class="mono">${formatCurrency(s.deposit)}</span></div>` : ''}
                </div>

                ${(s.electricityMeter || s.waterMeter) ? `
                    <div style="font-size:0.75rem; color:var(--color-text-muted); background:var(--color-bg); padding:6px 10px; border-radius:var(--radius-sm); display:flex; gap:12px;">
                        ${s.electricityMeter ? `<span>⚡ Meter: <strong class="mono">${escapeHTML(s.electricityMeter)}</strong></span>` : ''}
                        ${s.waterMeter ? `<span>🚰 Water: <strong class="mono">${escapeHTML(s.waterMeter)}</strong></span>` : ''}
                    </div>
                ` : ''}

                <div class="card-actions">
                    <button class="action-btn action-btn-edit" data-id="${s.id}">✏ Edit</button>
                    <button class="action-btn action-btn-delete" data-id="${s.id}">🗑 Delete</button>
                </div>
            </div>
        `;
    }).join('');

    // Attach button handlers
    container.querySelectorAll(".action-btn-edit").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const shop = shopsList.find(item => item.id === id);
            if (shop) openShopForm(shop);
        });
    });

    container.querySelectorAll(".action-btn-delete").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            handleDeleteShop(id);
        });
    });
}

function openShopForm(shop = null) {
    const modalTitle = document.getElementById("shop-modal-title");
    const idInput = document.getElementById("shop-id");
    const numberInput = document.getElementById("shop-number");
    const buildingSelect = document.getElementById("shop-building-select");
    const floorInput = document.getElementById("shop-floor");
    const areaInput = document.getElementById("shop-area");
    const rentInput = document.getElementById("shop-rent");
    const depositInput = document.getElementById("shop-deposit");
    const elecInput = document.getElementById("shop-elec-meter");
    const waterInput = document.getElementById("shop-water-meter");
    const statusSelect = document.getElementById("shop-status-select");

    if (buildingsList.length === 0) {
        showToast("Please add at least one building before adding shops.", "warning");
        return;
    }

    if (shop) {
        modalTitle.innerText = "Edit Shop";
        idInput.value = shop.id;
        numberInput.value = shop.shopNumber || "";
        buildingSelect.value = shop.buildingId || "";
        floorInput.value = shop.floor || "";
        areaInput.value = shop.areaSqft || "";
        rentInput.value = shop.monthlyRent || 0;
        depositInput.value = shop.deposit || "";
        elecInput.value = shop.electricityMeter || "";
        waterInput.value = shop.waterMeter || "";
        statusSelect.value = shop.status || "Vacant";
    } else {
        modalTitle.innerText = "Add New Shop";
        idInput.value = "";
        document.getElementById("shop-form").reset();
    }

    openModal("shop-modal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("shop-id").value;
    const shopNumber = document.getElementById("shop-number").value.trim();
    const buildingId = document.getElementById("shop-building-select").value;
    const floor = document.getElementById("shop-floor").value.trim();
    const areaSqft = Number(document.getElementById("shop-area").value) || 0;
    const monthlyRent = Number(document.getElementById("shop-rent").value) || 0;
    const deposit = Number(document.getElementById("shop-deposit").value) || 0;
    const electricityMeter = document.getElementById("shop-elec-meter").value.trim();
    const waterMeter = document.getElementById("shop-water-meter").value.trim();
    const status = document.getElementById("shop-status-select").value;

    if (!shopNumber || !buildingId) {
        showToast("Shop number and building selection are required.", "error");
        return;
    }

    try {
        const payload = {
            shopNumber,
            buildingId,
            floor,
            areaSqft,
            monthlyRent,
            deposit,
            electricityMeter,
            waterMeter,
            status
        };

        if (id) {
            await updateDocument("shops", id, payload);
            showToast("Shop updated successfully!", "success");
        } else {
            await createDocument("shops", payload);
            showToast("Shop added successfully!", "success");
        }
        closeModal("shop-modal");
    } catch (err) {
        showToast("Failed to save shop record.", "error");
    }
}

function handleDeleteShop(id) {
    const s = shopsList.find(item => item.id === id);
    if (!s) return;

    if (s.status === "Occupied") {
        showConfirmDialog(
            "Cannot Delete Occupied Shop",
            `Shop "${s.shopNumber}" is currently marked as Occupied. Please change its status to Vacant before deleting.`,
            null
        );
        return;
    }

    showConfirmDialog(
        "Delete Shop?",
        `Are you sure you want to delete Shop "${s.shopNumber}"?`,
        async () => {
            try {
                await deleteDocument("shops", id);
                showToast("Shop record deleted.", "info");
            } catch (err) {
                showToast("Error deleting shop.", "error");
            }
        }
    );
}

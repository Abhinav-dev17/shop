/* ==========================================================================
   PROPERTYMANAGER - Buildings Controller & Cost Recovery Math
   ========================================================================== */

import { subscribeCollection, createDocument, updateDocument, deleteDocument } from "../firebase/firebase-config.js";
import { checkPagePermission, renderHeaderAndNavigation, formatCurrency, openModal, closeModal, showConfirmDialog, showToast, escapeHTML } from "./common.js";

let buildingsList = [];
let shopsList = [];
let incomeList = [];
let expensesList = [];
let worksList = [];

document.addEventListener("DOMContentLoaded", () => {
    if (!checkPagePermission("buildings")) return;
    renderHeaderAndNavigation("buildings");

    setupEvents();
    subscribeData();
});

function setupEvents() {
    document.getElementById("add-building-btn")?.addEventListener("click", () => {
        openBuildingForm();
    });

    document.getElementById("building-modal-close")?.addEventListener("click", () => {
        closeModal("building-modal");
    });

    document.getElementById("building-modal-cancel")?.addEventListener("click", () => {
        closeModal("building-modal");
    });

    document.getElementById("building-search-input")?.addEventListener("input", renderBuildingsList);

    document.getElementById("building-form")?.addEventListener("submit", handleFormSubmit);
}

function subscribeData() {
    subscribeCollection("buildings", (data) => {
        buildingsList = data;
        renderBuildingsList();
    });

    subscribeCollection("shops", (data) => {
        shopsList = data;
        renderBuildingsList();
    });

    subscribeCollection("income", (data) => {
        incomeList = data;
        renderBuildingsList();
    });

    subscribeCollection("expenses", (data) => {
        expensesList = data;
        renderBuildingsList();
    });

    subscribeCollection("works", (data) => {
        worksList = data;
        renderBuildingsList();
    });
}

function renderBuildingsList() {
    const container = document.getElementById("buildings-list-container");
    if (!container) return;

    const searchTerm = document.getElementById("building-search-input")?.value.toLowerCase().trim() || "";

    const filtered = buildingsList.filter(b => 
        (b.name && b.name.toLowerCase().includes(searchTerm)) ||
        (b.address && b.address.toLowerCase().includes(searchTerm))
    );

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏢</div>
                <div class="empty-state-title">No buildings found</div>
                <div class="empty-state-text">Add your first commercial property to start managing shops and tracking recovery.</div>
                <button class="btn btn-primary" onclick="document.getElementById('add-building-btn').click()">+ Add Building</button>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(b => {
        // Calculate Building Financials
        const bIncome = incomeList
            .filter(i => i.buildingId === b.id)
            .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        const bExpenses = expensesList
            .filter(e => e.buildingId === b.id)
            .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        const bWorks = worksList
            .filter(w => w.buildingId === b.id && w.status !== "Cancelled")
            .reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);

        const netIncome = bIncome - bExpenses - bWorks;
        const constructionCost = Number(b.constructionCost) || 0;

        let recoveryPct = 0;
        if (constructionCost > 0) {
            recoveryPct = (netIncome / constructionCost) * 100;
        }

        const formattedPct = recoveryPct.toFixed(2) + "%";
        const visualPct = Math.min(Math.max(recoveryPct, 0), 100);

        const linkedShopsCount = shopsList.filter(s => s.buildingId === b.id).length;

        let profitBadge = "";
        if (recoveryPct >= 100) {
            const profit = netIncome - constructionCost;
            profitBadge = `<div style="color: var(--color-green); font-weight:700; font-size:0.85rem; margin-top:8px;">🎉 Recovered! Profit: ${formatCurrency(profit)}</div>`;
        }

        return `
            <div class="building-card">
                <div class="card-top-row">
                    <div>
                        <div class="building-card-title">${escapeHTML(b.name)}</div>
                        <div class="building-address">📍 ${escapeHTML(b.address || 'No address specified')}</div>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge ${recoveryPct >= 100 ? 'badge-green' : 'badge-blue'}">${formattedPct} Recovery</span>
                        <div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:4px;">${linkedShopsCount} Shops</div>
                    </div>
                </div>

                <div class="building-stats-grid">
                    <div class="building-stat-item">
                        <div class="label">Construction Cost</div>
                        <div class="val">${formatCurrency(constructionCost)}</div>
                    </div>
                    <div class="building-stat-item">
                        <div class="label">Total Income</div>
                        <div class="val text-green">${formatCurrency(bIncome)}</div>
                    </div>
                    <div class="building-stat-item">
                        <div class="label">Net Recovery</div>
                        <div class="val ${netIncome >= 0 ? 'text-green' : 'text-red'}">${formatCurrency(netIncome)}</div>
                    </div>
                </div>

                <div class="progress-container">
                    <div class="progress-header">
                        <span>Recovery Progress</span>
                        <span class="mono">${formattedPct}</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill fill-green" style="width: ${visualPct}%;"></div>
                    </div>
                </div>
                ${profitBadge}

                ${b.notes ? `<div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:10px;">📝 ${escapeHTML(b.notes)}</div>` : ''}

                <div class="card-actions" style="margin-top:14px;">
                    <button class="action-btn action-btn-edit" data-id="${b.id}">✏ Edit</button>
                    <button class="action-btn action-btn-delete" data-id="${b.id}">🗑 Delete</button>
                </div>
            </div>
        `;
    }).join('');

    // Attach button handlers
    container.querySelectorAll(".action-btn-edit").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const b = buildingsList.find(item => item.id === id);
            if (b) openBuildingForm(b);
        });
    });

    container.querySelectorAll(".action-btn-delete").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            handleDeleteBuilding(id);
        });
    });
}

function openBuildingForm(building = null) {
    const modalTitle = document.getElementById("building-modal-title");
    const idInput = document.getElementById("building-id");
    const nameInput = document.getElementById("bldg-name");
    const addrInput = document.getElementById("bldg-address");
    const costInput = document.getElementById("bldg-cost");
    const notesInput = document.getElementById("bldg-notes");

    if (building) {
        modalTitle.innerText = "Edit Building";
        idInput.value = building.id;
        nameInput.value = building.name || "";
        addrInput.value = building.address || "";
        costInput.value = building.constructionCost || 0;
        notesInput.value = building.notes || "";
    } else {
        modalTitle.innerText = "Add New Building";
        idInput.value = "";
        document.getElementById("building-form").reset();
    }

    openModal("building-modal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("building-id").value;
    const name = document.getElementById("bldg-name").value.trim();
    const address = document.getElementById("bldg-address").value.trim();
    const constructionCost = Number(document.getElementById("bldg-cost").value) || 0;
    const notes = document.getElementById("bldg-notes").value.trim();

    if (!name) {
        showToast("Building name is required.", "error");
        return;
    }

    try {
        if (id) {
            await updateDocument("buildings", id, { name, address, constructionCost, notes });
            showToast("Building updated successfully!", "success");
        } else {
            await createDocument("buildings", { name, address, constructionCost, notes });
            showToast("Building added successfully!", "success");
        }
        closeModal("building-modal");
    } catch (err) {
        showToast("Failed to save building. Please try again.", "error");
    }
}

function handleDeleteBuilding(id) {
    const b = buildingsList.find(item => item.id === id);
    if (!b) return;

    // Check if shops are linked to this building
    const linkedShops = shopsList.filter(s => s.buildingId === id);
    if (linkedShops.length > 0) {
        showConfirmDialog(
            "Cannot Delete Building",
            `Cannot delete "${b.name}" while ${linkedShops.length} shop(s) are linked to it. Please reassign or delete the shops first.`,
            null
        );
        return;
    }

    showConfirmDialog(
        "Delete Building?",
        `Are you sure you want to delete "${b.name}"? This action cannot be undone.`,
        async () => {
            try {
                await deleteDocument("buildings", id);
                showToast("Building deleted.", "info");
            } catch (err) {
                showToast("Error deleting building.", "error");
            }
        }
    );
}

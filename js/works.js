/* ==========================================================================
   PROPERTYMANAGER - Works & Maintenance Module Controller
   ========================================================================== */

import { subscribeCollection, createDocument, updateDocument, deleteDocument } from "../firebase/firebase-config.js";
import { checkPagePermission, renderHeaderAndNavigation, formatCurrency, formatDate, formatDateInput, openModal, closeModal, showConfirmDialog, showToast, escapeHTML } from "./common.js";

let worksList = [];
let buildingsList = [];
let shopsList = [];

document.addEventListener("DOMContentLoaded", () => {
    if (!checkPagePermission("works")) return;
    renderHeaderAndNavigation("works");

    setupEvents();
    subscribeData();
});

function setupEvents() {
    document.getElementById("add-work-btn")?.addEventListener("click", () => {
        openWorkForm();
    });

    document.getElementById("work-modal-close")?.addEventListener("click", () => {
        closeModal("work-modal");
    });

    document.getElementById("work-modal-cancel")?.addEventListener("click", () => {
        closeModal("work-modal");
    });

    document.getElementById("work-filter-building")?.addEventListener("change", renderWorksList);
    document.getElementById("work-filter-status")?.addEventListener("change", renderWorksList);
    document.getElementById("work-search-input")?.addEventListener("input", renderWorksList);

    document.getElementById("work-building-select")?.addEventListener("change", (e) => {
        updateFormShopSelect(e.target.value);
    });

    document.getElementById("work-form")?.addEventListener("submit", handleFormSubmit);
}

function subscribeData() {
    subscribeCollection("buildings", (data) => {
        buildingsList = data;
        populateBuildingSelects();
        renderWorksList();
    });

    subscribeCollection("shops", (data) => {
        shopsList = data;
        renderWorksList();
    });

    subscribeCollection("works", (data) => {
        worksList = data;
        renderWorksList();
    });
}

function populateBuildingSelects() {
    const filterSelect = document.getElementById("work-filter-building");
    const formSelect = document.getElementById("work-building-select");

    const curFilter = filterSelect.value;
    const curForm = formSelect.value;

    filterSelect.innerHTML = `<option value="all">All Buildings</option>` +
        buildingsList.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');

    formSelect.innerHTML = `<option value="">Select Building...</option>` +
        buildingsList.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');

    filterSelect.value = curFilter || "all";
    formSelect.value = curForm || "";
}

function updateFormShopSelect(buildingId) {
    const shopSelect = document.getElementById("work-shop-select");
    if (!shopSelect) return;

    if (!buildingId) {
        shopSelect.innerHTML = `<option value="">Entire Building (No specific shop)</option>`;
        return;
    }

    const filteredShops = shopsList.filter(s => s.buildingId === buildingId);
    shopSelect.innerHTML = `<option value="">Entire Building (No specific shop)</option>` +
        filteredShops.map(s => `<option value="${s.id}">Shop ${escapeHTML(s.shopNumber)}</option>`).join('');
}

function generateWorkID() {
    const year = new Date().getFullYear();
    const prefix = `WRK-${year}-`;
    const count = worksList.length + 1;
    const seq = String(count).padStart(4, '0');
    return `${prefix}${seq}`;
}

function renderWorksList() {
    const container = document.getElementById("works-list-container");
    if (!container) return;

    const bldgFilter = document.getElementById("work-filter-building")?.value || "all";
    const statusFilter = document.getElementById("work-filter-status")?.value || "all";
    const searchTerm = document.getElementById("work-search-input")?.value.toLowerCase().trim() || "";

    const filtered = worksList.filter(w => {
        const matchBldg = bldgFilter === "all" || w.buildingId === bldgFilter;
        const matchStatus = statusFilter === "all" || w.status === statusFilter;
        const matchSearch = !searchTerm ||
            (w.workId && w.workId.toLowerCase().includes(searchTerm)) ||
            (w.description && w.description.toLowerCase().includes(searchTerm)) ||
            (w.contractorName && w.contractorName.toLowerCase().includes(searchTerm));
        return matchBldg && matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🛠️</div>
                <div class="empty-state-title">No maintenance records found</div>
                <div class="empty-state-text">No works or repairs match your current filter settings.</div>
                <button class="btn btn-primary" onclick="document.getElementById('add-work-btn').click()">+ Add Work</button>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(w => {
        const bldg = buildingsList.find(b => b.id === w.buildingId);
        const shop = shopsList.find(s => s.id === w.shopId);

        const bldgName = bldg ? bldg.name : "Building";
        const locationText = shop ? `${bldgName} — Shop ${shop.shopNumber}` : bldgName;

        let statusBadgeClass = "badge-gray";
        if (w.status === "Completed") statusBadgeClass = "badge-green";
        if (w.status === "In Progress") statusBadgeClass = "badge-blue";
        if (w.status === "Planned") statusBadgeClass = "badge-orange";
        if (w.status === "Cancelled") statusBadgeClass = "badge-red";

        return `
            <div class="item-card">
                <div class="card-top-row">
                    <span class="card-date mono" style="font-weight:700; color:var(--color-navy);">${escapeHTML(w.workId || 'WRK')}</span>
                    <span class="badge ${statusBadgeClass}">${escapeHTML(w.status || 'Completed')}</span>
                </div>

                <div class="card-subtitle" style="color:var(--color-blue); font-weight:600;">
                    🏢 ${escapeHTML(locationText)}
                </div>

                <div class="card-title" style="font-size:1.05rem;">
                    "${escapeHTML(w.description)}"
                </div>

                <div class="card-main-info">
                    <div>
                        <span style="font-size:0.75rem; color:var(--color-text-muted);">Actual Cost: </span>
                        <span class="card-amount expense-val">${formatCurrency(w.actualCost || w.estimatedCost)}</span>
                    </div>
                    ${w.estimatedCost ? `<div style="font-size:0.8rem; color:var(--color-text-muted);">Est: <span class="mono">${formatCurrency(w.estimatedCost)}</span></div>` : ''}
                </div>

                ${(w.contractorName || w.startDate) ? `
                    <div style="font-size:0.8rem; color:var(--color-text-muted); background:var(--color-bg); padding:8px 12px; border-radius:var(--radius-md); display:flex; flex-direction:column; gap:4px;">
                        ${w.contractorName ? `<div>👤 Contractor: <strong>${escapeHTML(w.contractorName)}</strong> ${w.contractorPhone ? `(${escapeHTML(w.contractorPhone)})` : ''}</div>` : ''}
                        ${w.startDate ? `<div>📅 Start: ${formatDate(w.startDate)} ${w.completionDate ? `• Done: ${formatDate(w.completionDate)}` : ''}</div>` : ''}
                    </div>
                ` : ''}

                <div class="card-actions">
                    <button class="action-btn action-btn-edit" data-id="${w.id}">✏ Edit</button>
                    <button class="action-btn action-btn-delete" data-id="${w.id}">🗑 Delete</button>
                </div>
            </div>
        `;
    }).join('');

    // Attach button handlers
    container.querySelectorAll(".action-btn-edit").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const record = worksList.find(item => item.id === id);
            if (record) openWorkForm(record);
        });
    });

    container.querySelectorAll(".action-btn-delete").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            handleDeleteWork(id);
        });
    });
}

function openWorkForm(record = null) {
    const modalTitle = document.getElementById("work-modal-title");
    const idInput = document.getElementById("work-id");
    const bldgSelect = document.getElementById("work-building-select");
    const shopSelect = document.getElementById("work-shop-select");
    const descInput = document.getElementById("work-description");
    const estInput = document.getElementById("work-est-cost");
    const actInput = document.getElementById("work-act-cost");
    const cNameInput = document.getElementById("work-contractor-name");
    const cPhoneInput = document.getElementById("work-contractor-phone");
    const startDateInput = document.getElementById("work-start-date");
    const endDateInput = document.getElementById("work-end-date");
    const statusSelect = document.getElementById("work-status-select");
    const notesInput = document.getElementById("work-notes");

    if (buildingsList.length === 0) {
        showToast("Please add at least one building before recording works.", "warning");
        return;
    }

    if (record) {
        modalTitle.innerText = `Edit Work (${record.workId})`;
        idInput.value = record.id;
        bldgSelect.value = record.buildingId || "";
        updateFormShopSelect(record.buildingId);
        shopSelect.value = record.shopId || "";
        descInput.value = record.description || "";
        estInput.value = record.estimatedCost || "";
        actInput.value = record.actualCost || "";
        cNameInput.value = record.contractorName || "";
        cPhoneInput.value = record.contractorPhone || "";
        startDateInput.value = formatDateInput(record.startDate);
        endDateInput.value = formatDateInput(record.completionDate);
        statusSelect.value = record.status || "Completed";
        notesInput.value = record.notes || "";
    } else {
        modalTitle.innerText = "Record Maintenance Work";
        idInput.value = "";
        document.getElementById("work-form").reset();
        startDateInput.value = formatDateInput(new Date());
    }

    openModal("work-modal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("work-id").value;
    const buildingId = document.getElementById("work-building-select").value;
    const shopId = document.getElementById("work-shop-select").value || null;
    const description = document.getElementById("work-description").value.trim();
    const estimatedCost = Number(document.getElementById("work-est-cost").value) || 0;
    const actualCost = Number(document.getElementById("work-act-cost").value) || 0;
    const contractorName = document.getElementById("work-contractor-name").value.trim();
    const contractorPhone = document.getElementById("work-contractor-phone").value.trim();
    const startDateVal = document.getElementById("work-start-date").value;
    const endDateVal = document.getElementById("work-end-date").value;
    const status = document.getElementById("work-status-select").value;
    const notes = document.getElementById("work-notes").value.trim();

    if (!buildingId || !description) {
        showToast("Building selection and work description are required.", "error");
        return;
    }

    if (contractorPhone && !/^\d{1,10}$/.test(contractorPhone)) {
        showToast("Contractor phone must contain digits only (up to 10 digits).", "warning");
        return;
    }

    try {
        const payload = {
            buildingId,
            shopId,
            description,
            estimatedCost,
            actualCost,
            contractorName,
            contractorPhone,
            startDate: startDateVal ? new Date(startDateVal + "T12:00:00") : null,
            completionDate: endDateVal ? new Date(endDateVal + "T12:00:00") : null,
            status,
            notes
        };

        if (id) {
            await updateDocument("works", id, payload);
            showToast("Work record updated!", "success");
        } else {
            payload.workId = generateWorkID();
            await createDocument("works", payload);
            showToast("Maintenance work recorded!", "success");
        }
        closeModal("work-modal");
    } catch (err) {
        showToast("Failed to save work record.", "error");
    }
}

function handleDeleteWork(id) {
    showConfirmDialog(
        "Delete Maintenance Record?",
        "Are you sure you want to delete this maintenance work record?",
        async () => {
            try {
                await deleteDocument("works", id);
                showToast("Work record deleted.", "info");
            } catch (err) {
                showToast("Error deleting work record.", "error");
            }
        }
    );
}

/* ==========================================================================
   PROPERTYMANAGER - Income Module Controller (Manual Recording)
   ========================================================================== */

import { subscribeCollection, createDocument, updateDocument, deleteDocument } from "../firebase/firebase-config.js";
import { checkPagePermission, renderHeaderAndNavigation, formatCurrency, formatDate, formatDateInput, openModal, closeModal, showConfirmDialog, showToast, getCurrentUser, escapeHTML } from "./common.js";

let incomeList = [];
let shopsList = [];
let buildingsList = [];

document.addEventListener("DOMContentLoaded", () => {
    if (!checkPagePermission("income")) return;
    renderHeaderAndNavigation("income");

    setupEvents();
    subscribeData();
});

function setupEvents() {
    document.getElementById("add-income-btn")?.addEventListener("click", () => {
        openIncomeForm();
    });

    document.getElementById("income-modal-close")?.addEventListener("click", () => {
        closeModal("income-modal");
    });

    document.getElementById("income-modal-cancel")?.addEventListener("click", () => {
        closeModal("income-modal");
    });

    document.getElementById("income-filter-building")?.addEventListener("change", () => {
        updateShopFilterDropdown();
        renderIncomeList();
    });
    document.getElementById("income-filter-shop")?.addEventListener("change", renderIncomeList);
    document.getElementById("income-filter-period")?.addEventListener("change", renderIncomeList);

    // Shop change handler in modal
    document.getElementById("income-shop-select")?.addEventListener("change", (e) => {
        handleShopSelectChange(e.target.value);
    });

    document.getElementById("income-form")?.addEventListener("submit", handleFormSubmit);
}

function subscribeData() {
    subscribeCollection("buildings", (data) => {
        buildingsList = data;
        populateBuildingFilterDropdown();
        populateFormShopDropdown();
        renderIncomeList();
    });

    subscribeCollection("shops", (data) => {
        shopsList = data;
        updateShopFilterDropdown();
        populateFormShopDropdown();
        renderIncomeList();
    });

    subscribeCollection("income", (data) => {
        incomeList = data;
        renderIncomeList();
    });
}

function populateBuildingFilterDropdown() {
    const bFilter = document.getElementById("income-filter-building");
    if (!bFilter) return;
    const current = bFilter.value;
    bFilter.innerHTML = `<option value="all">All Buildings</option>` +
        buildingsList.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');
    bFilter.value = current || "all";
}

function updateShopFilterDropdown() {
    const sFilter = document.getElementById("income-filter-shop");
    const selectedBldg = document.getElementById("income-filter-building")?.value || "all";
    if (!sFilter) return;

    const filteredShops = selectedBldg === "all" ? shopsList : shopsList.filter(s => s.buildingId === selectedBldg);

    const current = sFilter.value;
    sFilter.innerHTML = `<option value="all">All Shops</option>` +
        filteredShops.map(s => {
            const b = buildingsList.find(bldg => bldg.id === s.buildingId);
            const bName = b ? b.name : "Building";
            return `<option value="${s.id}">${escapeHTML(bName)} — Shop ${escapeHTML(s.shopNumber)}</option>`;
        }).join('');

    sFilter.value = current || "all";
}

function populateFormShopDropdown() {
    const shopSelect = document.getElementById("income-shop-select");
    if (!shopSelect) return;

    const current = shopSelect.value;
    shopSelect.innerHTML = `<option value="">Select Shop...</option>` +
        shopsList.map(s => {
            const b = buildingsList.find(bldg => bldg.id === s.buildingId);
            const bName = b ? b.name : "Building";
            return `<option value="${s.id}">${escapeHTML(bName)} — Shop ${escapeHTML(s.shopNumber)} (Rent: ${formatCurrency(s.monthlyRent)})</option>`;
        }).join('');

    shopSelect.value = current || "";
}

function handleShopSelectChange(shopId) {
    const previewBox = document.getElementById("selected-shop-info");
    const amountInput = document.getElementById("income-amount");

    if (!shopId) {
        if (previewBox) previewBox.style.display = "none";
        return;
    }

    const shop = shopsList.find(s => s.id === shopId);
    if (!shop) return;

    const bldg = buildingsList.find(b => b.id === shop.buildingId);
    const bldgName = bldg ? bldg.name : "Building";

    document.getElementById("info-bldg-name").innerText = bldgName;
    document.getElementById("info-shop-num").innerText = shop.shopNumber;
    document.getElementById("info-standard-rent").innerText = formatCurrency(shop.monthlyRent);

    if (previewBox) previewBox.style.display = "block";

    // Pre-fill amount with standard rent ONLY if creating new entry & amount input is blank
    const isEditMode = Boolean(document.getElementById("income-id").value);
    if (!isEditMode && (!amountInput.value || Number(amountInput.value) === 0)) {
        amountInput.value = shop.monthlyRent || 0;
    }
}

function renderIncomeList() {
    const container = document.getElementById("income-list-container");
    if (!container) return;

    const bldgFilter = document.getElementById("income-filter-building")?.value || "all";
    const shopFilter = document.getElementById("income-filter-shop")?.value || "all";
    const period = document.getElementById("income-filter-period")?.value || "this-month";

    const periodLabelMap = {
        "this-month": "This Month",
        "last-month": "Last Month",
        "this-year": "This Year",
        "all-time": "All Time"
    };
    document.getElementById("income-period-label").innerText = periodLabelMap[period] || "This Month";

    const dateRange = getDateRangeForPeriod(period);

    const filtered = incomeList.filter(item => {
        const matchBldg = bldgFilter === "all" || item.buildingId === bldgFilter;
        const matchShop = shopFilter === "all" || item.shopId === shopFilter;

        let matchDate = true;
        if (dateRange.start && dateRange.end && item.date) {
            let d;
            if (item.date.toDate && typeof item.date.toDate === "function") d = item.date.toDate();
            else if (item.date instanceof Date) d = item.date;
            else d = new Date(item.date);
            matchDate = d >= dateRange.start && d <= dateRange.end;
        }

        return matchBldg && matchShop && matchDate;
    });

    // Sort newest first
    filtered.sort((a, b) => {
        const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const db = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
        return db - da;
    });

    const totalPeriodIncome = filtered.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    document.getElementById("income-total-banner").innerText = formatCurrency(totalPeriodIncome);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💰</div>
                <div class="empty-state-title">No income records found</div>
                <div class="empty-state-text">No payment records match your selected filter criteria.</div>
                <button class="btn btn-primary" onclick="document.getElementById('add-income-btn').click()">+ Add Income</button>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const shop = shopsList.find(s => s.id === item.shopId);
        const bldg = buildingsList.find(b => b.id === (item.buildingId || shop?.buildingId));

        const bldgName = bldg ? bldg.name : "Building";
        const shopNum = shop ? shop.shopNumber : "N/A";

        return `
            <div class="item-card">
                <div class="card-top-row">
                    <span class="card-date">📅 ${formatDate(item.date)}</span>
                    <span class="card-meta-tag">${escapeHTML(item.paymentMethod || 'Cash')}</span>
                </div>

                <div class="card-title">
                    🏢 ${escapeHTML(bldgName)} — <span class="mono">Shop ${escapeHTML(shopNum)}</span>
                </div>

                ${item.description ? `<div style="font-size:0.85rem; color:var(--color-navy); font-weight:500;">${escapeHTML(item.description)}</div>` : ''}

                <div class="card-main-info">
                    <span class="card-amount income-val">${formatCurrency(item.amount)}</span>
                </div>

                ${item.notes ? `<div class="card-description">📝 ${escapeHTML(item.notes)}</div>` : ''}

                <div class="card-actions">
                    <button class="action-btn action-btn-edit" data-id="${item.id}">✏ Edit</button>
                    <button class="action-btn action-btn-delete" data-id="${item.id}">🗑 Delete</button>
                </div>
            </div>
        `;
    }).join('');

    // Attach button handlers
    container.querySelectorAll(".action-btn-edit").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const record = incomeList.find(item => item.id === id);
            if (record) openIncomeForm(record);
        });
    });

    container.querySelectorAll(".action-btn-delete").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            handleDeleteIncome(id);
        });
    });
}

function openIncomeForm(record = null) {
    const modalTitle = document.getElementById("income-modal-title");
    const idInput = document.getElementById("income-id");
    const shopSelect = document.getElementById("income-shop-select");
    const dateInput = document.getElementById("income-date");
    const amountInput = document.getElementById("income-amount");
    const descInput = document.getElementById("income-description");
    const methodSelect = document.getElementById("income-method-select");
    const notesInput = document.getElementById("income-notes");

    if (shopsList.length === 0) {
        showToast("Please add at least one shop before recording income.", "warning");
        return;
    }

    if (record) {
        modalTitle.innerText = "Edit Income Record";
        idInput.value = record.id;
        shopSelect.value = record.shopId || "";
        dateInput.value = formatDateInput(record.date);
        amountInput.value = record.amount || 0;
        descInput.value = record.description || "";
        methodSelect.value = record.paymentMethod || "UPI";
        notesInput.value = record.notes || "";
        handleShopSelectChange(record.shopId);
    } else {
        modalTitle.innerText = "Record Shop Income";
        idInput.value = "";
        document.getElementById("income-form").reset();
        dateInput.value = formatDateInput(new Date());
        document.getElementById("selected-shop-info").style.display = "none";
    }

    openModal("income-modal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("income-id").value;
    const shopId = document.getElementById("income-shop-select").value;
    const dateVal = document.getElementById("income-date").value;
    const amount = Number(document.getElementById("income-amount").value) || 0;
    const description = document.getElementById("income-description").value.trim();
    const paymentMethod = document.getElementById("income-method-select").value;
    const notes = document.getElementById("income-notes").value.trim();

    const user = getCurrentUser();

    if (!shopId || !dateVal) {
        showToast("Shop selection and receipt date are required.", "error");
        return;
    }

    const shop = shopsList.find(s => s.id === shopId);
    if (!shop) {
        showToast("Invalid shop selected.", "error");
        return;
    }

    const buildingId = shop.buildingId;
    const recordDate = new Date(dateVal + "T12:00:00");

    try {
        const payload = {
            shopId,
            buildingId,
            date: recordDate,
            amount,
            description,
            paymentMethod,
            notes,
            createdBy: user?.username || "system"
        };

        if (id) {
            await updateDocument("income", id, payload);
            showToast("Income record updated!", "success");
        } else {
            await createDocument("income", payload);
            showToast("Income recorded successfully!", "success");
        }
        closeModal("income-modal");
    } catch (err) {
        showToast("Failed to save income record.", "error");
    }
}

function handleDeleteIncome(id) {
    showConfirmDialog(
        "Delete Income Record?",
        "Deleting this income record will change your financial totals and cost recovery progress.",
        async () => {
            try {
                await deleteDocument("income", id);
                showToast("Income record deleted.", "info");
            } catch (err) {
                showToast("Error deleting income record.", "error");
            }
        }
    );
}

function getDateRangeForPeriod(period) {
    const now = new Date();
    let start = null;
    let end = null;

    if (period === "this-month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (period === "last-month") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (period === "this-year") {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    return { start, end };
}

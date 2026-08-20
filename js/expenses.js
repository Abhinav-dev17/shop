/* ==========================================================================
   PROPERTYMANAGER - Expenses Module Controller
   ========================================================================== */

import { subscribeCollection, createDocument, updateDocument, deleteDocument } from "../firebase/firebase-config.js";
import { checkPagePermission, renderHeaderAndNavigation, formatCurrency, formatDate, formatDateInput, openModal, closeModal, showConfirmDialog, showToast, escapeHTML } from "./common.js";

let expensesList = [];
let buildingsList = [];

document.addEventListener("DOMContentLoaded", () => {
    if (!checkPagePermission("expenses")) return;
    renderHeaderAndNavigation("expenses");

    setupEvents();
    subscribeData();
});

function setupEvents() {
    document.getElementById("add-expense-btn")?.addEventListener("click", () => {
        openExpenseForm();
    });

    document.getElementById("expense-modal-close")?.addEventListener("click", () => {
        closeModal("expense-modal");
    });

    document.getElementById("expense-modal-cancel")?.addEventListener("click", () => {
        closeModal("expense-modal");
    });

    document.getElementById("expense-filter-building")?.addEventListener("change", renderExpensesList);
    document.getElementById("expense-filter-period")?.addEventListener("change", renderExpensesList);
    document.getElementById("expense-search-input")?.addEventListener("input", renderExpensesList);

    document.getElementById("expense-form")?.addEventListener("submit", handleFormSubmit);
}

function subscribeData() {
    subscribeCollection("buildings", (data) => {
        buildingsList = data;
        populateBuildingSelects();
        renderExpensesList();
    });

    subscribeCollection("expenses", (data) => {
        expensesList = data;
        renderExpensesList();
    });
}

function populateBuildingSelects() {
    const filterSelect = document.getElementById("expense-filter-building");
    const formSelect = document.getElementById("expense-building-select");

    const curFilter = filterSelect.value;
    const curForm = formSelect.value;

    filterSelect.innerHTML = `<option value="all">All Buildings</option>` +
        buildingsList.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');

    formSelect.innerHTML = `<option value="">Select Building...</option>` +
        buildingsList.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');

    filterSelect.value = curFilter || "all";
    formSelect.value = curForm || "";
}

function renderExpensesList() {
    const container = document.getElementById("expenses-list-container");
    if (!container) return;

    const bldgFilter = document.getElementById("expense-filter-building")?.value || "all";
    const period = document.getElementById("expense-filter-period")?.value || "this-month";
    const searchTerm = document.getElementById("expense-search-input")?.value.toLowerCase().trim() || "";

    const periodLabelMap = {
        "this-month": "This Month",
        "last-month": "Last Month",
        "this-year": "This Year",
        "all-time": "All Time"
    };
    document.getElementById("expense-period-label").innerText = periodLabelMap[period] || "This Month";

    const dateRange = getDateRangeForPeriod(period);

    const filtered = expensesList.filter(e => {
        const matchBldg = bldgFilter === "all" || e.buildingId === bldgFilter;
        const matchSearch = !searchTerm ||
            (e.description && e.description.toLowerCase().includes(searchTerm)) ||
            (e.paidTo && e.paidTo.toLowerCase().includes(searchTerm));

        let matchDate = true;
        if (dateRange.start && dateRange.end && e.date) {
            let d;
            if (e.date.toDate && typeof e.date.toDate === "function") d = e.date.toDate();
            else if (e.date instanceof Date) d = e.date;
            else d = new Date(e.date);
            matchDate = d >= dateRange.start && d <= dateRange.end;
        }

        return matchBldg && matchSearch && matchDate;
    });

    // Sort newest first
    filtered.sort((a, b) => {
        const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const db = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
        return db - da;
    });

    const totalExpenseSum = filtered.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    document.getElementById("expense-total-banner").innerText = formatCurrency(totalExpenseSum);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📉</div>
                <div class="empty-state-title">No expenses recorded yet</div>
                <div class="empty-state-text">No operating expenses match your current filters.</div>
                <button class="btn btn-primary" onclick="document.getElementById('add-expense-btn').click()">+ Add Expense</button>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(e => {
        const bldg = buildingsList.find(b => b.id === e.buildingId);
        const bldgName = bldg ? bldg.name : "Building";

        return `
            <div class="item-card">
                <div class="card-top-row">
                    <span class="card-date">📅 ${formatDate(e.date)}</span>
                    <span class="card-meta-tag">${escapeHTML(e.paymentMethod || 'UPI')}</span>
                </div>

                <div class="card-subtitle" style="color:var(--color-blue); font-weight:600;">
                    🏢 ${escapeHTML(bldgName)}
                </div>

                <div class="card-title">
                    ${escapeHTML(e.description)}
                </div>

                <div class="card-main-info">
                    <span class="card-amount expense-val">${formatCurrency(e.amount)}</span>
                    ${e.paidTo ? `<div style="font-size:0.8rem; color:var(--color-text-muted);">Paid to: <strong>${escapeHTML(e.paidTo)}</strong></div>` : ''}
                </div>

                ${e.notes ? `<div class="card-description">📝 ${escapeHTML(e.notes)}</div>` : ''}

                <div class="card-actions">
                    <button class="action-btn action-btn-edit" data-id="${e.id}">✏ Edit</button>
                    <button class="action-btn action-btn-delete" data-id="${e.id}">🗑 Delete</button>
                </div>
            </div>
        `;
    }).join('');

    // Attach button handlers
    container.querySelectorAll(".action-btn-edit").forEach(btn => {
        btn.addEventListener("click", (ev) => {
            const id = ev.currentTarget.dataset.id;
            const record = expensesList.find(item => item.id === id);
            if (record) openExpenseForm(record);
        });
    });

    container.querySelectorAll(".action-btn-delete").forEach(btn => {
        btn.addEventListener("click", (ev) => {
            const id = ev.currentTarget.dataset.id;
            handleDeleteExpense(id);
        });
    });
}

function openExpenseForm(record = null) {
    const modalTitle = document.getElementById("expense-modal-title");
    const idInput = document.getElementById("expense-id");
    const dateInput = document.getElementById("expense-date");
    const bldgSelect = document.getElementById("expense-building-select");
    const descInput = document.getElementById("expense-description");
    const amountInput = document.getElementById("expense-amount");
    const methodSelect = document.getElementById("expense-method-select");
    const paidToInput = document.getElementById("expense-paid-to");
    const notesInput = document.getElementById("expense-notes");

    if (buildingsList.length === 0) {
        showToast("Please add at least one building before recording expenses.", "warning");
        return;
    }

    if (record) {
        modalTitle.innerText = "Edit Operating Expense";
        idInput.value = record.id;
        dateInput.value = formatDateInput(record.date);
        bldgSelect.value = record.buildingId || "";
        descInput.value = record.description || "";
        amountInput.value = record.amount || 0;
        methodSelect.value = record.paymentMethod || "UPI";
        paidToInput.value = record.paidTo || "";
        notesInput.value = record.notes || "";
    } else {
        modalTitle.innerText = "Record Operating Expense";
        idInput.value = "";
        document.getElementById("expense-form").reset();
        dateInput.value = formatDateInput(new Date());
    }

    openModal("expense-modal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("expense-id").value;
    const dateVal = document.getElementById("expense-date").value;
    const buildingId = document.getElementById("expense-building-select").value;
    const description = document.getElementById("expense-description").value.trim();
    const amount = Number(document.getElementById("expense-amount").value) || 0;
    const paymentMethod = document.getElementById("expense-method-select").value;
    const paidTo = document.getElementById("expense-paid-to").value.trim();
    const notes = document.getElementById("expense-notes").value.trim();

    if (!buildingId || !description || !dateVal) {
        showToast("Date, building and description are required.", "error");
        return;
    }

    try {
        const payload = {
            date: new Date(dateVal + "T12:00:00"),
            buildingId,
            description,
            amount,
            paidTo,
            paymentMethod,
            notes
        };

        if (id) {
            await updateDocument("expenses", id, payload);
            showToast("Expense record updated!", "success");
        } else {
            await createDocument("expenses", payload);
            showToast("Expense recorded successfully!", "success");
        }
        closeModal("expense-modal");
    } catch (err) {
        showToast("Failed to save expense record.", "error");
    }
}

function handleDeleteExpense(id) {
    showConfirmDialog(
        "Delete Expense Record?",
        "Are you sure you want to delete this expense record?",
        async () => {
            try {
                await deleteDocument("expenses", id);
                showToast("Expense record deleted.", "info");
            } catch (err) {
                showToast("Error deleting expense record.", "error");
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

/* ==========================================================================
   PROPERTYMANAGER - Reports & Client-Side CSV Export Controller
   ========================================================================== */

import { subscribeCollection } from "../firebase/firebase-config.js";
import { checkPagePermission, renderHeaderAndNavigation, formatCurrency, formatDate, showToast, escapeHTML } from "./common.js";

let incomeList = [];
let expensesList = [];
let shopsList = [];
let buildingsList = [];

let currentFilteredIncome = [];
let currentFilteredExpenses = [];

document.addEventListener("DOMContentLoaded", () => {
    if (!checkPagePermission("reports")) return;
    renderHeaderAndNavigation("reports");

    setupEvents();
    subscribeData();
});

function setupEvents() {
    const periodSelect = document.getElementById("report-period-select");
    periodSelect?.addEventListener("change", (e) => {
        const customBox = document.getElementById("custom-date-container");
        if (e.target.value === "custom") {
            if (customBox) customBox.style.display = "flex";
        } else {
            if (customBox) customBox.style.display = "none";
        }
        updateReportsUI();
    });

    document.getElementById("report-start-date")?.addEventListener("change", updateReportsUI);
    document.getElementById("report-end-date")?.addEventListener("change", updateReportsUI);

    document.getElementById("export-income-csv")?.addEventListener("click", exportIncomeCSV);
    document.getElementById("export-expenses-csv")?.addEventListener("click", exportExpensesCSV);
}

function subscribeData() {
    subscribeCollection("buildings", (data) => {
        buildingsList = data;
        updateReportsUI();
    });

    subscribeCollection("shops", (data) => {
        shopsList = data;
        updateReportsUI();
    });

    subscribeCollection("income", (data) => {
        incomeList = data;
        updateReportsUI();
    });

    subscribeCollection("expenses", (data) => {
        expensesList = data;
        updateReportsUI();
    });
}

function updateReportsUI() {
    const period = document.getElementById("report-period-select")?.value || "this-month";
    const range = getReportDateRange(period);

    // 1. Filter Data
    currentFilteredIncome = filterByDate(incomeList, range);
    currentFilteredExpenses = filterByDate(expensesList, range);

    // Sort newest first
    currentFilteredIncome.sort((a, b) => getRecordDate(b) - getRecordDate(a));
    currentFilteredExpenses.sort((a, b) => getRecordDate(b) - getRecordDate(a));

    // 2. Compute Financial Totals
    const totalIncome = currentFilteredIncome.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalExpenses = currentFilteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const netIncome = totalIncome - totalExpenses;

    document.getElementById("rpt-income").innerText = formatCurrency(totalIncome);
    document.getElementById("rpt-income-count").innerText = `${currentFilteredIncome.length} record(s)`;

    document.getElementById("rpt-expenses").innerText = formatCurrency(totalExpenses);
    document.getElementById("rpt-expense-count").innerText = `${currentFilteredExpenses.length} record(s)`;

    const netEl = document.getElementById("rpt-net");
    netEl.innerText = formatCurrency(netIncome);
    netEl.className = netIncome >= 0 ? "financial-amount income" : "financial-amount expense";

    // 3. Occupancy Math
    const totalShops = shopsList.length;
    const occupiedShops = shopsList.filter(s => s.status === "Occupied").length;
    const occRate = totalShops > 0 ? ((occupiedShops / totalShops) * 100).toFixed(1) + "%" : "0%";

    document.getElementById("rpt-occupancy-rate").innerText = occRate;
    document.getElementById("rpt-occupancy-details").innerText = `${occupiedShops} of ${totalShops} shops occupied`;

    // 4. Render Income Table & Cards
    renderIncomeTableAndCards();

    // 5. Render Expense Table & Cards
    renderExpenseTableAndCards();
}

function renderIncomeTableAndCards() {
    const tbody = document.getElementById("income-table-tbody");
    const mobileCardsContainer = document.getElementById("income-cards-mobile");

    if (currentFilteredIncome.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-text-muted);">No income records in selected period.</td></tr>`;
        if (mobileCardsContainer) mobileCardsContainer.innerHTML = `<div class="empty-state" style="padding:20px;"><div class="empty-state-title">No income records</div></div>`;
        return;
    }

    // Table View (Desktop)
    if (tbody) {
        tbody.innerHTML = currentFilteredIncome.map(item => {
            const shop = shopsList.find(s => s.id === item.shopId);
            const bldg = buildingsList.find(b => b.id === (item.buildingId || shop?.buildingId));
            return `
                <tr>
                    <td class="mono">${formatDate(item.date)}</td>
                    <td>${escapeHTML(bldg ? bldg.name : 'N/A')}</td>
                    <td class="mono">Shop ${escapeHTML(shop ? shop.shopNumber : 'N/A')}</td>
                    <td>${escapeHTML(item.description || '-')}</td>
                    <td><span class="badge badge-gray">${escapeHTML(item.paymentMethod || 'Cash')}</span></td>
                    <td style="text-align: right;" class="table-amount text-green">${formatCurrency(item.amount)}</td>
                </tr>
            `;
        }).join('');
    }

    // Cards View (Mobile)
    if (mobileCardsContainer) {
        mobileCardsContainer.innerHTML = currentFilteredIncome.map(item => {
            const shop = shopsList.find(s => s.id === item.shopId);
            const bldg = buildingsList.find(b => b.id === (item.buildingId || shop?.buildingId));
            return `
                <div class="item-card">
                    <div class="card-top-row">
                        <span class="card-date">📅 ${formatDate(item.date)}</span>
                        <span class="card-meta-tag">${escapeHTML(item.paymentMethod || 'Cash')}</span>
                    </div>
                    <div class="card-title">🏢 ${escapeHTML(bldg ? bldg.name : 'Building')} — <span class="mono">Shop ${escapeHTML(shop ? shop.shopNumber : 'N/A')}</span></div>
                    ${item.description ? `<div style="font-size:0.85rem;">${escapeHTML(item.description)}</div>` : ''}
                    <div class="card-main-info">
                        <span class="card-amount income-val">${formatCurrency(item.amount)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function renderExpenseTableAndCards() {
    const tbody = document.getElementById("expense-table-tbody");
    const mobileCardsContainer = document.getElementById("expense-cards-mobile");

    if (currentFilteredExpenses.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-text-muted);">No expense records in selected period.</td></tr>`;
        if (mobileCardsContainer) mobileCardsContainer.innerHTML = `<div class="empty-state" style="padding:20px;"><div class="empty-state-title">No expenses recorded</div></div>`;
        return;
    }

    // Table View (Desktop)
    if (tbody) {
        tbody.innerHTML = currentFilteredExpenses.map(item => {
            const bldg = buildingsList.find(b => b.id === item.buildingId);
            return `
                <tr>
                    <td class="mono">${formatDate(item.date)}</td>
                    <td>${escapeHTML(bldg ? bldg.name : 'N/A')}</td>
                    <td>${escapeHTML(item.description || '-')}</td>
                    <td>${escapeHTML(item.paidTo || '-')}</td>
                    <td><span class="badge badge-gray">${escapeHTML(item.paymentMethod || 'UPI')}</span></td>
                    <td style="text-align: right;" class="table-amount text-red">${formatCurrency(item.amount)}</td>
                </tr>
            `;
        }).join('');
    }

    // Cards View (Mobile)
    if (mobileCardsContainer) {
        mobileCardsContainer.innerHTML = currentFilteredExpenses.map(item => {
            const bldg = buildingsList.find(b => b.id === item.buildingId);
            return `
                <div class="item-card">
                    <div class="card-top-row">
                        <span class="card-date">📅 ${formatDate(item.date)}</span>
                        <span class="card-meta-tag">${escapeHTML(item.paymentMethod || 'UPI')}</span>
                    </div>
                    <div class="card-title">🏢 ${escapeHTML(bldg ? bldg.name : 'Building')}</div>
                    <div style="font-size:0.85rem;">${escapeHTML(item.description)}</div>
                    <div class="card-main-info">
                        <span class="card-amount expense-val">${formatCurrency(item.amount)}</span>
                        ${item.paidTo ? `<div style="font-size:0.8rem; color:var(--color-text-muted);">Paid to: <strong>${escapeHTML(item.paidTo)}</strong></div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Client-Side CSV Exporters (No External Libraries)
function exportIncomeCSV() {
    if (currentFilteredIncome.length === 0) {
        showToast("No income data available to export.", "warning");
        return;
    }

    const headers = ["Date", "Building", "Shop Number", "Description", "Amount", "Payment Method", "Notes"];
    const rows = [headers];

    currentFilteredIncome.forEach(item => {
        const shop = shopsList.find(s => s.id === item.shopId);
        const bldg = buildingsList.find(b => b.id === (item.buildingId || shop?.buildingId));

        rows.push([
            formatDate(item.date),
            bldg ? bldg.name : "",
            shop ? shop.shopNumber : "",
            item.description || "",
            item.amount || 0,
            item.paymentMethod || "",
            item.notes || ""
        ]);
    });

    downloadCSV(rows, "Income_Statement_Report.csv");
}

function exportExpensesCSV() {
    if (currentFilteredExpenses.length === 0) {
        showToast("No expense data available to export.", "warning");
        return;
    }

    const headers = ["Date", "Building", "Description", "Amount", "Paid To", "Payment Method", "Notes"];
    const rows = [headers];

    currentFilteredExpenses.forEach(item => {
        const bldg = buildingsList.find(b => b.id === item.buildingId);

        rows.push([
            formatDate(item.date),
            bldg ? bldg.name : "",
            item.description || "",
            item.amount || 0,
            item.paidTo || "",
            item.paymentMethod || "",
            item.notes || ""
        ]);
    });

    downloadCSV(rows, "Expenses_Statement_Report.csv");
}

function downloadCSV(rows, filename) {
    const csvContent = rows.map(row => 
        row.map(cell => {
            if (cell === null || cell === undefined) return '""';
            let str = String(cell);
            if (str.includes('"') || str.includes(',') || str.includes('\n')) {
                str = '"' + str.replace(/"/g, '""') + '"';
            } else {
                str = '"' + str + '"';
            }
            return str;
        }).join(",")
    ).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filename} successfully!`, "success");
}

function getReportDateRange(period) {
    const now = new Date();
    let start = null;
    let end = null;

    if (period === "today") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (period === "yesterday") {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
        end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
    } else if (period === "this-week") {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
    } else if (period === "this-month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (period === "this-year") {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else if (period === "custom") {
        const sVal = document.getElementById("report-start-date")?.value;
        const eVal = document.getElementById("report-end-date")?.value;
        if (sVal) start = new Date(sVal + "T00:00:00");
        if (eVal) end = new Date(eVal + "T23:59:59");
    }

    return { start, end };
}

function filterByDate(records, range) {
    if (!range.start || !range.end) return records;
    return records.filter(r => {
        const d = getRecordDate(r);
        return d >= range.start && d <= range.end;
    });
}

function getRecordDate(record) {
    if (!record || !record.date) return new Date(0);
    if (record.date.toDate && typeof record.date.toDate === "function") return record.date.toDate();
    if (record.date instanceof Date) return record.date;
    return new Date(record.date);
}

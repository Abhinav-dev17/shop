/* ==========================================================================
   PROPERTYMANAGER - Dashboard Controller & Financial Math
   ========================================================================== */

import { subscribeCollection } from "../firebase/firebase-config.js";
import { checkPagePermission, renderHeaderAndNavigation, getCurrentUser, formatCurrency, showToast } from "./common.js";

let buildingsData = [];
let shopsData = [];
let incomeData = [];
let expensesData = [];
let worksData = [];

document.addEventListener("DOMContentLoaded", () => {
    if (!checkPagePermission("dashboard")) return;
    renderHeaderAndNavigation("dashboard");

    setupGreeting();
    setupListeners();
});

function setupGreeting() {
    const user = getCurrentUser();
    const greetingEl = document.getElementById("greeting-title");
    const dateEl = document.getElementById("greeting-date");

    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
    if (hour >= 17) timeGreeting = "Good evening";

    if (greetingEl && user) {
        greetingEl.innerText = `${timeGreeting}, ${user.username}`;
    }

    if (dateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.innerText = new Date().toLocaleDateString('en-IN', options);
    }

    document.getElementById("dashboard-period-filter")?.addEventListener("change", updateDashboardUI);
}

function setupListeners() {
    // Realtime subscribers
    subscribeCollection("buildings", (data) => {
        buildingsData = data;
        updateDashboardUI();
    });

    subscribeCollection("shops", (data) => {
        shopsData = data;
        updateDashboardUI();
    });

    subscribeCollection("income", (data) => {
        incomeData = data;
        updateDashboardUI();
    });

    subscribeCollection("expenses", (data) => {
        expensesData = data;
        updateDashboardUI();
    });

    subscribeCollection("works", (data) => {
        worksData = data;
        updateDashboardUI();
    });
}

function updateDashboardUI() {
    // 1. Inventory Math
    const totalBuildings = buildingsData.length;
    const totalShops = shopsData.length;
    const occupiedShops = shopsData.filter(s => s.status === "Occupied").length;
    const vacantShops = shopsData.filter(s => s.status === "Vacant" || s.status === "Under Work").length;

    const occPct = totalShops > 0 ? Math.round((occupiedShops / totalShops) * 100) : 0;
    const vacPct = totalShops > 0 ? Math.round((vacantShops / totalShops) * 100) : 0;

    document.getElementById("stat-total-buildings").innerText = totalBuildings;
    document.getElementById("stat-total-shops").innerText = totalShops;
    document.getElementById("stat-occupied-shops").innerText = occupiedShops;
    document.getElementById("stat-occupied-pct").innerText = `${occPct}% occupancy rate`;
    document.getElementById("stat-vacant-shops").innerText = vacantShops;
    document.getElementById("stat-vacant-pct").innerText = `${vacPct}% vacant rate`;

    // 2. Financial Period Filtering
    const period = document.getElementById("dashboard-period-filter")?.value || "this-month";
    const dateRange = getDateRangeForPeriod(period);

    const periodLabelMap = {
        "this-month": "This Month",
        "last-month": "Last Month",
        "this-year": "This Year",
        "all-time": "All Time"
    };

    const labelText = periodLabelMap[period] || "This Month";
    document.querySelectorAll("#filter-period-label, #filter-period-label-exp, #filter-period-label-net").forEach(el => {
        el.innerText = labelText;
    });

    const filteredIncome = filterRecordsByDate(incomeData, dateRange);
    const filteredExpenses = filterRecordsByDate(expensesData, dateRange);

    const totalIncome = filteredIncome.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const netIncome = totalIncome - totalExpenses;

    document.getElementById("fin-income").innerText = formatCurrency(totalIncome);
    document.getElementById("fin-expenses").innerText = formatCurrency(totalExpenses);

    const netEl = document.getElementById("fin-net");
    netEl.innerText = formatCurrency(netIncome);
    if (netIncome < 0) {
        netEl.className = "financial-amount expense";
    } else {
        netEl.className = "financial-amount income";
    }

    // 3. Construction Cost & Cumulative Recovery Math
    const totalConstructionCost = buildingsData.reduce((sum, b) => sum + (Number(b.constructionCost) || 0), 0);
    document.getElementById("fin-construction").innerText = formatCurrency(totalConstructionCost);

    // Cumulative All Time Net Recovery = SUM(all income) - SUM(all expenses) - SUM(works actualCost != Cancelled)
    const allIncomeTotal = incomeData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const allExpenseTotal = expensesData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const allWorksTotal = worksData
        .filter(w => w.status !== "Cancelled")
        .reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);

    const cumulativeNetRecovery = allIncomeTotal - allExpenseTotal - allWorksTotal;

    let recoveryPct = 0;
    if (totalConstructionCost > 0) {
        recoveryPct = (cumulativeNetRecovery / totalConstructionCost) * 100;
    }

    const formattedPct = recoveryPct.toFixed(2) + "%";
    const visualPct = Math.min(Math.max(recoveryPct, 0), 100);

    document.getElementById("overall-recovery-badge").innerText = `${formattedPct} Recovered`;
    document.getElementById("recovery-pct-val").innerText = formattedPct;
    document.getElementById("recovery-progress-label").innerText = `Net Recovery: ${formatCurrency(cumulativeNetRecovery)} of ${formatCurrency(totalConstructionCost)}`;

    const barFill = document.getElementById("overall-recovery-bar");
    if (barFill) {
        barFill.style.width = `${visualPct}%`;
    }

    const profitMsgEl = document.getElementById("recovery-profit-msg");
    if (recoveryPct >= 100) {
        const profit = cumulativeNetRecovery - totalConstructionCost;
        profitMsgEl.innerHTML = `<span class="text-green">🎉 Fully Recovered! Total Profit: ${formatCurrency(profit)}</span>`;
    } else {
        profitMsgEl.innerHTML = "";
    }
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

function filterRecordsByDate(records, dateRange) {
    if (!dateRange.start || !dateRange.end) return records;

    return records.filter(rec => {
        if (!rec.date) return false;
        let d;
        if (rec.date.toDate && typeof rec.date.toDate === "function") {
            d = rec.date.toDate();
        } else if (rec.date instanceof Date) {
            d = rec.date;
        } else {
            d = new Date(rec.date);
        }
        return d >= dateRange.start && d <= dateRange.end;
    });
}

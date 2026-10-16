
"use strict";

// Basic client-side login: this is not server-side security.
const AUTH_KEY = "cheremoEggDepotPasswordHashV1";
const AUTH_SESSION_KEY = "cheremoEggDepotLoggedInV1";
const AUTH_USERNAME = "japhet";

const loginScreen = document.getElementById("loginScreen");
const protectedApp = document.getElementById("protectedApp");
const authForm = document.getElementById("authForm");
const authPassword = document.getElementById("authPassword");
const authConfirmPassword = document.getElementById("authConfirmPassword");
const confirmPasswordWrap = document.getElementById("confirmPasswordWrap");
const authTitle = document.getElementById("authTitle");
const authDescription = document.getElementById("authDescription");
const authSubmit = document.getElementById("authSubmit");
const authMessage = document.getElementById("authMessage");

function bytesToHex(bytes) {
    return Array.from(
        new Uint8Array(bytes),
        byte => byte.toString(16).padStart(2, "0")
    ).join("");
}

async function hashPassword(password) {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error("Password hashing requires HTTPS or localhost.");
    }

    const encoded = new TextEncoder().encode(password);
    return bytesToHex(await window.crypto.subtle.digest("SHA-256", encoded));
}

function showLogin() {
    loginScreen.hidden = false;
    protectedApp.hidden = true;

    const hasPassword = Boolean(localStorage.getItem(AUTH_KEY));
    confirmPasswordWrap.hidden = hasPassword;

    authTitle.textContent = hasPassword ? "Welcome back" : "Create your password";
    authDescription.textContent = hasPassword
        ? "Sign in to access your business dashboard."
        : "Create a password for this browser.";

    authSubmit.textContent = hasPassword ? "Sign In" : "Set Password & Continue";
    authPassword.autocomplete = hasPassword ? "current-password" : "new-password";
    authMessage.textContent = "";
}

authForm.addEventListener("submit", async event => {
    event.preventDefault();

    const username = document.getElementById("authUsername").value.trim();
    const password = authPassword.value;
    const hasPassword = Boolean(localStorage.getItem(AUTH_KEY));

    if (username !== AUTH_USERNAME) {
        authMessage.textContent = "Incorrect username or password.";
        return;
    }

    if (password.length < 8) {
        authMessage.textContent = "Use at least 8 characters for your password.";
        return;
    }

    try {
        const hash = await hashPassword(password);

        if (!hasPassword) {
            if (password !== authConfirmPassword.value) {
                authMessage.textContent = "The passwords do not match.";
                return;
            }

            localStorage.setItem(AUTH_KEY, hash);
        } else if (hash !== localStorage.getItem(AUTH_KEY)) {
            authMessage.textContent = "Incorrect username or password.";
            authPassword.value = "";
            authPassword.focus();
            return;
        }

        sessionStorage.setItem(AUTH_SESSION_KEY, "yes");

        authPassword.value = "";
        authConfirmPassword.value = "";
        loginScreen.hidden = true;
        protectedApp.hidden = false;
    } catch (error) {
        console.error("Login error:", error);
        authMessage.textContent = error.message || "Could not complete login.";
    }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    authPassword.value = "";
    authConfirmPassword.value = "";
    showLogin();
});

if (
    sessionStorage.getItem(AUTH_SESSION_KEY) === "yes" &&
    localStorage.getItem(AUTH_KEY)
) {
    loginScreen.hidden = true;
    protectedApp.hidden = false;
} else {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    showLogin();
}

// Egg Depot records
const STORAGE_KEY = "cheremoEggDepotFreshV1";
const EGGS_PER_TRAY = 30;

function createInitialState() {
    return {
        stockEggs: 900,
        settings: {
            sellPrice: 480,
            buyPrice: 460,
            targetTrays: 30
        },
        transactions: []
    };
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return createInitialState();

        const parsed = JSON.parse(saved);

        if (
            !parsed ||
            typeof parsed.stockEggs !== "number" ||
            !parsed.settings ||
            !Array.isArray(parsed.transactions)
        ) {
            return createInitialState();
        }

        return {
            stockEggs: Math.max(0, parsed.stockEggs),
            settings: {
                sellPrice: Number(parsed.settings.sellPrice) || 450,
                buyPrice: Number(parsed.settings.buyPrice) || 400,
                targetTrays: Math.max(1, Number(parsed.settings.targetTrays) || 30)
            },
            transactions: parsed.transactions
        };
    } catch (error) {
        console.error("Could not load records:", error);
        return createInitialState();
    }
}

let state = loadState();

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch (error) {
        console.error("Could not save records:", error);
        alert("Could not save records. Export a backup and check browser storage.");
        return false;
    }
}

function money(amount) {
    return "KSh " + Number(amount || 0).toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function getToday() {
    const now = new Date();
    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("-");
}

function addTransaction(type, details, quantity, amount, extra = {}) {
    state.transactions.unshift({
        id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        date: new Date().toISOString(),
        type,
        details,
        quantity,
        amount: Number(amount) || 0,
        ...extra
    });

    state.transactions = state.transactions.slice(0, 1000);
}

function getEggQuantity(quantity, unit) {
    if (unit === "tray") return quantity * 30;
    if (unit === "half") return quantity * 15;
    return quantity;
}

function getUnitLabel(unit) {
    if (unit === "tray") return "full tray/trays";
    if (unit === "half") return "half tray/half trays";
    return "egg/eggs";
}

function getRestockPlan() {
    const targetEggs = state.settings.targetTrays * EGGS_PER_TRAY;
    const shortageEggs = Math.max(0, targetEggs - state.stockEggs);
    const orderTrays = Math.ceil(shortageEggs / EGGS_PER_TRAY);
    const orderEggs = orderTrays * EGGS_PER_TRAY;

    return {
        targetEggs,
        shortageEggs,
        orderTrays,
        orderEggs,
        cost: orderTrays * state.settings.buyPrice
    };
}

function renderDashboard() {
    document.getElementById("stockEggs").textContent =
        state.stockEggs.toLocaleString("en-KE");

    const fullTrays = Math.floor(state.stockEggs / EGGS_PER_TRAY);
    const looseEggs = state.stockEggs % EGGS_PER_TRAY;

    document.getElementById("stockTrays").textContent =
        `${fullTrays} full trays${looseEggs ? ` + ${looseEggs} eggs` : ""}`;

    const today = getToday();
    const todayTransactions = state.transactions.filter(
        transaction => transaction.date && transaction.date.slice(0, 10) === today
    );

    const todaySales = todayTransactions
        .filter(transaction => transaction.type === "Sale")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const todayDeliveries = todayTransactions
        .filter(transaction => transaction.type === "Delivery")
        .reduce((sum, transaction) => sum + Number(transaction.trays || 0), 0);

    const todayExpenses = todayTransactions
        .filter(transaction => transaction.type === "Expense")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    document.getElementById("todaySales").textContent = money(todaySales);
    document.getElementById("todayDeliveries").textContent =
        todayDeliveries.toLocaleString("en-KE");
    document.getElementById("todayExpenses").textContent = money(todayExpenses);

    const allSales = state.transactions
        .filter(transaction => transaction.type === "Sale")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const allPurchases = state.transactions
        .filter(transaction => transaction.type === "Delivery")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const allExpenses = state.transactions
        .filter(transaction => transaction.type === "Expense")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    document.getElementById("allSales").textContent = money(allSales);
    document.getElementById("allPurchases").textContent = money(allPurchases);
    document.getElementById("allExpenses").textContent = money(allExpenses);

    const sales = state.transactions.filter(transaction => transaction.type === "Sale");

    const revenue = sales.reduce(
        (sum, transaction) => sum + Number(transaction.amount || 0), 0
    );

    const costOfGoods = sales.reduce((sum, transaction) => {
        if (transaction.costOfGoodsSold !== undefined &&
            transaction.costOfGoodsSold !== null) {
            return sum + Number(transaction.costOfGoodsSold || 0);
        }

        const eggs = Number(transaction.eggs) || 0;
        return sum + (eggs / EGGS_PER_TRAY) * state.settings.buyPrice;
    }, 0);

    const expenses = state.transactions
        .filter(transaction => transaction.type === "Expense")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const profit = revenue - costOfGoods - expenses;

    document.getElementById("profitRevenue").textContent = money(revenue);
    document.getElementById("profitCost").textContent = money(costOfGoods);
    document.getElementById("profitExpenses").textContent = money(expenses);

    const profitElement = document.getElementById("netProfit");
    profitElement.textContent = money(profit);
    profitElement.style.color = profit < 0 ? "#dc2626" : "#15803d";

    document.getElementById("profitNote").textContent =
        "Estimated profit = sales revenue minus cost of eggs sold minus recorded expenses. " +
        "Older sales use the current buying price as an estimate.";

    renderRestock();
    renderTransactions();
}

function renderRestock() {
    const plan = getRestockPlan();

    document.getElementById("restockCurrent").textContent =
        `${(state.stockEggs / EGGS_PER_TRAY).toFixed(2)} trays`;
    document.getElementById("restockTarget").textContent =
        `${state.settings.targetTrays} trays`;
    document.getElementById("restockOrder").textContent =
        `${plan.orderTrays} trays (${plan.orderEggs} eggs)`;
    document.getElementById("restockCost").textContent = money(plan.cost);

    const message = document.getElementById("restockMessage");
    const button = document.getElementById("restockBtn");

    if (plan.orderTrays === 0) {
        message.textContent = "Your stock is at or above the target. No restock is needed.";
        button.disabled = true;
    } else {
        message.textContent =
            `You need ${plan.orderTrays} full tray(s), containing ${plan.orderEggs} eggs.`;
        button.disabled = false;
    }
}

function renderTransactions() {
    const tbody = document.getElementById("transactionsBody");
    tbody.replaceChildren();

    if (state.transactions.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.textContent = "No transactions recorded yet.";
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    state.transactions.slice(0, 50).forEach(transaction => {
        const row = document.createElement("tr");
        const dateCell = document.createElement("td");
        const date = new Date(transaction.date);

        dateCell.textContent = Number.isNaN(date.getTime())
            ? "Unknown date"
            : date.toLocaleString("en-KE");

        const typeCell = document.createElement("td");
        typeCell.textContent = transaction.type;

        const detailsCell = document.createElement("td");
        detailsCell.textContent = transaction.details;

        const quantityCell = document.createElement("td");
        quantityCell.textContent = transaction.quantity ?? "—";

        const amountCell = document.createElement("td");
        amountCell.textContent = money(transaction.amount);

        row.append(dateCell, typeCell, detailsCell, quantityCell, amountCell);
        tbody.appendChild(row);
    });
}

function fillSettings() {
    document.getElementById("sellPrice").value = state.settings.sellPrice;
    document.getElementById("buyPrice").value = state.settings.buyPrice;
    document.getElementById("targetTrays").value = state.settings.targetTrays;
    document.getElementById("salePrice").value = state.settings.sellPrice;
    document.getElementById("deliveryPrice").value = state.settings.buyPrice;
    updateSalePreview();
}

function updateSalePreview() {
    const quantity = Number(document.getElementById("saleQuantity").value) || 0;
    const unit = document.getElementById("saleUnit").value;
    const price = Number(document.getElementById("salePrice").value) || 0;
    const eggs = getEggQuantity(quantity, unit);

    document.getElementById("salePreview").textContent =
        money((eggs / EGGS_PER_TRAY) * price);
}

document.getElementById("settingsForm").addEventListener("submit", event => {
    event.preventDefault();

    const sellPrice = Number(document.getElementById("sellPrice").value);
    const buyPrice = Number(document.getElementById("buyPrice").value);
    const targetTrays = Number(document.getElementById("targetTrays").value);

    if (!Number.isFinite(sellPrice) || sellPrice <= 0 ||
        !Number.isFinite(buyPrice) || buyPrice < 0 ||
        !Number.isInteger(targetTrays) || targetTrays < 1) {
        alert("Enter valid prices and a target of at least one full tray.");
        return;
    }

    state.settings = { sellPrice, buyPrice, targetTrays };
    if (!saveState()) return;

    document.getElementById("salePrice").value = sellPrice;
    document.getElementById("deliveryPrice").value = buyPrice;
    updateSalePreview();
    renderDashboard();

    alert("Business settings saved.");
});

document.getElementById("saleQuantity").addEventListener("input", updateSalePreview);
document.getElementById("saleUnit").addEventListener("change", updateSalePreview);
document.getElementById("salePrice").addEventListener("input", updateSalePreview);

document.getElementById("saleForm").addEventListener("submit", event => {
    event.preventDefault();

    const quantity = Number(document.getElementById("saleQuantity").value);
    const unit = document.getElementById("saleUnit").value;
    const price = Number(document.getElementById("salePrice").value);
    const customer = document.getElementById("customerName").value.trim();

    if (!Number.isInteger(quantity) || quantity < 1 ||
        !Number.isFinite(price) || price <= 0) {
        alert("Enter a valid quantity and selling price.");
        return;
    }

    const eggs = getEggQuantity(quantity, unit);

    if (eggs > state.stockEggs) {
        alert(`Not enough stock. You currently have ${state.stockEggs} eggs.`);
        return;
    }

    const total = (eggs / EGGS_PER_TRAY) * price;
    const details = `${customer ? customer + " — " : ""}${quantity} ${getUnitLabel(unit)}`;
    const costOfGoodsSold = (eggs / EGGS_PER_TRAY) * state.settings.buyPrice;

    state.stockEggs -= eggs;
    addTransaction("Sale", details, `-${eggs} eggs`, total, {
        eggs,
        unitPrice: price,
        costOfGoodsSold,
        customer
    });

    if (!saveState()) return;

    event.target.reset();
    document.getElementById("salePrice").value = state.settings.sellPrice;
    updateSalePreview();
    renderDashboard();
    alert("Sale recorded successfully.");
});

document.getElementById("deliveryForm").addEventListener("submit", event => {
    event.preventDefault();

    const trays = Number(document.getElementById("deliveryTrays").value);
    const price = Number(document.getElementById("deliveryPrice").value);
    const supplier = document.getElementById("supplierName").value.trim();

    if (!Number.isInteger(trays) || trays < 1 ||
        !Number.isFinite(price) || price < 0) {
        alert("Enter a valid number of trays and buying price.");
        return;
    }

    const eggs = trays * EGGS_PER_TRAY;
    const total = trays * price;
    state.stockEggs += eggs;

    addTransaction("Delivery",
        `${trays} tray(s) received${supplier ? " from " + supplier : ""}`,
        `+${eggs} eggs`,
        total,
        { trays, eggs, unitPrice: price, supplier }
    );

    if (!saveState()) return;

    event.target.reset();
    document.getElementById("deliveryPrice").value = state.settings.buyPrice;
    renderDashboard();
    alert("Delivery recorded and stock updated.");
});

document.getElementById("lossForm").addEventListener("submit", event => {
    event.preventDefault();

    const quantity = Number(document.getElementById("lossQuantity").value);
    const reason = document.getElementById("lossReason").value.trim();

    if (!Number.isInteger(quantity) || quantity < 1 || !reason) {
        alert("Enter the number of lost eggs and the reason.");
        return;
    }

    if (quantity > state.stockEggs) {
        alert("Lost eggs cannot exceed your available stock.");
        return;
    }

    if (!confirm(`Record ${quantity} lost egg(s): ${reason}?`)) return;

    state.stockEggs -= quantity;
    addTransaction("Loss", reason, `-${quantity} eggs`, 0, { eggs: quantity });

    if (!saveState()) return;

    event.target.reset();
    renderDashboard();
    alert("Egg loss recorded.");
});

document.getElementById("expenseForm").addEventListener("submit", event => {
    event.preventDefault();

    const description = document.getElementById("expenseDescription").value.trim();
    const amount = Number(document.getElementById("expenseAmount").value);

    if (!description || !Number.isFinite(amount) || amount <= 0) {
        alert("Enter an expense description and valid amount.");
        return;
    }

    addTransaction("Expense", description, "—", amount);
    if (!saveState()) return;

    event.target.reset();
    renderDashboard();
    alert("Expense recorded.");
});

document.getElementById("restockBtn").addEventListener("click", () => {
    const plan = getRestockPlan();

    if (plan.orderTrays <= 0) {
        alert("No restock is needed.");
        return;
    }

    if (!confirm(
        `Record ${plan.orderTrays} tray(s) (${plan.orderEggs} eggs) for ${money(plan.cost)}?\n\nConfirm only after the delivery arrives.`
    )) return;

    state.stockEggs += plan.orderEggs;

    addTransaction("Delivery",
        `Suggested restock: ${plan.orderTrays} tray(s)`,
        `+${plan.orderEggs} eggs`,
        plan.cost,
        {
            trays: plan.orderTrays,
            eggs: plan.orderEggs,
            unitPrice: state.settings.buyPrice
        }
    );

    if (!saveState()) return;
    renderDashboard();
    alert("Restock recorded.");
});

document.getElementById("clearRecordsBtn").addEventListener("click", () => {
    if (!confirm(
        "This clears the saved business records and resets stock to 900 eggs. Export a backup first. Continue?"
    )) return;

    localStorage.removeItem(STORAGE_KEY);
    state = createInitialState();

    if (!saveState()) return;
    fillSettings();
    renderDashboard();
    alert("Business records reset.");
});

document.getElementById("exportBtn").addEventListener("click", () => {
    const backup = {
        app: "Cheremo Egg Depot",
        version: 1,
        exportedAt: new Date().toISOString(),
        state
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cheremo-egg-depot-backup-${getToday()}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
});

document.getElementById("importFile").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const imported = JSON.parse(await file.text());
        const candidate = imported.state;

        if (!candidate ||
            !Number.isFinite(candidate.stockEggs) ||
            candidate.stockEggs < 0 ||
            !candidate.settings ||
            !Number.isFinite(candidate.settings.sellPrice) ||
            candidate.settings.sellPrice <= 0 ||
            !Number.isFinite(candidate.settings.buyPrice) ||
            candidate.settings.buyPrice < 0 ||
            !Number.isInteger(candidate.settings.targetTrays) ||
            candidate.settings.targetTrays < 1 ||
            !Array.isArray(candidate.transactions)) {
            throw new Error("Invalid backup file.");
        }

        if (!confirm("This will replace current records. Restore this backup?")) return;

        state = {
            stockEggs: candidate.stockEggs,
            settings: {
                sellPrice: candidate.settings.sellPrice,
                buyPrice: candidate.settings.buyPrice,
                targetTrays: candidate.settings.targetTrays
            },
            transactions: candidate.transactions
        };

        if (!saveState()) return;
        fillSettings();
        renderDashboard();
        alert("Backup restored.");
    } catch (error) {
        console.error("Import failed:", error);
        alert("Could not restore this file. Select a valid Cheremo Egg Depot JSON backup.");
    } finally {
        event.target.value = "";
    }
});

document.getElementById("year").textContent = new Date().getFullYear();

fillSettings();
renderDashboard();

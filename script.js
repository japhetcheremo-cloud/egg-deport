
"use strict";

const STORAGE_KEY = "cheremoEggDepotFreshV1";
const EGGS_PER_TRAY = 30;

function createInitialState() {
    return {
        stockEggs: 30 * EGGS_PER_TRAY,
        settings: {
            sellPrice: 480,
            buyPrice: 460,
            targetTrays: 30
        },
        transactions: []
    };
}

let state = loadState();

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
        console.error("Could not load saved records:", error);
        return createInitialState();
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch (error) {
        console.error("Could not save records:", error);
        alert("Your browser could not save the records. Export a backup and check your browser storage.");
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
    if (unit === "tray") return quantity * EGGS_PER_TRAY;
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
    const cost = orderTrays * state.settings.buyPrice;

    return { targetEggs, shortageEggs, orderTrays, orderEggs, cost };
}

function renderDashboard() {
    document.getElementById("stockEggs").textContent =
        state.stockEggs.toLocaleString("en-KE");

    const fullTrays = Math.floor(state.stockEggs / EGGS_PER_TRAY);
    const looseEggs = state.stockEggs % EGGS_PER_TRAY;

    document.getElementById("stockTrays").textContent =
        `${fullTrays} full trays${looseEggs ? ` + ${looseEggs} eggs` : ""}`;

    const today = getToday();
    const todayTransactions = state.transactions.filter(transaction =>
        transaction.date && transaction.date.slice(0, 10) === today
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

    // Profit and loss calculation.
    const saleTransactions = state.transactions.filter(
        transaction => transaction.type === "Sale"
    );

    const totalRevenue = saleTransactions.reduce(
        (sum, transaction) => sum + Number(transaction.amount || 0),
        0
    );

    const totalCostOfGoodsSold = saleTransactions.reduce((sum, transaction) => {
        if (
            transaction.costOfGoodsSold !== undefined &&
            transaction.costOfGoodsSold !== null &&
            Number.isFinite(Number(transaction.costOfGoodsSold))
        ) {
            return sum + Number(transaction.costOfGoodsSold);
        }

        // Older sales did not save their original cost.
        const eggs = Number(transaction.eggs) || 0;
        return sum + (eggs / EGGS_PER_TRAY) * state.settings.buyPrice;
    }, 0);

    const totalOperatingExpenses = state.transactions
        .filter(transaction => transaction.type === "Expense")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const estimatedProfit =
        totalRevenue - totalCostOfGoodsSold - totalOperatingExpenses;

    document.getElementById("profitRevenue").textContent = money(totalRevenue);
    document.getElementById("profitCost").textContent = money(totalCostOfGoodsSold);
    document.getElementById("profitExpenses").textContent = money(totalOperatingExpenses);

    const profitElement = document.getElementById("netProfit");
    profitElement.textContent = money(estimatedProfit);
    profitElement.style.color = estimatedProfit < 0 ? "#dc2626" : "#15803d";

    document.getElementById("profitNote").textContent =
        "Estimated profit = sales revenue minus cost of eggs sold minus recorded expenses. " +
        "Older sales without saved costs use the current buying price. " +
        "Egg losses and other unrecorded costs are not included.";

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
        message.textContent = "Your stock is at or above the target level. No restock is needed.";
        button.disabled = true;
        button.style.opacity = "0.55";
        button.style.cursor = "not-allowed";
    } else {
        message.textContent =
            `You need ${plan.orderTrays} full tray(s), containing ${plan.orderEggs} eggs, to reach or exceed your target.`;
        button.disabled = false;
        button.style.opacity = "1";
        button.style.cursor = "pointer";
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
    const total = (eggs / EGGS_PER_TRAY) * price;

    document.getElementById("salePreview").textContent = money(total);
}

document.getElementById("settingsForm").addEventListener("submit", event => {
    event.preventDefault();

    const sellPrice = Number(document.getElementById("sellPrice").value);
    const buyPrice = Number(document.getElementById("buyPrice").value);
    const targetTrays = Number(document.getElementById("targetTrays").value);

    if (
        !Number.isFinite(sellPrice) || sellPrice <= 0 ||
        !Number.isFinite(buyPrice) || buyPrice < 0 ||
        !Number.isInteger(targetTrays) || targetTrays < 1
    ) {
        alert("Enter valid prices and a target of at least one full tray.");
        return;
    }

    state.settings = { sellPrice, buyPrice, targetTrays };

    if (!saveState()) return;

    document.getElementById("salePrice").value = sellPrice;
    document.getElementById("deliveryPrice").value = buyPrice;

    updateSalePreview();
    renderDashboard();
    alert("Business settings saved successfully.");
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

    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(price) || price <= 0) {
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

    if (
        !Number.isInteger(trays) || trays < 1 ||
        !Number.isFinite(price) || price < 0
    ) {
        alert("Enter a valid number of trays and buying price.");
        return;
    }

    const eggs = trays * EGGS_PER_TRAY;
    const total = trays * price;

    state.stockEggs += eggs;
    addTransaction(
        "Delivery",
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
        alert("Enter a valid number of eggs and a reason.");
        return;
    }

    if (quantity > state.stockEggs) {
        alert("The number of lost eggs cannot exceed your available stock.");
        return;
    }

    if (!confirm(`Record ${quantity} lost egg(s) due to: ${reason}?`)) return;

    state.stockEggs -= quantity;
    addTransaction("Loss", reason, `-${quantity} eggs`, 0, { eggs: quantity });

    if (!saveState()) return;

    event.target.reset();
    renderDashboard();

    alert("Egg loss recorded and stock updated.");
});

document.getElementById("expenseForm").addEventListener("submit", event => {
    event.preventDefault();

    const description = document.getElementById("expenseDescription").value.trim();
    const amount = Number(document.getElementById("expenseAmount").value);

    if (!description || !Number.isFinite(amount) || amount <= 0) {
        alert("Enter an expense description and a valid amount.");
        return;
    }

    addTransaction("Expense", description, "—", amount);

    if (!saveState()) return;

    event.target.reset();
    renderDashboard();

    alert("Expense recorded successfully.");
});

document.getElementById("restockBtn").addEventListener("click", () => {
    const plan = getRestockPlan();

    if (plan.orderTrays <= 0) {
        alert("No restock is needed.");
        return;
    }

    const message =
        `Record a delivery of ${plan.orderTrays} full tray(s) ` +
        `(${plan.orderEggs} eggs) for ${money(plan.cost)}?\n\n` +
        "This will increase your stock. Confirm only after the delivery arrives.";

    if (!confirm(message)) return;

    state.stockEggs += plan.orderEggs;

    addTransaction(
        "Delivery",
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
    alert("Restock delivery recorded successfully.");
});

document.getElementById("clearRecordsBtn").addEventListener("click", () => {
    const confirmed = confirm(
        "WARNING: This will permanently clear the sales, deliveries, " +
        "expenses, losses and settings saved by this version of the website.\n\n" +
        "Your starting stock will return to 30 trays (900 eggs).\n\n" +
        "Export a backup first if you want to keep any records.\n\n" +
        "Do you really want to continue?"
    );

    if (!confirmed) return;

    try {
        localStorage.removeItem(STORAGE_KEY);
        state = createInitialState();

        if (!saveState()) {
            alert("The records were reset in the current session, but the browser could not save the reset. Check browser storage.");
            return;
        }

        fillSettings();
        renderDashboard();

        alert("All records have been cleared. Cheremo Egg Depot has been reset to 30 trays (900 eggs).");
    } catch (error) {
        console.error("Could not clear records:", error);
        alert("Could not clear records. Please check your browser storage settings.");
    }
});

document.getElementById("exportBtn").addEventListener("click", () => {
    const backup = {
        app: "Cheremo Egg Depot",
        version: 1,
        exportedAt: new Date().toISOString(),
        state
    };

    const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
    );

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

        if (
            !candidate ||
            !Number.isFinite(candidate.stockEggs) ||
            candidate.stockEggs < 0 ||
            !candidate.settings ||
            !Number.isFinite(candidate.settings.sellPrice) ||
            candidate.settings.sellPrice <= 0 ||
            !Number.isFinite(candidate.settings.buyPrice) ||
            candidate.settings.buyPrice < 0 ||
            !Number.isInteger(candidate.settings.targetTrays) ||
            candidate.settings.targetTrays < 1 ||
            !Array.isArray(candidate.transactions)
        ) {
            throw new Error("This file does not contain a valid Cheremo Egg Depot backup.");
        }

        const confirmed = confirm(
            "Restoring this backup will replace the records currently in this browser. Continue?"
        );

        if (!confirmed) return;

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
        alert("Backup restored successfully.");
    } catch (error) {
        console.error("Backup import failed:", error);
        alert("The backup could not be restored. Please select a valid Cheremo Egg Depot JSON backup.");
    } finally {
        event.target.value = "";
    }
});

document.getElementById("year").textContent = new Date().getFullYear();

fillSettings();
renderDashboard();

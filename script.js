// Single Source of Truth: In-Memory State Array
let items = [
  {
    id: 1731520000001,
    name: "Frontend UI Engineering & Responsive Layout",
    qty: 1,
    price: 450.00,
    lineTotal: 450.00
  },
  {
    id: 1731520000002,
    name: "Performance Audit & State Management Setup",
    qty: 2,
    price: 125.00,
    lineTotal: 250.00
  }
];

// DOM References
const itemForm = document.getElementById("item-form");
const itemNameInput = document.getElementById("item-name");
const itemQtyInput = document.getElementById("item-qty");
const itemPriceInput = document.getElementById("item-price");
const formError = document.getElementById("form-error");

const tbody = document.getElementById("invoice-tbody");
const emptyState = document.getElementById("empty-state");

const subtotalEl = document.getElementById("subtotal-amount");
const taxEl = document.getElementById("tax-amount");
const grandTotalEl = document.getElementById("grand-total");

const customerNameInput = document.getElementById("customer-name");
const invoiceDateInput = document.getElementById("invoice-date");
const invoiceNumberInput = document.getElementById("invoice-number");

const printBtn = document.getElementById("print-btn");
const clearBtn = document.getElementById("clear-btn");
const themeToggles = document.getElementById("theme-toggles");

/**
 * Initialize default Invoice Metadata (Today's Date & Default Invoice #)
 */
function initMetadata() {
  const today = new Date().toISOString().split("T")[0];
  invoiceDateInput.value = today;
  invoiceNumberInput.value = "INV-2026-104";
  customerNameInput.value = "NextGen Web Labs";
}

/**
 * Step 1 & 2: Validate Form Inputs, Parse Floats, and Push Object to State Array
 */
function addItem(event) {
  event.preventDefault();
  formError.textContent = "";

  const name = itemNameInput.value.trim();
  const qty = parseFloat(itemQtyInput.value);
  const price = parseFloat(itemPriceInput.value);

  // Validation guard against empty strings or non-positive numbers
  if (!name) {
    formError.textContent = "Please enter a valid item description.";
    itemNameInput.focus();
    return;
  }

  if (isNaN(qty) || qty <= 0) {
    formError.textContent = "Quantity must be a positive number greater than 0.";
    itemQtyInput.focus();
    return;
  }

  if (isNaN(price) || price <= 0) {
    formError.textContent = "Unit price must be a positive number greater than 0.";
    itemPriceInput.focus();
    return;
  }

  const newItem = {
    id: Date.now(),
    name: name,
    qty: qty,
    price: price,
    lineTotal: qty * price
  };

  items.push(newItem);

  // Reset input fields and return focus for rapid entry
  itemNameInput.value = "";
  itemQtyInput.value = "";
  itemPriceInput.value = "";
  itemNameInput.focus();

  renderTable();
}

/**
 * Step 3: Pure State-Driven Rendering of <tbody> from items[] Array
 */
function renderTable() {
  tbody.innerHTML = "";

  if (items.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");

    items.forEach((item, index) => {
      const tr = document.createElement("tr");

      // Create Index Cell
      const tdIndex = document.createElement("td");
      tdIndex.className = "col-index";
      tdIndex.textContent = index + 1;

      // Create Description Cell
      const tdName = document.createElement("td");
      tdName.className = "col-desc";
      tdName.textContent = item.name;

      // Create Quantity Cell
      const tdQty = document.createElement("td");
      tdQty.className = "col-qty num-col";
      tdQty.textContent = item.qty;

      // Create Unit Price Cell
      const tdPrice = document.createElement("td");
      tdPrice.className = "col-price num-col";
      tdPrice.textContent = `$${item.price.toFixed(2)}`;

      // Create Line Total Cell
      const tdTotal = document.createElement("td");
      tdTotal.className = "col-total num-col";
      tdTotal.textContent = `$${item.lineTotal.toFixed(2)}`;

      // Create Action Cell with Delete Button and data-id attribute
      const tdAction = document.createElement("td");
      tdAction.className = "col-action delete-col no-print";

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-btn";
      deleteBtn.dataset.id = item.id;
      deleteBtn.textContent = "Delete";

      tdAction.appendChild(deleteBtn);

      tr.append(tdIndex, tdName, tdQty, tdPrice, tdTotal, tdAction);
      tbody.appendChild(tr);
    });
  }

  updateTotals();
}

/**
 * Step 4: Tally Subtotal, 18% GST/Tax, and Grand Total via Array.reduce()
 */
function updateTotals() {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const tax = subtotal * 0.18;
  const grandTotal = subtotal + tax;

  subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  taxEl.textContent = `$${tax.toFixed(2)}`;
  grandTotalEl.textContent = `$${grandTotal.toFixed(2)}`;
}

/**
 * Event Delegation on <tbody> to Remove Specific Rows by ID
 */
tbody.addEventListener("click", (event) => {
  if (event.target.classList.contains("delete-btn")) {
    const id = Number(event.target.dataset.id);
    items = items.filter((item) => item.id !== id);
    renderTable();
  }
});

/**
 * Clear All Items Handler
 */
clearBtn.addEventListener("click", () => {
  items = [];
  formError.textContent = "";
  renderTable();
});

/**
 * Trigger Native Browser Print / Save as PDF
 */
printBtn.addEventListener("click", () => {
  window.print();
});

/**
 * Workspace Theme Switcher (Screen Only)
 */
themeToggles.addEventListener("click", (event) => {
  if (event.target.tagName !== "BUTTON") return;
  document.querySelectorAll("#theme-toggles button").forEach((btn) => {
    btn.classList.remove("active");
  });
  event.target.classList.add("active");
  document.body.setAttribute("data-theme", event.target.dataset.theme);
});

// Wire up Form Submission & Initialize App
itemForm.addEventListener("submit", addItem);
initMetadata();
renderTable();
# QuickBill — Dynamic Invoice & Receipt Maker

A state-driven business invoice and receipt generator built strictly with vanilla **HTML5**, **CSS3**, and **JavaScript**. Designed around a single-source-of-truth state array, functional array reduction, table event delegation, and zero-library A4 PDF export via CSS `@media print`.

## Live Demo & Repository

* **Live Deployment (Vercel):** [https://invoice-psi-hazel.vercel.app/](#)

---

## Core Engineering Architecture

### 1. Single Source of Truth (In-Memory State Array)
Rather than scraping strings from HTML table cells (`td.innerText`) to calculate totals, QuickBill maintains an in-memory JavaScript array of objects:

```javascript
items = [
  { id: Date.now(), name: "Item Description", qty: 1, price: 450.00, lineTotal: 450.00 }
];
```

Every item addition or deletion mutates the `items` array first, and then invokes `renderTable()` to wipe and reconstruct the DOM `<tbody>` purely from state.

### 2. Strict Floating-Point Parsing (`parseFloat`)
HTML `<input>` values are always returned as strings. QuickBill validates all inputs and casts quantity and unit price immediately using `parseFloat()` to prevent string concatenation errors (e.g., ensuring $2 + 50 = 52$ rather than `"250"`) and to block empty or non-positive numbers.

### 3. Event Delegation on `<tbody>`
Instead of attaching separate click listeners to every row's delete button, a single `click` event listener is attached to `#invoice-tbody`. When a `.delete-btn` is clicked:
1. The listener reads the item's unique timestamp ID via `Number(event.target.dataset.id)`.
2. Filters the matching object out of the `items` state array (`items = items.filter(item => item.id !== id)`).
3. Calls `renderTable()` to synchronize the table and recalculate summary totals.

### 4. Zero-Library A4 PDF Export (`@media print`)
Clicking **Print Invoice / Save PDF** triggers the native browser `window.print()` dialog. The `@media print` ruleset in `style.css` automatically:
* Hides the workspace theme bar (`.no-print`), the item entry form (`.input-form`), action buttons (`.action-btns`), and the delete column (`.delete-col`).
* Resets card backgrounds to crisp white (`#fff`) and text to black (`#000`) while stripping box shadows for clean A4 page formatting.

---

## Functional Reduction Math

QuickBill uses `Array.prototype.reduce()` to compute invoice totals dynamically on every state change:

### Line Item Total
$$\text{Line Total}_i = \text{Qty}_i \times \text{Unit Price}_i$$

### Subtotal
$$\text{Subtotal} = \sum_{i=1}^{n} \text{Line Total}_i$$

### Tax ($18\%$ GST) & Grand Total
$$\text{Tax} = \text{Subtotal} \times 0.18$$

$$\text{Grand Total} = \text{Subtotal} + \text{Tax}$$

---

## Key Features

* **Complete Invoice Metadata:** Editable fields for **Customer Name**, **Invoice Date** (auto-initialized to today's date), and **Invoice #**.
* **Real-Time Form Validation:** Inline error feedback preventing blank descriptions or zero/negative quantities and prices.
* **Screen Workspace Themes:** Switch between **Material Light**, **Carbon**, **Nord**, and **Emerald** themes while working on screen without affecting the black-and-white print output.
* **One-Click Print & Clear Controls:** Instant PDF generation via `window.print()` and a **Clear All** reset button.

---

## Strict 3-File Project Structure

```text
quick-bill/
├── index.html   # Semantic HTML5 invoice structure (zero inline styles or scripts)
├── style.css    # Dual-column dashboard layout, zebra tables, and @media print rules
└── script.js    # State array store, form validation, event delegation, and reduce math
```

---

## Local Setup & Vercel Deployment

1. **Run Locally:** Clone this repository and open `index.html` in any web browser. Test PDF export by clicking **Print Invoice / Save PDF** and selecting **Save as PDF** in the print dialog.
2. **Deploy on Vercel:**
   * Push this folder to a public GitHub repository.
   * Import the repository into [vercel.com](https://vercel.com) with **Framework Preset** set to `Other`.
   * Click **Deploy** to generate your live HTTPS production link.

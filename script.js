(() => {
  "use strict";

  /* ========================================================================
     1. CONSTANTS & STORAGE KEYS
     ======================================================================== */
  const STORAGE_KEYS = {
    DRAFT: "qb_v1_draft",
    VAULT: "qb_v1_vault",
    CLIENTS: "qb_v1_clients",
    CATALOG: "qb_v1_catalog",
    SELLER: "qb_v1_seller",
    THEME: "qb_v1_theme"
  };

  const CURRENCY_MAP = {
    INR: { code: "INR", symbol: "₹", locale: "en-IN", major: "Rupees", minor: "Paise" },
    USD: { code: "USD", symbol: "$", locale: "en-US", major: "Dollars", minor: "Cents" },
    EUR: { code: "EUR", symbol: "€", locale: "en-IE", major: "Euros", minor: "Cents" },
    GBP: { code: "GBP", symbol: "£", locale: "en-GB", major: "Pounds", minor: "Pence" }
  };

  const DEFAULT_CATALOG = [
    { id: "cat-1", description: "UI/UX Architecture & Design System", hsn: "998314", unit: "hrs", unitPrice: 2500 },
    { id: "cat-2", description: "Full-Stack Web Application Development", hsn: "998313", unit: "hrs", unitPrice: 3200 },
    { id: "cat-3", description: "Cloud Infrastructure & DevOps Setup", hsn: "998315", unit: "nos", unitPrice: 18500 },
    { id: "cat-4", description: "Monthly Technical Retainer & SLA", hsn: "998316", unit: "mo", unitPrice: 35000 },
    { id: "cat-5", description: "Security Audit & Performance Optimization", hsn: "998319", unit: "nos", unitPrice: 14000 }
  ];

  const DEFAULT_SELLER = {
    name: "QuickBill Digital Studio",
    tagline: "Product Design & Engineering Consultancy",
    gstin: "27AAACQ1234F1Z5",
    state: "Maharashtra (27)",
    phone: "+91 98200 11223",
    email: "billing@quickbill.in",
    address: "402 Maker Chambers V, Nariman Point, Mumbai 400021",
    logoDataUrl: "",
    bankName: "HDFC Bank",
    bankAcc: "50200048192031",
    bankIfsc: "HDFC0000240",
    bankBranch: "Nariman Point, Mumbai",
    sigDataUrl: "",
    signatoryName: "Authorized Signatory"
  };

  /* ========================================================================
     2. PURE-JS ISO/IEC 18004 QR CODE GENERATOR (ZERO EXTERNAL DEPENDENCIES)
     ======================================================================== */
  const QRGenerator = (() => {
    const VERSIONS_L = [
      null,
      { ver: 1, totalData: 19, ecPerBlock: 7, blocks: 1, blockData: 19, align: [] },
      { ver: 2, totalData: 34, ecPerBlock: 10, blocks: 1, blockData: 34, align: [6, 18] },
      { ver: 3, totalData: 55, ecPerBlock: 15, blocks: 1, blockData: 55, align: [6, 22] },
      { ver: 4, totalData: 80, ecPerBlock: 20, blocks: 1, blockData: 80, align: [6, 26] },
      { ver: 5, totalData: 108, ecPerBlock: 26, blocks: 1, blockData: 108, align: [6, 30] },
      { ver: 6, totalData: 136, ecPerBlock: 18, blocks: 2, blockData: 68, align: [6, 34] },
      { ver: 7, totalData: 156, ecPerBlock: 20, blocks: 2, blockData: 78, align: [6, 22, 38] },
      { ver: 8, totalData: 194, ecPerBlock: 24, blocks: 2, blockData: 97, align: [6, 24, 42] },
      { ver: 9, totalData: 232, ecPerBlock: 30, blocks: 2, blockData: 116, align: [6, 26, 46] }
    ];

    function gfMultiply(x, y) {
      let z = 0;
      for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
      }
      return z;
    }

    function rsComputeDivisor(degree) {
      const result = new Uint8Array(degree);
      result[degree - 1] = 1;
      let root = 1;
      for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
          result[j] = gfMultiply(result[j], root);
          if (j + 1 < degree) result[j] ^= result[j + 1];
        }
        root = gfMultiply(root, 0x02);
      }
      return result;
    }

    function rsComputeRemainder(data, divisor) {
      const result = new Uint8Array(divisor.length);
      for (let i = 0; i < data.length; i++) {
        const factor = data[i] ^ result[0];
        result.copyWithin(0, 1);
        result[result.length - 1] = 0;
        for (let j = 0; j < divisor.length; j++) {
          result[j] ^= gfMultiply(divisor[j], factor);
        }
      }
      return result;
    }

    function encodeBytePayload(text) {
      const bytes = new TextEncoder().encode(text);
      let spec = null;
      for (let v = 1; v < VERSIONS_L.length; v++) {
        if (bytes.length <= VERSIONS_L[v].totalData - 2) {
          spec = VERSIONS_L[v];
          break;
        }
      }
      if (!spec) return null;

      const bitStream = [];
      const pushBits = (val, len) => {
        for (let i = len - 1; i >= 0; i--) bitStream.push((val >>> i) & 1);
      };

      pushBits(0b0100, 4); // Byte mode
      pushBits(bytes.length, 8); // Character count (V1-V9)
      for (let i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);

      const totalBits = spec.totalData * 8;
      pushBits(0, Math.min(4, totalBits - bitStream.length));
      while (bitStream.length % 8 !== 0) bitStream.push(0);

      let padIdx = 0;
      const pads = [0xec, 0x11];
      while (bitStream.length < totalBits) {
        pushBits(pads[padIdx % 2], 8);
        padIdx++;
      }

      const dataCodewords = new Uint8Array(spec.totalData);
      for (let i = 0; i < spec.totalData; i++) {
        let byteVal = 0;
        for (let b = 0; b < 8; b++) byteVal = (byteVal << 1) | bitStream[i * 8 + b];
        dataCodewords[i] = byteVal;
      }

      const divisor = rsComputeDivisor(spec.ecPerBlock);
      const dataBlocks = [];
      const ecBlocks = [];
      for (let b = 0; b < spec.blocks; b++) {
        const slice = dataCodewords.subarray(b * spec.blockData, (b + 1) * spec.blockData);
        dataBlocks.push(slice);
        ecBlocks.push(rsComputeRemainder(slice, divisor));
      }

      const allCodewords = [];
      for (let i = 0; i < spec.blockData; i++) {
        for (let b = 0; b < spec.blocks; b++) allCodewords.push(dataBlocks[b][i]);
      }
      for (let i = 0; i < spec.ecPerBlock; i++) {
        for (let b = 0; b < spec.blocks; b++) allCodewords.push(ecBlocks[b][i]);
      }

      return { spec, allCodewords };
    }

    function computePenalty(modules, size) {
      let penalty = 0;

      for (let axis = 0; axis < 2; axis++) {
        for (let a = 0; a < size; a++) {
          let runColor = -1;
          let runLen = 0;
          const seq = [];
          for (let b = 0; b < size; b++) {
            const val = axis === 0 ? modules[a][b] : modules[b][a];
            seq.push(val);
            if (val === runColor) {
              runLen++;
              if (runLen === 5) penalty += 3;
              else if (runLen > 5) penalty += 1;
            } else {
              runColor = val;
              runLen = 1;
            }
          }
          for (let i = 0; i <= size - 11; i++) {
            const p1 =
              seq[i] === 1 && seq[i + 1] === 0 && seq[i + 2] === 1 && seq[i + 3] === 1 &&
              seq[i + 4] === 1 && seq[i + 5] === 0 && seq[i + 6] === 1 &&
              seq[i + 7] === 0 && seq[i + 8] === 0 && seq[i + 9] === 0 && seq[i + 10] === 0;
            const p2 =
              seq[i] === 0 && seq[i + 1] === 0 && seq[i + 2] === 0 && seq[i + 3] === 0 &&
              seq[i + 4] === 1 && seq[i + 5] === 0 && seq[i + 6] === 1 &&
              seq[i + 7] === 1 && seq[i + 8] === 1 && seq[i + 9] === 0 && seq[i + 10] === 1;
            if (p1 || p2) penalty += 40;
          }
        }
      }

      for (let y = 0; y < size - 1; y++) {
        for (let x = 0; x < size - 1; x++) {
          const c = modules[y][x];
          if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) {
            penalty += 3;
          }
        }
      }

      let dark = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) dark += modules[y][x];
      }
      const total = size * size;
      const k = Math.floor(Math.abs(dark * 20 - total * 10) / total);
      penalty += k * 10;

      return penalty;
    }

    function generateMatrix(text) {
      const encoded = encodeBytePayload(text);
      if (!encoded) return null;

      const { spec, allCodewords } = encoded;
      const size = spec.ver * 4 + 17;
      const modules = Array.from({ length: size }, () => new Uint8Array(size));
      const isFunction = Array.from({ length: size }, () => new Uint8Array(size));

      const setFn = (y, x, val) => {
        if (y >= 0 && y < size && x >= 0 && x < size) {
          modules[y][x] = val ? 1 : 0;
          isFunction[y][x] = 1;
        }
      };

      const drawFinder = (r0, c0) => {
        for (let dy = -1; dy <= 7; dy++) {
          for (let dx = -1; dx <= 7; dx++) {
            const dist = Math.max(Math.abs(dy - 3), Math.abs(dx - 3));
            const val = (dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6 && (dist === 3 || dist <= 1)) ? 1 : 0;
            setFn(r0 + dy, c0 + dx, val);
          }
        }
      };

      const drawFormatBits = (mask) => {
        const data = (0b01 << 3) | mask;
        let rem = data << 10;
        for (let i = 14; i >= 10; i--) {
          if ((rem >>> i) & 1) rem ^= (0x537 << (i - 10));
        }
        const bits = ((data << 10) | rem) ^ 0x5412;

        for (let i = 0; i <= 5; i++) setFn(i, 8, (bits >>> i) & 1);
        setFn(7, 8, (bits >>> 6) & 1);
        setFn(8, 8, (bits >>> 7) & 1);
        setFn(8, 7, (bits >>> 8) & 1);
        for (let i = 9; i < 15; i++) setFn(8, 14 - i, (bits >>> i) & 1);

        for (let i = 0; i < 8; i++) setFn(8, size - 1 - i, (bits >>> i) & 1);
        for (let i = 8; i < 15; i++) setFn(size - 15 + i, 8, (bits >>> i) & 1);
        setFn(size - 8, 8, 1);
      };

      const drawVersionBits = () => {
        if (spec.ver < 7) return;
        let rem = spec.ver << 12;
        for (let i = 17; i >= 12; i--) {
          if ((rem >>> i) & 1) rem ^= (0x1f25 << (i - 12));
        }
        const vbits = (spec.ver << 12) | rem;
        for (let i = 0; i < 18; i++) {
          const bit = (vbits >>> i) & 1;
          const a = size - 11 + (i % 3);
          const b = Math.floor(i / 3);
          setFn(b, a, bit);
          setFn(a, b, bit);
        }
      };

      for (let i = 8; i < size - 8; i++) {
        const bit = i % 2 === 0 ? 1 : 0;
        setFn(6, i, bit);
        setFn(i, 6, bit);
      }

      drawFinder(0, 0);
      drawFinder(0, size - 7);
      drawFinder(size - 7, 0);

      for (const cy of spec.align) {
        for (const cx of spec.align) {
          if ((cx <= 8 && cy <= 8) || (cx >= size - 9 && cy <= 8) || (cx <= 8 && cy >= size - 9)) continue;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const dist = Math.max(Math.abs(dy), Math.abs(dx));
              setFn(cy + dy, cx + dx, dist !== 1 ? 1 : 0);
            }
          }
        }
      }

      drawFormatBits(0);
      drawVersionBits();

      let bitIdx = 0;
      const totalDataBits = allCodewords.length * 8;
      let upward = true;
      for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right--;
        for (let vert = 0; vert < size; vert++) {
          const y = upward ? size - 1 - vert : vert;
          for (let j = 0; j < 2; j++) {
            const x = right - j;
            if (!isFunction[y][x]) {
              let bit = 0;
              if (bitIdx < totalDataBits) {
                bit = (allCodewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1;
                bitIdx++;
              }
              modules[y][x] = bit;
            }
          }
        }
        upward = !upward;
      }

      const maskCondition = (m, y, x) => {
        switch (m) {
          case 0: return (x + y) % 2 === 0;
          case 1: return y % 2 === 0;
          case 2: return x % 3 === 0;
          case 3: return (x + y) % 3 === 0;
          case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
          case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
          case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
          default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
      };

      let bestMask = 0;
      let minPenalty = Infinity;
      for (let m = 0; m < 8; m++) {
        const clone = modules.map((row) => new Uint8Array(row));
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            if (!isFunction[y][x] && maskCondition(m, y, x)) clone[y][x] ^= 1;
          }
        }
        const fData = (0b01 << 3) | m;
        let fRem = fData << 10;
        for (let i = 14; i >= 10; i--) if ((fRem >>> i) & 1) fRem ^= (0x537 << (i - 10));
        const fBits = ((fData << 10) | fRem) ^ 0x5412;
        for (let i = 0; i <= 5; i++) clone[i][8] = (fBits >>> i) & 1;
        clone[7][8] = (fBits >>> 6) & 1;
        clone[8][8] = (fBits >>> 7) & 1;
        clone[8][7] = (fBits >>> 8) & 1;
        for (let i = 9; i < 15; i++) clone[8][14 - i] = (fBits >>> i) & 1;
        for (let i = 0; i < 8; i++) clone[8][size - 1 - i] = (fBits >>> i) & 1;
        for (let i = 8; i < 15; i++) clone[size - 15 + i][8] = (fBits >>> i) & 1;
        clone[size - 8][8] = 1;

        const p = computePenalty(clone, size);
        if (p < minPenalty) {
          minPenalty = p;
          bestMask = m;
        }
      }

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (!isFunction[y][x] && maskCondition(bestMask, y, x)) modules[y][x] ^= 1;
        }
      }
      drawFormatBits(bestMask);

      return { modules, size };
    }

    function toSVG(text) {
      const qr = generateMatrix(text);
      if (!qr) return "";
      const { modules, size } = qr;
      const border = 3;
      const total = size + border * 2;
      const paths = [];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (modules[y][x]) {
            paths.push(`M${x + border},${y + border}h1v1h-1z`);
          }
        }
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="UPI Payment QR Code"><rect width="${total}" height="${total}" fill="#ffffff"/><path d="${paths.join("")}" fill="#111827"/></svg>`;
    }

    return { toSVG };
  })();

  /* ========================================================================
     3. UTILITY HELPERS
     ======================================================================== */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addDaysISO(isoDate, days) {
    if (!isoDate) return todayISO();
    const [y, m, d] = isoDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  function formatDisplayDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function generateId(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function safeReadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function safeWriteJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota errors cleanly
    }
  }

  function formatMoney(amount, currencyCode = state.invoice.currency) {
    const cur = CURRENCY_MAP[currencyCode] || CURRENCY_MAP.INR;
    const safeVal = Number.isFinite(amount) ? amount : 0;
    const absFormatted = new Intl.NumberFormat(cur.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(safeVal));
    return `${safeVal < 0 ? "−" : ""}${cur.symbol}${absFormatted}`;
  }

  function amountToWords(amount, currencyCode = "INR") {
    const cur = CURRENCY_MAP[currencyCode] || CURRENCY_MAP.INR;
    const absVal = Math.max(0, Math.round(amount * 100) / 100);
    const whole = Math.floor(absVal);
    const fraction = Math.round((absVal - whole) * 100);

    const ones = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    ];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    const twoDigits = (n) => {
      if (n === 0) return "";
      if (n < 20) return ones[n];
      return `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`;
    };

    const threeDigits = (n) => {
      if (n === 0) return "";
      const h = Math.floor(n / 100);
      const rest = n % 100;
      return [h ? `${ones[h]} Hundred` : "", twoDigits(rest)].filter(Boolean).join(" ");
    };

    const integerWords = (num) => {
      if (num === 0) return "Zero";
      if (currencyCode === "INR") {
        const crore = Math.floor(num / 10000000);
        const lakh = Math.floor((num % 10000000) / 100000);
        const thousand = Math.floor((num % 100000) / 1000);
        const hundredRest = num % 1000;
        const parts = [];
        if (crore) parts.push(`${integerWords(crore)} Crore`);
        if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
        if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
        if (hundredRest) parts.push(threeDigits(hundredRest));
        return parts.join(" ");
      }
      const billion = Math.floor(num / 1000000000);
      const million = Math.floor((num % 1000000000) / 1000000);
      const thousand = Math.floor((num % 1000000) / 1000);
      const rest = num % 1000;
      const parts = [];
      if (billion) parts.push(`${threeDigits(billion)} Billion`);
      if (million) parts.push(`${threeDigits(million)} Million`);
      if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
      if (rest) parts.push(threeDigits(rest));
      return parts.join(" ");
    };

    let result = `${cur.major} ${integerWords(whole)}`;
    if (fraction > 0) {
      result += ` and ${twoDigits(fraction)} ${cur.minor}`;
    }
    return `${result} Only`;
  }

  function incrementInvoiceNumber(current) {
    const raw = (current || "").trim();
    const match = raw.match(/^(.*?)(\d+)$/);
    if (!match) return `QB-${new Date().getFullYear()}-0001`;
    const prefix = match[1];
    const numStr = match[2];
    const nextNum = String(Number(numStr) + 1).padStart(numStr.length, "0");
    return `${prefix}${nextNum}`;
  }

  /* ========================================================================
     4. APPLICATION STATE & IN-MEMORY LINE ITEMS ARRAY
     ======================================================================== */
  function createDefaultInvoice() {
    const issueDate = todayISO();
    return {
      id: generateId("inv"),
      docType: "TAX INVOICE",
      stamp: "",
      number: `QB-${new Date().getFullYear()}-0001`,
      date: issueDate,
      terms: "Net 15",
      dueDate: addDaysISO(issueDate, 15),
      currency: "INR",
      taxMode: "flat",
      taxRate: 18,
      discountVal: 0,
      discountType: "flat",
      shipping: 0,
      amountPaid: 0,
      roundOff: false,
      qrEnabled: true,
      upiId: "quickbill@okaxis",
      upiPayee: "QuickBill Digital Studio",
      notes: "Thank you for partnering with us. Please quote the Invoice Number on all NEFT/UPI transfers.",
      docTerms: "1. Payment is due within the agreed credit period.\n2. Goods/services once rendered are subject to Mumbai jurisdiction.",
      docAccent: "theme",
      compact: false,
      vaultStatus: "DRAFT"
    };
  }

  function createEmptyCustomer() {
    return {
      name: "",
      gstin: "",
      state: "",
      phone: "",
      email: "",
      address: ""
    };
  }

  const state = {
    theme: "material",
    invoice: createDefaultInvoice(),
    seller: { ...DEFAULT_SELLER },
    customer: createEmptyCustomer(),
    items: [],
    vault: [],
    clients: [],
    catalog: [...DEFAULT_CATALOG],
    editingItemId: null,
    vaultFilter: "ALL",
    vaultSearch: "",
    catalogSearch: "",
    lastClearedSnapshot: null
  };

  /* ========================================================================
     5. AUTOMATED TAX & TOTAL CALCULATION ENGINE
     ======================================================================== */
  function calculateTotals() {
    let subtotal = 0;
    for (const item of state.items) {
      subtotal += item.qty * item.unitPrice;
    }

    const discInput = Math.max(0, Number(state.invoice.discountVal) || 0);
    let discountAmount = state.invoice.discountType === "percent"
      ? subtotal * (Math.min(100, discInput) / 100)
      : Math.min(subtotal, discInput);
    discountAmount = Math.max(0, discountAmount);

    const taxableBase = Math.max(0, subtotal - discountAmount);
    const rate = Math.max(0, Number(state.invoice.taxRate) ?? 18);
    const gstTotal = taxableBase * (rate / 100);

    const shipping = Math.max(0, Number(state.invoice.shipping) || 0);
    const rawGrand = taxableBase + gstTotal + shipping;

    let roundOffDelta = 0;
    let grandTotal = rawGrand;
    if (state.invoice.roundOff) {
      const rounded = Math.round(rawGrand);
      roundOffDelta = rounded - rawGrand;
      grandTotal = rounded;
    }

    const amountPaid = Math.max(0, Number(state.invoice.amountPaid) || 0);
    const balanceDue = Math.max(0, grandTotal - amountPaid);

    return {
      subtotal,
      discountAmount,
      taxableBase,
      rate,
      gstTotal,
      shipping,
      roundOffDelta,
      grandTotal,
      amountPaid,
      balanceDue
    };
  }

  /* ========================================================================
     6. THEME SWITCHER & STUDIO UI CONTROLS
     ======================================================================== */
  function applyTheme(themeName, persist = true) {
    const valid = ["material", "carbon", "nord", "emerald"].includes(themeName) ? themeName : "material";
    state.theme = valid;
    document.documentElement.setAttribute("data-theme", valid);
    document.body.setAttribute("data-theme", valid);

    $$(".theme-btn").forEach((btn) => {
      const active = btn.dataset.theme === valid;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEYS.THEME, valid);
      } catch {
        // Ignore
      }
    }
  }

  function applyDocAccent(accentName) {
    state.invoice.docAccent = accentName || "theme";
    $("#invoice-sheet").setAttribute("data-doc-accent", state.invoice.docAccent);
    $$(".accent-swatch").forEach((sw) => {
      sw.classList.toggle("is-active", sw.dataset.docAccent === state.invoice.docAccent);
    });
    persistDraft();
  }

  /* ========================================================================
     7. DYNAMIC LINE-ITEMS TABLE RENDERER & PREVIEW SYNC
     ======================================================================== */
  function renderItemsTable() {
    const tbody = $("#invoice-tbody");
    tbody.innerHTML = "";

    if (state.items.length === 0) {
      const tr = document.createElement("tr");
      tr.className = "empty-table-row";
      tr.innerHTML = `
        <td colspan="6">
          <div class="empty-state-box">
            <strong>No line items added yet</strong>
            <p>Use the Item Management form on the left (or open the Catalog tab) to add billable products or services.</p>
            <button type="button" class="empty-sample-btn" id="inline-load-sample">Load Sample GST Invoice</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
      const inlineBtn = $("#inline-load-sample");
      if (inlineBtn) inlineBtn.addEventListener("click", loadSampleInvoice);
      return;
    }

    const cur = state.invoice.currency;
    state.items.forEach((item, idx) => {
      const tr = document.createElement("tr");
      const lineTotal = item.qty * item.unitPrice;
      const isEditing = state.editingItemId === item.id;

      if (isEditing) {
        tr.innerHTML = `
          <td class="td-idx">${idx + 1}</td>
          <td>
            <input type="text" class="inline-edit-input" data-edit-field="description" value="${escapeHtml(item.description)}" aria-label="Edit item description">
          </td>
          <td class="td-qty">
            <input type="number" class="inline-edit-input inline-edit-num" data-edit-field="qty" min="0.01" step="any" value="${item.qty}" aria-label="Edit quantity">
          </td>
          <td class="td-price">
            <input type="number" class="inline-edit-input inline-edit-num" data-edit-field="unitPrice" min="0.01" step="any" value="${item.unitPrice}" aria-label="Edit unit price">
          </td>
          <td class="td-total">${escapeHtml(formatMoney(lineTotal, cur))}</td>
          <td class="col-actions">
            <div class="row-actions-wrap">
              <button type="button" class="row-btn row-btn-save" data-row-action="save-edit" data-item-id="${item.id}">Save</button>
              <button type="button" class="row-btn" data-row-action="cancel-edit" data-item-id="${item.id}">Cancel</button>
            </div>
          </td>
        `;
      } else {
        const subMetaParts = [];
        if (item.hsn) subMetaParts.push(`HSN/SAC: ${escapeHtml(item.hsn)}`);
        if (item.unit) subMetaParts.push(`Unit: ${escapeHtml(item.unit)}`);

        tr.innerHTML = `
          <td class="td-idx">${idx + 1}</td>
          <td>
            <div class="td-desc-title">${escapeHtml(item.description)}</div>
            ${subMetaParts.length ? `<div class="td-desc-sub">${subMetaParts.join(" · ")}</div>` : ""}
          </td>
          <td class="td-qty">
            <div class="qty-cell-wrap">
              <button type="button" class="qty-stepper-btn" data-row-action="dec-qty" data-item-id="${item.id}" title="Decrease quantity" aria-label="Decrease quantity">−</button>
              <span>${escapeHtml(Number(item.qty).toLocaleString("en-IN", { maximumFractionDigits: 3 }))}${item.unit ? ` ${escapeHtml(item.unit)}` : ""}</span>
              <button type="button" class="qty-stepper-btn" data-row-action="inc-qty" data-item-id="${item.id}" title="Increase quantity" aria-label="Increase quantity">+</button>
            </div>
          </td>
          <td class="td-price">${escapeHtml(formatMoney(item.unitPrice, cur))}</td>
          <td class="td-total">${escapeHtml(formatMoney(lineTotal, cur))}</td>
          <td class="col-actions">
            <div class="row-actions-wrap">
              <button type="button" class="row-btn" data-row-action="edit" data-item-id="${item.id}" title="Edit line item">Edit</button>
              <button type="button" class="row-btn row-btn-delete" data-row-action="delete" data-item-id="${item.id}" aria-label="Delete ${escapeHtml(item.description)}">Delete</button>
            </div>
          </td>
        `;
      }

      tbody.appendChild(tr);
    });
  }

  function renderTotalsAndKPIs() {
    const totals = calculateTotals();
    const cur = state.invoice.currency;

    $("#sum-subtotal").textContent = formatMoney(totals.subtotal, cur);

    const rowDisc = $("#row-discount");
    if (totals.discountAmount > 0) {
      rowDisc.hidden = false;
      $("#sum-discount-label").textContent =
        state.invoice.discountType === "percent"
          ? `Discount (${Number(state.invoice.discountVal) || 0}%)`
          : "Discount";
      $("#sum-discount").textContent = `−${formatMoney(totals.discountAmount, cur)}`;
    } else {
      rowDisc.hidden = true;
    }

    const taxBox = $("#tax-rows-container");
    const rateLabel = Number.isInteger(totals.rate) ? String(totals.rate) : totals.rate.toFixed(1);
    if (state.invoice.taxMode === "cgst_sgst") {
      const halfRate = totals.rate / 2;
      const halfStr = Number.isInteger(halfRate) ? String(halfRate) : halfRate.toFixed(1);
      const halfTax = totals.gstTotal / 2;
      taxBox.innerHTML = `
        <div class="ledger-row">
          <span>CGST (${halfStr}%)</span>
          <strong>${escapeHtml(formatMoney(halfTax, cur))}</strong>
        </div>
        <div class="ledger-row">
          <span>SGST (${halfStr}%)</span>
          <strong>${escapeHtml(formatMoney(halfTax, cur))}</strong>
        </div>
      `;
    } else if (state.invoice.taxMode === "igst") {
      taxBox.innerHTML = `
        <div class="ledger-row">
          <span>IGST (${rateLabel}%)</span>
          <strong id="sum-gst">${escapeHtml(formatMoney(totals.gstTotal, cur))}</strong>
        </div>
      `;
    } else {
      taxBox.innerHTML = `
        <div class="ledger-row">
          <span>GST (${rateLabel}%)</span>
          <strong id="sum-gst">${escapeHtml(formatMoney(totals.gstTotal, cur))}</strong>
        </div>
      `;
    }

    const rowShip = $("#row-shipping");
    if (totals.shipping > 0) {
      rowShip.hidden = false;
      $("#sum-shipping").textContent = formatMoney(totals.shipping, cur);
    } else {
      rowShip.hidden = true;
    }

    const rowRound = $("#row-roundoff");
    if (state.invoice.roundOff && Math.abs(totals.roundOffDelta) > 0.001) {
      rowRound.hidden = false;
      $("#sum-roundoff").textContent =
        `${totals.roundOffDelta >= 0 ? "+" : ""}${formatMoney(totals.roundOffDelta, cur)}`;
    } else {
      rowRound.hidden = true;
    }

    $("#sum-grand-total").textContent = formatMoney(totals.grandTotal, cur);

    const rowPaid = $("#row-paid");
    const rowBalance = $("#row-balance");
    if (totals.amountPaid > 0) {
      rowPaid.hidden = false;
      rowBalance.hidden = false;
      $("#sum-paid").textContent = `−${formatMoney(totals.amountPaid, cur)}`;
      $("#sum-balance").textContent = formatMoney(totals.balanceDue, cur);
      $("#pv-hero-due").textContent = formatMoney(totals.balanceDue, cur);
    } else {
      rowPaid.hidden = true;
      rowBalance.hidden = true;
      $("#pv-hero-due").textContent = formatMoney(totals.grandTotal, cur);
    }

    $("#pv-amount-words").textContent = amountToWords(totals.grandTotal, cur);

    $("#kpi-grand-total").textContent = formatMoney(totals.grandTotal, cur);
    $("#kpi-gst-total").textContent = formatMoney(totals.gstTotal, cur);
    $("#kpi-item-count").textContent = String(state.items.length);

    const vaultTotal = state.vault.reduce((acc, v) => acc + (Number(v.grandTotal) || 0), 0);
    $("#kpi-vault-revenue").textContent = formatMoney(vaultTotal, "INR");

    return totals;
  }

  function renderQRAndPayment(totals) {
    const qrWrap = $("#pv-qr-wrap");
    const qrHost = $("#pv-qr-svg");
    const upiId = (state.invoice.upiId || "").trim();

    if (state.invoice.qrEnabled && upiId) {
      const payee = encodeURIComponent((state.invoice.upiPayee || state.seller.name || "QuickBill").trim());
      const payableAmt = totals.amountPaid > 0 ? totals.balanceDue : totals.grandTotal;
      const amtStr = payableAmt > 0 ? `&am=${payableAmt.toFixed(2)}` : "";
      const note = encodeURIComponent(`Inv ${state.invoice.number || ""}`.trim());
      const upiURI = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${payee}${amtStr}&cu=INR&tn=${note}`;
      const svg = QRGenerator.toSVG(upiURI);

      if (svg) {
        qrWrap.hidden = false;
        qrHost.innerHTML = svg;
        $("#pv-upi-caption").textContent = upiId;
      } else {
        qrWrap.hidden = true;
      }
    } else {
      qrWrap.hidden = true;
      qrHost.innerHTML = "";
    }

    const s = state.seller;
    const bankLines = [];
    if (s.bankName) bankLines.push(`<p><strong>Bank:</strong> ${escapeHtml(s.bankName)}</p>`);
    if (s.bankAcc) bankLines.push(`<p><strong>A/C No:</strong> ${escapeHtml(s.bankAcc)}</p>`);
    if (s.bankIfsc) bankLines.push(`<p><strong>IFSC:</strong> ${escapeHtml(s.bankIfsc)}</p>`);
    if (s.bankBranch) bankLines.push(`<p><strong>Branch:</strong> ${escapeHtml(s.bankBranch)}</p>`);
    $("#pv-bank-details").innerHTML = bankLines.join("");

    const notes = (state.invoice.notes || "").trim();
    const notesWrap = $("#pv-notes-wrap");
    if (notes) {
      notesWrap.hidden = false;
      $("#pv-notes-text").textContent = notes;
    } else {
      notesWrap.hidden = true;
    }
  }

  function renderDocumentMetadata() {
    const inv = state.invoice;
    const s = state.seller;
    const c = state.customer;

    const logoWrap = $("#pv-logo-wrap");
    if (s.logoDataUrl) {
      logoWrap.classList.add("has-img");
      logoWrap.innerHTML = `<img src="${s.logoDataUrl}" alt="${escapeHtml(s.name || "Business")} Logo">`;
    } else {
      logoWrap.classList.remove("has-img");
      const initials = (s.name || "QB")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || "")
        .join("")
        .toUpperCase() || "QB";
      logoWrap.textContent = initials;
    }

    $("#pv-biz-name").textContent = s.name || "Your Business Name";
    $("#pv-biz-tagline").textContent = s.tagline || "";
    $("#pv-biz-address").textContent = s.address || "";
    $("#pv-biz-contact").textContent = [s.phone, s.email].filter(Boolean).join(" · ");
    $("#pv-biz-gstin").textContent = s.gstin ? `GSTIN: ${s.gstin.toUpperCase()}` : "";

    $("#pv-doc-title").textContent = inv.docType || "TAX INVOICE";
    $("#pv-inv-number").textContent = inv.number || "—";
    $("#pv-inv-date").textContent = formatDisplayDate(inv.date);
    $("#pv-due-date").textContent = inv.dueDate ? formatDisplayDate(inv.dueDate) : "On Receipt";
    $("#pv-terms").textContent = inv.terms || "Due on Receipt";

    const wm = $("#doc-watermark");
    wm.className = "doc-watermark";
    if (inv.stamp) {
      wm.textContent = inv.stamp;
      wm.classList.add("is-visible", `stamp-${inv.stamp.toLowerCase()}`);
    } else {
      wm.textContent = "";
    }

    $("#header-doc-badge").textContent = inv.stamp || inv.vaultStatus || "DRAFT";
    $("#pv-status-label").textContent = inv.stamp || "Active";

    $("#pv-cust-name").textContent = c.name.trim() || "Walk-In / Cash Customer";
    $("#pv-cust-address").textContent = c.address.trim() || "";
    $("#pv-cust-contact").textContent = [c.phone.trim(), c.email.trim()].filter(Boolean).join(" · ");
    $("#pv-cust-gstin").textContent = c.gstin.trim() ? `GSTIN: ${c.gstin.trim().toUpperCase()}` : "";

    $("#pv-supply-state").textContent = c.state.trim() || s.state.trim() || "India";
    const cur = CURRENCY_MAP[inv.currency] || CURRENCY_MAP.INR;
    $("#pv-currency-label").textContent = `${cur.code} (${cur.symbol})`;

    $("#pv-terms-text").textContent = inv.docTerms || "";
    $("#pv-for-biz").textContent = `For ${s.name || "QuickBill"}`;
    $("#pv-signatory-name").textContent = s.signatoryName || "Authorized Signatory";

    const sigWrap = $("#pv-sig-img-wrap");
    if (s.sigDataUrl) {
      sigWrap.innerHTML = `<img src="${s.sigDataUrl}" alt="Authorized Signature">`;
    } else {
      sigWrap.innerHTML = "";
    }

    $("#invoice-sheet").classList.toggle("is-compact", Boolean(inv.compact));
  }

  function renderAll() {
    renderDocumentMetadata();
    renderItemsTable();
    const totals = renderTotalsAndKPIs();
    renderQRAndPayment(totals);
    persistDraft();
  }

  /* ========================================================================
     8. FORM HYDRATION (STATE -> INPUTS)
     ======================================================================== */
  function hydrateStudioInputs() {
    const inv = state.invoice;
    const s = state.seller;
    const c = state.customer;

    $("#doc-type").value = inv.docType;
    $("#doc-stamp").value = inv.stamp;
    $("#inv-number").value = inv.number;
    $("#inv-date").value = inv.date;
    $("#inv-terms").value = inv.terms;
    $("#inv-due-date").value = inv.dueDate;

    $("#customer-name").value = c.name;
    $("#cust-gstin").value = c.gstin;
    $("#cust-state").value = c.state;
    $("#cust-phone").value = c.phone;
    $("#cust-email").value = c.email;
    $("#cust-address").value = c.address;

    $("#adj-discount-val").value = inv.discountVal;
    $("#adj-discount-type").value = inv.discountType;
    $("#adj-shipping").value = inv.shipping;
    $("#adj-paid").value = inv.amountPaid;
    $("#adj-roundoff").checked = Boolean(inv.roundOff);

    $("#biz-name").value = s.name;
    $("#biz-tagline").value = s.tagline;
    $("#biz-gstin").value = s.gstin;
    $("#biz-state").value = s.state;
    $("#biz-phone").value = s.phone;
    $("#biz-email").value = s.email;
    $("#biz-address").value = s.address;

    $("#tax-mode").value = inv.taxMode;
    $("#tax-rate").value = String(inv.taxRate);
    $("#currency-code").value = inv.currency;

    $("#qr-enabled").checked = Boolean(inv.qrEnabled);
    $("#upi-id").value = inv.upiId;
    $("#upi-payee").value = inv.upiPayee;

    $("#bank-name").value = s.bankName;
    $("#bank-acc").value = s.bankAcc;
    $("#bank-ifsc").value = s.bankIfsc;
    $("#bank-branch").value = s.bankBranch;
    $("#signatory-name").value = s.signatoryName;

    $("#doc-notes").value = inv.notes;
    $("#doc-terms").value = inv.docTerms;

    $("#btn-toggle-density").textContent = inv.compact ? "Comfort Rows" : "Compact Rows";
    applyDocAccent(inv.docAccent || "theme");
  }

  /* ========================================================================
     9. VALIDATION & ITEM MANAGEMENT
     ======================================================================== */
  function clearItemValidationErrors() {
    $("#err-desc").textContent = "";
    $("#err-qty").textContent = "";
    $("#err-price").textContent = "";
    $("#item-desc").classList.remove("is-invalid");
    $("#item-qty").classList.remove("is-invalid");
    $("#item-price").classList.remove("is-invalid");
  }

  function updateItemLivePreview() {
    const qty = Number($("#item-qty").value);
    const price = Number($("#item-price").value);
    const total = Number.isFinite(qty) && qty > 0 && Number.isFinite(price) && price > 0 ? qty * price : 0;
    $("#item-live-preview").textContent = formatMoney(total);
  }

  function validateItemInputs(desc, qty, price) {
    let valid = true;
    clearItemValidationErrors();

    if (!desc) {
      $("#err-desc").textContent = "Please enter an item or service description.";
      $("#item-desc").classList.add("is-invalid");
      valid = false;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      $("#err-qty").textContent = "Quantity must be greater than 0.";
      $("#item-qty").classList.add("is-invalid");
      valid = false;
    }
    if (!Number.isFinite(price) || price <= 0) {
      $("#err-price").textContent = "Unit price must be greater than 0.";
      $("#item-price").classList.add("is-invalid");
      valid = false;
    }
    return valid;
  }

  function handleAddItem(e) {
    e.preventDefault();
    const desc = $("#item-desc").value.trim();
    const hsn = $("#item-hsn").value.trim();
    const unit = $("#item-unit").value;
    const qty = Number($("#item-qty").value);
    const unitPrice = Number($("#item-price").value);

    if (!validateItemInputs(desc, qty, unitPrice)) {
      if (!desc) $("#item-desc").focus();
      else if (!Number.isFinite(qty) || qty <= 0) $("#item-qty").focus();
      else $("#item-price").focus();
      return;
    }

    state.items.push({
      id: generateId("itm"),
      description: desc,
      hsn,
      unit,
      qty,
      unitPrice
    });

    $("#item-desc").value = "";
    $("#item-hsn").value = "";
    $("#item-qty").value = "";
    $("#item-price").value = "";
    clearItemValidationErrors();
    updateItemLivePreview();
    renderAll();
    $("#item-desc").focus();
    showToast(`Added "${desc}"`);
  }

  function handleTableClick(e) {
    const btn = e.target.closest("[data-row-action]");
    if (!btn) return;
    const action = btn.dataset.rowAction;
    const id = btn.dataset.itemId;
    const idx = state.items.findIndex((it) => it.id === id);
    if (idx === -1) return;

    if (action === "delete") {
      const removed = state.items.splice(idx, 1)[0];
      if (state.editingItemId === id) state.editingItemId = null;
      renderAll();
      showToast(`Removed "${removed.description}"`, () => {
        state.items.splice(idx, 0, removed);
        renderAll();
      });
    } else if (action === "inc-qty") {
      state.items[idx].qty = Math.round((state.items[idx].qty + 1) * 1000) / 1000;
      renderAll();
    } else if (action === "dec-qty") {
      if (state.items[idx].qty > 1) {
        state.items[idx].qty = Math.max(0.01, Math.round((state.items[idx].qty - 1) * 1000) / 1000);
        renderAll();
      } else {
        showToast("Minimum quantity is 1. Use Delete to remove the row.");
      }
    } else if (action === "edit") {
      state.editingItemId = id;
      renderItemsTable();
    } else if (action === "cancel-edit") {
      state.editingItemId = null;
      renderItemsTable();
    } else if (action === "save-edit") {
      const row = btn.closest("tr");
      const newDesc = row.querySelector('[data-edit-field="description"]').value.trim();
      const newQty = Number(row.querySelector('[data-edit-field="qty"]').value);
      const newPrice = Number(row.querySelector('[data-edit-field="unitPrice"]').value);
      if (!newDesc || !Number.isFinite(newQty) || newQty <= 0 || !Number.isFinite(newPrice) || newPrice <= 0) {
        showToast("Description, positive quantity, and positive price are required.");
        return;
      }
      state.items[idx].description = newDesc;
      state.items[idx].qty = newQty;
      state.items[idx].unitPrice = newPrice;
      state.editingItemId = null;
      renderAll();
      showToast("Line item updated");
    }
  }

  /* ========================================================================
     10. CLEAR ALL / SAMPLE LOADER / PERSISTENCE
     ======================================================================== */
  function clearAllInvoice() {
    const hadContent = state.items.length > 0 || Boolean(state.customer.name.trim());
    if (hadContent) {
      state.lastClearedSnapshot = {
        invoice: JSON.parse(JSON.stringify(state.invoice)),
        customer: JSON.parse(JSON.stringify(state.customer)),
        items: JSON.parse(JSON.stringify(state.items))
      };
    }

    const nextNum = incrementInvoiceNumber(state.invoice.number);
    state.invoice = {
      ...createDefaultInvoice(),
      number: nextNum,
      upiId: state.invoice.upiId,
      upiPayee: state.invoice.upiPayee,
      notes: state.invoice.notes,
      docTerms: state.invoice.docTerms,
      docAccent: state.invoice.docAccent,
      compact: state.invoice.compact
    };
    state.customer = createEmptyCustomer();
    state.items = [];
    state.editingItemId = null;

    clearItemValidationErrors();
    $("#item-form").reset();
    updateItemLivePreview();
    hydrateStudioInputs();
    renderAll();

    if (hadContent && state.lastClearedSnapshot) {
      showToast("Invoice cleared and metadata reset.", () => {
        state.invoice = state.lastClearedSnapshot.invoice;
        state.customer = state.lastClearedSnapshot.customer;
        state.items = state.lastClearedSnapshot.items;
        hydrateStudioInputs();
        renderAll();
      });
    } else {
      showToast("Invoice reset to clean state.");
    }
  }

  function loadSampleInvoice() {
    const issueDate = todayISO();
    state.invoice = {
      ...state.invoice,
      id: generateId("inv"),
      docType: "TAX INVOICE",
      stamp: "",
      number: `QB-${new Date().getFullYear()}-0104`,
      date: issueDate,
      terms: "Net 15",
      dueDate: addDaysISO(issueDate, 15),
      currency: "INR",
      taxMode: "flat",
      taxRate: 18,
      discountVal: 0,
      discountType: "flat",
      shipping: 0,
      amountPaid: 0,
      roundOff: false,
      qrEnabled: true,
      upiId: state.invoice.upiId || "quickbill@okaxis",
      upiPayee: state.seller.name || "QuickBill Digital Studio"
    };

    state.customer = {
      name: "Meridian Retail Labs Pvt. Ltd.",
      gstin: "29AABCM4829L1Z8",
      state: "Karnataka (29)",
      phone: "+91 98450 77410",
      email: "finance@meridianlabs.in",
      address: "742 100 Feet Road, Indiranagar, Bengaluru 560038"
    };

    state.items = [
      {
        id: generateId("itm"),
        description: "Design System & Component Architecture",
        hsn: "998314",
        unit: "hrs",
        qty: 24,
        unitPrice: 2500
      },
      {
        id: generateId("itm"),
        description: "Checkout API & Payment Gateway Integration",
        hsn: "998313",
        unit: "nos",
        qty: 1,
        unitPrice: 42000
      },
      {
        id: generateId("itm"),
        description: "Production Cloud Hardening & Load Testing",
        hsn: "998315",
        unit: "days",
        qty: 3,
        unitPrice: 6500
      }
    ];

    state.editingItemId = null;
    hydrateStudioInputs();
    renderAll();
    showToast("Sample GST invoice loaded.");
  }

  function persistDraft() {
    safeWriteJSON(STORAGE_KEYS.DRAFT, {
      invoice: state.invoice,
      customer: state.customer,
      items: state.items
    });
    safeWriteJSON(STORAGE_KEYS.SELLER, state.seller);
  }

  /* ========================================================================
     11. INVOICE VAULT, CLIENTS DIRECTORY & CATALOG
     ======================================================================== */
  function renderVaultAndClients() {
    $("#vault-count").textContent = String(state.vault.length);

    const select = $("#saved-clients-select");
    const datalist = $("#saved-clients-datalist");
    select.innerHTML = `<option value="">-- Select a saved client --</option>`;
    datalist.innerHTML = "";
    state.clients.forEach((cl) => {
      const opt = document.createElement("option");
      opt.value = cl.id;
      opt.textContent = cl.name + (cl.gstin ? ` (${cl.gstin})` : "");
      select.appendChild(opt);

      const dlOpt = document.createElement("option");
      dlOpt.value = cl.name;
      datalist.appendChild(dlOpt);
    });

    const vaultList = $("#vault-list");
    const q = state.vaultSearch.trim().toLowerCase();
    const filtered = state.vault.filter((entry) => {
      const matchFilter = state.vaultFilter === "ALL" || entry.vaultStatus === state.vaultFilter;
      const matchSearch =
        !q ||
        (entry.invoice.number || "").toLowerCase().includes(q) ||
        (entry.customer.name || "").toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });

    if (filtered.length === 0) {
      vaultList.innerHTML = `<div class="empty-muted">No saved invoices match your current filter. Click "Save" in the top bar to store this invoice.</div>`;
    } else {
      vaultList.innerHTML = "";
      filtered.forEach((entry) => {
        const card = document.createElement("div");
        card.className = "vault-card";
        card.innerHTML = `
          <div class="vault-card-top">
            <span class="vault-card-num">${escapeHtml(entry.invoice.number)}</span>
            <span class="status-pill pill-${escapeHtml(entry.vaultStatus)}">${escapeHtml(entry.vaultStatus)}</span>
          </div>
          <div class="vault-card-cust">${escapeHtml(entry.customer.name || "Walk-In Customer")}</div>
          <div class="vault-card-sub">
            <span>${escapeHtml(formatDisplayDate(entry.invoice.date))} · ${entry.items.length} item(s)</span>
            <strong>${escapeHtml(formatMoney(entry.grandTotal, entry.invoice.currency))}</strong>
          </div>
          <div class="vault-card-actions">
            <button type="button" class="btn btn-primary btn-sm" data-vault-action="load" data-vault-id="${entry.id}">Load</button>
            <button type="button" class="btn btn-secondary btn-sm" data-vault-action="cycle-status" data-vault-id="${entry.id}">Status</button>
            <button type="button" class="btn btn-ghost btn-sm" data-vault-action="duplicate" data-vault-id="${entry.id}">Clone</button>
            <button type="button" class="btn btn-danger-outline btn-sm" data-vault-action="delete" data-vault-id="${entry.id}">Delete</button>
          </div>
        `;
        vaultList.appendChild(card);
      });
    }

    const clList = $("#vault-clients-list");
    if (state.clients.length === 0) {
      clList.innerHTML = `<div class="empty-muted">No saved clients yet. Click "+ Save Client" next to Customer Name to save recurring clients.</div>`;
    } else {
      clList.innerHTML = "";
      state.clients.forEach((cl) => {
        const card = document.createElement("div");
        card.className = "vault-card";
        card.innerHTML = `
          <div class="vault-card-top">
            <span class="vault-card-cust">${escapeHtml(cl.name)}</span>
            <span class="card-hint">${escapeHtml(cl.state || "")}</span>
          </div>
          <div class="vault-card-sub">
            <span>${escapeHtml(cl.gstin || cl.email || "No GSTIN")}</span>
          </div>
          <div class="vault-card-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-client-action="use" data-client-id="${cl.id}">Apply to Invoice</button>
            <button type="button" class="btn btn-danger-outline btn-sm" data-client-action="delete" data-client-id="${cl.id}">Remove</button>
          </div>
        `;
        clList.appendChild(card);
      });
    }
  }

  function saveCurrentToVault() {
    const totals = calculateTotals();
    const record = {
      id: state.invoice.id || generateId("inv"),
      savedAt: new Date().toISOString(),
      vaultStatus: state.invoice.stamp === "PAID" ? "PAID" : (state.invoice.vaultStatus || "DRAFT"),
      grandTotal: totals.grandTotal,
      invoice: JSON.parse(JSON.stringify(state.invoice)),
      customer: JSON.parse(JSON.stringify(state.customer)),
      items: JSON.parse(JSON.stringify(state.items))
    };

    const existingIdx = state.vault.findIndex((v) => v.id === record.id);
    if (existingIdx >= 0) {
      state.vault[existingIdx] = record;
    } else {
      state.vault.unshift(record);
    }

    safeWriteJSON(STORAGE_KEYS.VAULT, state.vault);
    renderVaultAndClients();
    renderTotalsAndKPIs();
    showToast(`Saved ${record.invoice.number} to Invoice Vault.`);
  }

  function saveCurrentClient() {
    const name = state.customer.name.trim();
    if (!name) {
      showToast("Enter a Customer Name first to save the client.");
      $("#customer-name").focus();
      return;
    }
    const clientObj = {
      id: generateId("cli"),
      ...JSON.parse(JSON.stringify(state.customer)),
      name
    };
    const existingIdx = state.clients.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) {
      clientObj.id = state.clients[existingIdx].id;
      state.clients[existingIdx] = clientObj;
    } else {
      state.clients.unshift(clientObj);
    }
    safeWriteJSON(STORAGE_KEYS.CLIENTS, state.clients);
    renderVaultAndClients();
    showToast(`Saved client "${name}".`);
  }

  function renderCatalog() {
    const list = $("#catalog-list");
    const q = state.catalogSearch.trim().toLowerCase();
    const items = state.catalog.filter(
      (c) =>
        !q ||
        c.description.toLowerCase().includes(q) ||
        (c.hsn || "").toLowerCase().includes(q)
    );

    if (items.length === 0) {
      list.innerHTML = `<div class="empty-muted">No catalog presets match "${escapeHtml(state.catalogSearch)}".</div>`;
      return;
    }

    list.innerHTML = "";
    items.forEach((cat) => {
      const el = document.createElement("div");
      el.className = "catalog-item";
      el.innerHTML = `
        <div class="catalog-item-meta">
          <div class="catalog-item-title">${escapeHtml(cat.description)}</div>
          <div class="catalog-item-sub">${escapeHtml(formatMoney(cat.unitPrice))} / ${escapeHtml(cat.unit || "nos")}${cat.hsn ? ` · HSN ${escapeHtml(cat.hsn)}` : ""}</div>
        </div>
        <div class="catalog-item-actions">
          <button type="button" class="btn btn-primary btn-sm" data-cat-action="insert" data-cat-id="${cat.id}">+ Add</button>
          <button type="button" class="btn btn-ghost btn-sm" data-cat-action="remove" data-cat-id="${cat.id}" title="Delete preset">×</button>
        </div>
      `;
      list.appendChild(el);
    });
  }

  /* ========================================================================
     12. CSV / JSON EXPORT, IMPORT, COPY SUMMARY & IMAGE HELPERS
     ======================================================================== */
  function csvCell(val) {
    const str = String(val ?? "");
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  function exportCSV() {
    if (state.items.length === 0) {
      showToast("Add at least one line item before exporting CSV.");
      return;
    }
    const totals = calculateTotals();
    const rows = [
      ["Invoice Number", state.invoice.number, "Date", state.invoice.date, "Customer", state.customer.name || "Walk-In"],
      [],
      ["#", "Item Description", "HSN/SAC", "Unit", "Quantity", "Unit Price", "Line Total"]
    ];
    state.items.forEach((it, idx) => {
      rows.push([
        idx + 1,
        it.description,
        it.hsn || "",
        it.unit || "",
        it.qty,
        it.unitPrice.toFixed(2),
        (it.qty * it.unitPrice).toFixed(2)
      ]);
    });
    rows.push([]);
    rows.push(["", "", "", "", "", "Subtotal", totals.subtotal.toFixed(2)]);
    if (totals.discountAmount > 0) rows.push(["", "", "", "", "", "Discount", (-totals.discountAmount).toFixed(2)]);
    rows.push(["", "", "", "", "", `GST (${totals.rate}%)`, totals.gstTotal.toFixed(2)]);
    rows.push(["", "", "", "", "", "Grand Total", totals.grandTotal.toFixed(2)]);

    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadFile(csv, `${state.invoice.number || "QuickBill-Invoice"}.csv`, "text/csv;charset=utf-8;");
    showToast("CSV exported.");
  }

  function exportJSON() {
    const payload = {
      app: "QuickBill",
      exportedAt: new Date().toISOString(),
      invoice: state.invoice,
      seller: state.seller,
      customer: state.customer,
      items: state.items
    };
    downloadFile(
      JSON.stringify(payload, null, 2),
      `${state.invoice.number || "QuickBill-Invoice"}.json`,
      "application/json"
    );
    showToast("Invoice JSON backup exported.");
  }

  function importJSONFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.items)) throw new Error("Invalid file");
        state.invoice = { ...createDefaultInvoice(), ...(parsed.invoice || {}) };
        state.seller = { ...DEFAULT_SELLER, ...(parsed.seller || {}) };
        state.customer = { ...createEmptyCustomer(), ...(parsed.customer || {}) };
        state.items = parsed.items.map((it) => ({
          id: it.id || generateId("itm"),
          description: String(it.description || "Item"),
          hsn: String(it.hsn || ""),
          unit: String(it.unit || "nos"),
          qty: Math.max(0.01, Number(it.qty) || 1),
          unitPrice: Math.max(0.01, Number(it.unitPrice) || 1)
        }));
        hydrateStudioInputs();
        renderAll();
        showToast("Invoice imported successfully.");
      } catch {
        showToast("Could not import file: invalid QuickBill JSON format.");
      }
    };
    reader.readAsText(file);
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function copyShareableSummary() {
    const totals = calculateTotals();
    const cur = state.invoice.currency;
    const lines = [
      `*${state.invoice.docType}: ${state.invoice.number}*`,
      `From: ${state.seller.name}`,
      `To: ${state.customer.name || "Customer"}`,
      `Date: ${formatDisplayDate(state.invoice.date)}`,
      `Items: ${state.items.length}`,
      `Subtotal: ${formatMoney(totals.subtotal, cur)}`,
      `GST (${totals.rate}%): ${formatMoney(totals.gstTotal, cur)}`,
      `Grand Total: ${formatMoney(totals.grandTotal, cur)}`
    ];
    if (state.invoice.qrEnabled && state.invoice.upiId) {
      lines.push(`UPI Pay ID: ${state.invoice.upiId}`);
    }
    const text = lines.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast("Invoice summary copied to clipboard."),
        () => showToast("Clipboard permission unavailable.")
      );
    } else {
      showToast("Summary prepared for copy.");
    }
  }

  function downscaleImageFile(file, maxW, maxH, callback) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  /* ========================================================================
     13. SIGNATURE PAD CONTROLLER
     ======================================================================== */
  const SignaturePad = (() => {
    let drawing = false;
    let hasStroke = false;
    let lastX = 0;
    let lastY = 0;

    function setup() {
      const canvas = $("#sig-canvas");
      const ctx = canvas.getContext("2d");

      const getPos = (evt) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: ((evt.clientX - rect.left) / rect.width) * canvas.width,
          y: ((evt.clientY - rect.top) / rect.height) * canvas.height
        };
      };

      canvas.addEventListener("pointerdown", (e) => {
        canvas.setPointerCapture(e.pointerId);
        drawing = true;
        const p = getPos(e);
        lastX = p.x;
        lastY = p.y;
      });

      canvas.addEventListener("pointermove", (e) => {
        if (!drawing) return;
        const p = getPos(e);
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        lastX = p.x;
        lastY = p.y;
        hasStroke = true;
      });

      const stop = () => {
        drawing = false;
      };
      canvas.addEventListener("pointerup", stop);
      canvas.addEventListener("pointercancel", stop);
    }

    function clear() {
      const canvas = $("#sig-canvas");
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      hasStroke = false;
    }

    function open() {
      clear();
      $("#sig-backdrop").hidden = false;
    }

    function close() {
      $("#sig-backdrop").hidden = true;
    }

    function save() {
      if (!hasStroke) {
        showToast("Draw your signature before applying.");
        return;
      }
      state.seller.sigDataUrl = $("#sig-canvas").toDataURL("image/png");
      close();
      renderAll();
      showToast("Digital signature applied.");
    }

    return { setup, clear, open, close, save };
  })();

  /* ========================================================================
     14. TOAST FEEDBACK & DRAWER CONTROLLERS
     ======================================================================== */
  function showToast(message, undoCallback = null) {
    const host = $("#toast-container");
    const toast = document.createElement("div");
    toast.className = "toast";

    const msg = document.createElement("span");
    msg.textContent = message;
    toast.appendChild(msg);

    if (typeof undoCallback === "function") {
      const undoBtn = document.createElement("button");
      undoBtn.type = "button";
      undoBtn.className = "toast-undo-btn";
      undoBtn.textContent = "Undo";
      undoBtn.addEventListener("click", () => {
        undoCallback();
        toast.remove();
      });
      toast.appendChild(undoBtn);
    }

    host.appendChild(toast);
    setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, undoCallback ? 6000 : 3200);
  }

  function openVaultDrawer() {
    renderVaultAndClients();
    $("#vault-backdrop").hidden = false;
    $("#vault-drawer").hidden = false;
  }

  function closeVaultDrawer() {
    $("#vault-backdrop").hidden = true;
    $("#vault-drawer").hidden = true;
  }

  /* ========================================================================
     15. EVENT WIRING & INITIALIZATION
     ======================================================================== */
  function bindEvents() {
    $$(".theme-btn").forEach((btn) => {
      btn.addEventListener("click", () => applyTheme(btn.dataset.theme));
    });

    $$(".studio-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetId = tab.dataset.tab;
        $$(".studio-tab").forEach((t) => {
          const active = t === tab;
          t.classList.toggle("is-active", active);
          t.setAttribute("aria-selected", String(active));
        });
        $$(".studio-panel").forEach((panel) => {
          const isTarget = panel.id === targetId;
          panel.classList.toggle("is-active", isTarget);
          panel.hidden = !isTarget;
        });
      });
    });

    $("#btn-sample").addEventListener("click", loadSampleInvoice);
    $("#btn-save-vault").addEventListener("click", saveCurrentToVault);
    $("#btn-open-vault").addEventListener("click", openVaultDrawer);
    $("#btn-close-vault").addEventListener("click", closeVaultDrawer);
    $("#vault-backdrop").addEventListener("click", closeVaultDrawer);

    $("#btn-export-csv").addEventListener("click", exportCSV);
    $("#btn-export-json").addEventListener("click", exportJSON);
    $("#btn-import-json").addEventListener("click", () => $("#import-file-input").click());
    $("#import-file-input").addEventListener("change", (e) => {
      importJSONFile(e.target.files[0]);
      e.target.value = "";
    });

    $("#btn-clear-all").addEventListener("click", clearAllInvoice);
    $("#btn-print").addEventListener("click", () => {
      if (state.editingItemId) {
        state.editingItemId = null;
        renderItemsTable();
      }
      window.print();
    });

    const bindField = (selector, onChange) => {
      const el = $(selector);
      el.addEventListener("input", () => {
        onChange(el);
        renderAll();
      });
      el.addEventListener("change", () => {
        onChange(el);
        renderAll();
      });
    };

    bindField("#doc-type", (el) => (state.invoice.docType = el.value));
    bindField("#doc-stamp", (el) => (state.invoice.stamp = el.value));
    bindField("#inv-number", (el) => (state.invoice.number = el.value));
    $("#btn-next-inv-num").addEventListener("click", () => {
      state.invoice.number = incrementInvoiceNumber(state.invoice.number);
      $("#inv-number").value = state.invoice.number;
      renderAll();
    });

    const syncTermsDueDate = () => {
      const terms = state.invoice.terms;
      const offsetMap = { "Due on Receipt": 0, "Net 7": 7, "Net 15": 15, "Net 30": 30 };
      if (Object.prototype.hasOwnProperty.call(offsetMap, terms)) {
        state.invoice.dueDate = addDaysISO(state.invoice.date, offsetMap[terms]);
        $("#inv-due-date").value = state.invoice.dueDate;
      }
    };

    bindField("#inv-date", (el) => {
      state.invoice.date = el.value;
      syncTermsDueDate();
    });
    bindField("#inv-terms", (el) => {
      state.invoice.terms = el.value;
      syncTermsDueDate();
    });
    bindField("#inv-due-date", (el) => {
      state.invoice.dueDate = el.value;
      state.invoice.terms = "Custom";
      $("#inv-terms").value = "Custom";
    });

    $("#customer-name").addEventListener("input", (e) => {
      const val = e.target.value;
      state.customer.name = val;
      const match = state.clients.find((c) => c.name.toLowerCase() === val.trim().toLowerCase());
      if (match) {
        state.customer = {
          name: match.name,
          gstin: match.gstin || "",
          state: match.state || "",
          phone: match.phone || "",
          email: match.email || "",
          address: match.address || ""
        };
        hydrateStudioInputs();
      }
      renderAll();
    });

    $("#btn-client-picker").addEventListener("click", openVaultDrawer);
    $("#btn-save-client").addEventListener("click", saveCurrentClient);

    $("#item-form").addEventListener("submit", handleAddItem);
    ["#item-desc", "#item-qty", "#item-price"].forEach((sel) => {
      $(sel).addEventListener("input", () => {
        clearItemValidationErrors();
        updateItemLivePreview();
      });
    });

    $("#btn-save-to-catalog").addEventListener("click", () => {
      const desc = $("#item-desc").value.trim();
      const hsn = $("#item-hsn").value.trim();
      const unit = $("#item-unit").value;
      const price = Number($("#item-price").value);
      if (!desc || !Number.isFinite(price) || price <= 0) {
        showToast("Enter a description and positive unit price to save to catalog.");
        return;
      }
      state.catalog.unshift({
        id: generateId("cat"),
        description: desc,
        hsn,
        unit,
        unitPrice: price
      });
      safeWriteJSON(STORAGE_KEYS.CATALOG, state.catalog);
      renderCatalog();
      showToast(`Saved "${desc}" to Quick Catalog.`);
    });

    $("#invoice-tbody").addEventListener("click", handleTableClick);

    bindField("#adj-discount-val", (el) => (state.invoice.discountVal = Math.max(0, Number(el.value) || 0)));
    bindField("#adj-discount-type", (el) => (state.invoice.discountType = el.value));
    bindField("#adj-shipping", (el) => (state.invoice.shipping = Math.max(0, Number(el.value) || 0)));
    bindField("#adj-paid", (el) => (state.invoice.amountPaid = Math.max(0, Number(el.value) || 0)));
    bindField("#adj-roundoff", (el) => (state.invoice.roundOff = el.checked));

    bindField("#biz-name", (el) => (state.seller.name = el.value));
    bindField("#biz-tagline", (el) => (state.seller.tagline = el.value));
    bindField("#biz-gstin", (el) => (state.seller.gstin = el.value));
    bindField("#biz-state", (el) => (state.seller.state = el.value));
    bindField("#biz-phone", (el) => (state.seller.phone = el.value));
    bindField("#biz-email", (el) => (state.seller.email = el.value));
    bindField("#biz-address", (el) => (state.seller.address = el.value));

    $("#btn-upload-logo").addEventListener("click", () => $("#logo-file-input").click());
    $("#logo-file-input").addEventListener("change", (e) => {
      downscaleImageFile(e.target.files[0], 220, 220, (dataUrl) => {
        state.seller.logoDataUrl = dataUrl;
        renderAll();
        showToast("Business logo updated.");
      });
      e.target.value = "";
    });
    $("#btn-remove-logo").addEventListener("click", () => {
      state.seller.logoDataUrl = "";
      renderAll();
      showToast("Reverted to monogram logo.");
    });

    $("#saved-clients-select").addEventListener("change", (e) => {
      const cl = state.clients.find((c) => c.id === e.target.value);
      if (!cl) return;
      state.customer = {
        name: cl.name,
        gstin: cl.gstin || "",
        state: cl.state || "",
        phone: cl.phone || "",
        email: cl.email || "",
        address: cl.address || ""
      };
      hydrateStudioInputs();
      renderAll();
      showToast(`Loaded client "${cl.name}".`);
    });

    bindField("#cust-gstin", (el) => (state.customer.gstin = el.value));
    bindField("#cust-state", (el) => (state.customer.state = el.value));
    bindField("#cust-phone", (el) => (state.customer.phone = el.value));
    bindField("#cust-email", (el) => (state.customer.email = el.value));
    bindField("#cust-address", (el) => (state.customer.address = el.value));

    bindField("#tax-mode", (el) => (state.invoice.taxMode = el.value));
    bindField("#tax-rate", (el) => (state.invoice.taxRate = Number(el.value) || 0));
    bindField("#currency-code", (el) => (state.invoice.currency = el.value));

    bindField("#qr-enabled", (el) => (state.invoice.qrEnabled = el.checked));
    bindField("#upi-id", (el) => (state.invoice.upiId = el.value));
    bindField("#upi-payee", (el) => (state.invoice.upiPayee = el.value));

    bindField("#bank-name", (el) => (state.seller.bankName = el.value));
    bindField("#bank-acc", (el) => (state.seller.bankAcc = el.value));
    bindField("#bank-ifsc", (el) => (state.seller.bankIfsc = el.value));
    bindField("#bank-branch", (el) => (state.seller.bankBranch = el.value));
    bindField("#signatory-name", (el) => (state.seller.signatoryName = el.value));

    bindField("#doc-notes", (el) => (state.invoice.notes = el.value));
    bindField("#doc-terms", (el) => (state.invoice.docTerms = el.value));

    SignaturePad.setup();
    $("#btn-open-sig-pad").addEventListener("click", SignaturePad.open);
    $("#btn-sig-clear").addEventListener("click", SignaturePad.clear);
    $("#btn-sig-cancel").addEventListener("click", SignaturePad.close);
    $("#btn-sig-save").addEventListener("click", SignaturePad.save);
    $("#sig-backdrop").addEventListener("click", (e) => {
      if (e.target === $("#sig-backdrop")) SignaturePad.close();
    });

    $("#btn-upload-sig").addEventListener("click", () => $("#sig-file-input").click());
    $("#sig-file-input").addEventListener("change", (e) => {
      downscaleImageFile(e.target.files[0], 360, 140, (dataUrl) => {
        state.seller.sigDataUrl = dataUrl;
        renderAll();
        showToast("Signature image uploaded.");
      });
      e.target.value = "";
    });
    $("#btn-clear-sig").addEventListener("click", () => {
      state.seller.sigDataUrl = "";
      renderAll();
      showToast("Signature cleared.");
    });

    $("#catalog-search").addEventListener("input", (e) => {
      state.catalogSearch = e.target.value;
      renderCatalog();
    });

    $("#catalog-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cat-action]");
      if (!btn) return;
      const catId = btn.dataset.catId;
      const catIdx = state.catalog.findIndex((c) => c.id === catId);
      if (catIdx === -1) return;

      if (btn.dataset.catAction === "insert") {
        const cat = state.catalog[catIdx];
        state.items.push({
          id: generateId("itm"),
          description: cat.description,
          hsn: cat.hsn || "",
          unit: cat.unit || "nos",
          qty: 1,
          unitPrice: cat.unitPrice
        });
        renderAll();
        showToast(`Inserted "${cat.description}"`);
      } else if (btn.dataset.catAction === "remove") {
        state.catalog.splice(catIdx, 1);
        safeWriteJSON(STORAGE_KEYS.CATALOG, state.catalog);
        renderCatalog();
      }
    });

    $("#btn-add-catalog").addEventListener("click", () => {
      const desc = $("#cat-desc").value.trim();
      const hsn = $("#cat-hsn").value.trim();
      const unit = $("#cat-unit").value.trim() || "nos";
      const price = Number($("#cat-price").value);
      if (!desc || !Number.isFinite(price) || price <= 0) {
        showToast("Enter a description and positive rate for the catalog preset.");
        return;
      }
      state.catalog.unshift({ id: generateId("cat"), description: desc, hsn, unit, unitPrice: price });
      safeWriteJSON(STORAGE_KEYS.CATALOG, state.catalog);
      $("#cat-desc").value = "";
      $("#cat-hsn").value = "";
      $("#cat-price").value = "";
      renderCatalog();
      showToast("Catalog preset saved.");
    });

    $$(".accent-swatch").forEach((sw) => {
      sw.addEventListener("click", () => applyDocAccent(sw.dataset.docAccent));
    });

    $("#btn-toggle-density").addEventListener("click", () => {
      state.invoice.compact = !state.invoice.compact;
      $("#btn-toggle-density").textContent = state.invoice.compact ? "Comfort Rows" : "Compact Rows";
      renderAll();
    });

    $("#btn-copy-summary").addEventListener("click", copyShareableSummary);

    const togglePreviewFocus = (on) => {
      $("#workspace-root").classList.toggle("is-preview-focus", on);
      $("#btn-exit-preview").hidden = !on;
    };
    $("#btn-preview-mode").addEventListener("click", () => togglePreviewFocus(true));
    $("#btn-exit-preview").addEventListener("click", () => togglePreviewFocus(false));

    $("#vault-search").addEventListener("input", (e) => {
      state.vaultSearch = e.target.value;
      renderVaultAndClients();
    });

    $$(".vault-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.vaultFilter = btn.dataset.filter;
        $$(".vault-filter-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
        renderVaultAndClients();
      });
    });

    $("#vault-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-vault-action]");
      if (!btn) return;
      const action = btn.dataset.vaultAction;
      const id = btn.dataset.vaultId;
      const idx = state.vault.findIndex((v) => v.id === id);
      if (idx === -1) return;

      const entry = state.vault[idx];
      if (action === "load") {
        state.invoice = JSON.parse(JSON.stringify(entry.invoice));
        state.customer = JSON.parse(JSON.stringify(entry.customer));
        state.items = JSON.parse(JSON.stringify(entry.items));
        state.editingItemId = null;
        hydrateStudioInputs();
        renderAll();
        closeVaultDrawer();
        showToast(`Loaded ${entry.invoice.number}`);
      } else if (action === "duplicate") {
        const clonedInv = JSON.parse(JSON.stringify(entry.invoice));
        clonedInv.id = generateId("inv");
        clonedInv.number = incrementInvoiceNumber(clonedInv.number);
        clonedInv.date = todayISO();
        clonedInv.stamp = "";
        clonedInv.vaultStatus = "DRAFT";
        state.invoice = clonedInv;
        state.customer = JSON.parse(JSON.stringify(entry.customer));
        state.items = JSON.parse(JSON.stringify(entry.items)).map((it) => ({ ...it, id: generateId("itm") }));
        hydrateStudioInputs();
        renderAll();
        closeVaultDrawer();
        showToast(`Cloned into ${clonedInv.number}`);
      } else if (action === "cycle-status") {
        const order = ["DRAFT", "SENT", "PAID", "OVERDUE"];
        const nextStatus = order[(order.indexOf(entry.vaultStatus) + 1) % order.length];
        entry.vaultStatus = nextStatus;
        entry.invoice.vaultStatus = nextStatus;
        safeWriteJSON(STORAGE_KEYS.VAULT, state.vault);
        renderVaultAndClients();
      } else if (action === "delete") {
        state.vault.splice(idx, 1);
        safeWriteJSON(STORAGE_KEYS.VAULT, state.vault);
        renderVaultAndClients();
        renderTotalsAndKPIs();
        showToast("Deleted invoice from vault.");
      }
    });

    $("#vault-clients-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-client-action]");
      if (!btn) return;
      const id = btn.dataset.clientId;
      const idx = state.clients.findIndex((c) => c.id === id);
      if (idx === -1) return;

      if (btn.dataset.clientAction === "use") {
        const cl = state.clients[idx];
        state.customer = {
          name: cl.name,
          gstin: cl.gstin || "",
          state: cl.state || "",
          phone: cl.phone || "",
          email: cl.email || "",
          address: cl.address || ""
        };
        hydrateStudioInputs();
        renderAll();
        closeVaultDrawer();
        showToast(`Applied client "${cl.name}".`);
      } else if (btn.dataset.clientAction === "delete") {
        state.clients.splice(idx, 1);
        safeWriteJSON(STORAGE_KEYS.CLIENTS, state.clients);
        renderVaultAndClients();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!$("#sig-backdrop").hidden) SignaturePad.close();
        if (!$("#vault-drawer").hidden) closeVaultDrawer();
        if ($("#workspace-root").classList.contains("is-preview-focus")) togglePreviewFocus(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveCurrentToVault();
      }
    });
  }

  function init() {
    let savedTheme = "material";
    try {
      savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || "material";
    } catch {
      savedTheme = "material";
    }
    applyTheme(savedTheme, false);

    const savedSeller = safeReadJSON(STORAGE_KEYS.SELLER, null);
    if (savedSeller) state.seller = { ...DEFAULT_SELLER, ...savedSeller };

    const savedVault = safeReadJSON(STORAGE_KEYS.VAULT, []);
    if (Array.isArray(savedVault)) state.vault = savedVault;

    const savedClients = safeReadJSON(STORAGE_KEYS.CLIENTS, []);
    if (Array.isArray(savedClients)) state.clients = savedClients;

    const savedCatalog = safeReadJSON(STORAGE_KEYS.CATALOG, null);
    if (Array.isArray(savedCatalog) && savedCatalog.length > 0) state.catalog = savedCatalog;

    const savedDraft = safeReadJSON(STORAGE_KEYS.DRAFT, null);
    if (savedDraft && typeof savedDraft === "object") {
      state.invoice = { ...createDefaultInvoice(), ...(savedDraft.invoice || {}) };
      state.customer = { ...createEmptyCustomer(), ...(savedDraft.customer || {}) };
      if (Array.isArray(savedDraft.items)) state.items = savedDraft.items;
    }

    hydrateStudioInputs();
    renderCatalog();
    renderVaultAndClients();
    updateItemLivePreview();
    renderAll();
    bindEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
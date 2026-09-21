const COST_STORAGE_KEY = "toast-pos-cost-recipes-v1";

export function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function ingredientCost(packPrice, packQuantity, usedQuantity) {
  const price = finiteNonNegative(packPrice);
  const pack = finiteNonNegative(packQuantity);
  const used = finiteNonNegative(usedQuantity);
  return pack > 0 ? (price / pack) * used : 0;
}

export function priceFromMargin(cost, marginPercent) {
  const base = finiteNonNegative(cost);
  const margin = Number(marginPercent);
  if (!Number.isFinite(margin) || margin < 0 || margin >= 100) return null;
  return base / (1 - margin / 100);
}

export function appSalePrice(netAmount, feePercent) {
  const net = finiteNonNegative(netAmount);
  const fee = Number(feePercent);
  if (!Number.isFinite(fee) || fee < 0 || fee >= 100) return null;
  return net / (1 - fee / 100);
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function money(value) {
  return `${finiteNonNegative(value).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} บาท`;
}

function signedMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0.00 บาท";
  const absolute = Math.abs(number).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${number < 0 ? "−" : ""}${absolute} บาท`;
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}

function readRecipes() {
  try {
    const value = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function writeRecipes(recipes) {
  try {
    localStorage.setItem(COST_STORAGE_KEY, JSON.stringify(recipes));
    return true;
  } catch {
    return false;
  }
}

function emptyIngredient() {
  return { id: uid(), name: "", packQuantity: "", unit: "g", packPrice: "", usedQuantity: "" };
}

function emptyExpense() {
  return { id: uid(), name: "", amount: "" };
}

function createInitialState() {
  return {
    editingId: null,
    name: "",
    yieldQuantity: "1",
    yieldUnit: "ชิ้น",
    margin: "40",
    actualPrice: "",
    ingredients: [emptyIngredient()],
    expenses: [emptyExpense()],
    recipes: readRecipes(),
    suggestedPrice: 0,
  };
}

let state = createInitialState();

function totals() {
  const ingredientTotal = state.ingredients.reduce(
    (sum, item) => sum + ingredientCost(item.packPrice, item.packQuantity, item.usedQuantity),
    0,
  );
  const expenseTotal = state.expenses.reduce((sum, item) => sum + finiteNonNegative(item.amount), 0);
  const recipeTotal = ingredientTotal + expenseTotal;
  const yieldQuantity = finiteNonNegative(state.yieldQuantity);
  const unitCost = yieldQuantity > 0 ? recipeTotal / yieldQuantity : 0;
  const suggestedPrice = priceFromMargin(unitCost, state.margin);
  return { ingredientTotal, expenseTotal, recipeTotal, yieldQuantity, unitCost, suggestedPrice };
}

function styles() {
  if (document.getElementById("toast-cost-styles")) return;
  const style = document.createElement("style");
  style.id = "toast-cost-styles";
  style.textContent = `
    #menu-cost[hidden] { display: none !important; }
    .cost-tab-link { white-space: nowrap; }
    .cost-book { --ink:#302820; --muted:#756b60; --line:#ddcfbd; --paper:#fffdf7; --accent:#277354; --accent-soft:#e5f3ea; color:var(--ink); font-family:"Noto Sans Thai","Sarabun",sans-serif; }
    .cost-book * { box-sizing:border-box; }
    .cost-book button,.cost-book input,.cost-book select { font:inherit; }
    .cost-book__header { display:flex; justify-content:space-between; gap:16px; align-items:flex-end; margin-bottom:18px; border-bottom:2px solid var(--ink); padding-bottom:12px; }
    .cost-book__header h2 { margin:0; font-size:clamp(1.35rem,2vw,1.7rem); }
    .cost-book__header p { margin:4px 0 0; color:var(--muted); font-size:.9rem; }
    .cost-switch { display:inline-flex; border:1px solid var(--line); border-radius:12px; padding:4px; background:#f6f0e6; gap:4px; }
    .cost-switch button { border:0; background:transparent; color:var(--muted); min-height:42px; padding:8px 14px; border-radius:9px; cursor:pointer; }
    .cost-switch button[aria-selected="true"] { background:var(--accent); color:#fff; box-shadow:0 2px 8px #1d5f4333; }
    .cost-page { background:var(--paper); border:1px solid var(--line); border-radius:16px; padding:clamp(16px,3vw,30px); box-shadow:0 8px 24px #4a32100d; background-image:linear-gradient(#efe6d9 1px,transparent 1px); background-size:100% 34px; }
    .cost-field { display:grid; gap:6px; }
    .cost-field > span { color:var(--muted); font-size:.9rem; font-weight:600; }
    .cost-input,.cost-select { min-height:44px; width:100%; border:1px solid #cbbba7; border-radius:9px; padding:9px 11px; color:var(--ink); background:#fffefa; }
    .cost-input:focus,.cost-select:focus { outline:3px solid #91cbb4; border-color:var(--accent); }
    .cost-top-fields { display:grid; grid-template-columns:minmax(0,2fr) minmax(160px,1fr); gap:14px; margin-bottom:22px; }
    .cost-yield { display:grid; grid-template-columns:minmax(90px,1fr) minmax(80px,.8fr); gap:8px; }
    .cost-section { margin-top:22px; background:color-mix(in srgb,var(--paper) 92%,#fff); }
    .cost-section__head { display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid var(--line); padding-bottom:9px; margin-bottom:12px; }
    .cost-section__head h3 { margin:0; font-size:1.08rem; }
    .cost-btn { border:1px solid #b8a790; background:#fffefa; color:var(--ink); border-radius:9px; padding:8px 12px; min-height:40px; cursor:pointer; font-weight:600; }
    .cost-btn:hover { border-color:var(--accent); }
    .cost-btn--primary { color:#fff; background:var(--accent); border-color:var(--accent); }
    .cost-btn--danger { color:#9f312d; border-color:#e3b5b0; background:#fff9f8; }
    .cost-btn--text { background:transparent; border-color:transparent; color:var(--muted); }
    .cost-entry { display:grid; grid-template-columns:minmax(130px,1.4fr) minmax(95px,.8fr) minmax(80px,.65fr) minmax(95px,.8fr) minmax(95px,.8fr) auto; gap:9px; align-items:end; padding:12px 0; border-bottom:1px dashed #d7c8b5; }
    .cost-entry--expense { grid-template-columns:minmax(180px,1fr) minmax(120px,.4fr) auto; }
    .cost-entry__result { min-height:44px; display:flex; align-items:center; font-weight:700; color:var(--accent); white-space:nowrap; }
    .cost-remove { width:42px; height:42px; padding:0; display:grid; place-items:center; font-size:1.25rem; }
    .cost-summary { margin-top:26px; padding:18px; border:2px solid var(--ink); border-radius:12px; background:#fffefaed; }
    .cost-summary h3 { margin:0 0 12px; }
    .cost-summary__line { display:flex; justify-content:space-between; gap:20px; padding:5px 0; color:var(--muted); }
    .cost-summary__line strong { color:var(--ink); }
    .cost-summary__total { border-top:1px solid var(--ink); margin-top:8px; padding-top:12px; font-size:1.08rem; color:var(--ink); }
    .cost-price-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:18px; align-items:end; }
    .cost-price-hero { padding:12px 14px; border-radius:10px; background:var(--accent-soft); border-left:4px solid var(--accent); }
    .cost-price-hero span { display:block; color:#476659; font-size:.86rem; }
    .cost-price-hero strong { display:block; color:#185e40; font-size:1.35rem; margin-top:2px; }
    .cost-profit { min-height:22px; margin:8px 0 0; font-size:.88rem; color:var(--muted); }
    .cost-warning { color:#a13932; font-size:.86rem; margin-top:6px; }
    .cost-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:18px; }
    .cost-status { min-height:24px; margin-top:10px; color:var(--accent); font-size:.9rem; }
    .cost-saved { margin-top:22px; }
    .cost-saved summary { cursor:pointer; font-weight:700; padding:10px 0; }
    .cost-recipe { display:grid; grid-template-columns:minmax(140px,1fr) auto auto; gap:10px; align-items:center; border-top:1px solid var(--line); padding:12px 0; }
    .cost-recipe__name { font-weight:700; }
    .cost-recipe__meta { color:var(--muted); font-size:.88rem; }
    .cost-recipe__actions { display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; }
    .cost-recipe__actions .cost-btn { padding:6px 9px; min-height:36px; }
    .cost-empty { color:var(--muted); padding:14px 0; }
    .app-calc { max-width:720px; }
    .app-calc__grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .app-result { margin-top:22px; border:2px solid var(--ink); border-radius:12px; overflow:hidden; background:#fffefa; }
    .app-result__hero { padding:18px; background:var(--accent-soft); text-align:center; }
    .app-result__hero span { display:block; color:#476659; }
    .app-result__hero strong { display:block; color:#185e40; font-size:clamp(1.6rem,4vw,2.3rem); }
    .app-result__rows { padding:12px 18px; }
    .app-result__row { display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px dashed var(--line); }
    .app-result__row:last-child { border-bottom:0; font-weight:700; }
    @media (max-width:900px) {
      .cost-book__header { align-items:stretch; flex-direction:column; }
      .cost-switch { width:100%; }
      .cost-switch button { flex:1; }
      .cost-entry { grid-template-columns:1fr 1fr; }
      .cost-entry .cost-field:first-child { grid-column:1/-1; }
      .cost-entry__result { justify-content:flex-start; }
      .cost-price-grid { grid-template-columns:1fr 1fr; }
      .cost-price-hero { grid-column:1/-1; }
    }
    @media (max-width:600px) {
      .cost-page { padding:14px; border-radius:12px; }
      .cost-top-fields,.app-calc__grid,.cost-price-grid { grid-template-columns:1fr; }
      .cost-entry,.cost-entry--expense { grid-template-columns:1fr 1fr; }
      .cost-entry .cost-field:first-child,.cost-entry--expense .cost-field:first-child { grid-column:1/-1; }
      .cost-entry__result { min-height:32px; }
      .cost-remove { justify-self:end; }
      .cost-recipe { grid-template-columns:1fr; }
      .cost-recipe__actions { justify-content:flex-start; }
      .cost-switch { overflow-x:auto; }
      .cost-switch button { min-width:max-content; }
    }
  `;
  document.head.append(style);
}

function ingredientRow(item) {
  return `
    <div class="cost-entry" data-ingredient-id="${item.id}">
      <label class="cost-field"><span>ชื่อวัตถุดิบ</span><input class="cost-input" data-key="name" value="${escapeHtml(item.name)}" placeholder="เช่น ขนมปัง"></label>
      <label class="cost-field"><span>ปริมาณต่อแพ็ค</span><input class="cost-input" inputmode="decimal" type="number" min="0" step="any" data-key="packQuantity" value="${escapeHtml(item.packQuantity)}" placeholder="1000"></label>
      <label class="cost-field"><span>หน่วย</span><input class="cost-input" data-key="unit" value="${escapeHtml(item.unit)}" placeholder="g"></label>
      <label class="cost-field"><span>ราคา/แพ็ค</span><input class="cost-input" inputmode="decimal" type="number" min="0" step="any" data-key="packPrice" value="${escapeHtml(item.packPrice)}" placeholder="0.00"></label>
      <label class="cost-field"><span>ปริมาณที่ใช้</span><input class="cost-input" inputmode="decimal" type="number" min="0" step="any" data-key="usedQuantity" value="${escapeHtml(item.usedQuantity)}" placeholder="0"></label>
      <div><span class="cost-entry__result">${money(ingredientCost(item.packPrice, item.packQuantity, item.usedQuantity))}</span><button type="button" class="cost-btn cost-btn--danger cost-remove" data-action="remove-ingredient" aria-label="ลบวัตถุดิบ ${escapeHtml(item.name || "รายการนี้")}">×</button></div>
    </div>`;
}

function expenseRow(item) {
  return `
    <div class="cost-entry cost-entry--expense" data-expense-id="${item.id}">
      <label class="cost-field"><span>รายการค่าใช้จ่าย</span><input class="cost-input" data-key="name" value="${escapeHtml(item.name)}" placeholder="เช่น ค่ากล่อง หรือค่าแก๊ส"></label>
      <label class="cost-field"><span>จำนวนเงิน/สูตร</span><input class="cost-input" inputmode="decimal" type="number" min="0" step="any" data-key="amount" value="${escapeHtml(item.amount)}" placeholder="0.00"></label>
      <button type="button" class="cost-btn cost-btn--danger cost-remove" data-action="remove-expense" aria-label="ลบค่าใช้จ่าย ${escapeHtml(item.name || "รายการนี้")}">×</button>
    </div>`;
}

function summaryLines() {
  const ingredients = state.ingredients
    .filter((item) => item.name || finiteNonNegative(item.packPrice) || finiteNonNegative(item.usedQuantity))
    .map((item) => `<div class="cost-summary__line"><span>${escapeHtml(item.name || "วัตถุดิบไม่ระบุชื่อ")}</span><span>${money(ingredientCost(item.packPrice, item.packQuantity, item.usedQuantity))}</span></div>`)
    .join("");
  const expenses = state.expenses
    .filter((item) => item.name || finiteNonNegative(item.amount))
    .map((item) => `<div class="cost-summary__line"><span>${escapeHtml(item.name || "ค่าใช้จ่ายไม่ระบุชื่อ")}</span><span>${money(item.amount)}</span></div>`)
    .join("");
  return ingredients + expenses || `<div class="cost-empty">เริ่มกรอกวัตถุดิบเพื่อดูสรุปต้นทุน</div>`;
}

function recipesHtml() {
  if (!state.recipes.length) return `<div class="cost-empty">ยังไม่มีสูตรที่บันทึกไว้</div>`;
  return state.recipes.map((recipe) => `
    <article class="cost-recipe" data-recipe-id="${recipe.id}">
      <div><div class="cost-recipe__name">${escapeHtml(recipe.name || "สูตรไม่มีชื่อ")}</div><div class="cost-recipe__meta">ทุน ${money(recipe.unitCost)} · ขายแนะนำ ${money(recipe.suggestedPrice)}</div></div>
      <div class="cost-recipe__meta">${escapeHtml(recipe.yieldQuantity || 1)} ${escapeHtml(recipe.yieldUnit || "ชิ้น")}/สูตร</div>
      <div class="cost-recipe__actions">
        <button type="button" class="cost-btn" data-action="edit-recipe">แก้ไข</button>
        <button type="button" class="cost-btn" data-action="duplicate-recipe">ทำสำเนา</button>
        <button type="button" class="cost-btn cost-btn--danger" data-action="delete-recipe">ลบ</button>
      </div>
    </article>`).join("");
}

function mainPanelHtml() {
  const total = totals();
  state.suggestedPrice = total.suggestedPrice ?? 0;
  const actual = finiteNonNegative(state.actualPrice);
  const profit = actual - total.unitCost;
  const profitPercent = actual > 0 ? (profit / actual) * 100 : 0;
  const invalidMargin = total.suggestedPrice === null;
  return `
    <div class="cost-top-fields">
      <label class="cost-field"><span>ชื่อเมนู / สูตร</span><input id="cost-name" class="cost-input" value="${escapeHtml(state.name)}" placeholder="เช่น ฮันนี่โทสต์"></label>
      <label class="cost-field"><span>สูตรนี้ทำได้</span><span class="cost-yield"><input id="cost-yield" class="cost-input" inputmode="decimal" type="number" min="0" step="any" value="${escapeHtml(state.yieldQuantity)}"><input id="cost-yield-unit" class="cost-input" value="${escapeHtml(state.yieldUnit)}" placeholder="ชิ้น"></span></label>
    </div>
    <section class="cost-section">
      <div class="cost-section__head"><h3>วัตถุดิบ</h3><button type="button" class="cost-btn" data-action="add-ingredient">＋ เพิ่มวัตถุดิบ</button></div>
      <div id="cost-ingredients">${state.ingredients.map(ingredientRow).join("")}</div>
    </section>
    <section class="cost-section">
      <div class="cost-section__head"><h3>ค่าใช้จ่ายอื่น</h3><button type="button" class="cost-btn" data-action="add-expense">＋ เพิ่มค่าใช้จ่าย</button></div>
      <div id="cost-expenses">${state.expenses.map(expenseRow).join("")}</div>
    </section>
    <section class="cost-summary" aria-live="polite">
      <h3>สรุปต้นทุน</h3>
      ${summaryLines()}
      <div class="cost-summary__line cost-summary__total"><strong>ต้นทุนทั้งสูตร</strong><strong>${money(total.recipeTotal)}</strong></div>
      <div class="cost-summary__line"><strong>ต้นทุนต่อ ${escapeHtml(state.yieldUnit || "หน่วย")}</strong><strong>${total.yieldQuantity > 0 ? money(total.unitCost) : "—"}</strong></div>
      ${total.yieldQuantity > 0 ? "" : `<div class="cost-warning">จำนวนที่สูตรทำได้ต้องมากกว่า 0</div>`}
      <div class="cost-price-grid">
        <label class="cost-field"><span>กำไรที่ต้องการ (Margin %)</span><input id="cost-margin" class="cost-input" type="number" min="0" max="99.99" step="any" value="${escapeHtml(state.margin)}"></label>
        <label class="cost-field"><span>ราคาขายจริง</span><input id="cost-actual-price" class="cost-input" type="number" min="0" step="any" value="${escapeHtml(state.actualPrice)}" placeholder="0.00"><span class="cost-profit">${actual > 0 ? `${profit >= 0 ? "กำไร" : "ขาดทุน"} ${signedMoney(profit)} (${profitPercent.toFixed(2)}%)` : "กรอกเพื่อดูกำไรจริง"}</span></label>
        <div class="cost-price-hero"><span>ราคาขายแนะนำ</span><strong>${!invalidMargin && total.yieldQuantity > 0 ? money(total.suggestedPrice) : "—"}</strong>${invalidMargin ? `<div class="cost-warning">เปอร์เซ็นต์ต้องอยู่ระหว่าง 0–99.99</div>` : ""}</div>
      </div>
      <div class="cost-actions"><button type="button" class="cost-btn cost-btn--primary" data-action="save-recipe">${state.editingId ? "บันทึกการแก้ไข" : "บันทึกสูตรนี้"}</button><button type="button" class="cost-btn cost-btn--text" data-action="reset-form">ล้างฟอร์ม</button></div>
      <div id="cost-status" class="cost-status" role="status"></div>
    </section>
    <details class="cost-saved" ${state.recipes.length ? "" : "open"}><summary>สูตรที่บันทึกไว้ (${state.recipes.length})</summary><div id="cost-recipes">${recipesHtml()}</div></details>`;
}

function appPanelHtml() {
  return `
    <div class="app-calc">
      <div class="app-calc__grid">
        <label class="cost-field"><span>ราคาที่ต้องการได้รับสุทธิ</span><input id="app-net" class="cost-input" type="number" min="0" step="any" inputmode="decimal" placeholder="0.00"></label>
        <label class="cost-field"><span>แพลตฟอร์มหักค่าธรรมเนียม (%)</span><input id="app-fee" class="cost-input" type="number" min="0" max="99.99" step="any" inputmode="decimal" value="30"></label>
      </div>
      <div class="cost-actions"><button type="button" class="cost-btn" data-action="use-suggested">ใช้ราคาขายแนะนำ ${money(state.suggestedPrice)}</button></div>
      <div id="app-result" class="app-result" aria-live="polite"></div>
    </div>`;
}

function renderCostPage(panel, activeView = panel.dataset.activeView || "cost") {
  panel.dataset.activeView = activeView;
  panel.innerHTML = `
    <div class="cost-book">
      <div class="cost-book__header"><div><h2>คำนวณทุน</h2><p>สมุดต้นทุนและตั้งราคาขายของร้าน</p></div>
        <div class="cost-switch" role="tablist" aria-label="เครื่องมือคำนวณทุน">
          <button type="button" role="tab" data-view="cost" aria-selected="${activeView === "cost"}">คำนวณต้นทุน & ตั้งราคา</button>
          <button type="button" role="tab" data-view="app" aria-selected="${activeView === "app"}">ราคาขายบนแอป</button>
        </div>
      </div>
      <div class="cost-page">${activeView === "cost" ? mainPanelHtml() : appPanelHtml()}</div>
    </div>`;
  if (activeView === "app") updateAppResult(panel);
}

function updateStateFromInput(input) {
  if (input.id === "cost-name") state.name = input.value;
  if (input.id === "cost-yield") state.yieldQuantity = input.value;
  if (input.id === "cost-yield-unit") state.yieldUnit = input.value;
  if (input.id === "cost-margin") state.margin = input.value;
  if (input.id === "cost-actual-price") state.actualPrice = input.value;
  const ingredient = input.closest("[data-ingredient-id]");
  if (ingredient) {
    const item = state.ingredients.find((entry) => entry.id === ingredient.dataset.ingredientId);
    if (item) item[input.dataset.key] = input.value;
  }
  const expense = input.closest("[data-expense-id]");
  if (expense) {
    const item = state.expenses.find((entry) => entry.id === expense.dataset.expenseId);
    if (item) item[input.dataset.key] = input.value;
  }
}

function resetForm(panel) {
  const recipes = state.recipes;
  state = createInitialState();
  state.recipes = recipes;
  renderCostPage(panel, "cost");
}

function saveRecipe(panel) {
  const total = totals();
  const name = state.name.trim();
  if (!name) return setStatus(panel, "กรุณากรอกชื่อเมนูหรือชื่อสูตร", true);
  if (total.yieldQuantity <= 0) return setStatus(panel, "จำนวนที่สูตรทำได้ต้องมากกว่า 0", true);
  if (total.suggestedPrice === null) return setStatus(panel, "เปอร์เซ็นต์กำไรต้องน้อยกว่า 100", true);
  const record = {
    id: state.editingId || uid(), name, yieldQuantity: state.yieldQuantity, yieldUnit: state.yieldUnit,
    margin: state.margin, actualPrice: state.actualPrice,
    ingredients: state.ingredients.map((item) => ({ ...item })), expenses: state.expenses.map((item) => ({ ...item })),
    recipeTotal: total.recipeTotal, unitCost: total.unitCost, suggestedPrice: total.suggestedPrice,
    updatedAt: new Date().toISOString(),
  };
  const index = state.recipes.findIndex((item) => item.id === record.id);
  if (index >= 0) state.recipes[index] = record;
  else state.recipes.unshift(record);
  if (!writeRecipes(state.recipes)) return setStatus(panel, "เบราว์เซอร์ไม่อนุญาตให้บันทึกข้อมูลในเครื่อง", true);
  state.editingId = record.id;
  renderCostPage(panel, "cost");
  setStatus(panel, "บันทึกสูตรแล้ว");
}

function loadRecipe(panel, recipe, duplicate = false) {
  state = {
    ...state,
    editingId: duplicate ? null : recipe.id,
    name: duplicate ? `${recipe.name} (สำเนา)` : recipe.name,
    yieldQuantity: String(recipe.yieldQuantity ?? 1), yieldUnit: recipe.yieldUnit || "ชิ้น",
    margin: String(recipe.margin ?? 40), actualPrice: String(recipe.actualPrice ?? ""),
    ingredients: (recipe.ingredients || []).map((item) => ({ ...item, id: uid() })),
    expenses: (recipe.expenses || []).map((item) => ({ ...item, id: uid() })),
  };
  if (!state.ingredients.length) state.ingredients = [emptyIngredient()];
  if (!state.expenses.length) state.expenses = [emptyExpense()];
  renderCostPage(panel, "cost");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setStatus(panel, message, isError = false) {
  const status = panel.querySelector("#cost-status");
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "#a13932" : "";
}

function updateAppResult(panel) {
  const net = panel.querySelector("#app-net");
  const feeInput = panel.querySelector("#app-fee");
  const result = panel.querySelector("#app-result");
  if (!net || !feeInput || !result) return;
  const sale = appSalePrice(net.value, feeInput.value);
  if (sale === null) {
    result.innerHTML = `<div class="cost-warning" style="padding:16px">เปอร์เซ็นต์ค่าธรรมเนียมต้องอยู่ระหว่าง 0–99.99</div>`;
    return;
  }
  const fee = sale - finiteNonNegative(net.value);
  result.innerHTML = `<div class="app-result__hero"><span>ควรตั้งขายในแอป</span><strong>${money(sale)}</strong></div><div class="app-result__rows"><div class="app-result__row"><span>ลูกค้าจ่าย</span><span>${money(sale)}</span></div><div class="app-result__row"><span>ค่าธรรมเนียม</span><span>−${money(fee)}</span></div><div class="app-result__row"><span>คุณได้รับ</span><span>${money(net.value)}</span></div></div>`;
}

function bindPanel(panel) {
  if (panel.dataset.costBound) return;
  panel.dataset.costBound = "true";
  panel.addEventListener("input", (event) => {
    const input = event.target.closest("input,select");
    if (!input) return;
    if (input.id === "app-net" || input.id === "app-fee") return updateAppResult(panel);
    updateStateFromInput(input);
    const isTextEntry = input.type !== "number" && input.id !== "cost-yield";
    if (isTextEntry || event.isComposing) return;
    const selection = { id: input.id, ingredient: input.closest("[data-ingredient-id]")?.dataset.ingredientId, expense: input.closest("[data-expense-id]")?.dataset.expenseId, key: input.dataset.key };
    renderCostPage(panel, "cost");
    const selector = selection.id ? `#${CSS.escape(selection.id)}` : selection.ingredient ? `[data-ingredient-id="${selection.ingredient}"] [data-key="${selection.key}"]` : selection.expense ? `[data-expense-id="${selection.expense}"] [data-key="${selection.key}"]` : null;
    const restored = selector ? panel.querySelector(selector) : null;
    if (restored) { restored.focus({ preventScroll: true }); restored.setSelectionRange?.(restored.value.length, restored.value.length); }
  });
  panel.addEventListener("change", (event) => {
    const input = event.target.closest("input,select");
    if (!input || input.id === "app-net" || input.id === "app-fee" || input.type === "number") return;
    updateStateFromInput(input);
    renderCostPage(panel, "cost");
  });
  panel.addEventListener("click", (event) => {
    const view = event.target.closest("[data-view]");
    if (view) return renderCostPage(panel, view.dataset.view);
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "add-ingredient") { state.ingredients.push(emptyIngredient()); renderCostPage(panel, "cost"); }
    if (action === "add-expense") { state.expenses.push(emptyExpense()); renderCostPage(panel, "cost"); }
    if (action === "remove-ingredient") { const id = button.closest("[data-ingredient-id]").dataset.ingredientId; state.ingredients = state.ingredients.filter((item) => item.id !== id); if (!state.ingredients.length) state.ingredients.push(emptyIngredient()); renderCostPage(panel, "cost"); }
    if (action === "remove-expense") { const id = button.closest("[data-expense-id]").dataset.expenseId; state.expenses = state.expenses.filter((item) => item.id !== id); if (!state.expenses.length) state.expenses.push(emptyExpense()); renderCostPage(panel, "cost"); }
    if (action === "reset-form") resetForm(panel);
    if (action === "save-recipe") saveRecipe(panel);
    if (action === "use-suggested") { const net = panel.querySelector("#app-net"); if (net) { net.value = state.suggestedPrice ? state.suggestedPrice.toFixed(2) : ""; updateAppResult(panel); } }
    const recipeNode = button.closest("[data-recipe-id]");
    const recipe = recipeNode ? state.recipes.find((item) => item.id === recipeNode.dataset.recipeId) : null;
    if (action === "edit-recipe" && recipe) loadRecipe(panel, recipe);
    if (action === "duplicate-recipe" && recipe) loadRecipe(panel, recipe, true);
    if (action === "delete-recipe" && recipe && confirm(`ลบสูตร “${recipe.name}” ใช่หรือไม่?`)) { state.recipes = state.recipes.filter((item) => item.id !== recipe.id); writeRecipes(state.recipes); if (state.editingId === recipe.id) state.editingId = null; renderCostPage(panel, "cost"); }
  });
}

function enhanceCostCalculator() {
  const nav = document.querySelector("nav[aria-label='ทางลัดหน้าจัดการเมนู']");
  const root = nav?.closest("section");
  if (!nav || !root) return;
  styles();
  if (!nav.querySelector('a[href="#menu-cost"]')) {
    const link = document.createElement("a");
    link.href = "#menu-cost";
    link.className = "cost-tab-link";
    link.textContent = "คำนวณทุน";
    nav.append(link);
  }
  let panel = root.querySelector("#menu-cost");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "menu-cost";
    panel.className = "menu-ux-panel";
    panel.hidden = true;
    root.append(panel);
    renderCostPage(panel, "cost");
    bindPanel(panel);
  }
}

if (typeof document !== "undefined") {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; enhanceCostCalculator(); });
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}

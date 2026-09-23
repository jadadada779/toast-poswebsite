const API = "/api/advanced-promotions";
const categoryLabels = { shop: "เมนูร้าน", custom: "เมนู Custom", other: "เครื่องดื่ม" };
const categoryIcons = {
  shop: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16l-1-5H5l-1 5Zm2 0v9h12v-9M9 19v-5h6v5"/></svg>`,
  custom: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6"/></svg>`,
  other: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h11l-1 12H7L6 7Zm2-3 7 3M17 9h2a2 2 0 0 1 0 4h-2"/></svg>`
};
const tagIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 8-8h7v7l-8 8-7-7Zm11-4h.01"/></svg>`;
let store = { rules: [], menus: [], toppings: [] };
let editingRule = null;
let currentStep = 1;

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function blankRule() {
  return {
    name: "", enabled: true, minSpend: 50,
    conditionMode: "spend", conditionMenuIds: [], conditionToppingIds: [], conditionMinQuantity: 1,
    conditionCategories: ["other"], conditionExcludedMenuIds: [],
    targetMode: "categories", targetMenuIds: [], targetToppingIds: [], applicationMode: "once",
    targetCategories: ["other"], targetExcludedMenuIds: [],
    discountType: "fixed", discountValue: 10, maxDiscount: null,
    stackable: true, priority: 100
  };
}

function categoryCards(name, selected = []) {
  return Object.entries(categoryLabels).map(([value, label]) => `
    <label class="ap-category ${selected.includes(value) ? "is-selected" : ""}">
      <input type="checkbox" name="${name}" value="${value}" ${selected.includes(value) ? "checked" : ""}>
      <span class="ap-category-icon">${categoryIcons[value]}</span>
      <span><strong>${label}</strong><small>${value === "custom" ? "ขนมปังและท็อปปิ้งที่จัดเอง" : value === "other" ? "ชา กาแฟ และเครื่องดื่ม" : "สินค้าหมวดร้าน"}</small></span>
      <span class="ap-tick">✓</span>
    </label>`).join("");
}

function menuSelector(name, selected = [], searchId, hint = "เลือกเมนู") {
  if (!store.menus.length) return `<div class="ap-no-menu">ยังไม่มีเมนูสำหรับเลือก</div>`;
  return `
    <div class="ap-menu-tools"><span>${hint}</span><input id="${searchId}" class="ap-search" type="search" placeholder="ค้นหาชื่อเมนู"></div>
    <div class="ap-menu-list" data-menu-list="${searchId}">
      ${store.menus.map((menu) => `
        <label class="ap-menu-item" data-search="${escapeHtml(menu.name.toLowerCase())}">
          <input type="checkbox" name="${name}" value="${menu.id}" ${selected.includes(Number(menu.id)) ? "checked" : ""}>
          <span class="ap-menu-check">✓</span><span class="ap-menu-name">${escapeHtml(menu.name)}<small>${categoryLabels[menu.category] ?? menu.category}</small></span><strong>฿${menu.price}</strong>
        </label>`).join("")}
    </div>`;
}

function toppingSelector(name, selected = [], searchId, hint = "เลือกท็อปปิ้ง") {
  if (!store.toppings.length) return `<div class="ap-no-menu">ยังไม่มีท็อปปิ้งสำหรับเลือก</div>`;
  return `
    <div class="ap-menu-tools"><span>${hint}</span><input id="${searchId}" class="ap-search" type="search" placeholder="ค้นหาท็อปปิ้ง"></div>
    <div class="ap-menu-list" data-menu-list="${searchId}">
      ${store.toppings.map((topping) => `
        <label class="ap-menu-item" data-search="${escapeHtml(topping.name.toLowerCase())}">
          <input type="checkbox" name="${name}" value="${topping.id}" ${selected.includes(Number(topping.id)) ? "checked" : ""}>
          <span class="ap-menu-check">✓</span><span class="ap-menu-name">${escapeHtml(topping.name)}<small>ท็อปปิ้ง</small></span><strong>฿${topping.price}</strong>
        </label>`).join("")}
    </div>`;
}

function categoryText(values) {
  return values?.length ? values.map((value) => categoryLabels[value] ?? value).join(" + ") : "ทุกหมวด";
}

function ruleDescription(rule) {
  const discount = rule.discountType === "percent"
    ? `${rule.discountValue}%${rule.maxDiscount != null ? ` สูงสุด ฿${rule.maxDiscount}` : ""}`
    : `฿${rule.discountValue}`;
  const itemNames = (values, source) => (values || []).map((id) => source.find((item) => Number(item.id) === Number(id))?.name).filter(Boolean).join(", ");
  const condition = rule.conditionMode === "menu"
    ? `ซื้อ ${itemNames(rule.conditionMenuIds, store.menus) || "เมนูที่กำหนด"} ครบ ${rule.conditionMinQuantity || 1} รายการ`
    : rule.conditionMode === "topping"
      ? `ซื้อท็อปปิ้ง ${itemNames(rule.conditionToppingIds, store.toppings) || "ที่กำหนด"} ครบ ${rule.conditionMinQuantity || 1} รายการ`
      : `${categoryText(rule.conditionCategories)} ครบ ฿${rule.minSpend}`;
  const target = rule.targetMode === "menu"
    ? itemNames(rule.targetMenuIds, store.menus) || "เมนูที่เลือก"
    : rule.targetMode === "topping_all"
      ? "ท็อปปิ้งทั้งหมด"
      : rule.targetMode === "topping_selected"
        ? `ท็อปปิ้ง ${itemNames(rule.targetToppingIds, store.toppings) || "ที่เข้าร่วม"}`
        : categoryText(rule.targetCategories);
  const application = String(rule.targetMode || "").startsWith("topping_") ? (rule.applicationMode === "each" ? " ทุกรายการที่เข้าเงื่อนไข" : " 1 รายการราคาต่ำสุด") : "";
  return `${condition} → ลด ${target} ${discount}${application}`;
}

function showNotice(message, type = "success") {
  document.querySelector(".ap-notice")?.remove();
  const notice = document.createElement("div");
  notice.className = `ap-notice ${type}`;
  notice.textContent = `${type === "success" ? "✓" : "!"} ${message}`;
  document.body.appendChild(notice);
  setTimeout(() => notice.remove(), 2600);
}

function renderPanel(panel) {
  const activeCount = store.rules.filter((rule) => rule.enabled).length;
  panel.innerHTML = `
    <div class="ap-toolbar">
      <div class="ap-toolbar-copy">
        <span class="ap-toolbar-icon" aria-hidden="true">${tagIcon}</span>
        <div><h2>โปรโมชั่น</h2><p><strong>${activeCount}</strong> เปิดใช้งาน จากทั้งหมด <strong>${store.rules.length}</strong> รายการ</p></div>
      </div>
      <button class="ap-main-button" data-action="new"><span class="ap-add-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span> เพิ่มโปรโมชั่น</button>
    </div>
    <div class="ap-section-head"><div><h3>รายการโปรโมชั่น</h3><p>เปิด–ปิด แก้ไข หรือตรวจเงื่อนไขได้จากการ์ดแต่ละรายการ</p></div></div>
    <div class="ap-rule-grid">
      ${store.rules.length ? store.rules.map(ruleCard).join("") : `
        <button class="ap-empty" data-action="new"><span>＋</span><strong>ยังไม่มีโปรโมชั่น</strong><small>กดเพื่อสร้างโปรโมชั่นแรก</small></button>`}
    </div>
    <div class="ap-modal-slot"></div>`;
  bindPanelActions(panel);
  if (editingRule) renderWizard(panel.querySelector(".ap-modal-slot"), editingRule);
}

function ruleCard(rule) {
  const exclusions = new Set([...rule.conditionExcludedMenuIds, ...rule.targetExcludedMenuIds]).size;
  const conditionLabel = rule.conditionMode === "menu" ? `ซื้อเมนู ${rule.conditionMinQuantity || 1} รายการ` : rule.conditionMode === "topping" ? `ซื้อท็อปปิ้ง ${rule.conditionMinQuantity || 1} รายการ` : `ครบ ฿${rule.minSpend}`;
  const targetLabel = String(rule.targetMode || "").startsWith("topping_") ? "ท็อปปิ้ง" : rule.targetMode === "menu" ? "เมนูที่เลือก" : "ส่วนลด";
  return `
    <article class="ap-rule-card ${rule.enabled ? "" : "is-disabled"}">
      <div class="ap-rule-top"><span class="ap-status ${rule.enabled ? "on" : "off"}"><i></i>${rule.enabled ? "เปิดใช้งาน" : "ปิดอยู่"}</span><span class="ap-priority">ลำดับ ${rule.priority}</span></div>
      <h4>${escapeHtml(rule.name)}</h4>
      <div class="ap-rule-flow"><span class="ap-flow-icon">${categoryIcons[rule.conditionCategories?.[0]] ?? categoryIcons.custom}</span><b>${conditionLabel}</b><em>→</em><span class="ap-flow-icon">${tagIcon}</span><b>${targetLabel} ${rule.discountType === "percent" ? `${rule.discountValue}%` : `฿${rule.discountValue}`}</b></div>
      <p>${escapeHtml(ruleDescription(rule))}</p>
      <div class="ap-rule-meta"><span>${exclusions ? `⊘ ยกเว้น ${exclusions} เมนู` : "✓ ไม่มีเมนูยกเว้น"}</span><span>${rule.stackable ? "＋ ใช้ร่วมกับโปรอื่นได้" : "▣ ใช้โปรนี้โปรเดียว"}</span></div>
      <div class="ap-rule-actions"><button data-action="toggle" data-id="${rule.id}">${rule.enabled ? "ปิดชั่วคราว" : "เปิดใช้งาน"}</button><button class="primary" data-action="edit" data-id="${rule.id}">แก้ไข</button><button class="danger" title="ลบ" data-action="delete" data-id="${rule.id}">⌫</button></div>
    </article>`;
}

function bindPanelActions(panel) {
  panel.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => runAction(button.dataset.action, Number(button.dataset.id))));
}


function renderWizard(host, rule) {
  currentStep = 1;
  const scope = (title, prefix, categories, excluded, explanation) => `
    <section class="ap-scope"><h4>${title}</h4><p>${explanation}</p>
      <div class="ap-category-grid">${categoryCards(prefix + "Categories", categories)}</div>
      <details class="ap-exclude" ${excluded.length ? "open" : ""}><summary><div><strong>${prefix === "condition" ? "ยกเว้นเมนูออกจากยอดขั้นต่ำ" : "ยกเว้นเมนูไม่ให้ได้รับส่วนลด"}</strong></div><b class="ap-count">${excluded.length}</b><i>⌄</i></summary>${menuSelector(prefix + "ExcludedMenuIds", excluded, prefix + "-search", "เลือกรายการที่ต้องการยกเว้น")}</details>
    </section>`;
  const modeOption = (value, current, label) => `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`;
  host.innerHTML = `<div class="ap-overlay ap-single" role="dialog" aria-modal="true" aria-labelledby="ap-editor-title">
    <form class="ap-wizard">
      <header class="ap-wizard-head"><div><span>จัดการโปรโมชั่น</span><h3 id="ap-editor-title">${rule.id ? "แก้ไขโปรโมชั่น" : "เพิ่มโปรโมชั่น"}</h3></div><button type="button" class="ap-close" data-close aria-label="ปิด">×</button></header>
      <main class="ap-wizard-body">
        <label class="ap-field"><span>ชื่อโปรโมชั่น *</span><input name="name" required maxlength="160" value="${escapeHtml(rule.name)}" placeholder="เช่น เครื่องดื่มครบ 50 ลด 10"></label>
        <div class="ap-overview"><label class="ap-field"><span>ลำดับการคำนวณโปรโมชั่น</span><input type="number" name="priority" min="1" max="9999" step="1" required value="${rule.priority}"><small>เลขน้อยจะถูกตรวจและคำนวณก่อน</small></label>
        <div class="ap-setting-list"><label><span class="ap-toggle"><input type="checkbox" name="enabled" ${rule.enabled ? "checked" : ""}><i></i></span><div><strong>เปิดใช้งาน</strong></div></label><label><span class="ap-toggle"><input type="checkbox" name="stackable" ${rule.stackable ? "checked" : ""}><i></i></span><div><strong>ใช้ร่วมกับโปรถัดไปได้</strong><small>หากปิด จะหยุดโปรลำดับถัดไปเมื่อโปรนี้ทำงาน</small></div></label></div></div>
        <section class="ap-mode-box"><h4>1. เงื่อนไขที่ทำให้โปรทำงาน</h4>
          <label class="ap-field"><span>ประเภทเงื่อนไข</span><select name="conditionMode">${modeOption("spend", rule.conditionMode || "spend", "ซื้อครบยอด")}${modeOption("menu", rule.conditionMode, "ซื้อเมนูที่กำหนด")}${modeOption("topping", rule.conditionMode, "ซื้อท็อปปิ้งที่กำหนด")}</select></label>
          <div data-condition-panel="spend"> <label class="ap-field"><span>ยอดขั้นต่ำ (บาท)</span><input type="number" name="minSpend" min="0" step="1" required value="${rule.minSpend}"></label>${scope("หมวดที่ใช้คำนวณยอดขั้นต่ำ", "condition", rule.conditionCategories, rule.conditionExcludedMenuIds, "รวมราคาสินค้าในหมวดที่เลือกเพื่อตรวจยอดขั้นต่ำ")}</div>
          <div data-condition-panel="menu">${menuSelector("conditionMenuIds", rule.conditionMenuIds || [], "condition-menu-search", "เลือกเมนูที่ทำให้โปรทำงาน")}</div>
          <div data-condition-panel="topping">${toppingSelector("conditionToppingIds", rule.conditionToppingIds || [], "condition-topping-search", "เลือกท็อปปิ้งที่ทำให้โปรทำงาน")}</div>
          <label class="ap-field" data-condition-quantity><span>จำนวนขั้นต่ำ</span><input type="number" name="conditionMinQuantity" min="1" max="999" step="1" value="${rule.conditionMinQuantity || 1}"><small>นับรวมตามจำนวนสินค้าในออเดอร์</small></label>
        </section>
        <section class="ap-mode-box"><h4>2. สินค้าที่ได้รับส่วนลด</h4>
          <label class="ap-field"><span>ขอบเขตส่วนลด</span><select name="targetMode">${modeOption("categories", rule.targetMode || "categories", "ลดตามหมวดสินค้า")}${modeOption("menu", rule.targetMode, "ลดเฉพาะเมนูที่เลือก")}${modeOption("topping_all", rule.targetMode, "ลดท็อปปิ้งทั้งหมด")}${modeOption("topping_selected", rule.targetMode, "ลดเฉพาะท็อปปิ้งที่เข้าร่วม")}</select></label>
          <div data-target-panel="categories">${scope("หมวดที่ได้รับส่วนลด", "target", rule.targetCategories, rule.targetExcludedMenuIds, "หักส่วนลดเฉพาะสินค้าในหมวดที่เลือก")}</div>
          <div data-target-panel="menu">${menuSelector("targetMenuIds", rule.targetMenuIds || [], "target-menu-search", "เลือกเมนูที่ได้รับส่วนลด")}</div>
          <div data-target-panel="topping_all" class="ap-mode-note">ท็อปปิ้งทุกชนิดในออเดอร์สามารถได้รับส่วนลด</div>
          <div data-target-panel="topping_selected">${toppingSelector("targetToppingIds", rule.targetToppingIds || [], "target-topping-search", "เลือกท็อปปิ้งที่เข้าร่วมโปรโมชั่น")}</div>
          <label class="ap-field" data-topping-application><span>ใช้ส่วนลดกับท็อปปิ้ง</span><select name="applicationMode">${modeOption("once", rule.applicationMode || "once", "1 รายการราคาต่ำสุด")}${modeOption("each", rule.applicationMode, "ทุกรายการที่เข้าเงื่อนไข")}</select><small>แบบทุกรายการ: ส่วนลดจำนวนเงินจะคิดต่อท็อปปิ้งแต่ละรายการ</small></label>
        </section>
        <section class="ap-discount-box"><h4>รูปแบบส่วนลด</h4><div class="ap-discount-grid"><div><span class="ap-label">เลือกวิธีลดราคา</span><div class="ap-segment"><label class="${rule.discountType === "fixed" ? "selected" : ""}"><input type="radio" name="discountType" value="fixed" ${rule.discountType === "fixed" ? "checked" : ""}>ลดเป็นบาท</label><label class="${rule.discountType === "percent" ? "selected" : ""}"><input type="radio" name="discountType" value="percent" ${rule.discountType === "percent" ? "checked" : ""}>ลดเป็นเปอร์เซ็นต์</label></div></div>
        <label class="ap-field"><span>จำนวนส่วนลด *</span><div class="ap-input-addon"><input type="number" name="discountValue" min="1" step="1" ${rule.discountType === "percent" ? 'max="100"' : ''} required value="${rule.discountValue}"><i data-discount-unit>${rule.discountType === "fixed" ? "บาท" : "%"}</i></div></label>
        <label class="ap-field ap-max-field"><span>ส่วนลดสูงสุด (เว้นว่างได้)</span><div class="ap-input-addon"><input type="number" name="maxDiscount" min="0" step="1" value="${rule.maxDiscount ?? ""}" placeholder="ไม่จำกัด"><i>บาท</i></div></label></div></section>
        <p class="ap-scope-note">หากไม่เลือกหมวด จะใช้ทุกหมวด รายการยกเว้นฝั่งซ้ายจะไม่นับยอด ส่วนฝั่งขวาจะไม่ได้รับส่วนลด</p>
        <div class="ap-summary"><div><small>สรุปโปรโมชั่น</small><h4 data-summary-title></h4><p data-summary-detail></p></div></div>
      </main><footer class="ap-wizard-foot"><button type="button" class="ap-secondary" data-back>ยกเลิก</button><button type="submit" class="ap-save">บันทึกโปรโมชั่น</button></footer>
    </form></div>`;
  bindWizard(host);
  updateLiveSummary(host.querySelector("form"));
}

function bindWizard(host) {
  const form = host.querySelector("form");
  host.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeWizard));
  host.querySelector(".ap-overlay").addEventListener("click", (event) => { if (event.target.classList.contains("ap-overlay")) closeWizard(); });
  host.querySelectorAll("[data-go-step]").forEach((button) => button.addEventListener("click", () => goStep(Number(button.dataset.goStep), form)));
  host.querySelector("[data-next]")?.addEventListener("click", () => {
    if (currentStep === 1 && !form.querySelector('[name="name"]').value.trim()) { form.querySelector('[name="name"]').reportValidity(); return; }
    goStep(currentStep + 1, form);
  });
  host.querySelector("[data-back]").addEventListener("click", () => currentStep === 1 ? closeWizard() : goStep(currentStep - 1, form));
  host.querySelectorAll(".ap-category input").forEach((input) => input.addEventListener("change", () => { input.closest(".ap-category").classList.toggle("is-selected", input.checked); updateLiveSummary(form); }));
  host.querySelectorAll(".ap-menu-item input").forEach((input) => input.addEventListener("change", () => { updateCounts(form); updateLiveSummary(form); }));
  host.querySelectorAll('[name="discountType"]').forEach((input) => input.addEventListener("change", () => {
    form.querySelectorAll(".ap-segment label").forEach((label) => label.classList.toggle("selected", label.contains(input) && input.checked));
    form.querySelector("[data-discount-unit]").textContent = input.value === "fixed" ? "บาท" : "%";
    const amountInput = form.querySelector('[name="discountValue"]');
    if (input.value === "percent") amountInput.max = "100"; else amountInput.removeAttribute("max");
    form.querySelector(".ap-max-field").classList.toggle("is-muted", input.value !== "percent"); updateLiveSummary(form);
  }));
  host.querySelectorAll("input").forEach((input) => input.addEventListener("input", () => updateLiveSummary(form)));
  host.querySelectorAll("select").forEach((select) => select.addEventListener("change", () => { syncModePanels(form); updateLiveSummary(form); }));
  host.querySelectorAll(".ap-search").forEach((input) => input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    host.querySelectorAll(`[data-menu-list="${input.id}"] .ap-menu-item`).forEach((item) => item.hidden = !item.dataset.search.includes(query));
  }));
  syncModePanels(form);
  form.addEventListener("submit", saveRule);
}

function syncModePanels(form) {
  const conditionMode = form.elements.conditionMode?.value || "spend";
  const targetMode = form.elements.targetMode?.value || "categories";
  form.querySelectorAll("[data-condition-panel]").forEach((panel) => panel.hidden = panel.dataset.conditionPanel !== conditionMode);
  form.querySelectorAll("[data-target-panel]").forEach((panel) => panel.hidden = panel.dataset.targetPanel !== targetMode);
  const quantity = form.querySelector("[data-condition-quantity]");
  if (quantity) quantity.hidden = conditionMode === "spend";
  const application = form.querySelector("[data-topping-application]");
  if (application) application.hidden = !targetMode.startsWith("topping_");
}

function formPayload(form) {
  const values = new FormData(form);
  return {
    name: String(values.get("name") ?? "").trim(), minSpend: Number(values.get("minSpend")), priority: Number(values.get("priority")),
    conditionMode: values.get("conditionMode") || "spend",
    conditionCategories: values.getAll("conditionCategories"), conditionExcludedMenuIds: values.getAll("conditionExcludedMenuIds").map(Number),
    conditionMenuIds: values.getAll("conditionMenuIds").map(Number), conditionToppingIds: values.getAll("conditionToppingIds").map(Number),
    conditionMinQuantity: Number(values.get("conditionMinQuantity") || 1),
    targetMode: values.get("targetMode") || "categories",
    targetCategories: values.getAll("targetCategories"), targetExcludedMenuIds: values.getAll("targetExcludedMenuIds").map(Number),
    targetMenuIds: values.getAll("targetMenuIds").map(Number), targetToppingIds: values.getAll("targetToppingIds").map(Number),
    applicationMode: values.get("applicationMode") || "once",
    discountType: values.get("discountType"), discountValue: Number(values.get("discountValue")),
    maxDiscount: values.get("maxDiscount") === "" ? null : Number(values.get("maxDiscount")),
    enabled: values.has("enabled"), stackable: values.has("stackable")
  };
}

function updateCounts(form) {
  form.querySelectorAll("details.ap-exclude").forEach((details) => details.querySelector(".ap-count").textContent = details.querySelectorAll('.ap-menu-item input:checked').length);
}

function updateLiveSummary(form) {
  if (!form) return;
  const rule = formPayload(form);
  const title = form.querySelector("[data-summary-title]");
  const detail = form.querySelector("[data-summary-detail]");
  if (title) title.textContent = rule.name || "โปรโมชั่นใหม่";
  if (detail) {
    const names = (ids) => ids.map((id) => store.menus.find((menu) => Number(menu.id) === Number(id))?.name ?? "เมนู #" + id).join(", ") || "ไม่มี";
    detail.textContent = ruleDescription(rule) + "\nไม่นับรวมยอด: " + names(rule.conditionExcludedMenuIds) + "\nไม่ได้รับส่วนลด: " + names(rule.targetExcludedMenuIds);
  }
  const headTitle = form.querySelector(".ap-wizard-head h3");
  if (headTitle) headTitle.textContent = rule.name || "โปรโมชั่นใหม่";
}

function goStep(step, form) {
  editingRule = { ...editingRule, ...formPayload(form) };
  currentStep = Math.max(1, Math.min(4, step));
  renderWizard(document.querySelector(".ap-modal-slot"), editingRule);
}

function closeWizard() {
  editingRule = null; currentStep = 1;
  const panel = document.querySelector(".ap-panel");
  if (panel) renderPanel(panel);
}

async function api(path = "", options = {}) {
  const response = await fetch(API + path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "ดำเนินการไม่สำเร็จ");
  return body;
}

async function refresh(panel) {
  store = await api();
  renderPanel(panel);
}

async function saveRule(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = formPayload(form);
  if (!payload.name) { goStep(1, form); setTimeout(() => document.querySelector('[name="name"]')?.reportValidity(), 0); return; }
  if (payload.conditionMode === "menu" && !payload.conditionMenuIds.length) { showNotice("กรุณาเลือกเมนูที่ทำให้โปรทำงาน", "error"); return; }
  if (payload.conditionMode === "topping" && !payload.conditionToppingIds.length) { showNotice("กรุณาเลือกท็อปปิ้งที่ทำให้โปรทำงาน", "error"); return; }
  if (payload.targetMode === "menu" && !payload.targetMenuIds.length) { showNotice("กรุณาเลือกเมนูที่ได้รับส่วนลด", "error"); return; }
  if (payload.targetMode === "topping_selected" && !payload.targetToppingIds.length) { showNotice("กรุณาเลือกท็อปปิ้งที่เข้าร่วมโปรโมชั่น", "error"); return; }
  if (!payload.discountValue || payload.discountValue < 1) { showNotice("กรุณาระบุจำนวนส่วนลด", "error"); goStep(3, form); return; }
  const button = form.querySelector(".ap-save");
  button.disabled = true; button.textContent = "กำลังบันทึก...";
  try {
    await api(editingRule.id ? `/${editingRule.id}` : "", { method: editingRule.id ? "PUT" : "POST", body: JSON.stringify(payload) });
    editingRule = null; currentStep = 1;
    await refresh(document.querySelector(".ap-panel"));
    showNotice("บันทึกโปรโมชั่นเรียบร้อยแล้ว");
  } catch (error) { showNotice(error.message, "error"); button.disabled = false; button.textContent = "✓ บันทึกโปรโมชั่น"; }
}

async function runAction(type, id) {
  const panel = document.querySelector(".ap-panel");
  const rule = store.rules.find((item) => item.id === id);
  if (type === "new") { editingRule = blankRule(); currentStep = 1; renderPanel(panel); return; }
  if (type === "edit") { editingRule = structuredClone(rule); currentStep = 1; renderPanel(panel); return; }
  try {
    if (type === "delete") {
      if (!confirm(`ลบโปรโมชั่น “${rule.name}” หรือไม่?`)) return;
      await api(`/${id}`, { method: "DELETE" });
      await refresh(panel); showNotice("ลบโปรโมชั่นแล้ว"); return;
    }
    if (type === "toggle") {
      await api(`/${id}`, { method: "PUT", body: JSON.stringify({ ...rule, enabled: !rule.enabled }) });
      await refresh(panel); showNotice(rule.enabled ? "ปิดโปรโมชั่นแล้ว" : "เปิดโปรโมชั่นแล้ว");
    }
  } catch (error) { showNotice(error.message, "error"); }
}

function installStyles() {
  if (document.getElementById("ap-styles")) return;
  const style = document.createElement("style");
  style.id = "ap-styles";
  style.textContent = `
    .ap-panel,.ap-panel *{box-sizing:border-box}.ap-panel{margin:20px 0;color:#342b20;font-family:"Noto Sans Thai","Sarabun",sans-serif}.ap-hero{display:flex;align-items:center;gap:16px;padding:22px;border:1px solid #ead8ad;border-radius:24px 24px 0 0;background:linear-gradient(135deg,#fffaf0 0%,#fff3cf 100%)}.ap-hero-icon{display:grid;width:54px;height:54px;flex:0 0 54px;place-items:center;border-radius:17px;background:#4e3917;color:#ffe09a;font:800 25px/1 "DM Sans"}.ap-hero-copy{min-width:0;flex:1}.ap-eyebrow{font-size:10px;font-weight:800;letter-spacing:.17em;color:#a47718}.ap-hero h2{margin:2px 0;font-size:23px;font-weight:750;letter-spacing:-.02em}.ap-hero p,.ap-section-head p{margin:0;color:#8c7957;font-size:13px}.ap-main-button,.ap-next,.ap-save{display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:13px;background:#4e3917;color:#fff;padding:11px 16px;font-weight:750;box-shadow:0 5px 15px #4e391727}.ap-main-button span{font-size:20px}.ap-stats{display:grid;grid-template-columns:1fr 1fr 1.5fr;border:1px solid #eadfca;border-top:0;border-radius:0 0 24px 24px;background:#fff}.ap-stats>div{display:flex;align-items:center;gap:10px;padding:14px 18px;border-right:1px solid #eee5d4}.ap-stats>div:last-child{border:0}.ap-stat-icon{display:grid;width:34px;height:34px;place-items:center;border-radius:11px;font-weight:800}.ap-stat-icon.green{background:#ebf6e4;color:#5e8a45}.ap-stat-icon.gold{background:#fff1c8;color:#9a6b11}.ap-stats p{display:grid;margin:0}.ap-stats strong{font-size:18px}.ap-stats small{color:#96815b;font-size:11px}.ap-tip{background:#fffcf4}.ap-section-head{display:flex;justify-content:space-between;margin:22px 2px 10px}.ap-section-head h3{margin:0;font-size:18px}.ap-rule-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ap-rule-card{padding:17px;border:1px solid #e8dcc5;border-radius:19px;background:#fff;box-shadow:0 7px 22px #80601b0a}.ap-rule-card.is-disabled{background:#f8f6f1;opacity:.7}.ap-rule-top,.ap-rule-actions,.ap-rule-meta{display:flex;align-items:center;justify-content:space-between;gap:8px}.ap-status{display:flex;align-items:center;gap:6px;border-radius:99px;padding:4px 9px;font-size:11px;font-weight:700}.ap-status i{width:7px;height:7px;border-radius:50%}.ap-status.on{background:#edf7e8;color:#577d43}.ap-status.on i{background:#70a253}.ap-status.off{background:#eeeae2;color:#827766}.ap-status.off i{background:#a79d8d}.ap-priority{font-size:10px;color:#a08c68}.ap-rule-card h4{margin:13px 0 9px;font-size:17px}.ap-rule-flow{display:flex;align-items:center;gap:7px;padding:9px 10px;border-radius:12px;background:#fff8e8;font-size:13px}.ap-rule-flow em{color:#b9a47d}.ap-rule-card>p{margin:9px 0;color:#756549;font-size:12px}.ap-rule-meta{justify-content:flex-start;flex-wrap:wrap;color:#9b8865;font-size:10px}.ap-rule-actions{margin-top:14px;padding-top:12px;border-top:1px solid #f0e9db;justify-content:flex-end}.ap-rule-actions button,.ap-secondary{border:1px solid #ded2b9;border-radius:10px;background:#fff;padding:7px 10px;color:#67583f;font-size:12px;font-weight:650}.ap-rule-actions button.primary{background:#fff4d4;border-color:#e4c775;color:#7c5b13}.ap-rule-actions button.danger{color:#b75145}.ap-empty{display:grid;grid-column:1/-1;min-height:190px;place-items:center;align-content:center;gap:7px;border:2px dashed #dfcfaa;border-radius:20px;background:#fffaf0;color:#8c7449}.ap-empty span{display:grid;width:45px;height:45px;place-items:center;border-radius:15px;background:#ffedbb;font-size:24px}.ap-empty small{color:#a28f6e}.ap-overlay{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:18px;background:#3027189c;backdrop-filter:blur(5px)}.ap-wizard{display:flex;width:min(760px,100%);max-height:min(880px,94vh);flex-direction:column;overflow:hidden;border-radius:24px;background:#fffdf8;box-shadow:0 28px 80px #1e170f55}.ap-wizard-head{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;background:#4e3917;color:#fff}.ap-wizard-head span{color:#e9cb87;font-size:11px;font-weight:700}.ap-wizard-head h3{margin:2px 0 0;font-size:19px}.ap-close{border:0;background:transparent;color:#fff;font-size:29px}.ap-steps{display:grid;grid-template-columns:repeat(4,1fr);padding:14px 20px 10px;background:#fff}.ap-steps button{display:flex;align-items:center;justify-content:center;gap:7px;border:0;background:transparent;color:#a19279;font-size:11px}.ap-steps i{display:grid;width:27px;height:27px;place-items:center;border-radius:50%;background:#eee9df;font-style:normal;font-weight:700}.ap-steps button.active{color:#624813;font-weight:750}.ap-steps button.active i{background:#f4c95d;color:#49340c}.ap-progress{height:3px;background:#eee7d9}.ap-progress i{display:block;height:100%;background:#e8b83f;transition:width .2s}.ap-wizard-body{overflow-y:auto;padding:20px 24px}.ap-step-panel{display:none}.ap-step-panel.active{display:block}.ap-step-title{display:flex;align-items:center;gap:11px;margin-bottom:19px}.ap-step-title>span{display:grid;width:38px;height:38px;place-items:center;border-radius:12px;background:#fff0c5;color:#79560c;font-weight:800}.ap-step-title h4{margin:0;font-size:18px}.ap-step-title p{margin:1px 0 0;color:#95815f;font-size:12px}.ap-field{display:grid;gap:6px;margin-bottom:14px;color:#50432f;font-size:12px;font-weight:700}.ap-field>span b{color:#c2614e}.ap-field input,.ap-search{width:100%;height:44px;border:1px solid #ded2b9;border-radius:11px;background:#fff;padding:0 12px;color:#382f23;outline:none}.ap-field input:focus,.ap-search:focus{border-color:#d2a83c;box-shadow:0 0 0 3px #f5d98438}.ap-field small{color:#9e8b69;font-weight:400}.ap-field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ap-input-addon{display:flex;border:1px solid #ded2b9;border-radius:11px;overflow:hidden;background:#fff}.ap-input-addon input{border:0;border-radius:0}.ap-input-addon i{display:grid;min-width:52px;place-items:center;background:#f7f1e5;color:#8c7752;font-style:normal;font-weight:600}.ap-category-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.ap-category{position:relative;display:flex;min-height:85px;align-items:center;gap:9px;border:1.5px solid #e4dac7;border-radius:15px;background:#fff;padding:12px;cursor:pointer}.ap-category input{position:absolute;opacity:0}.ap-category-icon{font-size:22px}.ap-category>span:nth-of-type(2){display:grid}.ap-category strong{font-size:12px}.ap-category small{color:#9b896b;font-size:9px;font-weight:400}.ap-tick{display:none;margin-left:auto}.ap-category.is-selected{border-color:#d5aa3e;background:#fff8e3;box-shadow:0 0 0 2px #f4d88742}.ap-category.is-selected .ap-tick{display:block;color:#98700f;font-weight:900}.ap-exclude{margin-top:14px;border:1px solid #e6dcc8;border-radius:14px;background:#fff}.ap-exclude summary{display:flex;align-items:center;gap:10px;padding:12px;cursor:pointer;list-style:none}.ap-exclude summary>span{display:grid;width:32px;height:32px;place-items:center;border-radius:10px;background:#fff0e8;color:#ad5f49}.ap-exclude summary div{display:grid;flex:1}.ap-exclude summary strong{font-size:12px}.ap-exclude summary small{color:#9a896b;font-size:10px;font-weight:400}.ap-exclude summary>.ap-count{display:grid;min-width:23px;height:23px;place-items:center;border-radius:99px;background:#f3ead8;color:#83693a;font-size:10px}.ap-exclude summary>i{font-style:normal}.ap-menu-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #eee6d8;padding:10px 12px;color:#9b896b;font-size:10px}.ap-search{max-width:230px;height:36px;font-size:11px}.ap-menu-list{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;max-height:210px;overflow:auto;padding:0 12px 12px}.ap-menu-item{display:flex;align-items:center;gap:8px;border:1px solid #eee6d7;border-radius:10px;padding:8px;cursor:pointer}.ap-menu-item input{position:absolute;opacity:0}.ap-menu-check{display:grid;width:20px;height:20px;place-items:center;border:1px solid #d8cdb8;border-radius:6px;color:transparent}.ap-menu-item:has(input:checked){border-color:#d8b34e;background:#fff9e8}.ap-menu-item:has(input:checked) .ap-menu-check{background:#d8ad38;color:#fff}.ap-menu-name{display:grid;flex:1;font-size:11px;font-weight:650}.ap-menu-name small{color:#a08f72;font-size:9px;font-weight:400}.ap-menu-item>strong{font-size:10px}.ap-discount-box{margin-top:14px;padding:14px;border-radius:15px;background:#f9f5ec}.ap-label{font-size:11px;font-weight:700}.ap-segment{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:7px 0 14px;padding:4px;border-radius:11px;background:#eae3d6}.ap-segment label{border-radius:8px;padding:8px;text-align:center;color:#8c7b5e;font-size:11px;font-weight:650;cursor:pointer}.ap-segment input{position:absolute;opacity:0}.ap-segment label.selected{background:#fff;color:#664a13;box-shadow:0 2px 7px #604b2817}.ap-max-field.is-muted{opacity:.5}.ap-summary{display:flex;gap:13px;align-items:center;border:1px solid #e8ce88;border-radius:16px;background:linear-gradient(135deg,#fff8df,#fffdf5);padding:16px}.ap-summary-icon{display:grid;width:45px;height:45px;place-items:center;border-radius:14px;background:#ffedb6;font-size:21px}.ap-summary div{min-width:0}.ap-summary small{color:#9c7a29}.ap-summary h4{margin:2px 0;font-size:16px}.ap-summary p{margin:0;color:#7f6d4e;font-size:11px}.ap-setting-list{display:grid;gap:8px;margin-top:13px}.ap-setting-list>label{display:flex;align-items:center;gap:12px;border:1px solid #e8dfcf;border-radius:13px;padding:12px}.ap-setting-list label>div{display:grid}.ap-setting-list strong{font-size:12px}.ap-setting-list small{color:#98876a;font-size:10px}.ap-toggle{position:relative;width:43px;height:24px;flex:0 0 43px}.ap-toggle input{position:absolute;opacity:0}.ap-toggle i{position:absolute;inset:0;border-radius:99px;background:#d8d0c2}.ap-toggle i:after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s}.ap-toggle input:checked+i{background:#76a45b}.ap-toggle input:checked+i:after{transform:translateX(19px)}.ap-wizard-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #eee5d5;padding:14px 20px;background:#fff}.ap-wizard-foot>span{color:#a18e6b;font-size:10px}.ap-secondary,.ap-next,.ap-save{min-width:105px}.ap-notice{position:fixed;z-index:1200;top:18px;left:50%;transform:translateX(-50%);border-radius:12px;background:#496c39;color:#fff;padding:11px 16px;box-shadow:0 8px 25px #2f251d40;font-size:12px;font-weight:700}.ap-notice.error{background:#a9443b}@media(max-width:720px){.ap-hero{align-items:flex-start;flex-wrap:wrap}.ap-hero-copy{width:calc(100% - 70px)}.ap-main-button{width:100%}.ap-stats{grid-template-columns:1fr 1fr}.ap-tip{grid-column:1/-1}.ap-stats>div:nth-child(2){border-right:0}.ap-rule-grid{grid-template-columns:1fr}.ap-overlay{padding:0;align-items:end}.ap-wizard{max-height:96vh;border-radius:22px 22px 0 0}.ap-wizard-head{padding:15px 17px}.ap-steps{padding:10px 8px 7px}.ap-steps button{display:grid;gap:3px}.ap-steps button span{font-size:9px}.ap-wizard-body{padding:16px}.ap-field-row,.ap-category-grid,.ap-menu-list{grid-template-columns:1fr}.ap-category{min-height:66px}.ap-menu-tools{align-items:stretch;flex-direction:column}.ap-search{max-width:none}.ap-wizard-foot{padding:12px}.ap-wizard-foot>span{display:none}.ap-secondary,.ap-next,.ap-save{flex:1}}
  `;
  style.textContent += `
    /* Human-designed visual pass: restrained radii, neutral surfaces and Thai-first typography. */
    .ap-panel{font-family:"Sarabun","Noto Sans Thai",system-ui,sans-serif;color:#332b22}
    .ap-panel h2,.ap-panel h3,.ap-panel h4,.ap-panel strong,.ap-panel button{font-family:"Noto Sans Thai","Sarabun",system-ui,sans-serif}
    .ap-hero{padding:20px;border-color:#ddd4c5;border-radius:14px 14px 0 0;background:#fbf8f2}
    .ap-hero-icon{width:48px;height:48px;flex-basis:48px;border-radius:9px;background:#4a351d;color:#f0cf83;font-size:22px}
    .ap-eyebrow{font-size:11px;font-weight:600;letter-spacing:0;color:#92713d}
    .ap-hero h2{margin:3px 0 1px;font-size:21px;font-weight:700;letter-spacing:0}
    .ap-hero p,.ap-section-head p{font-size:13px;line-height:1.55;color:#7c6d58}
    .ap-main-button,.ap-next,.ap-save{min-height:42px;border-radius:8px;background:#4a351d;padding:9px 16px;box-shadow:none;font-size:13px;font-weight:600}
    .ap-stats{border-color:#ddd4c5;border-radius:0 0 14px 14px}
    .ap-stats>div{padding:13px 16px;border-color:#e7e0d5}
    .ap-stat-icon{width:32px;height:32px;border-radius:7px}
    .ap-info-mark{display:grid;width:25px;height:25px;place-items:center;border:1px solid #cdbb94;border-radius:50%;color:#836736;font:700 13px/1 Georgia,serif}
    .ap-rule-grid{gap:14px}
    .ap-rule-card{padding:18px;border-color:#ddd5c8;border-radius:12px;box-shadow:none}
    .ap-rule-card.is-disabled{opacity:.62}
    .ap-status{padding:4px 8px;font-size:11px;font-weight:600}
    .ap-rule-card h4{margin:14px 0 10px;font-size:16px;line-height:1.45}
    .ap-rule-flow{gap:9px;padding:10px 12px;border:1px solid #eee2c9;border-radius:8px;background:#fcf8ef}
    .ap-flow-icon,.ap-category-icon,.ap-summary-icon{color:#765721}
    .ap-flow-icon svg{display:block;width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    .ap-rule-card>p{font-size:12px;line-height:1.6;color:#675b49}
    .ap-rule-meta{gap:14px;font-size:11px;color:#82745f}
    .ap-rule-actions button,.ap-secondary{min-height:37px;border-color:#d5ccbd;border-radius:7px;padding:7px 12px;background:#fff;font-size:12px;font-weight:600}
    .ap-rule-actions button.primary{background:#f4ead2;border-color:#d7bb7a;color:#624818}
    .ap-empty{border-radius:12px;background:#fbf8f2}
    .ap-overlay{background:#2b241db8;backdrop-filter:none}
    .ap-wizard{border:1px solid #d4cab9;border-radius:16px;background:#faf8f4;box-shadow:0 18px 45px #21180e4d}
    .ap-wizard-head{padding:17px 20px;background:#4a351d}
    .ap-wizard-head span{color:#d9c49a;font-size:11px;font-weight:500}
    .ap-wizard-head h3{font-size:18px;font-weight:650}
    .ap-steps{padding:13px 18px 9px;border-bottom:1px solid #ebe4d9}
    .ap-steps i{width:25px;height:25px;background:#eeeae3;font-size:11px}
    .ap-steps button.active i{background:#d9ad4b;color:#3f2d15}
    .ap-progress{height:2px}
    .ap-wizard-body{padding:22px 24px;background:#faf8f4}
    .ap-step-title>span{width:35px;height:35px;border-radius:8px;background:#efe4cc;color:#664b1e}
    .ap-step-title h4{font-size:17px}.ap-step-title p{font-size:12px;color:#7d6f5a}
    .ap-field{gap:7px;margin-bottom:16px;font-size:13px;font-weight:600}
    .ap-field input,.ap-field select,.ap-search{height:45px;border:1px solid #cfc6b8;border-radius:7px;padding:0 12px;background:#fff;color:#382f23;font:400 14px "Sarabun","Noto Sans Thai",sans-serif;outline:none}
    .ap-field input:focus,.ap-field select:focus,.ap-search:focus{border-color:#9c793d;box-shadow:0 0 0 2px #9c793d1f}
    .ap-input-addon{border-color:#cfc6b8;border-radius:7px}
    .ap-input-addon i{background:#f2eee7;color:#6e6250;font-size:12px}
    .ap-category{min-height:78px;border:1px solid #d9d1c4;border-radius:9px;padding:11px;background:#fff}
    .ap-category-icon{display:grid;width:27px;height:27px;place-items:center}
    .ap-category-icon svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
    .ap-category strong{font-size:12px}.ap-category small{font-size:10px}
    .ap-category.is-selected{border-color:#aa823a;background:#f8f0de;box-shadow:none}
    .ap-exclude{border-color:#d9d1c4;border-radius:9px}
    .ap-exclude summary{padding:12px 13px}
    .ap-exclude summary>span{width:29px;height:29px;border-radius:6px;background:#f5ece6}
    .ap-menu-tools{border-color:#e5ded3;padding:11px 13px;font-size:11px}
    .ap-search{height:37px}
    .ap-menu-item{border-color:#e0d8cc;border-radius:7px;padding:9px}
    .ap-menu-item:has(input:checked){border-color:#ae873d;background:#f8f0de}
    .ap-menu-check{border-radius:4px}
    .ap-discount-box{border:1px solid #dfd7ca;border-radius:9px;background:#f4f1eb}
    .ap-segment{border-radius:7px;background:#e6e0d7}
    .ap-segment label{border-radius:5px}.ap-segment label.selected{box-shadow:none}
    .ap-summary{border-color:#d4bd85;border-radius:9px;background:#f8f1df}
    .ap-summary-icon{width:40px;height:40px;border-radius:7px;background:#ead7a7}
    .ap-summary-icon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    .ap-setting-list>label{border-color:#d9d1c4;border-radius:8px;background:#fff}
    .ap-wizard-foot{border-color:#e1d9cc;padding:13px 18px}
    .ap-notice{border-radius:7px;box-shadow:0 8px 22px #2f251d30}
    @media(max-width:720px){.ap-wizard{border-radius:16px 16px 0 0}.ap-wizard-body{padding:17px 16px}.ap-field input,.ap-search{font-size:16px}.ap-category{min-height:64px}.ap-hero-copy{width:calc(100% - 64px)}}
  `;
  document.head.appendChild(style);
  const layout = document.createElement("style");
  layout.textContent = `
    .ap-legacy-promotion{display:none!important}
    .ap-panel{margin-top:18px}
    .ap-panel button{cursor:pointer}
    .ap-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border:1px solid #ded5c7;border-radius:12px;background:#fff}
    .ap-toolbar-copy{display:flex;align-items:center;gap:12px;min-width:0}
    .ap-toolbar-copy h2{margin:0;font-size:18px;font-weight:650;color:#352b21}
    .ap-toolbar-copy p{margin:2px 0 0;color:#766b5d;font-size:12px;font-weight:400}
    .ap-toolbar-copy p strong{color:#554329;font-weight:650}
    .ap-toolbar-icon{display:grid;width:42px;height:42px;flex:0 0 42px;place-items:center;border:1px solid #dbc89f;border-radius:9px;background:#faf4e7;color:#79591f}
    .ap-toolbar-icon svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    .ap-section-head{margin:20px 2px 10px}
    .ap-main-button{border:1px solid #674a24;min-height:48px}
    .ap-add-icon{display:grid;place-items:center;border:1px solid #b89a69;border-radius:6px;width:28px;height:28px}
    .ap-add-icon svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8}
    .ap-single .ap-wizard{width:min(980px,100%);max-height:94dvh}
    .ap-single .ap-wizard-head{background:#fffaf0;color:#392c20;border-bottom:1px solid #e4d7bc}
    .ap-single .ap-wizard-head span{color:#786544}.ap-single .ap-close{color:#654a26}
    .ap-single .ap-wizard-body{background:#fffdf8}
    .ap-overview{display:grid;grid-template-columns:1fr 1.5fr;gap:20px}
    .ap-single .ap-setting-list{margin:0 0 18px;gap:6px}
    .ap-single .ap-setting-list>label{padding:8px;border:0;background:transparent}
    .ap-scopes{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .ap-mode-box{margin:18px 0;padding:16px;border:1px solid #d9c8a5;border-radius:10px;background:#fff}
    .ap-mode-box>h4{margin:0 0 14px;font-size:16px;font-weight:650}
    .ap-mode-box>[data-condition-panel],.ap-mode-box>[data-target-panel]{margin-top:8px}
    .ap-mode-box>[hidden],.ap-field[hidden]{display:none!important}
    .ap-mode-box>.ap-menu-tools{border:1px solid #e5ded3;border-bottom:0;border-radius:8px 8px 0 0}
    .ap-mode-box>.ap-menu-list{padding:0 12px 12px;border:1px solid #e5ded3;border-top:0;border-radius:0 0 8px 8px}
    .ap-mode-note{padding:14px;border:1px solid #cfe0ce;border-radius:8px;background:#f0f7ef;color:#486247;font-size:13px}
    .ap-scope{min-width:0;border:1px solid #d9c8a5;border-radius:10px;padding:16px;background:#fff}
    .ap-scope h4,.ap-discount-box h4{margin:0 0 8px;font-size:16px;font-weight:600}
    .ap-scope>p{font-size:13px;color:#786e5e;margin:0 0 14px}
    .ap-single .ap-category-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .ap-single .ap-category{flex-direction:column;align-items:center;text-align:center;gap:8px;padding:12px 5px;min-width:0}
    .ap-single .ap-category-icon{width:36px;height:36px;border:1px solid #ddc99f;border-radius:7px;background:#fff9ec}
    .ap-single .ap-category input{width:100%;height:100%;inset:0;margin:0;cursor:pointer}
    .ap-single .ap-category small{display:none}.ap-single .ap-tick{position:absolute;top:4px;right:6px}
    .ap-single .ap-category strong{font-size:13px;font-weight:500}
    .ap-single .ap-menu-list{grid-template-columns:1fr}
    .ap-single .ap-menu-item[hidden]{display:none}
    .ap-single .ap-menu-item{position:relative}
    .ap-single .ap-menu-item input{inset:0;width:100%;height:100%;margin:0;cursor:pointer}
    .ap-single .ap-menu-name{font-size:14px}.ap-single .ap-menu-name small{font-size:12px}
    .ap-discount-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:18px;align-items:start}
    .ap-single .ap-max-field.is-muted{opacity:1}
    .ap-single .ap-segment label{position:relative;font-size:13px;min-height:44px;display:grid;place-items:center}
    .ap-single .ap-segment input{inset:0;width:100%;height:100%;margin:0;cursor:pointer}
    .ap-scope-note{padding:12px 14px;border:1px solid #e2d2b3;background:#fbf4e4;border-radius:7px;font-size:13px;color:#715c37;line-height:1.6}
    .ap-single .ap-summary{background:#faf8f3;border-color:#ded6c8}
    .ap-single .ap-summary p{white-space:pre-line;font-size:13px;line-height:1.7}
    .ap-single .ap-wizard-foot{justify-content:flex-end;flex-shrink:0}
    .ap-single button{min-height:44px}
    .ap-single label:focus-within{outline:2px solid #a77a30;outline-offset:2px}
    @media(max-width:720px){.ap-toolbar{align-items:stretch;flex-direction:column;padding:14px}.ap-toolbar-copy h2{font-size:17px}.ap-main-button{width:100%}.ap-scopes,.ap-overview,.ap-discount-grid{grid-template-columns:1fr;gap:12px}.ap-single .ap-wizard{max-height:96dvh}.ap-single .ap-scope,.ap-mode-box{padding:12px}.ap-single .ap-category-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.ap-single .ap-setting-list{margin-bottom:8px}.ap-single .ap-field input,.ap-single .ap-field select{min-width:0;font-size:16px}}
  `;
  document.head.appendChild(layout);
}

async function mount() {
  const heading = [...document.querySelectorAll("h1")].find((node) => node.textContent.trim() === "จัดการโปรโมชั่น");
  const section = heading?.closest("section");
  if (!section || section.querySelector(".ap-panel")) return;
  installStyles();
  const headingBlock = [...section.children].find((child) => child === heading || child.contains(heading));
  [...section.children].forEach((child) => {
    if (child !== headingBlock) child.classList.add("ap-legacy-promotion");
  });
  const panel = document.createElement("div");
  panel.className = "ap-panel";
  panel.innerHTML = `<div class="ap-empty"><span>⌛</span><strong>กำลังโหลดโปรโมชั่น...</strong></div>`;
  headingBlock?.insertAdjacentElement("afterend", panel) || section.appendChild(panel);
  try { await refresh(panel); } catch (error) { panel.innerHTML = `<div class="ap-empty"><span>!</span><strong>โหลดโปรโมชั่นไม่สำเร็จ</strong><small>${escapeHtml(error.message)}</small></div>`; }
}

new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
mount();

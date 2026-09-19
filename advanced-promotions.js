const API = "/api/advanced-promotions";
const categoryLabels = { shop: "เมนูร้าน", custom: "เมนู Custom", other: "เครื่องดื่ม" };
const categoryIcons = { shop: "🍞", custom: "✨", other: "🥤" };
let store = { rules: [], menus: [] };
let editingRule = null;
let currentStep = 1;

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function blankRule() {
  return {
    name: "", enabled: true, minSpend: 50,
    conditionCategories: ["other"], conditionExcludedMenuIds: [],
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

function menuSelector(name, selected = [], searchId) {
  if (!store.menus.length) return `<div class="ap-no-menu">ยังไม่มีเมนูสำหรับเลือก</div>`;
  return `
    <div class="ap-menu-tools"><span>เลือกเฉพาะรายการที่ต้องการยกเว้น</span><input id="${searchId}" class="ap-search" type="search" placeholder="🔎 ค้นหาชื่อเมนู..."></div>
    <div class="ap-menu-list" data-menu-list="${searchId}">
      ${store.menus.map((menu) => `
        <label class="ap-menu-item" data-search="${escapeHtml(menu.name.toLowerCase())}">
          <input type="checkbox" name="${name}" value="${menu.id}" ${selected.includes(Number(menu.id)) ? "checked" : ""}>
          <span class="ap-menu-check">✓</span><span class="ap-menu-name">${escapeHtml(menu.name)}<small>${categoryLabels[menu.category] ?? menu.category}</small></span><strong>฿${menu.price}</strong>
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
  return `${categoryText(rule.conditionCategories)} ครบ ฿${rule.minSpend} → ลด ${categoryText(rule.targetCategories)} ${discount}`;
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
    <div class="ap-hero">
      <div class="ap-hero-icon">%</div>
      <div class="ap-hero-copy"><span class="ap-eyebrow">PROMOTION BUILDER</span><h2>สร้างโปรโมชั่นได้ตามต้องการ</h2><p>กำหนดยอดขั้นต่ำ หมวดสินค้า เมนูยกเว้น และส่วนลดได้ในไม่กี่ขั้นตอน</p></div>
      <button class="ap-main-button" data-action="new"><span>＋</span> สร้างโปรโมชั่น</button>
    </div>
    <div class="ap-stats">
      <div><span class="ap-stat-icon green">✓</span><p><strong>${activeCount}</strong><small>กำลังเปิดใช้งาน</small></p></div>
      <div><span class="ap-stat-icon gold">▦</span><p><strong>${store.rules.length}</strong><small>โปรโมชั่นทั้งหมด</small></p></div>
      <div class="ap-tip"><span>💡</span><p><strong>ระบบคิดส่วนลดอัตโนมัติ</strong><small>เมื่อสินค้าในตะกร้าตรงตามเงื่อนไข</small></p></div>
    </div>
    <div class="ap-section-head"><div><h3>โปรโมชั่นของฉัน</h3><p>แตะการ์ดเพื่อแก้ไข หรือเปิด–ปิดได้ทันที</p></div></div>
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
  return `
    <article class="ap-rule-card ${rule.enabled ? "" : "is-disabled"}">
      <div class="ap-rule-top"><span class="ap-status ${rule.enabled ? "on" : "off"}"><i></i>${rule.enabled ? "เปิดใช้งาน" : "ปิดอยู่"}</span><span class="ap-priority">ลำดับ ${rule.priority}</span></div>
      <h4>${escapeHtml(rule.name)}</h4>
      <div class="ap-rule-flow"><span>${categoryIcons[rule.conditionCategories?.[0]] ?? "🛒"}</span><b>ครบ ฿${rule.minSpend}</b><em>→</em><span>🏷️</span><b>${rule.discountType === "percent" ? `${rule.discountValue}%` : `฿${rule.discountValue}`}</b></div>
      <p>${escapeHtml(ruleDescription(rule))}</p>
      <div class="ap-rule-meta"><span>${exclusions ? `⊘ ยกเว้น ${exclusions} เมนู` : "✓ ไม่มีเมนูยกเว้น"}</span><span>${rule.stackable ? "＋ ใช้ร่วมกับโปรอื่นได้" : "▣ ใช้โปรนี้โปรเดียว"}</span></div>
      <div class="ap-rule-actions"><button data-action="toggle" data-id="${rule.id}">${rule.enabled ? "ปิดชั่วคราว" : "เปิดใช้งาน"}</button><button class="primary" data-action="edit" data-id="${rule.id}">แก้ไข</button><button class="danger" title="ลบ" data-action="delete" data-id="${rule.id}">⌫</button></div>
    </article>`;
}

function bindPanelActions(panel) {
  panel.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => runAction(button.dataset.action, Number(button.dataset.id))));
}

function renderWizard(host, rule) {
  host.innerHTML = `
    <div class="ap-overlay" role="dialog" aria-modal="true">
      <form class="ap-wizard">
        <header class="ap-wizard-head"><div><span>${rule.id ? "แก้ไขโปรโมชั่น" : "สร้างโปรโมชั่นใหม่"}</span><h3>${escapeHtml(rule.name || "โปรโมชั่นใหม่")}</h3></div><button type="button" class="ap-close" data-close aria-label="ปิด">×</button></header>
        <nav class="ap-steps">
          ${[[1,"ข้อมูลทั่วไป"],[2,"เงื่อนไข"],[3,"ส่วนลด"],[4,"ตรวจสอบ"]].map(([number, label]) => `<button type="button" data-go-step="${number}" class="${currentStep === number ? "active" : ""}"><i>${number}</i><span>${label}</span></button>`).join("")}
        </nav>
        <div class="ap-progress"><i style="width:${currentStep * 25}%"></i></div>
        <main class="ap-wizard-body">
          <section class="ap-step-panel ${currentStep === 1 ? "active" : ""}" data-step-panel="1">
            <div class="ap-step-title"><span>1</span><div><h4>ข้อมูลโปรโมชั่น</h4><p>ตั้งชื่อและยอดขั้นต่ำที่ลูกค้าต้องซื้อ</p></div></div>
            <label class="ap-field"><span>ชื่อโปรโมชั่น <b>*</b></span><input name="name" required maxlength="160" value="${escapeHtml(rule.name)}" placeholder="เช่น เครื่องดื่มครบ 50 ลด 10"><small>ตั้งชื่อให้จำง่ายและบอกเงื่อนไขหลัก</small></label>
            <div class="ap-field-row"><label class="ap-field"><span>ยอดขั้นต่ำ <b>*</b></span><div class="ap-input-addon"><input type="number" name="minSpend" min="0" required value="${rule.minSpend}"><i>บาท</i></div></label><label class="ap-field"><span>ลำดับการใช้โปร</span><input type="number" name="priority" min="1" max="9999" value="${rule.priority}"><small>เลขน้อยจะถูกคำนวณก่อน</small></label></div>
          </section>
          <section class="ap-step-panel ${currentStep === 2 ? "active" : ""}" data-step-panel="2">
            <div class="ap-step-title"><span>2</span><div><h4>สินค้าอะไรที่ใช้สะสมยอด?</h4><p>เลือกหมวดที่จะนำมาคำนวณยอดขั้นต่ำ</p></div></div>
            <div class="ap-category-grid">${categoryCards("conditionCategories", rule.conditionCategories)}</div>
            <details class="ap-exclude" ${rule.conditionExcludedMenuIds.length ? "open" : ""}><summary><span>⊘</span><div><strong>ยกเว้นบางเมนู</strong><small>เช่น ไม่นับเมนูมัทฉะรวมในยอดขั้นต่ำ</small></div><b class="ap-count">${rule.conditionExcludedMenuIds.length}</b><i>⌄</i></summary>${menuSelector("conditionExcludedMenuIds", rule.conditionExcludedMenuIds, "condition-search")}</details>
          </section>
          <section class="ap-step-panel ${currentStep === 3 ? "active" : ""}" data-step-panel="3">
            <div class="ap-step-title"><span>3</span><div><h4>ลดราคาให้สินค้าอะไร?</h4><p>เลือกหมวด รูปแบบ และจำนวนส่วนลด</p></div></div>
            <div class="ap-category-grid">${categoryCards("targetCategories", rule.targetCategories)}</div>
            <details class="ap-exclude" ${rule.targetExcludedMenuIds.length ? "open" : ""}><summary><span>⊘</span><div><strong>เมนูที่ไม่ได้รับส่วนลด</strong><small>สินค้าเหล่านี้ยังอยู่ในตะกร้า แต่จะไม่ถูกลดราคา</small></div><b class="ap-count">${rule.targetExcludedMenuIds.length}</b><i>⌄</i></summary>${menuSelector("targetExcludedMenuIds", rule.targetExcludedMenuIds, "target-search")}</details>
            <div class="ap-discount-box"><span class="ap-label">รูปแบบส่วนลด</span><div class="ap-segment"><label class="${rule.discountType === "fixed" ? "selected" : ""}"><input type="radio" name="discountType" value="fixed" ${rule.discountType === "fixed" ? "checked" : ""}>฿ ลดเป็นบาท</label><label class="${rule.discountType === "percent" ? "selected" : ""}"><input type="radio" name="discountType" value="percent" ${rule.discountType === "percent" ? "checked" : ""}>% ลดเป็นเปอร์เซ็นต์</label></div><div class="ap-field-row"><label class="ap-field"><span>จำนวนส่วนลด <b>*</b></span><div class="ap-input-addon"><input type="number" name="discountValue" min="1" required value="${rule.discountValue}"><i data-discount-unit>${rule.discountType === "fixed" ? "บาท" : "%"}</i></div></label><label class="ap-field ap-max-field ${rule.discountType === "percent" ? "" : "is-muted"}"><span>ลดสูงสุด</span><div class="ap-input-addon"><input type="number" name="maxDiscount" min="0" value="${rule.maxDiscount ?? ""}" placeholder="ไม่จำกัด"><i>บาท</i></div></label></div></div>
          </section>
          <section class="ap-step-panel ${currentStep === 4 ? "active" : ""}" data-step-panel="4">
            <div class="ap-step-title"><span>4</span><div><h4>ตรวจสอบก่อนบันทึก</h4><p>ดูตัวอย่างกติกาที่ระบบจะนำไปใช้</p></div></div>
            <div class="ap-summary"><span class="ap-summary-icon">🏷️</span><div><small>ตัวอย่างเงื่อนไข</small><h4 data-summary-title></h4><p data-summary-detail></p></div></div>
            <div class="ap-setting-list"><label><span class="ap-toggle"><input type="checkbox" name="enabled" ${rule.enabled ? "checked" : ""}><i></i></span><div><strong>เปิดใช้งานทันที</strong><small>ระบบจะตรวจโปรโมชั่นนี้ในหน้าขายอัตโนมัติ</small></div></label><label><span class="ap-toggle"><input type="checkbox" name="stackable" ${rule.stackable ? "checked" : ""}><i></i></span><div><strong>ใช้ร่วมกับโปรโมชั่นอื่นได้</strong><small>หากปิด ระบบจะหยุดตรวจโปรโมชั่นลำดับถัดไปเมื่อโปรนี้ทำงาน</small></div></label></div>
          </section>
        </main>
        <footer class="ap-wizard-foot"><button type="button" class="ap-secondary" data-back>${currentStep === 1 ? "ยกเลิก" : "← ย้อนกลับ"}</button><span>ขั้นตอน ${currentStep} จาก 4</span>${currentStep < 4 ? `<button type="button" class="ap-next" data-next>ถัดไป →</button>` : `<button type="submit" class="ap-save">✓ บันทึกโปรโมชั่น</button>`}</footer>
      </form>
    </div>`;
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
    form.querySelector(".ap-max-field").classList.toggle("is-muted", input.value !== "percent"); updateLiveSummary(form);
  }));
  host.querySelectorAll("input").forEach((input) => input.addEventListener("input", () => updateLiveSummary(form)));
  host.querySelectorAll(".ap-search").forEach((input) => input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    host.querySelectorAll(`[data-menu-list="${input.id}"] .ap-menu-item`).forEach((item) => item.hidden = !item.dataset.search.includes(query));
  }));
  form.addEventListener("submit", saveRule);
}

function formPayload(form) {
  const values = new FormData(form);
  return {
    name: String(values.get("name") ?? "").trim(), minSpend: Number(values.get("minSpend")), priority: Number(values.get("priority")),
    conditionCategories: values.getAll("conditionCategories"), conditionExcludedMenuIds: values.getAll("conditionExcludedMenuIds").map(Number),
    targetCategories: values.getAll("targetCategories"), targetExcludedMenuIds: values.getAll("targetExcludedMenuIds").map(Number),
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
  if (detail) detail.textContent = ruleDescription(rule);
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
  document.head.appendChild(style);
}

async function mount() {
  const heading = [...document.querySelectorAll("h1")].find((node) => node.textContent.trim() === "จัดการโปรโมชั่น");
  const section = heading?.closest("section");
  if (!section || section.querySelector(".ap-panel")) return;
  installStyles();
  const panel = document.createElement("div");
  panel.className = "ap-panel";
  panel.innerHTML = `<div class="ap-empty"><span>⌛</span><strong>กำลังโหลดโปรโมชั่น...</strong></div>`;
  section.insertBefore(panel, section.children[1] || null);
  try { await refresh(panel); } catch (error) { panel.innerHTML = `<div class="ap-empty"><span>!</span><strong>โหลดโปรโมชั่นไม่สำเร็จ</strong><small>${escapeHtml(error.message)}</small></div>`; }
}

new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
mount();

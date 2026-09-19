const API = "/api/advanced-promotions";
const labels = { shop: "เมนูร้าน", custom: "เมนู Custom", other: "เครื่องดื่ม" };
let data = { rules: [], menus: [] };
let editing = null;

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const categoryChecks = (name, selected = []) => Object.entries(labels).map(([value, label]) => `
  <label class="ap-check"><input type="checkbox" name="${name}" value="${value}" ${selected.includes(value) ? "checked" : ""}> ${label}</label>
`).join("");

const menuChecks = (name, selected = []) => data.menus.map((menu) => `
  <label class="ap-menu"><input type="checkbox" name="${name}" value="${menu.id}" ${selected.includes(Number(menu.id)) ? "checked" : ""}>
    <span>${escapeHtml(menu.name)} <small>${labels[menu.category] ?? menu.category} · ฿${menu.price}</small></span>
  </label>
`).join("");

function emptyRule() {
  return {
    name: "", enabled: true, minSpend: 50,
    conditionCategories: ["other"], conditionExcludedMenuIds: [],
    targetCategories: ["other"], targetExcludedMenuIds: [],
    discountType: "fixed", discountValue: 10, maxDiscount: null,
    stackable: true, priority: 100
  };
}

function description(rule) {
  const source = rule.conditionCategories.length ? rule.conditionCategories.map((v) => labels[v]).join(" + ") : "ทุกหมวด";
  const target = rule.targetCategories.length ? rule.targetCategories.map((v) => labels[v]).join(" + ") : "ทุกหมวด";
  const discount = rule.discountType === "percent" ? `${rule.discountValue}%${rule.maxDiscount != null ? ` (สูงสุด ฿${rule.maxDiscount})` : ""}` : `฿${rule.discountValue}`;
  return `${source} ครบ ฿${rule.minSpend} → ลด ${target} ${discount}`;
}

function renderPanel(panel) {
  panel.innerHTML = `
    <div class="ap-head">
      <div><p class="ap-kicker">กติกาแบบยืดหยุ่น</p><h2>โปรโมชั่นขั้นสูง</h2><p>เลือกหมวด ยกเว้นบางเมนู และกำหนดส่วนลดได้อย่างอิสระ</p></div>
      <button class="ap-primary" data-action="new">+ เพิ่มโปรโมชั่น</button>
    </div>
    <div class="ap-body">
      <div class="ap-list">
        ${data.rules.length ? data.rules.map((rule) => `
          <article class="ap-rule ${rule.enabled ? "" : "ap-off"}">
            <div class="ap-rule-main"><strong>${escapeHtml(rule.name)}</strong><span>${escapeHtml(description(rule))}</span>
              <small>${rule.conditionExcludedMenuIds.length || rule.targetExcludedMenuIds.length ? `มีรายการยกเว้น ${new Set([...rule.conditionExcludedMenuIds, ...rule.targetExcludedMenuIds]).size} เมนู` : "ไม่มีรายการยกเว้น"} · ลำดับ ${rule.priority}</small>
            </div>
            <div class="ap-actions">
              <button data-action="toggle" data-id="${rule.id}">${rule.enabled ? "ปิด" : "เปิด"}</button>
              <button data-action="edit" data-id="${rule.id}">แก้ไข</button>
              <button class="ap-danger" data-action="delete" data-id="${rule.id}">ลบ</button>
            </div>
          </article>`).join("") : `<div class="ap-empty">ยังไม่มีโปรโมชั่นขั้นสูง</div>`}
      </div>
      <div class="ap-editor"></div>
    </div>`;
  panel.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => action(button.dataset.action, Number(button.dataset.id))));
  if (editing) renderEditor(panel.querySelector(".ap-editor"), editing);
}

function renderEditor(host, rule) {
  host.innerHTML = `
    <form class="ap-form">
      <div class="ap-form-head"><h3>${rule.id ? "แก้ไขโปรโมชั่น" : "เพิ่มโปรโมชั่นใหม่"}</h3><button type="button" data-close>×</button></div>
      <label>ชื่อโปรโมชั่น<input name="name" required maxlength="160" value="${escapeHtml(rule.name)}" placeholder="เช่น เครื่องดื่มครบ 50 ลด 10 ยกเว้นมัทฉะ"></label>
      <div class="ap-two"><label>ยอดขั้นต่ำ (บาท)<input type="number" name="minSpend" min="0" required value="${rule.minSpend}"></label><label>ลำดับการใช้<input type="number" name="priority" min="1" max="9999" value="${rule.priority}"></label></div>
      <fieldset><legend>1. หมวดที่ใช้คำนวณยอดขั้นต่ำ</legend><div class="ap-check-grid">${categoryChecks("conditionCategories", rule.conditionCategories)}</div></fieldset>
      <details><summary>ยกเว้นเมนูออกจากยอดขั้นต่ำ (${rule.conditionExcludedMenuIds.length})</summary><div class="ap-menu-grid">${menuChecks("conditionExcludedMenuIds", rule.conditionExcludedMenuIds)}</div></details>
      <fieldset><legend>2. หมวดที่ได้รับส่วนลด</legend><div class="ap-check-grid">${categoryChecks("targetCategories", rule.targetCategories)}</div></fieldset>
      <details><summary>ยกเว้นเมนูไม่ให้ได้รับส่วนลด (${rule.targetExcludedMenuIds.length})</summary><div class="ap-menu-grid">${menuChecks("targetExcludedMenuIds", rule.targetExcludedMenuIds)}</div></details>
      <div class="ap-two"><label>รูปแบบส่วนลด<select name="discountType"><option value="fixed" ${rule.discountType === "fixed" ? "selected" : ""}>ลดเป็นบาท</option><option value="percent" ${rule.discountType === "percent" ? "selected" : ""}>ลดเป็นเปอร์เซ็นต์</option></select></label><label>จำนวนส่วนลด<input type="number" name="discountValue" min="1" required value="${rule.discountValue}"></label></div>
      <label>ส่วนลดสูงสุด (เว้นว่างได้)<input type="number" name="maxDiscount" min="0" value="${rule.maxDiscount ?? ""}" placeholder="เหมาะสำหรับส่วนลดเปอร์เซ็นต์"></label>
      <div class="ap-switches"><label><input type="checkbox" name="enabled" ${rule.enabled ? "checked" : ""}> เปิดใช้งาน</label><label><input type="checkbox" name="stackable" ${rule.stackable ? "checked" : ""}> ใช้ร่วมกับโปรโมชั่นถัดไปได้</label></div>
      <p class="ap-note">หากไม่เลือกหมวด ระบบจะตีความว่า “ทุกหมวด” รายการยกเว้นจะไม่ถูกนำไปคิดยอดหรือส่วนลด</p>
      <div class="ap-form-actions"><button type="button" data-close>ยกเลิก</button><button class="ap-primary" type="submit">บันทึกโปรโมชั่น</button></div>
    </form>`;
  host.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => { editing = null; renderPanel(host.closest(".ap-panel")); }));
  host.querySelector("form").addEventListener("submit", saveRule);
  host.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function request(path = "", options = {}) {
  const response = await fetch(API + path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "ดำเนินการไม่สำเร็จ");
  return body;
}

async function reload(panel) {
  data = await request();
  renderPanel(panel);
}

async function saveRule(event) {
  event.preventDefault();
  const form = event.currentTarget, values = new FormData(form);
  const payload = {
    name: values.get("name"), minSpend: Number(values.get("minSpend")), priority: Number(values.get("priority")),
    conditionCategories: values.getAll("conditionCategories"), conditionExcludedMenuIds: values.getAll("conditionExcludedMenuIds").map(Number),
    targetCategories: values.getAll("targetCategories"), targetExcludedMenuIds: values.getAll("targetExcludedMenuIds").map(Number),
    discountType: values.get("discountType"), discountValue: Number(values.get("discountValue")),
    maxDiscount: values.get("maxDiscount") === "" ? null : Number(values.get("maxDiscount")),
    enabled: values.has("enabled"), stackable: values.has("stackable")
  };
  const button = form.querySelector("button[type=submit]");
  button.disabled = true; button.textContent = "กำลังบันทึก...";
  try {
    await request(editing.id ? `/${editing.id}` : "", { method: editing.id ? "PUT" : "POST", body: JSON.stringify(payload) });
    editing = null;
    await reload(form.closest(".ap-panel"));
  } catch (error) { alert(error.message); button.disabled = false; button.textContent = "บันทึกโปรโมชั่น"; }
}

async function action(type, id) {
  const panel = document.querySelector(".ap-panel");
  const rule = data.rules.find((item) => item.id === id);
  if (type === "new") { editing = emptyRule(); renderPanel(panel); return; }
  if (type === "edit") { editing = structuredClone(rule); renderPanel(panel); return; }
  if (type === "delete") {
    if (!confirm(`ลบโปรโมชั่น “${rule.name}” หรือไม่?`)) return;
    await request(`/${id}`, { method: "DELETE" }); editing = null; await reload(panel); return;
  }
  if (type === "toggle") {
    await request(`/${id}`, { method: "PUT", body: JSON.stringify({ ...rule, enabled: !rule.enabled }) }); await reload(panel);
  }
}

function installStyles() {
  if (document.getElementById("ap-styles")) return;
  const style = document.createElement("style"); style.id = "ap-styles"; style.textContent = `
    .ap-panel{margin:18px 0;border:1px solid #ead39e;border-radius:24px;background:#fffaf0;overflow:hidden;color:#3f3422}.ap-head{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:20px;border-bottom:1px solid #eee2c8}.ap-head h2{font-size:21px;font-weight:700}.ap-head p{font-size:13px;color:#8f7b56}.ap-kicker{font-weight:800!important;color:#a47718!important;text-transform:uppercase;letter-spacing:.12em}.ap-primary{border:0;border-radius:12px;background:#4e3917!important;color:white!important;padding:10px 15px;font-weight:700;white-space:nowrap}.ap-body{padding:14px}.ap-list{display:grid;gap:9px}.ap-rule{display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid #eadfca;border-radius:16px;background:white;padding:13px}.ap-off{opacity:.55}.ap-rule-main{display:grid;gap:3px}.ap-rule-main span,.ap-rule-main small{color:#8d7957;font-size:12px}.ap-actions{display:flex;gap:6px}.ap-actions button,.ap-form-actions>button:first-child{border:1px solid #ddcfb2;border-radius:10px;background:#fff;padding:7px 10px}.ap-actions .ap-danger{color:#b5473d}.ap-empty{text-align:center;color:#9d8a64;padding:22px}.ap-editor{margin-top:12px}.ap-form{display:grid;gap:13px;border:1px solid #e5d5af;border-radius:18px;background:white;padding:17px}.ap-form-head{display:flex;justify-content:space-between}.ap-form-head h3{font-size:18px;font-weight:700}.ap-form-head button{font-size:25px;color:#8d7957}.ap-form label{display:grid;gap:6px;font-size:13px;font-weight:650}.ap-form input[type=text],.ap-form input[type=number],.ap-form input:not([type]),.ap-form select{height:42px;border:1px solid #dfd3ba;border-radius:11px;padding:0 11px;background:#fff}.ap-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ap-form fieldset,.ap-form details{border:1px solid #eadfca;border-radius:13px;padding:11px}.ap-form legend,.ap-form summary{font-size:13px;font-weight:700;cursor:pointer}.ap-check-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:8px}.ap-check{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;border:1px solid #eee2cc;border-radius:10px;padding:8px}.ap-menu-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;max-height:240px;overflow:auto;margin-top:10px}.ap-menu{display:flex!important;grid-template-columns:auto 1fr!important;align-items:start;padding:7px;border-bottom:1px solid #f1eadc}.ap-menu small{display:block;color:#9c8960;font-weight:400}.ap-switches{display:flex;flex-wrap:wrap;gap:18px}.ap-switches label{display:flex;grid-template-columns:auto 1fr;align-items:center}.ap-note{font-size:12px;color:#8d7957;background:#fff8e7;padding:10px;border-radius:10px}.ap-form-actions{display:flex;justify-content:flex-end;gap:8px}@media(max-width:700px){.ap-head,.ap-rule{align-items:stretch;flex-direction:column}.ap-actions{justify-content:flex-end}.ap-two,.ap-check-grid,.ap-menu-grid{grid-template-columns:1fr}.ap-head .ap-primary{width:100%}}
  `; document.head.appendChild(style);
}

async function mount() {
  const heading = [...document.querySelectorAll("h1")].find((node) => node.textContent.trim() === "จัดการโปรโมชั่น");
  const section = heading?.closest("section");
  if (!section || section.querySelector(".ap-panel")) return;
  installStyles();
  const panel = document.createElement("div"); panel.className = "ap-panel";
  panel.innerHTML = `<div class="ap-empty">กำลังโหลดโปรโมชั่นขั้นสูง...</div>`;
  section.insertBefore(panel, section.children[1] || null);
  try { await reload(panel); } catch (error) { panel.innerHTML = `<div class="ap-empty">${escapeHtml(error.message)}</div>`; }
}

new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
mount();

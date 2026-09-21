const MENU_UX = {
  activeTab: sessionStorage.getItem("toast-menu-active-tab") || "menu-shop",
  activeTarget: sessionStorage.getItem("toast-menu-active-target") || "menu-shop",
  category: sessionStorage.getItem("toast-menu-category") || "all",
  search: "",
};

const TAB_TARGETS = ["menu-shop", "menu-custom", "menu-alias", "menu-delivery"];

function textOf(element) {
  return (element?.textContent || "").trim().toLocaleLowerCase("th");
}

function directGrid(panel) {
  if (!panel) return null;
  return [...panel.children].find((child) => child.matches?.("div.grid")) || null;
}

function addMobileAddButton(panel, label) {
  const grid = directGrid(panel);
  if (!grid || grid.children.length < 2) return;

  const form = grid.children[0];
  const list = grid.children[1];
  form.classList.add("menu-ux-form");
  list.classList.add("menu-ux-list");

  const header = list.firstElementChild;
  if (!header || header.querySelector(".menu-ux-add")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "menu-ux-add";
  button.textContent = `＋ ${label}`;
  button.addEventListener("click", () => form.scrollIntoView({ behavior: "smooth", block: "start" }));
  header.append(button);
}

function productRows(root) {
  return [
    ...root.querySelectorAll("#menu-shop-list > div.divide-y > div"),
    ...root.querySelectorAll("#menu-drinks > div.divide-y > div"),
  ];
}

function decorateActions(root) {
  productRows(root).forEach((row) => {
    row.classList.add("menu-ux-row");
    row.querySelectorAll("button[aria-label]").forEach((button) => {
      const label = button.getAttribute("aria-label") || "";
      if (label.startsWith("แก้ไข")) button.classList.add("menu-ux-edit");
      if (label.startsWith("ลบ")) button.classList.add("menu-ux-delete");
    });
  });
}

function applyProductFilter(root) {
  const shop = root.querySelector("#menu-shop-list");
  const drinks = root.querySelector("#menu-drinks");
  if (shop) shop.hidden = MENU_UX.category === "drinks";
  if (drinks) drinks.hidden = MENU_UX.category === "shop";

  const query = MENU_UX.search.trim().toLocaleLowerCase("th");
  let visible = 0;
  productRows(root).forEach((row) => {
    const categoryHidden = row.closest("#menu-shop-list")?.hidden || row.closest("#menu-drinks")?.hidden;
    const matches = !query || textOf(row).includes(query);
    row.hidden = Boolean(categoryHidden || !matches);
    if (!row.hidden) visible += 1;
  });

  root.querySelectorAll(".menu-ux-filter").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.category === MENU_UX.category));
  });
  const result = root.querySelector(".menu-ux-result");
  if (result) result.textContent = query ? `พบ ${visible} รายการ` : "";
}

function addProductTools(root) {
  const heading = [...root.querySelectorAll("h2")].find((item) => textOf(item) === "รายการเมนู");
  const list = heading?.closest("section");
  if (!list || list.querySelector(".menu-ux-tools")) return;

  const tools = document.createElement("div");
  tools.className = "menu-ux-tools";
  tools.innerHTML = `
    <label class="menu-ux-search">
      <span>ค้นหารายการ</span>
      <input type="search" placeholder="พิมพ์ชื่อเมนู เช่น ชาไทย" autocomplete="off">
    </label>
    <div class="menu-ux-filters" role="group" aria-label="กรองหมวดเมนู">
      <button type="button" class="menu-ux-filter" data-category="all">ทั้งหมด</button>
      <button type="button" class="menu-ux-filter" data-category="shop">เมนูร้าน</button>
      <button type="button" class="menu-ux-filter" data-category="drinks">เครื่องดื่ม</button>
    </div>
    <span class="menu-ux-result" aria-live="polite"></span>`;

  const header = heading.parentElement?.parentElement;
  header?.insertAdjacentElement("afterend", tools);

  const input = tools.querySelector("input");
  input.value = MENU_UX.search;
  input.addEventListener("input", () => {
    MENU_UX.search = input.value;
    applyProductFilter(root);
  });
  tools.querySelectorAll(".menu-ux-filter").forEach((button) => {
    button.addEventListener("click", () => {
      MENU_UX.category = button.dataset.category;
      sessionStorage.setItem("toast-menu-category", MENU_UX.category);
      applyProductFilter(root);
    });
  });
}

function showTab(root, target, { scroll = false } = {}) {
  const normalized = target === "menu-drinks" ? "menu-shop" : target;
  MENU_UX.activeTab = TAB_TARGETS.includes(normalized) ? normalized : "menu-shop";
  MENU_UX.activeTarget = target;
  sessionStorage.setItem("toast-menu-active-tab", MENU_UX.activeTab);
  sessionStorage.setItem("toast-menu-active-target", MENU_UX.activeTarget);

  TAB_TARGETS.forEach((id) => {
    const panel = root.querySelector(`#${id}`);
    if (panel) panel.hidden = id !== MENU_UX.activeTab;
  });

  root.querySelectorAll("nav[aria-label='ทางลัดหน้าจัดการเมนู'] a").forEach((link) => {
    const id = link.getAttribute("href")?.slice(1);
    const selected = id === target || (target === "menu-shop" && id === "menu-shop");
    link.setAttribute("aria-current", selected ? "page" : "false");
  });

  if (target === "menu-drinks") {
    MENU_UX.category = "drinks";
    sessionStorage.setItem("toast-menu-category", "drinks");
  } else if (target === "menu-shop") {
    MENU_UX.category = "all";
    sessionStorage.setItem("toast-menu-category", "all");
  }
  applyProductFilter(root);

  if (scroll) {
    const destination = target === "menu-drinks" ? root.querySelector("#menu-drinks") : root.querySelector(`#${MENU_UX.activeTab}`);
    requestAnimationFrame(() => destination?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function enhanceMenuManagement() {
  const nav = document.querySelector("nav[aria-label='ทางลัดหน้าจัดการเมนู']");
  const root = nav?.closest("section");
  if (!nav || !root) return;

  root.classList.add("menu-ux-root");
  nav.classList.add("menu-ux-tabs");
  nav.querySelectorAll("a[href^='#menu-']").forEach((link) => {
    if (link.dataset.menuUxBound) return;
    link.dataset.menuUxBound = "true";
    link.setAttribute("role", "tab");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = link.getAttribute("href").slice(1);
      showTab(root, target, { scroll: true });
    });
  });

  TAB_TARGETS.forEach((id) => root.querySelector(`#${id}`)?.classList.add("menu-ux-panel"));
  addProductTools(root);
  addMobileAddButton(root.querySelector("#menu-shop"), "เพิ่มสินค้า");
  addMobileAddButton(root.querySelector("#menu-custom"), "เพิ่มตัวเลือก");
  addMobileAddButton(root.querySelector("#menu-alias"), "เพิ่มคำเรียกแทน");
  addMobileAddButton(root.querySelector("#menu-delivery"), "เพิ่มพื้นที่");
  decorateActions(root);

  if (!root.dataset.menuUxBound) {
    root.dataset.menuUxBound = "true";
    root.addEventListener("click", (event) => {
      const editButton = event.target.closest(".menu-ux-edit");
      if (!editButton) return;
      const form = root.querySelector("#menu-shop .menu-ux-form");
      setTimeout(() => form?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    });
  }

  const hashTarget = location.hash.slice(1);
  const initial = ["menu-shop", "menu-drinks", "menu-custom", "menu-alias", "menu-delivery"].includes(hashTarget)
    ? hashTarget
    : MENU_UX.activeTarget;
  showTab(root, initial);
}

let menuUxScheduled = false;
function scheduleMenuEnhancement() {
  if (menuUxScheduled) return;
  menuUxScheduled = true;
  requestAnimationFrame(() => {
    menuUxScheduled = false;
    enhanceMenuManagement();
  });
}

new MutationObserver(scheduleMenuEnhancement).observe(document.body, { childList: true, subtree: true });
scheduleMenuEnhancement();

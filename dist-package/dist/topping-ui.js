function decorateToppingPickers() {
  document.querySelectorAll("h3").forEach((heading) => {
    if (heading.textContent.trim() !== "2. ท็อปปิ้ง") return;
    const section = heading.closest("section");
    if (!section) return;

    section.classList.add("topping-picker");
    const header = heading.parentElement;
    let count = header.querySelector(".topping-selected-count");
    if (!count) {
      count = document.createElement("span");
      count.className = "topping-selected-count";
      header.appendChild(count);
    }

    const selectedCount = section.querySelectorAll('button[aria-pressed="true"]').length;
    const nextText = selectedCount ? `เลือกแล้ว ${selectedCount} รายการ` : "ยังไม่ได้เลือกท็อปปิ้ง";
    if (count.textContent !== nextText) count.textContent = nextText;

    const groups = section.querySelector(":scope > div.space-y-4");
    [...(groups?.children ?? [])].forEach((group, index) => {
      group.classList.add("topping-price-group", index === 0 ? "is-five" : "is-ten");
    });
  });
}

let scheduled = false;
const scheduleDecoration = () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    decorateToppingPickers();
  });
};

new MutationObserver(scheduleDecoration).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["aria-pressed"]
});

decorateToppingPickers();

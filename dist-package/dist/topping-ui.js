function decorateToppingPickers() {
  document.querySelectorAll("h3").forEach((heading) => {
    if (heading.textContent.trim() !== "2. ท็อปปิ้ง") return;
    const section = heading.closest("section");
    if (!section) return;

    section.classList.add("topping-picker");
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

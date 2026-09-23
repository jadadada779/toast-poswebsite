(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ToastPromotionEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const number = (value) => Math.max(0, Number(value) || 0);
  const ids = (value) => new Set((Array.isArray(value) ? value : []).map(Number));

  function itemToppings(item) {
    if (Array.isArray(item?.toppings)) return item.toppings.filter((name) => typeof name === "string");
    try {
      const parsed = JSON.parse(item?.toppingsJson || "[]");
      return Array.isArray(parsed) ? parsed.filter((name) => typeof name === "string") : [];
    } catch {
      return [];
    }
  }

  function optionMaps(options) {
    const toppings = (Array.isArray(options) ? options : []).filter((option) => option?.type === "topping" || option?.type == null);
    return {
      byId: new Map(toppings.map((option) => [Number(option.id), option])),
      byName: new Map(toppings.map((option) => [String(option.name), option]))
    };
  }

  function selectedToppingNames(ruleIds, maps) {
    return new Set([...ids(ruleIds)].map((id) => maps.byId.get(id)?.name).filter(Boolean));
  }

  function matchesCategory(item, categories, excludedMenuIds) {
    const selectedCategories = Array.isArray(categories) ? categories : [];
    const excluded = ids(excludedMenuIds);
    return (selectedCategories.length === 0 || selectedCategories.includes(item.category)) && (!item.menuItemId || !excluded.has(Number(item.menuItemId)));
  }

  function spendAmount(items, categories, excludedMenuIds) {
    return items.filter((item) => matchesCategory(item, categories, excludedMenuIds))
      .reduce((sum, item) => sum + number(item.unitPrice) * number(item.quantity), 0);
  }

  function menuQuantity(items, menuIds) {
    const selected = ids(menuIds);
    return items.filter((item) => selected.has(Number(item.menuItemId)))
      .reduce((sum, item) => sum + number(item.quantity), 0);
  }

  function toppingUnits(items, names, maps) {
    const units = [];
    for (const item of items) {
      const quantity = Math.max(1, Math.trunc(number(item.quantity) || 1));
      const selected = itemToppings(item);
      for (let count = 0; count < quantity; count += 1) {
        let freeFiveUsed = false;
        for (const name of selected) {
          const listedPrice = number(maps.byName.get(name)?.price);
          const price = item.breadType && listedPrice === 5 && !freeFiveUsed ? 0 : listedPrice;
          if (item.breadType && listedPrice === 5 && !freeFiveUsed) freeFiveUsed = true;
          if (names && !names.has(name)) continue;
          units.push(price);
        }
      }
    }
    return units;
  }

  function conditionPassed(rule, items, maps) {
    const mode = rule.conditionMode || "spend";
    if (mode === "menu") return menuQuantity(items, rule.conditionMenuIds) >= Math.max(1, number(rule.conditionMinQuantity));
    if (mode === "topping") {
      const names = selectedToppingNames(rule.conditionToppingIds, maps);
      if (!names.size) return false;
      return toppingUnits(items, names, maps).length >= Math.max(1, number(rule.conditionMinQuantity));
    }
    return spendAmount(items, rule.conditionCategories, rule.conditionExcludedMenuIds) >= number(rule.minSpend);
  }

  function target(rule, items, maps) {
    const mode = rule.targetMode || "categories";
    if (mode === "menu") {
      const selected = ids(rule.targetMenuIds);
      const amount = items.filter((item) => selected.has(Number(item.menuItemId)))
        .reduce((sum, item) => sum + number(item.unitPrice) * number(item.quantity), 0);
      return { amount, unitCount: amount > 0 ? 1 : 0 };
    }
    if (mode === "topping_all" || mode === "topping_selected") {
      const names = mode === "topping_selected" ? selectedToppingNames(rule.targetToppingIds, maps) : null;
      if (mode === "topping_selected" && !names.size) return { amount: 0, unitCount: 0 };
      const units = toppingUnits(items, names, maps).filter((price) => price > 0);
      if (!units.length) return { amount: 0, unitCount: 0 };
      if (rule.applicationMode === "each") return { amount: units.reduce((sum, price) => sum + price, 0), unitCount: units.length };
      return { amount: Math.min(...units), unitCount: 1 };
    }
    const amount = spendAmount(items, rule.targetCategories, rule.targetExcludedMenuIds);
    return { amount, unitCount: amount > 0 ? 1 : 0 };
  }

  function flexibleDiscount(rule, items, maps) {
    if (!conditionPassed(rule, items, maps)) return 0;
    const eligible = target(rule, items, maps);
    if (eligible.amount <= 0) return 0;
    let discount;
    if (rule.discountType === "percent") discount = Math.floor(eligible.amount * number(rule.discountValue) / 100);
    else discount = number(rule.discountValue) * (rule.applicationMode === "each" && String(rule.targetMode || "").startsWith("topping_") ? eligible.unitCount : 1);
    if (rule.maxDiscount != null) discount = Math.min(discount, number(rule.maxDiscount));
    return Math.max(0, Math.min(discount, eligible.amount));
  }

  function calculate(items, promotions, subtotal, options) {
    const cart = Array.isArray(items) ? items : [];
    const maps = optionMaps(options);
    const applied = [];
    const sorted = (Array.isArray(promotions) ? promotions : []).filter((rule) => rule.enabled)
      .sort((left, right) => (left.priority ?? left.id) - (right.priority ?? right.id));
    let remaining = number(subtotal);
    for (const rule of sorted) {
      let discount = 0;
      if (rule.type === "flexible") discount = flexibleDiscount(rule, cart, maps);
      if (rule.type === "min_spend" && number(rule.minSpend) > 0 && number(subtotal) >= number(rule.minSpend)) discount = number(rule.discountAmount);
      if (rule.type === "category_spend" && rule.targetCategory && number(rule.minSpend) > 0) {
        const categories = rule.qualifyingCategories?.length ? rule.qualifyingCategories : rule.qualifyingCategory ? [rule.qualifyingCategory] : [];
        const qualifying = cart.filter((item) => categories.includes(item.category)).reduce((sum, item) => sum + number(item.unitPrice) * number(item.quantity), 0);
        const eligible = cart.filter((item) => item.category === rule.targetCategory).reduce((sum, item) => sum + number(item.unitPrice) * number(item.quantity), 0);
        if (qualifying >= number(rule.minSpend) && eligible > 0) discount = Math.min(number(rule.discountAmount), eligible);
      }
      if (rule.type === "bundle" && rule.firstMenuId) {
        const first = cart.find((item) => item.menuItemId === rule.firstMenuId)?.quantity ?? 0;
        const second = rule.secondCategory
          ? cart.filter((item) => item.category === rule.secondCategory).reduce((sum, item) => sum + number(item.quantity), 0)
          : rule.secondMenuId ? cart.find((item) => item.menuItemId === rule.secondMenuId)?.quantity ?? 0 : 0;
        if (first > 0 && second > 0) discount = number(rule.discountAmount) * Math.min(first, second);
      }
      discount = Math.max(0, Math.min(discount, remaining));
      if (discount > 0) {
        applied.push({ id: rule.id, name: rule.name, amount: discount });
        remaining -= discount;
      }
      if (discount > 0 && rule.type === "flexible" && !rule.stackable) break;
    }
    return { discount: number(subtotal) - remaining, applied };
  }

  return { calculate, conditionPassed, flexibleDiscount };
});

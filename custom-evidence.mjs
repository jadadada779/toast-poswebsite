// Check model suggestions against names and shop-specific aliases before adding items.
const normalize = (value) => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[\s+\-_/,. '"“”()]+/g, "");

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = old;
    }
  }
  return row[b.length];
}

export function verifyCustomSuggestions(text, options, aliases, suggestedBread, suggestedToppings) {
  const input = normalize(text);
  const names = new Map(options.map((option) => [option.name, option]));
  const suggested = new Set([suggestedBread, ...(Array.isArray(suggestedToppings) ? suggestedToppings : [])]);
  const terms = options.flatMap((option) => [option.name, ...aliases.filter((alias) => alias.customOptionId === option.id).map((alias) => alias.alias)]
    .map((term) => ({ name: option.name, term: normalize(term) })).filter(({ term }) => term.length >= 2));
  const matches = terms.flatMap(({ name, term }) => {
    const found = [];
    for (let i = 0; i <= input.length - term.length; i++) {
      if (input.slice(i, i + term.length) === term) found.push({ name, start: i, end: i + term.length, term });
    }
    // A single typo is tolerated only for sufficiently distinctive names.
    if (!found.length && suggested.has(name) && term.length >= 7 && term.length <= 40) {
      for (const length of [term.length - 1, term.length, term.length + 1]) {
        for (let i = 0; i + length <= input.length; i++) {
          if (distance(input.slice(i, i + length), term) <= 1) found.push({ name, start: i, end: i + length, term });
        }
      }
    }
    return found;
  });
  // A short name inside a longer matched product is not a second product.
  const supported = new Set(matches.filter((match) => {
    if (/(?:ไม่เอา|ไม่ใส่|ไม่ต้อง|งด|เอาออก)$/.test(input.slice(Math.max(0, match.start - 8), match.start))) return false;
    if (matches.some((other) => other.name !== match.name && other.start === match.start && other.end === match.end)) return false;
    return !matches.some((other) => other.name !== match.name && other.start <= match.start && other.end >= match.end && (other.start < match.start || other.end > match.end));
  }).map((match) => match.name));
  const breadType = names.get(suggestedBread)?.type === "bread" && supported.has(suggestedBread) ? suggestedBread : null;
  const toppings = [...new Set(Array.isArray(suggestedToppings) ? suggestedToppings : [])]
    .filter((name) => names.get(name)?.type === "topping" && supported.has(name));
  // Explicit '+' lists can contain two related products even if the model omitted one.
  // Require an entire segment to equal a unique catalog name or alias before recovering it.
  if (/[+＋]/.test(text)) {
    for (const segment of text.split(/[+＋]/).map(normalize)) {
      const exact = new Set(terms.filter(({ term }) => term === segment).map(({ name }) => name));
      if (exact.size !== 1) continue;
      const [name] = exact;
      if (names.get(name)?.type === "topping" && supported.has(name) && !toppings.includes(name)) toppings.push(name);
    }
  }
  return { breadType, toppings };
}

// Check model suggestions against names and shop-specific aliases before adding items.
const normalize = (value) => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[\s+\-_/,. '"“”()]+/g, "");

// Common spoken spellings. Only attach these to a matching catalog item, so
// they cannot create a product that the shop has not configured.
const spokenNames = [
  { catalog: /^(?:ฮันนี่โทส(?:ต์)?|honeytoast)$/i, aliases: ["ฮันนี่โทส", "ฮันนี่โทสต์", "ฮันนี่โทสท์", "ฮันนี่โท"] },
  { catalog: /^(?:คอร์นเฟลก(?:ส์)?|คอนเฟลก|cornflakes?)$/i, aliases: ["คอนเฟค", "คอนเฟลก", "คอร์นเฟค", "คอร์นเฟลก", "คอนเฟล็ก"] },
  { catalog: /^(?:โกโก้ครั้?น(?:ช์|ซ์)?|cocoacrunch)$/i, aliases: ["โกโก้คัน", "โกโก้ครัน", "โกโก้ครั้น", "โกโก้ครันช์", "โกโก้ครั้นช์", "โกโก้ครันซ์", "โกโก้ครั้นซ์"] },
  { catalog: /^(?:นมข้นหวาน|นมข้น)$/i, aliases: ["นมข้น", "นมข้นหวาน"] },
  { catalog: /^(?:ซอสช็อกโกแลต|ช็อกโกแลต)$/i, aliases: ["ช็อกโกแลต", "ช็อคโกแลต", "ซอสช็อกโกแลต"] }
];

function termsFor(option, aliases) {
  const spoken = spokenNames.find(({ catalog }) => catalog.test(normalize(option.name)))?.aliases ?? [];
  return [option.name, ...aliases.filter((alias) => alias.customOptionId === option.id).map((alias) => alias.alias), ...spoken]
    .map(normalize).filter((term) => term.length >= 2);
}

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
  const terms = options.flatMap((option) => termsFor(option, aliases)
    .map((term) => ({ name: option.name, term })));
  const matches = terms.flatMap(({ name, term }) => {
    const found = [];
    for (let i = 0; i <= input.length - term.length; i++) {
      if (input.slice(i, i + term.length) === term) found.push({ name, start: i, end: i + term.length, term });
    }
    // A single typo is tolerated only for sufficiently distinctive names.
    if (!found.length && suggested.has(name) && term.length >= 7 && term.length <= 40) {
      for (const length of [term.length - 1, term.length, term.length + 1]) {
        for (let i = 0; i + length <= input.length; i++) {
          if (distance(input.slice(i, i + length), term) <= 1) found.push({ name, start: i, end: i + length, term, fuzzy: true });
        }
      }
    }
    return found;
  });
  // A short name inside a longer matched product is not a second product.
  const supportedMatches = matches.filter((match) => {
    if (/(?:ไม่เอา|ไม่ใส่|ไม่ต้อง|งด|เอาออก)$/.test(input.slice(Math.max(0, match.start - 8), match.start))) return false;
    if (matches.some((other) => other.name !== match.name && other.start === match.start && other.end === match.end)) return false;
    return !matches.some((other) => other.name !== match.name && other.start <= match.start && other.end >= match.end && (other.start < match.start || other.end > match.end));
  });
  const supported = new Set(supportedMatches.map((match) => match.name));
  // A direct catalog name or a known alias is stronger evidence than a model
  // omission. Prefer the first explicitly mentioned bread when one is present.
  const explicit = supportedMatches.filter((match) => !match.fuzzy);
  const breadType = names.get(suggestedBread)?.type === "bread" && supported.has(suggestedBread)
    ? suggestedBread
    : explicit.find((match) => names.get(match.name)?.type === "bread")?.name ?? null;
  const toppings = [...new Set(Array.isArray(suggestedToppings) ? suggestedToppings : [])]
    .filter((name) => names.get(name)?.type === "topping" && supported.has(name));
  for (const match of explicit) {
    if (names.get(match.name)?.type === "topping" && !toppings.includes(match.name)) toppings.push(match.name);
  }
  return { breadType, toppings };
}

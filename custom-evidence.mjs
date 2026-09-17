// Check model suggestions against names and shop-specific aliases before adding items.
const normalize = (value) => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[\s+\-_/,. '"“”()]+/g, "");

// Common spoken / misspelled names. Aliases only attach to an item that
// already exists in the shop catalog, so they cannot invent new products.
const spokenNames = [
  { catalog: /^(?:ฮันนี่โทส(?:ต์)?|honeytoast)$/i, aliases: ["ฮันนี่โทส", "ฮันนี่โทสต์", "ฮันนี่โทสท์", "ฮันนี่โท", "honey toast"] },
  { catalog: /^(?:เฟรน(?:ช์?)?โทส(?:ต์)?|frenchtoast)$/i, aliases: ["เฟรนโทสต์", "เฟรนโทส", "เฟรนช์โทสต์", "french toast", "frenchtoast"] },
  { catalog: /^(?:คอร์นเฟลก(?:ส์)?|คอนเฟลก|cornflakes?)$/i, aliases: ["คอนเฟค", "คอนเฟลก", "คอร์นเฟค", "คอร์นเฟลก", "คอนเฟล็ก"] },
  { catalog: /^(?:โกโก้ครั้?น(?:ช์|ซ์)?|cocoacrunch)$/i, aliases: ["โกโก้คัน", "โกโก้ครัน", "โกโก้ครั้น", "โกโก้ครันช์", "โกโก้ครั้นช์", "โกโก้ครันซ์", "โกโก้ครั้นซ์", "cocoa crunch"] },
  { catalog: /^(?:โอวัลตินเฟลก(?:ส์)?|ovaltineflakes?)$/i, aliases: ["โอวัลตินเฟค", "โอวัลตินเฟลก", "โอวัลตินเฟลค", "ovaltine flakes", "ovaltine flake"] },
  { catalog: /^(?:ครีมโอ|creamo)$/i, aliases: ["ครีมโอ", "ครีมโอ้", "cream o", "creamo", "crem o", "cremo"] },
  { catalog: /^(?:ช็อกโกแลตเฮเซลนัท|chocolatehazelnut)$/i, aliases: ["ช็อกโกแลตเฮเซลนัท", "ช็อคโกแลตเฮเซลนัท", "chocolate hazelnut", "chocolet hazelnut", "choc hazelnut", "chocolate hazel nut"] },
  { catalog: /^(?:ซอสคาราเมล|คาราเมล|caramel(?:sauce)?)$/i, aliases: ["คาราเมล", "ซอสคาราเมล", "caramel", "caramel sauce"] },
  { catalog: /^(?:นมข้นหวาน|นมข้น)$/i, aliases: ["นมข้น", "นมข้นหวาน"] },
  { catalog: /^(?:ซอสช็อกโกแลต|ช็อกโกแลต)$/i, aliases: ["ช็อกโกแลต", "ช็อคโกแลต", "ซอสช็อกโกแลต"] }
];

function termsFor(option, aliases) {
  const normalizedName = normalize(option.name);
  const spoken = spokenNames.find(({ catalog }) => catalog.test(normalizedName))?.aliases ?? [];
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

function maxTypoDistance(term) {
  if (term.length < 5) return 0;
  if (term.length <= 8) return 1;
  if (term.length <= 16) return 2;
  return 3;
}

function fuzzyMatches(input, name, term) {
  const allowed = maxTypoDistance(term);
  if (!allowed) return [];
  const found = [];
  for (let delta = -allowed; delta <= allowed; delta++) {
    const length = term.length + delta;
    if (length < 4) continue;
    for (let i = 0; i + length <= input.length; i++) {
      if (distance(input.slice(i, i + length), term) <= allowed) {
        found.push({ name, start: i, end: i + length, term, fuzzy: true });
      }
    }
  }
  return found;
}

export function verifyCustomSuggestions(text, options, aliases, suggestedBread, suggestedToppings) {
  const input = normalize(text);
  const names = new Map(options.map((option) => [option.name, option]));
  const terms = options.flatMap((option) => termsFor(option, aliases)
    .map((term) => ({ name: option.name, term })));

  const matches = terms.flatMap(({ name, term }) => {
    const found = [];
    for (let i = 0; i <= input.length - term.length; i++) {
      if (input.slice(i, i + term.length) === term) {
        found.push({ name, start: i, end: i + term.length, term });
      }
    }
    // Recover typoed items even when the AI completely omitted them.
    return found.length ? found : fuzzyMatches(input, name, term);
  });

  const supportedMatches = matches.filter((match) => {
    // Respect negative phrases such as "ไม่เอา..." when present.
    if (/(?:ไม่เอา|ไม่ใส่|ไม่ต้อง|งด|เอาออก)$/.test(input.slice(Math.max(0, match.start - 8), match.start))) return false;

    // Explicit evidence wins over a fuzzy match covering the same region.
    if (matches.some((other) =>
      other.name !== match.name &&
      !other.fuzzy && match.fuzzy &&
      other.start <= match.start && other.end >= match.end
    )) return false;

    // Do not interpret a shorter product name contained inside a longer one
    // as an additional product.
    return !matches.some((other) =>
      other.name !== match.name &&
      other.start <= match.start && other.end >= match.end &&
      (other.start < match.start || other.end > match.end) &&
      (!other.fuzzy || match.fuzzy)
    );
  });

  const supported = new Set(supportedMatches.map((match) => match.name));
  const explicit = supportedMatches.filter((match) => !match.fuzzy);

  const breadType = names.get(suggestedBread)?.type === "bread" && supported.has(suggestedBread)
    ? suggestedBread
    : (explicit.find((match) => names.get(match.name)?.type === "bread")
      ?? supportedMatches.find((match) => names.get(match.name)?.type === "bread"))?.name ?? null;

  // Keep valid model suggestions and then recover every catalog-backed topping
  // actually found in the customer's text.
  const toppings = [...new Set(Array.isArray(suggestedToppings) ? suggestedToppings : [])]
    .filter((name) => names.get(name)?.type === "topping" && supported.has(name));

  for (const match of supportedMatches) {
    if (names.get(match.name)?.type === "topping" && !toppings.includes(match.name)) {
      toppings.push(match.name);
    }
  }

  return { breadType, toppings };
}

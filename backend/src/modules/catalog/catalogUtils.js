export const normalizeCatalogName = (value = "") => {
  if (value === null || value === undefined) return "";

  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const pickPreferredCatalogName = (currentName = "", incomingName = "") => {
  const first = String(currentName || "").trim();
  const second = String(incomingName || "").trim();

  if (!first) return second;
  if (!second) return first;

  const firstNorm = normalizeCatalogName(first);
  const secondNorm = normalizeCatalogName(second);

  if (!firstNorm) return second;
  if (!secondNorm) return first;

  const firstWords = firstNorm.split(" ").filter(Boolean).length;
  const secondWords = secondNorm.split(" ").filter(Boolean).length;

  if (secondWords > firstWords) return second;
  if (secondWords < firstWords) return first;
  if (secondNorm.length > firstNorm.length) return second;

  return first;
};

export const mergeCatalogValues = (existing = {}, incoming = {}) => {
  const base = existing || {};
  const next = incoming || {};
  const preferredName = pickPreferredCatalogName(base.name, next.name);

  const currentPrice = Number(base.price ?? base.sellingPrice ?? 0) || 0;
  const incomingPrice = Number(next.price ?? next.sellingPrice ?? 0) || 0;
  const preferredPrice = currentPrice && incomingPrice ? Math.max(currentPrice, incomingPrice) : (currentPrice || incomingPrice);

  const currentCost = Number(base.costPrice || 0) || 0;
  const incomingCost = Number(next.costPrice || 0) || 0;
  const preferredCost = currentCost && incomingCost ? Math.min(currentCost, incomingCost) : (currentCost || incomingCost);

  const mergedStock = (Number(base.stock || 0) || 0) + (Number(next.stock || 0) || 0);

  return {
    ...base,
    ...next,
    name: preferredName || base.name || next.name,
    price: preferredPrice || 0,
    costPrice: preferredCost || 0,
    stock: mergedStock
  };
};

export const findCatalogMatch = (items = [], incomingName = "") => {
  const target = normalizeCatalogName(incomingName);
  if (!target) return null;

  let bestMatch = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const item of items) {
    const candidate = normalizeCatalogName(item?.name || "");
    if (!candidate) continue;
    if (candidate === target) return item;

    const score = Math.abs(candidate.length - target.length);
    if ((candidate.includes(target) || target.includes(candidate)) && score < bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
};

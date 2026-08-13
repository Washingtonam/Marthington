export const getOutgoingStockDelta = (items = []) => {
  const totals = new Map();

  for (const item of items || []) {
    if (!item || !item.product) continue;

    const productId = String(item.product);
    const quantity = Number(item.quantity || 0);

    if (quantity <= 0) continue;

    totals.set(productId, (totals.get(productId) || 0) + quantity);
  }

  return Array.from(totals.entries()).map(([product, quantity]) => ({
    product,
    quantity
  }));
};

export const validateOutgoingStockAvailability = (availableByProduct = {}, items = []) => {
  const delta = getOutgoingStockDelta(items);
  const issues = [];

  for (const entry of delta) {
    const available = Number(availableByProduct[entry.product] || 0);
    if (available < entry.quantity) {
      issues.push({
        product: entry.product,
        required: entry.quantity,
        available
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
};

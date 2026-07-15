(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ReadingHutExchange = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function getExchangeOutcome(balance, price) {
    const current = Number(balance);
    const cost = Number(price);
    const canAfford = current >= cost;

    return {
      canAfford: canAfford,
      missing: Math.max(cost - current, 0),
      remaining: canAfford ? current - cost : current,
    };
  }

  return {
    getExchangeOutcome: getExchangeOutcome,
  };
});

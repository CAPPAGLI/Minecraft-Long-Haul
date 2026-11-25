// Reduce all inventory stack sizes by 5x (rounded up: ceil(maxStackSize / 5)).
// Tools/armor with maxStackSize=1 stay 1; 16 -> 4; 64 -> 13.
ItemEvents.modification(function (event) {
  event.modify('*', function (item) {
    try {
      var cur = Number(item.maxStackSize || 64);
      if (cur > 1) {
        var next = Math.max(1, Math.ceil(cur / 5));
        if (next !== cur) {
          item.maxStackSize = next;
        }
      }
    } catch (eStackMod) {}
  });
});

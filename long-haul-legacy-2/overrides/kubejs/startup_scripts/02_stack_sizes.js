// Reduce all inventory stack sizes by 5x (rounded up: ceil(maxStackSize / 5)).
// Tools/armor with maxStackSize=1 stay 1; 16 -> 4; 64 -> 13.
// Note: longhaul:* items already register their 5x-reduced maxStackSize in 01_longhaul_items.js.
ItemEvents.modification(function (event) {
  var seen = {};
  event.modify('*', function (item) {
    try {
      var iid = '';
      try { iid = String(item.id || ''); } catch (eId) {}
      var desc = '';
      try { desc = String(item.descriptionId || (typeof item.getDescriptionId === 'function' ? item.getDescriptionId() : '') || ''); } catch (eDesc) {}
      if (iid.indexOf('longhaul:') === 0 || desc.indexOf('.longhaul.') !== -1) return;
      var key = iid || desc;
      if (key && seen[key]) return;
      if (key) seen[key] = true;
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

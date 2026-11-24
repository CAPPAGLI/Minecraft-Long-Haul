// Long Haul Legacy 2.0: Native Xaero's World Map & Minimap sector/border sync receiver.
NetworkEvents.dataReceived('lh:xaero_territories', function (event) {
  try {
    if (!event || !event.data) return;
    var raw = String(event.data.getString('json') || '');
    if (!raw) return;
    var Bridge = Java.loadClass('longhaul.runtime.xaero.LongHaulXaeroData');
    if (Bridge && typeof Bridge.updateFromJson === 'function') {
      Bridge.updateFromJson(raw);
    }
  } catch (eXaero) {}
});

// Long Haul Legacy 2.0 alpha: pure server contract state machine.
// Measures accepted deliveries, NOT proof that items were manufactured locally.
global.LHContractEngine = (function () {
  function begin(id, spec) {
    return { id: id, status: 'active', seconds: 0, windows: 0, current: {}, totals: {} };
  }
  function remaining(job, spec) {
    var out = {};
    Object.keys(spec.goods).forEach(function (item) {
      out[item] = Math.max(0, spec.goods[item] - (job.current[item] || 0));
    });
    return out;
  }
  function step(job, spec, accepted, loaded) {
    if (job.status !== 'active' || !loaded) return job;
    Object.keys(spec.goods).forEach(function (item) {
      var n = accepted[item] || 0;
      if (n < 0 || n !== Math.floor(n) || n > spec.goods[item] - (job.current[item] || 0))
        throw new Error('Invalid accepted amount for ' + item);
      job.current[item] = (job.current[item] || 0) + n;
      job.totals[item] = (job.totals[item] || 0) + n;
    });
    job.seconds++;
    var filled = Object.keys(spec.goods).every(function (i) { return job.current[i] >= spec.goods[i]; });
    if (!spec.windowSeconds) {
      if (filled) job.status = 'complete';
      return job;
    }
    if (job.seconds >= spec.windowSeconds) {
      if (!filled) { job.status = 'failed'; return job; }
      job.windows++;
      job.seconds = 0;
      job.current = {};
      if (job.windows >= spec.windows) job.status = 'complete';
    }
    return job;
  }
  return { begin: begin, remaining: remaining, step: step };
})();

global.LHContracts = {
  plates: { title: 'Первая партия пластин', goods: { 'create:iron_sheet': 64 } },
  brass: { title: 'Латунный заказ', goods: { 'create:brass_ingot': 32 } },
  rails: { title: 'Снабжение путейцев', goods: { 'create:track': 128 } },
  provisions: { title: 'Продовольственный склад', goods: { 'minecraft:bread': 32, 'minecraft:baked_potato': 32 } },
  mechanisms: { title: 'Приборы для депо', goods: { 'create:precision_mechanism': 8 } },
  plate_shift: { title: 'Ритм поставки пластин', goods: { 'create:iron_sheet': 16 }, windowSeconds: 60, windows: 3 },
  food_shift: { title: 'Регулярное снабжение', goods: { 'minecraft:bread': 8, 'minecraft:baked_potato': 8 }, windowSeconds: 60, windows: 3 },
  rail_shift: { title: 'Снабжение магистрали', goods: { 'create:track': 32, 'create:iron_sheet': 8 }, windowSeconds: 60, windows: 5 }
};

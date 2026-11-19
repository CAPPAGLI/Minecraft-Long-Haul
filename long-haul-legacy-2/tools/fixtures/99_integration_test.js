// TEST WORLD ONLY — deliberately not distributed in overrides.
var LHIntegrationVerify = null;

ServerEvents.tick(function (event) {
  if (LHClock >= 60 && LHIntegrationVerify) {
    var verify = LHIntegrationVerify;
    LHIntegrationVerify = null;
    verify();
  }
});

ServerEvents.loaded(function (event) {
  var server = event.server;
  var ok = function (v, msg) { if (!v) throw new Error(msg); };
  try {
    // 1. Custom items registered
    ok(!Item.of('longhaul:ore_concentrate', 1).empty, 'longhaul:ore_concentrate registered');
    ok(!Item.of('longhaul:treated_timber', 1).empty, 'longhaul:treated_timber registered');
    ok(!Item.of('longhaul:cargo_manifest', 1).empty, 'longhaul:cargo_manifest registered');
    ok(!Item.of('longhaul:continental_module', 1).empty, 'longhaul:continental_module registered');

    // 2. Barrel extraction & contract engine
    server.runCommandSilent('forceload add 0 0');
    var overworld = server.getLevel('minecraft:overworld');
    var b = overworld.getBlock(0, 80, 0);
    b.set('minecraft:air');
    b.set('minecraft:barrel');
    var inv = b.inventory;
    ok(inv.slots === 27, 'barrel slots');
    ok(inv.isEmpty(), 'barrel initially empty');
    inv.setStackInSlot(0, Item.of('create:iron_sheet', 64));
    ok(inv.getStackInSlot(0).count === 64, 'insert/get inventory');
    var taken = inv.extractItem(0, 16, false);
    ok(taken.count === 16, 'actual extraction');
    ok(inv.getStackInSlot(0).count === 48, 'actual remainder');

    var spec = global.LHContracts.plate_shift;
    var j = global.LHContractEngine.begin('plate_shift', spec);
    for (var n = 0; n < 180; n++) {
      global.LHContractEngine.step(j, spec, n % 60 === 0 ? { 'create:iron_sheet': 16 } : {}, true);
    }
    ok(j.status === 'complete' && j.totals['create:iron_sheet'] === 48, 'timed job');

    server.persistentData.putString('lh_integration_result', JSON.stringify({ ok: true, consumed: 16, timedJob: j.status }));
    ok(JSON.parse(String(server.persistentData.getString('lh_integration_result'))).ok, 'persistentData roundtrip');

    var db = lhRead(server);
    ok(db.players !== undefined, 'adapter state loaded');
    lhSave(server);
    ok(String(server.persistentData.getString('longhaul_contracts_v1')).length > 0, 'adapter persistent save');

    for (var slot = 0; slot < inv.slots; slot++) inv.setStackInSlot(slot, Item.empty);
    var actor = {
      uuid: '00000000-0000-4000-8000-000000000001',
      level: overworld,
      x: 0.5, y: 81, z: 0.5,
      mainHandItem: Item.empty,
      give: function () {},
      tell: function () {},
      isAdvancementDone: function () { return false; },
      unlockAdvancement: function () {}
    };
    delete db.players[String(actor.uuid)];
    ok(lhRegister(server, actor) === 1, 'actual adapter register');
    ok(lhAccept(server, actor, 'plates') === 1, 'actual adapter accept');
    inv.setStackInSlot(0, Item.of('create:iron_sheet', 64));

    // Timed shift live persistence actor
    var b2 = overworld.getBlock(2, 80, 0);
    b2.set('minecraft:barrel');
    for (var s2 = 0; s2 < b2.inventory.slots; s2++) b2.inventory.setStackInSlot(s2, Item.empty);
    var shiftActor = {
      uuid: '00000000-0000-4000-8000-000000000004',
      level: overworld,
      x: 2.5, y: 81, z: 0.5,
      tell: function () {},
      isAdvancementDone: function () { return false; },
      unlockAdvancement: function () {}
    };
    delete db.players[String(shiftActor.uuid)];
    ok(lhRegister(server, shiftActor) === 1, 'shift actor register');
    ok(lhAccept(server, shiftActor, 'plate_shift') === 1, 'shift actor accept');
    b2.inventory.setStackInSlot(0, Item.of('create:iron_sheet', 16));

    LHIntegrationVerify = function () {
      try {
        // 3. Live tick contract completion + timed shift tick progress + reload persistence
        var profile = lhProfile(server, actor);
        ok(profile.job.status === 'complete', 'live tick completion ' + JSON.stringify(profile));
        ok(profile.receipts.plates.totals['create:iron_sheet'] === 64, 'receipt quantity');
        ok(inv.isEmpty(), 'goods consumed by real adapter');

        var shiftProf = lhProfile(server, shiftActor);
        ok(shiftProf.job.status === 'active' && shiftProf.job.seconds >= 1 && shiftProf.job.totals['create:iron_sheet'] === 16,
           'timed shift consumed first window quota and ticked: ' + JSON.stringify(shiftProf.job));
        lhSave(server);
        LHState = null; // simulate server restart reload from persistentData
        var reloaded = lhProfile(server, shiftActor);
        ok(reloaded.job.id === 'plate_shift' && reloaded.job.totals['create:iron_sheet'] === 16, 'state survived persistentData reload');

        var PlayerClass = Java.loadClass('net.minecraft.server.level.ServerPlayer');
        var ProfileClass = Java.loadClass('com.mojang.authlib.GameProfile');
        var UUIDClass = Java.loadClass('java.util.UUID');
        var fp = new PlayerClass(server, overworld, new ProfileClass(UUIDClass.randomUUID(), 'LHReceiptTest'));
        fp.connection = Java.loadClass('net.minecraftforge.common.util.FakePlayerFactory').getMinecraft(overworld).connection;
        ok(server.getAdvancement('longhaul:contracts/plates') !== null, 'receipt advancement exists');
        lhSync(fp, profile, server);
        ok(fp.isAdvancementDone('longhaul:contracts/plates'), 'actual advancement receipt awarded');
        var xp = fp.totalExperience;
        lhSync(fp, profile, server);
        ok(fp.totalExperience === xp, 'no duplicate XP from receipt sync');

        // 3b. Real Brigadier command tree checks
        var src = fp.createCommandSourceStack();
        var disp = server.commands;
        ok(disp.performPrefixedCommand(src, 'lh help') === 1, 'brigadier /lh help');
        ok(disp.performPrefixedCommand(src, 'lh sites') === 1, 'brigadier /lh sites');
        ok(disp.performPrefixedCommand(src, 'lh site info forest') === 1, 'brigadier /lh site info forest');
        ok(disp.performPrefixedCommand(src, 'lh camp list') === 1, 'brigadier /lh camp list');
        ok(disp.performPrefixedCommand(src, 'lh route list') === 1, 'brigadier /lh route list');
        ok(disp.performPrefixedCommand(src, 'lh status') === 1, 'brigadier /lh status');

        // 4. Site planner + remote rejection + on-site commission & production
        var sitesDb = lhSitesRead(server);
        var forest = sitesDb.sites.forest;
        ok(forest && Math.abs(forest.x) <= 84000 && Math.abs(forest.z) <= 84000, 'forest site within +/-84000');
        ok(lhSiteCommission(server, actor, 'forest') === 0, 'remote site commission rejected');

        var fcx = Math.floor(forest.x / 16) * 16, fcz = Math.floor(forest.z / 16) * 16;
        server.runCommandSilent('forceload add ' + fcx + ' ' + fcz);
        var fb = overworld.getBlock(forest.x, 80, forest.z);
        fb.set('minecraft:barrel');
        var finv = fb.inventory;
        for (var fs = 0; fs < finv.slots; fs++) finv.setStackInSlot(fs, Item.empty);

        var siteActor = {
          uuid: '00000000-0000-4000-8000-000000000002',
          level: overworld,
          x: forest.x + 0.5, y: 81, z: forest.z + 0.5,
          mainHandItem: Item.empty,
          give: function () {},
          tell: function () {},
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {}
        };
        ok(lhSiteCommission(server, siteActor, 'forest') === 1, 'on-site commission accepted');
        finv.setStackInSlot(0, Item.of('minecraft:oak_log', 4));
        finv.setStackInSlot(1, Item.of('minecraft:coal', 1));
        ok(lhSiteProduce(server, siteActor, 'forest', 'bootstrap') === 1, 'on-site bootstrap production');
        ok(String(finv.getStackInSlot(0).id) === 'longhaul:treated_timber' && finv.getStackInSlot(0).count === 1, 'site produced treated_timber');

        // 5. Camp deployment + non-empty container pack block + clean pack
        ok(lhCampDeploy(server, actor) === 0, 'camp near origin rejected');
        server.runCommandSilent('forceload add 800 0');
        overworld.getBlock(800, 80, 0).set('minecraft:campfire');
        overworld.getBlock(801, 80, 0).set('minecraft:red_bed');
        var campBarrel = overworld.getBlock(802, 80, 0);
        campBarrel.set('minecraft:barrel');
        campBarrel.inventory.setStackInSlot(0, Item.of('minecraft:cobblestone', 1));
        var campActor = {
          uuid: '00000000-0000-4000-8000-000000000003',
          level: overworld,
          x: 800.5, y: 81, z: 0.5,
          tell: function () {},
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {}
        };
        ok(lhCampDeploy(server, campActor) === 1, 'camp deployed with equipment');
        ok(lhCampPack(server, campActor, 'camp_1') === 0, 'camp pack blocked while barrel non-empty');
        campBarrel.inventory.setStackInSlot(0, Item.empty);
        ok(lhCampPack(server, campActor, 'camp_1') === 1, 'camp pack allowed when empty');

        // 6. Cargo manifest issuance & delivery
        var issuedItem = null;
        siteActor.give = function (it) { issuedItem = it; };
        ok(lhCargoIssue(server, siteActor, 'forest', 'mine') === 1, 'cargo manifest issued');
        ok(issuedItem !== null && String(issuedItem.id) === 'longhaul:cargo_manifest', 'manifest item created');
        var mine = sitesDb.sites.mine;
        var destActor = {
          uuid: siteActor.uuid, level: overworld,
          x: mine.x + 0.5, y: 81, z: mine.z + 0.5,
          mainHandItem: issuedItem,
          tell: function () {},
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {}
        };
        ok(lhCargoDeliver(server, destActor) === 1, 'cargo manifest delivered');
        ok(lhCargoDeliver(server, destActor) === 0, 'cargo manifest cannot be delivered twice');

        // Cleanup test artifacts
        var curDb = lhRead(server);
        delete curDb.players[String(actor.uuid)];
        delete curDb.players[String(shiftActor.uuid)];
        delete curDb.players[String(fp.uuid)];
        lhSave(server);
        delete sitesDb.sites.forest.depot;
        sitesDb.sites.forest.commissioned = false;
        sitesDb.sites.forest.discovered = false;
        sitesDb.sites.forest.producedTotal = 0;
        lhSitesSave(server);
        var ldb = lhLogRead(server);
        delete ldb.camps[String(campActor.uuid)];
        lhLogSave(server);

        b.set('minecraft:air');
        b2.set('minecraft:air');
        fb.set('minecraft:air');
        overworld.getBlock(800, 80, 0).set('minecraft:air');
        overworld.getBlock(801, 80, 0).set('minecraft:air');
        campBarrel.set('minecraft:air');
        server.runCommandSilent('forceload remove 0 0');
        server.runCommandSilent('forceload remove ' + fcx + ' ' + fcz);
        server.runCommandSilent('forceload remove 800 0');

        console.info('LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + production + camp + cargo + advancement sync');
      } catch (err2) {
        console.error('LH_INTEGRATION_FAIL: live adapter ' + err2);
      }
    };
  } catch (err) {
    console.error('LH_INTEGRATION_FAIL: ' + err);
    throw err;
  }
});

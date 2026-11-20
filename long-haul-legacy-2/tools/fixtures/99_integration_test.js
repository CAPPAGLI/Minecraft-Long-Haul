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
        ok(disp.performPrefixedCommand(src, 'lh recovery list') === 1, 'brigadier /lh recovery list');
        ok(disp.performPrefixedCommand(src, 'lh photo status') === 1, 'brigadier /lh photo status');
        ok(disp.performPrefixedCommand(src, 'lh cc status') === 1, 'brigadier /lh cc status');
        ok(disp.performPrefixedCommand(src, 'lh catalog list') === 1, 'brigadier /lh catalog list');
        ok(disp.performPrefixedCommand(src, 'lh catalog stage 1') === 1, 'brigadier /lh catalog stage 1');
        ok(disp.performPrefixedCommand(src, 'lh catalog info main_1_01') === 1, 'brigadier /lh catalog info main_1_01');

        // 4. Site planner + remote rejection + physical NBT placement + on-site commission & production
        var sitesDb = lhSitesRead(server);
        var forest = sitesDb.sites.forest;
        ok(forest && Math.abs(forest.x) <= 84000 && Math.abs(forest.z) <= 84000, 'forest site within +/-84000: ' + JSON.stringify(forest));
        ok(lhSiteCommission(server, actor, 'forest') === 0, 'remote site commission rejected');

        var fcx = Math.floor(forest.x / 16) * 16, fcz = Math.floor(forest.z / 16) * 16;
        server.runCommandSilent('forceload add ' + fcx + ' ' + fcz);
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
        ok(lhSiteCommission(server, siteActor, 'forest') === 1, 'on-site commission accepted with physical NBT placement');
        ok(forest.placed === true && forest.depot && typeof forest.placedY === 'number', 'forest NBT placed and depot recorded');
        var fb = overworld.getBlock(forest.depot.x, forest.depot.y, forest.depot.z);
        ok(String(fb.id) === 'minecraft:barrel', 'NBT structure placed depot barrel at forest: ' + fb.id);
        ok(String(overworld.getBlock(forest.x - 1, forest.placedY, forest.z).id) === 'minecraft:spruce_planks', 'NBT structure placed spruce floor at forest');
        var finv = fb.inventory;
        for (var fs = 0; fs < finv.slots; fs++) finv.setStackInSlot(fs, Item.empty);
        finv.setStackInSlot(0, Item.of('minecraft:oak_log', 4));
        finv.setStackInSlot(1, Item.of('minecraft:coal', 1));
        ok(lhSiteProduce(server, siteActor, 'forest', 'bootstrap') === 1, 'on-site bootstrap production');
        ok(String(finv.getStackInSlot(0).id) === 'longhaul:treated_timber' && finv.getStackInSlot(0).count === 1, 'site produced treated_timber');

        // 4b. Unique Continental Archive NBT placement + idempotent repair
        var arch = sitesDb.sites.continental_archive;
        var acx = Math.floor(arch.x / 16) * 16, acz = Math.floor(arch.z / 16) * 16;
        server.runCommandSilent('forceload add ' + acx + ' ' + acz);
        var archActor = {
          uuid: siteActor.uuid, level: overworld,
          x: arch.x + 0.5, y: 81, z: arch.z + 0.5,
          tell: function () {},
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {}
        };
        ok(lhSiteArchive(server, archActor) === 1, 'continental_archive NBT placed and commissioned');
        ok(String(overworld.getBlock(arch.x - 1, arch.placedY, arch.z).id) === 'minecraft:polished_deepslate', 'archive monument deepslate floor verified');
        overworld.getBlock(arch.x - 1, arch.placedY, arch.z).set('minecraft:air');
        ok(lhSiteRepairArchive(server, archActor) === 1, 'archive repaired idempotently');
        ok(String(overworld.getBlock(arch.x - 1, arch.placedY, arch.z).id) === 'minecraft:polished_deepslate', 'archive floor restored by repair_archive');

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

        // 7. Recoverable industrial facility NBT placement & restoration (sawmill)
        var recDb = lhRecRead(server);
        var sawmill = recDb.items.sawmill;
        ok(sawmill && Math.abs(sawmill.x) <= 84000 && Math.abs(sawmill.z) <= 84000, 'sawmill planned within +/-84000');
        var scx = Math.floor(sawmill.x / 16) * 16, scz = Math.floor(sawmill.z / 16) * 16;
        server.runCommandSilent('forceload add ' + scx + ' ' + scz);
        var recActor = {
          uuid: siteActor.uuid, level: overworld,
          x: sawmill.x + 0.5, y: 81, z: sawmill.z + 0.5,
          mainHandItem: Item.empty,
          tell: function () {},
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {}
        };
        ok(lhRecSurvey(server, recActor, 'sawmill') === 1, 'sawmill surveyed and ruin NBT placed');
        ok(sawmill.placed === true && sawmill.depot, 'sawmill NBT placed with depot');
        var rBarrel = overworld.getBlock(sawmill.depot.x, sawmill.depot.y, sawmill.depot.z);
        ok(String(rBarrel.id) === 'minecraft:barrel', 'sawmill NBT placed depot barrel: ' + rBarrel.id);
        var rSaw = overworld.getBlock(sawmill.depot.x + 1, sawmill.depot.y, sawmill.depot.z);
        ok(lhRecRestore(server, recActor, 'sawmill') === 0, 'sawmill restore fails without machinery');
        rSaw.set('create:mechanical_saw');
        rBarrel.inventory.setStackInSlot(0, Item.of('minecraft:iron_ingot', 16));
        rBarrel.inventory.setStackInSlot(1, Item.of('create:andesite_alloy', 16));
        rBarrel.inventory.setStackInSlot(2, Item.of('minecraft:oak_log', 32));
        ok(lhRecRestore(server, recActor, 'sawmill') === 1, 'sawmill restored with machinery and materials');

        // 8. Exposure photo field report (unique token, no reuse across sites)
        var photoItem = Item.of('exposure:photograph', { id: 'lh_test_frame_01' });
        var photoActor = {
          uuid: siteActor.uuid, level: overworld,
          x: forest.x + 0.5, y: 81, z: forest.z + 0.5,
          mainHandItem: Item.of('minecraft:paper'),
          tell: function () {},
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {}
        };
        ok(lhPhotoReport(server, photoActor, 'forest') === 0, 'vanilla paper rejected as photo');
        photoActor.mainHandItem = photoItem;
        ok(lhPhotoReport(server, photoActor, 'forest') === 1, 'authentic Exposure photo accepted at forest');
        var farmSite = sitesDb.sites.farm;
        photoActor.x = farmSite.x + 0.5;
        photoActor.z = farmSite.z + 0.5;
        ok(lhPhotoReport(server, photoActor, 'farm') === 0, 'same photo token cannot be reused for farm');

        // 9. CC: Tweaked depot telemetry challenge (requires physical computer + actual barrel inventory)
        ok(lhCCIssue(server, siteActor, 'forest') === 1, 'CC challenge issued for forest');
        var fdb = lhFieldRead(server);
        var needCount = fdb.ccChallenges.forest.count;
        ok(lhCCVerify(server, siteActor, 'forest') === 0, 'CC verify fails without computer block');
        var compBlock = overworld.getBlock(forest.depot.x + 2, forest.depot.y, forest.depot.z);
        compBlock.set('computercraft:computer_normal');
        finv.setStackInSlot(0, Item.of('longhaul:treated_timber', needCount));
        ok(lhCCVerify(server, siteActor, 'forest') === 1, 'CC telemetry verified with real computer and depot stock');

        // 10. Catalog 240-order server verification (site_visit + photo_evidence + atomic delivery)
        ok(lhCatVerify(server, siteActor, 'region_forest_01') === 1, 'catalog site_visit verified at forest');
        var catPhotoActor = {
          uuid: siteActor.uuid, level: overworld,
          x: forest.x + 0.5, y: 81, z: forest.z + 0.5,
          mainHandItem: Item.of('exposure:photograph', { id: 'lh_test_frame_02' }),
          tell: function () {},
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {}
        };
        ok(lhCatVerify(server, catPhotoActor, 'photo_forest_arrival') === 1, 'catalog photo_evidence verified with fresh photo token');
        finv.setStackInSlot(0, Item.of('minecraft:oak_planks', 64));
        var catDelivActor = {
          uuid: siteActor.uuid, level: overworld,
          x: forest.depot.x + 0.5, y: forest.depot.y + 1, z: forest.depot.z + 0.5,
          mainHandItem: Item.empty,
          tell: function () {},
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {}
        };
        ok(lhCatVerify(server, catDelivActor, 'main_1_01') === 1, 'catalog controlled_production consumed 64 items from depot');

        // Cleanup test artifacts
        var curDb = lhRead(server);
        delete curDb.players[String(actor.uuid)];
        delete curDb.players[String(shiftActor.uuid)];
        delete curDb.players[String(fp.uuid)];
        lhSave(server);
        delete sitesDb.sites.forest.depot;
        sitesDb.sites.forest.commissioned = false;
        sitesDb.sites.forest.discovered = false;
        sitesDb.sites.forest.placed = false;
        delete sitesDb.sites.forest.placedY;
        sitesDb.sites.forest.producedTotal = 0;
        delete sitesDb.sites.continental_archive.depot;
        sitesDb.sites.continental_archive.commissioned = false;
        sitesDb.sites.continental_archive.discovered = false;
        sitesDb.sites.continental_archive.placed = false;
        delete sitesDb.sites.continental_archive.placedY;
        lhSitesSave(server);
        sawmill.surveyed = false;
        sawmill.restored = false;
        sawmill.placed = false;
        delete sawmill.placedY;
        delete sawmill.depot;
        delete sawmill.machineryFound;
        lhRecSave(server);
        delete fdb.photoClaims.forest;
        delete fdb.ccChallenges.forest;
        delete fdb.ccVerified.forest;
        Object.keys(fdb.usedPhotoTokens).forEach(function (tk) {
          if (fdb.usedPhotoTokens[tk] === 'forest' || String(fdb.usedPhotoTokens[tk]).indexOf('catalog:') === 0) delete fdb.usedPhotoTokens[tk];
        });
        lhFieldSave(server);
        var catDb = lhCatRead(server);
        delete catDb.completed[String(siteActor.uuid) + ':region_forest_01'];
        delete catDb.completed[String(siteActor.uuid) + ':photo_forest_arrival'];
        delete catDb.completed[String(siteActor.uuid) + ':main_1_01'];
        lhCatSave(server);
        var ldb = lhLogRead(server);
        delete ldb.camps[String(campActor.uuid)];
        lhLogSave(server);

        b.set('minecraft:air');
        b2.set('minecraft:air');
        fb.set('minecraft:air');
        compBlock.set('minecraft:air');
        rBarrel.set('minecraft:air');
        rSaw.set('minecraft:air');
        overworld.getBlock(800, 80, 0).set('minecraft:air');
        overworld.getBlock(801, 80, 0).set('minecraft:air');
        campBarrel.set('minecraft:air');
        server.runCommandSilent('forceload remove 0 0');
        server.runCommandSilent('forceload remove ' + fcx + ' ' + fcz);
        server.runCommandSilent('forceload remove ' + acx + ' ' + acz);
        server.runCommandSilent('forceload remove ' + scx + ' ' + scz);
        server.runCommandSilent('forceload remove 800 0');

        console.info('LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync');
      } catch (err2) {
        console.error('LH_INTEGRATION_FAIL: live adapter ' + err2);
      }
    };
  } catch (err) {
    console.error('LH_INTEGRATION_FAIL: ' + err);
    throw err;
  }
});

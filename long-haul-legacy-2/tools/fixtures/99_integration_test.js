// TEST WORLD ONLY — deliberately not distributed in overrides.
var LHIntegrationVerify = null;
var LHIntegrationSetupDone = false;
var LHIntegrationServer = null;

function lhStartIntegrationSetup(server) {
  if (LHIntegrationSetupDone) return;
  LHIntegrationSetupDone = true;
  LHIntegrationServer = server;
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
        ok(String(overworld.getBlock(forest.x - 3, forest.placedY + 1, forest.z - 3).id) === 'minecraft:spruce_log', '11x7x11 forest NBT placed timber stockpile');
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
        ok(String(overworld.getBlock(arch.x - 1, arch.placedY + 1, arch.z - 3).id) === 'minecraft:lectern', '11x7x11 archive NBT placed lectern');
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
        ok(lhCatVerify(server, campActor, 'expedition_02') === 1, 'catalog camp_visit verified with active camp at >= 750m');
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
        ok(lhCatVerify(server, catDelivActor, 'engineering_cc_01') === 1, 'catalog computer_challenge verified near CC computer');

        // 11. Economy recipes & banned portable storage check
        var RL = Java.loadClass('net.minecraft.resources.ResourceLocation');
        var rm = server.recipeManager;
        ok(rm.byKey(new RL('longhaul:expedition_bundle')).isPresent(), 'expedition_bundle recipe registered');
        ok(rm.byKey(new RL('longhaul:bulk_rail_from_sheets')).isPresent(), 'bulk_rail_from_sheets recipe registered');
        ok(rm.byKey(new RL('longhaul:cure_leather_smoking')).isPresent(), 'cure_leather_smoking recipe registered');
        ok(rm.byKey(new RL('longhaul:cure_leather_campfire')).isPresent(), 'cure_leather_campfire recipe registered');
        var regAccess = server.registryAccess();
        var bannedOuts = {
          'minecraft:ender_chest': true,
          'minecraft:shulker_box': true,
          'supplementaries:sack': true,
          'supplementaries:safe': true,
          'quark:backpack': true,
          'functionalstorage:ender_drawer': true
        };
        var iter = rm.getRecipes().iterator();
        while (iter.hasNext()) {
          var recObj = iter.next();
          var outId = String(recObj.getResultItem(regAccess).id);
          ok(!bannedOuts[outId] && outId.indexOf('jetpack') === -1, 'banned storage/jetpack has live recipe: ' + outId + ' (' + recObj.getId() + ')');
        }

        // 12. 4-stage progression & 1-Hz anti-teleport vehicle telemetry
        var stRes = lhStageRecompute(server, siteActor);
        ok(stRes.unlocked.indexOf('longhaul_stage_1') !== -1 && stRes.unlocked.indexOf('longhaul_stage_2') !== -1, 'stages 1-2 unlocked after commissioning site');
        ok(stRes.unlocked.indexOf('longhaul_stage_3') !== -1, 'stage 3 unlocked with 2 commissioned sites + verified CC challenge');
        var telActor = {
          uuid: '00000000-0000-4000-8000-000000000009',
          level: overworld,
          x: 0, z: 0,
          vehicle: { type: 'create:carriage_contraption' },
          tell: function () {}
        };
        lhTelemetrySample(server, telActor);
        var prevTick = Number(server.tickCount);
        telActor.x = 50; // realistic 50m step -> accepted
        var tRec = lhTelemetrySample(server, telActor);
        ok((tRec.meters.rail || 0) === 50, 'vehicle telemetry recorded 50m rail travel: ' + JSON.stringify(tRec.meters));
        telActor.x = 5000; // teleport jump -> rejected
        tRec = lhTelemetrySample(server, telActor);
        ok((tRec.meters.rail || 0) === 50 && (tRec.rejectedJumps || 0) >= 1, 'vehicle telemetry rejected teleport jump');
        var stDb = lhStageRead(server);
        delete stDb.players[String(siteActor.uuid)];
        lhStageSave(server);
        var telDb = lhTelemetryRead(server);
        delete telDb.players[String(telActor.uuid)];
        lhTelemetrySave(server);

        // 13. Route trial creation, completion gate check, anti-teleport, and catalog route_trial verification
        var routeActor = {
          uuid: '00000000-0000-4000-8000-000000000010',
          level: overworld,
          x: 0, y: 80, z: 0,
          vehicle: { type: 'astikorcarts:supply_cart' },
          tell: function () {},
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {}
        };
        ok(lhRouteBegin(server, routeActor, 'lh_test_route') === 1, 'route begin placed gate A');
        routeActor.x = 400;
        ok(lhRouteGate(server, routeActor) === 1, 'route gate 2 placed at 400m');
        routeActor.x = 800;
        ok(lhRouteFinish(server, routeActor) === 1, 'route finished at 800m');
        ok(lhCatVerify(server, routeActor, 'main_1_04') === 0, 'catalog route_trial blocked before completing an actual run');
        routeActor.x = 0;
        ok(lhRouteStart(server, routeActor, 'lh_test_route') === 1, 'route trial started at gate A');
        // Force realistic elapsed time (20s -> 400m / 20s = 20 m/s <= 96 m/s)
        var rldb = lhLogRead(server);
        rldb.activeRuns[String(routeActor.uuid)].lastGateTick = Number(server.tickCount) - 400;
        routeActor.x = 400;
        ok(lhRouteStepPlayer(server, routeActor) === 1, 'route gate 2 passed at realistic speed');
        rldb.activeRuns[String(routeActor.uuid)].lastGateTick = Number(server.tickCount) - 400;
        routeActor.x = 800;
        ok(lhRouteStepPlayer(server, routeActor) === 2, 'route trial completed with transport family tracking');
        ok(rldb.routes.lh_test_route.completedCount === 1 && rldb.routes.lh_test_route.verifiedFamilies.cart === true, 'route recorded completedCount and cart family');
        ok(lhCatVerify(server, routeActor, 'main_1_04') === 1, 'catalog route_trial verified after completing real trial');
        // Verify anti-teleport speed cancellation on a second trial
        routeActor.x = 0;
        ok(lhRouteStart(server, routeActor, 'lh_test_route') === 1, 'second route trial started');
        rldb.activeRuns[String(routeActor.uuid)].lastGateTick = Number(server.tickCount); // 1s elapsed for 400m -> 400 m/s -> rejected
        routeActor.x = 400;
        ok(lhRouteStepPlayer(server, routeActor) === -1, 'route trial cancelled on teleport speed');
        delete rldb.routes.lh_test_route;
        delete rldb.activeRuns[String(routeActor.uuid)];
        lhLogSave(server);
        var rCatDb = lhCatRead(server);
        delete rCatDb.completed[String(routeActor.uuid) + ':main_1_04'];
        lhCatSave(server);
        var stDb2 = lhStageRead(server);
        delete stDb2.players[String(routeActor.uuid)];
        lhStageSave(server);

        // 14. Multi-input delivery, watercraft vehicle_delivery telemetry gate, and network_supply region gate
        finv.setStackInSlot(0, Item.of('minecraft:cobblestone', 64));
        finv.setStackInSlot(1, Item.of('minecraft:cobblestone', 64));
        ok(lhCatVerify(server, catDelivActor, 'main_1_02') === 0, 'delivery with distinct_inputs=2 blocked on single item type');
        finv.setStackInSlot(1, Item.of('minecraft:oak_planks', 64));
        ok(lhCatVerify(server, catDelivActor, 'main_1_02') === 1, 'delivery with distinct_inputs=2 verified with two distinct items');

        finv.setStackInSlot(0, Item.of('minecraft:cobblestone', 64));
        finv.setStackInSlot(1, Item.of('minecraft:cobblestone', 64));
        finv.setStackInSlot(2, Item.of('minecraft:cobblestone', 64));
        finv.setStackInSlot(3, Item.of('minecraft:cobblestone', 64));
        ok(lhCatVerify(server, catDelivActor, 'main_2_02') === 0, 'vehicle_delivery (ship) blocked without watercraft telemetry');
        var shipActor = {
          uuid: siteActor.uuid, level: overworld,
          x: 0, z: 0,
          vehicle: { type: 'smallships:cog' },
          tell: function () {}
        };
        lhTelemetrySample(server, shipActor);
        shipActor.x = 60;
        lhTelemetrySample(server, shipActor);
        ok(lhCatVerify(server, catDelivActor, 'main_2_02') === 1, 'vehicle_delivery (ship) verified after 60m smallships telemetry + 256 depot items');

        ok(lhCatVerify(server, catDelivActor, 'main_2_08') === 0, 'network_supply (distinct_regions=3) blocked when only 1 site commissioned');
        sitesDb.sites.mine.commissioned = true;
        sitesDb.sites.farm.commissioned = true;
        finv.setStackInSlot(0, Item.of('minecraft:cobblestone', 32));
        ok(lhCatVerify(server, catDelivActor, 'main_2_08') === 1, 'network_supply (distinct_regions=3) verified with 3 commissioned regions + depot items');
        sitesDb.sites.mine.commissioned = false;
        sitesDb.sites.farm.commissioned = false;
        var catDb14 = lhCatRead(server);
        delete catDb14.completed[String(siteActor.uuid) + ':main_1_02'];
        delete catDb14.completed[String(siteActor.uuid) + ':main_2_02'];
        delete catDb14.completed[String(siteActor.uuid) + ':main_2_08'];
        lhCatSave(server);
        var telDb14 = lhTelemetryRead(server);
        delete telDb14.players[String(siteActor.uuid)];
        lhTelemetrySave(server);
        var stDb14 = lhStageRead(server);
        delete stDb14.players[String(siteActor.uuid)];
        lhStageSave(server);
        for (var fs = 0; fs < finv.slots; fs++) finv.setStackInSlot(fs, Item.empty);

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
        delete catDb.completed[String(siteActor.uuid) + ':engineering_cc_01'];
        delete catDb.completed[String(campActor.uuid) + ':expedition_02'];
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

        // 15. Immortal Snail lifecycle, chunk ore prospecting, and story quest advancements
        var snailActor = {
          uuid: '00000000-0000-4000-8000-000000000011',
          level: overworld,
          x: 0, y: 80, z: 0,
          killed: false,
          isCreative: function () { return false; },
          isSpectator: function () { return false; },
          tell: function () {},
          kill: function () { this.killed = true; },
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {}
        };
        ok(lhSnailStepPlayer(server, snailActor, 20, true) === 0, 'snail does NOT awaken or kill on spawn');
        ok(lhSnailWake(server, snailActor, true) === 1, 'snail awakens on grace expiration');
        var sRec = lhSnailGetRecord(server, snailActor);
        var dSnail1 = global.LHWorldPlanner.dist2D(snailActor.x, snailActor.z, sRec.x, sRec.z);
        ok(sRec.awake === true && Math.round(dSnail1) === 64, 'snail spawns 64m away (d=' + dSnail1 + ', rec=' + JSON.stringify(sRec) + ')');
        sRec.x = snailActor.x + 2.0; sRec.y = snailActor.y; sRec.z = snailActor.z;
        ok(lhSnailStepPlayer(server, snailActor, 20, true) === 2 && snailActor.killed === true, 'snail strikes lethally on contact and resets');
        var dSnail2 = global.LHWorldPlanner.dist2D(snailActor.x, snailActor.z, sRec.x, sRec.z);
        ok(sRec.cooldownTicks === 2400 && Math.round(dSnail2) === 80, 'snail resets 80m away with 120s cooldown (d=' + dSnail2 + ', rec=' + JSON.stringify(sRec) + ')');
        ok(lhProspectChunk(server, snailActor) === 1, 'chunk ore prospector scans without error');
        var sDbClean = lhSnailRead(server);
        delete sDbClean.players[String(snailActor.uuid)];
        lhSnailSave(server);

        // 16. Death Stranding Voidout queue + live createExplosion + seasonal rising toxic gas
        var prevVoidoutCount = lhVoidoutRead(server).totalVoidouts || 0;
        var vTotal = lhQueueVoidout(server, 'minecraft:overworld', 2000, 80, 2000, 'TestPlayer');
        ok(vTotal === prevVoidoutCount + 1, 'voidout queued on death');
        ok(lhProcessVoidoutQueue(server, true) === 0, 'voidout waits 3 ticks before detonating');
        ok(lhProcessVoidoutQueue(server, true) === 0, 'voidout waits 2nd tick');
        ok(lhProcessVoidoutQueue(server, true) === 1, 'voidout triggers on 3rd tick');
        overworld.createExplosion(2000, 80, 2000).strength(8.0).explosionMode('none').explode();
        var gasDb = lhGasRead(server);
        var prevForced = gasDb.forcedPhase;
        gasDb.forcedPhase = 2;
        var gasPeak = lhGasComputeStatus(server);
        ok(gasPeak.phase === 2 && gasPeak.ceilingY === 114, 'peak toxic gas season reaches Y=114');
        var gasActorLow = { uuid: '00000000-0000-4000-8000-000000000012', level: overworld, y: 70, isCreative: function () { return false; }, isSpectator: function () { return false; } };
        var gasActorSky = { uuid: '00000000-0000-4000-8000-000000000012', level: overworld, y: 175, isCreative: function () { return false; }, isSpectator: function () { return false; } };
        ok(lhGasStepPlayer(server, gasActorLow, 20, true).inGas === true, 'lowland Y=70 is inside seasonal toxic gas');
        ok(lhGasStepPlayer(server, gasActorSky, 20, true).inGas === false, 'flying island Y=175 is safe above toxic gas');
        delete gasDb.players[String(gasActorLow.uuid)];
        gasDb.forcedPhase = prevForced;
        lhGasSave(server);

        // 17. Active-route bounded chunk-loading quota (<= 2 anchors)
        var qPid = '00000000-0000-4000-8000-000000000013';
        var qRes = lhRouteQuotaSync(server, qPid, [{ x: 160, z: 160 }, { x: 320, z: 320 }, { x: 480, z: 480 }], true);
        ok(qRes.length === 2 && lhRouteQuotaStatus(server, qPid).used === 2, 'route chunk quota caps anchors at 2');
        lhRouteQuotaSync(server, qPid, [], true);
        ok(lhRouteQuotaStatus(server, qPid).used === 0, 'route chunk quota releases cleanly on completion');

        // 18. Prospecting scan executes cleanly across vanilla + modded ore blocks
        ok(lhProspectChunk(server, actor) === 1, 'prospecting scans vanilla and modded mono-ore chunks');

        // 19. Eccentric Tome item registered for unified mod guidebooks
        ok(!Item.of('eccentrictome:tome').isEmpty(), 'eccentrictome:tome registered');

        ok(Math.round(Number(overworld.worldBorder.size)) === 175000, 'world border initialized to 175000 blocks');
        console.info('LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + advancement sync');
      } catch (err2) {
        console.error('LH_INTEGRATION_FAIL: live adapter ' + err2);
      }
    };
  } catch (err) {
    console.error('LH_INTEGRATION_FAIL: ' + err);
    throw err;
  }
}

ServerEvents.tick(function (event) {
  if (!LHIntegrationSetupDone && LHClock >= 2) {
    lhStartIntegrationSetup(event.server);
  }
  if (LHClock >= 65 && LHIntegrationVerify) {
    var verify = LHIntegrationVerify;
    LHIntegrationVerify = null;
    verify();
  }
});

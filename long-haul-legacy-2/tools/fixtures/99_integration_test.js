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
        ok(disp.performPrefixedCommand(src, 'lh events') === 1, 'brigadier /lh events');
        ok(disp.performPrefixedCommand(src, 'lh map') === 1, 'brigadier /lh map');
        ok(disp.performPrefixedCommand(src, 'lh territory') === 1, 'brigadier /lh territory');

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

        // 16. Death Stranding Voidout queue (1.0 * k, uncapped) + difficulty coefficient + live createExplosion + seasonal rising toxic gas
        var vDb = lhVoidoutRead(server);
        var prevVoidoutCount = vDb.totalVoidouts || 0;
        var prevDeathCount = vDb.deathCount || 0;
        var prevLastPower = vDb.lastPower || 0;
        var vTotal = lhQueueVoidout(server, 'minecraft:overworld', 2000, 80, 2000, 'TestPlayer', 1.0);
        ok(vTotal === prevVoidoutCount + 1 && vDb.lastPower === 1.0, 'voidout starts at base 1.0 * k (k=1 -> power=1.0)');
        var vTotal2 = lhQueueVoidout(server, 'minecraft:overworld', 2000, 80, 2000, 'TestPlayer', 140.0);
        ok(vTotal2 === prevVoidoutCount + 2 && vDb.lastPower === 140.0, 'voidout scales uncapped by difficulty coeff (k=140 -> power=140.0)');
        ok(lhProcessVoidoutQueue(server, true) === 0, 'voidout waits 3 ticks before detonating');
        ok(lhProcessVoidoutQueue(server, true) === 0, 'voidout waits 2nd tick');
        ok(lhProcessVoidoutQueue(server, true) === 2, 'voidout triggers on 3rd tick');
        vDb.totalVoidouts = prevVoidoutCount;
        vDb.deathCount = prevDeathCount;
        vDb.lastPower = prevLastPower;
        lhVoidoutSave(server);
        overworld.createExplosion(2000, 80, 2000).strength(8.0).explosionMode('none').explode();
        var gasDb = lhGasRead(server);
        var prevForced = gasDb.forcedPhase;
        gasDb.forcedPhase = -1;
        ok(lhGasComputeStatus(server).ceilingY <= -60, 'toxic gas stays clear while locked in progression');
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

        // 18. Prospecting scan executes cleanly across vanilla + modded ore blocks + live Overworld ore audit
        ok(lhProspectChunk(server, actor) === 1, 'prospecting scans vanilla and modded mono-ore chunks');
        try {
          var sampleNonAir = String(overworld.getBlock(8, 20, 8).id);
          if (sampleNonAir !== 'minecraft:air' && sampleNonAir !== 'minecraft:void_air') {
            var oreAuditCounts = {};
            var totalOresAudit = 0;
            for (var ox = -16; ox < 16; ox += 2) {
              for (var oz = -16; oz < 16; oz += 2) {
                for (var oy = -60; oy <= 120; oy += 4) {
                  var ob = overworld.getBlock(ox, oy, oz);
                  if (ob && ob.hasTag('forge:ores')) {
                    var obId = String(ob.id);
                    oreAuditCounts[obId] = (oreAuditCounts[obId] || 0) + 1;
                    totalOresAudit++;
                  }
                }
              }
            }
            console.info('LH_INTEGRATION_ORE_AUDIT total=' + totalOresAudit + ' ores=' + JSON.stringify(oreAuditCounts));
          }
        } catch (eOreAud) {}

        // 19. Eccentric Tome item registered for unified mod guidebooks
        ok(!Item.of('eccentrictome:tome').isEmpty(), 'eccentrictome:tome registered');

        // 20. Chapter-based territory border scaling (61-stage diminishing concave area curve 724 -> 175000) + always-active ore_scarcity + 100 Casino Wheel complications + worldgen verification
        ok(Math.round(Number(overworld.worldBorder.size)) === 724, 'initial world border starts at 724 blocks when 61 chapters locked');
        ok(lhHardIsActive(server, 'ore_scarcity') === true, 'base complication ore_scarcity is ALWAYS active from world start');
        ok((global.LHHardFeatureCatalog || []).length === 100, '100 complications registered in LHHardFeatureCatalog');
        ok(LHHeraclesProgressHandler !== null, 'Heracles QuestProgressHandler loaded for live ch15..ch61 completion sync');
        try {
          var LHRegCls = Java.loadClass('net.minecraft.core.registries.Registries');
          var LHRLCls = Java.loadClass('net.minecraft.resources.ResourceLocation');
          var pfReg = server.registryAccess().registryOrThrow(LHRegCls.PLACED_FEATURE);
          ok(pfReg.containsKey(new LHRLCls('longhaul', 'rich_iron_chunk')) &&
             pfReg.containsKey(new LHRLCls('longhaul', 'rich_uranium_chunk')) &&
             pfReg.containsKey(new LHRLCls('minecraft', 'ore_iron_middle')),
             'worldgen ore rebalance & rich mono-ore chunk placed_features active in Forge registry');
        } catch (eWgCheck) {
          ok(false, 'worldgen placed_feature registry check failed: ' + eWgCheck);
        }

        var pDb = lhProgRead(server);
        var savedProg = JSON.stringify(pDb);
        ok(lhUnlockChapter(server, 'ch00', true, true) === true, 'Chapter 00 unlocks and queues Casino Wheel spin');
        ok(lhTerritoryCounts(server).size === 31825, '1 unlocked chapter expands border to 31825 blocks');
        lhUnlockChapter(server, 'ch01', true, true);
        lhUnlockChapter(server, 'ch02', true, true);
        lhUnlockChapter(server, 'ch03', true, true);
        ok(lhTerritoryCounts(server).size === 62831, '4 unlocked chapters expands border to 62831 blocks');
        LH_MAIN_CHAPTER_KEYS.forEach(function (ck) {
          if (ck !== 'ch04' && ck !== 'ch61' && !pDb.chapters[ck]) {
            lhUnlockChapter(server, ck, true, true);
          }
        });
        ok(lhTerritoryCounts(server).size === 174976, '59 unlocked chapters expands border to 174976 blocks');
        lhUnlockChapter(server, 'ch61', true, true);
        ok(lhTerritoryCounts(server).size === 175000 && Math.round(Number(overworld.worldBorder.size)) === 175000, '60 unlocked chapters (locked=1 ch04) expands border to 175000 blocks');
        var spun = lhCasinoResolveImmediate(server, true);
        ok(spun.length === 60 && Object.keys(pDb.hardFeatures).length === 61, 'Casino Wheel resolved 60 chapter complications + 1 base ore_scarcity = 61 active complications');
        ok(server.getAdvancement('longhaul:story/01_left_for_bread') !== null && server.getAdvancement('longhaul:story/06_forgot_the_milk') !== null, 'Chapter 00 story advancements exist');
        ok(server.getAdvancement('longhaul:story/03_dinner_telegram') !== null, 'Chapter 01 story/03_dinner_telegram advancement exists');
        ok(server.getAdvancement('longhaul:nuclear/verified') !== null && server.getAdvancement('longhaul:doomed/checked') !== null, 'Nuclear & DOOMED advancements exist');
        ok(!Item.of('hexcasting:amethyst_dust').isEmpty() && !Item.of('hexcasting:staff/oak').isEmpty(), 'Hex Casting items registered');
        LHProgState = JSON.parse(savedProg);
        lhProgSave(server);
        lhApplyTerritoryBorder(server, false);

        // 21. Difficulty coefficient (target 275.15 -> 96 for 61 chapters) + Random Respawn (20203 @ k=96) + Death Item Loss + Draconic & Nuclear mods
        var dSaved = JSON.stringify(lhProgRead(server));
        var pMock1 = { uuid: '00000000-0000-4000-8000-000000000021' };
        var pMock2 = { uuid: '00000000-0000-4000-8000-000000000022' };
        for (var di = 0; di < 275; di++) lhRecordPlayerDeath(server, pMock1);
        var dOne = lhDifficultyStatus(server, [pMock1]);
        var dTwo = lhDifficultyStatus(server, [pMock1, pMock2]);
        ok(dOne.coeff > 95.0 && dOne.coeff < 97.0, 'difficulty coeff near 96 at 275 deaths solo (' + dOne.coeff + ')');
        ok(dTwo.coeff < dOne.coeff, 'difficulty coeff inversely depends on online players (' + dTwo.coeff + ' < ' + dOne.coeff + ')');
        var rEnd = lhComputeRandomRespawnTarget(server, 0, 0, 96.0, 0.25, 1.0);
        ok(rEnd.radius === 20203 && Math.abs(rEnd.x) <= 362 && Math.abs(rEnd.z) <= 362, 'random respawn radius hits 20203 at k=96 and clamps cleanly within current worldborder');
        var mockInv = {
          slots: 5,
          items: [
            { id: 'minecraft:iron_ingot', count: 16, empty: false },
            { id: 'minecraft:cobblestone', count: 32, empty: false },
            { id: 'create:brass_ingot', count: 8, empty: false },
            { id: 'heracles:quest_book', count: 1, empty: false },
            { id: 'eccentrictome:tome', count: 1, empty: false }
          ],
          getStackInSlot: function (idx) { return this.items[idx]; },
          extractItem: function (idx) { this.items[idx] = { id: 'minecraft:air', count: 0, empty: true }; }
        };
        var lossRes = lhApplyDeathItemLoss(server, { inventory: mockInv }, 96.0, true);
        ok(lossRes.lostStacks >= 1 && !mockInv.items[3].empty && !mockInv.items[4].empty, 'death_item_loss deletes random items while sparing quest book & tome');
        LHProgState = JSON.parse(dSaved);
        lhProgSave(server);

        ok(!Item.of('draconicevolution:draconium_ingot').isEmpty(), 'draconicevolution:draconium_ingot registered');
        ok(!Item.of('electrodynamics:ingoturanium').isEmpty() || !Item.of('nuclearcraft:uranium_ingot').isEmpty(), 'Nuclear uranium ingot registered');

        // 22. OpenTTD multiplayer companies, specializations, Voronoi+claim sectors, inter-company trade/market, and AI bots
        var ottdSaved = JSON.stringify(lhOttdRead(server));
        var ottdSt = lhOttdRead(server);
        var oP1 = {
          uuid: '00000000-0000-4000-8000-000000000031',
          level: overworld,
          x: 0.5, y: 80, z: 0.5,
          mainHandItem: Item.of('minecraft:iron_ingot', 16),
          inventory: {
            slots: 2,
            items: [
              { id: 'minecraft:iron_ingot', count: 16, empty: false },
              { id: 'minecraft:air', count: 0, empty: true }
            ],
            getStackInSlot: function (idx) { return this.items[idx]; },
            extractItem: function (idx, n) {
              var it = this.items[idx];
              var take = Math.min(n, it.count);
              it.count -= take;
              if (it.count <= 0) this.items[idx] = { id: 'minecraft:air', count: 0, empty: true };
              return { count: take };
            }
          },
          tell: function () {},
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {}
        };
        var oP2 = {
          uuid: '00000000-0000-4000-8000-000000000032',
          level: overworld,
          x: 768.5, y: 80, z: 512.5,
          mainHandItem: Item.empty,
          inventory: { slots: 1, items: [{ id: 'minecraft:air', count: 0, empty: true }], getStackInSlot: function (idx) { return this.items[idx]; } },
          tell: function () {},
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {}
        };
        ok(global.LHOpenTTD.companyCreate(ottdSt, String(oP1.uuid), 'sibir', 'Сибирь-Логистик', oP1.x, oP1.z).ok === true, 'player 1 founded OpenTTD company');
        ok(!global.LHOpenTTD.isSpawnProtectedSector(ottdSt.companies.sibir.hqSx, ottdSt.companies.sibir.hqSz), 'sibir HQ placed outside 3x3 spawn sanctuary');
        ok(global.LHOpenTTD.companyCreate(ottdSt, String(oP2.uuid), 'volga', 'Волга-Карго', oP2.x, oP2.z).ok === true, 'player 2 founded competing company');
        ok(global.LHOpenTTD.setSpecialization(ottdSt, 'sibir', 'transport', 'rail').ok === true, 'sibir set rail transport spec');
        ok(global.LHOpenTTD.setSpecialization(ottdSt, 'sibir', 'resource', 'mining').ok === true, 'sibir set mining resource spec');
        var earnedRail = lhCompanyReward(server, oP1, 200, 'route', 'rail');
        ok(earnedRail === 290, 'rail specialization adds +45% route payout (200 -> 290 Cr)');
        ok(lhCompanyScarcityFactor(server, oP1, 'mining') < 0.35, 'mining specialization mitigates ore scarcity');

        // Spawn sanctuary claim blocked; regular claim + fortify + buyout + Voronoi + transfer work
        oP1.x = 0.5; oP1.z = 0.5;
        ok(lhCompanyClaimHere(server, oP1, false) === 0, 'spawn sanctuary sector (0,0) protected from claim');
        oP1.x = 512.5; oP1.z = 512.5;
        ottdSt.companies.sibir.cash += 2000;
        ottdSt.companies.volga.cash += 5000;
        ok(lhCompanyClaimHere(server, oP1, false) === 1, 'sibir claimed sector (2,2)');
        ok(lhCompanyFortifyHere(server, oP1) === 1, 'sibir fortified sector (2,2)');
        oP2.x = 512.5; oP2.z = 512.5;
        ok(lhCompanyClaimHere(server, oP2, false) === 0, 'claim without capture blocked on rival sector');
        ok(lhCompanyClaimHere(server, oP2, true) === 1, 'hostile capture takes sector (2,2) for volga');
        ok(lhCompanyTransferHere(server, oP2, 'sibir') === 1, 'volga transferred sector (2,2) back to sibir');
        ok(global.LHOpenTTD.resolveSectorOwner(ottdSt, 40, 40).kind === 'voronoi', 'entire map partitioned via Voronoi');

        // Consortium Market bot order + direct inter-company trade offer + AI bot tick
        var ironBuyOrder = ottdSt.marketOrders.filter(function (o) { return o.isBot && o.side === 'buy' && o.item === 'minecraft:iron_ingot'; })[0];
        ok(!!ironBuyOrder && lhMarketSell(server, oP1, ironBuyOrder.id, true) > 0, 'sold iron ingots to AI bot buy order on Consortium Market');
        oP1.inventory.items[0] = { id: 'minecraft:iron_ingot', count: 16, empty: false };
        var directOffer = lhCreateTradeOffer(server, oP1, 'volga', 8, 120, true);
        ok(!!directOffer && lhAcceptTradeOffer(server, oP2, directOffer.id, true) === 1, 'inter-company direct trade offer created and accepted');
        var botEvents = lhBotTick(server, true);
        ok(Array.isArray(botEvents), 'AI bot tick executes cleanly inside active worldborder');
        ok(server.getAdvancement('longhaul:openttd/company') !== null && server.getAdvancement('longhaul:openttd/empire') !== null, 'OpenTTD Chapter 14 advancements exist');
        LHOTTDState = JSON.parse(ottdSaved);
        lhOttdSave(server);

        // 23. Event log ring buffer, safe spawn Y check (not bedrock Y=-64), and main vs optional chapter summary
        var evtSaved = JSON.stringify(lhEventsRead(server));
        lhLogEvent(server, 'hazard', 'Integration test event log entry', { chatMode: 'never' });
        ok(lhEventsRead(server).events.length >= 1, 'lhLogEvent records entry in persistent event log');
        LHEventState = JSON.parse(evtSaved);
        lhEventsSave(server);
        ok(lhFindSafeRespawnY(overworld, 12, 12) >= 48, 'safe respawn Y stays well above Y=-64 bedrock (' + lhFindSafeRespawnY(overworld, 12, 12) + ')');
        for (var sxC = 11; sxC <= 13; sxC++) {
          for (var szC = 11; szC <= 13; szC++) {
            if (String(overworld.getBlock(sxC, 80, szC).id) === 'minecraft:cobblestone') {
              overworld.getBlock(sxC, 80, szC).set('minecraft:air');
            }
          }
        }
        ok(lhChapterProgressSummary(server).totalMain === 61 && lhTerritoryCounts(server).total === 61, 'main campaign chapter progress tracks 61 core chapters (ch00..ch12, ch14..ch61) and 61 territory stages excluding optional photo');

        // 24. /lh GUI Command Center & control_tablet item + all 11 tabs render cleanly
        ok(!Item.of('longhaul:control_tablet', 1).empty, 'longhaul:control_tablet registered');
        ok(!lhGuiItem('minecraft:barrel', 'Тест', ['Строка 1', 'Строка 2'], 1).empty, 'lhGuiItem creates ItemStack with name and lore');
        var guiSnap = lhGuiSnapshot(server, fp, 'hub');
        ok(guiSnap.borderSize === 724 && guiSnap.totalChapters === 61 && guiSnap.hazardsTotal === 100, 'lhGuiSnapshot reports live territory (61 chapters) & 100 complications');
        ok(disp.performPrefixedCommand(src, 'lh tablet') === 1, 'brigadier /lh tablet');
        var mockGuiSlots = {};
        var mockGui = {
          getSlot: function (gx, gy) {
            var k = gx + ',' + gy;
            if (!mockGuiSlots[k]) {
              mockGuiSlots[k] = {
                item: null,
                leftHandlers: [],
                setItem: function (it) { this.item = it; },
                resetClickHandlers: function () { this.leftHandlers = []; },
                setLeftClicked: function (fn) { this.leftHandlers.push(fn); },
                setRightClicked: function (fn) { this.onRight = fn; },
                setShiftLeftClicked: function (fn) { this.onShift = fn; }
              };
            }
            return mockGuiSlots[k];
          }
        };
        LH_GUI_TABS.forEach(function (tabObj) {
          mockGuiSlots = {};
          lhRenderGuiTab(mockGui, server, fp, tabObj.id, null);
          ok(Object.keys(mockGuiSlots).length === 54, 'GUI tab ' + tabObj.id + ' renders all 54 chest slots');
        });
        // Verify background does NOT register dummy setLeftClicked that would shadow slot button handlers in KubeJS ChestMenuData
        mockGuiSlots = {};
        lhRenderGuiTab(mockGui, server, fp, 'hub', null);
        ok(mockGuiSlots['0,0'].leftHandlers.length === 0, 'background slot has 0 shadowed clickHandlers (uses gui.anyClicked)');
        ok(mockGuiSlots['1,1'].leftHandlers.length === 1, 'hub Contracts button has exactly 1 active leftClick handler');

        // Real CustomChestMenu click tests via ServerPlayer fp
        var ClickTypeCls = Java.loadClass('net.minecraft.world.inventory.ClickType');
        ok(disp.performPrefixedCommand(src, 'lh gui') === 1, 'brigadier /lh gui opens cleanly');
        ok(fp.containerMenu && fp.containerMenu.data && fp.containerMenu.data.rows === 6, 'fp.containerMenu is live CustomChestMenu (hub)');
        fp.containerMenu.clicked(1 + 1 * 9, 0, ClickTypeCls.PICKUP, fp);
        ok(fp.containerMenu && fp.containerMenu.data && String(fp.containerMenu.data.title.getString()).indexOf('Контракты') >= 0, 'real click on hub (1,1) opens Contracts tab');
        fp.containerMenu.clicked(3 + 5 * 9, 0, ClickTypeCls.PICKUP, fp);
        ok(fp.containerMenu && fp.containerMenu.data && String(fp.containerMenu.data.title.getString()).indexOf('Карта') >= 0, 'real click on footer (3,5) opens enlarged Territory 7x5 tab');
        fp.containerMenu.clicked(5 + 5 * 9, 0, ClickTypeCls.PICKUP, fp);
        ok(fp.containerMenu && fp.containerMenu.data && String(fp.containerMenu.data.title.getString()).indexOf('Здания') >= 0, 'real click on footer (5,5) opens Buildings tab');
        fp.containerMenu.clicked(6 + 5 * 9, 0, ClickTypeCls.PICKUP, fp);
        ok(fp.containerMenu && fp.containerMenu.data && String(fp.containerMenu.data.title.getString()).indexOf('Дипломатия') >= 0, 'real click on footer (6,5) opens Diplomacy tab');
        fp.containerMenu.clicked(1 + 5 * 9, 0, ClickTypeCls.PICKUP, fp);
        ok(fp.containerMenu && fp.containerMenu.data && String(fp.containerMenu.data.title.getString()).indexOf('Вилка глав') >= 0, 'real click on footer (1,5) opens Chapter Fork tab');
        fp.containerMenu.clicked(4 + 5 * 9, 0, ClickTypeCls.PICKUP, fp);
        ok(fp.containerMenu && fp.containerMenu.data && String(fp.containerMenu.data.title.getString()).indexOf('Вилка глав') >= 0, 'real click on footer (4,5) refreshes current tab');
        fp.containerMenu.clicked(8 + 5 * 9, 0, ClickTypeCls.PICKUP, fp);
        ok(fp.containerMenu === fp.inventoryMenu, 'real click on footer (8,5) closes CustomChestMenu cleanly');

        // 24b. Chapter Fork, Company Buildings (2-way upgrade fork), Territory Violations, Diplomacy & Minimap HUD
        var forkProgSaved = JSON.stringify(lhProgRead(server));
        var pDbTest = lhProgRead(server);
        pDbTest.chapters.ch00 = true; pDbTest.chapters.ch01 = true; pDbTest.chapters.ch02 = true;
        var fStat = lhChapterForkStatus(server, fp, false);
        ok(fStat && fStat.mandatoryDone && fStat.tier === 'early' && fStat.offers.length === 3, 'chapter fork rolled 3 early choices after ch00..ch02');
        ok(fp.isAdvancementDone('longhaul:tier/mandatory_done'), 'mandatory_done advancement awarded');
        var pickRes = lhChapterForkPick(server, fp, fStat.offers[0], false);
        ok(pickRes && pickRes.ok && fp.isAdvancementDone('longhaul:chapters/' + fStat.offers[0] + '_unlocked'), 'chapter fork pick unlocked Heracles advancement');
        LHProgState = JSON.parse(forkProgSaved);
        lhProgSave(server);

        var ottdForkSaved = JSON.stringify(lhOttdRead(server));
        var stTest = lhOttdRead(server);
        global.LHOpenTTD.companyCreate(stTest, lhId(fp), 'testco', 'TestCo');
        stTest.companies.testco.cash = 5000;
        global.LHOpenTTD.claimOrCaptureSector(stTest, 'testco', 0, 3, false);
        var bRes = lhBuildFacilityCmd(server, fp, 'factory', 0, 3, false);
        ok(bRes && bRes.ok, 'built company factory in owned sector (0,3)');
        var t1a = lhUpgradeFacilityCmd(server, fp, 0, 3, global.LHOpenTTD.BUILDING_CATALOG.factory.tier1Fork[0].id, false);
        var t1b = lhUpgradeFacilityCmd(server, fp, 0, 3, global.LHOpenTTD.BUILDING_CATALOG.factory.tier1Fork[1].id, false);
        ok(t1a.ok && !t1b.ok, 'building Tier 1 2-way upgrade fork locks out alternate branch');
        var vRes = global.LHOpenTTD.recordTerritoryViolation(stTest, 'testco', 'bot_ironrail', 'break_block', 2, 0);
        ok(vRes.delta < 0 && vRes.newScore < 0, 'territory violation reduces diplomatic relation score');
        var dRes = lhDiplomacyAction(server, fp, 'transit', 'bot_ironrail', null, false);
        ok(dRes && dRes.ok && global.LHOpenTTD.canTransit(stTest, 'testco', 'bot_ironrail'), 'diplomacy transit license purchased cleanly');
        ok(disp.performPrefixedCommand(src, 'lh minimap toggle') === 1, 'brigadier /lh minimap toggle');
        ok(disp.performPrefixedCommand(src, 'lh building list') === 1, 'brigadier /lh building list');
        ok(disp.performPrefixedCommand(src, 'lh diplomacy status') === 1, 'brigadier /lh diplomacy status');
        ok(disp.performPrefixedCommand(src, 'lh chapters status') === 1, 'brigadier /lh chapters status');
        LHOTTDState = JSON.parse(ottdForkSaved);
        lhOttdSave(server);

        // 25. Every single item ID referenced across all 4,600-4,800 Heracles quests is genuinely registered in Forge 1.20.1
        var auditList = global.LHQuestItemAuditList || [];
        ok(auditList.length >= 2500, 'quest item audit list loaded (' + auditList.length + ' unique items)');
        var missingQuestItems = [];
        for (var ai = 0; ai < auditList.length; ai++) {
          var qItemId = auditList[ai];
          if (Item.of(qItemId, 1).empty) {
            missingQuestItems.push(qItemId);
          }
        }
        if (missingQuestItems.length > 0) {
          console.error('MISSING_QUEST_ITEMS_FULL: ' + missingQuestItems.join(', '));
        }
        ok(missingQuestItems.length === 0, 'unregistered quest items in Forge 1.20.1 (' + missingQuestItems.length + '): ' + missingQuestItems.join(', '));

        // 26. Verify all requested server mods loaded + custom-only Origins layer (no default origins)
        var reqModIds = [
          'ae2', 'rats', 'citadel', 'carryon', 'watut', 'coroutil',
          'origins', 'caelus', 'radium', 'torchmaster', 'mimi',
          'handson_furniture', 'handson_delight', 'diegesis',
          'neon_glowsticks', 'lumen_rigs', 'refurbished_furniture', 'framework'
        ];
        var missingMods = reqModIds.filter(function (mid) { return !Platform.isLoaded(mid); });
        ok(missingMods.length === 0, 'all new requested server mods loaded (missing: ' + missingMods.join(', ') + ')');

        var expectedOrigins = [
          'longhaul_origins:ironclad_hauler',
          'longhaul_origins:sky_courier',
          'longhaul_origins:deep_prospector',
          'longhaul_origins:field_alchemist',
          'longhaul_origins:arc_mechanist',
          'longhaul_origins:void_drifter',
          'longhaul_origins:abyss_navigator',
          'longhaul_origins:subterranean_mole',
          'longhaul_origins:nether_strider',
          'longhaul_origins:urbanist_architect',
          'longhaul_origins:trailblazer_pathfinder'
        ];
        var RLCls = Java.loadClass('net.minecraft.resources.ResourceLocation');
        var origLayerRes = server.getResourceManager().getResource(new RLCls('origins', 'origin_layers/origin.json'));
        ok(origLayerRes.isPresent(), 'origins:origin_layers/origin.json resolved in active datapacks');
        var reader = origLayerRes.get().openAsReader();
        var layerTxt = '', lLine;
        while ((lLine = reader.readLine()) !== null) layerTxt += lLine;
        reader.close();
        var layerJson = JSON.parse(layerTxt);
        ok(layerJson.replace === true, 'origins:origin layer uses replace=true to disable all default origins');
        ok(Array.isArray(layerJson.origins) && layerJson.origins.length === 11, 'origins:origin layer lists exactly 11 custom origins');
        expectedOrigins.forEach(function (oid) {
          ok(layerJson.origins.indexOf(oid) !== -1, 'custom origin present in layer: ' + oid);
        });
        var hasDefaultOrig = layerJson.origins.some(function (oid) { return String(oid).indexOf('origins:') === 0; });
        ok(!hasDefaultOrig, 'no default origins:* remain in origins:origin layer');

        // Also check live OriginsForge OriginLayer registry if registered in server.registryAccess()
        var OriginsAPICls = Java.loadClass('io.github.edwinmindcraft.origins.api.OriginsAPI');
        var layerReg = OriginsAPICls.getLayersRegistry(server);
        var mainLayer = layerReg.get(new RLCls('origins', 'origin'));
        ok(mainLayer !== null, 'OriginsAPI main layer origins:origin exists');
        if (mainLayer) {
          var regOrigIds = [];
          var itOrig = mainLayer.origins().iterator();
          while (itOrig.hasNext()) {
            var hk = itOrig.next();
            regOrigIds.push(String(hk.unwrapKey().get().location()));
          }
          ok(regOrigIds.length === 11, 'live OriginsAPI layer has 11 origins (' + regOrigIds.join(', ') + ')');
          ok(!regOrigIds.some(function (id) { return id.indexOf('origins:') === 0; }), 'live OriginsAPI layer contains zero default origins');
        }

        // 27. Map byte crash fix, Ch.11 looting bug fix, per-player border max, dynamic bot spawn, and live economy recipe graph
        var stByteTest = lhOttdRead(server);
        Object.keys(stByteTest.companies).forEach(function (cid) {
          var sb = lhCompanyMapColorByte(stByteTest, cid, true, false);
          ok(sb >= -128 && sb <= 127, 'signed map byte valid for ' + cid + ': ' + sb);
        });
        var givenMapStack = null;
        var mapActor = {
          uuid: '00000000-0000-4000-8000-000000000077',
          x: 0, y: 80, z: 0,
          inventory: { slots: 36, getStackInSlot: function () { return Item.empty; } },
          give: function (it) { givenMapStack = it; },
          tell: function () {}
        };
        ok(lhGiveTerritoryMapItem(server, mapActor, false, false) === 1, 'lhGiveTerritoryMapItem succeeds without java.lang.Byte error');
        var MapItemClsTest = Java.loadClass('net.minecraft.world.item.MapItem');
        var TerritoryMapHelperTest = Java.loadClass('com.longhaul.runtime.map.TerritoryMapHelper');
        var savedMap = givenMapStack ? MapItemClsTest.getSavedData(givenMapStack, overworld) : null;
        ok(savedMap !== null && TerritoryMapHelperTest.isLocked(savedMap) === true && savedMap.locked === true,
          'territory map item MapItemSavedData is locked=true so vanilla terrain never overwrites it');
        var gridPxBefore = TerritoryMapHelperTest.getColorUnsigned(savedMap, 0, 0);
        if (givenMapStack && typeof givenMapStack.inventoryTick === 'function') {
          givenMapStack.inventoryTick(overworld, fp, 0, true);
        }
        var savedMapAfter = MapItemClsTest.getSavedData(givenMapStack, overworld);
        var gridPxAfter = TerritoryMapHelperTest.getColorUnsigned(savedMapAfter, 0, 0);
        ok(savedMapAfter && gridPxAfter === gridPxBefore && gridPxAfter === 119,
          'territory map pixels preserved across inventoryTick (grid pixel=' + gridPxAfter + ')');

        var progSaved27 = JSON.stringify(lhProgRead(server));
        var db27 = lhProgRead(server);
        db27.nuclearVerified = false;
        db27.chapters.ch11 = false;
        var lootActor = {
          uuid: '00000000-0000-4000-8000-000000000078',
          inventory: {
            slots: 2,
            getStackInSlot: function (s) {
              return s === 0 ? Item.of('draconicevolution:draconium_ingot', 4) : Item.of('nuclearcraft:steel_ingot', 4);
            }
          }
        };
        lhScanWorkshopItems(server, lootActor);
        ok(db27.nuclearVerified === false, 'holding looted draconic/nuclear items does NOT auto-verify ch11');

        db27.chaptersByPlayer = {
          pA: { ch00: true, ch01: true, ch02: true },
          pB: { ch03: true, ch05: true }
        };
        db27.adminChapters = {};
        var maxBorder = lhTerritoryCounts(server);
        ok(maxBorder.unlocked === 3, 'border uses max single-player completed chapters (3), not sum (5): ' + maxBorder.unlocked);
        LHProgState = JSON.parse(progSaved27);
        lhProgSave(server);

        lhRefreshRecipeEconomyGraph(server);
        var econLive = lhEconRead(server);
        ok(Object.keys(econLive.recipePrices || {}).length >= 100, 'live Forge recipe graph propagated into economy (' + Object.keys(econLive.recipePrices).length + ' items, debug=' + JSON.stringify(LHLastRecipeGraphDebug) + ')');
        ok(disp.performPrefixedCommand(src, 'lh price check minecraft:iron_ingot') === 1, 'brigadier /lh price check');
        ok(disp.performPrefixedCommand(src, 'lh aspects') === 1, 'brigadier /lh aspects');

        // 28. First-join spawn & out-of-border rescue stay strictly inside active world border + Xaero sync works
        var halfBorderNow = lhActiveBorderHalf(server);
        var progSaved28 = JSON.stringify(lhProgRead(server));
        var newJoiner = {
          uuid: '00000000-0000-4000-8000-000000000099',
          username: 'TestNewJoiner',
          level: overworld,
          x: 0.5, y: 80, z: 0.5,
          teleportTo: function () {
            if (arguments.length === 3) {
              this.x = Number(arguments[0]); this.y = Number(arguments[1]); this.z = Number(arguments[2]);
            }
          },
          tell: function () {},
          isAdvancementDone: function () { return false; },
          unlockAdvancement: function () {},
          getName: function () { return { getString: function () { return 'TestNewJoiner'; } }; }
        };
        lhFirstJoinRandomSpawn(server, newJoiner);
        ok(Math.abs(newJoiner.x) <= halfBorderNow - 16 && Math.abs(newJoiner.z) <= halfBorderNow - 16,
          'first-join spawn strictly inside world border (+/-' + (halfBorderNow - 16) + '): (' + newJoiner.x + ', ' + newJoiner.z + ')');
        var db28 = lhProgRead(server);
        db28.playerHomeSpawns[newJoiner.uuid] = { x: halfBorderNow + 250, y: 80, z: halfBorderNow + 250 };
        newJoiner.x = halfBorderNow + 250;
        newJoiner.z = halfBorderNow + 250;
        lhEnsureSafeSpawn(server, newJoiner, true);
        ok(Math.abs(newJoiner.x) <= halfBorderNow - 16 && Math.abs(newJoiner.z) <= halfBorderNow - 16,
          'out-of-border player rescued strictly inside world border: (' + newJoiner.x + ', ' + newJoiner.z + ')');
        LHProgState = JSON.parse(progSaved28);
        lhProgSave(server);

        var xaeroPackets = [];
        var xaeroActor = {
          uuid: lhId(fp),
          sendData: function (ch, data) { xaeroPackets.push({ ch: ch, data: data }); }
        };
        ok(lhSyncXaeroTerritories(server, xaeroActor) && xaeroPackets.length === 1 && xaeroPackets[0].ch === 'lh:xaero_territories',
          'lhSyncXaeroTerritories sends lh:xaero_territories payload');

        console.info('LH_INTEGRATION_PASS: items + contracts + shift + brigadier + sites + nbt_structures + archive_repair + production + recovery + photo + cc + camp + cargo + territory + casino + voidout_k + random_respawn + death_item_loss + nuclear + draconic + openttd + eventlog + gui + economy + map_byte_fix + border_spawn_safety + xaero_sync + quest_items_' + auditList.length + ' + custom_origins_only');
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

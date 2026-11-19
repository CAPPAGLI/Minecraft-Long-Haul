// TEST WORLD ONLY — deliberately not distributed in overrides.
var LHIntegrationVerify=null;
ServerEvents.tick(function(event){if(LHClock>=60&&LHIntegrationVerify){var verify=LHIntegrationVerify;LHIntegrationVerify=null;verify();}});
ServerEvents.loaded(function(event){
  var server=event.server;
  var ok=function(v,msg){if(!v)throw new Error(msg);};
  try{
    server.runCommandSilent('forceload add 0 0');
    var b=server.getLevel('minecraft:overworld').getBlock(0,80,0);b.set('minecraft:air');b.set('minecraft:barrel');var inv=b.inventory;
    ok(inv.slots===27,'barrel slots');
    ok(inv.isEmpty(),'barrel initially empty');
    inv.setStackInSlot(0,Item.of('create:iron_sheet',64));
    ok(inv.getStackInSlot(0).count===64,'insert/get inventory');
    var taken=inv.extractItem(0,16,false);
    ok(taken.count===16,'actual extraction');
    ok(inv.getStackInSlot(0).count===48,'actual remainder');
    var spec=global.LHContracts.plate_shift,j=global.LHContractEngine.begin('plate_shift',spec);
    for(var n=0;n<180;n++)global.LHContractEngine.step(j,spec,n%60===0?{'create:iron_sheet':16}:{},true);
    ok(j.status==='complete'&&j.totals['create:iron_sheet']===48,'timed job');
    server.persistentData.putString('lh_integration_result',JSON.stringify({ok:true,consumed:16,timedJob:j.status}));
    ok(JSON.parse(String(server.persistentData.getString('lh_integration_result'))).ok,'persistentData roundtrip');
    var db=lhRead(server);ok(db.players!==undefined,'adapter state loaded');
    lhSave(server);ok(String(server.persistentData.getString('longhaul_contracts_v1')).length>0,'adapter persistent save');
    for(var slot=0;slot<inv.slots;slot++)inv.setStackInSlot(slot,Item.empty);
    var actor={uuid:'00000000-0000-4000-8000-000000000001',level:{dimension:'minecraft:overworld'},x:0.5,y:81,z:0.5,tell:function(msg){}};
    delete db.players[String(actor.uuid)];
    ok(lhRegister(server,actor)===1,'actual adapter register');
    ok(lhAccept(server,actor,'plates')===1,'actual adapter accept');
    inv.setStackInSlot(0,Item.of('create:iron_sheet',64));
    LHIntegrationVerify=function(){
      try{
        var profile=lhProfile(server,actor);
        ok(profile.job.status==='complete','live tick completion '+JSON.stringify(profile)+' clock='+LHClock+' loaded='+!!lhLoadedBlock(server,profile.terminal));
        ok(profile.receipts.plates.totals['create:iron_sheet']===64,'receipt quantity');
        ok(inv.isEmpty(),'goods consumed by real adapter');
        // Forge explicitly rejects advancements for FakePlayer; use an unconnected real ServerPlayer fixture.
        var PlayerClass=Java.loadClass('net.minecraft.server.level.ServerPlayer');
        var ProfileClass=Java.loadClass('com.mojang.authlib.GameProfile');
        var UUIDClass=Java.loadClass('java.util.UUID');
        var fp=new PlayerClass(server,server.getLevel('minecraft:overworld'),new ProfileClass(UUIDClass.randomUUID(),'LHReceiptTest'));
        fp.connection=Java.loadClass('net.minecraftforge.common.util.FakePlayerFactory').getMinecraft(server.getLevel('minecraft:overworld')).connection;
        ok(server.getAdvancement('longhaul:contracts/plates')!==null,'receipt advancement exists');
        lhSync(fp,profile);
        ok(fp.isAdvancementDone('longhaul:contracts/plates'),'actual advancement receipt awarded');
        var xp=fp.totalExperience;lhSync(fp,profile);
        ok(fp.isAdvancementDone('longhaul:contracts/plates'),'idempotent receipt sync');
        ok(fp.totalExperience===xp,'no duplicate XP from receipt sync');
        delete db.players[String(actor.uuid)];lhSave(server);b.set('minecraft:air');server.runCommandSilent('forceload remove 0 0');
        console.info('LH_INTEGRATION_PASS: barrel extraction + timed model + persistentData + live adapter register/accept/tick/consume/receipt + advancement sync');
      }catch(err2){console.error('LH_INTEGRATION_FAIL: live adapter '+err2);}
    };
  }catch(err){console.error('LH_INTEGRATION_FAIL: '+err);throw err;}
});

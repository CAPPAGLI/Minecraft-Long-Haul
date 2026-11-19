// Alpha server adapter. A barrel accepts and CONSUMES contract goods.
// This is verified intake, not an anti-cheat factory/vehicle provenance system.
var LHPos = Java.loadClass('net.minecraft.core.BlockPos');
var LHState = null;
var LHClock = 0;
function lhRead(server) {
  if (LHState !== null) return LHState;
  var raw = server.persistentData.getString('longhaul_contracts_v1');
  LHState = raw ? JSON.parse(String(raw)) : { players: {} };
  return LHState;
}
function lhSave(server) {
  server.persistentData.putString('longhaul_contracts_v1', JSON.stringify(LHState));
}
function lhId(player) { return String(player.uuid); }
function lhMsg(player, text) { player.tell('[Long Haul] ' + text); }
function lhProfile(server, player) {
  var db = lhRead(server), id = lhId(player);
  if (!db.players[id]) db.players[id] = { terminal: null, job: null, receipts: {} };
  return db.players[id];
}
function lhKey(t) { return t.dim + ':' + t.x + ':' + t.y + ':' + t.z; }
function lhLoadedBlock(server, t) {
  var level = server.getLevel(t.dim);
  if (!level || !level.hasChunkAt(new LHPos(t.x, t.y, t.z))) return null;
  return level.getBlock(t.x, t.y, t.z);
}
function lhRegister(server, player) {
  var db=lhRead(server), p=lhProfile(server,player);
  if (p.job && p.job.status==='active') { lhMsg(player,'Сначала /lh abort.'); return 0; }
  if (!db.players[lhId(player)].terminal && Object.keys(db.players).length>32) { lhMsg(player,'Лимит прототипа: 32 участника.'); return 0; }
  var t={dim:String(player.level.dimension),x:Math.floor(player.x),y:Math.floor(player.y)-1,z:Math.floor(player.z)};
  if (t.dim!=='minecraft:overworld') { lhMsg(player,'Терминал прототипа работает только в обычном мире.'); return 0; }
  var block=lhLoadedBlock(server,t);
  if (!block || block.id!=='minecraft:barrel') { lhMsg(player,'Встаньте НА обычную бочку и повторите /lh terminal.'); return 0; }
  var busy=Object.keys(db.players).some(function(id){var x=db.players[id];return id!==lhId(player)&&x.terminal&&lhKey(x.terminal)===lhKey(t);});
  if(busy){lhMsg(player,'Эта бочка принадлежит другому участнику.');return 0;}
  if(!block.inventory.isEmpty()){lhMsg(player,'Перед регистрацией опустошите бочку.');return 0;}
  p.terminal=t;lhSave(server);lhMsg(player,'Терминал зарегистрирован. /lh help — список заказов.');return 1;
}
function lhAccept(server,player,id) {
  var p=lhProfile(server,player),spec=global.LHContracts[id];
  if(!p.terminal){lhMsg(player,'Сначала зарегистрируйте пустую бочку: /lh terminal.');return 0;}
  if(p.job&&p.job.status==='active'){lhMsg(player,'Уже есть активный заказ. /lh status или /lh abort.');return 0;}
  if(p.receipts[id]){lhMsg(player,'Этот разовый заказ уже выполнен.');return 0;}
  var b=lhLoadedBlock(server,p.terminal);
  if(!b||b.id!=='minecraft:barrel'||!b.inventory.isEmpty()){lhMsg(player,'Терминал должен быть загружен и пуст.');return 0;}
  p.job=global.LHContractEngine.begin(id,spec);lhSave(server);
  lhMsg(player,spec.title+'. Приёмка РАСХОДУЕТ товары без возврата. Подавайте их в бочку воронками/транспортёрами. Условия: '+JSON.stringify(spec.goods)+(spec.windows?' за каждое из '+spec.windows+' окон по '+spec.windowSeconds+' секунд.':'.'));
  return 1;
}
function lhStatus(server,player){var p=lhProfile(server,player);lhMsg(player,JSON.stringify({terminal:p.terminal,job:p.job,completed:Object.keys(p.receipts)}));return 1;}
function lhSync(player,profile){
  Object.keys(profile.receipts).forEach(function(id){
    // Idempotent advancement unlock: vanilla does not reward an already complete advancement again.
    var adv='longhaul:contracts/'+id;
    if(!player.isAdvancementDone(adv)) player.unlockAdvancement(adv);
  });
}
ServerEvents.commandRegistry(function(event){
  var C=event.commands,root=C.literal('lh');
  root.then(C.literal('help').executes(function(ctx){var p=ctx.source.playerOrException;lhMsg(p,'Встаньте на пустую бочку: /lh terminal. Затем /lh accept <заказ>, /lh status, /lh abort. Заказы: '+Object.keys(global.LHContracts).join(', '));return 1;}));
  root.then(C.literal('terminal').executes(function(ctx){return lhRegister(ctx.source.server,ctx.source.playerOrException);}));
  root.then(C.literal('status').executes(function(ctx){return lhStatus(ctx.source.server,ctx.source.playerOrException);}));
  root.then(C.literal('abort').executes(function(ctx){var p=lhProfile(ctx.source.server,ctx.source.playerOrException);if(p.job&&p.job.status==='active')p.job.status='aborted';lhSave(ctx.source.server);lhMsg(ctx.source.playerOrException,'Заказ остановлен. Уже принятые товары израсходованы, оставшиеся в бочке можно забрать.');return 1;}));
  var accept=C.literal('accept');
  Object.keys(global.LHContracts).forEach(function(id){accept.then(C.literal(id).executes(function(ctx){return lhAccept(ctx.source.server,ctx.source.playerOrException,id);}));});
  root.then(accept);event.register(root);
});
ServerEvents.loaded(function(event){
  lhRead(event.server);
  if(!event.server.persistentData.getBoolean('longhaul_border_initialized')){
    event.server.runCommandSilent('worldborder center 0 0');event.server.runCommandSilent('worldborder set 175000');
    event.server.persistentData.putBoolean('longhaul_border_initialized',true);
  }
  console.info('[LH] 8 intake contracts loaded. These measure intake, not manufacturing provenance.');
});
PlayerEvents.loggedIn(function(event){lhSync(event.player,lhProfile(event.server,event.player));});
ServerEvents.tick(function(event){
  LHClock++;if(LHClock%20!==0)return;
  var server=event.server,db=lhRead(server),changed=false;
  Object.keys(db.players).forEach(function(id){
    var p=db.players[id],job=p.job;if(!job||job.status!=='active')return;
    var b=lhLoadedBlock(server,p.terminal);if(!b)return; // no force-loading; unloaded seconds do not count
    if(b.id!=='minecraft:barrel'){job.status='failed_terminal_missing';changed=true;return;}
    var inv=b.inventory,spec=global.LHContracts[job.id],need=global.LHContractEngine.remaining(job,spec),accepted={};
    for(var slot=0;slot<inv.slots;slot++){
      var stack=inv.getStackInSlot(slot),item=String(stack.id),n=need[item]||0;
      if(n>0){var extracted=inv.extractItem(slot,Math.min(n,stack.count),false);var count=Number(extracted.count);accepted[item]=(accepted[item]||0)+count;need[item]-=count;}
    }
    global.LHContractEngine.step(job,spec,accepted,true);changed=true;
    if(job.status==='complete'){
      p.receipts[job.id]={totals:job.totals,windows:job.windows};
      var player=server.getPlayer(id);if(player){lhSync(player,p);lhMsg(player,'Заказ выполнен: '+spec.title);}
    }else if(job.status==='failed'){
      var player2=server.getPlayer(id);if(player2)lhMsg(player2,'Заказ не выполнен: пропущена норма окна. Можно начать заново; расходованные товары не возвращаются.');
    }
  });
  if(changed)lhSave(server);
});
// Prevent ordinary manual access/breakage during a trial. Hoppers and belts remain usable.
// Does NOT claim protection against explosions, pistons, contraption assembly or all modded interactions.
function lhActiveAt(server,block){var db=lhRead(server),key=String(block.dimension)+':'+block.x+':'+block.y+':'+block.z;return Object.keys(db.players).some(function(id){var p=db.players[id];return p.job&&p.job.status==='active'&&p.terminal&&lhKey(p.terminal)===key;});}
BlockEvents.rightClicked('minecraft:barrel',function(event){if(lhActiveAt(event.server,event.block))event.cancel();});
BlockEvents.broken('minecraft:barrel',function(event){if(lhActiveAt(event.server,event.block))event.cancel();});

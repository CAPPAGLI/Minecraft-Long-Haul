const fs=require('fs'),vm=require('vm'),assert=require('assert');
const sandbox={global:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../overrides/kubejs/startup_scripts/00_contract_engine.js','utf8'),sandbox);
const e=sandbox.global.LHContractEngine;let tests=0;
function test(name,f){f();tests++;console.log('PASS '+name);}
function clone(x){return JSON.parse(JSON.stringify(x));}
const single={goods:{iron:64}},timed={goods:{iron:4,copper:2},windowSeconds:60,windows:3};
test('inventory presence alone never completes',()=>{let j=e.begin('a',single);for(let i=0;i<100;i++)e.step(j,single,{},true);assert.equal(j.status,'active');});
test('wrong items do not count',()=>{let j=e.begin('a',single);e.step(j,single,{gold:64},true);assert.equal(j.totals.iron,0);assert.equal(j.status,'active');});
test('one-off requires actual accepted full quantity',()=>{let j=e.begin('a',single);e.step(j,single,{iron:63},true);assert.equal(j.status,'active');e.step(j,single,{iron:1},true);assert.equal(j.status,'complete');});
test('completed contract cannot consume twice',()=>{let j=e.begin('a',single);e.step(j,single,{iron:64},true);e.step(j,single,{iron:64},true);assert.equal(j.totals.iron,64);});
test('unloaded terminal pauses without consuming or ticking',()=>{let j=e.begin('a',timed);for(let i=0;i<300;i++)e.step(j,timed,{iron:4,copper:2},false);assert.equal(j.seconds,0);assert.equal(j.windows,0);});
test('large stockpile cannot complete timed trial immediately',()=>{let j=e.begin('a',timed);e.step(j,timed,{iron:4,copper:2},true);assert.equal(j.status,'active');assert.equal(j.windows,0);assert.throws(()=>e.step(j,timed,{iron:1},true));});
test('one empty window fails',()=>{let j=e.begin('a',timed);for(let i=0;i<60;i++)e.step(j,timed,{},true);assert.equal(j.status,'failed');});
test('every input must meet quota',()=>{let j=e.begin('a',timed);e.step(j,timed,{iron:4},true);for(let i=1;i<60;i++)e.step(j,timed,{},true);assert.equal(j.status,'failed');});
test('three successful windows complete only after 180 active seconds',()=>{let j=e.begin('a',timed);for(let s=0;s<180;s++){e.step(j,timed,s%60===0?{iron:4,copper:2}:{},true);if(s<179)assert.equal(j.status,'active');}assert.equal(j.status,'complete');assert.equal(j.windows,3);assert.equal(j.totals.iron,12);});
test('JSON roundtrip preserves timer and totals',()=>{let j=e.begin('a',timed);for(let i=0;i<31;i++)e.step(j,timed,i===0?{iron:4,copper:2}:{},true);j=clone(j);for(let i=31;i<60;i++)e.step(j,timed,{},true);assert.equal(j.windows,1);});
test('negative and fractional consumption rejected',()=>{let j=e.begin('a',single);assert.throws(()=>e.step(j,single,{iron:-1},true));assert.throws(()=>e.step(j,single,{iron:.5},true));});
test('failed trial never resumes accidentally',()=>{let j=e.begin('a',timed);j.status='failed';e.step(j,timed,{iron:4,copper:2},true);assert.equal(j.seconds,0);});
console.log(tests+' model tests passed; Minecraft integration is a separate test.');

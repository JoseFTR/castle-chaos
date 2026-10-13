'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');
const start=source.indexOf('function comebackBonuses(players){');
const end=source.indexOf('function finishGame(r){',start);
assert(start>=0&&end>start);
const bonuses=vm.runInNewContext(source.slice(start,end)+'\ncomebackBonuses;',{});
const players=points=>points.map((fame,i)=>({id:String(i),fame,connected:true}));
let b=bonuses(players([200,100]));assert.equal(b.get('0'),0);assert.equal(b.get('1'),10);
b=bonuses(players([200,200]));assert.equal(b.get('0'),0);assert.equal(b.get('1'),0);
b=bonuses(players([800,700,600,500,400,300,200,100]));assert.deepEqual([...b.values()],[0,0,5,5,10,10,15,15]);
b=bonuses(players([300,300,200,200,100,100]));assert.deepEqual([...b.values()],[0,0,5,5,10,10]);
const disconnected=players([300,200,100]);disconnected[1].connected=false;
b=bonuses(disconnected);assert.equal(b.has('1'),false);assert.equal(b.get('2'),10); // second among two connected players is trailing
console.log('PASS: comeback standing bonuses for 2, 6, 8 players, ties and disconnects');

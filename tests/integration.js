'use strict';
const assert=require('node:assert/strict');
const net=require('node:net');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const PORT=24000+Math.floor(Math.random()*10000);
const base=`http://127.0.0.1:${PORT}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class Client {
 constructor(){this.state=null;this.identity=null;this.buffer=Buffer.alloc(0);this.waiters=[];this.closed=false;}
 async open(){this.socket=net.connect(PORT,'127.0.0.1');await new Promise((res,rej)=>{this.socket.once('connect',res);this.socket.once('error',rej)});this.socket.on('data',chunk=>this.read(chunk));this.socket.on('close',()=>{this.closed=true});this.socket.write(`GET / HTTP/1.1\r\nHost: 127.0.0.1:${PORT}\r\nOrigin: ${base}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\n\r\n`);await this.until(()=>this.handshake);return this;}
 read(chunk){this.buffer=Buffer.concat([this.buffer,chunk]);if(!this.handshake){const pos=this.buffer.indexOf('\r\n\r\n');if(pos<0)return;assert.match(this.buffer.subarray(0,pos).toString(),/101 Switching Protocols/);this.buffer=this.buffer.subarray(pos+4);this.handshake=true;this.notify();}
 while(this.buffer.length>=2){let len=this.buffer[1]&127,off=2;if(len===126){if(this.buffer.length<4)return;len=this.buffer.readUInt16BE(2);off=4}if(this.buffer.length<off+len)return;const payload=this.buffer.subarray(off,off+len).toString();this.buffer=this.buffer.subarray(off+len);const msg=JSON.parse(payload);if(msg.type==='state')this.state=msg.state;if(msg.type==='identity')this.identity=msg;if(msg.type==='error')throw Error(msg.message);this.notify();}}
 notify(){for(const f of [...this.waiters])f()}
 until(pred,timeout=3000){if(pred())return Promise.resolve();return new Promise((res,rej)=>{const t=setTimeout(()=>{this.waiters=this.waiters.filter(x=>x!==check);rej(Error('Timed out: '+JSON.stringify(this.state?.phase)))},timeout);const check=()=>{if(pred()){clearTimeout(t);this.waiters=this.waiters.filter(x=>x!==check);res()}};this.waiters.push(check)})}
 send(obj){const data=Buffer.from(JSON.stringify(obj));const header=Buffer.alloc(data.length<126?6:8);header[0]=0x81;header[1]=0x80|(data.length<126?data.length:126);let off=2;if(data.length>=126){header.writeUInt16BE(data.length,2);off=4}const mask=crypto.randomBytes(4);mask.copy(header,off);const payload=Buffer.from(data);for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];this.socket.write(Buffer.concat([header,payload]))}
 close(){this.socket.write(Buffer.from([0x88,0x80,...crypto.randomBytes(4)]));setTimeout(()=>this.socket.destroy(),100).unref()}
}
async function main(){const server=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,PORT:String(PORT),CASTLE_TEST_MODE:'1'},stdio:['ignore','pipe','pipe']});let logs='';server.stderr.on('data',x=>logs+=x);try{
 for(let i=0;i<100;i++){try{const r=await fetch(base);if(r.ok)break}catch{}await sleep(20)}
 const host=await new Client().open(),guest=await new Client().open();host.send({type:'create',name:'Host'});await host.until(()=>host.state?.code&&host.identity);const code=host.state.code;guest.send({type:'join',name:'Guest',code});await guest.until(()=>guest.state?.players.length===2&&guest.identity);host.send({type:'start'});await host.until(()=>host.state?.phase==='board');
 const played=[];
 for(let round=1;round<=10;round++){
  assert.equal(host.state.round,round);
  for(let j=0;j<2;j++){
   await host.until(()=>host.state?.phase==='board');const actor=host.state.players[host.state.turn].id===host.identity.id?host:guest;actor.send({type:'roll'});await host.until(()=>host.state.phase==='rolling');await host.until(()=>host.state.phase!=='rolling');
  }
  await host.until(()=>host.state?.phase==='minigame');played.push(host.state.game);
  // One player scores; the other gets zero. The scoring should not award a first-place tie.
  host.send({type:'score',score:2});
  await host.until(()=>host.state.phase==='results');
  const results=host.state.results;assert.equal(results.length,2);assert(results.every(x=>x.award>=5));assert.equal(results.reduce((a,x)=>a+x.award,0),50);
  host.send({type:'next'});await host.until(()=>host.state.round===round+1||host.state.phase==='final');
 }
 assert.equal(host.state.phase,'final');assert(host.state.champion);assert.equal(new Set(played.slice(0,7)).size,7,'first seven mini-games should be unique');assert.equal(host.state.players.length,2);console.log('PASS: 10 rounds, 2 players, 7 unique games, scoring, finale');
 host.send({type:'rematch'});await host.until(()=>host.state.phase==='board');assert.equal(host.state.round,1);
 guest.close();await host.until(()=>host.state.players.some(p=>p.id===guest.identity.id&&!p.connected));
 const resumed=await new Client().open();resumed.send({type:'resume',code,id:guest.identity.id,token:guest.identity.token});await resumed.until(()=>resumed.identity&&resumed.state);assert.equal(resumed.state.code,code);console.log('PASS: reconnect to active room');resumed.close();host.close();
 // Separate room in Host's Choice mode. Host leaves; remaining player gets control and auto-fallback.
 const c=await new Client().open(),d=await new Client().open();c.send({type:'create',name:'Captain'});await c.until(()=>c.identity&&c.state?.code);d.send({type:'join',name:'Survivor',code:c.state.code});await d.until(()=>d.identity&&d.state?.players.length===2);c.send({type:'mode',mode:'choice'});await c.until(()=>c.state.gameMode==='choice');c.send({type:'start'});await c.until(()=>c.state.phase==='board');await d.until(()=>d.state.phase==='board');c.close();await d.until(()=>d.state.host===d.identity.id);if(d.state.phase==='board'){d.send({type:'roll'});await d.until(()=>d.state.phase==='rolling')}await d.until(()=>d.state.phase==='selection');await d.until(()=>d.state.phase==='minigame',2000);console.log('PASS: host disconnect, reassignment, automatic game selection');await d.until(()=>d.state.phase==='results');assert.equal(d.state.results.find(x=>!x.award)?.award,0);assert.equal(d.state.results.find(x=>x.id===d.identity.id)?.award,5);console.log('PASS: all-zero scoring, disconnected player gets no reward');d.close();
 }finally{server.kill();if(logs)console.error(logs)}
}
main().catch(e=>{console.error(e);process.exitCode=1});

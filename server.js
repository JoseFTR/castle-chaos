const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('./ws-lite');
const PORT=process.env.PORT||3000,rooms=new Map(),chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code=()=>Array.from({length:6},()=>chars[crypto.randomInt(chars.length)]).join('');
const id=()=>crypto.randomBytes(8).toString('hex');
const board=['fame','drama','rose','fame','couple','gift','heartbreak','fame','drama','rose','gift','fame','couple','heartbreak','drama','fame','rose','gift','fame','drama','couple','fame','heartbreak','gift'];
const {nextGame,GAMES}=require('./minigame-rotation');
const die=()=>crypto.randomInt(1,7);
const scoreCaps={tap:200,stop:500,dodge:160,memory:500,reaction:200,catch:200,rhythm:200};
const MAX_ROOMS=150, MAX_CLIENTS=300, MAX_MESSAGES_PER_10S=120;
let activeClients=0;
const roomTimers=new Map();
const validName=x=>typeof x==='string'&&x.length<=80;
function removeRoom(r){clearTimeout(r.timer);rooms.delete(r.code);roomTimers.delete(r.code)}
function idleCleanup(){for(const r of rooms.values()){if(Date.now()-r.updated>2*60*60*1000)removeRoom(r)}}
const cleanupInterval=setInterval(idleCleanup,10*60*1000);cleanupInterval.unref();
function touch(r){r.updated=Date.now()}

const send=(ws,obj)=>{if(ws&&ws.readyState===1){try{ws.send(JSON.stringify(obj))}catch{ws.socket?.destroy()}}};
const publicState=r=>({code:r.code,phase:r.phase,host:r.host,round:r.round,turn:r.turn,players:r.players.map(({id,name,pos,fame,roses,partner,connected})=>({id,name,pos,fame,roses,partner,connected})),board,game:r.game,gameMode:r.gameMode||'random',selectedGame:r.selectedGame||null,lastGame:r.lastGame||null,deadline:r.deadline,results:r.results,champion:r.champion,notice:r.notice,rolls:r.rolls||[],lastRoll:r.lastRoll||null,rollingUntil:r.rollingUntil||0,showdown:r.showdown||null});
const broadcast=r=>(touch(r),r.players.forEach(p=>send(p.ws,{type:'state',state:publicState(r)})));
const say=(r,s)=>{r.notice=s;broadcast(r)};
function nextTurn(r){r.turn++;while(r.turn<r.players.length&&!r.players[r.turn].connected)r.turn++;if(r.turn>=r.players.length){const eligible=r.rolls.filter(x=>r.players.some(p=>p.id===x.id&&p.connected));const high=Math.max(0,...eligible.map(x=>x.value));const winners=eligible.filter(x=>x.value===high);for(const winner of winners){const player=r.players.find(p=>p.id===winner.id);player.fame+=winners.length===1?15:10;}r.showdown={high,winners:winners.map(x=>x.id),bonus:winners.length===1?15:10};r.turn=0;if(r.gameMode==='choice'){r.phase='selection';r.selectedGame=null;say(r,'HOST CHOICE! The arena captain selects the next challenge.');}else startMiniGame(r,nextGame(r));}else broadcast(r)}
const GAME_NAMES={tap:'FOAM FRENZY',stop:'BRIDGE OF DOOM',dodge:'BOULDER PANIC',memory:'NINJA MEMORY',reaction:'SAMURAI SIGNAL',catch:'GOLDEN CATCH',rhythm:'TAIKO BEAT'};
function startMiniGame(r,game){if(!GAMES.includes(game))return;r.game=game;r.lastGame=game;r.phase='minigame';r.deadline=Date.now()+(game==='memory'?22000:16000);r.scores={};r.scoreMeta={};say(r,'MINI-GAME! '+GAME_NAMES[game]);r.timer=setTimeout(()=>finishGame(r),r.deadline-Date.now());}
function finishGame(r){if(r.phase!=='minigame')return;clearTimeout(r.timer);let scores=r.players.map(p=>({id:p.id,name:p.name,score:p.connected?Math.max(0,Math.floor(r.scores[p.id]||0)):0})).sort((a,b)=>b.score-a.score);let prev=null,rank=0;scores.forEach((s,i)=>{if(s.score!==prev)rank=i+1;prev=s.score;let p=r.players.find(x=>x.id===s.id);if(p.connected){p.fame += rank===1?30:rank===2?20:rank===3?10:5;}});r.results=scores;r.phase='results';r.deadline=0;say(r,'CHALLENGE COMPLETE! Glory awaits!');}
function finishRound(r){if(r.round>=10){r.phase='final';r.champion=[...r.players].sort((a,b)=>(b.fame+50*b.roses)-(a.fame+50*a.roses)||b.roses-a.roses)[0].id;say(r,'THE GRAND CASTLE FINALE!');return;}r.round++;r.turn=Math.max(0,r.players.findIndex(x=>x.connected));r.phase='board';r.results=[];r.rolls=[];r.lastRoll=null;r.showdown=null;r.rollingUntil=0;say(r,'Stage '+r.round+' — storm the castle!')}
function move(r,p){
 const roll=die();
 r.rolls.push({id:p.id,name:p.name,value:roll});
 r.lastRoll={id:p.id,name:p.name,value:roll};
 r.rollingUntil=Date.now()+1400;
 r.phase='rolling';
 say(r,p.name+' is rolling the die...');
 setTimeout(()=>{
  if(r.phase!=='rolling')return;
  p.pos=(p.pos+roll)%board.length;
  let space=board[p.pos],message=p.name+' rolled '+roll+' and landed on '+space.toUpperCase()+'. ';
  if(space==='fame'){p.fame+=10;message+='+10 Glory.'}
  if(space==='heartbreak'){p.fame=Math.max(0,p.fame-10);message+='-10 Glory.'}
  if(space==='rose'){if(p.fame>=20){p.fame-=20;p.roses++;message+='Claimed a crown for 20 Glory!'}else message+='Not enough Glory for a crown.'}
  if(space==='gift'){let n=[5,10,15][crypto.randomInt(3)];p.fame+=n;message+='Supply crate: +'+n+' Glory.'}
  if(space==='drama'){let n=crypto.randomInt(2)===0?15:-10;p.fame=Math.max(0,p.fame+n);message+='Castle twist: '+(n>0?'+':'')+n+' Glory.'}
  if(space==='couple'){let eligible=r.players.filter(x=>x.id!==p.id&&!x.partner&&x.connected);if(!p.partner&&eligible.length){let other=eligible[crypto.randomInt(eligible.length)];p.partner=other.id;other.partner=p.id;message+='Squad formed with '+other.name+'!'}else{p.fame+=5;message+='Training camp: +5 Glory.'}}
  r.phase='board';r.notice=message;nextTurn(r);r.notice=message;broadcast(r);
 },1400);
}
const ROOT=path.resolve(__dirname,'public');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end()}
 let pathname;try{pathname=new URL(req.url||'/', 'http://localhost').pathname;pathname=decodeURIComponent(pathname)}catch{res.writeHead(400);return res.end('Bad request')}
 if(pathname.includes('\0')||pathname.includes('\\')||pathname.split('/').includes('..')){res.writeHead(400);return res.end('Bad path')}
 const file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));
 if(file!==ROOT&&!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end('Forbidden')}
 if(!Object.hasOwn(mime,path.extname(file))){res.writeHead(404);return res.end('Not found')}
 fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end('Not found')}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)],'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'",'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:b)})
});
const wss=new WebSocketServer({server,shouldAccept:req=>{
 const origin=req.headers.origin;
 if(!origin)return false;
 try{const o=new URL(origin);return (o.protocol==='https:'||o.protocol==='http:')&&o.host===req.headers.host}catch{return false}
}});
wss.on('connection',ws=>{
 if(activeClients>=MAX_CLIENTS){ws.socket.destroy();return}
 activeClients++;
 let bucketStart=Date.now(),messageCount=0;
 ws.on('message',raw=>{
 if(Date.now()-bucketStart>10000){bucketStart=Date.now();messageCount=0}
 if(++messageCount>MAX_MESSAGES_PER_10S){ws.socket.destroy();return}
 if(typeof raw!=='string'||raw.length>2048)return;
 let m;try{m=JSON.parse(raw)}catch{return}
 if(!m||typeof m!=='object'||Array.isArray(m)||typeof m.type!=='string')return;
let r=ws.room,p=r&&r.players.find(x=>x.id===ws.pid);if(m.type==='resume'){if(typeof m.code!=='string'||typeof m.id!=='string'||typeof m.token!=='string'||ws.room)return;let target=rooms.get(m.code.toUpperCase());let returning=target?.players.find(x=>x.id===m.id&&x.token===m.token);if(!returning||returning.connected)return send(ws,{type:'error',message:'Could not restore that player.'});returning.ws=ws;returning.connected=true;ws.room=target;ws.pid=returning.id;send(ws,{type:'identity',id:returning.id,token:returning.token});broadcast(target);return}
if(m.type==='create'||m.type==='join'){if(ws.room||!validName(m.name))return;if(m.type==='create'&&rooms.size>=MAX_ROOMS)return send(ws,{type:'error',message:'Server is busy. Try again soon.'});if(m.type==='join'&&(typeof m.code!=='string'||!/^[A-Z2-9]{6}$/i.test(m.code.trim())))return send(ws,{type:'error',message:'Invalid room code.'});let c=m.type==='create'?code():m.code.toUpperCase().trim();while(m.type==='create'&&rooms.has(c))c=code();r=rooms.get(c);if(m.type==='create'){r={code:c,players:[],phase:'lobby',host:null,round:1,turn:0,game:null,deadline:0,results:[],notice:'Awaiting brave challengers...',scores:{},rolls:[],lastRoll:null,showdown:null,rollingUntil:0,gameQueue:[],lastGame:null,gameMode:'random',selectedGame:null,updated:Date.now()};rooms.set(c,r)}if(!r||r.phase!=='lobby'||r.players.length>=8)return send(ws,{type:'error',message:'Room not found, already started, or full.'});let name=String(m.name||'Contestant').trim().slice(0,18)||'Contestant';p={id:id(),name,pos:0,fame:0,roses:0,partner:null,connected:true,ws,token:crypto.randomBytes(16).toString('hex')};r.players.push(p);ws.room=r;ws.pid=p.id;if(!r.host)r.host=p.id;send(ws,{type:'identity',id:p.id,token:p.token});broadcast(r);return}if(!r||!p)return;if(m.type==='mode'&&r.phase==='lobby'&&p.id===r.host&&['random','choice'].includes(m.mode)){r.gameMode=m.mode;r.gameQueue=[];broadcast(r);return}if(m.type==='chooseGame'&&r.phase==='selection'&&p.id===r.host&&GAMES.includes(m.game)){startMiniGame(r,m.game);return}if(m.type==='start'&&r.phase==='lobby'&&p.id===r.host&&r.players.length>=2){r.phase='board';say(r,'THE CASTLE GATES OPEN!');return}if(m.type==='roll'&&r.phase==='board'&&r.players[r.turn]?.id===p.id){move(r,p);return}if(m.type==='score'&&r.phase==='minigame'&&Date.now()<=r.deadline){
 if(typeof m.score!=='number'||!Number.isFinite(m.score)||!p.connected)return;
 const now=Date.now(),last=r.scoreMeta?.[p.id]||{value:0,time:r.deadline-(r.game==='memory'?22000:16000),updates:0};
 if(now-last.time<60)return;
 const proposed=Math.floor(m.score),max=scoreCaps[r.game];
 if(proposed<last.value||proposed>max)return;
 // Rate-of-progress limits reduce trivial score injection but do not make browser-reported scores cheat-proof.
 const elapsed=Math.max(0,(now-last.time)/1000);
 const speed={tap:14,stop:110,dodge:12,memory:130,reaction:50,catch:30,rhythm:45}[r.game];
 if(proposed-last.value>Math.ceil(elapsed*speed)+({tap:2,stop:100,dodge:2,memory:50,reaction:35,catch:10,rhythm:25}[r.game]))return;
 if(last.updates>400)return;
 r.scores[p.id]=proposed;r.scoreMeta[p.id]={value:proposed,time:now,updates:last.updates+1};return
 }if(m.type==='next'&&r.phase==='results'&&p.id===r.host){finishRound(r);return}if(m.type==='rematch'&&r.phase==='final'&&p.id===r.host){r.players.forEach(x=>Object.assign(x,{pos:0,fame:0,roses:0,partner:null}));Object.assign(r,{phase:'board',round:1,turn:0,results:[],champion:null,rolls:[],lastRoll:null,showdown:null,rollingUntil:0,gameQueue:[],lastGame:null,selectedGame:null});broadcast(r);return}});ws.on('close',()=>{activeClients=Math.max(0,activeClients-1);let r=ws.room;if(!r)return;let p=r.players.find(x=>x.id===ws.pid);if(!p||p.ws!==ws)return;p.connected=false;if(r.phase==='lobby'){r.players=r.players.filter(x=>x.id!==p.id)}if(r.host===p.id)r.host=r.players.find(x=>x.connected)?.id||null;if(r.phase==='board'&&r.players[r.turn]?.id===p.id)nextTurn(r);if(!r.players.some(x=>x.connected)){clearTimeout(r.timer);removeRoom(r)}else broadcast(r)})});server.listen(PORT,()=>console.log('CASTLE CHAOS at http://localhost:'+PORT));

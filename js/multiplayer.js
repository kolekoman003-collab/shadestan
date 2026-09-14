/* KoleGame Arena v4 — polished real-time casual multiplayer */
const KG_MP = window.KG_MP || { channel:null, roomChannel:null, room:null, selectedGame:'rps', presence:new Map(), roomState:null };
window.KG_MP = KG_MP;
const KG_GAMES = {
  rps:['✊','سنگ کاغذ قیچی','2 players'], tictactoe:['⭕','دوز','2 players'], reaction:['⚡','Reaction Duel','2 players'], quiz:['🧠','Quiz Duel','2 players'],
  connect4:['🔴','چهار در خط','2 players'], highlow:['🎴','High / Low','2 players'], mathduel:['➗','Math Duel','2 players'], color:['🎨','Color Clash','2 players']
};
function kgNeedLogin(){if(!window.state?.user){showToast('اول وارد حساب شو');goToPage('account');return false}return true}
function kgCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
function roomGameLabel(g){return KG_GAMES[g]?.[1]||g}
function safeText(x){return typeof escapeHtml==='function'?escapeHtml(String(x)):String(x).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function bindArenaSelection(){
  const root=document.getElementById('arenaGameSelect'); if(!root||root.dataset.bound==='1')return;
  root.dataset.bound='1';
  root.addEventListener('click',e=>{
    const b=e.target.closest('[data-room-game]'); if(!b)return;
    e.preventDefault();
    root.querySelectorAll('[data-room-game]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); KG_MP.selectedGame=b.dataset.roomGame;
    const preview=document.getElementById('arenaSelectedGame'); if(preview)preview.textContent=roomGameLabel(KG_MP.selectedGame);
  });
}
async function initMultiplayer(){
  bindArenaSelection();
  if(!window.sb)return;
  document.getElementById('createRoomBtn')?.addEventListener('click',createRoom);
  document.getElementById('joinRoomBtn')?.addEventListener('click',()=>joinRoom(document.getElementById('joinRoomCode')?.value.trim().toUpperCase()));
  document.getElementById('leaveRoomBtn')?.addEventListener('click',leaveRoom);
  document.getElementById('copyRoomBtn')?.addEventListener('click',async()=>{if(KG_MP.room){try{await navigator.clipboard.writeText(KG_MP.room.code);showToast('کد اتاق کپی شد')}catch{showToast(KG_MP.room.code)}}});
  document.getElementById('onlinePlayers')?.addEventListener('click',handleOnlineClick);
  if(window.state?.user)await startPresence();
}
async function startPresence(){
  if(!window.sb||!window.state?.user||KG_MP.channel)return;
  KG_MP.channel=sb.channel('kolegame-presence',{config:{presence:{key:state.user.id}}});
  KG_MP.channel.on('presence',{event:'sync'},renderPresence).on('broadcast',{event:'invite'},e=>handleInvite(e.payload));
  KG_MP.channel.subscribe(async status=>{if(status==='SUBSCRIBED')await KG_MP.channel.track({user_id:state.user.id,username:state.profile?.username||'Player',level:Number(state.profile?.level||1),online_at:new Date().toISOString()})});
}
async function stopPresence(){if(KG_MP.channel){try{await KG_MP.channel.untrack();await sb.removeChannel(KG_MP.channel)}catch{}KG_MP.channel=null;KG_MP.presence.clear()}}
function renderPresence(){
  const ps=KG_MP.channel?.presenceState?.()||{};KG_MP.presence.clear();Object.values(ps).flat().forEach(p=>{if(p.user_id)KG_MP.presence.set(p.user_id,p)});
  const count=document.getElementById('onlineCount');if(count)count.textContent=String(KG_MP.presence.size);
  const box=document.getElementById('onlinePlayers');if(!box)return;
  const arr=[...KG_MP.presence.values()].filter(p=>p.user_id!==state.user?.id);
  box.innerHTML=arr.length?arr.map(p=>`<div class="online-player"><div class="avatar-mini">${safeText((p.username||'P').slice(0,1).toUpperCase())}</div><div class="online-meta"><strong>${safeText(p.username||'Player')}</strong><span><i></i> آنلاین · Level ${p.level||1}</span></div><button class="btn btn-secondary btn-sm" data-invite-user="${safeText(p.user_id)}" data-invite-name="${safeText(p.username||'Player')}">دعوت</button></div>`).join(''):'<div class="empty-state">فعلاً بازیکن دیگری آنلاین نیست. دوستات رو دعوت کن 🎮</div>';
}
function handleOnlineClick(e){const b=e.target.closest('[data-invite-user]');if(!b)return;if(!KG_MP.room){showToast('اول اتاق بساز');return}KG_MP.channel?.send({type:'broadcast',event:'invite',payload:{to:b.dataset.inviteUser,from:state.user.id,fromName:state.profile?.username||'Player',code:KG_MP.room.code,game:KG_MP.room.game}});showToast('دعوت ارسال شد')}
function handleInvite(p){if(p.to!==state.user?.id)return;const ok=confirm(`${p.fromName} دعوتت کرده به ${roomGameLabel(p.game)}\nکد: ${p.code}`);if(ok){goToPage('arena');document.getElementById('joinRoomCode').value=p.code;joinRoom(p.code)}}

async function createRoom(){
  if(!kgNeedLogin())return;
  if(!window.sb){showToast('اتصال دیتابیس آماده نیست');return}
  if(KG_MP.room)await leaveRoom();
  const code=kgCode();
  const {data,error}=await sb.rpc('kg_create_room',{p_code:code,p_game:KG_MP.selectedGame});
  if(error){console.error(error);showToast('ساخت اتاق انجام نشد؛ SQL آرنا را اجرا کن');return}
  const room=data?.[0]||data;
  KG_MP.room={code:room.code,game:room.game,host:room.host_id,players:[state.user.id]};
  KG_MP.roomState=null;
  await openRoomChannel();
  showRoom();
  showToast(`اتاق ${room.code} ساخته شد`);
}
async function joinRoom(code){
  if(!kgNeedLogin())return;
  code=(code||'').trim().toUpperCase();
  if(!/^[A-Z0-9]{6}$/.test(code)){showToast('کد اتاق باید ۶ کاراکتر باشد');return}
  if(!window.sb){showToast('اتصال دیتابیس آماده نیست');return}
  if(KG_MP.room)await leaveRoom();
  const {data,error}=await sb.rpc('kg_join_room',{p_code:code});
  if(error){console.error(error);showToast(error.message?.includes('not found')?'اتاق پیدا نشد یا بسته شده':'ورود به اتاق انجام نشد');return}
  const room=data?.[0]||data;
  KG_MP.room={code:room.code,game:room.game,host:room.host_id,players:[room.host_id,room.guest_id].filter(Boolean)};
  KG_MP.roomState=null;
  await openRoomChannel();
  showRoom();
  document.getElementById('roomStatus').textContent=KG_MP.room.players.length>=2?'۲ بازیکن وصل شدند — آماده‌ی نبرد!':'منتظر بازیکن دوم...';
  if(KG_MP.room.players.length>=2&&KG_MP.room.host===state.user.id)startRoomGame();
  renderMultiplayerGame();
}
async function openRoomChannel(){
  const ch=sb.channel('kg-room-'+KG_MP.room.code,{config:{presence:{key:state.user.id}}});KG_MP.roomChannel=ch;
  ch.on('presence',{event:'sync'},updateRoomPlayers)
   .on('broadcast',{event:'hello'},()=>{if(KG_MP.room.host===state.user.id)ch.send({type:'broadcast',event:'room-info',payload:{host:state.user.id,game:KG_MP.room.game}})})
   .on('broadcast',{event:'room-info'},e=>{if(!KG_MP.room.host){KG_MP.room.host=e.payload.host;KG_MP.room.game=e.payload.game;showRoom();renderMultiplayerGame()}})
   .on('broadcast',{event:'game'},e=>applyGameMessage(e.payload));
  await ch.subscribe(async status=>{if(status==='SUBSCRIBED'){await ch.track({user_id:state.user.id,username:state.profile?.username||'Player',level:Number(state.profile?.level||1)});if(KG_MP.room.host===state.user.id)renderMultiplayerGame()}})
}
function updateRoomPlayers(){
  if(!KG_MP.room)return;const ps=KG_MP.roomChannel?.presenceState?.()||{};const arr=Object.values(ps).flat().filter(p=>p.user_id);KG_MP.room.players=[...new Set(arr.map(p=>p.user_id))].slice(0,2);
  const status=document.getElementById('roomStatus');if(status)status.textContent=KG_MP.room.players.length>=2?'۲ بازیکن وصل شدند — آماده‌ی نبرد!':'منتظر بازیکن دوم...';
  if(KG_MP.room.players.length>=2&&KG_MP.room.host===state.user.id&&!KG_MP.roomState)startRoomGame();renderMultiplayerGame();
}
function showRoom(){const p=document.getElementById('roomPanel');if(!p||!KG_MP.room)return;p.hidden=false;document.getElementById('roomCodeValue').textContent=KG_MP.room.code;document.getElementById('roomTitle').textContent=roomGameLabel(KG_MP.room.game||'rps')}
async function leaveRoom(){const oldRoom=KG_MP.room;if(KG_MP.roomChannel){try{await KG_MP.roomChannel.untrack();await sb.removeChannel(KG_MP.roomChannel)}catch{}}if(oldRoom&&window.sb&&state?.user){try{await sb.rpc('kg_leave_room',{p_code:oldRoom.code})}catch(e){console.warn('leave room cleanup',e)}}KG_MP.roomChannel=null;KG_MP.room=null;KG_MP.roomState=null;document.getElementById('roomPanel')?.setAttribute('hidden','');}
function sendGame(payload){if(KG_MP.roomChannel)KG_MP.roomChannel.send({type:'broadcast',event:'game',payload:{...payload,from:state.user.id}})}
function playerIds(){return KG_MP.room?.players||[]}
function startRoomGame(){
  const g=KG_MP.room.game;let s;
  if(g==='rps')s={phase:'play',choices:{},round:1};
  if(g==='tictactoe')s={board:Array(9).fill(''),turn:playerIds()[0],winner:null};
  if(g==='reaction')s={phase:'waiting',goAt:0,times:{}};
  if(g==='quiz')s={phase:'question',q:0,answers:{},scores:{}};
  if(g==='connect4')s={board:Array(42).fill(''),turn:playerIds()[0],winner:null};
  if(g==='highlow')s={phase:'guess',number:Math.floor(Math.random()*91)+10,guesses:{},winner:null};
  if(g==='mathduel')s=makeMathState(1);
  if(g==='color')s=makeColorState(1);
  KG_MP.roomState=s;sendGame({action:'state',state:s});renderMultiplayerGame();
}
function makeMathState(round){const a=Math.floor(Math.random()*20)+3,b=Math.floor(Math.random()*15)+2,op=round%3===0?'−':round%2===0?'×':'+';const answer=op==='−'?a-b:op==='×'?a*b:a+b;return {phase:'play',round,a,b,op,answer,winner:null,answers:{}}}
function makeColorState(round){const colors=[['قرمز','#ff5e78'],['آبی','#55d6ff'],['سبز','#6ef3c5'],['بنفش','#a78bff'],['زرد','#ffd76a']];const target=Math.floor(Math.random()*colors.length);return {phase:'play',round,target,colors,winner:null,answers:{}}}
const KG_QUIZ=[['کدام سیاره به سیاره سرخ معروف است؟',['مریخ','زهره','مشتری','عطارد'],0],['پایتخت ژاپن کدام است؟',['توکیو','سئول','پکن','بانکوک'],0],['CSS بیشتر برای چه کاری است؟',['استایل‌دهی','دیتابیس','امنیت سرور','ارسال ایمیل'],0],['۵×۸ چند است؟',['۳۰','۴۰','۴۵','۵۰'],1],['کدام زبان در مرورگر اجرا می‌شود؟',['JavaScript','SQL','Python فقط','C# فقط'],0],['RGB چند کانال رنگ اصلی دارد؟',['۲','۳','۴','۵'],1]];
function applyGameMessage(p){
  if(p.action==='state'){KG_MP.roomState=p.state;renderMultiplayerGame();return}
  const s=KG_MP.roomState;if(!s)return;
  if(p.action==='rps-choice'){s.choices[p.user]=p.choice;if(Object.keys(s.choices).length>=2)resolveRps();renderMultiplayerGame()}
  if(p.action==='ttt-move'){if(s.winner||s.turn!==p.user||s.board[p.i])return;s.board[p.i]=p.mark;s.winner=winnerTTT(s.board);s.turn=s.winner?null:(s.turn===playerIds()[0]?playerIds()[1]:playerIds()[0]);sendGame({action:'state',state:s});renderMultiplayerGame()}
  if(p.action==='reaction-go'){s.phase='go';s.goAt=Date.now();renderMultiplayerGame()}
  if(p.action==='reaction-time'){if(s.times[p.user]!==undefined)return;s.times[p.user]=p.ms;if(Object.keys(s.times).length>=2){const w=Object.entries(s.times).sort((a,b)=>a[1]-b[1])[0][0];s.phase='result';s.winner=w;sendGame({action:'state',state:s})}renderMultiplayerGame()}
  if(p.action==='quiz-answer'){s.answers[p.user]=p.answer;if(Object.keys(s.answers).length>=2)resolveQuiz();renderMultiplayerGame()}
  if(p.action==='connect4-move'){if(s.winner||s.turn!==p.user)return;const row=drop4(s.board,p.col,p.mark);if(row<0)return;s.winner=winner4(s.board,p.mark);s.turn=s.winner?null:(s.turn===playerIds()[0]?playerIds()[1]:playerIds()[0]);sendGame({action:'state',state:s});renderMultiplayerGame()}
  if(p.action==='highlow-guess'){if(s.winner)return;s.guesses[p.user]=p.dir;const ids=Object.keys(s.guesses);if(ids.length>=2){const sorted=ids.map(id=>[id,s.guesses[id]===(s.number>=50?'high':'low')]);const w=sorted.find(x=>x[1])?.[0]||null;s.winner=w;s.phase='result';sendGame({action:'state',state:s})}renderMultiplayerGame()}
  if(p.action==='math-answer'){if(s.winner||s.answers[p.user]!==undefined)return;s.answers[p.user]=p.answer;if(Number(p.answer)===s.answer){s.winner=p.user;s.phase='result';sendGame({action:'state',state:s})}renderMultiplayerGame()}
  if(p.action==='color-answer'){if(s.winner||s.answers[p.user]!==undefined)return;s.answers[p.user]=p.index;if(p.index===s.target){s.winner=p.user;s.phase='result';sendGame({action:'state',state:s})}renderMultiplayerGame()}
}
function resolveRps(){const c=KG_MP.roomState.choices,ids=Object.keys(c);if(ids.length<2)return;const [a,b]=ids;const win=c[a]===c[b]?null:((c[a]==='rock'&&c[b]==='scissors')||(c[a]==='paper'&&c[b]==='rock')||(c[a]==='scissors'&&c[b]==='paper')?a:b);KG_MP.roomState.result={winner:win,choices:c};KG_MP.roomState.phase='result';sendGame({action:'state',state:KG_MP.roomState})}
function winnerTTT(b){const l=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(const [a,c,d] of l)if(b[a]&&b[a]===b[c]&&b[a]===b[d])return b[a];return b.every(Boolean)?'draw':null}
function drop4(b,col,mark){for(let r=5;r>=0;r--){const i=r*7+col;if(!b[i]){b[i]=mark;return i}}return -1}
function winner4(b,m){for(let r=0;r<6;r++)for(let c=0;c<7;c++){const i=r*7+c;if(b[i]!==m)continue;if(c<4&&[1,2,3].every(k=>b[i+k]===m))return m;if(r<3&&[1,2,3].every(k=>b[i+k*7]===m))return m;if(r<3&&c<4&&[1,2,3].every(k=>b[i+k*8]===m))return m;if(r<3&&c>=3&&[1,2,3].every(k=>b[i+k*6]===m))return m}return b.every(Boolean)?'draw':null}
function resolveQuiz(){const s=KG_MP.roomState,q=KG_QUIZ[s.q%KG_QUIZ.length];Object.entries(s.answers).forEach(([id,a])=>{if(a===q[2])s.scores[id]=(s.scores[id]||0)+1});const ids=Object.keys(s.scores);if(s.q>=3){s.phase='result';s.winner=ids.sort((a,b)=>s.scores[b]-s.scores[a])[0]||null;sendGame({action:'state',state:s});return}s.q++;s.answers={};sendGame({action:'state',state:s})}
function renderMultiplayerGame(){
  const el=document.getElementById('multiplayerGame');if(!el||!KG_MP.room)return;const s=KG_MP.roomState,g=KG_MP.room.game;document.getElementById('roomTitle').textContent=roomGameLabel(g||'rps');
  if(KG_MP.room.players.length<2){el.innerHTML='<div class="waiting-room"><div class="pulse-ring"></div><h3>منتظر بازیکن دوم...</h3><p>کد اتاق را برای دوستت بفرست.</p></div>';return}
  if(!s){el.innerHTML='<div class="waiting-room"><h3>آماده‌سازی بازی...</h3></div>';return}
  const fn={rps:renderRps,tictactoe:renderTTT,reaction:renderReaction,quiz:renderQuiz,connect4:renderConnect4,highlow:renderHighLow,mathduel:renderMathDuel,color:renderColor};fn[g]?.(el,s)
}
function shell(title,body,sub='رقابت آنلاین'){return `<div class="mp-shell"><div class="mp-head"><span>${sub}</span><strong>${title}</strong></div>${body}</div>`}
function resultText(w){return w===state.user.id?'🏆 بردی!':w?'حریفت برد!':'🤝 مساوی شد!'}
function renderRps(el,s){const my=s.choices?.[state.user.id];const result=s.result;el.innerHTML=shell('سنگ کاغذ قیچی',`<div class="choice-grid">${[['rock','✊','سنگ'],['paper','✋','کاغذ'],['scissors','✌️','قیچی']].map(([k,i,n])=>`<button class="choice-btn ${my===k?'picked':''}" data-rps="${k}" ${my||result?'disabled':''}><span>${i}</span><b>${n}</b></button>`).join('')}</div>${result?`<div class="result-box">${resultText(result.winner)}<br><small>${result.choices[state.user.id]} مقابل حریف</small></div>`:'<p class="mp-note">انتخابت تا پایان راند برای حریف مخفیه.</p>'}`);el.querySelectorAll('[data-rps]').forEach(b=>b.onclick=()=>sendGame({action:'rps-choice',user:state.user.id,choice:b.dataset.rps}))}
function renderTTT(el,s){const mark=state.user.id===playerIds()[0]?'X':'O';el.innerHTML=shell('دوز',`<div class="mp-head"><span>تو: ${mark}</span><strong>${s.winner?(s.winner==='draw'?'مساوی':`برنده: ${s.winner===mark?'تو':'حریف'}`):s.turn===state.user.id?'نوبت تو':'نوبت حریف'}</strong></div><div class="ttt-board">${s.board.map((v,i)=>`<button data-ttt="${i}" ${v||s.winner||s.turn!==state.user.id?'disabled':''}>${v}</button>`).join('')}</div>`);el.querySelectorAll('[data-ttt]').forEach(b=>b.onclick=()=>{const n={...s,board:[...s.board]};n.board[+b.dataset.ttt]=mark;n.winner=winnerTTT(n.board);n.turn=n.winner?null:(s.turn===playerIds()[0]?playerIds()[1]:playerIds()[0]);sendGame({action:'state',state:n})})}
function renderReaction(el,s){el.innerHTML=shell('Reaction Duel',s.phase==='waiting'?'<div class="reaction-stage"><h3>آماده‌ای؟</h3><p class="mp-note">وقتی دکمه سبز شد، سریع بزن.</p><button class="reaction-hit" id="reactionStart">شروع راند</button></div>':s.phase==='go'?'<div class="reaction-stage go"><h3>الان! ⚡</h3><button class="reaction-hit" id="reactionHit">بزن!</button></div>':`<div class="result-box">${resultText(s.winner)}<br><small>زمان تو: ${s.times?.[state.user.id]??'—'}ms</small></div>`);if(s.phase==='waiting'&&KG_MP.room.host===state.user.id)el.querySelector('#reactionStart').onclick=()=>setTimeout(()=>sendGame({action:'reaction-go'}),800+Math.random()*2200);if(s.phase==='go')el.querySelector('#reactionHit').onclick=()=>sendGame({action:'reaction-time',user:state.user.id,ms:Date.now()-s.goAt})}
function renderQuiz(el,s){const q=KG_QUIZ[s.q%KG_QUIZ.length],answered=s.answers?.[state.user.id]!==undefined;el.innerHTML=shell(`Quiz Duel · ${s.q+1}/4`,`<h3>${q[0]}</h3><div class="quiz-choices">${q[1].map((x,i)=>`<button data-qa="${i}" ${answered||s.phase==='result'?'disabled':''}>${x}</button>`).join('')}</div><div class="arena-stats"><div class="arena-stat"><strong>${s.scores?.[state.user.id]||0}</strong><small>امتیاز تو</small></div><div class="arena-stat"><strong>${Object.values(s.scores||{})[0]||0}</strong><small>امتیاز حریف</small></div></div>${s.phase==='result'?`<div class="result-box">${resultText(s.winner)}</div>`:''}`);el.querySelectorAll('[data-qa]').forEach(b=>b.onclick=()=>sendGame({action:'quiz-answer',user:state.user.id,answer:+b.dataset.qa}))}
function renderConnect4(el,s){const mark=state.user.id===playerIds()[0]?'red':'yellow';el.innerHTML=shell('چهار در خط',`<div class="mp-head"><span>مهره تو: ${mark==='red'?'🔴':'🟡'}</span><strong>${s.winner?(s.winner==='draw'?'مساوی':s.winner===mark?'بردی':'حریفت برد'):s.turn===state.user.id?'نوبت تو':'نوبت حریف'}</strong></div><div class="connect4-board">${s.board.map((v,i)=>`<button class="connect4-cell ${v}" data-c4="${i%7}" ${v||s.winner||s.turn!==state.user.id?'disabled':''}></button>`).join('')}</div>`);el.querySelectorAll('[data-c4]').forEach(b=>b.onclick=()=>sendGame({action:'connect4-move',user:state.user.id,col:+b.dataset.c4,mark}))}
function renderHighLow(el,s){const guessed=s.guesses?.[state.user.id]!==undefined;el.innerHTML=shell('High / Low',`<div class="number-duel"><p>عدد مخفی بین ۱۰ تا ۱۰۰ است.</p><div class="number-big">?</div><div class="choice-grid"><button class="choice-btn" data-hl="high" ${guessed||s.winner?'disabled':''}><span>⬆️</span><b>High</b></button><button class="choice-btn" data-hl="low" ${guessed||s.winner?'disabled':''}><span>⬇️</span><b>Low</b></button></div>${s.phase==='result'?`<div class="result-box">عدد ${s.number} بود — ${resultText(s.winner)}</div>`:'<p class="mp-note">اولین حدس درست برنده است.</p>'}</div>`);el.querySelectorAll('[data-hl]').forEach(b=>b.onclick=()=>sendGame({action:'highlow-guess',user:state.user.id,dir:b.dataset.hl}))}
function renderMathDuel(el,s){const answered=s.answers?.[state.user.id]!==undefined;el.innerHTML=shell('Math Duel',`<div class="math-card"><small>Round ${s.round}</small><div class="math-equation">${s.a} ${s.op} ${s.b} = ?</div><div class="math-answers"><input id="mathAnswer" type="number" placeholder="جوابت" ${answered||s.winner?'disabled':''}><button class="btn btn-primary" id="mathSend" ${answered||s.winner?'disabled':''}>ارسال</button></div>${s.winner?`<div class="result-box">${resultText(s.winner)}</div>`:'<p class="mp-note">اولین جواب صحیح برنده راند است.</p>'}</div>`);el.querySelector('#mathSend')?.addEventListener('click',()=>sendGame({action:'math-answer',user:state.user.id,answer:Number(el.querySelector('#mathAnswer').value)}))}
function renderColor(el,s){const answered=s.answers?.[state.user.id]!==undefined;el.innerHTML=shell('Color Clash',`<div class="number-duel"><h3>رنگ <b>${s.colors[s.target][0]}</b> را پیدا کن!</h3><div class="choice-grid">${s.colors.map((c,i)=>`<button class="color-target" style="background:${c[1]}" data-color="${i}" ${answered||s.winner?'disabled':''}>${c[0]}</button>`).join('')}</div>${s.winner?`<div class="result-box">${resultText(s.winner)}</div>`:'<p class="mp-note">فقط رنگ درست برنده می‌شود.</p>'}</div>`);el.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>sendGame({action:'color-answer',user:state.user.id,index:+b.dataset.color}))}
document.addEventListener('DOMContentLoaded',()=>setTimeout(initMultiplayer,80));

/* KoleGame quests + achievements — persistent per player in localStorage, no DB mutation */
const KG_QUESTS=[
 {id:'play3',title:'گرم کن',desc:'۳ بازی انجام بده',goal:3,reward:150},
 {id:'win5',title:'برنده شو',desc:'۵ بازی را ببر',goal:5,reward:350},
 {id:'daily',title:'بازیکن هرروزه',desc:'امروز وارد KoleGame شو',goal:1,reward:100},
 {id:'mp1',title:'رفیق‌باز',desc:'یک بازی آنلاین انجام بده',goal:1,reward:250}
];
const KG_ACH=[
 ['first_game','اولین قدم','اولین بازی خودت را کامل کن','🎮'],
 ['first_win','اولین برد','اولین پیروزی را ثبت کن','🏆'],
 ['social','دوست‌دار','اولین بازی آنلاین را انجام بده','🤝'],
 ['streak7','هفت روزه','استریک ۷ روزه بساز','🔥'],
 ['rich','کیسه پر','به ۱۰٬۰۰۰ KoleCoin برس','💰'],
 ['level10','نخبه','به Level 10 برس','👑']
];
function kgProgressKey(){return 'kg_progress_'+(state.user?.id||'guest');}
function kgGetProgress(){try{return JSON.parse(localStorage.getItem(kgProgressKey())||'{"stats":{"played":0,"wins":0,"mp":0},"quests":{},"ach":{}}')}catch(e){return {stats:{played:0,wins:0,mp:0},quests:{},ach:{}}}}
function kgSaveProgress(p){localStorage.setItem(kgProgressKey(),JSON.stringify(p));}
function kgRecord(type='play'){
 if(!state.user)return; const p=kgGetProgress();p.stats.played++;if(type==='win')p.stats.wins++;if(type==='mp')p.stats.mp++;
 p.ach.first_game=p.stats.played>=1;p.ach.first_win=p.stats.wins>=1;p.ach.social=p.stats.mp>=1;
 p.ach.rich=Number(state.profile?.coins||0)>=10000;p.ach.level10=Number(state.profile?.level||1)>=10;
 kgSaveProgress(p);renderQuests();
}
function kgRecordWin(mp=false){kgRecord(mp?'mp':'win');}
function renderQuests(){
 const qg=document.getElementById('questGrid'),ag=document.getElementById('achievementGrid');if(!qg||!ag)return;
 const p=kgGetProgress(),today=new Date().toDateString();
 p.quests.daily=p.quests.dailyDate===today?1:0;p.quests.dailyDate=today;kgSaveProgress(p);
 qg.innerHTML=KG_QUESTS.map(q=>{let v=q.id==='play3'?p.stats.played%3:q.id==='win5'?p.stats.wins%5:q.id==='mp1'?Math.min(1,p.stats.mp):p.quests.daily;let done=q.id==='play3'?p.stats.played>=3:q.id==='win5'?p.stats.wins>=5:q.id==='mp1'?p.stats.mp>=1:p.quests.daily===1;return `<div class="quest-card ${done?'done':''}"><div class="quest-icon">${done?'✓':'✦'}</div><div><h3>${q.title}</h3><p>${q.desc}</p><div class="quest-progress"><span style="width:${done?100:Math.min(100,v/q.goal*100)}%"></span></div><small>${done?'تکمیل شد':'پاداش '+q.reward+' KC'}</small></div></div>`}).join('');
 const all=KG_ACH.map(([id,title,desc,icon])=>({id,title,desc,icon,done:!!p.ach[id]}));
 ag.innerHTML=all.map(a=>`<div class="achievement ${a.done?'unlocked':''}"><div class="ach-icon">${a.icon}</div><div><strong>${a.title}</strong><p>${a.desc}</p><small>${a.done?'باز شده':'قفل'}</small></div></div>`).join('');
 const xp=Number(state.profile?.xp||0),lv=Number(state.profile?.level||1),cur=(typeof xpForLevel==='function'?xpForLevel(lv):0),next=(typeof xpForLevel==='function'?xpForLevel(lv+1):cur+250),pct=Math.max(0,Math.min(100,(xp-cur)/Math.max(1,next-cur)*100));
 document.getElementById('questLevel').textContent=lv;document.getElementById('questXpText').textContent=`${formatKole(xp)} / ${formatKole(next)} XP`;document.getElementById('questXpFill').style.width=pct+'%';document.getElementById('questProgressPct').textContent=Math.round(pct)+'%';
}
document.addEventListener('DOMContentLoaded',()=>setTimeout(renderQuests,400));

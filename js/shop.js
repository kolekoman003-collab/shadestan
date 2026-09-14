// ===== Shop + Pets =====
const UPGRADE_META = {
  reward:{icon:kgIcon('coin'),name:'موتور درآمد',desc:'پاداش بازی‌ها +۵٪ در هر لول'},
  xp:{icon:kgIcon('bolt'),name:'هسته XP',desc:'XP بازی‌ها +۸٪ در هر لول'},
  luck:{icon:kgIcon('bolt'),name:'طلسم شانس',desc:'شانس بهتر برای جایزه‌های تصادفی'},
  bank:{icon:kgIcon('shield'),name:'محافظ بانک',desc:'سود بانک +۱٪ در هر لول'},
  petcare:{icon:kgIcon('pet'),name:'Pet Care',desc:'درآمد همه پت‌ها +۱۰٪ در هر لول'},
  combo:{icon:kgIcon('game'),name:'دستکش کمبو',desc:'بازی‌های سریع +۳٪ در هر لول'}
};
const PET_META = {
  chick:['🐣','جوجه طلایی','معمولی'], bunny:['🐰','خرگوش زمردی','معمولی'],
  cat:['🐱','گربه پول‌ساز','غیرمعمول'], panda:['🐼','پاندای ثروتمند','غیرمعمول'],
  owl:['🦉','جغد دانا','غیرمعمول'], fox:['🦊','روباه نقره‌ای','کمیاب'],
  penguin:['🐧','پنگوئن سرمایه‌دار','کمیاب'], shark:['🦈','کوسه طلایی','کمیاب'],
  tiger:['🐯','ببر سلطنتی','کمیاب'], dragon:['🐲','اژدهای زمردی','حماسی'],
  unicorn:['🦄','تک‌شاخ کیهانی','حماسی'], griffin:['🦅','گریفین باستانی','حماسی'],
  wolf:['🐺','گرگ سایه‌ای','حماسی'], phoenix:['🔥','ققنوس سلطنتی','افسانه‌ای'],
  robot:['🤖','ربات خزانه‌دار','افسانه‌ای'], 'mecha-dragon':['🐉','اژدهای مکا','افسانه‌ای'],
  kraken:['🦑','کراکن طلایی','اسطوره‌ای'], celestial:['🦁','شیر آسمانی','اسطوره‌ای'],
  cosmic:['🌌','پت کیهانی','اسطوره‌ای'], void:['👾','نگهبان خلأ','اسطوره‌ای'],
  slime:['🟢','اسلایم زمردی','معمولی'], hamster:['🐹','همستر گنج‌یاب','معمولی'],
  raccoon:['🦝','راکون دزد سکه','غیرمعمول'], turtle:['🐢','لاک‌پشت لاجوردی','غیرمعمول'],
  bee:['🐝','زنبور طلایی','کمیاب'], parrot:['🦜','طوطی جواهرنشان','کمیاب'],
  manta:['🌊','پرتوی آبی','حماسی'], dragonfire:['🔥','اژدهای آتشین','افسانه‌ای'],
  starwhale:['🌠','نهنگ ستاره‌ای','اسطوره‌ای']
};
function petSvg(key){
  const shapes={
    chick:'<circle cx="12" cy="13" r="7"/><circle cx="9" cy="11" r="1"/><path d="M12 4l2 3-2 1-2-1z"/>',
    bunny:'<path d="M8 8C5 3 8 1 10 7c1-5 5-5 4 1 4 0 6 3 4 7a6 6 0 1 1-12 0c0-3 1-5 2-7Z"/>',
    cat:'<path d="M5 10 5 4l4 3a8 8 0 0 1 6 0l4-3v6a7 7 0 1 1-14 0Z"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/>',
    panda:'<circle cx="12" cy="12" r="8"/><circle cx="9" cy="10" r="2"/><circle cx="15" cy="10" r="2"/><path d="M10 15h4"/>',
    owl:'<path d="M5 20V9a7 7 0 0 1 14 0v11"/><circle cx="9" cy="10" r="2"/><circle cx="15" cy="10" r="2"/><path d="m12 12 2 2-2 2-2-2z"/>',
    fox:'<path d="M4 7 7 3l5 3 5-3 3 4v7a8 8 0 0 1-16 0Z"/><path d="M9 15h6"/>',
    penguin:'<ellipse cx="12" cy="13" rx="7" ry="9"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><path d="M10 13h4"/>',
    shark:'<path d="M3 14c5-8 12-8 18-3-5 1-9 4-12 7l-2-3-4 1Z"/><circle cx="16" cy="11" r="1"/>',
    tiger:'<path d="M5 9 6 4l4 3a7 7 0 0 1 4 0l4-3 1 5v6a7 7 0 0 1-14 0Z"/><path d="M9 11h.01M15 11h.01M10 15h4"/>',
    dragon:'<path d="M5 16c-2-7 3-12 8-10l5-3-1 5c4 4 1 10-5 10-3 0-5-1-7-2Z"/><path d="M9 7 7 3l4 2 3-3 1 5"/>',
    unicorn:'<path d="M5 16c-1-7 3-12 9-10l4-3-1 5c3 5 0 9-5 10-3 0-5-1-7-2Z"/><path d="m12 6 2-5 2 5"/>',
    griffin:'<path d="M4 17c1-9 6-13 13-11l3-3-1 6c2 5-1 9-6 10-4 1-7-1-9-2Z"/><path d="M7 8 3 5l5 1M17 9l4-3-5 1"/>',
    wolf:'<path d="M5 8 5 3l4 3a8 8 0 0 1 6 0l4-3-1 6v6a6 6 0 0 1-12 0Z"/><path d="M9 12h.01M15 12h.01M10 16h4"/>',
    phoenix:'<path d="M12 3c5 3 7 7 4 12-1 2-3 4-4 6-1-2-3-4-4-6C5 10 7 6 12 3Z"/><path d="M7 8 3 6l4 5M17 8l4-2-4 5"/>',
    robot:'<rect x="5" y="7" width="14" height="13" rx="3"/><path d="M12 7V3M9 12h.01M15 12h.01M9 16h6"/>',
    'mecha-dragon':'<path d="M4 17 6 7l5 2 5-5 4 5-3 9-5-2-5 2Z"/><path d="M9 12h6M12 9v6"/>',
    kraken:'<circle cx="12" cy="9" r="5"/><path d="M7 12c-5 1-4 7 1 5M9 13c-4 4-1 7 3 4M15 13c4 4 7 1 3-2M17 12c5 1 4 7-1 5"/>',
    celestial:'<path d="M12 4c6 0 9 4 8 9-1 5-5 7-8 7s-7-2-8-7c-1-5 2-9 8-9Z"/><path d="M8 11h2M14 11h2M9 16h6"/>',
    cosmic:'<circle cx="12" cy="12" r="8"/><path d="m12 5 2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>',
    void:'<circle cx="12" cy="12" r="8"/><path d="M8 9h2M14 9h2M9 15c2 2 4 2 6 0M4 5 2 3M20 5l2-2"/>',
    slime:'<path d="M5 18c0-7 2-12 7-12s7 5 7 12c-4 2-10 2-14 0Z"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/>',
    hamster:'<circle cx="12" cy="13" r="7"/><circle cx="7" cy="8" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>',
    raccoon:'<path d="M5 8 8 4l4 2 4-2 3 4v7a7 7 0 0 1-14 0Z"/><path d="M6 11h12M9 12h.01M15 12h.01"/>',
    turtle:'<ellipse cx="12" cy="13" rx="8" ry="6"/><circle cx="19" cy="12" r="2"/><path d="M6 17 4 20M18 17l2 3M8 8 6 5M16 8l2-3"/>',
    bee:'<ellipse cx="12" cy="13" rx="6" ry="7"/><path d="M7 10h10M6 14h12M9 6 7 3M15 6l2-3"/>',
    parrot:'<path d="M8 20c-2-6 0-13 6-15 5 0 6 5 2 8l-3 2 3 5Z"/><path d="m16 7 5 1-4 3"/>',
    manta:'<path d="M3 10c4 0 6 3 9 3s5-3 9-3l-3 5c-2 3-4 4-6 4s-4-1-6-4Z"/>',
    dragonfire:'<path d="M5 17c-2-6 2-11 7-10l4-4v6c4 4 2 9-4 11-3 0-5-1-7-3Z"/><path d="M12 13c-2-2 0-4 1-6 2 3 3 5 1 7"/>',
    starwhale:'<path d="M3 14c3-6 11-8 18-2-3 1-5 3-7 6-3 2-8 1-11-4Z"/><path d="M19 11 22 8M8 10l-2-3"/>'
  };
  return `<svg class="pet-svg" viewBox="0 0 24 24" aria-hidden="true">${shapes[key]||shapes.cosmic}</svg>`;
}

let shopCatalog=[], petCatalog=[], shopState={upgrades:[],pets:[],level:1};

const LOCAL_PET_CATALOG = [
  ['chick','جوجه طلایی','معمولی',1000,3,1],['bunny','خرگوش زمردی','معمولی',1800,5,1],
  ['slime','اسلایم زمردی','معمولی',2600,7,2],['hamster','همستر گنج‌یاب','معمولی',3500,9,2],
  ['cat','گربه پول‌ساز','غیرمعمول',4500,8,3],['panda','پاندای ثروتمند','غیرمعمول',7000,13,4],
  ['raccoon','راکون دزد سکه','غیرمعمول',10000,17,5],['owl','جغد دانا','غیرمعمول',18000,28,6],
  ['fox','روباه نقره‌ای','کمیاب',12000,18,5],['penguin','پنگوئن سرمایه‌دار','کمیاب',30000,42,8],
  ['bee','زنبور طلایی','کمیاب',40000,55,9],['shark','کوسه طلایی','کمیاب',50000,65,10],
  ['parrot','طوطی جواهرنشان','کمیاب',75000,90,12],['tiger','ببر سلطنتی','کمیاب',140000,170,15],
  ['dragon','اژدهای زمردی','حماسی',85000,110,12],['manta','پرتوی آبی','حماسی',180000,230,17],
  ['unicorn','تک‌شاخ کیهانی','حماسی',220000,280,18],['griffin','گریفین باستانی','حماسی',380000,470,22],
  ['wolf','گرگ سایه‌ای','حماسی',900000,1050,30],['phoenix','ققنوس سلطنتی','افسانه‌ای',600000,720,25],
  ['dragonfire','اژدهای آتشین','افسانه‌ای',1200000,1450,33],['robot','ربات خزانه‌دار','افسانه‌ای',1500000,1800,35],
  ['mecha-dragon','اژدهای مکا','افسانه‌ای',2800000,3300,42],['kraken','کراکن طلایی','اسطوره‌ای',4000000,4800,50],
  ['celestial','شیر آسمانی','اسطوره‌ای',8500000,9200,58],['cosmic','پت کیهانی','اسطوره‌ای',12000000,15000,70],
  ['starwhale','نهنگ ستاره‌ای','اسطوره‌ای',20000000,23000,78],['void','نگهبان خلأ','اسطوره‌ای',30000000,30000,85]
].map(([key,name,rarity,base_cost,income,unlock_level])=>({key,name,icon:'pet',rarity,base_cost,income,unlock_level}));


function shopNum(n){return Number(n||0).toLocaleString('fa-IR')}
function shopUpgradeLevel(key){return Number(shopState.upgrades.find(x=>x.key===key)?.level||0)}
function shopPetLevel(key){return Number(shopState.pets.find(x=>x.key===key)?.level||0)}
function ownsPet(key){return shopState.pets.some(x=>x.key===key)}

async function loadShop(){
  if(!state.user) return;
  const [cats, pets, current] = await Promise.all([
    sb.rpc('kg_upgrade_catalog'), sb.rpc('kg_pet_catalog'), sb.rpc('get_kg_shop_state')
  ]);
  if(cats?.data) shopCatalog=cats.data;
  if(pets?.data?.length) petCatalog=pets.data;
  else if(!petCatalog.length) petCatalog=LOCAL_PET_CATALOG;
  if(current?.data) shopState=current.data;
  renderShop(); renderPetShop(); renderPets(); updateShopWallet(); updatePetPending();
  if(pets?.error) console.warn('kg_pet_catalog unavailable; using local display catalog:', pets.error.message);
}
function updateShopWallet(){
  const c=Number(state.profile?.coins||0);
  const el=document.getElementById('shopCoins'); if(el) el.textContent=shopNum(c);
  const p=document.getElementById('powerLevel');
  if(p) p.textContent=shopNum(Math.max(1,...shopState.upgrades.map(x=>Number(x.level||0)),1));
}
function upgradeCost(item, level){
  return Math.max(1,Math.round(Number(item.base_cost)*Math.pow(1.72,level)));
}
function renderShop(){
  const grid=document.getElementById('upgradeGrid'); if(!grid) return;
  grid.innerHTML=shopCatalog.map(item=>{
    const key=item.key, lvl=shopUpgradeLevel(key), max=Number(item.max_level);
    const cost=upgradeCost(item,lvl), req=Math.max(1,Math.floor(lvl/3)+1);
    const meta=UPGRADE_META[key]||{icon:kgIcon('bolt'),name:key,desc:item.description};
    const locked=Number(shopState.level||1)<req || lvl>=max;
    const dots=Array.from({length:Math.min(10,max)},(_,i)=>`<i class="${i<lvl?'on':''}"></i>`).join('');
    return `<article class="upgrade-card">
      <div class="upgrade-icon">${meta.icon}</div><h3>${meta.name}</h3><p>${meta.desc}</p>
      <div class="level-row"><span>لول ${lvl}/${max}</span><span>نیاز به لول ${req}</span></div>
      <div class="level-dots">${dots}</div>
      <div class="price-row"><span class="price">${kgIcon('coin','coin-svg')} ${shopNum(cost)}</span>
      <button class="btn ${locked?'btn-outline':'btn-primary'}" data-buy-upgrade="${key}" ${locked?'disabled':''}>${lvl>=max?'MAX':Number(shopState.level||1)<req?'قفل':'ارتقا'}</button></div>
    </article>`;
  }).join('');
  grid.querySelectorAll('[data-buy-upgrade]').forEach(b=>b.addEventListener('click',()=>buyUpgrade(b.dataset.buyUpgrade,b)));
  const inv=document.getElementById('inventoryList');
  if(inv) inv.innerHTML=shopCatalog.filter(x=>shopUpgradeLevel(x.key)>0).map(x=>`<span class="inventory-item">${UPGRADE_META[x.key]?.icon||'✨'} ${UPGRADE_META[x.key]?.name||x.key} · Lv.${shopUpgradeLevel(x.key)}</span>`).join('') || '<span class="inventory-item">هنوز تجهیزاتی نخریدی؛ اولی رو باز کن ✨</span>';
}
async function buyUpgrade(key,btn){
  btn.disabled=true;
  const {data,error}=await sb.rpc('buy_kg_upgrade',{p_key:key});
  btn.disabled=false;
  if(error){showToast(error.message.includes('not enough')?'KoleCoin کافی نداری':error.message.includes('requires_level')?'لول حساب برای این ارتقا کمه':error.message.includes('maxed')?'این ارتقا به آخر رسیده':'خرید انجام نشد');return}
  await refreshProfile(); await loadShop(); showToast(`ارتقا انجام شد! لول ${data.level} 🚀`);
}

function petCost(item,lvl){return Math.max(1,Math.round(Number(item.base_cost)*Math.pow(2.25,lvl)))}
function petCard(item, {shop=false}={}){
  const owned=ownsPet(item.key), unlocked=Number(shopState.level||1)>=Number(item.unlock_level);
  const meta=PET_META[item.key]||[null,item.name,item.rarity];
  const price=Math.max(1,Number(item.base_cost));
  const locked=!unlocked;
  let action='خرید پت', disabled=false, cls='btn-primary';
  if(owned){ action='✓ خریداری شده'; disabled=true; cls='btn-outline'; }
  else if(locked){ action=`لول ${item.unlock_level}`; disabled=true; cls='btn-outline'; }
  const rarityClass=(item.rarity||'').replace(/[^آ-یa-z]/gi,'');
  return `<article class="pet-card pet-product ${locked&&!owned?'locked':''} ${owned?'owned':''}">
    <div class="pet-card-glow"></div>
    <span class="pet-rarity">${meta[2]||item.rarity}</span>
    <div class="pet-avatar">${petSvg(item.key)}</div>
    <div class="pet-product-title"><h3>${meta[1]||item.name}</h3><span class="pet-level-tag">Lv.${item.unlock_level}+</span></div>
    <p>${locked&&!owned?`در لول ${shopNum(item.unlock_level)} باز می‌شود.`:'یک پت دائمی؛ فقط یک‌بار می‌توانی آن را بخری.'}</p>
    <div class="pet-stats">
      <span>⏱ هر ۶۰ ثانیه</span><strong>${shopNum(item.income)} K</strong>
    </div>
    <div class="price-row"><span class="price">${kgIcon('coin','coin-svg')} ${shopNum(price)}</span>
    ${shop?`<button class="btn ${cls}" data-buy-pet="${item.key}" ${disabled?'disabled':''}>${action}</button>`:''}</div>
  </article>`;
}
function renderPetShop(){
  const grid=document.getElementById('petShopGrid'); if(!grid) return;
  grid.innerHTML=[...petCatalog].sort((a,b)=>Number(a.unlock_level)-Number(b.unlock_level)||Number(a.base_cost)-Number(b.base_cost)).map(item=>petCard(item,{shop:true})).join('');
  grid.querySelectorAll('[data-buy-pet]').forEach(b=>b.addEventListener('click',()=>buyPet(b.dataset.buyPet,b)));
}
function renderPets(){
  const grid=document.getElementById('petGrid'); if(!grid) return;
  const owned=petCatalog.filter(item=>ownsPet(item.key));
  let income=0;
  owned.forEach(item=>income+=Number(item.income));
  grid.innerHTML=owned.length ? owned.map(item=>petCard(item)).join('') : `<div class="empty-pets"><div class="pet-avatar">${petSvg('chick')}</div><h3>هنوز پتی نداری</h3><p>از «فروشگاه» اولین پتت رو بخر تا هر ۶۰ ثانیه KoleCoin بگیری.</p><button class="btn btn-primary" onclick="goToPage('shop')">رفتن به فروشگاه</button></div>`;
  const pi=document.getElementById('petIncome'); if(pi) pi.textContent=shopNum(income);
}
async function buyPet(key,btn){
  btn.disabled=true;
  const {data,error}=await sb.rpc('buy_kg_pet_once',{p_key:key});
  btn.disabled=false;
  if(error){
    const m=error.message||'';
    showToast(m.includes('already_owned')?'این پت را قبلاً خریدی':m.includes('not enough')?'KoleCoin کافی نداری':m.includes('requires_level')?'لول لازم برای این پت را نداری':'خرید پت انجام نشد');
    return;
  }
  await refreshProfile(); await loadShop();
  showToast('پت با موفقیت خریداری شد و هر ۶۰ ثانیه درآمد می‌دهد 🐾');
}
async function claimPetIncome(){
  const btn=document.getElementById('claimPetBtn'); if(!btn||!state.user)return;
  btn.disabled=true;
  const {data,error}=await sb.rpc('claim_kg_pet_income');
  btn.disabled=false;
  if(error){showToast('دریافت پاداش پت‌ها ناموفق بود');return}
  await refreshProfile(); updatePetPending(); showToast(data.payout>0?`${shopNum(data.payout)} KoleCoin از پت‌ها گرفتی 🐾`:'هنوز ۶۰ ثانیه کامل نشده ⏳');
}
function updatePetPending(){
  let pending=0, now=Date.now();
  shopState.pets.forEach(pp=>{
    const pet=petCatalog.find(x=>x.key===pp.key); if(!pet)return;
    const ticks=Math.floor(Math.max(0,now-Date.parse(pp.last_claim_at))/60000);
    const care=1+shopUpgradeLevel('petcare')*.10;
    pending += Math.floor(ticks*Number(pet.income)*care);
  });
  const el=document.getElementById('petPending'); if(el)el.textContent=`${shopNum(pending)} KoleCoin`;
}
function petTimerTick(){
  if(!document.getElementById('page-pets')?.classList.contains('active')) return;
  updatePetPending();
  const next=document.getElementById('petTimer'); if(!next)return;
  const waits=shopState.pets.map(p=>Math.max(0,60000-(Date.now()-Date.parse(p.last_claim_at)))).filter(Boolean);
  next.textContent=waits.length?`اولین پاداش تا ${Math.ceil(Math.min(...waits)/1000)} ثانیه دیگر`:'هر ۶۰ ثانیه قابل دریافت';
}
document.getElementById('claimPetBtn')?.addEventListener('click',claimPetIncome);
const oldGoToPage=window.goToPage;
window.goToPage=async function(pageId){
  oldGoToPage(pageId);
  if(pageId==='shop'||pageId==='pets') await loadShop();
};
setInterval(petTimerTick,1000);

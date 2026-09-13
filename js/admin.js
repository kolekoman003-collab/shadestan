// ===== Admin panel =====
let adminUsers = [];
function adminErr(e){
  if(e?.message?.includes('admin_only')) showToast('دسترسی ادمین نداری');
  else showToast('خطا در پنل مدیریت');
}
async function loadAdmin(){
  if(!state.user) return;
  const {data:isAdmin,error:checkErr}=await sb.rpc('kg_is_admin');
  const nav=document.getElementById('adminNav');
  if(checkErr || !isAdmin){ if(nav) nav.hidden=true; return; }
  if(nav) nav.hidden=false;
  const {data,error}=await sb.rpc('kg_admin_dashboard');
  if(error){adminErr(error);return;}
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=Number(v||0).toLocaleString('fa-IR')};
  set('adminUsersCount',data.users);set('adminCoinsTotal',data.coins);set('adminBankTotal',data.bank);set('adminPetsCount',data.pets);
  await loadAdminUsers();
}
async function loadAdminUsers(){
  const search=document.getElementById('adminSearch')?.value||'';
  const {data,error}=await sb.rpc('kg_admin_users',{p_search:search});
  if(error){adminErr(error);return;}
  adminUsers=data||[];
  const body=document.getElementById('adminUsersBody');if(!body)return;
  body.innerHTML=adminUsers.map(u=>`<tr>
    <td><span class="admin-user">${escapeHtml(u.username)}</span><small>${u.id.slice(0,8)}…</small></td>
    <td>Lv.${u.level||1}</td><td>${Number(u.xp||0).toLocaleString('fa-IR')}</td><td>${Number(u.coins||0).toLocaleString('fa-IR')}</td><td>${Number(u.bank_balance||0).toLocaleString('fa-IR')}</td><td>${Number(u.streak||0)}</td>
    <td>${u.pets?.length||0} / ${u.upgrades?.length||0}</td><td><div class="admin-actions"><button class="btn btn-secondary" data-admin-edit="${u.id}">ویرایش</button><button class="btn btn-outline" data-admin-details="${u.id}">جزئیات</button></div></td>
  </tr>`).join('') || '<tr><td colspan="8">کاربری پیدا نشد.</td></tr>';
  body.querySelectorAll('[data-admin-edit]').forEach(b=>b.onclick=()=>editAdminUser(b.dataset.adminEdit));
  body.querySelectorAll('[data-admin-details]').forEach(b=>b.onclick=()=>showAdminDetails(b.dataset.adminDetails));
}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
async function editAdminUser(id){
  const u=adminUsers.find(x=>x.id===id);if(!u)return;
  const coins=prompt('موجودی KoleCoin',u.coins); if(coins===null)return;
  const level=prompt('لول',u.level||1); if(level===null)return;
  const xp=prompt('XP',u.xp||0); if(xp===null)return;
  const {error}=await sb.rpc('kg_admin_update_user',{p_user:id,p_coins:Math.max(0,Math.floor(Number(coins))),p_xp:Math.max(0,Math.floor(Number(xp))),p_level:Math.max(1,Math.floor(Number(level))),p_jail_until:u.jail_until||null});
  if(error){adminErr(error);return;} showToast('اطلاعات کاربر ذخیره شد'); await loadAdmin();
}
function showAdminDetails(id){
  const u=adminUsers.find(x=>x.id===id);if(!u)return;const d=document.getElementById('adminDetail');if(!d)return;
  d.hidden=false; d.innerHTML=`<h3>${escapeHtml(u.username)}</h3><p>ساخته شده: ${new Date(u.created_at).toLocaleString('fa-IR')}</p><p>Petها: ${(u.pets||[]).map(x=>`${escapeHtml(x.key)} Lv.${x.level}`).join('، ')||'ندارد'}</p><p>ارتقاها: ${(u.upgrades||[]).map(x=>`${escapeHtml(x.key)} Lv.${x.level}`).join('، ')||'ندارد'}</p><button class="btn btn-outline" id="closeAdminDetail">بستن</button>`;
  document.getElementById('closeAdminDetail').onclick=()=>d.hidden=true;
}
document.getElementById('adminRefreshBtn')?.addEventListener('click',loadAdminUsers);
document.getElementById('adminSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter')loadAdminUsers()});

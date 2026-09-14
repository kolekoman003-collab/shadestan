document.getElementById('addFriendBtn').addEventListener('click', async () => {
  if (!state.profile) { showToast('اول وارد حساب شو'); return; }
  const username=document.getElementById('friendUsername').value.trim();
  if(!username)return;
  if(username.toLowerCase()===String(state.profile.username).toLowerCase()){showToast('نمی‌تونی خودتو اضافه کنی');return;}
  const {data:p,error:e}=await sb.from('profiles').select('id,username').ilike('username',username).maybeSingle();
  if(e||!p){showToast('این نام کاربری پیدا نشد');return;}
  const {error}=await sb.from('kg_friend_requests').insert({sender_id:state.user.id,receiver_id:p.id});
  if(error){
    // Old direct-friend compatibility, only if the new migration is not installed.
    if(String(error.message||'').includes('relation')||String(error.message||'').includes('schema cache')){
      const old=await sb.from('friends').insert({user_id:state.user.id,friend_id:p.id});
      if(old.error){showToast('خطا در ارسال درخواست');return;}
      showToast('دوست اضافه شد'); document.getElementById('friendUsername').value=''; loadFriends(); return;
    }
    showToast(error.message.includes('duplicate')?'درخواست قبلاً ارسال شده':'ارسال درخواست ناموفق بود');return;
  }
  document.getElementById('friendUsername').value='';showToast('درخواست دوستی ارسال شد');loadFriends();
});

async function loadFriendRequests(){
  if(!state.user)return;
  const {data}=await sb.from('kg_friend_requests').select('id,sender_id,created_at,profiles!kg_friend_requests_sender_id_fkey(username)').eq('receiver_id',state.user.id).eq('status','pending').order('created_at',{ascending:false});
  return data||[];
}
async function respondFriend(id,accept){
  const {error}=await sb.rpc(accept?'kg_accept_friend_request':'kg_reject_friend_request',{p_request_id:id});
  if(error){showToast('این عملیات هنوز روی دیتابیس فعال نشده');return;}
  showToast(accept?'دوست اضافه شد':'درخواست رد شد');loadFriends();
}
async function loadFriends(){
  const list=document.getElementById('friendList');
  if(!state.user){list.innerHTML='<li>برای دیدن دوستات اول وارد حساب شو</li>';return;}
  const req=await loadFriendRequests();
  const {data,error}=await sb.from('friends').select('friend_id, profiles!friends_friend_id_fkey(username, coins, level)').eq('user_id',state.user.id);
  const friends=data||[];
  let html=req.map(r=>`<li class="friend-request"><div><strong>${escapeHtml(r.profiles?.username||'Player')}</strong><small>درخواست دوستی فرستاده</small></div><div class="friend-actions"><button class="btn btn-primary btn-sm" data-accept="${r.id}">قبول</button><button class="btn btn-outline btn-sm" data-reject="${r.id}">رد</button></div></li>`).join('');
  if(friends.length) html+=friends.map(row=>{const p=row.profiles||{};const online=window.KG_MP?.presence?.has?.(row.friend_id);return `<li class="friend-row"><div class="friend-person"><span class="friend-status ${online?'online':''}"></span><div><strong>${escapeHtml(p.username||'Player')}</strong><small>Level ${p.level||1} · ${formatKole(p.coins||0)} KC</small></div></div><button class="btn btn-secondary btn-sm" data-friend-play="${row.friend_id}">دعوت بازی</button></li>`}).join('');
  if(!html)html='<li class="empty-state">هنوز دوستی نداری. از بالا درخواست بفرست.</li>';
  list.innerHTML=html;
  list.querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>respondFriend(b.dataset.accept,true));
  list.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>respondFriend(b.dataset.reject,false));
  list.querySelectorAll('[data-friend-play]').forEach(b=>b.onclick=()=>{goToPage('arena');showToast('یک اتاق بساز و دوستت را دعوت کن');});
}

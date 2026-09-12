document.getElementById('addFriendBtn').addEventListener('click', async () => {
  if (!state.profile) { showToast('اول وارد حساب شو'); return; }
  const username = document.getElementById('friendUsername').value.trim();
  if (!username) return;
  if (username === state.profile.username) { showToast('نمی‌تونی خودتو اضافه کنی 😅'); return; }

  const { data: friendProfile, error: findErr } = await sb
    .from('profiles').select('id, username').eq('username', username).single();

  if (findErr || !friendProfile) { showToast('این نام کاربری پیدا نشد'); return; }

  const { error: insertErr } = await sb.from('friends').insert({
    user_id: state.user.id,
    friend_id: friendProfile.id,
  });

  if (insertErr) {
    showToast(insertErr.message.includes('duplicate') ? 'قبلاً اضافه کردیش' : 'خطا در اضافه کردن');
    return;
  }

  document.getElementById('friendUsername').value = '';
  showToast(`${username} به لیست دوستات اضافه شد 👯`);
  loadFriends();
});

async function loadFriends() {
  if (!state.user) {
    document.getElementById('friendList').innerHTML = '<li>برای دیدن دوستات اول وارد حساب شو</li>';
    return;
  }
  const { data, error } = await sb
    .from('friends')
    .select('friend_id, profiles!friends_friend_id_fkey(username, coins)')
    .eq('user_id', state.user.id);

  const list = document.getElementById('friendList');
  if (error || !data || data.length === 0) {
    list.innerHTML = '<li>هنوز دوستی اضافه نکردی</li>';
    return;
  }
  list.innerHTML = data.map(row => `
    <li><span>${row.profiles.username}</span><span>🪙 ${row.profiles.coins}</span></li>
  `).join('');
}

// ===== Global state =====
const state = {
  user: null,      // supabase auth user
  profile: null,   // row from profiles table
};

// ===== Toast helper =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ===== Navigation =====
function goToPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.page === pageId));

  if (pageId === 'leaderboard') loadLeaderboard();
  if (pageId === 'friends') loadFriends();
  if (pageId === 'bank') refreshBankUI();
  if (pageId === 'hub') { updateProgressUI(); if (typeof refreshLotteryUI === 'function') refreshLotteryUI(); }
}

document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', () => goToPage(btn.dataset.page));
});

document.getElementById('heroCta').addEventListener('click', () => goToPage('games'));

// ===== Coin display sync =====
function updateCoinBadge() {
  const badge = document.getElementById('coinBadge');
  if (!state.profile) { badge.hidden = true; return; }
  badge.hidden = false;
  document.getElementById('coinCount').textContent = state.profile.coins;
}

function updateDashboardUI() {
  if (!state.profile) return;
  document.getElementById('dashUsername').textContent = state.profile.username;
  document.getElementById('dashCoins').textContent = state.profile.coins;
  document.getElementById('dashBank').textContent = state.profile.bank_balance;
  const levelEl = document.getElementById('dashLevel'); if (levelEl) levelEl.textContent = state.profile.level || 1;
  updateCoinBadge();
}

// ===== Fetch profile from DB and refresh everything =====
async function refreshProfile() {
  if (!state.user) return;
  const { data, error } = await sb.from('profiles').select('*').eq('id', state.user.id).single();
  if (error) { console.error(error); return; }
  state.profile = data;
  updateDashboardUI();
}

// ===== Award game reward =====
// Rewards are written by one atomic database transaction. This updates coins,
// XP and level together, so a successful game can never leave the UI with a
// reward that was not stored.
async function addCoins(amount, game = 'game') {
  if (!state.user || !state.profile) { showToast('اول باید وارد حساب بشی'); return false; }
  const delta = Math.trunc(Number(amount));
  if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1000000) return false;

  // Negative values are used by games for penalties/bets and keep using the
  // generic atomic coin RPC. Positive values use the combined reward RPC.
  if (delta < 0) {
    const { data, error } = await sb.rpc('change_kolecoins', { p_amount: delta });
    if (error || !Number.isSafeInteger(Number(data))) {
      console.error('coin deduction failed:', error);
      showToast('تغییر موجودی ناموفق بود');
      return false;
    }
    await refreshProfile();
    return true;
  }

  const { data, error } = await sb.rpc('award_game_reward', {
    p_amount: delta,
    p_game: String(game).slice(0, 40)
  });

  if (!error && data?.ok) {
    await refreshProfile();
    if (data.leveled_up) showToast(`🎉 لول ${data.level} شدی!`);
    return true;
  }

  // Compatibility path for an older deployment where the new RPC is not yet
  // available. It still tries the previous atomic coin RPC before the final
  // compare-and-set fallback.
  if (error) console.warn('award_game_reward failed:', error);
  const { data: oldData, error: oldError } = await sb.rpc('change_kolecoins', { p_amount: delta });
  if (!oldError && Number.isSafeInteger(Number(oldData))) {
    await refreshProfile();
    if (typeof addXP === 'function') await addXP(Math.min(delta, 120));
    return true;
  }

  // Last-resort compatibility for a schema where RPC creation/cache is broken.
  const { data: fresh, error: freshErr } = await sb.from('profiles')
    .select('id, coins')
    .eq('id', state.user.id)
    .maybeSingle();
  if (freshErr || !fresh) {
    console.error('profile read failed:', freshErr, oldError);
    showToast('حساب کاربری پیدا نشد');
    return false;
  }

  const oldBalance = Number(fresh.coins ?? 0);
  const expectedNew = oldBalance + delta;
  if (!Number.isSafeInteger(oldBalance) || !Number.isSafeInteger(expectedNew)) {
    showToast('موجودی حساب نامعتبره');
    return false;
  }

  const { data: rows, error: updateError } = await sb.from('profiles')
    .update({ coins: expectedNew })
    .eq('id', state.user.id)
    .eq('coins', oldBalance)
    .select('coins');

  if (updateError || !rows?.length) {
    console.error('coin fallback failed:', updateError);
    showToast('ثبت KoleCoin ناموفق بود');
    return false;
  }

  await refreshProfile();
  return true;
}

document.getElementById('gameModalBody'); // ensure exists (no-op)

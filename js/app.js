// ===== Global state =====
const state = {
  user: null,      // supabase auth user
  profile: null,   // row from profiles table
};
window.state = state;

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
  if (pageId === 'arena' && typeof startPresence === 'function') startPresence();
  if (pageId === 'quests' && typeof renderQuests === 'function') renderQuests();
  if ((pageId === 'shop' || pageId === 'pets') && typeof loadShop === 'function') loadShop();
  if (pageId === 'admin' && typeof loadAdmin === 'function') loadAdmin();
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
async function ensureProfileRow() {
  if (!state.user) return null;

  // The profile must have exactly one row per authenticated user. Older
  // accounts can exist without a profile when the trigger was installed
  // after signup, so repair that case instead of using .single() and turning
  // a missing row into a 406/PGRST116 error.
  const desired = String(
    state.user.user_metadata?.username ||
    `player_${state.user.id.replaceAll('-', '').slice(0, 10)}`
  ).trim().slice(0, 32);

  const { data: existing, error: readError } = await sb.from('profiles')
    .select('*')
    .eq('id', state.user.id)
    .maybeSingle();
  if (readError) {
    console.error('profile lookup failed:', readError);
    return null;
  }
  if (existing) return existing;

  // First try the requested username; if it is already taken, use an
  // id-derived fallback that is unique for this account.
  let { error: insertError } = await sb.from('profiles').insert({
    id: state.user.id,
    username: desired || `player_${state.user.id.replaceAll('-', '').slice(0, 10)}`
  });

  if (insertError) {
    const fallback = `player_${state.user.id.replaceAll('-', '').slice(0, 12)}`;
    const second = await sb.from('profiles').insert({ id: state.user.id, username: fallback });
    insertError = second.error || null;
  }

  if (insertError) {
    console.error('profile creation failed:', insertError);
    return null;
  }

  const { data: repaired, error: verifyError } = await sb.from('profiles')
    .select('*')
    .eq('id', state.user.id)
    .maybeSingle();
  if (verifyError || !repaired) {
    console.error('profile verify failed:', verifyError);
    return null;
  }
  return repaired;
}

async function refreshProfile() {
  if (!state.user) return false;
  const data = await ensureProfileRow();
  if (!data) {
    showToast('پروفایل کاربری پیدا نشد؛ یک بار دوباره وارد شو');
    return false;
  }
  state.profile = data;
  updateDashboardUI();
  if (typeof updateProgressUI === 'function') updateProgressUI();
  return true;
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
    if (typeof kgRecord === 'function') kgRecord('play');
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
    if (typeof kgRecord === 'function') kgRecord('play');
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
  if (typeof kgRecord === 'function') kgRecord('play');
  return true;
}

document.querySelectorAll('[data-page-link]').forEach(el=>el.addEventListener('click',()=>goToPage(el.dataset.pageLink)));
document.getElementById('gameModalBody'); // ensure exists (no-op)

// ===== SVG icon helper (no emoji UI icons) =====
function kgIcon(name, cls='svg-icon') {
  const paths = {
    coin:'<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9h3a2 2 0 1 1 0 4h-3a2 2 0 1 0 0 4h3M12 7v2M12 16v2"/>',
    pet:'<path d="M8 8c0-3 2-5 4-5s4 2 4 5v3a5 5 0 0 1-10 0V8Z"/><path d="M8 9 5 7M16 9l3-2M10 12h.01M14 12h.01"/>',
    bolt:'<path d="m13 2-8 11h6l-1 9 8-12h-6z"/>',
    shield:'<path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    game:'<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M8 10v4M6 12h4M16 11h.01M18 13h.01"/>',
    lock:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
  };
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.game}</svg>`;
}

// ===== Theme =====
(function initTheme(){
  const apply=(mode)=>{document.body.classList.toggle('light-mode',mode==='light');const b=document.getElementById('themeToggle');if(b)b.innerHTML=mode==='light'?'🌙 <span>تاریک</span>':'☀️ <span>روشن</span>';localStorage.setItem('kg-theme',mode)};
  const saved=localStorage.getItem('kg-theme')||'dark';
  document.addEventListener('DOMContentLoaded',()=>{apply(saved);document.getElementById('themeToggle')?.addEventListener('click',()=>apply(document.body.classList.contains('light-mode')?'dark':'light'))});
})();

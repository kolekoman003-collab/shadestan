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

// ===== Award / deduct coins (client-side; see README for security note) =====
async function addCoins(amount) {
  if (!state.profile) { showToast('اول باید وارد حساب بشی'); return false; }
  const newTotal = Math.max(0, state.profile.coins + amount);
  const { error } = await sb.from('profiles').update({ coins: newTotal }).eq('id', state.user.id);
  if (error) { console.error(error); showToast('یه مشکلی پیش اومد'); return false; }
  state.profile.coins = newTotal;
  updateDashboardUI();
  return true;
}

document.getElementById('gameModalBody'); // ensure exists (no-op)

// ===== KoleGame economy helpers =====
const LEVEL_TABLE = [0, 250, 650, 1200, 2000, 3200, 4800, 7000, 10000, 14000, 19000];

function formatKole(n) { return Number(n || 0).toLocaleString('fa-IR'); }
function xpForLevel(level) { return LEVEL_TABLE[Math.min(level - 1, LEVEL_TABLE.length - 1)] || (level - 1) * 250; }
function levelFromXp(xp) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 100) level++;
  return level;
}
function updateProgressUI() {
  if (!state.profile) return;
  const xp = Number(state.profile.xp || 0);
  const level = Number(state.profile.level || levelFromXp(xp));
  state.profile.level = level;
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = Math.max(0, Math.min(100, ((xp - current) / Math.max(1, next - current)) * 100));
  const els = {
    level: document.getElementById('levelValue'), xp: document.getElementById('xpValue'), fill: document.getElementById('xpFill'), streak: document.getElementById('streakValue')
  };
  if (els.level) els.level.textContent = level;
  if (els.xp) els.xp.textContent = `${formatKole(xp)} / ${formatKole(next)} XP`;
  if (els.fill) els.fill.style.width = `${pct}%`;
  if (els.streak) els.streak.textContent = `${Number(state.profile.streak || 0)} روز`;
}

async function refreshEconomy() {
  if (!state.user) return;
  const { data, error } = await sb.from('profiles').select('*').eq('id', state.user.id).single();
  if (!error && data) {
    state.profile = data;
    updateDashboardUI();
    updateProgressUI();
  }
}

async function addXP(amount) {
  if (!state.user || !amount) return false;
  const { data, error } = await sb.rpc('award_xp', { p_amount: Math.max(0, Math.floor(amount)) });
  if (error) { console.error(error); return false; }
  if (data) {
    state.profile.xp = data.xp;
    state.profile.level = data.level;
    if (data.leveled_up) showToast(`🎉 لول ${data.level} شدی!`);
    updateDashboardUI(); updateProgressUI();
  }
  return true;
}

async function transferKoleCoins(username, amount) {
  if (!state.user) return { error: { message: 'اول وارد حساب شو' } };
  return await sb.rpc('transfer_kolecoins', { p_to_username: username, p_amount: Math.floor(amount) });
}

async function spinWheel() {
  const { data, error } = await sb.rpc('spin_wheel');
  if (!error && data) await refreshEconomy();
  return { data, error };
}

async function buyLotteryTickets(count) {
  return await sb.rpc('buy_lottery_tickets', { p_tickets: Math.floor(count) });
}

async function getLotteryState() {
  return await sb.rpc('get_lottery_state');
}

async function tryLotteryDraw() {
  return await sb.rpc('draw_lottery_if_needed');
}

document.getElementById('transferOpenBtn')?.addEventListener('click', () => {
  const panel = document.getElementById('transferPanel');
  if (panel) panel.hidden = !panel.hidden;
});
document.getElementById('hubBtn')?.addEventListener('click', () => goToPage('hub'));
document.getElementById('transferBtn')?.addEventListener('click', async () => {
  const username = document.getElementById('transferUsername').value.trim();
  const amount = parseInt(document.getElementById('transferAmount').value, 10);
  if (!username || !amount || amount < 1) { showToast('گیرنده و مقدار رو درست وارد کن'); return; }
  const btn = document.getElementById('transferBtn'); btn.disabled = true;
  const { data, error } = await transferKoleCoins(username, amount); btn.disabled = false;
  if (error) { showToast(error.message.includes('not found') ? 'این کاربر پیدا نشد' : error.message.includes('not enough') ? 'KoleCoin کافی نداری' : 'انتقال انجام نشد'); return; }
  await refreshEconomy();
  document.getElementById('transferUsername').value = '';
  document.getElementById('transferAmount').value = '';
  showToast(`${formatKole(data.amount || amount)} KoleCoin منتقل شد 💸`);
});

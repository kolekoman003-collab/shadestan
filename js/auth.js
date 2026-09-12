// ===== Auth tabs (login / signup) =====
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.auth === 'login';
    document.getElementById('loginForm').hidden = !isLogin;
    document.getElementById('signupForm').hidden = isLogin;
  });
});

// ===== Signup =====
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('signupUsername').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const errBox = document.getElementById('signupError');
  errBox.textContent = '';

  if (username.length < 3) { errBox.textContent = 'نام کاربری باید حداقل ۳ حرف باشه'; return; }

  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) { errBox.textContent = error.message; return; }

  // profile row is created once the user is authenticated
  if (data.user) {
    const { error: profErr } = await sb.from('profiles').insert({ id: data.user.id, username });
    if (profErr) {
      errBox.textContent = profErr.message.includes('duplicate') ? 'این نام کاربری قبلاً گرفته شده' : profErr.message;
      return;
    }
  }
  showToast('حساب ساخته شد! 🎉');
  await handleAuthenticated(data.user, data.session);
});

// ===== Login =====
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginError');
  errBox.textContent = '';

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { errBox.textContent = 'ایمیل یا رمز اشتباهه'; return; }
  showToast('خوش اومدی! 👋');
  await handleAuthenticated(data.user, data.session);
});

// ===== Logout =====
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await sb.auth.signOut();
  state.user = null;
  state.profile = null;
  document.getElementById('authBox').hidden = false;
  document.getElementById('dashboardBox').hidden = true;
  updateCoinBadge();
  showToast('از حساب خارج شدی');
});

// ===== Daily bonus =====
document.getElementById('dailyBonusBtn').addEventListener('click', async () => {
  if (!state.profile) return;
  const last = state.profile.last_daily_claim ? new Date(state.profile.last_daily_claim) : null;
  const now = new Date();
  if (last && (now - last) < 24 * 60 * 60 * 1000) {
    const hoursLeft = Math.ceil(24 - (now - last) / 3600000);
    showToast(`جایزه رو گرفتی! ${hoursLeft} ساعت دیگه بیا`);
    return;
  }
  const reward = 20 + Math.floor(Math.random() * 80); // 20-100
  await sb.from('profiles').update({ last_daily_claim: now.toISOString() }).eq('id', state.user.id);
  state.profile.last_daily_claim = now.toISOString();
  await addCoins(reward);
  showToast(`آفرین! ${reward} سکه جایزه گرفتی 🎁`);
});

// ===== Handle a freshly authenticated user =====
async function handleAuthenticated(user, session) {
  state.user = user;
  document.getElementById('authBox').hidden = true;
  document.getElementById('dashboardBox').hidden = false;
  await refreshProfile();
}

// ===== Restore session on page load =====
(async function initSession() {
  const { data } = await sb.auth.getSession();
  if (data.session && data.session.user) {
    await handleAuthenticated(data.session.user, data.session);
  }
})();

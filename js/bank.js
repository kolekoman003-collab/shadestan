function refreshBankUI() {
  if (!state.profile) return;
  document.getElementById('bankCash').textContent = state.profile.coins + ' 🪙';
  document.getElementById('bankSaved').textContent = state.profile.bank_balance + ' 🪙';
}

document.getElementById('depositBtn').addEventListener('click', async () => {
  const amount = parseInt(document.getElementById('bankAmount').value, 10);
  if (!state.profile) { showToast('اول وارد حساب شو'); return; }
  if (!amount || amount <= 0) { showToast('یه مقدار درست وارد کن'); return; }
  if (amount > state.profile.coins) { showToast('این‌قدر سکه نداری'); return; }

  const newCash = state.profile.coins - amount;
  const newBank = state.profile.bank_balance + amount;
  const { error } = await sb.from('profiles').update({ coins: newCash, bank_balance: newBank }).eq('id', state.user.id);
  if (error) { showToast('خطا در واریز'); return; }
  state.profile.coins = newCash;
  state.profile.bank_balance = newBank;
  updateDashboardUI();
  refreshBankUI();
  showToast(`${amount} سکه واریز شد 🏦`);
});

document.getElementById('withdrawBtn').addEventListener('click', async () => {
  const amount = parseInt(document.getElementById('bankAmount').value, 10);
  if (!state.profile) { showToast('اول وارد حساب شو'); return; }
  if (!amount || amount <= 0) { showToast('یه مقدار درست وارد کن'); return; }
  if (amount > state.profile.bank_balance) { showToast('این‌قدر تو بانک نداری'); return; }

  const newCash = state.profile.coins + amount;
  const newBank = state.profile.bank_balance - amount;
  const { error } = await sb.from('profiles').update({ coins: newCash, bank_balance: newBank }).eq('id', state.user.id);
  if (error) { showToast('خطا در برداشت'); return; }
  state.profile.coins = newCash;
  state.profile.bank_balance = newBank;
  updateDashboardUI();
  refreshBankUI();
  showToast(`${amount} سکه برداشت شد`);
});

document.getElementById('claimInterestBtn').addEventListener('click', async () => {
  if (!state.profile) { showToast('اول وارد حساب شو'); return; }
  const last = state.profile.last_bank_interest ? new Date(state.profile.last_bank_interest) : new Date(0);
  const now = new Date();
  if ((now - last) < 24 * 60 * 60 * 1000) {
    const hoursLeft = Math.ceil(24 - (now - last) / 3600000);
    showToast(`سود رو گرفتی! ${hoursLeft} ساعت دیگه بیا`);
    return;
  }
  if (state.profile.bank_balance <= 0) { showToast('اول یه‌چیزی تو بانک بذار'); return; }

  const interest = Math.floor(state.profile.bank_balance * 0.05); // 5%
  const newBank = state.profile.bank_balance + interest;
  const { error } = await sb.from('profiles')
    .update({ bank_balance: newBank, last_bank_interest: now.toISOString() })
    .eq('id', state.user.id);
  if (error) { showToast('خطا در دریافت سود'); return; }
  state.profile.bank_balance = newBank;
  state.profile.last_bank_interest = now.toISOString();
  updateDashboardUI();
  refreshBankUI();
  showToast(`${interest} سکه سود گرفتی 🎉`);
});

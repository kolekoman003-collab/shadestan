function refreshBankUI() {
  if (!state.profile) return;
  document.getElementById('bankCash').textContent = state.profile.coins + ' 🪙';
  document.getElementById('bankSaved').textContent = state.profile.bank_balance + ' 🪙';
}

document.getElementById('depositBtn').addEventListener('click', async () => {
  const amount = parseInt(document.getElementById('bankAmount').value, 10);
  if (!state.profile) { showToast('اول وارد حساب شو'); return; }
  if (!amount || amount <= 0) { showToast('یه مقدار درست وارد کن'); return; }
  const { data, error } = await sb.rpc('bank_move', { p_direction: 'deposit', p_amount: amount });
  if (!error && data) { state.profile.coins=Number(data.coins); state.profile.bank_balance=Number(data.bank_balance); }
  else { if(amount>state.profile.coins){showToast('این‌قدر سکه نداری');return;} const nc=state.profile.coins-amount,nb=state.profile.bank_balance+amount; const r=await sb.from('profiles').update({coins:nc,bank_balance:nb}).eq('id',state.user.id); if(r.error){showToast('خطا در واریز');return;} state.profile.coins=nc;state.profile.bank_balance=nb; }
  updateDashboardUI(); refreshBankUI(); showToast(`${amount} KoleCoin واریز شد 🏦`);
});

document.getElementById('withdrawBtn').addEventListener('click', async () => {
  const amount = parseInt(document.getElementById('bankAmount').value, 10);
  if (!state.profile) { showToast('اول وارد حساب شو'); return; }
  if (!amount || amount <= 0) { showToast('یه مقدار درست وارد کن'); return; }
  const { data, error } = await sb.rpc('bank_move', { p_direction: 'withdraw', p_amount: amount });
  if (!error && data) { state.profile.coins=Number(data.coins); state.profile.bank_balance=Number(data.bank_balance); }
  else { if(amount>state.profile.bank_balance){showToast('این‌قدر تو بانک نداری');return;} const nc=state.profile.coins+amount,nb=state.profile.bank_balance-amount; const r=await sb.from('profiles').update({coins:nc,bank_balance:nb}).eq('id',state.user.id); if(r.error){showToast('خطا در برداشت');return;} state.profile.coins=nc;state.profile.bank_balance=nb; }
  updateDashboardUI(); refreshBankUI(); showToast(`${amount} KoleCoin برداشت شد`);
});

document.getElementById('claimInterestBtn').addEventListener('click', async () => {
  if (!state.profile) { showToast('اول وارد حساب شو'); return; }
  const { data, error } = await sb.rpc('claim_bank_interest');
  if (!error && data) { state.profile.bank_balance=Number(data.bank_balance); state.profile.last_bank_interest=new Date().toISOString(); updateDashboardUI(); refreshBankUI(); showToast(`${data.interest} KoleCoin سود گرفتی 🎉`); return; }
  const last=state.profile.last_bank_interest?new Date(state.profile.last_bank_interest):new Date(0), now=new Date();
  if(now-last<86400000){showToast(`سود رو گرفتی! ${Math.ceil(24-(now-last)/3600000)} ساعت دیگه بیا`);return;}
  if(state.profile.bank_balance<=0){showToast('اول یه‌چیزی تو بانک بذار');return;}
  const interest=Math.floor(state.profile.bank_balance*.05), nb=state.profile.bank_balance+interest; const r=await sb.from('profiles').update({bank_balance:nb,last_bank_interest:now.toISOString()}).eq('id',state.user.id); if(r.error){showToast('خطا در دریافت سود');return;} state.profile.bank_balance=nb;updateDashboardUI();refreshBankUI();showToast(`${interest} KoleCoin سود گرفتی 🎉`);
});

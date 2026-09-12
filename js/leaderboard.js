async function loadLeaderboard() {
  const { data, error } = await sb
    .from('profiles')
    .select('username, coins')
    .order('coins', { ascending: false })
    .limit(20);

  const body = document.getElementById('leaderboardBody');
  if (error || !data) { body.innerHTML = '<tr><td colspan="3">مشکلی پیش اومد</td></tr>'; return; }

  const medals = ['🥇', '🥈', '🥉'];
  body.innerHTML = data.map((row, i) => `
    <tr>
      <td>${medals[i] || (i + 1)}</td>
      <td>${row.username}</td>
      <td>🪙 ${row.coins}</td>
    </tr>
  `).join('');
}

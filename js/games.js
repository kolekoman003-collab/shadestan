const gameModal = document.getElementById('gameModal');
const gameModalBody = document.getElementById('gameModalBody');

document.getElementById('closeGameModal').addEventListener('click', closeGameModal);
gameModal.addEventListener('click', (e) => { if (e.target === gameModal) closeGameModal(); });

function openGameModal(html) {
  gameModalBody.innerHTML = html;
  gameModal.hidden = false;
}
function closeGameModal() {
  gameModal.hidden = true;
  gameModalBody.innerHTML = '';
}

document.querySelectorAll('[data-open-game]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!state.user) { showToast('اول باید وارد حساب بشی'); goToPage('account'); return; }
    const game = btn.dataset.openGame;
    if (game === 'reaction') startReactionGame();
    if (game === 'memory') startMemoryGame();
    if (game === 'quiz') startQuizGame();
    if (game === 'heist') startHeistGame();
  });
});

// ===================== REACTION GAME =====================
function startReactionGame() {
  openGameModal(`
    <h3>⚡ کلیک سریع</h3>
    <p>صبر کن رنگش سبز بشه، بعد سریع کلیک کن!</p>
    <div class="reaction-box wait" id="reactionBox">صبر کن...</div>
  `);
  const box = document.getElementById('reactionBox');
  let startTime = 0;
  let state_ = 'waiting';

  const delay = 1500 + Math.random() * 2500;
  setTimeout(() => {
    if (!document.getElementById('reactionBox')) return;
    box.classList.remove('wait');
    box.classList.add('go');
    box.textContent = 'بزن! 🟢';
    startTime = Date.now();
    state_ = 'go';
  }, delay);

  box.addEventListener('click', async () => {
    if (state_ === 'waiting') {
      box.textContent = '😅 زودتر از موقع کلیک کردی، دوباره امتحان کن';
      state_ = 'done';
      return;
    }
    if (state_ !== 'go') return;
    state_ = 'done';
    const reaction = Date.now() - startTime;
    const reward = Math.max(5, 60 - Math.floor(reaction / 15));
    box.textContent = `⏱️ ${reaction} میلی‌ثانیه`;
    await addCoins(reward);
    showToast(`${reward} سکه گرفتی ⚡`);
  });
}

// ===================== MEMORY GAME =====================
function startMemoryGame() {
  const emojis = ['🍭', '🎈', '🌈', '🎨', '🍩', '🎁', '🧩', '⭐'];
  const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);

  openGameModal(`
    <h3>🧠 بازی حافظه</h3>
    <p>کارت‌های همسان رو پیدا کن. تعداد تلاش کمتر = سکه بیشتر.</p>
    <div class="memory-grid" id="memoryGrid"></div>
  `);

  const grid = document.getElementById('memoryGrid');
  let flipped = [];
  let matched = 0;
  let tries = 0;
  let lock = false;

  cards.forEach((emoji, i) => {
    const cell = document.createElement('div');
    cell.className = 'memory-card';
    cell.dataset.emoji = emoji;
    cell.dataset.index = i;
    cell.textContent = '❔';
    cell.addEventListener('click', () => {
      if (lock || cell.classList.contains('flipped') || cell.classList.contains('matched')) return;
      cell.textContent = emoji;
      cell.classList.add('flipped');
      flipped.push(cell);
      if (flipped.length === 2) {
        tries++;
        lock = true;
        setTimeout(() => {
          const [a, b] = flipped;
          if (a.dataset.emoji === b.dataset.emoji) {
            a.classList.add('matched'); b.classList.add('matched');
            matched += 2;
            if (matched === cards.length) finishMemory(tries);
          } else {
            a.classList.remove('flipped'); a.textContent = '❔';
            b.classList.remove('flipped'); b.textContent = '❔';
          }
          flipped = [];
          lock = false;
        }, 700);
      }
    });
    grid.appendChild(cell);
  });

  async function finishMemory(tries) {
    const reward = Math.max(10, 120 - tries * 8);
    setTimeout(async () => {
      gameModalBody.innerHTML += `<p>🎉 تموم شد! با ${tries} تلاش بردی.</p>`;
      await addCoins(reward);
      showToast(`${reward} سکه گرفتی 🧠`);
    }, 300);
  }
}

// ===================== QUIZ GAME =====================
const QUIZ_QUESTIONS = [
  { q: 'پایتخت فرانسه کجاست؟', options: ['پاریس', 'رم', 'برلین', 'لندن'], correct: 0 },
  { q: 'بزرگ‌ترین سیاره منظومه شمسی؟', options: ['زمین', 'مریخ', 'مشتری', 'زهره'], correct: 2 },
  { q: 'آب از چند مولکول تشکیل شده؟', options: ['H2O', 'CO2', 'O2', 'N2'], correct: 0 },
  { q: 'نویسنده «بوف کور» کیست؟', options: ['فردوسی', 'صادق هدایت', 'حافظ', 'سعدی'], correct: 1 },
  { q: 'سریع‌ترین حیوان خشکی کدومه؟', options: ['شیر', 'اسب', 'یوزپلنگ', 'گورخر'], correct: 2 },
];

function startQuizGame() {
  let index = 0;
  let score = 0;
  renderQuestion();

  function renderQuestion() {
    if (index >= QUIZ_QUESTIONS.length) {
      openGameModal(`<h3>🎉 کوییز تموم شد!</h3><p>${score} تا از ${QUIZ_QUESTIONS.length} سوال رو درست جواب دادی.</p>`);
      const reward = score * 20;
      addCoins(reward).then(() => showToast(`${reward} سکه گرفتی ❓`));
      return;
    }
    const q = QUIZ_QUESTIONS[index];
    openGameModal(`
      <h3>❓ سوال ${index + 1} از ${QUIZ_QUESTIONS.length}</h3>
      <p>${q.q}</p>
      <div id="quizOptions" style="display:flex;flex-direction:column;gap:8px;"></div>
    `);
    const optBox = document.getElementById('quizOptions');
    q.options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.className = 'btn btn-outline';
      b.textContent = opt;
      b.addEventListener('click', () => {
        if (i === q.correct) { score++; showToast('آفرین! درست بود ✅'); }
        else showToast('اشتباه بود ❌');
        index++;
        renderQuestion();
      });
      optBox.appendChild(b);
    });
  }
}

// ===================== HEIST GAME (فرار از پلیس) =====================
function startHeistGame() {
  const now = new Date();
  if (state.profile.jail_until && new Date(state.profile.jail_until) > now) {
    const minsLeft = Math.ceil((new Date(state.profile.jail_until) - now) / 60000);
    openGameModal(`<h3>🚔 تو زندانی!</h3><p>${minsLeft} دقیقه دیگه صبر کن.</p>`);
    return;
  }

  openGameModal(`
    <h3>🚓 فرار از پلیس</h3>
    <p>یه سرقت کوچیک زدی! سریع کلیک کن تا از دست پلیس فرار کنی. ۵ ثانیه وقت داری.</p>
    <div class="heist-meter"><div class="heist-fill" id="heistFill"></div></div>
    <button class="btn btn-danger btn-lg" id="heistClickBtn">فرار کن! 🏃</button>
  `);

  const NEEDED_CLICKS = 25;
  const TIME_LIMIT = 5000;
  let clicks = 0;
  let finished = false;

  const fill = document.getElementById('heistFill');
  const btn = document.getElementById('heistClickBtn');

  const timer = setTimeout(() => finishHeist(false), TIME_LIMIT);

  btn.addEventListener('click', () => {
    if (finished) return;
    clicks++;
    fill.style.width = Math.min(100, (clicks / NEEDED_CLICKS) * 100) + '%';
    if (clicks >= NEEDED_CLICKS) {
      clearTimeout(timer);
      finishHeist(true);
    }
  });

  async function finishHeist(success) {
    if (finished) return;
    finished = true;
    if (success) {
      const reward = 30 + Math.floor(Math.random() * 120);
      gameModalBody.innerHTML = `<h3>🎉 فرار کردی!</h3><p>${reward} سکه از سرقت گیرت اومد.</p>`;
      await addCoins(reward);
      showToast(`${reward} سکه گرفتی 🚓`);
    } else {
      const penalty = Math.min(state.profile.coins, 20 + Math.floor(Math.random() * 40));
      const jailMinutes = 5;
      const jailUntil = new Date(Date.now() + jailMinutes * 60000).toISOString();
      await sb.from('profiles').update({ jail_until: jailUntil }).eq('id', state.user.id);
      state.profile.jail_until = jailUntil;
      await addCoins(-penalty);
      gameModalBody.innerHTML = `<h3>🚨 دستگیر شدی!</h3><p>${penalty} سکه جریمه شدی و ${jailMinutes} دقیقه باید صبر کنی.</p>`;
      showToast(`دستگیر شدی 🚔 -${penalty} سکه`);
    }
  }
}

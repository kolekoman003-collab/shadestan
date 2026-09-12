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
    if (game === 'starcatch') startStarCatchGame();
    if (game === 'whackamole') startWhackAMoleGame();
    if (game === 'rps') startRPSGame();
    if (game === 'guess') startGuessGame();
    if (game === 'coinflip') startCoinFlipGame();
    if (game === 'tictactoe') startTicTacToeGame();
    if (game === 'wheel') startWheelGame();
    if (game === 'lottery') startLotteryGame();
    if (game === 'casino') startCasinoHub();
    if (game === 'aim') startAimGame();
    if (game === 'sequence') startSequenceGame();
    if (game === 'rocket') startRocketGame();
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
  {"q": "پایتخت ژاپن کجاست؟", "options": ["توکیو", "سئول", "پکن", "بانکوک"], "correct": 0},
  {"q": "بزرگ‌ترین سیاره منظومه شمسی؟", "options": ["زمین", "مریخ", "مشتری", "زحل"], "correct": 2},
  {"q": "فرمول آب چیست؟", "options": ["CO2", "H2O", "O2", "NaCl"], "correct": 1},
  {"q": "نویسنده بوف کور؟", "options": ["صادق هدایت", "حافظ", "سعدی", "فردوسی"], "correct": 0},
  {"q": "سریع‌ترین حیوان خشکی؟", "options": ["شیر", "یوزپلنگ", "اسب", "گرگ"], "correct": 1},
  {"q": "سیاره سرخ کدام است؟", "options": ["زهره", "مریخ", "عطارد", "نپتون"], "correct": 1},
  {"q": "بزرگ‌ترین اقیانوس؟", "options": ["اطلس", "هند", "آرام", "منجمد شمالی"], "correct": 2},
  {"q": "عدد اول بعد از ۷؟", "options": ["۸", "۹", "۱۰", "۱۱"], "correct": 3},
  {"q": "پایتخت ایتالیا؟", "options": ["رم", "میلان", "ونیز", "تورین"], "correct": 0},
  {"q": "نویسنده شاهنامه؟", "options": ["مولوی", "فردوسی", "خیام", "نظامی"], "correct": 1},
  {"q": "نزدیک‌ترین ستاره به زمین؟", "options": ["خورشید", "شعرای یمانی", "قطبی", "پروکسیما قنطورس"], "correct": 0},
  {"q": "کدام گاز بیشترین سهم جو زمین را دارد؟", "options": ["اکسیژن", "نیتروژن", "هیدروژن", "دی‌اکسیدکربن"], "correct": 1},
  {"q": "واحد اندازه‌گیری جریان برق؟", "options": ["ولت", "وات", "آمپر", "اهم"], "correct": 2},
  {"q": "کدام فلز نماد Fe دارد؟", "options": ["طلا", "آهن", "نقره", "مس"], "correct": 1},
  {"q": "پایتخت کانادا؟", "options": ["تورنتو", "ونکوور", "اتاوا", "مونترال"], "correct": 2},
  {"q": "کدام قاره بیشترین کشور را دارد؟", "options": ["آسیا", "آفریقا", "اروپا", "آمریکای جنوبی"], "correct": 1},
  {"q": "کوچک‌ترین عدد صحیح مثبت؟", "options": ["۰", "۱", "۲", "-۱"], "correct": 1},
  {"q": "۹×۸ چند است؟", "options": ["۶۴", "۷۲", "۸۱", "۹۰"], "correct": 1},
  {"q": "کدام جانور پستاندار است؟", "options": ["کوسه", "دلفین", "مار", "قورباغه"], "correct": 1},
  {"q": "کدام سیاره حلقه‌های مشهور دارد؟", "options": ["زحل", "مریخ", "عطارد", "زمین"], "correct": 0},
  {"q": "پایتخت اسپانیا؟", "options": ["بارسلونا", "مادرید", "سویا", "والنسیا"], "correct": 1},
  {"q": "کدام ساز ۶ سیم معمولی دارد؟", "options": ["پیانو", "ویولن", "گیتار", "فلوت"], "correct": 2},
  {"q": "مخترع تلفن در روایت رایج؟", "options": ["گراهام بل", "ادیسون", "نیوتن", "تسلا"], "correct": 0},
  {"q": "کدام ماده جامد است؟", "options": ["بخار", "یخ", "اکسیژن", "آب"], "correct": 1},
  {"q": "کدام رنگ از ترکیب آبی و زرد ساخته می‌شود؟", "options": ["بنفش", "نارنجی", "سبز", "صورتی"], "correct": 2},
  {"q": "پایتخت استرالیا؟", "options": ["سیدنی", "ملبورن", "کانبرا", "پرت"], "correct": 2},
  {"q": "عدد پی تقریباً؟", "options": ["۲.۱۴", "۳.۱۴", "۴.۱۳", "۱.۳۴"], "correct": 1},
  {"q": "کدام سیاره به خورشید نزدیک‌تر است؟", "options": ["عطارد", "زهره", "زمین", "مریخ"], "correct": 0},
  {"q": "کدام اقیانوس بین آفریقا و استرالیاست؟", "options": ["اطلس", "هند", "آرام", "منجمد جنوبی"], "correct": 1},
  {"q": "کدام کشور به شکل چکمه معروف است؟", "options": ["یونان", "ایتالیا", "پرتغال", "کرواسی"], "correct": 1},
  {"q": "حافظ بیشتر با کدام قالب ادبی شناخته می‌شود؟", "options": ["غزل", "حماسه", "نمایشنامه", "رمان"], "correct": 0},
  {"q": "واحد SI طول؟", "options": ["متر", "لیتر", "گرم", "ثانیه"], "correct": 0},
  {"q": "کدام پرنده نمی‌تواند پرواز کند؟", "options": ["عقاب", "شترمرغ", "کبوتر", "شاهین"], "correct": 1},
  {"q": "کدام اندام خون را پمپاژ می‌کند؟", "options": ["ریه", "کبد", "قلب", "کلیه"], "correct": 2},
  {"q": "کدام ویتامین با نور خورشید مرتبط است؟", "options": ["A", "B12", "C", "D"], "correct": 3},
  {"q": "پایتخت آلمان؟", "options": ["برلین", "مونیخ", "هامبورگ", "فرانکفورت"], "correct": 0},
  {"q": "کدام زبان در برزیل رسمی است؟", "options": ["اسپانیایی", "پرتغالی", "فرانسوی", "انگلیسی"], "correct": 1},
  {"q": "۲ به توان ۵؟", "options": ["۱۰", "۲۵", "۳۲", "۶۴"], "correct": 2},
  {"q": "کدام سیاره بزرگ‌ترین حلقه قابل مشاهده را دارد؟", "options": ["زحل", "زمین", "زهره", "مریخ"], "correct": 0},
  {"q": "کدام عنصر نماد O دارد؟", "options": ["طلا", "اکسیژن", "اوسمیم", "اوزون"], "correct": 1},
  {"q": "بلندترین کوه جهان؟", "options": ["دماوند", "اورست", "K2", "آرارات"], "correct": 1},
  {"q": "پایتخت مصر؟", "options": ["قاهره", "اسکندریه", "جیزه", "لوکسور"], "correct": 0},
  {"q": "کدام حیوان نماد استرالیاست؟", "options": ["پاندا", "کانگورو", "لاما", "گوزن"], "correct": 1},
  {"q": "کدام قمر متعلق به زمین است؟", "options": ["تیتان", "اروپا", "ماه", "فوبوس"], "correct": 2},
  {"q": "یک دقیقه چند ثانیه است؟", "options": ["۳۰", "۶۰", "۹۰", "۱۲۰"], "correct": 1},
  {"q": "کدام کشور شهر استانبول را دارد؟", "options": ["ترکیه", "مصر", "گرجستان", "بلغارستان"], "correct": 0},
  {"q": "کدام فلز مایع معروف است؟", "options": ["آهن", "جیوه", "آلومینیوم", "مس"], "correct": 1},
  {"q": "کدام شکل ۳ ضلع دارد؟", "options": ["مربع", "دایره", "مثلث", "پنج‌ضلعی"], "correct": 2},
  {"q": "کدام حس با گوش مرتبط است؟", "options": ["بینایی", "شنوایی", "چشایی", "لامسه"], "correct": 1},
  {"q": "کدام ابرقاره در نظریه پانگه‌آ نام دارد؟", "options": ["پانگه‌آ", "گوندوانا", "اوراسیا", "لائوراسیا"], "correct": 0},
  {"q": "پایتخت روسیه؟", "options": ["سن‌پترزبورگ", "مسکو", "کی‌یف", "مینسک"], "correct": 1},
  {"q": "کدام ورزش با راکت و توپ زرد شناخته می‌شود؟", "options": ["تنیس", "بوکس", "کشتی", "شنا"], "correct": 0},
  {"q": "در شطرنج شاه چند خانه در هر حرکت می‌تواند برود؟", "options": ["۱", "۲", "۳", "هر تعداد"], "correct": 0},
  {"q": "کدام مهره شطرنج به شکل L حرکت می‌کند؟", "options": ["فیل", "اسب", "رخ", "وزیر"], "correct": 1},
  {"q": "کدام ماده برای فتوسنتز ضروری است؟", "options": ["نور", "آهنربا", "صدا", "نمک زیاد"], "correct": 0},
  {"q": "پایتخت کره جنوبی؟", "options": ["سئول", "بوسان", "توکیو", "پکن"], "correct": 0},
  {"q": "کدام قاره در قطب جنوب است؟", "options": ["آفریقا", "آنتارکتیکا", "اروپا", "آسیا"], "correct": 1},
  {"q": "کدام سیاره صبح و شام درخشان دیده می‌شود؟", "options": ["زهره", "نپتون", "اورانوس", "مشتری"], "correct": 0},
  {"q": "کدام عدد زوج است؟", "options": ["۱۳", "۲۱", "۳۷", "۴۲"], "correct": 3},
  {"q": "نصف ۱۰۰؟", "options": ["۲۵", "۴۰", "۵۰", "۷۵"], "correct": 2},
  {"q": "کدام رود از مصر عبور می‌کند؟", "options": ["نیل", "آمازون", "دانوب", "تایمز"], "correct": 0},
  {"q": "کدام کشور به سرزمین آفتاب تابان معروف است؟", "options": ["ژاپن", "چین", "هند", "کره"], "correct": 0},
  {"q": "کدام دستگاه برای اندازه‌گیری دماست؟", "options": ["فشارسنج", "دماسنج", "قطب‌نما", "ترازو"], "correct": 1},
  {"q": "کدام گاز برای تنفس انسان حیاتی است؟", "options": ["اکسیژن", "هلیوم", "نئون", "متان"], "correct": 0},
  {"q": "کدام استخوان در بازو قرار دارد؟", "options": ["ران", "بازو/هومروس", "درشت‌نی", "ترقوه"], "correct": 1},
  {"q": "پایتخت فرانسه؟", "options": ["پاریس", "لیون", "نیس", "مارسی"], "correct": 0},
  {"q": "کدام دانشمند قوانین حرکت را مشهور کرد؟", "options": ["نیوتن", "داروین", "پاستور", "فارادی"], "correct": 0},
  {"q": "کدام قاره دومین قاره بزرگ است؟", "options": ["آفریقا", "اروپا", "استرالیا", "جنوبگان"], "correct": 0},
  {"q": "کدام سیاره بیشترین سرعت مداری را دارد؟", "options": ["عطارد", "زمین", "زحل", "مریخ"], "correct": 0},
  {"q": "کدام جانور تخم‌گذار است؟", "options": ["گربه", "مرغ", "دلفین", "اسب"], "correct": 1},
  {"q": "کدام کشور اهرام جیزه را دارد؟", "options": ["مصر", "مکزیک", "پرو", "هند"], "correct": 0},
  {"q": "کدام رنگ معمولاً نماد ترکیب قرمز و سفید است؟", "options": ["صورتی", "سبز", "بنفش", "قهوه‌ای"], "correct": 0},
  {"q": "کدام عدد مکعب کامل است؟", "options": ["۸", "۱۰", "۱۲", "۱۴"], "correct": 0},
  {"q": "کدام ماه ۲۸ یا ۲۹ روز دارد؟", "options": ["فوریه", "ژوئن", "آگوست", "نوامبر"], "correct": 0},
  {"q": "کدام وسیله برای جهت‌یابی سنتی است؟", "options": ["قطب‌نما", "میکروسکوپ", "تلسکوپ", "تراز"], "correct": 0},
  {"q": "پایتخت هند؟", "options": ["دهلی نو", "بمبئی", "کلکته", "چنای"], "correct": 0},
  {"q": "کدام اقیانوس سردترین نواحی قطبی را دربرمی‌گیرد؟", "options": ["منجمد شمالی", "هند", "اطلس", "آرام"], "correct": 0},
  {"q": "کدام ساز کلیدهای سیاه و سفید دارد؟", "options": ["پیانو", "تنبک", "گیتار", "ساکسیفون"], "correct": 0},
  {"q": "کدام ماده از دانه‌های قهوه تهیه می‌شود؟", "options": ["قهوه", "چای", "کاکائو", "آبمیوه"], "correct": 0},
  {"q": "کدام ورزش با رینگ و دستکش شناخته می‌شود؟", "options": ["بوکس", "تنیس", "فوتبال", "گلف"], "correct": 0},
  {"q": "کدام عدد بین ۴۰ و ۵۰ اول است؟", "options": ["۴۲", "۴۳", "۴۴", "۴۶"], "correct": 1},
  {"q": "کدام کشور پایتختش لیسبون است؟", "options": ["پرتغال", "اسپانیا", "ایتالیا", "فرانسه"], "correct": 0},
  {"q": "کدام قمر سیاره زحل است؟", "options": ["تیتان", "گانیمد", "ماه", "فوبوس"], "correct": 0},
  {"q": "کدام اندام مسئول بخش بزرگی از سم‌زدایی بدن است؟", "options": ["کبد", "قلب", "پوست", "استخوان"], "correct": 0},
  {"q": "کدام ماده معمولاً در مداد گرافیتی است؟", "options": ["گرافیت", "الماس", "آهن", "نمک"], "correct": 0},
  {"q": "کدام سیاره چرخش بسیار آهسته‌ای دارد و روزش طولانی است؟", "options": ["زهره", "مریخ", "زمین", "مشتری"], "correct": 0},
  {"q": "پایتخت چین؟", "options": ["پکن", "شانگهای", "شنژن", "نانجینگ"], "correct": 0},
  {"q": "کدام جانور به تغییر رنگ معروف است؟", "options": ["آفتاب‌پرست", "فیل", "زرافه", "اسب"], "correct": 0},
  {"q": "کدام واحد انرژی در SI است؟", "options": ["ژول", "وات", "ولت", "آمپر"], "correct": 0},
  {"q": "کدام اقیانوس در غرب آمریکا قرار دارد؟", "options": ["آرام", "هند", "اطلس", "منجمد شمالی"], "correct": 0},
  {"q": "کدام کشور پایتختش وین است؟", "options": ["اتریش", "سوئیس", "بلژیک", "هلند"], "correct": 0},
  {"q": "کدام سیاره آبی‌رنگ در دوردست منظومه شمسی است؟", "options": ["نپتون", "عطارد", "زهره", "مریخ"], "correct": 0},
  {"q": "کدام حشره شش پا دارد؟", "options": ["عنکبوت", "پروانه", "هشت‌پا", "کرم"], "correct": 1},
  {"q": "کدام عدد حاصل 12÷3 است؟", "options": ["۳", "۴", "۵", "۶"], "correct": 1},
  {"q": "کدام زبان با الفبای سیریلیک در روسیه رایج است؟", "options": ["روسی", "ژاپنی", "عربی", "فارسی"], "correct": 0},
  {"q": "کدام شهر پایتخت بریتانیاست؟", "options": ["لندن", "منچستر", "لیورپول", "بریستول"], "correct": 0},
  {"q": "کدام ماده در نمک خوراکی وجود دارد؟", "options": ["سدیم و کلر", "آهن و مس", "کلسیم و اکسیژن", "کربن و هیدروژن"], "correct": 0},
  {"q": "کدام سیاره دارای لکه سرخ بزرگ است؟", "options": ["مشتری", "زحل", "اورانوس", "مریخ"], "correct": 0},
  {"q": "کدام ورزش با توپ بیضی‌شکل هم شناخته می‌شود؟", "options": ["راگبی", "بسکتبال", "والیبال", "هندبال"], "correct": 0},
  {"q": "کدام وسیله بزرگ‌نمایی اجسام ریز است؟", "options": ["میکروسکوپ", "تلسکوپ", "رادار", "قطب‌نما"], "correct": 0},
  {"q": "کدام ستاره مرکز منظومه شمسی است؟", "options": ["خورشید", "ماه", "سیریوس", "قطبی"], "correct": 0},
  {"q": "کدام کشور پایتختش آتن است؟", "options": ["یونان", "قبرس", "آلبانی", "مالت"], "correct": 0},
  {"q": "کدام پرنده نماد صلح شناخته می‌شود؟", "options": ["کبوتر", "کلاغ", "عقاب", "جغد"], "correct": 0},
  {"q": "کدام عدد اول است؟", "options": ["۲۱", "۲۷", "۲۹", "۳۳"], "correct": 2},
  {"q": "کدام اقیانوس شرق آفریقاست؟", "options": ["هند", "آرام", "اطلس", "شمالگان"], "correct": 0}
];

function startQuizGame() {
  const questions = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 10);
  let index = 0;
  let score = 0;
  renderQuestion();

  function renderQuestion() {
    if (index >= questions.length) {
      openGameModal(`<h3>🎉 کوییز تموم شد!</h3><p>${score} تا از ${questions.length} سوال رو درست جواب دادی.</p>`);
      const reward = score * 20;
      addCoins(reward).then(() => showToast(`${reward} سکه گرفتی ❓`));
      return;
    }
    const q = questions[index];
    openGameModal(`
      <h3>❓ سوال ${index + 1} از ${questions.length}</h3>
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

// ===================== STAR CATCH =====================
function startStarCatchGame() {
  openGameModal(`
    <h3>⭐ ستاره‌گیری</h3>
    <p>۱۵ ثانیه وقت داری. روی ستاره‌ها کلیک کن!</p>
    <p>امتیاز: <strong id="starScore">0</strong> | زمان: <strong id="starTime">15</strong></p>
    <div class="starcatch-area" id="starArea"></div>
  `);
  const area = document.getElementById('starArea');
  let score = 0;
  let timeLeft = 15;
  let running = true;

  const timerId = setInterval(() => {
    timeLeft--;
    document.getElementById('starTime').textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);

  const spawnId = setInterval(() => {
    if (!running) return;
    const star = document.createElement('div');
    star.className = 'falling-star';
    star.textContent = Math.random() < 0.15 ? '💎' : '⭐';
    star.style.left = Math.random() * 85 + '%';
    star.style.animationDuration = (1.5 + Math.random()) + 's';
    star.addEventListener('click', () => {
      score += star.textContent === '💎' ? 5 : 1;
      document.getElementById('starScore').textContent = score;
      star.remove();
    });
    star.addEventListener('animationend', () => star.remove());
    area.appendChild(star);
  }, 400);

  async function endGame() {
    if (!running) return;
    running = false;
    clearInterval(timerId);
    clearInterval(spawnId);
    const reward = score * 4;
    gameModalBody.innerHTML = `<h3>🎉 تموم شد!</h3><p>${score} ستاره گرفتی.</p>`;
    await addCoins(reward);
    showToast(`${reward} سکه گرفتی ⭐`);
  }
}

// ===================== WHACK A MOLE =====================
function startWhackAMoleGame() {
  openGameModal(`
    <h3>🔨 موش بزن</h3>
    <p>۱۵ ثانیه وقت داری. موش رو بزن قبل از قایم شدنش!</p>
    <p>امتیاز: <strong id="moleScore">0</strong> | زمان: <strong id="moleTime">15</strong></p>
    <div class="mole-grid" id="moleGrid"></div>
  `);
  const grid = document.getElementById('moleGrid');
  let score = 0;
  let timeLeft = 15;
  let running = true;
  const holes = [];

  for (let i = 0; i < 9; i++) {
    const hole = document.createElement('div');
    hole.className = 'mole-hole';
    hole.addEventListener('click', () => {
      if (hole.classList.contains('up')) {
        score++;
        document.getElementById('moleScore').textContent = score;
        hole.classList.remove('up');
        hole.textContent = '';
      }
    });
    grid.appendChild(hole);
    holes.push(hole);
  }

  const timerId = setInterval(() => {
    timeLeft--;
    document.getElementById('moleTime').textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);

  const popId = setInterval(() => {
    if (!running) return;
    holes.forEach(h => { h.classList.remove('up'); h.textContent = ''; });
    const hole = holes[Math.floor(Math.random() * holes.length)];
    hole.classList.add('up');
    hole.textContent = '🐭';
  }, 700);

  async function endGame() {
    if (!running) return;
    running = false;
    clearInterval(timerId);
    clearInterval(popId);
    const reward = score * 6;
    gameModalBody.innerHTML = `<h3>🎉 تموم شد!</h3><p>${score} تا موش زدی.</p>`;
    await addCoins(reward);
    showToast(`${reward} سکه گرفتی 🔨`);
  }
}

// ===================== ROCK PAPER SCISSORS =====================
function startRPSGame() {
  let wins = 0, rounds = 0;
  renderRound();

  function renderRound() {
    if (rounds >= 3) {
      const reward = wins * 25;
      openGameModal(`<h3>🎉 تموم شد!</h3><p>${wins} از ۳ دست رو بردی.</p>`);
      addCoins(reward).then(() => showToast(`${reward} سکه گرفتی ✂️`));
      return;
    }
    openGameModal(`
      <h3>✂️ سنگ کاغذ قیچی</h3>
      <p>دست ${rounds + 1} از ۳ — یکی رو انتخاب کن</p>
      <div class="rps-options">
        <button class="btn btn-outline" data-choice="🪨">🪨</button>
        <button class="btn btn-outline" data-choice="📄">📄</button>
        <button class="btn btn-outline" data-choice="✂️">✂️</button>
      </div>
      <p id="rpsResult"></p>
    `);
    document.querySelectorAll('[data-choice]').forEach(btn => {
      btn.addEventListener('click', () => {
        const options = ['🪨', '📄', '✂️'];
        const player = btn.dataset.choice;
        const comp = options[Math.floor(Math.random() * 3)];
        let resultText;
        if (player === comp) resultText = `مساوی شد! (${comp})`;
        else if (
          (player === '🪨' && comp === '✂️') ||
          (player === '📄' && comp === '🪨') ||
          (player === '✂️' && comp === '📄')
        ) { wins++; resultText = `بردی! کامپیوتر ${comp} زد 🎉`; }
        else resultText = `باختی! کامپیوتر ${comp} زد`;

        document.getElementById('rpsResult').textContent = resultText;
        rounds++;
        setTimeout(renderRound, 1100);
      });
    });
  }
}

// ===================== NUMBER GUESS =====================
function startGuessGame() {
  const target = 1 + Math.floor(Math.random() * 50);
  let tries = 0;

  openGameModal(`
    <h3>🔢 حدس عدد</h3>
    <p>یه عدد بین ۱ تا ۵۰ تو ذهن دارم. حدس بزن!</p>
    <div style="display:flex;gap:8px;justify-content:center;margin:16px 0;">
      <input type="number" id="guessInput" min="1" max="50" style="width:100px;">
      <button class="btn btn-secondary" id="guessBtn">حدس بزن</button>
    </div>
    <p id="guessFeedback"></p>
  `);

  document.getElementById('guessBtn').addEventListener('click', async () => {
    const val = parseInt(document.getElementById('guessInput').value, 10);
    if (!val) return;
    tries++;
    const feedback = document.getElementById('guessFeedback');
    if (val === target) {
      const reward = Math.max(15, 100 - tries * 10);
      feedback.textContent = `🎉 درست حدس زدی! (${tries} تلاش)`;
      await addCoins(reward);
      showToast(`${reward} سکه گرفتی 🔢`);
      document.getElementById('guessBtn').disabled = true;
    } else if (val < target) {
      feedback.textContent = '⬆️ عدد بزرگ‌تره';
    } else {
      feedback.textContent = '⬇️ عدد کوچیک‌تره';
    }
  });
}

// ===================== COIN FLIP (GAMBLE) =====================
function startCoinFlipGame() {
  openGameModal(`
    <h3>🎰 شیر یا خط</h3>
    <p>یه مقدار سکه شرط ببند. اگه درست حدس بزنی دو برابرش می‌گیری، وگرنه از دست می‌دیش.</p>
    <div style="display:flex;gap:8px;justify-content:center;margin:16px 0;flex-wrap:wrap;">
      <input type="number" id="betAmount" placeholder="مقدار شرط" min="1" style="width:120px;">
      <button class="btn btn-secondary" data-side="شیر">شیر 🪙</button>
      <button class="btn btn-secondary" data-side="خط">خط 🪙</button>
    </div>
    <p id="flipResult"></p>
  `);

  document.querySelectorAll('[data-side]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bet = parseInt(document.getElementById('betAmount').value, 10);
      if (!bet || bet <= 0) { showToast('یه مقدار درست وارد کن'); return; }
      if (bet > state.profile.coins) { showToast('این‌قدر سکه نداری'); return; }

      const result = Math.random() < 0.5 ? 'شیر' : 'خط';
      const won = result === btn.dataset.side;
      const resultBox = document.getElementById('flipResult');
      if (won) {
        resultBox.textContent = `🎉 ${result} اومد! بردی!`;
        await addCoins(bet);
        showToast(`${bet} سکه بردی 🎰`);
      } else {
        resultBox.textContent = `😅 ${result} اومد. باختی.`;
        await addCoins(-bet);
        showToast(`${bet} سکه باختی`);
      }
    });
  });
}

// ===================== TIC TAC TOE =====================
function startTicTacToeGame() {
  let board = Array(9).fill(null);
  let over = false;

  openGameModal(`
    <h3>⭕ دوز</h3>
    <p>تو ❌ هستی، کامپیوتر ⭕ ـه.</p>
    <div class="ttt-grid" id="tttGrid"></div>
    <p id="tttResult"></p>
  `);

  const grid = document.getElementById('tttGrid');
  board.forEach((_, i) => {
    const cell = document.createElement('div');
    cell.className = 'ttt-cell';
    cell.dataset.index = i;
    cell.addEventListener('click', () => playerMove(i, cell));
    grid.appendChild(cell);
  });

  function checkWinner(b) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b2,c] of lines) {
      if (b[a] && b[a] === b[b2] && b[a] === b[c]) return b[a];
    }
    if (b.every(v => v)) return 'draw';
    return null;
  }

  async function playerMove(i, cell) {
    if (over || board[i]) return;
    board[i] = '❌';
    cell.textContent = '❌';
    let winner = checkWinner(board);
    if (winner) return finish(winner);

    // simple computer move: win, block, or random
    const compIndex = pickComputerMove();
    board[compIndex] = '⭕';
    grid.children[compIndex].textContent = '⭕';
    winner = checkWinner(board);
    if (winner) return finish(winner);
  }

  function pickComputerMove() {
    const empty = board.map((v, i) => v ? null : i).filter(v => v !== null);
    // try to win
    for (const i of empty) {
      const copy = [...board]; copy[i] = '⭕';
      if (checkWinner(copy) === '⭕') return i;
    }
    // block player
    for (const i of empty) {
      const copy = [...board]; copy[i] = '❌';
      if (checkWinner(copy) === '❌') return i;
    }
    return empty[Math.floor(Math.random() * empty.length)];
  }

  async function finish(winner) {
    over = true;
    const resultBox = document.getElementById('tttResult');
    if (winner === '❌') {
      resultBox.textContent = '🎉 بردی!';
      await addCoins(50);
      showToast('۵۰ سکه گرفتی ⭕');
    } else if (winner === '⭕') {
      resultBox.textContent = '😅 کامپیوتر برد.';
    } else {
      resultBox.textContent = '🤝 مساوی شد.';
      await addCoins(10);
      showToast('۱۰ سکه گرفتی 🤝');
    }
  }
}


// ===================== KOLEGAME WHEEL =====================
function startWheelGame() {
  openGameModal(`
    <div class="game-modal-hero"><div class="wheel" id="wheelVisual">🎡</div><h3>گردونه KoleGame</h3>
    <p>هر ۶ ساعت یک اسپین رایگان. نتیجه سمت سرور تعیین میشه.</p>
    <button class="btn btn-primary btn-lg" id="spinWheelBtn">بچرخون 🎡</button><p id="wheelResult"></p></div>`);
  document.getElementById('spinWheelBtn').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    const visual = document.getElementById('wheelVisual'); visual.classList.add('spinning');
    const { data, error } = await spinWheel();
    visual.classList.remove('spinning');
    if (error) { e.currentTarget.disabled = false; showToast(error.message.includes('wheel_cooldown') ? 'گردونه هنوز آماده نیست ⏳' : 'گردونه فعلاً در دسترس نیست'); return; }
    document.getElementById('wheelResult').textContent = `🎉 ${data.label} برنده شدی!`;
    await refreshEconomy();
  });
}

// ===================== 6-HOUR LOTTERY =====================
async function refreshLotteryUI() {
  const stateBox = document.getElementById('lotteryState'); if (!stateBox || !state.user) return;
  const { data, error } = await getLotteryState();
  if (error) { stateBox.textContent = 'برای استفاده از لاتاری باید migration جدید دیتابیس رو اجرا کنی.'; return; }
  const next = new Date(data.next_draw);
  const diff = Math.max(0, next - Date.now());
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
  stateBox.innerHTML = `🎟️ بلیت‌های تو: <strong>${data.my_tickets}</strong> | کل بلیت‌ها: <strong>${data.total_tickets}</strong><br>⏳ قرعه‌کشی بعدی: <strong>${h}س ${m}د</strong>`;
}
function startLotteryGame() {
  openGameModal(`<h3>🎟️ لاتاری ۶ ساعته</h3>
    <p>هر بلیت <strong>۵۰ KoleCoin</strong> است. بلیت بیشتر = احتمال بیشتر.</p>
    <div class="lottery-ball">🎟️</div>
    <div class="ticket-row"><input id="ticketCount" type="number" min="1" max="100" value="1"><button class="btn btn-primary" id="buyTicketsBtn">خرید بلیت</button></div>
    <div id="lotteryState" class="info-box">در حال دریافت وضعیت...</div><p id="lotteryResult"></p>`);
  refreshLotteryUI();
  document.getElementById('buyTicketsBtn').addEventListener('click', async (e) => {
    const n = Math.max(1, Math.min(100, parseInt(document.getElementById('ticketCount').value, 10) || 1));
    e.currentTarget.disabled = true;
    const { data, error } = await buyLotteryTickets(n);
    e.currentTarget.disabled = false;
    if (error) { showToast(error.message.includes('not enough') ? 'KoleCoin کافی نداری' : 'لاتاری در دسترس نیست'); return; }
    await refreshEconomy(); refreshLotteryUI();
    document.getElementById('lotteryResult').textContent = `✅ ${n} بلیت خریدی؛ هزینه: ${data.cost} KoleCoin`;
    showToast('بلیت‌ها با موفقیت ثبت شدن 🎟️');
  });
  // Finalize the previous 6-hour slot when someone visits.
  tryLotteryDraw().then(async ({data}) => {
    if (data?.drawn && data.winner_id === state.user?.id) { await refreshEconomy(); showToast(`🏆 برنده لاتاری شدی! ${data.prize} KoleCoin!`); }
    refreshLotteryUI();
  });
}

// ===================== CASINO HUB (VIRTUAL COINS ONLY) =====================
async function casinoPlay(game, bet) {
  const { data, error } = await sb.rpc('casino_bet', { p_game: game, p_bet: Math.floor(bet) });
  if (!error && data) await refreshEconomy();
  return {data, error};
}
function startCasinoHub() {
  openGameModal(`<h3>🎰 کازینو KoleGame</h3><p>فقط با <strong>KoleCoin مجازی</strong>. هیچ پول واقعی در کار نیست.</p>
    <input id="casinoBet" type="number" min="1" placeholder="مقدار شرط" class="wide-input">
    <div class="casino-grid"><button class="casino-tile" data-casino="coinflip">🪙<span>شیر یا خط<br><small>x2</small></span></button><button class="casino-tile" data-casino="dice">🎲<span>تاس<br><small>x5</small></span></button><button class="casino-tile" data-casino="slots">🎰<span>اسلات<br><small>x2 تا x10</small></span></button></div>
    <p id="casinoResult"></p>`);
  document.querySelectorAll('[data-casino]').forEach(btn => btn.addEventListener('click', async () => {
    const bet = parseInt(document.getElementById('casinoBet').value,10);
    if (!bet || bet < 1 || bet > Number(state.profile.coins)) { showToast('مقدار شرط درست نیست'); return; }
    btn.disabled = true;
    const {data,error}=await casinoPlay(btn.dataset.casino,bet); btn.disabled=false;
    if(error){showToast(error.message.includes('not enough')?'KoleCoin کافی نداری':'کازینو در دسترس نیست');return;}
    const sign=data.net>=0?'+':'';
    document.getElementById('casinoResult').textContent=`${data.result==='win'?'🎉 بردی':'😅 باختی'} — ضریب ${data.multiplier} — ${sign}${data.net} KoleCoin`;
  }));
}

// ===================== AIM GAME =====================
function startAimGame() {
  openGameModal(`<h3>🎯 تیراندازی هدف</h3><p>۲۰ ثانیه وقت داری. هدف‌های متحرک رو بزن.</p><div class="aim-arena" id="aimArena"></div><p>امتیاز: <strong id="aimScore">0</strong> | زمان: <strong id="aimTime">20</strong></p>`);
  const arena=document.getElementById('aimArena'); let score=0,time=20,running=true;
  const timer=setInterval(()=>{time--; const el=document.getElementById('aimTime'); if(el)el.textContent=time;if(time<=0)end();},1000);
  const spawn=setInterval(()=>{if(!running)return; const t=document.createElement('button');t.className='aim-target';t.textContent=['🎯','💎','⭐'][Math.floor(Math.random()*3)];t.style.left=Math.random()*85+'%';t.style.top=Math.random()*75+'%';t.onclick=()=>{if(!running)return;score++;document.getElementById('aimScore').textContent=score;t.remove();};arena.appendChild(t);setTimeout(()=>t.remove(),900);},450);
  function end(){if(!running)return;running=false;clearInterval(timer);clearInterval(spawn);const reward=score*7;gameModalBody.innerHTML=`<h3>🎯 رکوردت ثبت شد!</h3><p>${score} هدف زدی و ${reward} KoleCoin گرفتی.</p>`;addCoins(reward);}
}

// ===================== SEQUENCE GAME =====================
function startSequenceGame(){
  let round=1,score=0;
  const next=()=>{const len=Math.min(3+round,8),start=1+Math.floor(Math.random()*30),step=1+Math.floor(Math.random()*7);const seq=Array.from({length:len},(_,i)=>start+i*step);const hidden=Math.floor(Math.random()*len);const answer=seq[hidden];seq[hidden]='?';openGameModal(`<h3>🧩 عدد گمشده — راند ${round}/5</h3><p class="sequence">${seq.join('  •  ')}</p><input id="seqInput" type="number" class="wide-input" placeholder="عدد گمشده"><button id="seqBtn" class="btn btn-primary">ثبت جواب</button><p id="seqResult"></p>`);document.getElementById('seqBtn').onclick=async()=>{const val=Number(document.getElementById('seqInput').value);if(val===answer){score++;showToast('درست بود ✅');}else showToast(`جواب ${answer} بود`);round++;if(round>5){const reward=score*35;openGameModal(`<h3>🧩 تموم شد</h3><p>${score}/5 درست — ${reward} KoleCoin</p>`);await addCoins(reward);}else next();};};next();
}

// ===================== ROCKET ESCAPE =====================
function startRocketGame(){let round=0,wins=0;const draw=()=>{round++;if(round>5){const reward=wins*45;openGameModal(`<h3>🚀 ماموریت تمام شد</h3><p>${wins}/5 مسیر امن رو انتخاب کردی.</p>`);addCoins(reward);return;}const safe=Math.floor(Math.random()*3);openGameModal(`<h3>🚀 فرار موشکی — مرحله ${round}/5</h3><p>یکی از سه مسیر امنه. انتخاب کن!</p><div class="rocket-paths">${[0,1,2].map(i=>`<button class="rocket-path" data-path="${i}">${['🌌','☄️','🪐'][i]}</button>`).join('')}</div><p id="rocketResult"></p>`);document.querySelectorAll('[data-path]').forEach(b=>b.onclick=()=>{const ok=Number(b.dataset.path)===safe;if(ok){wins++;document.getElementById('rocketResult').textContent='🚀 مسیر امن بود!';}else document.getElementById('rocketResult').textContent='💥 برخورد!';document.querySelectorAll('[data-path]').forEach(x=>x.disabled=true);setTimeout(draw,600);});};draw();}

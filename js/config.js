// ===== Supabase connection =====
// این دو مقدار رو از Project Settings سوپابیس گرفتیم.
const SUPABASE_URL = "https://zlmbqwsbtshqupupaamn.supabase.co";
const SUPABASE_KEY = "sb_publishable_8VWeS0mPtVkF-JS7QNhdMQ_m_AAHgqh";

// supabase-js از CDN یه آبجکت گلوبال به اسم `supabase` می‌سازه که createClient داره.
// ما نتیجه رو تو متغیر sb می‌ریزیم تا با اسم کتابخونه قاطی نشه.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// Expose the client for modules loaded from separate script files.
window.sb = sb;
window.KG_SUPABASE = sb;

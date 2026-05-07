(() => {
  const REQUIRED_KEYS = [
    'pulse_txs',
    'pulse_goals',
    'pulse_budgets',
    'pulse_ach',
    'pulse_xp',
    'pulse_streak',
    'pulse_compare_month',
    'pulse_calendar_month',
    'pulse_closure_month',
    'pulse_month_closures',
    'pulse_ignored_recurring',
    'pulse_left_rail_collapsed'
  ];

  const userEmail = (localStorage.getItem('pulse_user') || '').toLowerCase();
  const isAuthed = localStorage.getItem('pulse_auth') === '1';
  const hasConfig = Boolean(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase);
  if (!isAuthed || !userEmail || !hasConfig) return;

  const { createClient } = window.supabase;
  const client = window.__sbClient || (window.__sbClient = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  }));

  const REMOTE_UPDATED_AT_KEY = 'pulse_remote_updated_at';

  const writePayload = (payload) => {
    if (!payload || typeof payload !== 'object') return;
    for (const k of REQUIRED_KEYS) {
      if (Object.prototype.hasOwnProperty.call(payload, k)) {
        localStorage.setItem(k, String(payload[k]));
      }
    }
  };

  const pullFromSupabase = async () => {
    const { data, error } = await client
      .from('app_user_state')
      .select('payload, updated_at')
      .eq('user_email', userEmail)
      .maybeSingle();
    if (error || !data || !data.payload) return;

    const remoteUpdated = new Date(data.updated_at || 0).getTime();
    const localUpdated = new Date(localStorage.getItem(REMOTE_UPDATED_AT_KEY) || 0).getTime();
    if (remoteUpdated > localUpdated) {
      writePayload(data.payload);
      localStorage.setItem(REMOTE_UPDATED_AT_KEY, data.updated_at || new Date().toISOString());
      location.reload();
    }
  };

  pullFromSupabase();
  setInterval(pullFromSupabase, 8000);
})();


// Supabase client — chiavi pubbliche (anon key è sicura lato client, RLS protegge i dati)
// Sostituisci SUPABASE_URL e SUPABASE_ANON_KEY con i valori del tuo progetto Supabase:
//   Dashboard → Settings → API → Project URL e anon/public key

const SUPABASE_URL      = 'https://qpmwcydwsbfztxkivndk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwbXdjeWR3c2JmenR4a2l2bmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDk2MzMsImV4cCI6MjA5NzM4NTYzM30.tdVGw4SAqUoHKeNi7CSvxidsg_XljDrGFPZtfIkEl2U';

window._sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

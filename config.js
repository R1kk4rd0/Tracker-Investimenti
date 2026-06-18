// Supabase client — chiavi pubbliche (anon key è sicura lato client, RLS protegge i dati)
// Sostituisci SUPABASE_URL e SUPABASE_ANON_KEY con i valori del tuo progetto Supabase:
//   Dashboard → Settings → API → Project URL e anon/public key

const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';

window._sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

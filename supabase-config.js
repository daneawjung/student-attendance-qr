// Supabase client configuration for the browser.
// This is the public/anon key. Database security must be enforced with RLS policies.
const SUPABASE_URL = "https://dhtunofeprtinbrhflca.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRodHVub2ZlcHJ0aW5icmhmbGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTQ2NDcsImV4cCI6MjEwMzU5MDY0N30.2wNCnCoyy_tZT3D5_Fcb6jrOlZfzisaKL5oU67h4Bmg";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

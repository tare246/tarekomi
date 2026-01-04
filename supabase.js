alert("supabase.js loaded");

console.log("window.supabase =", window.supabase);

window.supabaseClient = window.supabase
  ? window.supabase.createClient(
      "https://vitquesksoyacvlhkcdm.supabase.co",
      "sb_publishable_mZXmp9RS7CNc78pACHRvnQ_gGEsjVgp"
    )
  : null;

console.log("window.supabaseClient =", window.supabaseClient);


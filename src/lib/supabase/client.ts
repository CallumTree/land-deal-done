// Browser Supabase client, wired to the existing (retained) Supabase project.
//
// Auth model: anonymous sign-in, not a login screen. Every visitor gets a
// real `auth.uid()` via `signInAnonymously()` with no credentials — new
// tables use owner-scoped RLS (`user_id = auth.uid()`, NOT NULL) keyed off
// that id. An anonymous user can later be upgraded to a full account
// (Supabase's `updateUser`/identity-linking keeps the same `auth.uid()`),
// so nothing here is designed around auth never existing — it's designed
// so persistence doesn't have to wait for a login screen to be built.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazily instantiated so a build with no env vars configured yet (e.g. a
// preview build before secrets are set) doesn't crash at module load / Next's
// static-prerender pass — it only throws when actually used in the browser.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — set them in .env.local (see .env.example)."
    );
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});

/**
 * Ensure the current browser has a Supabase session, signing in
 * anonymously if it doesn't. Safe to call on every page load — Supabase
 * persists the session in localStorage, so this is a no-op after the
 * first visit until the session is explicitly signed out or upgraded.
 */
export async function ensureSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

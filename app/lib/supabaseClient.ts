"use client";

export type GameRow = {
  code: string;
  songs: string[];          // array of song labels
  current_index: number;    // index of current song
  revealed: boolean;        // is current song revealed
  pattern?: string | null;  // bingo pattern (regular/outside/l/t/x/full)
  created_at?: string;
  updated_at?: string;
};

type SupaErr = { message: string; status?: number; raw?: any };

function supabaseBase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return {
      ok: false as const,
      error: { message: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY" } as SupaErr,
    };
  }
  return { ok: true as const, url, anon };
}

function headers(anon: string, extra?: Record<string, string>) {
  return {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Helpful when Supabase returns HTML or empty/non-JSON responses
    return { __non_json__: true, text };
  }
}

/**
 * Fetch one game row by code
 */
export async function fetchGameByCode(code: string): Promise<{ data: GameRow | null; error: SupaErr | null }> {
  const base = supabaseBase();
  if (!base.ok) return { data: null, error: base.error };

  const { url, anon } = base;
  const endpoint = `${url}/rest/v1/games?code=eq.${encodeURIComponent(code)}&select=*`;

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: headers(anon),
      cache: "no-store",
    });

    const json = await safeJson(res);

    if (!res.ok) {
      return {
        data: null,
        error: {
          message:
            json?.message ||
            (json?.__non_json__ ? `Invalid JSON from Supabase: ${json.text}` : `Supabase error ${res.status}`),
          status: res.status,
          raw: json,
        },
      };
    }

    const rows = Array.isArray(json) ? (json as GameRow[]) : [];
    return { data: rows[0] ?? null, error: null };
  } catch (e: any) {
    return { data: null, error: { message: e?.message || "Network error", raw: e } };
  }
}

/**
 * Upsert a game (insert if new, update if exists)
 * NOTE: pattern is allowed (fixes your red underline)
 */
export async function upsertGame(input: {
  code: string;
  songs: string[];
  current_index: number;
  revealed: boolean;
  pattern?: string; // ✅ allow pattern
}): Promise<{ data: GameRow | null; error: SupaErr | null }> {
  const base = supabaseBase();
  if (!base.ok) return { data: null, error: base.error };

  const { url, anon } = base;
  const endpoint = `${url}/rest/v1/games`;

  // Build payload (only include pattern if provided)
  const payload: any = {
    code: input.code,
    songs: input.songs,
    current_index: input.current_index,
    revealed: input.revealed,
  };
  if (typeof input.pattern === "string") payload.pattern = input.pattern;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: headers(anon, {
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify(payload),
    });

    const json = await safeJson(res);

    if (!res.ok) {
      return {
        data: null,
        error: {
          message:
            json?.message ||
            (json?.__non_json__ ? `Invalid JSON from Supabase: ${json.text}` : `Supabase error ${res.status}`),
          status: res.status,
          raw: json,
        },
      };
    }

    const rows = Array.isArray(json) ? (json as GameRow[]) : [];
    return { data: rows[0] ?? null, error: null };
  } catch (e: any) {
    return { data: null, error: { message: e?.message || "Network error", raw: e } };
  }
}

/**
 * Update just the live state (what song index + revealed)
 * (pattern does NOT go here)
 */
export async function updateGameState(
  code: string,
  current_index: number,
  revealed: boolean
): Promise<{ error: SupaErr | null }> {
  const base = supabaseBase();
  if (!base.ok) return { error: base.error };

  const { url, anon } = base;
  const endpoint = `${url}/rest/v1/games?code=eq.${encodeURIComponent(code)}`;

  try {
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: headers(anon, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify({ current_index, revealed }),
    });

    const json = await safeJson(res);

    if (!res.ok) {
      return {
        error: {
          message:
            json?.message ||
            (json?.__non_json__ ? `Invalid JSON from Supabase: ${json.text}` : `Supabase error ${res.status}`),
          status: res.status,
          raw: json,
        },
      };
    }

    return { error: null };
  } catch (e: any) {
    return { error: { message: e?.message || "Network error", raw: e } };
  }
}

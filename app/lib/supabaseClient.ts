"use client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const restUrl = `${supabaseUrl}/rest/v1`;

export type GameRow = {
  code: string;
  songs: string[];
  current_index: number;
  revealed: boolean;
};

export type SupabaseError = { message: string };

async function restRequest<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T | null; error: SupabaseError | null }> {
  const res = await fetch(`${restUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    } as any,
  });

  if (!res.ok) {
    let msg: string;
    try {
      const text = await res.text();
      msg = text || res.statusText;
    } catch {
      msg = res.statusText;
    }
    return { data: null, error: { message: msg } };
  }

  try {
    const data = (await res.json()) as T;
    return { data, error: null };
  } catch {
    return { data: null, error: { message: "Invalid JSON from Supabase" } };
  }
}

export async function upsertGame(
  row: GameRow
): Promise<{ error: SupabaseError | null }> {
  const { error } = await restRequest<GameRow[]>(
    "/games",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(row),
    }
  );
  return { error };
}

export async function updateGameState(
  code: string,
  current_index: number,
  revealed: boolean
): Promise<{ error: SupabaseError | null }> {
  const params = new URLSearchParams();
  params.set("code", `eq.${code}`);

  const { error } = await restRequest<GameRow[]>(
    `/games?${params.toString()}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ current_index, revealed }),
    }
  );

  return { error };
}

export async function fetchGameByCode(
  code: string
): Promise<{ data: GameRow | null; error: SupabaseError | null }> {
  const params = new URLSearchParams();
  params.set("code", `eq.${code}`);
  params.set("select", "code,songs,current_index,revealed");
  params.set("limit", "1");

  const { data, error } = await restRequest<GameRow[]>(
    `/games?${params.toString()}`
  );

  if (error) return { data: null, error };
  if (!data || data.length === 0) return { data: null, error: null };
  return { data: data[0], error: null };
}

export async function listGames(
  limit = 10
): Promise<{ data: GameRow[]; error: SupabaseError | null }> {
  const params = new URLSearchParams();
  params.set("select", "code,songs,current_index,revealed");
  params.set("order", "created_at.desc");
  params.set("limit", String(limit));

  const { data, error } = await restRequest<GameRow[]>(
    `/games?${params.toString()}`
  );

  return { data: data || [], error };
}

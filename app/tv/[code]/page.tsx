"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { fetchGameByCode } from "../../lib/supabaseClient";
import type { GameRow } from "../../lib/supabaseClient";

// Song title only (strip artist if label is "Artist - Song")
function songOnly(label: string) {
  const raw = (label || "").trim();
  const parts = raw.split(" - ");
  const out = parts.length > 1 ? parts.slice(1).join(" - ") : raw;
  return out.replace(/\s+/g, " ").trim();
}

export default function TvPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toString().toUpperCase();

  const [game, setGame] = useState<GameRow | null>(null);
  const [status, setStatus] = useState<string>("Loading...");

  // Poll game state
  useEffect(() => {
    if (!code) return;

    let alive = true;

    const load = async () => {
      const { data, error } = await fetchGameByCode(code);
      if (!alive) return;

      if (error) {
        setStatus("Failed to load game.");
        setGame(null);
        return;
      }

      if (!data) {
        setStatus("Game not found.");
        setGame(null);
        return;
      }

      setStatus("");
      setGame(data);
    };

    load();
    const id = setInterval(load, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [code]);

  const currentSong = useMemo(() => {
    if (!game) return null;
    const idx = game.current_index;
    if (!game.revealed) return null;
    if (idx < 0 || idx >= game.songs.length) return null;
    return songOnly(game.songs[idx]);
  }, [game]);

  const playedList = useMemo(() => {
    if (!game) return [];
    const last = game.revealed ? game.current_index : game.current_index - 1;
    if (last < 0) return [];
    return game.songs.slice(0, last + 1).map(songOnly);
  }, [game]);

  if (!code) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P']">
        No code in URL.
      </main>
    );
  }

  return (
    <main
      className="min-h-screen relative overflow-hidden text-white font-['Press_Start_2P']"
      style={{
        backgroundImage: "url(/logo.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "black",
      }}
    >
      {/* overlay for readability */}
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative z-10 min-h-screen p-6">
        {/* TOP */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="text-[10px] opacity-75 mb-2">SHOW THIS CODE TO JOIN</div>

          <div className="text-6xl md:text-7xl tracking-[0.55em] bg-black/80 px-8 py-6 rounded-2xl border-2 border-cyan-400 shadow-[0_0_26px_#22d3ee]">
            {code}
          </div>
        </div>

        {/* MAIN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-6 items-stretch">
          {/* LEFT: NOW PLAYING */}
          <div className="bg-black/70 border-2 border-fuchsia-400/70 rounded-2xl p-6 shadow-[0_0_28px_rgba(217,70,239,0.35)] flex flex-col justify-center">
            <div className="text-center text-xl md:text-2xl mb-4">NOW PLAYING</div>

            {status && !game && (
              <div className="text-center text-sm opacity-80">{status}</div>
            )}

            {game && !game.revealed && (
              <div className="text-center text-lg opacity-80">
                Song is hidden…
              </div>
            )}

            {game && game.revealed && (
              <div className="text-center text-2xl md:text-4xl leading-snug break-words">
                {currentSong ?? "—"}
              </div>
            )}
          </div>

          {/* RIGHT: PLAYED SONGS (2 columns) */}
          <div className="bg-black/70 border-2 border-cyan-400/70 rounded-2xl p-5 shadow-[0_0_28px_rgba(34,211,238,0.35)] flex flex-col">
            <div className="text-center text-xl mb-3">SONGS PLAYED</div>

            {playedList.length === 0 ? (
              <div className="text-center text-sm opacity-75">
                No songs played yet.
              </div>
            ) : (
              <div
                className="flex-1 overflow-y-auto pr-2"
                style={{
                  // ✅ 2 columns
                  columnCount: 2,
                  columnGap: "18px",
                }}
              >
                {playedList.map((title, idx) => (
                  <div
                    key={`${idx}-${title}`}
                    className="break-inside-avoid mb-2 border-b border-white/10 pb-2"
                  >
                    <div className="text-[10px] text-white/60 mb-1">
                      {idx + 1}.
                    </div>
                    <div className="text-xs md:text-sm leading-snug break-words">
                      {title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

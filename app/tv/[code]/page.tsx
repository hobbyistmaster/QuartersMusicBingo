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
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative z-10 min-h-screen p-6">
        {/* 50/50 split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[calc(100vh-3rem)]">
          {/* LEFT HALF: 30% CODE / 70% NOW PLAYING */}
          <div className="grid grid-rows-[3fr_7fr] gap-6">
            {/* Code (30%) */}
            <div className="bg-black/70 border-2 border-cyan-400/70 rounded-2xl p-5 shadow-[0_0_28px_rgba(34,211,238,0.35)] flex flex-col justify-center">
              <div className="text-center text-[10px] opacity-75 mb-2">
                SHOW THIS CODE TO JOIN
              </div>
              <div className="flex justify-center">
                <div className="text-5xl md:text-6xl tracking-[0.55em] bg-black/80 px-8 py-5 rounded-2xl border-2 border-cyan-400 shadow-[0_0_22px_#22d3ee]">
                  {code}
                </div>
              </div>
            </div>

            {/* Now Playing (70%) */}
            <div className="bg-black/70 border-2 border-fuchsia-400/70 rounded-2xl p-6 shadow-[0_0_28px_rgba(217,70,239,0.35)] flex flex-col justify-center">
              <div className="text-center text-lg md:text-xl mb-4">NOW PLAYING</div>

              {status && !game && (
                <div className="text-center text-sm opacity-80">{status}</div>
              )}

              {game && !game.revealed && (
                <div className="text-center text-base md:text-lg opacity-80">
                  Song is hidden…
                </div>
              )}

              {game && game.revealed && (
                <div className="text-center text-2xl md:text-4xl leading-snug break-words px-2">
                  {currentSong ?? "—"}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT HALF: SONGS PLAYED - 3 columns, row-wise 1-3 then 4-6 */}
          <div className="bg-black/70 border-2 border-cyan-400/70 rounded-2xl p-5 shadow-[0_0_28px_rgba(34,211,238,0.35)] flex flex-col">
            <div className="text-center text-lg md:text-xl mb-3">SONGS PLAYED</div>

            {playedList.length === 0 ? (
              <div className="text-center text-sm opacity-75">
                No songs played yet.
              </div>
            ) : (
              <ol className="flex-1 overflow-y-auto pr-2 grid grid-cols-3 gap-x-6 gap-y-2">
                {playedList.map((title, idx) => (
                  <li
                    key={`${idx}-${title}`}
                    className="border-b border-white/10 pb-2"
                  >
                    <div className="text-[10px] text-white/60 mb-1">
                      {idx + 1}.
                    </div>
                    <div className="text-xs md:text-sm leading-snug break-words">
                      {title}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

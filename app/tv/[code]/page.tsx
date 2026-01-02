"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { fetchGameByCode } from "../../lib/supabaseClient";

type GameRow = {
  code: string;
  songs: string[];
  current_index: number;
  revealed: boolean;
};

export default function TvPage() {
  const params = useParams();
  const code = String(params?.code ?? "").toUpperCase();

  const [connected, setConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [songs, setSongs] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // Poll game state from Supabase
  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!code) return;

      const { data, error } = await fetchGameByCode(code);
      if (!alive) return;

      if (error) {
        setConnected(false);
        setErrorMsg(error.message || "Failed to load game.");
        return;
      }

      const row = data as GameRow | null;
      if (!row) {
        setConnected(false);
        setErrorMsg("Game not found.");
        return;
      }

      setConnected(true);
      setErrorMsg(null);

      setSongs(Array.isArray(row.songs) ? row.songs : []);
      setCurrentIndex(typeof row.current_index === "number" ? row.current_index : 0);
      setRevealed(!!row.revealed);
    };

    load();
    const t = setInterval(load, 900);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [code]);

  // Played songs (include current only if revealed)
  const playedList = useMemo(() => {
    if (!songs.length) return [];
    const end = revealed ? currentIndex + 1 : currentIndex;
    return songs.slice(0, Math.max(0, Math.min(end, songs.length)));
  }, [songs, currentIndex, revealed]);

  // Newest first, but keep original play numbers
  const playedNewestFirst = useMemo(() => {
    return playedList
      .map((title, idx) => ({ title, playNumber: idx + 1 }))
      .reverse();
  }, [playedList]);

  const nowPlayingText = useMemo(() => {
    if (!songs.length) return "—";
    if (!revealed) return "Hidden";
    return songs[currentIndex] ?? "—";
  }, [songs, currentIndex, revealed]);

  return (
    <main className="min-h-screen w-full bg-black text-white font-['Press_Start_2P'] p-6">
      {/* TOP WEB ADDRESS */}
      <div className="text-center mb-6">
        <div className="text-2xl md:text-3xl tracking-wider opacity-90">
          quartersbingo.netlify.app
        </div>
      </div>

      {/* MAIN SPLIT: 50% LEFT / 50% RIGHT */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT: stacked, bigger */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* CODE BOX */}
<div className="bg-black/70 border border-cyan-400/70 rounded-2xl p-8 md:p-10 shadow-[0_0_28px_#22d3ee]">
  <div className="text-center text-sm md:text-base mb-4 opacity-90 tracking-wider">
    CODE TO JOIN
  </div>

  <div className="text-center whitespace-nowrap overflow-hidden">
    <span className="inline-block text-7xl md:text-8xl tracking-[0.35em]">
      {code || "----"}
    </span>
  </div>

  {/* WEB ADDRESS */}
  <div className="text-center mt-5 text-cyan-200 text-sm md:text-base tracking-wider drop-shadow-[0_0_10px_#22d3ee]">
    quartersbingo.netlify.app
  </div>
</div>


          {/* NOW PLAYING BOX */}
          <div className="bg-black/70 border border-fuchsia-400/60 rounded-2xl p-8 shadow-[0_0_22px_#d946ef]">
            <div className="text-center text-xs md:text-sm mb-4 opacity-80">
              NOW PLAYING
            </div>

            <div className="text-center text-5xl md:text-6xl leading-snug break-words">
              {nowPlayingText}
            </div>
          </div>
        </div>

        {/* RIGHT: songs played */}
        <div className="min-w-0">
          <div className="bg-black/70 border border-cyan-400/70 rounded-2xl p-6 shadow-[0_0_22px_#22d3ee] min-h-[420px] flex flex-col">
            <div className="text-center text-lg md:text-xl mb-4">
              SONGS PLAYED
            </div>

            {!connected && (
              <div className="text-center text-sm opacity-75">
                Waiting for host to start the game…
              </div>
            )}

            {connected && errorMsg && (
              <div className="text-center text-sm opacity-75">{errorMsg}</div>
            )}

            {connected && !errorMsg && playedNewestFirst.length === 0 && (
              <div className="text-center text-sm opacity-75">
                No songs played yet.
              </div>
            )}

            {connected && !errorMsg && playedNewestFirst.length > 0 && (
              <ol className="min-w-0 flex-1 overflow-y-auto pr-2 grid grid-cols-3 gap-x-8 gap-y-3">
                {playedNewestFirst.map(({ title, playNumber }) => (
                  <li
                    key={`${playNumber}-${title}`}
                    className="border-b border-white/10 pb-2 min-w-0"
                  >
                    <div className="text-[10px] text-white/60 mb-1">
                      {playNumber}.
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
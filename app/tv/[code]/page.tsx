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

  // Poll Supabase for game state (TV is read-only)
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

  // Songs that have been played so far:
  // If revealed=true, include current song; otherwise, only those before it.
  const playedList = useMemo(() => {
    if (!songs.length) return [];
    const end = revealed ? currentIndex + 1 : currentIndex;
    return songs.slice(0, Math.max(0, Math.min(end, songs.length)));
  }, [songs, currentIndex, revealed]);

  // Newest first, but keep original play numbers
  const playedNewestFirst = useMemo(() => {
    return playedList
      .map((title, idx) => ({ title, playNumber: idx + 1 })) // original play order #
      .reverse(); // newest first
  }, [playedList]);

  const nowPlayingText = useMemo(() => {
    if (!songs.length) return "—";
    if (!revealed) return "Hidden";
    return songs[currentIndex] ?? "—";
  }, [songs, currentIndex, revealed]);

  return (
    <main className="min-h-screen w-full bg-black text-white font-['Press_Start_2P'] p-6">
      {/* Top address (bigger) */}
      <div className="text-center mb-4">
        <div className="text-2xl md:text-3xl tracking-wider opacity-90">
          quartersbingo.netlify.app
        </div>
      </div>

      {/* HARD split screen: 50% left / 50% right */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 gap-6 items-start">
        {/* LEFT HALF: stacked + bigger */}
<div className="flex flex-col gap-6 min-w-0">
  {/* CODE (bigger, full width of left half) */}
  <div className="min-w-0">
    <div className="bg-black/70 border border-cyan-400/70 rounded-2xl p-6 shadow-[0_0_22px_#22d3ee]">
      <div className="text-center text-xs md:text-sm mb-3 opacity-80">
        SHOW THIS CODE TO JOIN
      </div>

      <div className="text-center whitespace-nowrap overflow-hidden">
        <span className="inline-block text-6xl md:text-7xl tracking-[0.35em]">
          {code || "----"}
        </span>
      </div>
    </div>
  </div>

  {/* NOW PLAYING (bigger, full width of left half) */}
  <div className="min-w-0">
    <div className="bg-black/70 border border-fuchsia-400/60 rounded-2xl p-8 shadow-[0_0_22px_#d946ef]">
      <div className="text-center text-xs md:text-sm mb-4 opacity-80">
        NOW PLAYING
      </div>

      <div className="text-center text-5xl md:text-6xl leading-snug break-words">
        {nowPlayingText}
      </div>
    </div>
  </div>
</div>


              {/* Prevent code from pushing layout wider */}
              <div className="text-center whitespace-nowrap overflow-hidden">
                <span className="inline-block text-5xl md:text-6xl tracking-[0.35em]">
                  {code || "----"}
                </span>
              </div>
            </div>
          

          {/* NOW PLAYING (70%) */}
          <div className="col-span-7 min-w-0">
            <div className="bg-black/70 border border-fuchsia-400/60 rounded-2xl p-4 shadow-[0_0_18px_#d946ef]">
              <div className="text-center text-xs mb-3 opacity-80">NOW PLAYING</div>
              <div className="text-center text-4xl md:text-5xl leading-snug break-words">
                {nowPlayingText}
              </div>
            </div>
          </div>
        

        {/* RIGHT HALF: Songs played */}
        <div className="min-w-0">
          <div className="bg-black/70 border border-cyan-400/70 rounded-2xl p-4 shadow-[0_0_18px_#22d3ee] min-h-[360px] flex flex-col">
            <div className="text-center text-lg md:text-xl mb-3">SONGS PLAYED</div>

            {!connected && (
              <div className="text-center text-sm opacity-75">
                Waiting for host to start the game…
              </div>
            )}

            {connected && errorMsg && (
              <div className="text-center text-sm opacity-75">{errorMsg}</div>
            )}

            {connected && !errorMsg && playedNewestFirst.length === 0 && (
              <div className="text-center text-sm opacity-75">No songs played yet.</div>
            )}

            {connected && !errorMsg && playedNewestFirst.length > 0 && (
              <ol className="min-w-0 flex-1 overflow-y-auto pr-2 grid grid-cols-3 gap-x-6 gap-y-2">
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
      
    </main>
  );
}
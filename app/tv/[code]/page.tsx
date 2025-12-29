"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { fetchGameByCode } from "../../lib/supabaseClient";

type GameRow = {
  code: string;
  songs: string[]; // shuffled labels
  current_index: number;
  revealed: boolean;
  pattern?: string | null;
};

function songOnly(label: string) {
  const raw = (label || "").trim();
  const parts = raw.split(" - ");
  const out = parts.length > 1 ? parts.slice(1).join(" - ") : raw;
  return out.replace(/\s+/g, " ").trim();
}

export default function TvPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toString().toUpperCase();

  const [connected, setConnected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [songs, setSongs] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // This is the key: we store played items as {n, title}
  // where n = the original played order number (1-based).
  const playedItems = useMemo(() => {
    if (!songs || songs.length === 0) return [];
    const maxPlayed = Math.min(currentIndex + (revealed ? 1 : 0), songs.length);
    // songs[0]..songs[maxPlayed-1] are "played/revealed" in order
    const arr = Array.from({ length: maxPlayed }, (_, i) => ({
      n: i + 1, // original played order
      title: songOnly(songs[i]),
    }));
    // Newest first for display
    return arr.reverse();
  }, [songs, currentIndex, revealed]);

  const nowPlayingTitle = useMemo(() => {
    if (!songs || songs.length === 0) return "Waiting for host…";
    if (!revealed) return "Hidden";
    return songOnly(songs[currentIndex] || "—");
  }, [songs, currentIndex, revealed]);

  useEffect(() => {
    if (!code) return;

    let alive = true;

    const tick = async () => {
      try {
        const { data, error } = await fetchGameByCode(code);
        if (!alive) return;

        if (error) {
          setLoadError(error.message || "Failed to load game");
          setConnected(false);
          return;
        }

        if (!data) {
          setLoadError("Game not found");
          setConnected(false);
          return;
        }

        const g = data as GameRow;

        setSongs(Array.isArray(g.songs) ? g.songs : []);
        setCurrentIndex(typeof g.current_index === "number" ? g.current_index : 0);
        setRevealed(!!g.revealed);

        setConnected(true);
        setLoadError(null);
      } catch (e: any) {
        if (!alive) return;
        setLoadError(e?.message || "Failed to load game");
        setConnected(false);
      }
    };

    // initial + interval
    tick();
    const id = setInterval(tick, 800);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [code]);

  return (
    <main
      className="min-h-screen p-8 text-white font-['Press_Start_2P']"
      style={{
        backgroundImage: "url(/logo.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "black",
      }}
    >
      {/* overlay */}
      <div className="min-h-screen bg-black/65 rounded-2xl p-8">
        {/* top small URL */}
        <div className="text-center text-sm md:text-base opacity-90 mb-6">
          quartersbingo.netlify.app
        </div>

        {/* MAIN LAYOUT: split screen */}
        <div className="max-w-7xl mx-auto grid grid-cols-2 gap-8">
          {/* LEFT HALF */}
          <div className="flex flex-col gap-8">
            {/* code + now playing in one row */}
            <div className="grid grid-cols-10 gap-6">
              {/* CODE 30% */}
              <div className="col-span-3 bg-black/70 border-2 border-cyan-400/70 rounded-2xl p-6 shadow-[0_0_18px_#22d3ee]">
                <div className="text-center text-xs md:text-sm mb-3 opacity-90">
                  SHOW THIS CODE TO JOIN
                </div>
                <div className="text-center text-5xl md:text-6xl tracking-[0.45em]">
                  {code}
                </div>
              </div>

              {/* NOW PLAYING 70% */}
              <div className="col-span-7 bg-black/70 border-2 border-fuchsia-400/70 rounded-2xl p-6 shadow-[0_0_18px_#d946ef]">
                <div className="text-center text-lg md:text-xl mb-3">NOW PLAYING</div>
                <div className="text-center text-3xl md:text-4xl leading-snug break-words">
                  {nowPlayingTitle}
                </div>
                {!connected && (
                  <div className="text-center text-xs opacity-70 mt-3">
                    Waiting for host…
                  </div>
                )}
              </div>
            </div>

            {/* status / errors */}
            {loadError && (
              <div className="bg-black/70 border border-red-500/60 rounded-xl p-4 text-xs">
                {loadError}
              </div>
            )}
          </div>

          {/* RIGHT HALF: SONGS PLAYED */}
          <div className="bg-black/70 border-2 border-cyan-400/70 rounded-2xl p-5 shadow-[0_0_18px_#22d3ee] flex flex-col">
            <div className="text-center text-lg md:text-xl mb-3">SONGS PLAYED</div>

            {!connected && (
              <div className="text-center text-sm opacity-75">No connection yet…</div>
            )}

            {connected && playedItems.length === 0 && (
              <div className="text-center text-sm opacity-75">No songs played yet.</div>
            )}

            {connected && playedItems.length > 0 && (
              <ol className="flex-1 overflow-y-auto pr-2 grid grid-cols-3 gap-x-6 gap-y-2">
                {playedItems.map((item) => (
                  <li
                    key={`${item.n}-${item.title}`}
                    className="border-b border-white/10 pb-2"
                  >
                    {/* Keep the original played number */}
                    <div className="text-[10px] text-white/60 mb-1">{item.n}.</div>
                    <div className="text-xs md:text-sm leading-snug break-words">
                      {item.title}
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

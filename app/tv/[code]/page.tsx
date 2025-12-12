"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchGameByCode, GameRow } from "../../lib/supabaseClient";




function songTitleOnly(label: string): string {
  const parts = label.split(" - ");
  if (parts.length >= 2) return parts.slice(1).join(" - ").trim();
  return label;
}

export default function TvPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toString().toUpperCase();

  const [game, setGame] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch game once + start polling
  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    const fetchGame = async () => {
const { data, error } = await fetchGameByCode(code);


      if (cancelled) return;

      if (error || !data) {
        setErrorMsg("Game not found. Check the code.");
        setGame(null);
      } else {
        setErrorMsg(null);
        setGame(data as GameRow);
      }
      setLoading(false);
    };

    fetchGame();

    const intervalId = setInterval(fetchGame, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [code]);

  if (!code) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P']">
        <div className="text-center">
          <h1 className="text-2xl mb-4">TV DISPLAY</h1>
          <p className="text-sm opacity-80">No game code in URL.</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P']">
        <div className="text-center">
          <h1 className="text-2xl mb-4">TV DISPLAY</h1>
          <p className="text-sm opacity-80">Loading game...</p>
        </div>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P']">
        <div className="text-center">
          <h1 className="text-2xl mb-4">TV DISPLAY</h1>
          <p className="text-sm opacity-80">{errorMsg ?? "Game not found."}</p>
        </div>
      </main>
    );
  }

  const { songs, current_index, revealed } = game;

  const currentSongRaw =
    current_index >= 0 && current_index < songs.length
      ? songs[current_index]
      : null;

  const currentSong = currentSongRaw ? songTitleOnly(currentSongRaw) : null;

  // All fully "played" songs:
  // If revealed, include current_index too; if not, only indices < current_index
  const lastPlayedIndex = revealed ? current_index : current_index - 1;
  const playedRaw =
    lastPlayedIndex >= 0 ? songs.slice(0, lastPlayedIndex + 1) : [];
  const playedList = playedRaw.map(songTitleOnly);

  return (
    <main className="min-h-screen bg-black text-white font-['Press_Start_2P'] flex flex-col p-4 md:p-8">
      <div className="flex flex-col md:flex-row gap-6 w-full h-full">
        {/* LEFT: Game code + current song */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* GAME CODE */}
          <div className="mb-8 text-center">
            <div className="text-sm md:text-base opacity-70 mb-1">
              JOIN CODE
            </div>
            <div className="text-5xl md:text-7xl tracking-[0.6em] bg-black/70 px-6 md:px-10 py-4 md:py-6 rounded-xl border border-white/40 shadow-[0_0_40px_rgba(255,255,255,0.3)]">
              {code}
            </div>
          </div>

          {/* NOW PLAYING */}
          <div className="w-full max-w-2xl bg-black/70 border border-white/30 rounded-xl px-6 py-4 shadow-[0_0_30px_rgba(0,255,255,0.3)]">
            <h2 className="text-xl md:text-2xl mb-3 text-center">
              NOW PLAYING
            </h2>

            {currentSong && revealed ? (
              <div className="text-center text-2xl md:text-3xl mt-2">
                {currentSong}
              </div>
            ) : (
              <div className="text-center text-base md:text-lg opacity-70 mt-2">
                Song is hidden
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: List of played songs */}
        <div className="flex-grow max-w-[600px] bg-black/60 p-4 md:p-5 rounded-xl border border-white/20 overflow-hidden flex flex-col">
          <h2 className="text-xl md:text-2xl font-bold mb-3 text-center">
            Songs Already Played
          </h2>

          {playedList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center">
              No songs played yet.
            </p>
          ) : (
            <ol className="mt-2 space-y-1 text-xs md:text-sm overflow-y-auto flex-1 pr-1">
              {playedList.map((title, index) => (
                <li
                  key={`${index}-${title}`}
                  className="truncate border-b border-zinc-800 pb-1 last:border-b-0"
                >
                  <span className="text-gray-400 mr-2">
                    {index + 1}.
                  </span>
                  <span className="text-gray-100">{title}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </main>
  );
}

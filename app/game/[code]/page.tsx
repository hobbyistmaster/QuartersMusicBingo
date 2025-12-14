"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { fetchGameByCode } from "../../lib/supabaseClient";
import type { GameRow } from "../../lib/supabaseClient";
import { shuffleArray } from "../../lib/shuffle";

// Show SONG only (strip artist if your labels are "Artist - Song")
function songTitleOnly(label: string): string {
  const parts = label.split(" - ");
  if (parts.length >= 2) return parts.slice(1).join(" - ").trim();
  return label.trim();
}

type Cell = { label: string; isFree: boolean };

export default function GamePage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toString().toUpperCase();

  const [game, setGame] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [cells, setCells] = useState<Cell[]>([]);
  const [marked, setMarked] = useState<boolean[]>([]);
  const [hasBingo, setHasBingo] = useState(false);
  const [clickError, setClickError] = useState<string | null>(null);

  // Poll game state
  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    const load = async () => {
      const { data, error } = await fetchGameByCode(code);

      if (cancelled) return;

      if (error) {
        console.error(error);
        setErrorMsg("Failed to load game.");
        setGame(null);
      } else if (!data) {
        setErrorMsg("Game not found. Check the code.");
        setGame(null);
      } else {
        setErrorMsg(null);
        setGame(data);
      }
      setLoading(false);
    };

    load();
    const id = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [code]);

  // Reset card if code changes (new game)
  useEffect(() => {
    setCells([]);
    setMarked([]);
    setHasBingo(false);
    setClickError(null);
  }, [code]);

  // Titles that have been played so far (song-only)
  const playedTitles = useMemo(() => {
    if (!game) return new Set<string>();

    const { songs, current_index, revealed } = game;
    const lastPlayedIndex = revealed ? current_index : current_index - 1;
    const used = lastPlayedIndex >= 0 ? songs.slice(0, lastPlayedIndex + 1) : [];
    return new Set(used.map(songTitleOnly));
  }, [game]);

  // Build card (always fills; pads with "—" if not enough songs)
  useEffect(() => {
    if (!game) return;
    if (cells.length > 0) return;

    const allTitles = game.songs.map(songTitleOnly).filter(Boolean);
    const shuffled = shuffleArray(allTitles);

    const needed = 24; // 25 squares minus FREE
    const picked = shuffled.slice(0, needed);
    while (picked.length < needed) picked.push("—");

    const newCells: Cell[] = [];
    let idx = 0;

    for (let i = 0; i < 25; i++) {
      if (i === 12) newCells.push({ label: "FREE", isFree: true });
      else newCells.push({ label: picked[idx++], isFree: false });
    }

    const initialMarked = Array(25).fill(false);
    initialMarked[12] = true;

    setCells(newCells);
    setMarked(initialMarked);
  }, [game, cells.length]);

  const checkBingo = (nextMarked: boolean[]) => {
    const lines: number[][] = [];
    for (let r = 0; r < 5; r++) lines.push([r * 5, r * 5 + 1, r * 5 + 2, r * 5 + 3, r * 5 + 4]);
    for (let c = 0; c < 5; c++) lines.push([c, c + 5, c + 10, c + 15, c + 20]);
    lines.push([0, 6, 12, 18, 24]);
    lines.push([4, 8, 12, 16, 20]);

    if (lines.some((line) => line.every((i) => nextMarked[i]))) {
      setHasBingo(true);
    }
  };

  const handleCellClick = (index: number) => {
    if (!game || cells.length === 0) return;

    const cell = cells[index];
    if (cell.isFree) return;

    const title = cell.label;

    // Block marking if song has not been played yet
    if (!playedTitles.has(title)) {
      setClickError("That song has not been played yet!");
      window.setTimeout(() => setClickError(null), 1500);
      return;
    }

    setClickError(null);

    setMarked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      checkBingo(next);
      return next;
    });
  };

  if (!code) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P']">
        <div className="text-center">
          <h1 className="text-2xl mb-3">MUSIC BINGO</h1>
          <p className="text-sm opacity-80">No game code in URL.</p>
        </div>
      </main>
    );
  }

  if (loading || !game) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P']">
        <div className="text-center">
          <h1 className="text-2xl mb-3">MUSIC BINGO</h1>
          <p className="text-sm opacity-80">{errorMsg ?? "Loading..."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen relative overflow-hidden text-white font-['Press_Start_2P']">
      {/* BACKGROUND IMAGE (same file your other pages use) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/logo.jpg)",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "cover",
          filter: "brightness(1.15)",
          transform: "scale(1.02)",
        }}
      />
      {/* overlay for readability */}
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative z-10 flex flex-col items-center p-4">
        <div className="w-full max-w-md mx-auto mt-2">
          <div className="text-center mb-3">
            <div className="text-[10px] opacity-75 mb-1">GAME CODE</div>
            <div className="text-3xl tracking-[0.35em] bg-black/80 px-6 py-3 rounded-xl border-2 border-cyan-400 shadow-[0_0_20px_#22d3ee] inline-block">
              {code}
            </div>
          </div>

          <h1 className="text-xl text-center mb-2">MUSIC BINGO</h1>

          {clickError && (
            <div className="text-[10px] text-red-300 text-center mb-2 border border-red-500/50 rounded bg-black/70 px-2 py-1 shadow-[0_0_12px_#f87171]">
              {clickError}
            </div>
          )}

          {hasBingo && (
            <div className="my-3 px-4 py-3 text-center text-lime-300 border-2 border-lime-400 rounded-xl bg-black/80 shadow-[0_0_25px_#a3e635] animate-pulse">
              🎉 B I N G O 🎉
              <div className="text-[10px] mt-1 text-white">Show this screen to the host</div>
            </div>
          )}

          {/* CARD GRID */}
          <div className="grid grid-cols-5 gap-1 mt-3 p-2 rounded-2xl border-2 border-cyan-400 bg-black/80 shadow-[0_0_30px_#22d3ee]">
            {cells.map((cell, index) => {
              const isMarked = marked[index];

              return (
                <button
                  key={index}
                  onClick={() => handleCellClick(index)}
                  className={`aspect-square rounded-lg border transition-all duration-150 overflow-hidden
                    ${
                      cell.isFree
                        ? "bg-purple-700/90 border-purple-300 text-white shadow-[0_0_15px_#a855f7]"
                        : isMarked
                        ? "bg-lime-400 text-black border-lime-200 shadow-[0_0_15px_#a3e635] scale-[1.03]"
                        : "bg-black/70 border-white/35 text-white hover:bg-white/10 hover:shadow-[0_0_8px_#22d3ee]"
                    }`}
                >
                  {/* TEXT BLEED FIX (3-line clamp + clip) */}
                  <div className="w-full h-full p-1 flex items-center justify-center text-center overflow-hidden">
                    <span
                      className="block text-[8px] md:text-[10px] leading-[1.05] break-words"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {cell.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-[9px] text-center text-cyan-200 mt-3 opacity-85">
            Only songs already played can be marked
          </p>
        </div>
      </div>
    </main>
  );
}

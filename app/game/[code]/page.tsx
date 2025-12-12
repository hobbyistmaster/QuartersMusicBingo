"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { fetchGameByCode } from "../../lib/supabaseClient";
import type { GameRow } from "../../lib/supabaseClient";
import { shuffleArray } from "../../lib/shuffle";

// Strip artist so cards only show the song title
function songTitleOnly(label: string): string {
  const parts = label.split(" - ");
  if (parts.length >= 2) return parts.slice(1).join(" - ").trim();
  return label;
}

type Cell = {
  label: string;
  isFree: boolean;
};

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

  // Load game data periodically so we know what songs have been played
  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    const fetchGame = async () => {
      const { data, error } = await fetchGameByCode(code);

      if (cancelled) return;

      if (error) {
        console.error("Error loading game:", error);
        setErrorMsg("Failed to load game from server.");
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

    fetchGame();
    const interval = setInterval(fetchGame, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [code]);

  // Titles that have actually been played so far
  const playedTitles = useMemo(() => {
    if (!game) return new Set<string>();

    const { songs, current_index, revealed } = game;

    // If current song is revealed, it counts as played
    const lastPlayedIndex = revealed ? current_index : current_index - 1;
    const used: string[] =
      lastPlayedIndex >= 0 ? songs.slice(0, lastPlayedIndex + 1) : [];

    const titleOnly = used.map(songTitleOnly);
    return new Set(titleOnly);
  }, [game]);

  // Build card cells (24 songs + 1 FREE space) once game data is available
  useEffect(() => {
    if (!game) return;
    if (cells.length > 0) return; // already built

    const allTitles = game.songs.map(songTitleOnly);
    const shuffled = shuffleArray(allTitles);
    const needed = 24; // 5x5 minus the free center
    const picked = shuffled.slice(0, needed);

    const newCells: Cell[] = [];
    let idx = 0;
    for (let i = 0; i < 25; i++) {
      if (i === 12) {
        // center free
        newCells.push({ label: "FREE", isFree: true });
      } else {
        newCells.push({ label: picked[idx] || "", isFree: false });
        idx++;
      }
    }

    const initialMarked = Array(25).fill(false);
    initialMarked[12] = true; // FREE is always marked

    setCells(newCells);
    setMarked(initialMarked);
  }, [game, cells.length]);

  // Simple bingo check (rows, columns, diagonals)
  const checkBingo = (nextMarked: boolean[]) => {
    const isMarked = (idx: number) => nextMarked[idx];

    const lines: number[][] = [];

    // Rows
    for (let r = 0; r < 5; r++) {
      const row: number[] = [];
      for (let c = 0; c < 5; c++) {
        row.push(r * 5 + c);
      }
      lines.push(row);
    }

    // Columns
    for (let c = 0; c < 5; c++) {
      const col: number[] = [];
      for (let r = 0; r < 5; r++) {
        col.push(r * 5 + c);
      }
      lines.push(col);
    }

    // Diagonals
    lines.push([0, 6, 12, 18, 24]);
    lines.push([4, 8, 12, 16, 20]);

    const hasLine = lines.some((line) =>
      line.every((idx) => isMarked(idx))
    );

    if (hasLine) {
      setHasBingo(true);
    }
  };

  const handleCellClick = (index: number) => {
    if (!game || cells.length === 0) return;

    const cell = cells[index];
    if (cell.isFree) return; // ignore FREE cell click

    const label = cell.label;
    const titleOnly = songTitleOnly(label);

    // Block marking if the song has NOT been played yet
    if (!playedTitles.has(titleOnly)) {
      setClickError("That song has not been played yet!");
      setTimeout(() => setClickError(null), 1500);
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
          <h1 className="text-2xl mb-4">MUSIC BINGO</h1>
          <p className="text-sm opacity-80">No game code in URL.</p>
        </div>
      </main>
    );
  }

  if (loading || !game) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P']">
        <div className="text-center">
          <h1 className="text-2xl mb-4">MUSIC BINGO</h1>
          <p className="text-sm opacity-80">
            {errorMsg ?? "Loading game..."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white font-['Press_Start_2P'] flex flex-col items-center justify-start p-4">
      <div className="w-full max-w-md mx-auto mt-4">
        <div className="text-center mb-2">
          <div className="text-xs opacity-70 mb-1">GAME CODE</div>
          <div className="text-2xl tracking-[0.4em] bg-black/70 px-4 py-2 rounded-lg border border-white/30 inline-block">
            {code}
          </div>
        </div>

        <h1 className="text-xl text-center mb-2">MUSIC BINGO</h1>

        {clickError && (
          <div className="text-xs text-red-400 text-center mb-2">
            {clickError}
          </div>
        )}

        {hasBingo && (
          <div className="text-sm text-lime-400 text-center mb-2">
            BINGO! 🎉 Show this screen to the host.
          </div>
        )}

        {errorMsg && !loading && (
          <div className="text-xs text-red-400 text-center mb-2">
            {errorMsg}
          </div>
        )}

        {/* Bingo card */}
        <div className="grid grid-cols-5 gap-1 mt-2 bg-black/80 border border-white/40 rounded-xl p-1 shadow-[0_0_25px_rgba(0,255,255,0.4)]">
          {cells.map((cell, index) => {
            const isMarked = marked[index];
            return (
              <button
                key={index}
                onClick={() => handleCellClick(index)}
                className={`aspect-square text-[9px] leading-tight md:text-xs px-1 py-1 rounded-md border
                  ${
                    cell.isFree
                      ? "bg-purple-700/80 border-purple-300 text-white"
                      : isMarked
                      ? "bg-lime-400 text-black border-lime-200 shadow-[0_0_10px_rgba(190,242,100,0.9)]"
                      : "bg-black/60 border-white/40 text-white hover:bg-white/10"
                  }`}
              >
                {cell.label}
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-center text-slate-400 mt-3">
          You can only mark songs that have already been played.
        </p>
      </div>
    </main>
  );
}

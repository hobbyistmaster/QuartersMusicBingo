"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { fetchGameByCode, GameRow } from "../../lib/supabaseClient";

import { shuffleArray } from "../../lib/shuffle";



type Cell = {
  title: string | null;
  marked: boolean;
  isFree?: boolean;
};

type CardGrid = Cell[][]; // 5x5

function songTitleOnly(label: string): string {
  const parts = label.split(" - ");
  if (parts.length >= 2) return parts.slice(1).join(" - ").trim();
  return label;
}

function createNewCard(allSongs: string[]): CardGrid {
  const cleaned = allSongs.map(songTitleOnly);
  const unique = Array.from(new Set(cleaned));
  const shuffled = shuffleArray(unique);
  const needed = 25 - 1; // 24 cells + 1 free
  const use = shuffled.slice(0, Math.min(needed, shuffled.length));

  // Fill row-major 5x5, with center as FREE and null title
  const grid: CardGrid = [];
  let idx = 0;
  for (let r = 0; r < 5; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < 5; c++) {
      if (r === 2 && c === 2) {
        row.push({
          title: null,
          marked: true, // free space already marked
          isFree: true,
        });
      } else {
        const title = idx < use.length ? use[idx] : null;
        row.push({
          title,
          marked: false,
        });
        idx++;
      }
    }
    grid.push(row);
  }
  return grid;
}

export default function GamePage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toString().toUpperCase();

  const [game, setGame] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [card, setCard] = useState<CardGrid | null>(null);

  // Fetch game and poll
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

  // Build or load card once we know the song list
  useEffect(() => {
    if (!game) return;
    if (!game.songs || game.songs.length === 0) return;
    if (typeof window === "undefined") return;

    const storageKey = `bingo-card-${code}`;
    const raw = window.localStorage.getItem(storageKey);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CardGrid;
        setCard(parsed);
        return;
      } catch {
        // fall through to new card
      }
    }

    const grid = createNewCard(game.songs);
    setCard(grid);
    window.localStorage.setItem(storageKey, JSON.stringify(grid));
  }, [game, code]);

  // Save card whenever it changes
  useEffect(() => {
    if (!card || typeof window === "undefined" || !code) return;
    const storageKey = `bingo-card-${code}`;
    window.localStorage.setItem(storageKey, JSON.stringify(card));
  }, [card, code]);

  const playableTitles = useMemo(() => {
    if (!game) return new Set<string>();
    const { songs, current_index, revealed } = game;
    const visibleCount = revealed ? current_index + 1 : current_index;
    const slice = songs.slice(0, Math.max(0, visibleCount));
    return new Set(slice.map(songTitleOnly));
  }, [game]);

  const handleCellClick = (r: number, c: number) => {
    if (!card) return;
    const cell = card[r][c];

    if (cell.isFree) {
      // allow toggling free if you want, or keep it always marked
      // here we keep it always marked
      return;
    }

    if (!cell.title) {
      return;
    }

    // Only allow marking if this title is playable (song has been played)
    if (!playableTitles.has(cell.title)) {
      return;
    }

    const updated: CardGrid = card.map((row, ri) =>
      row.map((col, ci) => {
        if (ri === r && ci === c) {
          return { ...col, marked: !col.marked };
        }
        return col;
      })
    );
    setCard(updated);
  };

  if (!code) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P']">
        <div className="text-center">
          <h1 className="text-2xl mb-4">JOIN GAME</h1>
          <p className="text-sm opacity-80">No game code in URL.</p>
        </div>
      </main>
    );
  }

  if (loading || !game || !card) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P']">
        <div className="text-center">
          <h1 className="text-2xl mb-4">JOINED GAME: {code}</h1>
          {errorMsg ? (
            <p className="text-sm opacity-80">{errorMsg}</p>
          ) : (
            <p className="text-sm opacity-80">Loading card...</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white font-['Press_Start_2P'] flex flex-col items-center justify-center p-4">
      <div className="mb-4 text-center">
        <div className="text-xs opacity-60 mb-1">GAME CODE</div>
        <div className="text-2xl tracking-[0.4em]">{code}</div>
        <div className="text-[10px] opacity-60 mt-1">
          Tap a song only after it has been played.
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1 w-full max-w-md aspect-square">
        {card.map((row, r) =>
          row.map((cell, c) => {
            const isCenter = cell.isFree;
            const playable =
              isCenter || (cell.title ? playableTitles.has(cell.title) : false);

            const baseClasses =
              "flex items-center justify-center text-[9px] sm:text-xs md:text-sm text-center p-1 sm:p-2 border border-white/30";
            const markedClasses = cell.marked
              ? "bg-lime-400 text-black shadow-[0_0_12px_#a3e635]"
              : playable
              ? "bg-black/70"
              : "bg-black/40 opacity-50";

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                className={`${baseClasses} ${markedClasses}`}
              >
                {isCenter ? "FREE" : cell.title ?? ""}
              </button>
            );
          })
        )}
      </div>
    </main>
  );
}

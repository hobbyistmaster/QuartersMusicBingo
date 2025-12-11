"use client";

import React, { useEffect, useState, use, useMemo } from "react";
import { shuffleArray } from "../../lib/shuffle";

type Cell = {
  label: string;
  isFree?: boolean;
};

type SavedCard = {
  cells: Cell[];
  marks: boolean[];
};

type TvState = {
  currentIndex: number;
  totalSongs: number;
  revealed: boolean;
  songs: string[];
};

const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const CENTER_INDEX = Math.floor(TOTAL_CELLS / 2);

// Remove artist (only return title)
function getTitleOnly(label: string): string {
  const parts = label.split(" - ");
  if (parts.length > 1) return parts.slice(1).join(" - ");
  return label;
}

// Check for bingo
function checkBingo(marks: boolean[]): boolean {
  // rows
  for (let r = 0; r < GRID_SIZE; r++) {
    let ok = true;
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!marks[r * GRID_SIZE + c]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }

  // columns
  for (let c = 0; c < GRID_SIZE; c++) {
    let ok = true;
    for (let r = 0; r < GRID_SIZE; r++) {
      if (!marks[r * GRID_SIZE + c]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }

  // main diagonal
  {
    let ok = true;
    for (let i = 0; i < GRID_SIZE; i++) {
      if (!marks[i * GRID_SIZE + i]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }

  // anti diagonal
  {
    let ok = true;
    for (let i = 0; i < GRID_SIZE; i++) {
      const idx = i * GRID_SIZE + (GRID_SIZE - 1 - i);
      if (!marks[idx]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }

  return false;
}

// Convert TV state → which songs have been played
function getPlayedListFromTv(state: TvState | null): string[] {
  if (!state) return [];
  if (!state.songs || state.songs.length === 0) return [];

  let endIndex = state.revealed
    ? Math.min(state.currentIndex + 1, state.songs.length)
    : Math.min(state.currentIndex, state.songs.length);

  if (endIndex <= 0) return [];
  return state.songs.slice(0, endIndex);
}

export default function GamePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  const [cells, setCells] = useState<Cell[]>([]);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [hasBingo, setHasBingo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tvState, setTvState] = useState<TvState | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const cardKey = `bingo-card-${code}`;
  const poolKey = `bingo-${code}`;
  const tvKey = `bingo-tv-${code}`;

  // Build or load card
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawCard = window.localStorage.getItem(cardKey);
      if (rawCard) {
        const saved = JSON.parse(rawCard) as SavedCard;
        if (
          saved.cells?.length === TOTAL_CELLS &&
          saved.marks?.length === TOTAL_CELLS
        ) {
          setCells(saved.cells);
          setMarks(saved.marks);
          setHasBingo(checkBingo(saved.marks));
          setLoading(false);
          return;
        }
      }

      const rawPool = window.localStorage.getItem(poolKey);
      if (!rawPool) {
        setError("No song list found for this game. Host must start the game.");
        setLoading(false);
        return;
      }

      const pool = JSON.parse(rawPool) as string[];
      const newCard = generateCardFromPool(pool);
      setCells(newCard.cells);
      setMarks(newCard.marks);
      setHasBingo(checkBingo(newCard.marks));

      window.localStorage.setItem(cardKey, JSON.stringify(newCard));
      setLoading(false);
    } catch {
      setError("Error building card.");
      setLoading(false);
    }
  }, [cardKey, poolKey]);

  // Generate card
  const generateCardFromPool = (pool: string[]): SavedCard => {
    let poolCopy = [...pool];

    if (poolCopy.length < TOTAL_CELLS - 1) {
      const times = Math.ceil((TOTAL_CELLS - 1) / poolCopy.length);
      poolCopy = Array.from({ length: times }, () => poolCopy).flat();
    }

    const shuffled = shuffleArray(poolCopy);
    const picks = shuffled.slice(0, TOTAL_CELLS - 1);

    const cells: Cell[] = new Array(TOTAL_CELLS);
    let idx = 0;

    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (i === CENTER_INDEX) continue;
      cells[i] = { label: picks[idx++] };
    }

    cells[CENTER_INDEX] = { label: "FREE", isFree: true };

    const marks = Array(TOTAL_CELLS).fill(false);
    marks[CENTER_INDEX] = true;

    return { cells, marks };
  };

  // Read TV state
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tick = () => {
      const raw = window.localStorage.getItem(tvKey);
      if (!raw) return;
      try {
        setTvState(JSON.parse(raw));
      } catch {}
    };

    tick();
    const interval = setInterval(tick, 1000);
    window.addEventListener("storage", (e) => {
      if (e.key === tvKey) tick();
    });

    return () => clearInterval(interval);
  }, [tvKey]);

  const playedList = useMemo(
    () => getPlayedListFromTv(tvState),
    [tvState]
  );

  // Prevent marking songs that haven't been played
  const handleToggle = (index: number) => {
    const cell = cells[index];
    if (!cell || cell.isFree) return;

    const allowed = playedList.includes(cell.label);
    if (!allowed) {
      setWarn("You can only mark songs that have already been played.");
      setTimeout(() => setWarn(null), 1200);
      return;
    }

    const newMarks = [...marks];
    newMarks[index] = !newMarks[index];
    setMarks(newMarks);
    setHasBingo(checkBingo(newMarks));

    window.localStorage.setItem(
      cardKey,
      JSON.stringify({ cells, marks: newMarks })
    );
  };

  return (
    <main className="min-h-screen text-white p-4 flex justify-center font-['Press_Start_2P'] overflow-auto">
      <div className="w-full max-w-3xl flex flex-col items-center gap-4">
        <h1 className="text-2xl md:text-3xl">MUSIC BINGO</h1>
        <p className="text-xs opacity-80">Game Code: {code}</p>

        {warn && (
          <div className="px-3 py-2 bg-amber-400 text-black rounded text-xs">
            {warn}
          </div>
        )}

        {/* BINGO grid */}
        <div className="grid grid-cols-5 gap-1 w-full max-w-xl mt-2">
          {cells.map((cell, i) => {
            const marked = marks[i];
            const isCenter = cell.isFree;

            return (
              <button
                key={i}
                onClick={() => handleToggle(i)}
                className={`aspect-square text-[9px] md:text-xs p-1 border border-white/30
                  ${
                    isCenter
                      ? "bg-fuchsia-500 text-black"
                      : marked
                      ? "bg-lime-400 text-black"
                      : "bg-black/50"
                  }`}
              >
                {getTitleOnly(cell.label)}
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}

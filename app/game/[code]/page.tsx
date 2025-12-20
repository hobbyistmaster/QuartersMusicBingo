"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { fetchGameByCode } from "../../lib/supabaseClient";
import type { GameRow } from "../../lib/supabaseClient";
import { shuffleArray } from "../../lib/shuffle";

type Cell = { label: string; isFree: boolean };

// Normalize labels the same way everywhere
function songOnly(label: string) {
  const raw = (label || "").trim();
  const parts = raw.split(" - ");
  const out = parts.length > 1 ? parts.slice(1).join(" - ") : raw;
  return out.replace(/\s+/g, " ").trim(); // collapse double spaces
}

export default function GamePage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toUpperCase();

  const [game, setGame] = useState<GameRow | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [marked, setMarked] = useState<boolean[]>([]);
  const [bingo, setBingo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll game state
  useEffect(() => {
    if (!code) return;

    let alive = true;

    const load = async () => {
      const { data } = await fetchGameByCode(code);
      if (!alive) return;
      if (data) setGame(data);
    };

    load();
    const id = setInterval(load, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [code]);

  // Reset card when code changes
  useEffect(() => {
    setCells([]);
    setMarked([]);
    setBingo(false);
    setError(null);
  }, [code]);

  // ✅ "After reveal": include current song only when revealed
  const playedNow = useMemo(() => {
    if (!game) return new Set<string>();

    const last = game.revealed ? game.current_index : game.current_index - 1;
    if (last < 0) return new Set<string>();

    const list = game.songs.slice(0, last + 1).map(songOnly);
    return new Set(list);
  }, [game]);

  // Build card ONCE
  useEffect(() => {
    if (!game || cells.length) return;

    const titles = shuffleArray(game.songs.map(songOnly));
    const picked = titles.slice(0, 24);
    while (picked.length < 24) picked.push("—");

    const card: Cell[] = [];
    let i = 0;

    for (let n = 0; n < 25; n++) {
      if (n === 12) card.push({ label: "FREE", isFree: true });
      else card.push({ label: picked[i++], isFree: false });
    }

    setCells(card);
    const marks = Array(25).fill(false);
    marks[12] = true;
    setMarked(marks);
  }, [game, cells.length]);

  // Count how many squares on THIS card are playable
  const playableCount = useMemo(() => {
    if (!cells.length) return 0;
    return cells.reduce((acc, c) => {
      if (c.isFree) return acc;
      if (c.label === "—") return acc;
      const key = songOnly(c.label);
      return acc + (playedNow.has(key) ? 1 : 0);
    }, 0);
  }, [cells, playedNow]);

function checkBingo(next: boolean[]) {
  const p = ((game as any)?.pattern || "regular") as string;

  const winIfAllMarked = (cells: number[]) => cells.every((i) => next[i]);

  const rows = [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
  ];
  const cols = [
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
  ];
  const diags = [
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];

  // Regular bingo: ANY row/col/diag
  if (p === "regular") {
    const lines = [...rows, ...cols, ...diags];
    if (lines.some((line) => winIfAllMarked(line))) setBingo(true);
    return;
  }

  // 4 corners
  if (p === "corners") {
    if (winIfAllMarked([0, 4, 20, 24])) setBingo(true);
    return;
  }

  // X (both diagonals)
  if (p === "x") {
    if (winIfAllMarked([0, 6, 12, 18, 24]) && winIfAllMarked([4, 8, 12, 16, 20])) setBingo(true);
    return;
  }

  // Outside border
  if (p === "outside") {
    const outside = [0,1,2,3,4, 5,9, 10,14, 15,19, 20,21,22,23,24];
    if (winIfAllMarked(outside)) setBingo(true);
    return;
  }

  // Coverall / blackout
  if (p === "full") {
    if (next.every(Boolean)) setBingo(true);
    return;
  }

  // L (4 orientations)
  if (p === "l") {
    const shapes = [
      [0,5,10,15,20, 20,21,22,23,24], // left + bottom
      [0,5,10,15,20, 0,1,2,3,4],      // left + top
      [4,9,14,19,24, 20,21,22,23,24], // right + bottom
      [4,9,14,19,24, 0,1,2,3,4],      // right + top
    ].map((s) => Array.from(new Set(s)));
    if (shapes.some(winIfAllMarked)) setBingo(true);
    return;
  }

  // T (top or bottom bar + center column)
  if (p === "t") {
    const shapes = [
      Array.from(new Set([0,1,2,3,4, 2,7,12,17,22])),      // top T
      Array.from(new Set([20,21,22,23,24, 2,7,12,17,22])), // bottom T
    ];
    if (shapes.some(winIfAllMarked)) setBingo(true);
    return;
  }

  // N (left column + diagonal + right column)
  if (p === "n") {
    const nShape = Array.from(new Set([0,5,10,15,20, 0,6,12,18,24, 4,9,14,19,24]));
    if (winIfAllMarked(nShape)) setBingo(true);
    return;
  }

  // Z (top row + diagonal + bottom row)
  if (p === "z") {
    const zShape = Array.from(new Set([0,1,2,3,4, 4,8,12,16,20, 20,21,22,23,24]));
    if (winIfAllMarked(zShape)) setBingo(true);
    return;
  }

  // Plus (middle row + middle column)
  if (p === "plus") {
    const plusShape = Array.from(new Set([10,11,12,13,14, 2,7,12,17,22]));
    if (winIfAllMarked(plusShape)) setBingo(true);
    return;
  }

  // Diamond (a common “ring” around center)
  if (p === "diamond") {
    const diamondShape = [2,6,8,10,14,16,18,22];
    if (winIfAllMarked(diamondShape)) setBingo(true);
    return;
  }
}



  function clickCell(i: number) {
    const cell = cells[i];
    if (cell.isFree) return;

    const key = songOnly(cell.label);

    if (!playedNow.has(key)) {
      setError("That song has not been played yet");
      setTimeout(() => setError(null), 1500);
      return;
    }

    const next = [...marked];
    next[i] = !next[i];
    setMarked(next);
    checkBingo(next);
  }

  if (!game) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P']">
        Loading…
      </main>
    );
  }

  return (
    <main
      className="min-h-screen p-4 text-white font-['Press_Start_2P']"
      style={{
        backgroundImage: "url(/logo.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "black",
      }}
    >
      <div className="min-h-screen bg-black/60 p-4">
        <div className="max-w-md mx-auto text-center mb-3">
          <div className="text-xs opacity-70">GAME CODE</div>
          <div className="text-3xl tracking-[0.35em] border-2 border-cyan-400 bg-black/80 px-4 py-2 rounded-lg">
            {code}
          </div>

          
        </div>

        {error && (
          <div className="text-red-400 text-xs text-center mb-2">{error}</div>
        )}

        {bingo && (
          <div className="text-lime-400 text-center mb-3 animate-pulse">
            🎉 B I N G O 🎉
          </div>
        )}

        <div className="grid grid-cols-5 gap-1 max-w-md mx-auto p-2 border-2 border-cyan-400 rounded-xl bg-black/80">
          {cells.map((cell, i) => {
            const isMarked = marked[i];
            const key = songOnly(cell.label);
            const isPlayable = !cell.isFree && cell.label !== "—" && playedNow.has(key);

            return (
              <button
                key={i}
                onClick={() => clickCell(i)}
                className={`aspect-square rounded border overflow-hidden transition
                  ${
                    cell.isFree
                      ? "bg-purple-700 border-purple-300"
                      : isMarked
                      ? "bg-lime-400 text-black border-lime-200"
                      : isPlayable
                      ? "bg-cyan-400/25 border-cyan-300 ring-2 ring-cyan-300/80 shadow-[0_0_22px_#22d3ee]"
                      : "bg-black border-white/30"
                  }`}
              >
                <div className="w-full h-full flex items-center justify-center p-1 text-center overflow-hidden">
                  <span
                    style={{
                      fontSize: "clamp(6px,1.6vw,10px)",
                      lineHeight: "1.05",
                      maxHeight: "3.2em",
                      overflow: "hidden",
                      wordBreak: "break-word",
                    }}
                  >
                    {cell.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}

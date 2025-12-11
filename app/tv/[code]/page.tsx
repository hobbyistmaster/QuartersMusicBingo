"use client";

import React, { useEffect, useState, use } from "react";

type TvState = {
  currentIndex: number;
  totalSongs: number;
  revealed: boolean;
  songs: string[];
};

function getTitleOnly(label: string): string {
  const parts = label.split(" - ");
  if (parts.length > 1) {
    return parts.slice(1).join(" - ");
  }
  return label;
}

export default function TvPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  const [state, setState] = useState<TvState | null>(null);
  const [connected, setConnected] = useState(false);

  // Played list: only add the current song AFTER it's revealed
  const playedList: string[] = React.useMemo(() => {
    if (!state) return [];
    if (state.songs.length === 0) return [];

    let endIndex: number;

    if (state.revealed) {
      // include current song
      endIndex = Math.min(state.currentIndex + 1, state.songs.length);
    } else {
      // only include songs strictly before the current index
      endIndex = Math.min(state.currentIndex, state.songs.length);
    }

    if (endIndex <= 0) return [];
    return state.songs.slice(0, endIndex);
  }, [state]);

  const currentSong =
    state && state.songs.length > 0 && state.currentIndex < state.songs.length
      ? state.songs[state.currentIndex]
      : null;

  const remainingCount =
    state && state.totalSongs > 0
      ? Math.max(state.totalSongs - (state.currentIndex + 1), 0)
      : 0;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const key = `bingo-tv-${code}`;

    const readState = () => {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
          setConnected(false);
          setState(null);
          return;
        }
        const parsed = JSON.parse(raw) as TvState;
        setState(parsed);
        setConnected(true);
      } catch {
        // ignore
      }
    };

    readState();

    const interval = window.setInterval(readState, 1000);

    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        readState();
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, [code]);

  return (
    <main className="min-h-screen text-white p-4 md:p-6 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-6 items-stretch">
        {/* LEFT: Code + Current Song */}
        <div className="flex-1 bg-black/60 rounded-xl border border-white/10 p-4 md:p-6 flex flex-col justify-between">
          {/* Game Code */}
          <div className="mb-6 text-center">
            <div className="text-xs md:text-sm text-slate-300 mb-1">
              Join Code
            </div>
            <div className="text-4xl md:text-6xl lg:text-7xl font-mono font-bold tracking-widest bg-black/70 border border-slate-700 px-6 md:px-10 py-4 md:py-6 rounded-xl inline-block">
              {code}
            </div>
          </div>

          {/* Now Playing */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
            <h1 className="text-xl md:text-2xl font-bold mb-4">
              Now Playing
            </h1>

            {!connected && (
              <p className="text-sm text-gray-400 max-w-sm">
                Waiting for host to start the game…
              </p>
            )}

            {connected && !currentSong && (
              <p className="text-sm text-gray-400 max-w-sm">
                Host is connected, but no song has started yet.
              </p>
            )}

            {connected && currentSong && (
              <>
                <div className="bg-black/70 border border-fuchsia-500/60 shadow-[0_0_20px_#f0f] rounded-2xl px-4 md:px-8 py-6 md:py-8 max-w-xl">
                  <p className="text-xs md:text-sm text-gray-400 mb-2">
                    Song
                  </p>
                  <p className="text-lg md:text-2xl lg:text-3xl font-bold">
                    {state?.revealed ? currentSong : "Song Hidden"}
                  </p>
                </div>

                <div className="mt-4 text-xs md:text-sm text-gray-300">
                  {state?.revealed ? (
                    <>Mark this song on your card if you have it!</>
                  ) : (
                    <>Host has not revealed the song title yet.</>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Remaining Info */}
          <div className="mt-6 text-center text-xs md:text-sm text-gray-300">
            {connected && state ? (
              <>
                Song {state.currentIndex + 1} of {state.totalSongs} &bull;{" "}
                {remainingCount} left in this game
              </>
            ) : (
              <>Music Bingo TV Display</>
            )}
          </div>
        </div>

        {/* RIGHT: List of played songs */}
        <div className="flex-grow max-w-[600px] bg-black/50 p-4 rounded-xl border border-white/10 overflow-y-auto">
          <h2 className="text-xl font-bold mb-3 text-center">
            Songs Already Played
          </h2>

          {!connected && (
            <p className="text-sm text-gray-400 text-center">
              Waiting for host to start the game…
            </p>
          )}

          {connected && playedList.length === 0 && (
            <p className="text-sm text-gray-400 text-center">
              No songs played yet.
            </p>
          )}

          {connected && playedList.length > 0 && (
            <ol className="mt-2 space-y-1 text-xs md:text-sm overflow-y-auto flex-1 pr-1">
              {playedList.map((fullTitle, index) => (
                <li
                  key={`${index}-${fullTitle}`}
                  className="border-b border-zinc-800 pb-1 last:border-b-0"
                >
                  <span className="text-gray-400 mr-2">
                    {index + 1}.
                  </span>
                  <span className="text-gray-100">
                    {getTitleOnly(fullTitle)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </main>
  );
}

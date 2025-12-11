"use client";

import React, { useEffect, useRef, useState } from "react";
import { parseBlob } from "music-metadata-browser";
import { shuffleArray } from "../lib/shuffle";
import { themes } from "../data/themes";
import { supabase } from "../lib/supabaseClient";

// Hard-coded PIN for host screen – change this to whatever you want
const HOST_PIN = "1999";
const HOST_AUTH_KEY = "music-bingo-host-auth-v2";

/* Generate 4-letter game code */
function generateCode(length = 4) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += letters[Math.floor(Math.random() * letters.length)];
  }
  return out;
}

/* Clean filename fallback */
function cleanFileName(name: string): string {
  let base = name.replace(/\.[^/.]+$/, "");
  base = base.replace(/^[0-9]+[\s._-]+/, "");
  base = base.replace(/\s*[\(\[][^)\]]*[\)\]]/g, "");
  base = base.replace(
    /\b(official|video|audio|lyrics?|hd|remaster(ed)?|live)\b/gi,
    ""
  );
  base = base.replace(/[-_]{2,}/g, "-");
  base = base.replace(/\s{2,}/g, " ");
  return base.trim();
}

/* Extract label from ID3 tags */
async function getLabelForFile(file: File): Promise<string> {
  try {
    const metadata = await parseBlob(file);
    const artist = metadata.common.artist;
    const title = metadata.common.title;

    if (artist && title) return `${artist} - ${title}`;
    if (title) return title;
    if (artist) return artist;

    return cleanFileName(file.name);
  } catch {
    return cleanFileName(file.name);
  }
}

/* ---------- OUTER: handles PIN only ---------- */
export default function HostPage() {
  const [authorized, setAuthorized] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError]] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = window.localStorage.getItem(HOST_AUTH_KEY);
    if (ok === "ok") {
      setAuthorized(true);
    }
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (pinInput === HOST_PIN) {
      setAuthorized(true);
      setPinError("");
      if (typeof window !== "undefined") {
        window.localStorage.setItem(HOST_AUTH_KEY, "ok");
      }
    } else {
      setPinError("Incorrect PIN.");
    }
  };

  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P']">
        <div className="bg-black/70 border border-white/20 rounded-xl p-6 w-full max-w-sm text-center">
          <h1 className="text-xl mb-4">HOST LOGIN</h1>
          <form onSubmit={handlePinSubmit} className="space-y-3">
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter host PIN"
              className="w-full px-3 py-2 bg-black/70 border border-white/30 rounded text-center"
            />
            {pinError && (
              <div className="text-xs text-red-400">{pinError}</div>
            )}
            <button
              type="submit"
              className="w-full px-4 py-2 rounded bg-lime-400 text-black shadow-[0_0_10px_#a3e635] hover:bg-lime-300"
            >
              UNLOCK HOST
            </button>
          </form>
          <p className="mt-3 text-[10px] text-slate-300">
            Change the PIN in <code>HOST_PIN</code> at the top of{" "}
            <code>app/host/page.tsx</code>.
          </p>
        </div>
      </main>
    );
  }

  return <HostMain />;
}

/* ---------- INNER: actual host game logic ---------- */

function HostMain() {
  const [selectedThemeKey, setSelectedThemeKey] = useState<string>("80s");
  const selectedTheme = (themes as any)[selectedThemeKey] ?? {
    displayName: selectedThemeKey,
    slug: selectedThemeKey,
  };

  const [files, setFiles] = useState<File[]>([]);
  const [baseTitles, setBaseTitles] = useState<string[]>([]);

  const [code, setCode] = useState("");
  const [playFiles, setPlayFiles] = useState<File[]>([]);
  const [playLabels, setPlayLabels] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // When theme changes, try to load saved titles from localStorage
  useEffect(() => {
    setFiles([]);
    setBaseTitles([]);
    setPlayFiles([]);
    setPlayLabels([]);
    setCode("");
    setCurrentStep(0);
    setRevealed(false);

    if (typeof window === "undefined") return;
    const slug = selectedTheme.slug ?? selectedThemeKey;
    const raw = window.localStorage.getItem(`bingo-theme-${slug}`);
    if (raw) {
      try {
        const titles = JSON.parse(raw) as string[];
        setBaseTitles(titles);
      } catch {
        // ignore
      }
    }
  }, [selectedThemeKey, selectedTheme.slug]);

  // Handle MP3 file selection → build song titles + save to local theme
  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arr = e.target.files ? Array.from(e.target.files) : [];
    setFiles(arr);
    setCode("");
    setCurrentStep(0);
    setRevealed(false);

    if (arr.length === 0) {
      setBaseTitles([]);
      return;
    }

    const titles = await Promise.all(arr.map(getLabelForFile));
    setBaseTitles(titles);

    if (typeof window !== "undefined") {
      const slug = selectedTheme.slug ?? selectedThemeKey;
      window.localStorage.setItem(`bingo-theme-${slug}`, JSON.stringify(titles));
    }
  };

  // Start a new game: shuffle and save to Supabase
  const startGame = async () => {
    if (baseTitles.length === 0) {
      alert("No songs available. Load MP3 files or use a theme with saved titles.");
      return;
    }

    const newCode = generateCode();
    setCode(newCode);

    const indexes = Array.from({ length: baseTitles.length }, (_, i) => i);
    const shuffledIdx = shuffleArray(indexes);
    const shuffledLabels = shuffledIdx.map((i) => baseTitles[i]);
    setPlayLabels(shuffledLabels);

    if (files.length === baseTitles.length) {
      const shuffledFiles = shuffledIdx.map((i) => files[i]);
      setPlayFiles(shuffledFiles);
    } else {
      setPlayFiles([]);
    }

    setCurrentStep(0);
    setRevealed(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.currentTime = 0;
    }

    // Save to Supabase so TV + phones can see it
    await supabase.from("games").upsert({
      code: newCode,
      songs: shuffledLabels,
      current_index: 0,
      revealed: false,
    });
  };

  // Whenever currentStep / revealed changes, update Supabase
  useEffect(() => {
    if (!code || playLabels.length === 0) return;

    supabase
      .from("games")
      .update({
        current_index: currentStep,
        revealed,
      })
      .eq("code", code)
      .then(() => {
        // ignore errors for now
      });
  }, [code, currentStep, revealed, playLabels.length]);

  // Current song & audio
  const currentFile =
    playFiles.length > 0 && currentStep < playFiles.length
      ? playFiles[currentStep]
      : undefined;

  const currentSongLabel =
    playLabels.length > 0 && currentStep < playLabels.length
      ? playLabels[currentStep]
      : "(titles only mode)";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentFile) {
      audio.pause();
      audio.src = "";
      audio.currentTime = 0;
      return;
    }

    const url = URL.createObjectURL(currentFile);
    audio.src = url;
    audio.currentTime = 0;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [currentFile]);

  const playCurrent = () => {
    const audio = audioRef.current;
    if (!audio || !currentFile) return;
    audio.play();
  };

  const nextSong = () => {
    if (currentStep + 1 >= playLabels.length) return;
    setCurrentStep((p) => p + 1);
    setRevealed(false);
  };

  const openTv = () => {
    if (!code) {
      alert("Start the game first to generate a code.");
      return;
    }
    window.open(`/tv/${code}`, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="min-h-screen text-white p-4 flex justify-center overflow-auto font-['Press_Start_2P']">
      <div
        style={{ transform: "scale(0.92)", transformOrigin: "top center" }}
        className="w-full max-w-4xl flex flex-col items-center"
      >
        <h1 className="text-3xl md:text-4xl mb-6 text-center">
          HOST GAME
        </h1>

        {/* Theme Selection */}
        <div className="mb-6 text-center">
          <label className="block mb-2 text-lg">Select Theme</label>
          <select
            className="bg-black/70 border border-white/20 rounded px-4 py-2"
            value={selectedThemeKey}
            onChange={(e) => setSelectedThemeKey(e.target.value)}
          >
            {Object.entries(themes).map(([key, info]: any) => (
              <option key={key} value={key}>
                {info.displayName}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs opacity-70">
            Songs for this theme are loaded from this computer (or from what you
            imported last time).
          </p>
          <p className="mt-1 text-[10px] opacity-70">
            Songs in theme: <b>{baseTitles.length}</b>
          </p>
        </div>

        {/* Game Code */}
        {code ? (
          <div className="mb-6 text-center">
            <div className="text-sm opacity-70">JOIN CODE</div>
            <div className="text-6xl tracking-widest bg-black/60 px-10 py-6 rounded-xl border border-white/20">
              {code}
            </div>
          </div>
        ) : (
          <p className="mb-6 text-xs opacity-70 italic">
            Code appears after clicking <b>START GAME</b>.
          </p>
        )}

        {/* Host Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          <button
            onClick={startGame}
            className="px-6 py-3 rounded bg-lime-400 text-black shadow-[0_0_12px_#a3e635] hover:bg-lime-300"
          >
            START GAME
          </button>

          <button
            onClick={openTv}
            className="px-6 py-3 rounded bg-fuchsia-500 text-black shadow-[0_0_12px_#e879f9] hover:bg-fuchsia-400"
          >
            OPEN TV DISPLAY
          </button>
        </div>

        {/* File Loader */}
        <div className="w-full max-w-xl bg-black/60 border border-white/20 rounded-xl p-4 mb-8">
          <label className="block mb-2">Load MP3 Files (optional)</label>
          <input
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFiles}
            className="file:mr-4 file:py-2 file:px-4
                       file:rounded file:border-0
                       file:bg-lime-400 file:text-black
                       hover:file:bg-lime-300
                       text-xs"
          />
          <p className="text-xs opacity-70 mt-2">
            Use this to auto-generate song titles for this theme. They&apos;ll be saved
            on this computer so you don&apos;t have to reload next time.
          </p>
        </div>

        {/* Now Playing */}
        <div className="w-full max-w-xl bg-black/60 border border-white/20 rounded-xl p-4">
          <h2 className="text-xl mb-3 text-center">NOW PLAYING</h2>

          <p className="text-sm opacity-70 mb-1">Song:</p>

          <div className="text-sm md:text-lg mb-2 min-h-[2rem]">
            {revealed ? currentSongLabel : "(hidden)"}
          </div>

          <audio ref={audioRef} controls className="w-full mb-4" />

          <div className="flex flex-wrap gap-3">
            <button
              onClick={playCurrent}
              className="px-4 py-2 rounded bg-lime-400 text-black shadow-[0_0_10px_#a3e635] hover:bg-lime-300"
            >
              PLAY / RESUME
            </button>

            <button
              onClick={() => setRevealed(true)}
              className="px-4 py-2 rounded bg-fuchsia-600 shadow-[0_0_10px_#d946ef] hover:bg-fuchsia-500"
            >
              REVEAL
            </button>

            <button
              onClick={() => setRevealed(false)}
              className="px-4 py-2 rounded bg-purple-700 shadow-[0_0_10px_#a78bfa] hover:bg-purple-600"
            >
              HIDE
            </button>

            <button
              onClick={nextSong}
              className="px-4 py-2 rounded bg-cyan-400 text-black shadow-[0_0_10px_#22d3ee] hover:bg-cyan-300"
            >
              NEXT SONG
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

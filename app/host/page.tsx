"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { shuffleArray } from "../lib/shuffle";
import { upsertGame, updateGameState } from "../lib/supabaseClient";

type Pattern =
  | "regular"
  | "l"
  | "t"
  | "corners"
  | "x"
  | "z"
  | "n"
  | "outside"
  | "plus"
  | "diamond"
  | "full";

const THEME_OPTIONS = [
  "60s",
  "70s",
  "80s",
  "90s",
  "2000s",
  "Classic Rock",
  "Pop/R&B",
  "Alternative",
  "Rock",
  "Country",
  "Girl Power",
  "Soundtracks & Themes",
  "One Hit Wonders",
  "#1 Hits",
  "Animals",
  "Food & Drink",
  "Body Parts",
  "Love",
  "Dance",
  "Holiday/Seasonal",
] as const;

function makeCode(len = 4) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < len; i++) out += letters[Math.floor(Math.random() * letters.length)];
  return out;
}

// "Artist - Song" => "Song"
function songOnly(label: string) {
  const raw = (label || "").trim();
  const parts = raw.split(" - ");
  const out = parts.length > 1 ? parts.slice(1).join(" - ") : raw;
  return out.replace(/\s+/g, " ").trim();
}

export default function HostPage() {
  /* ================= PIN ================= */
  const HOST_PIN = process.env.NEXT_PUBLIC_HOST_PIN || "";
  const [authorized, setAuthorized] = useState(false);
  const [pinInput, setPinInput] = useState("");

  /* ================= SETUP ================= */
  const [selectedTheme, setSelectedTheme] =
    useState<(typeof THEME_OPTIONS)[number]>("80s");

  const [pattern, setPattern] = useState<Pattern>("regular");

  const [audioFiles, setAudioFiles] = useState<File[]>([]);

  // base = original file order (never changes until you load new songs)
  const [baseUrls, setBaseUrls] = useState<string[]>([]);
  const [baseLabels, setBaseLabels] = useState<string[]>([]);

  // game = shuffled order used for THIS game (host audio + tv + cards)
  const [gameUrls, setGameUrls] = useState<string[]>([]);
  const [gameLabels, setGameLabels] = useState<string[]>([]);

  /* ================= GAME STATE ================= */
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const tvUrl = useMemo(() => (code ? `/tv/${code}` : ""), [code]);

  /* ================= PIN SUBMIT ================= */
  const submitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!HOST_PIN || pinInput.trim() === HOST_PIN.trim()) setAuthorized(true);
    else alert("Wrong PIN");
  };

  /* ================= FILE LOAD ================= */
  useEffect(() => {
    // revoke old object URLs
    baseUrls.forEach((u) => URL.revokeObjectURL(u));
    gameUrls.forEach((u) => URL.revokeObjectURL(u)); // in case old game URLs existed too

    const urls = audioFiles.map((f) => URL.createObjectURL(f));
    const labels = audioFiles.map((f) => songOnly(f.name.replace(/\.[^/.]+$/, "")));

    setBaseUrls(urls);
    setBaseLabels(labels);

    // reset current game lists to match base until you hit START GAME
    setGameUrls(urls);
    setGameLabels(labels);

    // reset playback
    setCurrentStep(0);
    setRevealed(false);
    setIsPlaying(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = urls[0] || "";
    }

    return () => {
      // no-op; we already revoke on next load
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFiles]);

  /* ================= AUDIO SYNC ================= */
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.src = gameUrls[currentStep] || "";
    setIsPlaying(false); // stay paused until you press PLAY
  }, [gameUrls, currentStep]);

  /* ================= START GAME (SYNC SHUFFLE) ================= */
  const startGame = async () => {
    if (baseLabels.length === 0 || baseUrls.length === 0) {
      alert("Click ADD SONGS and choose your music files first.");
      return;
    }

    const newCode = makeCode(4);
    setCode(newCode);
    setShowCode(false);

    // Build a shuffled order index list, then apply it to BOTH labels and urls
    const order = shuffleArray(Array.from({ length: baseLabels.length }, (_, i) => i));
    const shuffledLabels = order.map((i) => baseLabels[i]);
    const shuffledUrls = order.map((i) => baseUrls[i]);

    // Host now uses the SAME shuffled list as Supabase/TV/Cards
    setGameLabels(shuffledLabels);
    setGameUrls(shuffledUrls);
    setCurrentStep(0);
    setRevealed(false);
    setIsPlaying(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = shuffledUrls[0] || "";
    }

    // Save to Supabase so TV + phones can see it
    const { error } = await upsertGame({
      code: newCode,
      songs: shuffledLabels,      // ✅ this list matches host playback now
      current_index: 0,
      revealed: false,
      pattern,                   // ✅ saved once at game start
    });

    if (error) {
      console.error("Supabase upsert error:", error);
      alert("Failed to save game to Supabase: " + error.message);
      return;
    }
  };

  /* ================= LIVE UPDATE ================= */
  useEffect(() => {
    if (!code) return;

    const doUpdate = async () => {
      const { error } = await updateGameState(code, currentStep, revealed);
      if (error) console.error("Supabase update error:", error);
    };

    doUpdate();
  }, [code, currentStep, revealed]);

  /* ================= CONTROLS ================= */
  const playPause = async () => {
    const a = audioRef.current;
    if (!a) return;

    if (a.paused) {
      try {
        await a.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      a.pause();
      setIsPlaying(false);
    }
  };

  const prevSong = () => {
    setRevealed(false);
    setIsPlaying(false);
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const nextSong = () => {
    setRevealed(false);
    setIsPlaying(false);
    setCurrentStep((s) => Math.min(s + 1, Math.max(0, gameUrls.length - 1)));
  };

  /* ================= UI ================= */
  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P'] p-6">
        <form
          onSubmit={submitPin}
          className="w-full max-w-sm bg-black/70 border border-cyan-400/60 rounded-2xl p-6"
        >
          <h1 className="text-xl text-center mb-4">HOST LOGIN</h1>

          <input
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="w-full bg-black border border-white/30 rounded-lg p-3 text-white text-center"
            placeholder="Enter PIN"
          />

          <button className="w-full mt-4 border-2 border-cyan-400 rounded-lg py-3 hover:bg-cyan-400/10">
            ENTER
          </button>

          {!HOST_PIN && (
            <div className="mt-3 text-[10px] opacity-70 text-center">
              (NEXT_PUBLIC_HOST_PIN not set — allowing access)
            </div>
          )}
        </form>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen p-6 text-white font-['Press_Start_2P']"
      style={{
        backgroundImage: "url(/logo.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "black",
      }}
    >
      <div className="min-h-screen bg-black/60 p-6 rounded-2xl">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Setup */}
          <section className="bg-black/70 border border-cyan-400/60 rounded-2xl p-5">
            <h1 className="text-xl mb-4">HOST SETUP</h1>

            {/* THEME (label only for now) */}
            <div className="mb-4">
              <label className="block text-xs mb-1 opacity-80">Theme</label>
              <select
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value as any)}
                className="w-full bg-black/70 border border-cyan-400/50 rounded-lg p-3"
              >
                {THEME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-[10px] opacity-70">
                (Theme is just a label while you’re loading songs manually.)
              </div>
            </div>

            {/* WIN PATTERN */}
            <div className="mb-4">
              <label className="block text-xs mb-1 opacity-80">Win Pattern</label>
              <select
                value={pattern}
                onChange={(e) => setPattern(e.target.value as Pattern)}
                className="w-full bg-black/70 border border-cyan-400/50 rounded-lg p-3"
              >
                <option value="regular">Regular (Row/Col/Diag)</option>
                <option value="l">L</option>
                <option value="t">T</option>
                <option value="corners">4 Corners</option>
                <option value="x">X</option>
                <option value="z">Z</option>
                <option value="n">N</option>
                <option value="outside">Outside Border</option>
                <option value="plus">Plus (+)</option>
                <option value="diamond">Diamond</option>
                <option value="full">Cover All</option>
              </select>
            </div>

            {/* ADD SONGS BUTTON + HIDDEN INPUT */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*"
              onChange={(e) => setAudioFiles(Array.from(e.target.files || []))}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-cyan-400 rounded-xl py-3 hover:bg-cyan-400/10"
            >
              ADD SONGS
            </button>

            <div className="mt-2 text-[10px] opacity-75">
              Loaded: {audioFiles.length} file(s)
            </div>

            <button
              onClick={startGame}
              className="w-full mt-4 border-2 border-lime-400 rounded-xl py-3 hover:bg-lime-400/10"
            >
              START GAME
            </button>

            <div className="mt-4 text-[10px] opacity-70">
              Tip: Keep “SHOW CODE” off while you’re getting ready.
            </div>
          </section>

          {/* RIGHT: Live Control */}
          <section className="bg-black/70 border border-fuchsia-400/60 rounded-2xl p-5">
            <h2 className="text-lg mb-4">GAME CONTROL</h2>

            {!code ? (
              <div className="text-sm opacity-70">Start a game to generate a code.</div>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap items-center mb-3">
                  <button
                    onClick={() => setShowCode((v) => !v)}
                    className="border border-cyan-400/60 rounded-lg px-4 py-2 hover:bg-cyan-400/10"
                  >
                    {showCode ? "HIDE CODE" : "SHOW CODE"}
                  </button>

                  <button
                    onClick={() => window.open(tvUrl, "_blank", "noopener,noreferrer")}
                    className="border border-white/30 rounded-lg px-4 py-2 hover:bg-white/10"
                    disabled={!tvUrl}
                  >
                    OPEN TV
                  </button>
                </div>

                {showCode && (
                  <div className="mb-4">
                    <div className="text-xs opacity-80 mb-2">Show this on the TV</div>
                    <div className="text-6xl tracking-[0.45em] bg-black/80 border-2 border-cyan-400 rounded-2xl px-6 py-4 inline-block shadow-[0_0_18px_#22d3ee]">
                      {code}
                    </div>
                  </div>
                )}

                <div className="text-[10px] opacity-75 mb-4">
                  Pattern: <span className="text-cyan-300">{pattern}</span> • Theme:{" "}
                  <span className="text-cyan-300">{selectedTheme}</span>
                </div>
              </>
            )}

            {/* NOW PLAYING + CONTROLS */}
            <div className="border border-white/10 rounded-xl p-4">
              <div className="text-xs opacity-80 mb-2">Now Playing</div>

              <div className="text-sm leading-snug break-words min-h-[2.5rem]">
                {code ? (revealed ? gameLabels[currentStep] || "—" : "Hidden") : "—"}
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  onClick={prevSong}
                  className="border border-white/30 rounded-lg px-3 py-2 hover:bg-white/10"
                  disabled={!code}
                >
                  PREV
                </button>

                <button
                  onClick={nextSong}
                  className="border border-white/30 rounded-lg px-3 py-2 hover:bg-white/10"
                  disabled={!code}
                >
                  NEXT
                </button>

                <button
                  onClick={playPause}
                  className="border-2 border-cyan-400 rounded-lg px-3 py-2 hover:bg-cyan-400/10"
                  disabled={!code || gameUrls.length === 0}
                >
                  {isPlaying ? "PAUSE" : "PLAY"}
                </button>

                <button
                  onClick={() => setRevealed(true)}
                  className="border-2 border-lime-400 rounded-lg px-3 py-2 hover:bg-lime-400/10"
                  disabled={!code}
                >
                  REVEAL
                </button>

                <button
                  onClick={() => setRevealed(false)}
                  className="border border-white/30 rounded-lg px-3 py-2 hover:bg-white/10"
                  disabled={!code}
                >
                  HIDE
                </button>
              </div>

              <audio ref={audioRef} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

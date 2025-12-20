"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  // ===== PIN GATE =====
  const HOST_PIN = process.env.NEXT_PUBLIC_HOST_PIN || "";
  const [authorized, setAuthorized] = useState(false);
  const [pinInput, setPinInput] = useState("");

  // ===== SETUP =====
  const [pattern, setPattern] = useState<Pattern>("regular");
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

  // ===== GAME STATE =====
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const tvUrl = useMemo(() => (code ? `/tv/${code}` : ""), [code]);

  // ===== PIN SUBMIT =====
  const submitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!HOST_PIN || pinInput.trim() === HOST_PIN.trim()) setAuthorized(true);
    else alert("Wrong PIN");
  };

  // ===== Load files → URLs + labels =====
  useEffect(() => {
    // cleanup old URLs
    audioUrls.forEach((u) => URL.revokeObjectURL(u));

    const urls = audioFiles.map((f) => URL.createObjectURL(f));
    const lbls = audioFiles.map((f) => songOnly(f.name.replace(/\.[^/.]+$/, "")));

    setAudioUrls(urls);
    setLabels(lbls);

    // reset playback state
    setCurrentStep(0);
    setRevealed(false);
    setIsPlaying(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = urls[0] || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFiles]);

  // ===== Keep audio pointed at current track (paused until Play) =====
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.src = audioUrls[currentStep] || "";
    setIsPlaying(false);
  }, [audioUrls, currentStep]);

  // ===== Start game (save songs + pattern ONCE) =====
  const startGame = async () => {
    if (labels.length === 0) {
      alert("Add music files first.");
      return;
    }

    const newCode = makeCode(4);
    setCode(newCode);
    setShowCode(false);
    setCurrentStep(0);
    setRevealed(false);
    setIsPlaying(false);

    // Shuffle the song list for this game
    const shuffledLabels = shuffleArray([...labels]);

    const { error } = await upsertGame({
      code: newCode,
      songs: shuffledLabels,
      current_index: 0,
      revealed: false,
      pattern, // ✅ saved ONCE at game start
    });

    if (error) {
      console.error("Supabase upsert error:", error);
      alert("Failed to save game to Supabase: " + error.message);
      return;
    }

    // keep host audio synced to the shuffled order too
    // (we only have file URLs in the same order you selected,
    // so this host page plays by file order; the TV/phones use the shuffled list from Supabase)
    // If you want host playback to follow the same shuffle order, we can add a mapping next.
  };

  // ===== Update Supabase whenever step/revealed changes =====
  useEffect(() => {
    if (!code) return;

    const doUpdate = async () => {
      const { error } = await updateGameState(code, currentStep, revealed);
      if (error) console.error("Supabase update error:", error);
    };

    doUpdate();
  }, [code, currentStep, revealed]);

  // ===== Controls =====
  const onPlayPause = async () => {
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

  const onNext = () => {
    setRevealed(false);
    setIsPlaying(false);
    setCurrentStep((s) => Math.min(s + 1, Math.max(0, audioUrls.length - 1)));
  };

  const onPrev = () => {
    setRevealed(false);
    setIsPlaying(false);
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const onReveal = () => setRevealed(true);
  const onHide = () => setRevealed(false);

  // ===== UI =====
  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P'] p-6">
        <form onSubmit={submitPin} className="w-full max-w-sm bg-black/70 border border-cyan-400/60 rounded-2xl p-6">
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
              <div className="mt-2 text-[10px] opacity-70">
                Selected: <span className="text-cyan-300">{pattern}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs mb-1 opacity-80">Add Music Files (host PC)</label>
              <input
                type="file"
                multiple
                accept="audio/*"
                onChange={(e) => setAudioFiles(Array.from(e.target.files || []))}
                className="w-full text-xs"
              />
              <div className="mt-2 text-[10px] opacity-75">
                Loaded: {audioFiles.length} file(s)
              </div>
            </div>

            <button
              onClick={startGame}
              className="w-full border-2 border-lime-400 rounded-xl py-3 hover:bg-lime-400/10"
            >
              START GAME
            </button>

            <div className="mt-4 text-[10px] opacity-70">
              Tip: Keep “Show Code” OFF while you’re getting ready.
            </div>
          </section>

          {/* RIGHT: Live Game */}
          <section className="bg-black/70 border border-fuchsia-400/60 rounded-2xl p-5">
            <h2 className="text-lg mb-4">GAME CONTROL</h2>

            {/* Code + TV */}
            <div className="mb-4">
              {!code ? (
                <div className="text-sm opacity-70">Start a game to generate a code.</div>
              ) : (
                <>
                  <div className="flex gap-2 flex-wrap items-center">
                    <button
                      onClick={() => setShowCode((v) => !v)}
                      className="border border-cyan-400/60 rounded-lg px-4 py-2 hover:bg-cyan-400/10"
                    >
                      {showCode ? "HIDE CODE" : "SHOW CODE"}
                    </button>

                    <button
                      onClick={() => router.push(tvUrl)}
                      className="border border-white/30 rounded-lg px-4 py-2 hover:bg-white/10"
                    >
                      OPEN TV
                    </button>
                  </div>

                  {showCode && (
                    <div className="mt-3">
                      <div className="text-xs opacity-80 mb-2">Show this on the TV</div>
                      <div className="text-6xl tracking-[0.45em] bg-black/80 border-2 border-cyan-400 rounded-2xl px-6 py-4 inline-block shadow-[0_0_18px_#22d3ee]">
                        {code}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Now Playing */}
            <div className="border border-white/10 rounded-xl p-4">
              <div className="text-xs opacity-80 mb-2">Now Playing (Host)</div>
              <div className="text-sm leading-snug break-words min-h-[2.5rem]">
                {revealed ? (labels[currentStep] || "—") : "Hidden"}
              </div>

              {/* Controls */}
              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  onClick={onPrev}
                  className="border border-white/30 rounded-lg px-3 py-2 hover:bg-white/10"
                  disabled={!code}
                >
                  PREV
                </button>

                <button
                  onClick={onNext}
                  className="border border-white/30 rounded-lg px-3 py-2 hover:bg-white/10"
                  disabled={!code}
                >
                  NEXT
                </button>

                <button
                  onClick={onPlayPause}
                  className="border-2 border-cyan-400 rounded-lg px-3 py-2 hover:bg-cyan-400/10"
                  disabled={!code || audioUrls.length === 0}
                >
                  {isPlaying ? "PAUSE" : "PLAY"}
                </button>

                <button
                  onClick={onReveal}
                  className="border-2 border-lime-400 rounded-lg px-3 py-2 hover:bg-lime-400/10"
                  disabled={!code}
                >
                  REVEAL
                </button>

                <button
                  onClick={onHide}
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

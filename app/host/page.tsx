"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** ---------- helpers ---------- */
function randomCode4Letters() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // avoid I/O
  let out = "";
  for (let i = 0; i < 4; i++) out += letters[Math.floor(Math.random() * letters.length)];
  return out;
}

function shuffleArray<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stripExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

function cleanPiece(s: string) {
  return stripExtension(s)
    .replace(/[_]+/g, " ")
    .replace(/[.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tries: "Artist - Song", "Artist — Song", "Artist – Song"
function parseArtistTitle(filenameOrTitle: string): { title: string; artist: string } {
  const s = cleanPiece(filenameOrTitle);
  const parts = s.split(/\s[-–—]\s/); // space-dash-space
  if (parts.length >= 2) {
    const artist = parts[0].trim();
    const title = parts.slice(1).join(" - ").trim();
    return { title: title || s, artist };
  }
  return { title: s, artist: "" };
}

function supabaseHeaders() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { url: "", key: "", ok: false as const };
  }
  return { url, key, ok: true as const };
}

async function upsertGame(payload: {
  code: string;
  songs: string[];
  current_index: number;
  revealed: boolean;
  pattern: string;
}) {
  const { url, key, ok } = supabaseHeaders();
  if (!ok) {
    return { error: { message: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY" } as any };
  }

  const endpoint = `${url}/rest/v1/games?on_conflict=code`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.message || msg;
    } catch {}
    return { error: { message: msg } as any };
  }

  return { error: null as any };
}

async function updateGameState(code: string, current_index: number, revealed: boolean) {
  const { url, key, ok } = supabaseHeaders();
  if (!ok) {
    return { error: { message: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY" } as any };
  }

  const endpoint = `${url}/rest/v1/games?code=eq.${encodeURIComponent(code)}`;

  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ current_index, revealed }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.message || msg;
    } catch {}
    return { error: { message: msg } as any };
  }

  return { error: null as any };
}

/** ---------- UI data ---------- */
const THEMES = [
  "60's",
  "70's",
  "80's",
  "90's",
  "2000's",
  "Girl Power",
  "Soundtracks & Themes",
  "1 Hit Wonders",
  "#1 Hits",
  "Animals",
  "Food & Drink",
  "Body Parts",
  "Love",
  "Dance",
  "Holiday/Seasonal",
  "Classic Rock",
  "Pop/R&B",
  "Alternative",
  "Rock",
  "Country",
] as const;

const PATTERNS = [
  { key: "regular", label: "Regular (Row/Col/Diag)" },
  { key: "four_corners", label: "4 Corners" },
  { key: "outside", label: "Outside Square" },
  { key: "l", label: "L" },
  { key: "t", label: "T" },
  { key: "x", label: "X" },
  { key: "z", label: "Z" },
  { key: "n", label: "N" },
  { key: "coverall", label: "Cover All" },
] as const;

export default function HostPage() {
  const router = useRouter();

  // setup
  const [selectedTheme, setSelectedTheme] = useState<(typeof THEMES)[number]>("80's");
  const [pattern, setPattern] = useState<(typeof PATTERNS)[number]["key"]>("regular");

  // files + labels
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [playLabels, setPlayLabels] = useState<string[]>([]); // title only
  const [playArtists, setPlayArtists] = useState<string[]>([]); // artist aligned with playLabels

  // game + playback state
  const [code, setCode] = useState<string>("");
  const [started, setStarted] = useState(false);

  // current index (0-based)
  const [currentIndex, setCurrentIndex] = useState(0);

  // reveal state (TV shows song title only when revealed)
  const [revealed, setRevealed] = useState(false);

  // host sees song + artist
  const nowTitle = playLabels[currentIndex] ?? "No song";
  const nowArtist = playArtists[currentIndex] ?? "";

  // audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // If true, when currentIndex changes we will auto-play (used by Next/Prev)
  const shouldAutoplayNextRef = useRef(false);

  // Build object URLs for playback (local files)
  const fileUrls = useMemo(() => {
    return files.map((f) => URL.createObjectURL(f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  // cleanup urls
  useEffect(() => {
    return () => {
      fileUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [fileUrls]);

  /** load songs */
  const handlePickSongs = () => fileInputRef.current?.click();

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (list.length === 0) return;

    const parsed = list.map((f) => {
      const { title, artist } = parseArtistTitle(f.name);
      return { file: f, title, artist };
    });

    setFiles(parsed.map((x) => x.file));
    setPlayLabels(parsed.map((x) => x.title));
    setPlayArtists(parsed.map((x) => x.artist));

    // reset
    setCurrentIndex(0);
    setRevealed(false);
    setStarted(false);
    setCode("");
    setIsPlaying(false);

    shouldAutoplayNextRef.current = false;

    // reset audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = "";
    }
  };

  /** start game: shuffle labels ONCE and write to Supabase */
  const handleStartGame = async () => {
    if (playLabels.length < 1) {
      alert("Add songs first.");
      return;
    }

    const newCode = randomCode4Letters();
    const shuffledTitles = shuffleArray(playLabels);

    setCode(newCode);
    setStarted(true);
    setRevealed(false);
    setCurrentIndex(0);

    // do not autoplay on start (only Next/Prev should)
    shouldAutoplayNextRef.current = false;

    // Write initial game row to Supabase
    const { error } = await upsertGame({
      code: newCode,
      songs: shuffledTitles,
      current_index: 0,
      revealed: false,
      pattern: pattern,
    });

    if (error) {
      alert("Failed to save game to Supabase: " + error.message);
      console.error(error);
    } else {
      console.log("Game saved:", newCode);
    }
  };

  /** keep supabase synced when host changes index/reveal AFTER start */
  useEffect(() => {
    if (!started) return;
    if (!code) return;

    const doUpdate = async () => {
      const { error } = await updateGameState(code, currentIndex, revealed);
      if (error) console.error("Supabase update error:", error.message);
    };

    doUpdate();
  }, [started, code, currentIndex, revealed]);

  /** audio core helpers */
  const loadCurrentIntoAudio = () => {
    if (!audioRef.current) return false;
    if (!files[currentIndex]) return false;

    const url = fileUrls[currentIndex];
    audioRef.current.src = url;
    audioRef.current.currentTime = 0;
    return true;
  };

  const playAudio = async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (e) {
      console.error(e);
      setIsPlaying(false);
      alert("Browser blocked autoplay. Click PLAY/RESUME once, then Next will auto-play.");
    }
  };

  // When index changes, load file; if Next/Prev requested autoplay, play it.
  useEffect(() => {
    if (!files.length) return;
    const ok = loadCurrentIntoAudio();
    if (!ok) return;

    // Autoplay only when Next/Prev set the flag
    if (shouldAutoplayNextRef.current) {
      shouldAutoplayNextRef.current = false;
      playAudio();
    } else {
      setIsPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, files.length]);

  /** controls */
  const handlePlayResume = async () => {
    if (!audioRef.current) return;
    if (!audioRef.current.src) loadCurrentIntoAudio();
    await playAudio();
  };

  const handlePause = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  };

  const stopAndResetAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  // ✅ NEXT/PREV should auto-play
  const handlePrev = () => {
    setRevealed(false);
    stopAndResetAudio();
    setIsPlaying(false);

    shouldAutoplayNextRef.current = true;
    setCurrentIndex((i) => Math.max(0, i - 1));
  };

  const handleNext = () => {
    setRevealed(false);
    stopAndResetAudio();
    setIsPlaying(false);

    shouldAutoplayNextRef.current = true;
    setCurrentIndex((i) => Math.min(playLabels.length - 1, i + 1));
  };

  const handleRevealToggle = () => setRevealed((r) => !r);

  const openTv = () => {
    if (!code) {
      alert("Start game first.");
      return;
    }
    window.open(`/tv/${code}`, "_blank", "noopener,noreferrer");
  };

  return (
    <main
      className="min-h-screen w-full text-white font-['Press_Start_2P']"
      style={{
        backgroundImage: "url(/logo.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="min-h-screen w-full bg-black/30 backdrop-brightness-110">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="text-3xl md:text-4xl tracking-wider drop-shadow-[0_0_18px_#ff00ff]">
              HOST SETUP
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* LEFT: setup */}
            <div className="bg-black/55 border border-cyan-400/50 rounded-2xl p-6 shadow-[0_0_22px_#22d3ee]">
              <div className="text-lg mb-4">Theme</div>
              <select
                className="w-full bg-black/70 border border-white/20 rounded-xl px-4 py-3 text-sm"
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value as any)}
              >
                {THEMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <div className="text-[10px] opacity-70 mt-3">
                (Theme is just a label while you&apos;re loading songs manually.)
              </div>

              <div className="text-lg mt-6 mb-4">Win Pattern</div>
              <select
                className="w-full bg-black/70 border border-white/20 rounded-xl px-4 py-3 text-sm"
                value={pattern}
                onChange={(e) => setPattern(e.target.value as any)}
              >
                {PATTERNS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>

              {/* hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />

              <button
                onClick={handlePickSongs}
                className="mt-6 w-full py-4 rounded-2xl border border-cyan-300/60 bg-black/60 shadow-[0_0_18px_#22d3ee] hover:bg-black/70 transition"
              >
                ADD SONGS
              </button>

              <div className="text-xs opacity-80 mt-3">Loaded: {files.length} file(s)</div>

              <button
                onClick={handleStartGame}
                className="mt-6 w-full py-4 rounded-2xl border border-lime-300/60 bg-black/60 shadow-[0_0_18px_#84cc16] hover:bg-black/70 transition"
              >
                START GAME
              </button>

              <div className="text-[10px] opacity-80 mt-4">
                Tip: Keep &quot;SHOW CODE&quot; off while you&apos;re getting ready.
              </div>
            </div>

            {/* RIGHT: controls */}
            <div className="bg-black/55 border border-fuchsia-400/40 rounded-2xl p-6 shadow-[0_0_22px_#ff00ff]">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm opacity-90">
                  Game Code:{" "}
                  <span className="text-cyan-200 drop-shadow-[0_0_10px_#22d3ee]">
                    {code || "----"}
                  </span>
                </div>

                <button
                  onClick={openTv}
                  className="px-4 py-2 rounded-xl border border-white/20 bg-black/60 hover:bg-black/70 transition text-xs"
                >
                  OPEN TV
                </button>
              </div>

              <div className="mt-6">
                <div className="text-xs opacity-80 mb-2">Host Now Playing</div>

                <div className="bg-black/60 border border-white/10 rounded-2xl p-6">
                  <div className="text-2xl md:text-3xl leading-snug break-words drop-shadow-[0_0_14px_#ffffff]">
                    {nowTitle}
                  </div>

                  {!!nowArtist && (
                    <div className="mt-4 text-sm md:text-base text-white/70 break-words">{nowArtist}</div>
                  )}

                  <div className="mt-4 text-[10px] opacity-70">
                    Track {files.length ? currentIndex + 1 : 0} / {files.length}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={handlePrev}
                  className="py-3 rounded-xl border border-white/20 bg-black/60 hover:bg-black/70 transition"
                >
                  PREV
                </button>
                <button
                  onClick={handleNext}
                  className="py-3 rounded-xl border border-white/20 bg-black/60 hover:bg-black/70 transition"
                >
                  NEXT
                </button>

                <button
                  onClick={handlePlayResume}
                  className="py-3 rounded-xl border border-cyan-300/50 bg-black/60 shadow-[0_0_14px_#22d3ee] hover:bg-black/70 transition"
                >
                  {isPlaying ? "PLAYING" : "PLAY / RESUME"}
                </button>
                <button
                  onClick={handlePause}
                  className="py-3 rounded-xl border border-white/20 bg-black/60 hover:bg-black/70 transition"
                >
                  PAUSE
                </button>

                <button
                  onClick={handleRevealToggle}
                  className="col-span-2 py-3 rounded-xl border border-fuchsia-300/50 bg-black/60 shadow-[0_0_14px_#ff00ff] hover:bg-black/70 transition"
                >
                  {revealed ? "HIDE ON TV" : "REVEAL ON TV"}
                </button>
              </div>

              <div className="mt-4 text-[10px] opacity-75">
                Theme: {selectedTheme} • Pattern:{" "}
                {PATTERNS.find((p) => p.key === pattern)?.label ?? pattern}
              </div>

              <audio
                ref={audioRef}
                onEnded={() => setIsPlaying(false)}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

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

// Handles: "Artist - Song", "Artist- Song", "Artist -Song", "Artist-Song"
// Also handles en-dash/em-dash
function parseArtistTitle(filenameOrTitle: string): { title: string; artist: string } {
  const s = cleanPiece(filenameOrTitle);

  // split on dash types with optional spaces
  const parts = s.split(/\s*[-–—]\s*/).filter(Boolean);

  // Common case: Artist - Title
  if (parts.length >= 2) {
    const artist = parts[0].trim();
    const title = parts.slice(1).join(" - ").trim();
    return { title: title || s, artist: artist || "" };
  }

  return { title: s, artist: "" };
}

function supabaseHeaders() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { url: "", key: "", ok: false as const };
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
  if (!ok) return { error: { message: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY" } as any };

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
  if (!ok) return { error: { message: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY" } as any };

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

type SongItem = {
  file: File;
  title: string;
  artist: string;
};

export default function HostPage() {
  // setup
  const [selectedTheme, setSelectedTheme] = useState<(typeof THEMES)[number]>("80's");
  const [pattern, setPattern] = useState<(typeof PATTERNS)[number]["key"]>("regular");

  // songs (file + title + artist kept together)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [songItems, setSongItems] = useState<SongItem[]>([]);

  // game state
  const [code, setCode] = useState<string>("");
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Next/Prev should autoplay
  const shouldAutoplayNextRef = useRef(false);

  // object URLs for current song order (this matches TV order now)
  const fileUrls = useMemo(() => {
    return songItems.map((s) => URL.createObjectURL(s.file));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songItems]);

  // cleanup urls
  useEffect(() => {
    return () => {
      fileUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [fileUrls]);

  const count = songItems.length;
  const nowTitle = songItems[currentIndex]?.title ?? "No song";
  const nowArtist = songItems[currentIndex]?.artist ?? "";

  /** ---------- file loading ---------- */
  const handlePickSongs = () => fileInputRef.current?.click();

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (!list.length) return;

    const parsed: SongItem[] = list.map((f) => {
      const { title, artist } = parseArtistTitle(f.name);
      return { file: f, title, artist };
    });

    setSongItems(parsed);
    setCurrentIndex(0);
    setRevealed(false);
    setStarted(false);
    setCode("");
    setIsPlaying(false);
    shouldAutoplayNextRef.current = false;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = "";
    }
  };

  /** ---------- audio core ---------- */
  const loadCurrentIntoAudio = () => {
    if (!audioRef.current) return false;
    if (!songItems[currentIndex]) return false;
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
      alert("Browser blocked autoplay. Click PLAY/RESUME once, then Next/Prev will auto-play.");
    }
  };

  useEffect(() => {
    if (!songItems.length) return;
    const ok = loadCurrentIntoAudio();
    if (!ok) return;

    if (shouldAutoplayNextRef.current) {
      shouldAutoplayNextRef.current = false;
      playAudio();
    } else {
      setIsPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, songItems.length]);

  const stopAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  /** ---------- game start (SYNCED ORDER) ---------- */
  const handleStartGame = async () => {
    if (!songItems.length) {
      alert("Add songs first.");
      return;
    }

    // ✅ Shuffle the entire list (file + title + artist together)
    const shuffled = shuffleArray(songItems);

    // This becomes the "official" game order for host AND TV
    setSongItems(shuffled);
    setCurrentIndex(0);
    setRevealed(false);
    setIsPlaying(false);
    shouldAutoplayNextRef.current = false;

    const newCode = randomCode4Letters();
    setCode(newCode);
    setStarted(true);

    // ✅ Supabase songs list MUST match the shuffled order
    const shuffledTitles = shuffled.map((s) => s.title);

    const { error } = await upsertGame({
      code: newCode,
      songs: shuffledTitles,
      current_index: 0,
      revealed: false,
      pattern,
    });

    if (error) {
      console.error(error);
      alert("Failed to save game to Supabase: " + error.message);
    }
  };

  /** ---------- supabase sync ---------- */
  useEffect(() => {
    if (!started || !code) return;

    const doUpdate = async () => {
      const { error } = await updateGameState(code, currentIndex, revealed);
      if (error) console.error("Supabase update error:", error.message);
    };

    doUpdate();
  }, [started, code, currentIndex, revealed]);

  /** ---------- controls ---------- */
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

  const handlePrev = () => {
    setRevealed(false);
    stopAudio();
    setIsPlaying(false);
    shouldAutoplayNextRef.current = true;
    setCurrentIndex((i) => Math.max(0, i - 1));
  };

  const handleNext = () => {
    setRevealed(false);
    stopAudio();
    setIsPlaying(false);
    shouldAutoplayNextRef.current = true;
    setCurrentIndex((i) => Math.min(songItems.length - 1, i + 1));
  };

  const handleRevealToggle = () => setRevealed((r) => !r);

  const openTv = () => {
    if (!code) {
      alert("Start game first.");
      return;
    }
    window.open(`/tv/${code}`, "_blank", "noopener,noreferrer");
  };

  /** ---------- UI ---------- */
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

              <div className="text-xs opacity-80 mt-3">
                Loaded: {count} file(s)
              </div>

              {/* Quick sanity: show how the parser is reading artist */}
              {count > 0 && (
                <div className="mt-3 text-[10px] opacity-75">
                  Example parse: <span className="text-cyan-200">{songItems[0]?.title}</span>
                  {songItems[0]?.artist ? (
                    <>
                      {" "}— <span className="text-fuchsia-200">{songItems[0]?.artist}</span>
                    </>
                  ) : (
                    <> (no artist found in filename)</>
                  )}
                </div>
              )}

              <button
                onClick={handleStartGame}
                className="mt-6 w-full py-4 rounded-2xl border border-lime-300/60 bg-black/60 shadow-[0_0_18px_#84cc16] hover:bg-black/70 transition"
              >
                START GAME
              </button>
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

                  {nowArtist ? (
                    <div className="mt-4 text-sm md:text-base text-white/70 break-words">
                      {nowArtist}
                    </div>
                  ) : (
                    <div className="mt-4 text-[10px] text-white/50">
                      (No artist found — rename files like: Artist - Song.mp3)
                    </div>
                  )}

                  <div className="mt-4 text-[10px] opacity-70">
                    Track {count ? currentIndex + 1 : 0} / {count}
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

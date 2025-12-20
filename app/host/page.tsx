"use client";

import React, { useEffect, useRef, useState } from "react";
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
  for (let i = 0; i < len; i++) {
    out += letters[Math.floor(Math.random() * letters.length)];
  }
  return out;
}

function songOnly(label: string) {
  const raw = (label || "").trim();
  const parts = raw.split(" - ");
  const out = parts.length > 1 ? parts.slice(1).join(" - ") : raw;
  return out.replace(/\s+/g, " ").trim();
}

export default function HostPage() {
  const router = useRouter();

  /* ================= PIN ================= */
  const HOST_PIN = process.env.NEXT_PUBLIC_HOST_PIN || "";
  const [authorized, setAuthorized] = useState(false);
  const [pinInput, setPinInput] = useState("");

  /* ================= GAME SETUP ================= */
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);

  const [pattern, setPattern] = useState<Pattern>("regular");

  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  /* ================= PIN SUBMIT ================= */
  const submitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!HOST_PIN || pinInput.trim() === HOST_PIN.trim()) {
      setAuthorized(true);
    } else {
      alert("Wrong PIN");
    }
  };

  /* ================= FILE LOAD ================= */
  useEffect(() => {
    audioUrls.forEach((u) => URL.revokeObjectURL(u));

    const urls = audioFiles.map((f) => URL.createObjectURL(f));
    const lbls = audioFiles.map((f) =>
      songOnly(f.name.replace(/\.[^/.]+$/, ""))
    );

    setAudioUrls(urls);
    setLabels(lbls);
    setCurrentStep(0);
    setRevealed(false);
    setIsPlaying(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = urls[0] || "";
    }
  }, [audioFiles]);

  /* ================= AUDIO SYNC ================= */
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.src = audioUrls[currentStep] || "";
    setIsPlaying(false);
  }, [currentStep, audioUrls]);

  /* ================= START GAME ================= */
  const startGame = async () => {
    if (labels.length === 0) {
      alert("Add music files first");
      return;
    }

    const newCode = makeCode();
    setCode(newCode);
    setShowCode(false);

    const shuffled = shuffleArray([...labels]);

    const { error } = await upsertGame({
      code: newCode,
      songs: shuffled,
      current_index: 0,
      revealed: false,
      pattern, // ✅ saved ONCE
    });

    if (error) {
      alert("Failed to save game: " + error.message);
    }
  };

  /* ================= LIVE UPDATE ================= */
  useEffect(() => {
    if (!code) return;

    const update = async () => {
      await updateGameState(code, currentStep, revealed);
    };

    update();
  }, [code, currentStep, revealed]);

  /* ================= CONTROLS ================= */
  const playPause = async () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      await audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white font-['Press_Start_2P']">
        <form onSubmit={submitPin} className="bg-black/70 p-6 rounded-xl">
          <h1 className="text-xl mb-4 text-center">HOST LOGIN</h1>
          <input
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="w-full p-3 bg-black border border-white/30 rounded"
            placeholder="Enter PIN"
          />
          <button className="mt-4 w-full border-2 border-cyan-400 py-2 rounded">
            ENTER
          </button>
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
      }}
    >
      <div className="bg-black/60 p-6 rounded-xl max-w-4xl mx-auto">
        <h1 className="text-xl mb-4">HOST</h1>

        {/* FILES */}
        <input
          type="file"
          multiple
          accept="audio/*"
          onChange={(e) => setAudioFiles(Array.from(e.target.files || []))}
          className="mb-4 text-xs"
        />

        {/* PATTERN DROPDOWN */}
        <label className="block text-xs mb-1">Win Pattern</label>
        <select
          value={pattern}
          onChange={(e) => setPattern(e.target.value as Pattern)}
          className="w-full mb-4 bg-black border border-cyan-400 p-2 rounded"
        >
          <option value="regular">Regular</option>
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

        <button
          onClick={startGame}
          className="w-full border-2 border-lime-400 py-3 rounded mb-4"
        >
          START GAME
        </button>

        {code && (
          <>
            <button
              onClick={() => setShowCode((s) => !s)}
              className="border border-cyan-400 px-4 py-2 rounded mb-3"
            >
              {showCode ? "HIDE CODE" : "SHOW CODE"}
            </button>

            {showCode && (
              <div className="text-5xl tracking-[0.4em] mb-4">{code}</div>
            )}

            <div className="flex gap-2 mb-4">
              <button onClick={() => playPause()} className="border px-3 py-2">
                {isPlaying ? "PAUSE" : "PLAY"}
              </button>
              <button
                onClick={() => {
                  setRevealed(true);
                }}
                className="border px-3 py-2"
              >
                REVEAL
              </button>
              <button
                onClick={() => {
                  setRevealed(false);
                }}
                className="border px-3 py-2"
              >
                HIDE
              </button>
            </div>
          </>
        )}

        <audio ref={audioRef} />
      </div>
    </main>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {

    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    router.push(`/game/${cleaned}`);
  };

  return (
    <main className="min-h-screen text-white flex flex-col items-center justify-center p-6 bg-black/10">

      <form
        onSubmit={handleSubmit}
        className="bg-slate-800 p-6 rounded-lg w-full max-width-sm max-w-sm"
      >
        <h1 className="text-3xl font-bold mb-4 text-center">Join Game</h1>

        <label className="block mb-3">
          <span className="block mb-1 text-sm text-slate-300">
            Enter game code from TV
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={10}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-center text-2xl tracking-[0.4em]"
            placeholder="ABCDE"
          />
        </label>

        <button
          type="submit"
          className="mt-4 px-6 py-3 w-full rounded bg-fuchsia-600 hover:bg-fuchsia-500 shadow-[0_0_10px_#f0f,0_0_20px_#f0f] text-white font-semibold transition"

        >
          Join
        </button>
      </form>
    </main>
  );
}

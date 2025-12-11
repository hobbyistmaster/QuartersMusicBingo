"use client";

import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="min-h-screen text-white flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="bg-black/50 border border-white/10 rounded-2xl shadow-xl px-6 py-8 max-w-lg w-full flex flex-col items-center gap-6">
        {/* Logo / Picture */}
        <div className="relative w-64 h-64 mb-2">
          <Image
            src="/quarters-bg.jpg"
            alt="Quarters Music Bingo"
            fill
            className="object-contain rounded-xl"
            priority
          />
        </div>

        {/* Title */}
        <h1 className="text-center text-2xl md:text-3xl mb-1">
          QUARTERS MUSIC BINGO
        </h1>

        <p className="text-xs text-center text-slate-200 mb-4">
          Select your role to get started
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-4 w-full">
          <Link
            href="/host"
            className="w-full text-center px-6 py-3 rounded-xl bg-[#ff00cc] hover:bg-[#ff33dd] text-white font-semibold shadow-[0_0_10px_#ff00cc,0_0_20px_#ff00cc] transition"
          >
            HOST GAME
          </Link>

          <Link
            href="/join"
            className="w-full text-center px-6 py-3 rounded-xl bg-[#00eaff] hover:bg-[#33eeff] text-black font-semibold shadow-[0_0_10px_#00eaff,0_0_20px_#00eaff] transition"
          >
            JOIN GAME
          </Link>
        </div>
      </div>
    </main>
  );
}

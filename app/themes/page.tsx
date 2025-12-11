"use client";

import { useState } from "react";
import { themes } from "@/app/data/themes";

export default function ThemesPage() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const themeList = Object.entries(themes); // [ ["80s", {...}], ...]

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Edit Themes</h1>

      <div className="flex flex-col gap-4 max-w-md">
        {themeList.map(([key, theme]) => (
          <button
            key={key}
            onClick={() => setSelectedKey(key)}
            className="bg-slate-800 border border-slate-700 rounded p-3 text-left hover:bg-slate-700"
          >
            {theme.displayName}
          </button>
        ))}
      </div>

      {selectedKey && <ThemeEditor themeKey={selectedKey} />}
    </main>
  );
}

function ThemeEditor({ themeKey }: { themeKey: string }) {
  const theme = themes[themeKey];

  const [text, setText] = useState(theme.songs.join("\n"));

  // Convert textarea → array
  const parsedSongs = text
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return (
    <div className="mt-10 p-6 bg-slate-800 border border-slate-700 rounded max-w-2xl">
      <h2 className="text-xl font-bold mb-4">
        Editing Theme: {theme.displayName}
      </h2>

      <label className="block mb-2 text-slate-300">
        Paste songs (one per line)
      </label>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full h-60 bg-slate-900 border border-slate-700 rounded p-3"
      />

      <h3 className="text-lg font-semibold mt-6 mb-2">Preview:</h3>

      {parsedSongs.length === 0 && (
        <p className="text-slate-400">No songs yet.</p>
      )}

      <ul className="list-disc list-inside space-y-1">
        {parsedSongs.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>

      <p className="mt-6 text-slate-400 text-sm">
        To save: copy the text above and paste into <code>themes.ts</code> under
        <strong> {themeKey}.songs</strong>
      </p>
    </div>
  );
}

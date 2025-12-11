export type BingoCell = {
  label: string;
  isFree: boolean;
  marked: boolean;
};

export function generateBingoCard(songs: string[]): BingoCell[][] {
  // Need at least 24 songs (5x5 grid minus 1 free center)
  const pool = [...songs];
  if (pool.length < 24) {
    throw new Error("Not enough songs to build a bingo card (need 24+).");
  }

  // Shuffle the songs to pick the first 24
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const selected = pool.slice(0, 24);

  const grid: BingoCell[][] = [];
  let index = 0;

  for (let row = 0; row < 5; row++) {
    const rowCells: BingoCell[] = [];

    for (let col = 0; col < 5; col++) {
      const isCenter = row === 2 && col === 2;

      rowCells.push(
        isCenter
          ? {
              label: "FREE",
              isFree: true,
              marked: true,
            }
          : {
              label: selected[index++],
              isFree: false,
              marked: false,
            }
      );
    }

    grid.push(rowCells);
  }

  return grid;
}

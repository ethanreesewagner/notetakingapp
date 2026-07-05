"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, ArrowLeft, Trophy } from "lucide-react";
import type { Flashcard } from "../../lib/apiClient";

interface Tile {
  key: string;
  cardId: string;
  text: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MAX_PAIRS = 6;

export default function MatchingGame({
  cards,
  onExit,
}: {
  cards: Flashcard[];
  onExit: () => void;
}) {
  const [round, setRound] = useState(0);

  // Pick up to MAX_PAIRS cards (that have both sides) and build shuffled tiles.
  const { tiles, pairCount } = useMemo(() => {
    const usable = cards.filter((c) => c.front.trim() && c.back.trim());
    const chosen = shuffle(usable).slice(0, MAX_PAIRS);
    const t: Tile[] = [];
    for (const c of chosen) {
      t.push({ key: `${c.id}-f`, cardId: c.id, text: c.front });
      t.push({ key: `${c.id}-b`, cardId: c.id, text: c.back });
    }
    return { tiles: shuffle(t), pairCount: chosen.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, round]);

  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  const done = pairCount > 0 && matched.size === pairCount;

  // Timer.
  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => window.clearInterval(id);
  }, [done, startedAt]);

  const reset = () => {
    setSelected(null);
    setMatched(new Set());
    setWrong([]);
    setMoves(0);
    setStartedAt(Date.now());
    setElapsed(0);
    setRound((r) => r + 1);
  };

  const clickTile = (tile: Tile) => {
    if (done || wrong.length > 0) return;
    if (matched.has(tile.cardId)) return;
    if (selected === tile.key) return;

    if (!selected) {
      setSelected(tile.key);
      return;
    }

    const first = tiles.find((t) => t.key === selected)!;
    setMoves((m) => m + 1);

    if (first.cardId === tile.cardId) {
      // Correct pair.
      setMatched((prev) => new Set(prev).add(tile.cardId));
      setSelected(null);
    } else {
      // Wrong — flash both then clear.
      setWrong([first.key, tile.key]);
      setSelected(null);
      window.setTimeout(() => setWrong([]), 700);
    }
  };

  const seconds = Math.floor(elapsed / 1000);
  const timeStr = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  if (pairCount === 0) {
    return (
      <div className="fc-empty-state">
        <p>Add at least one card with both a front and back to play matching.</p>
        <button className="fc-btn" onClick={onExit}>
          <ArrowLeft size={15} /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="fc-match">
      <div className="fc-match-bar">
        <button className="fc-btn ghost" onClick={onExit}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="fc-match-stats">
          <span>⏱ {timeStr}</span>
          <span>Moves: {moves}</span>
          <span>
            {matched.size}/{pairCount}
          </span>
        </div>
        <button className="fc-btn ghost" onClick={reset}>
          <RotateCcw size={15} /> Restart
        </button>
      </div>

      {done ? (
        <div className="fc-match-done">
          <Trophy size={40} className="fc-trophy" />
          <h3>Matched them all!</h3>
          <p>
            {pairCount} pairs in {timeStr} • {moves} moves
          </p>
          <div className="fc-match-done-actions">
            <button className="fc-btn primary" onClick={reset}>
              <RotateCcw size={15} /> Play again
            </button>
            <button className="fc-btn" onClick={onExit}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="fc-match-grid">
          {tiles.map((tile) => {
            const isMatched = matched.has(tile.cardId);
            const isSelected = selected === tile.key;
            const isWrong = wrong.includes(tile.key);
            return (
              <button
                key={tile.key}
                className={`fc-tile ${isMatched ? "matched" : ""} ${
                  isSelected ? "selected" : ""
                } ${isWrong ? "wrong" : ""}`}
                onClick={() => clickTile(tile)}
                disabled={isMatched}
              >
                {tile.text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

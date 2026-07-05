"use client";

import { useEffect, useState } from "react";
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  Pencil,
  Check,
  ArrowLeft,
  Layers,
  GraduationCap,
  Puzzle,
  Loader2,
} from "lucide-react";
import {
  getDecksApi,
  createDeckApi,
  renameDeckApi,
  deleteDeckApi,
  getCardsApi,
  addCardApi,
  updateCardApi,
  deleteCardApi,
  generateFlashcardsApi,
  type Deck,
  type Flashcard,
} from "../lib/apiClient";
import { isDue } from "../lib/srs";
import StudySession from "./flashcards/StudySession";
import MatchingGame from "./flashcards/MatchingGame";

type Subview = "browse" | "study" | "match";

export default function FlashcardsModal({
  activePageId,
  activePageTitle,
  onClose,
}: {
  activePageId: string | null;
  activePageTitle: string | null;
  onClose: () => void;
}) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [selected, setSelected] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [subview, setSubview] = useState<Subview>("browse");

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deck rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  // Card add / edit
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");

  useEffect(() => {
    getDecksApi()
      .then(setDecks)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load decks"))
      .finally(() => setLoadingDecks(false));
  }, []);

  const openDeck = async (deck: Deck) => {
    setSelected(deck);
    setSubview("browse");
    setLoadingCards(true);
    setError(null);
    try {
      setCards(await getCardsApi(deck.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cards");
    } finally {
      setLoadingCards(false);
    }
  };

  const backToList = () => {
    setSelected(null);
    setCards([]);
    setSubview("browse");
  };

  const generate = async () => {
    if (!activePageId) {
      setError("Open a note first, then generate flashcards from it.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const { deck, cards: newCards } = await generateFlashcardsApi(activePageId);
      setDecks((prev) => [deck, ...prev]);
      setSelected(deck);
      setCards(newCards);
      setSubview("browse");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate flashcards");
    } finally {
      setGenerating(false);
    }
  };

  const createEmptyDeck = async () => {
    try {
      const deck = await createDeckApi("New deck");
      setDecks((prev) => [deck, ...prev]);
      openDeck(deck);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create deck");
    }
  };

  const commitRename = async (id: string) => {
    const name = renameText.trim() || "Untitled deck";
    setDecks((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
    if (selected?.id === id) setSelected({ ...selected, name });
    setRenamingId(null);
    renameDeckApi(id, name).catch(() => {});
  };

  const removeDeck = async (id: string) => {
    setDecks((prev) => prev.filter((d) => d.id !== id));
    if (selected?.id === id) backToList();
    deleteDeckApi(id).catch(() => {});
  };

  const addCard = async () => {
    if (!selected || !newFront.trim()) return;
    try {
      const card = await addCardApi(selected.id, newFront.trim(), newBack.trim());
      setCards((prev) => [...prev, card]);
      setDecks((prev) =>
        prev.map((d) => (d.id === selected.id ? { ...d, cardCount: d.cardCount + 1 } : d))
      );
      setNewFront("");
      setNewBack("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add card");
    }
  };

  const saveEdit = (cardId: string) => {
    if (!selected) return;
    const front = editFront.trim();
    const back = editBack.trim();
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, front, back } : c)));
    updateCardApi(selected.id, cardId, { front, back }).catch(() => {});
    setEditCardId(null);
  };

  const removeCard = (cardId: string) => {
    if (!selected) return;
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setDecks((prev) =>
      prev.map((d) =>
        d.id === selected.id ? { ...d, cardCount: Math.max(0, d.cardCount - 1) } : d
      )
    );
    deleteCardApi(selected.id, cardId).catch(() => {});
  };

  const handleReview = (
    cardId: string,
    srs: Pick<Flashcard, "dueAt" | "interval" | "ease" | "reps" | "lapses">
  ) => {
    if (!selected) return;
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...srs } : c)));
    updateCardApi(selected.id, cardId, srs).catch(() => {});
  };

  const now = Date.now();
  const dueCount = cards.filter((c) => isDue(c, now)).length;

  return (
    <div className="fc-overlay" onClick={onClose}>
      <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="fc-header">
          <span className="fc-header-title">
            <Layers size={16} />
            {selected ? selected.name : "Flashcards"}
          </span>
          <button className="fc-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && <div className="fc-error">{error}</div>}

        {/* ── Deck list ──────────────────────────────────────────── */}
        {!selected && (
          <div className="fc-body">
            <div className="fc-actions-row">
              <button
                className="fc-btn primary"
                onClick={generate}
                disabled={generating}
                title={
                  activePageId
                    ? `Summarize "${activePageTitle || "this note"}" into cards`
                    : "Open a note first"
                }
              >
                {generating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Generate from current note
                  </>
                )}
              </button>
              <button className="fc-btn" onClick={createEmptyDeck}>
                <Plus size={15} /> New deck
              </button>
            </div>
            {activePageId && (
              <p className="fc-hint">
                AI will read <strong>{activePageTitle || "the open note"}</strong> and turn it into a deck.
              </p>
            )}

            {loadingDecks ? (
              <div className="fc-loading">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : decks.length === 0 ? (
              <div className="fc-empty-state">
                <p>No decks yet. Generate one from a note or create an empty deck.</p>
              </div>
            ) : (
              <div className="fc-deck-list">
                {decks.map((deck) => (
                  <div key={deck.id} className="fc-deck-row">
                    {renamingId === deck.id ? (
                      <input
                        className="fc-rename-input"
                        value={renameText}
                        autoFocus
                        onChange={(e) => setRenameText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(deck.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        onBlur={() => commitRename(deck.id)}
                      />
                    ) : (
                      <button className="fc-deck-main" onClick={() => openDeck(deck)}>
                        <Layers size={16} className="fc-deck-icon" />
                        <span className="fc-deck-info">
                          <span className="fc-deck-name">{deck.name}</span>
                          <span className="fc-deck-meta">
                            {deck.cardCount} card{deck.cardCount === 1 ? "" : "s"}
                            {deck.sourcePageTitle ? ` · from ${deck.sourcePageTitle}` : ""}
                          </span>
                        </span>
                      </button>
                    )}
                    <div className="fc-deck-actions">
                      <button
                        className="fc-icon-btn"
                        onClick={() => {
                          setRenamingId(deck.id);
                          setRenameText(deck.name);
                        }}
                        aria-label="Rename deck"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="fc-icon-btn danger"
                        onClick={() => removeDeck(deck.id)}
                        aria-label="Delete deck"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Deck detail ────────────────────────────────────────── */}
        {selected && subview === "browse" && (
          <div className="fc-body">
            <div className="fc-deck-toolbar">
              <button className="fc-btn ghost" onClick={backToList}>
                <ArrowLeft size={15} /> Decks
              </button>
              <div className="fc-deck-toolbar-right">
                <button
                  className="fc-btn primary"
                  onClick={() => setSubview("study")}
                  disabled={cards.length === 0}
                >
                  <GraduationCap size={15} /> Study
                  {dueCount > 0 && <span className="fc-due-badge">{dueCount}</span>}
                </button>
                <button
                  className="fc-btn"
                  onClick={() => setSubview("match")}
                  disabled={cards.length < 2}
                >
                  <Puzzle size={15} /> Match
                </button>
              </div>
            </div>

            {loadingCards ? (
              <div className="fc-loading">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : (
              <>
                <div className="fc-card-list">
                  {cards.map((card, i) => (
                    <div key={card.id} className="fc-card-row">
                      <span className="fc-card-num">{i + 1}</span>
                      {editCardId === card.id ? (
                        <div className="fc-card-edit">
                          <textarea
                            className="fc-edit-area"
                            value={editFront}
                            onChange={(e) => setEditFront(e.target.value)}
                            placeholder="Front"
                            rows={2}
                          />
                          <textarea
                            className="fc-edit-area"
                            value={editBack}
                            onChange={(e) => setEditBack(e.target.value)}
                            placeholder="Back"
                            rows={2}
                          />
                          <button
                            className="fc-icon-btn"
                            onClick={() => saveEdit(card.id)}
                            aria-label="Save"
                          >
                            <Check size={15} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="fc-card-content">
                            <div className="fc-card-front-text">{card.front}</div>
                            <div className="fc-card-back-text">{card.back || "—"}</div>
                          </div>
                          <div className="fc-card-row-actions">
                            <button
                              className="fc-icon-btn"
                              onClick={() => {
                                setEditCardId(card.id);
                                setEditFront(card.front);
                                setEditBack(card.back);
                              }}
                              aria-label="Edit card"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className="fc-icon-btn danger"
                              onClick={() => removeCard(card.id)}
                              aria-label="Delete card"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <div className="fc-empty-state">
                      <p>No cards yet. Add one below.</p>
                    </div>
                  )}
                </div>

                <div className="fc-add-card">
                  <input
                    className="fc-add-input"
                    placeholder="Front (question / term)"
                    value={newFront}
                    onChange={(e) => setNewFront(e.target.value)}
                  />
                  <input
                    className="fc-add-input"
                    placeholder="Back (answer)"
                    value={newBack}
                    onChange={(e) => setNewBack(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addCard();
                    }}
                  />
                  <button className="fc-btn primary" onClick={addCard} disabled={!newFront.trim()}>
                    <Plus size={15} /> Add
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {selected && subview === "study" && (
          <div className="fc-body">
            <StudySession
              cards={cards}
              onReview={handleReview}
              onExit={() => setSubview("browse")}
            />
          </div>
        )}

        {selected && subview === "match" && (
          <div className="fc-body">
            <MatchingGame cards={cards} onExit={() => setSubview("browse")} />
          </div>
        )}
      </div>
    </div>
  );
}

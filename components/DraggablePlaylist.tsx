"use client";

import { useState } from "react";
import { GripVertical, Pencil, Trash2, Check } from "lucide-react";

export interface PlaylistItem {
  id: string;
  videoId: string;
  title: string;
  artist: string;
}

// A drag-to-reorder list with inline rename and delete. Used for both the
// music tracks and the background-video lectures.
export default function DraggablePlaylist({
  items,
  activeId,
  playing,
  emptyText,
  onPlay,
  onRename,
  onDelete,
  onReorder,
}: {
  items: PlaylistItem[];
  activeId?: string | null;
  playing?: boolean;
  emptyText: string;
  onPlay: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  if (items.length === 0) {
    return <div className="media-empty">{emptyText}</div>;
  }

  const commitEdit = () => {
    if (editId) onRename(editId, editText.trim() || "Untitled");
    setEditId(null);
  };

  return (
    <div className="media-list">
      {items.map((it, i) => {
        const isEditing = editId === it.id;
        return (
          <div
            key={it.id}
            className={`media-row ${activeId === it.id ? "active" : ""} ${
              overIdx === i && dragIdx !== null ? "drag-over" : ""
            } ${dragIdx === i ? "dragging" : ""}`}
            draggable={!isEditing}
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIdx(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx !== null) onReorder(dragIdx, i);
              setDragIdx(null);
              setOverIdx(null);
            }}
            onDragEnd={() => {
              setDragIdx(null);
              setOverIdx(null);
            }}
          >
            <span className="media-grip" title="Drag to reorder">
              <GripVertical size={14} />
            </span>

            {isEditing ? (
              <input
                className="media-edit-input"
                value={editText}
                autoFocus
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditId(null);
                }}
                onBlur={commitEdit}
              />
            ) : (
              <button className="media-main" onClick={() => onPlay(it.id)}>
                <span className="media-index">
                  {activeId === it.id && playing ? (
                    <span className="music-bars">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="media-meta">
                  <span className="media-title">{it.title}</span>
                  <span className="media-artist">{it.artist}</span>
                </span>
              </button>
            )}

            <span className="media-actions">
              {isEditing ? (
                <button
                  className="media-action"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={commitEdit}
                  aria-label="Save title"
                >
                  <Check size={13} />
                </button>
              ) : (
                <button
                  className="media-action"
                  onClick={() => {
                    setEditId(it.id);
                    setEditText(it.title);
                  }}
                  aria-label="Rename"
                >
                  <Pencil size={13} />
                </button>
              )}
              <button
                className="media-action danger"
                onClick={() => onDelete(it.id)}
                aria-label="Delete"
              >
                <Trash2 size={13} />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

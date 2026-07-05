"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { orderBetween } from "./youtube";
import type { SavedMedia } from "./apiClient";

interface PlaylistApi {
  get: () => Promise<SavedMedia[]>;
  add: (url: string, title?: string) => Promise<SavedMedia>;
  update: (id: string, updates: { title?: string; order?: number }) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}

// Manages a user's saved media playlist with optimistic add / rename / delete /
// drag-reorder, persisting changes through the supplied API functions.
export function useMediaPlaylist(api: PlaylistApi, enabled: boolean) {
  const [items, setItems] = useState<SavedMedia[]>([]);

  const apiRef = useRef(api);
  apiRef.current = api;
  const itemsRef = useRef<SavedMedia[]>([]);
  itemsRef.current = items;

  // Load (or clear) when auth state flips.
  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }
    apiRef.current
      .get()
      .then((list) => setItems(list.slice().sort((a, b) => a.order - b.order)))
      .catch(() => {});
  }, [enabled]);

  const add = useCallback(async (url: string, title?: string) => {
    const saved = await apiRef.current.add(url, title);
    setItems((prev) => [...prev, saved].sort((a, b) => a.order - b.order));
    return saved;
  }, []);

  const rename = useCallback((id: string, title: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, title } : it)));
    apiRef.current.update(id, { title }).catch(() => {});
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    apiRef.current.remove(id).catch(() => {});
  }, []);

  // Move the item at fromIdx so it lands at toIdx, persisting a single new
  // fractional order value for the moved item.
  const reorder = useCallback((fromIdx: number, toIdx: number) => {
    const prev = itemsRef.current;
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= prev.length) {
      return;
    }
    const arr = [...prev];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    const newOrder = orderBetween(arr[toIdx - 1]?.order, arr[toIdx + 1]?.order);
    arr[toIdx] = { ...moved, order: newOrder };
    setItems(arr);
    apiRef.current.update(moved.id, { order: newOrder }).catch(() => {});
  }, []);

  return { items, add, rename, remove, reorder };
}

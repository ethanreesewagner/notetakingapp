interface FetchOptions extends RequestInit {
  body?: any;
}

export async function fetchWithAuth(url: string, options: FetchOptions = {}) {
  const headers = new Headers(options.headers || {});

  if (options.body && typeof options.body === "object") {
    options.body = JSON.stringify(options.body);
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      /* response was not JSON */
    }
    throw new Error(
      message.length > 300 ? `${message.slice(0, 300)}…` : message
    );
  }
  return res.json();
}

export async function fetchPages() {
  return fetchWithAuth("/api/pages");
}

export async function createPageApi(
  title: string = "Untitled",
  parentId?: string | null
) {
  return fetchWithAuth("/api/pages", {
    method: "POST",
    body: { title, parentId: parentId ?? null },
  });
}

export async function updatePageApi(
  id: string,
  updates: { title?: string; content?: string; parentId?: string | null }
) {
  return fetchWithAuth(`/api/pages/${id}`, {
    method: "PUT",
    body: updates,
  });
}

export async function fetchChatMessages() {
  return fetchWithAuth("/api/chat/messages") as Promise<{
    messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      createdAt: string;
    }>;
  }>;
}

export async function loginApi(email: string, password: string) {
  return fetchWithAuth("/api/auth/login", {
    method: "POST",
    body: { email, password },
  }) as Promise<{ user: { uid: string; email: string | null; displayName: string | null } }>;
}

export async function signupApi(
  email: string,
  password: string,
  name: string
) {
  return fetchWithAuth("/api/auth/signup", {
    method: "POST",
    body: { email, password, name },
  }) as Promise<{ user: { uid: string; email: string | null; displayName: string | null } }>;
}

export async function logoutApi() {
  return fetchWithAuth("/api/auth/logout", { method: "POST" });
}

// ── User profile ──────────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  email: string;
  bio: string;
  photoURL: string;
}

export async function getProfileApi(): Promise<UserProfile> {
  return fetchWithAuth("/api/profile");
}

export async function updateProfileApi(
  updates: Partial<Pick<UserProfile, "name" | "bio" | "photoURL">>
) {
  return fetchWithAuth("/api/profile", { method: "PUT", body: updates });
}

// ── Page sharing ──────────────────────────────────────────────────────────────

export async function createShareApi(
  pageId: string,
  type: "public" | "private",
  emails: string[] = []
) {
  return fetchWithAuth(`/api/pages/${pageId}/share`, {
    method: "POST",
    body: { type, emails },
  });
}

export async function getShareApi(pageId: string) {
  return fetchWithAuth(`/api/pages/${pageId}/share`);
}

export async function deleteShareApi(pageId: string) {
  return fetchWithAuth(`/api/pages/${pageId}/share`, { method: "DELETE" });
}

// ── Page deletion ─────────────────────────────────────────────────────────────

export async function deletePageApi(pageId: string) {
  return fetchWithAuth(`/api/pages/${pageId}`, { method: "DELETE" });
}

// ── Shared with me ────────────────────────────────────────────────────────────

export interface SharedWithMeEntry {
  shareId: string;
  pageId: string;
  pageTitle: string;
  ownerUid: string;
  ownerEmail: string;
  token: string;
  url: string;
}

export async function getSharedWithMeApi(): Promise<SharedWithMeEntry[]> {
  return fetchWithAuth("/api/shares");
}

// ── Personal media playlists (music tracks & background-video lectures) ────────

export interface SavedMedia {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  order: number;
  createdAt: string;
}

// Music tracks
export type SavedTrack = SavedMedia;

export async function getTracksApi(): Promise<SavedTrack[]> {
  return fetchWithAuth("/api/tracks");
}

export async function addTrackApi(url: string, title?: string): Promise<SavedTrack> {
  return fetchWithAuth("/api/tracks", { method: "POST", body: { url, title } });
}

export async function updateTrackApi(
  id: string,
  updates: { title?: string; order?: number }
) {
  return fetchWithAuth(`/api/tracks/${id}`, { method: "PUT", body: updates });
}

export async function deleteTrackApi(id: string) {
  return fetchWithAuth(`/api/tracks/${id}`, { method: "DELETE" });
}

// Background-video lectures
export type SavedLecture = SavedMedia;

export async function getLecturesApi(): Promise<SavedLecture[]> {
  return fetchWithAuth("/api/lectures");
}

export async function addLectureApi(url: string, title?: string): Promise<SavedLecture> {
  return fetchWithAuth("/api/lectures", { method: "POST", body: { url, title } });
}

export async function updateLectureApi(
  id: string,
  updates: { title?: string; order?: number }
) {
  return fetchWithAuth(`/api/lectures/${id}`, { method: "PUT", body: updates });
}

export async function deleteLectureApi(id: string) {
  return fetchWithAuth(`/api/lectures/${id}`, { method: "DELETE" });
}

// ── Flashcards (decks & cards) ─────────────────────────────────────────────────

export interface Deck {
  id: string;
  name: string;
  sourcePageId: string | null;
  sourcePageTitle: string | null;
  cardCount: number;
  createdAt: string | null;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  order: number;
  dueAt: number;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
}

export async function getDecksApi(): Promise<Deck[]> {
  return fetchWithAuth("/api/decks");
}

export async function createDeckApi(name: string): Promise<Deck> {
  return fetchWithAuth("/api/decks", { method: "POST", body: { name } });
}

export async function renameDeckApi(id: string, name: string) {
  return fetchWithAuth(`/api/decks/${id}`, { method: "PUT", body: { name } });
}

export async function deleteDeckApi(id: string) {
  return fetchWithAuth(`/api/decks/${id}`, { method: "DELETE" });
}

export async function getCardsApi(deckId: string): Promise<Flashcard[]> {
  return fetchWithAuth(`/api/decks/${deckId}/cards`);
}

export async function addCardApi(
  deckId: string,
  front: string,
  back: string
): Promise<Flashcard> {
  return fetchWithAuth(`/api/decks/${deckId}/cards`, {
    method: "POST",
    body: { front, back },
  });
}

export async function updateCardApi(
  deckId: string,
  cardId: string,
  updates: Partial<Pick<Flashcard, "front" | "back" | "order" | "dueAt" | "interval" | "ease" | "reps" | "lapses">>
) {
  return fetchWithAuth(`/api/decks/${deckId}/cards/${cardId}`, {
    method: "PUT",
    body: updates,
  });
}

export async function deleteCardApi(deckId: string, cardId: string) {
  return fetchWithAuth(`/api/decks/${deckId}/cards/${cardId}`, { method: "DELETE" });
}

export async function generateFlashcardsApi(
  pageId: string
): Promise<{ deck: Deck; cards: Flashcard[] }> {
  return fetchWithAuth("/api/flashcards/generate", {
    method: "POST",
    body: { pageId },
  });
}


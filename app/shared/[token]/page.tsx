"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { FileText, Lock, Globe, ArrowLeft, Loader2, AlertCircle } from "lucide-react";

interface SharedPageData {
  id: string;
  title: string;
  content: string;
  ownerEmail: string;
  shareType: "public" | "private";
}

type PageState =
  | { status: "loading" }
  | { status: "loaded"; data: SharedPageData }
  | { status: "auth_required" }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "error"; message: string };

export default function SharedNotePage() {
  const params = useParams();
  const token = params?.token as string;
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "not_found" });
      return;
    }

    fetch(`/api/shared/${token}`, { credentials: "include" })
      .then(async (res) => {
        if (res.status === 401) {
          setState({ status: "auth_required" });
          return;
        }
        if (res.status === 403) {
          setState({ status: "forbidden" });
          return;
        }
        if (res.status === 404) {
          setState({ status: "not_found" });
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({ status: "error", message: body.error ?? "Something went wrong." });
          return;
        }
        const data: SharedPageData = await res.json();
        setState({ status: "loaded", data });
      })
      .catch((err) => {
        setState({ status: "error", message: err.message ?? "Network error." });
      });
  }, [token]);

  return (
    <div className="shared-page-root">
      <div className="shared-page-container">
        {/* Top bar */}
        <div className="shared-page-topbar">
          <Link href="/" className="shared-page-back">
            <ArrowLeft size={16} />
            Back to app
          </Link>

          {state.status === "loaded" && (
            <div className="shared-page-badge">
              {state.data.shareType === "public" ? (
                <>
                  <Globe size={13} />
                  Public note
                </>
              ) : (
                <>
                  <Lock size={13} />
                  Private note
                </>
              )}
            </div>
          )}
        </div>

        {/* Content area */}
        {state.status === "loading" && <SharedLoading />}
        {state.status === "loaded" && <SharedContent data={state.data} />}
        {state.status === "auth_required" && <SharedAuthRequired />}
        {state.status === "forbidden" && <SharedForbidden />}
        {state.status === "not_found" && <SharedNotFound />}
        {state.status === "error" && <SharedError message={state.message} />}
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function SharedLoading() {
  return (
    <div className="shared-page-state">
      <Loader2 size={36} className="animate-spin" style={{ color: "var(--accent-color)" }} />
      <p className="shared-page-state-text">Loading shared note…</p>
    </div>
  );
}

function SharedContent({ data }: { data: SharedPageData }) {
  const parsedContent = (() => {
    try {
      if (data.content && data.content.startsWith("[")) {
        return JSON.parse(data.content);
      }
    } catch {
      // fall through
    }
    return undefined;
  })();

  const editor = useCreateBlockNote({
    initialContent: parsedContent,
  });

  return (
    <div className="shared-page-content">
      {/* Attribution */}
      <div className="shared-page-attribution">
        <span className="shared-page-owner-avatar">
          {(data.ownerEmail?.[0] ?? "?").toUpperCase()}
        </span>
        <span className="shared-page-owner-label">
          Shared by <strong>{data.ownerEmail}</strong>
        </span>
      </div>

      {/* Title */}
      <h1 className="shared-page-title">
        <FileText size={28} style={{ flexShrink: 0, color: "var(--accent-color)" }} />
        {data.title || "Untitled"}
      </h1>

      {/* Read-only editor */}
      <div className="shared-page-editor-wrap">
        <BlockNoteView editor={editor} editable={false} theme="light" />
      </div>
    </div>
  );
}

function SharedAuthRequired() {
  return (
    <div className="shared-page-state">
      <div className="shared-page-state-icon shared-page-state-icon--warn">
        <Lock size={28} />
      </div>
      <h2 className="shared-page-state-heading">Sign in required</h2>
      <p className="shared-page-state-text">
        This note is privately shared. You need to sign in with an authorised account to view it.
      </p>
      <Link href="/login" className="shared-page-state-btn">
        Sign in
      </Link>
    </div>
  );
}

function SharedForbidden() {
  return (
    <div className="shared-page-state">
      <div className="shared-page-state-icon shared-page-state-icon--error">
        <AlertCircle size={28} />
      </div>
      <h2 className="shared-page-state-heading">Access denied</h2>
      <p className="shared-page-state-text">
        Your account doesn't have permission to view this note. Ask the owner to share it with your email address.
      </p>
      <Link href="/" className="shared-page-state-btn">
        Go home
      </Link>
    </div>
  );
}

function SharedNotFound() {
  return (
    <div className="shared-page-state">
      <div className="shared-page-state-icon shared-page-state-icon--muted">
        <FileText size={28} />
      </div>
      <h2 className="shared-page-state-heading">Note not found</h2>
      <p className="shared-page-state-text">
        This share link is invalid or has been revoked by the owner.
      </p>
      <Link href="/" className="shared-page-state-btn">
        Go home
      </Link>
    </div>
  );
}

function SharedError({ message }: { message: string }) {
  return (
    <div className="shared-page-state">
      <div className="shared-page-state-icon shared-page-state-icon--error">
        <AlertCircle size={28} />
      </div>
      <h2 className="shared-page-state-heading">Something went wrong</h2>
      <p className="shared-page-state-text">{message}</p>
      <button className="shared-page-state-btn" onClick={() => window.location.reload()}>
        Try again
      </button>
    </div>
  );
}

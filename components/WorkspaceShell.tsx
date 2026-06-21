"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import ChatAgent from "./ChatAgent";
import Sidebar from "./sidebar";
import ShareModal from "./ShareModal";
import { useAuth } from "../lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Share2 } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "../store";

const BlockNoteEditor = dynamic(() => import("./BlockNoteEditor"), {
  ssr: false,
});

export default function WorkspaceShell() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { activePageId, pages } = useSelector((state: RootState) => state.page);
  const [shareOpen, setShareOpen] = useState(false);

  const activePage = pages.find((p) => p.id === activePageId) ?? null;

  if (loading) {
    return (
      <div className="auth-wrapper">
        <Loader2 className="animate-spin" color="var(--text-secondary)" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="auth-wrapper">
        <div className="glass-container auth-form" style={{ textAlign: "center" }}>
          <h1 className="auth-title">Welcome to Notion Clone</h1>
          <p className="auth-subtitle">Please sign in to access your notes.</p>
          <Link href="/login" className="btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="app-container">
      <Sidebar />
      <div className="main-content">
        {/* ── Slim top bar ── */}
        <div className="top-bar">
          <div className="top-bar-breadcrumb">
            {activePage ? (
              <span className="top-bar-page-name">{activePage.title || "Untitled"}</span>
            ) : (
              <span className="top-bar-page-name top-bar-page-name--empty">Select a page</span>
            )}
          </div>
          {activePageId && activePage && (
            <button
              id="share-btn"
              className="share-trigger-btn"
              onClick={() => setShareOpen(true)}
              title="Share this page"
            >
              <Share2 size={15} />
              Share
            </button>
          )}
        </div>

        <BlockNoteEditor key={activePageId || "empty"} />
      </div>

      <ChatAgent />

      {shareOpen && activePageId && activePage && (
        <ShareModal
          pageId={activePageId}
          pageTitle={activePage.title || "Untitled"}
          onClose={() => setShareOpen(false)}
        />
      )}
    </main>
  );
}

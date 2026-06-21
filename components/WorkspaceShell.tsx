"use client";

import dynamic from "next/dynamic";
import ChatAgent from "./ChatAgent";
import Sidebar from "./sidebar";
import { useAuth } from "../lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "../store";

const BlockNoteEditor = dynamic(() => import("./BlockNoteEditor"), {
  ssr: false,
});

export default function WorkspaceShell() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { activePageId } = useSelector((state: RootState) => state.page);

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
        <BlockNoteEditor key={activePageId || "empty"} />
      </div>
      <ChatAgent />
    </main>
  );
}

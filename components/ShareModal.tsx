"use client";

import { useEffect, useRef, useState } from "react";
import { createShareApi, deleteShareApi, getShareApi } from "../lib/apiClient";
import { Copy, Check, Globe, Lock, X, UserPlus, Trash2 } from "lucide-react";

interface ShareInfo {
  shareId: string;
  type: "public" | "private";
  emails: string[];
  token: string;
  url: string;
}

interface Props {
  pageId: string;
  pageTitle: string;
  onClose: () => void;
}

export default function ShareModal({ pageId, pageTitle, onClose }: Props) {
  const [tab, setTab] = useState<"public" | "private">("public");
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedPrivate, setCopiedPrivate] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getShareApi(pageId)
      .then((data: ShareInfo | null) => {
        if (data) {
          setShare(data);
          setTab(data.type);
          setEmails(data.emails ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pageId]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const addEmail = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && !emails.includes(trimmed)) {
      setEmails((prev) => [...prev, trimmed]);
    }
    setEmailInput("");
  };

  const removeEmail = (email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleShare = async (type: "public" | "private") => {
    setSaving(true);
    try {
      const result = await createShareApi(pageId, type, type === "private" ? emails : []);
      setShare(result as ShareInfo);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    setSaving(true);
    try {
      await deleteShareApi(pageId);
      setShare(null);
      setEmails([]);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (url: string, isPublic: boolean) => {
    navigator.clipboard.writeText(url);
    if (isPublic) {
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2000);
    } else {
      setCopiedPrivate(true);
      setTimeout(() => setCopiedPrivate(false), 2000);
    }
  };

  const activeShare = share?.type === tab ? share : null;

  return (
    <div className="share-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="share-modal" role="dialog" aria-modal="true" aria-label="Share page">
        <div className="share-modal-header">
          <div>
            <h2 className="share-modal-title">Share</h2>
            <p className="share-modal-subtitle">"{pageTitle}"</p>
          </div>
          <button className="share-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="share-tabs">
          <button
            className={`share-tab ${tab === "public" ? "active" : ""}`}
            onClick={() => setTab("public")}
          >
            <Globe size={15} />
            Public Link
          </button>
          <button
            className={`share-tab ${tab === "private" ? "active" : ""}`}
            onClick={() => setTab("private")}
          >
            <Lock size={15} />
            Private
          </button>
        </div>

        <div className="share-modal-body">
          {loading ? (
            <div className="share-loading">Loading…</div>
          ) : tab === "public" ? (
            <>
              <p className="share-description">
                Anyone with the link can view this page — no sign-in required.
              </p>

              {activeShare ? (
                <div className="share-link-row">
                  <input
                    className="share-link-input"
                    readOnly
                    value={activeShare.url}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className={`share-copy-btn ${copiedPublic ? "copied" : ""}`}
                    onClick={() => copyLink(activeShare.url, true)}
                  >
                    {copiedPublic ? <Check size={15} /> : <Copy size={15} />}
                    {copiedPublic ? "Copied!" : "Copy"}
                  </button>
                </div>
              ) : (
                <button
                  className="share-action-btn"
                  onClick={() => handleShare("public")}
                  disabled={saving}
                >
                  <Globe size={16} />
                  {saving ? "Creating link…" : "Generate public link"}
                </button>
              )}

              {activeShare && (
                <button className="share-revoke-btn" onClick={handleRevoke} disabled={saving}>
                  <Trash2 size={14} />
                  Revoke link
                </button>
              )}
            </>
          ) : (
            <>
              <p className="share-description">
                Only people with this specific email address can access the page.
              </p>

              {/* Email input */}
              <div className="share-email-row">
                <div className="share-email-input-wrap">
                  <UserPlus size={15} className="share-email-icon" />
                  <input
                    className="share-email-input"
                    type="email"
                    placeholder="Add email address…"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addEmail();
                      }
                    }}
                  />
                </div>
                <button className="share-add-email-btn" onClick={addEmail}>
                  Add
                </button>
              </div>

              {emails.length > 0 && (
                <div className="share-chips">
                  {emails.map((email) => (
                    <span key={email} className="share-chip">
                      {email}
                      <button
                        className="share-chip-remove"
                        onClick={() => removeEmail(email)}
                        aria-label={`Remove ${email}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <button
                className="share-action-btn"
                onClick={() => handleShare("private")}
                disabled={saving || emails.length === 0}
              >
                <Lock size={16} />
                {saving ? "Saving…" : activeShare ? "Update & copy link" : "Share privately"}
              </button>

              {activeShare && (
                <>
                  <div className="share-link-row" style={{ marginTop: "0.75rem" }}>
                    <input
                      className="share-link-input"
                      readOnly
                      value={activeShare.url}
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      className={`share-copy-btn ${copiedPrivate ? "copied" : ""}`}
                      onClick={() => copyLink(activeShare.url, false)}
                    >
                      {copiedPrivate ? <Check size={15} /> : <Copy size={15} />}
                      {copiedPrivate ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <button className="share-revoke-btn" onClick={handleRevoke} disabled={saving}>
                    <Trash2 size={14} />
                    Revoke access
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

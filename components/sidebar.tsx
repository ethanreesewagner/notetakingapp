"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { fetchPages, createPageApi, deletePageApi, getSharedWithMeApi, logoutApi } from "../lib/apiClient";
import type { SharedWithMeEntry } from "../lib/apiClient";
import { buildPageTree, type PageNode } from "../lib/pageTree";
import { setPages, setActivePageId, addPageLocally, removePageLocally } from "../store/pageSlice";
import { RootState } from "../store";
import {
  Plus,
  FileText,
  Loader2,
  ChevronRight,
  ChevronDown,
  LogOut,
  Trash2,
  Users,
  User,
} from "lucide-react";
import DeleteConfirmDialog from "./DeleteConfirmDialog";

function PageTreeItem({
  node,
  depth,
  activePageId,
  expandedIds,
  onToggleExpand,
  onSelect,
  onCreateSubpage,
  onDeleteRequest,
}: {
  node: PageNode;
  depth: number;
  activePageId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onCreateSubpage: (parentId: string) => void;
  onDeleteRequest: (node: PageNode) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isActive = activePageId === node.id;

  return (
    <div className="page-tree-item">
      <div
        className={`sidebar-btn page-tree-row ${isActive ? "active" : ""}`}
        style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
      >
        <button
          type="button"
          className="page-tree-toggle"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(node.id);
          }}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="page-tree-toggle-spacer" />
          )}
        </button>

        <button
          type="button"
          className="page-tree-label"
          onClick={() => onSelect(node.id)}
          title={node.title || "Untitled"}
        >
          <FileText size={16} style={{ flexShrink: 0 }} />
          <span className="page-tree-title">{node.title || "Untitled"}</span>
        </button>

        <div className="page-tree-actions">
          <button
            type="button"
            className="page-tree-add"
            onClick={(e) => {
              e.stopPropagation();
              onCreateSubpage(node.id);
            }}
            title="Add subpage"
            aria-label="Add subpage"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="page-tree-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRequest(node);
            }}
            title="Delete page"
            aria-label="Delete page"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="page-tree-children">
          {node.children.map((child) => (
            <PageTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activePageId={activePageId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onCreateSubpage={onCreateSubpage}
              onDeleteRequest={onDeleteRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Group shared-with-me entries by owner
function groupByOwner(entries: SharedWithMeEntry[]): Map<string, SharedWithMeEntry[]> {
  const map = new Map<string, SharedWithMeEntry[]>();
  for (const entry of entries) {
    const key = entry.ownerEmail || entry.ownerUid;
    const arr = map.get(key) ?? [];
    arr.push(entry);
    map.set(key, arr);
  }
  return map;
}

export default function Sidebar() {
  const { user, loading, refresh } = useAuth();
  const dispatch = useDispatch();
  const router = useRouter();
  const { pages, activePageId } = useSelector((state: RootState) => state.page);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<PageNode | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sidebar section collapse state
  const [myPagesOpen, setMyPagesOpen] = useState(true);
  const [sharedOpen, setSharedOpen] = useState(true);

  // Shared-with-me
  const [sharedWithMe, setSharedWithMe] = useState<SharedWithMeEntry[]>([]);
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());

  const pageTree = useMemo(() => buildPageTree(pages), [pages]);
  const sharedGroups = useMemo(() => groupByOwner(sharedWithMe), [sharedWithMe]);

  useEffect(() => {
    if (user?.uid) {
      fetchPages()
        .then((fetchedPages) => {
          dispatch(
            setPages(
              fetchedPages.map((p: { parentId?: string | null }) => ({
                ...p,
                parentId: p.parentId ?? null,
              }))
            )
          );
        })
        .catch((e) => console.error("Error fetching pages:", e));

      getSharedWithMeApi()
        .then(setSharedWithMe)
        .catch(() => {});
    }
  }, [user?.uid, dispatch]);

  useEffect(() => {
    if (!activePageId) return;
    const page = pages.find((p) => p.id === activePageId);
    if (!page?.parentId) return;

    setExpandedIds((prev) => {
      const next = new Set(prev);
      let current: string | null | undefined = page.parentId;
      while (current) {
        next.add(current);
        current = pages.find((p) => p.id === current)?.parentId;
      }
      return next;
    });
  }, [activePageId, pages]);

  const navigateToPage = (id: string) => {
    dispatch(setActivePageId(id));
    router.push(`/page/${id}`);
  };

  const handleCreatePage = async (parentId: string | null = null) => {
    if (!user?.uid) return;
    try {
      const newPage = await createPageApi("Untitled", parentId);
      dispatch(
        addPageLocally({
          ...newPage,
          parentId: newPage.parentId ?? parentId ?? null,
        })
      );
      dispatch(setActivePageId(newPage.id));
      router.push(`/page/${newPage.id}`);
      if (parentId) {
        setExpandedIds((prev) => new Set(prev).add(parentId));
      }
    } catch (error) {
      console.error("Error creating page:", error);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePageApi(deleteTarget.id);
      dispatch(removePageLocally(deleteTarget.id));
      router.push("/");
    } catch (err) {
      console.error("Error deleting page:", err);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleOwner = (ownerKey: string) => {
    setExpandedOwners((prev) => {
      const next = new Set(prev);
      if (next.has(ownerKey)) next.delete(ownerKey);
      else next.add(ownerKey);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="sidebar" style={{ justifyContent: "center", alignItems: "center" }}>
        <Loader2 className="animate-spin" color="var(--text-secondary)" />
      </div>
    );
  }

  return (
    <>
      <div className="sidebar">
        {/* ── My Pages section ─────────────────────────────────────── */}
        <div className="sidebar-section-header" onClick={() => setMyPagesOpen((v) => !v)}>
          <span className="sidebar-section-label">
            <User size={13} />
            My Pages
          </span>
          <span className="sidebar-section-chevron">
            {myPagesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        </div>

        {myPagesOpen && (
          <>
            <div className="sidebar-new-page">
              <button onClick={() => handleCreatePage(null)} className="sidebar-btn sidebar-new-page-btn">
                <Plus size={16} />
                <span>New Page</span>
              </button>
            </div>

            <div className="sidebar-nav">
              {pageTree.map((node) => (
                <PageTreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  activePageId={activePageId}
                  expandedIds={expandedIds}
                  onToggleExpand={toggleExpand}
                  onSelect={navigateToPage}
                  onCreateSubpage={(parentId) => handleCreatePage(parentId)}
                  onDeleteRequest={setDeleteTarget}
                />
              ))}
              {pages.length === 0 && (
                <div className="sidebar-nav-empty">No pages yet</div>
              )}
            </div>
          </>
        )}

        {/* ── Shared With Me section ───────────────────────────────── */}
        <div
          className="sidebar-section-header sidebar-section-header--shared"
          onClick={() => setSharedOpen((v) => !v)}
        >
          <span className="sidebar-section-label">
            <Users size={13} />
            Shared With Me
          </span>
          <span className="sidebar-section-chevron">
            {sharedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        </div>

        {sharedOpen && (
          <div className="sidebar-nav sidebar-nav--shared">
            {sharedGroups.size === 0 ? (
              <div className="sidebar-nav-empty">Nothing shared yet</div>
            ) : (
              [...sharedGroups.entries()].map(([ownerKey, entries]) => {
                const isOpen = expandedOwners.has(ownerKey);
                // Show just the username part of the email
                const displayName = ownerKey.includes("@")
                  ? ownerKey.split("@")[0]
                  : ownerKey;
                return (
                  <div key={ownerKey} className="shared-owner-group">
                    <button
                      className="shared-owner-row sidebar-btn"
                      onClick={() => toggleOwner(ownerKey)}
                      title={ownerKey}
                    >
                      <span className="shared-owner-avatar">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                      <span className="shared-owner-name">{displayName}</span>
                      <span className="shared-count">{entries.length}</span>
                      {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>

                    {isOpen && (
                      <div className="shared-pages-list">
                        {entries.map((entry) => (
                          <a
                            key={entry.shareId}
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shared-page-link sidebar-btn"
                          >
                            <FileText size={14} style={{ flexShrink: 0 }} />
                            <span className="page-tree-title">{entry.pageTitle}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div className="sidebar-footer">
          <button
            className="sign-out-btn"
            title="Sign Out"
            onClick={async () => {
              await logoutApi();
              await refresh();
              router.push("/login");
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          pageTitle={deleteTarget.title || "Untitled"}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </>
  );
}

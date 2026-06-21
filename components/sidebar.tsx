"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { fetchPages, createPageApi } from "../lib/apiClient";
import { buildPageTree, type PageNode } from "../lib/pageTree";
import { setPages, setActivePageId, addPageLocally } from "../store/pageSlice";
import { RootState } from "../store";
import { Plus, FileText, Loader2, ChevronRight, ChevronDown, LogOut } from "lucide-react";
import { logoutApi } from "../lib/apiClient";

function PageTreeItem({
  node,
  depth,
  activePageId,
  expandedIds,
  onToggleExpand,
  onSelect,
  onCreateSubpage,
}: {
  node: PageNode;
  depth: number;
  activePageId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onCreateSubpage: (parentId: string) => void;
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user, loading, refresh } = useAuth();
  const dispatch = useDispatch();
  const router = useRouter();
  const { pages, activePageId } = useSelector((state: RootState) => state.page);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const pageTree = useMemo(() => buildPageTree(pages), [pages]);

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

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">
          {user?.email ? user.email.split("@")[0] + "'s Notion" : "My Notion"}
        </h2>
        <button onClick={() => handleCreatePage(null)} className="sidebar-btn">
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
          />
        ))}
        {pages.length === 0 && (
          <div className="sidebar-nav-empty">No pages inside</div>
        )}
      </div>

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
  );
}

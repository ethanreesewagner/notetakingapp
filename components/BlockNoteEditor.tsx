"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../lib/auth';
import { RootState } from '../store';
import { updatePageApi, createPageApi } from '../lib/apiClient';
import { updateActivePageContent, updateActivePageTitle, setActivePageId, addPageLocally } from '../store/pageSlice';
import { getPageBreadcrumbs } from '../lib/pageTree';
import debounce from 'lodash.debounce';
import { useRouter } from 'next/navigation';

import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { FileText, Search, X, Plus, Loader2 } from "lucide-react";
import "@blocknote/mantine/style.css";

export default function BlockNoteEditor() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const router = useRouter();
  const { pages, activePageId, agentContentRevision } = useSelector(
    (state: RootState) => state.page
  );
  
  const activePage = pages.find((p) => p.id === activePageId);
  const breadcrumbs = activePageId
    ? getPageBreadcrumbs(pages, activePageId)
    : [];
  const [title, setTitle] = useState(activePage?.title || "");
  const [isPagePickerOpen, setIsPagePickerOpen] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const [isCreatingPage, setIsCreatingPage] = useState(false);

  // Update local title state when active page changes
  useEffect(() => {
    setTitle(activePage?.title || "");
  }, [activePageId]);

  // Safe parsing helper to maintain compatibility
  const parsedContent = useMemo(() => {
    if (!activePage?.content || activePage.content === '<p></p>') {
      return undefined;
    }
    try {
      if (activePage.content.startsWith('[')) {
        return JSON.parse(activePage.content);
      }
    } catch (e) {
      console.warn("Failed to parse BlockNote content", e);
    }
    return undefined;
  }, [activePage?.id, activePage?.content, agentContentRevision]);

  // Initialize Collaboration provider
  const provider = useMemo(() => {
    if (!activePageId) return null;
    const doc = new Y.Doc();
    // Using a uniquely prefixed room id
    return new WebrtcProvider(`notetakingapp-room-${activePageId}`, doc);
  }, [activePageId]);

  // Clean up provider on unmount/page change
  useEffect(() => {
    return () => {
      provider?.destroy();
    };
  }, [provider]);

  // Initialize BlockNote with Yjs collaboration
  const editor = useCreateBlockNote({
    collaboration: provider ? {
      provider,
      fragment: provider.doc.getXmlFragment("document-store"),
      user: {
        name: user?.email?.split('@')[0] || "Anonymous",
        color: "#" + Math.floor(Math.random()*16777215).toString(16)
      }
    } : undefined,
    links: {
      onClick: (event: any) => {
        const anchor = (event.target as HTMLElement).closest("a");
        if (anchor) {
          try {
            const url = new URL(anchor.href, window.location.href);
            if (
              url.origin === window.location.origin &&
              url.pathname.startsWith("/page/")
            ) {
              const pageId = url.pathname.split("/page/")[1];
              if (pageId) {
                dispatch(setActivePageId(pageId));
                router.push(url.pathname);
                event.preventDefault();
                return true;
              }
            }
          } catch (e) {
            console.error("Error handling link click", e);
          }
        }
        return false;
      },
    },
    // Note: When using collaboration, initialContent MUST be set via the collaboration provider.
    // Setting `initialContent` directly combined with `collaboration` causes BlockNote initialization failure.
    // However, if we're solely relying on standard DB fetching without actual server-side Yjs persistence,
    // we must manually populate the Yjs document ONLY IF IT IS EMPTY.
  });

  // Populate Yjs doc if it's empty (bootstrapping for the first client in standard REST flow)
  useEffect(() => {
    if (editor && parsedContent && provider) {
       // Since y-webrtc doesn't persist to our DB natively, we bridge it by loading our DB JSON 
       // if the Yjs doc is empty avoiding overwrites for secondary peers.
       const yXmlFragment = provider.doc.getXmlFragment("document-store");
       if (yXmlFragment.length === 0) {
          try {
             editor.replaceBlocks(editor.document, parsedContent);
          } catch(e) { console.error(e) }
       }
    }
  }, [editor, parsedContent, provider]);

  // Apply agent-driven content updates without remounting the editor
  useEffect(() => {
    if (!editor || !parsedContent || agentContentRevision === 0) return;
    try {
      editor.replaceBlocks(editor.document, parsedContent);
    } catch (e) {
      console.error("Failed to apply agent content update", e);
    }
  }, [agentContentRevision, editor, parsedContent]);

  // Debounced API call for title
  const debouncedTitleSave = useRef(
    debounce(async (pid: string, newTitle: string) => {
      await updatePageApi(pid, { title: newTitle });
    }, 1000)
  ).current;

  // Handle Title changes
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    if (user?.uid && activePageId) {
      dispatch(updateActivePageTitle({ id: activePageId, title: newTitle }));
      debouncedTitleSave(activePageId, newTitle);
    }
  };

  // Debounced API call for content
  const debouncedContentSave = useRef(
    debounce(async (pid: string, newContent: string) => {
      await updatePageApi(pid, { content: newContent });
    }, 1500)
  ).current;

  const handleSelectPage = (page: { id: string; title?: string }) => {
    if (!editor) return;

    editor.insertInlineContent([
      {
        type: "link",
        content: page.title || "Untitled",
        href: `/page/${page.id}`,
      },
    ]);

    setIsPagePickerOpen(false);
    setPageSearchQuery("");
    editor.focus();
  };

  const handleCreateAndLinkPage = async () => {
    if (!user?.uid || !editor || isCreatingPage) return;

    const title = pageSearchQuery.trim() || "Untitled";
    setIsCreatingPage(true);
    try {
      const newPage = await createPageApi(title, activePageId);
      dispatch(
        addPageLocally({
          ...newPage,
          parentId: newPage.parentId ?? activePageId ?? null,
        })
      );
      handleSelectPage(newPage);
    } catch (e) {
      console.error("Error creating page:", e);
    } finally {
      setIsCreatingPage(false);
    }
  };

  const filteredPages = pages.filter(p => 
    p.id !== activePageId && 
    (p.title || "Untitled").toLowerCase().includes(pageSearchQuery.toLowerCase())
  ).slice(0, 8);

  const customSlashMenuItems = (editor: any) => [
    ...getDefaultReactSlashMenuItems(editor),
    {
      title: "Link to Page",
      onItemClick: () => setIsPagePickerOpen(true),
      aliases: ["page", "link", "ref"],
      groupName: "Links",
      icon: <FileText size={18} />,
    },
  ];

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      debouncedContentSave.cancel();
      debouncedTitleSave.cancel();
    };
  }, [debouncedContentSave, debouncedTitleSave]);

  if (!activePage) {
    return (
      <div className="editor-message">
        Select or create a page to start taking notes.
      </div>
    );
  }

  // Next.js SSR hydration protection
  if (!editor) {
    return null;
  }

  const dateStr = activePage.updatedAt?.toDate?.()?.toLocaleString() || new Date(activePage.updatedAt).toLocaleString();

  return (
    <>
      <div className="main-content-header">
         <span style={{ fontSize: '0.875rem', color: "var(--text-secondary)", fontWeight: 500 }}>
          {title || "Untitled"}
         </span>
        <div className="editor-meta">
          Edited: {dateStr !== "Invalid Date" ? dateStr : "Just now"}
        </div>
      </div>

      <div className="editor-body">
        {breadcrumbs.length > 1 && (
          <nav className="page-breadcrumbs" aria-label="Page hierarchy">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                {index > 0 && <span className="page-breadcrumb-sep">/</span>}
                <button
                  type="button"
                  className="page-breadcrumb-link"
                  onClick={() => {
                    dispatch(setActivePageId(crumb.id));
                    router.push(`/page/${crumb.id}`);
                  }}
                >
                  {crumb.title || "Untitled"}
                </button>
              </span>
            ))}
          </nav>
        )}
        <input 
          type="text" 
          placeholder="Untitled"
          value={title}
          onChange={handleTitleChange}
          className="title-input"
        />

        {/* Adjusting margin slightly to align BlockNote left margin with title */}
        <div className="blocknote-wrapper" style={{ marginLeft: "-2.5rem" }}>
          <BlockNoteView 
            editor={editor} 
            theme="light" /* Setting blocknote theme to light per the Notion user request design */
            onChange={() => {
              const blocks = editor.document;
              const jsonString = JSON.stringify(blocks);
              if (user?.uid && activePageId) {
                dispatch(updateActivePageContent({ id: activePageId, content: jsonString }));
                debouncedContentSave(activePageId, jsonString);
              }
            }}
          >
            <SuggestionMenuController
              triggerCharacter={"/"}
              getItems={async (query) => {
                const items = customSlashMenuItems(editor);
                return items.filter((item) =>
                  item.title.toLowerCase().includes(query.toLowerCase()) ||
                  item.aliases?.some(alias => alias.toLowerCase().includes(query.toLowerCase()))
                );
              }}
            />
          </BlockNoteView>
        </div>
      </div>

      {isPagePickerOpen && (
        <div className="page-picker-overlay" onClick={() => setIsPagePickerOpen(false)}>
          <div className="page-picker-content glass-container" onClick={(e) => e.stopPropagation()}>
            <div className="page-picker-header">
              <div className="page-picker-header-row">
                <div className="page-picker-title">
                  <FileText size={20} color="var(--accent-color)" />
                  <h3>Link to Page</h3>
                </div>
                <button className="chat-close" onClick={() => setIsPagePickerOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="page-picker-search-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search or name a new page..."
                  value={pageSearchQuery}
                  onChange={(e) => setPageSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleCreateAndLinkPage();
                    }
                  }}
                  className="page-picker-input"
                  autoFocus
                />
              </div>
            </div>
            <div className="page-picker-list">
              <button
                type="button"
                className="page-picker-item page-picker-create"
                onClick={() => void handleCreateAndLinkPage()}
                disabled={isCreatingPage}
              >
                {isCreatingPage ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                <span>
                  {pageSearchQuery.trim()
                    ? `Create "${pageSearchQuery.trim()}" and link`
                    : "Create new page and link"}
                </span>
              </button>

              {filteredPages.length > 0 &&
                filteredPages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    className="page-picker-item"
                    onClick={() => handleSelectPage(page)}
                  >
                    <FileText size={16} />
                    <span>{page.title || "Untitled"}</span>
                  </button>
                ))}

              {filteredPages.length === 0 && pageSearchQuery.trim() && (
                <div className="page-picker-empty">No matching pages</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

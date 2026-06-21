import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Page {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  createdAt: any;
  updatedAt: any;
}

interface PageState {
  pages: Page[];
  activePageId: string | null;
  agentContentRevision: number;
}

const initialState: PageState = {
  pages: [],
  activePageId: null,
  agentContentRevision: 0,
};

const pageSlice = createSlice({
  name: "page",
  initialState,
  reducers: {
    setPages: (state, action: PayloadAction<Page[]>) => {
      state.pages = action.payload;
    },
    setActivePageId: (state, action: PayloadAction<string | null>) => {
      state.activePageId = action.payload;
    },
    addPageLocally: (state, action: PayloadAction<Page>) => {
      // Unshift to place new page directly at top similar to Notion
      state.pages.unshift(action.payload);
    },
    updateActivePageContent: (state, action: PayloadAction<{ id: string; content: string }>) => {
      const page = state.pages.find((p) => p.id === action.payload.id);
      if (page) {
        page.content = action.payload.content;
      }
    },
     updateActivePageTitle: (state, action: PayloadAction<{ id: string; title: string }>) => {
      const page = state.pages.find((p) => p.id === action.payload.id);
      if (page) {
        page.title = action.payload.title;
      }
    },
    bumpAgentContentRevision: (state) => {
      state.agentContentRevision += 1;
    },
    removePageLocally: (state, action: PayloadAction<string>) => {
      // Remove the page and all its descendants
      const toRemove = new Set<string>();
      const queue = [action.payload];
      while (queue.length) {
        const current = queue.shift()!;
        toRemove.add(current);
        state.pages
          .filter((p) => p.parentId === current)
          .forEach((p) => queue.push(p.id));
      }
      state.pages = state.pages.filter((p) => !toRemove.has(p.id));
      if (state.activePageId && toRemove.has(state.activePageId)) {
        state.activePageId = null;
      }
    },
  },
});

export const {
  setPages,
  setActivePageId,
  updateActivePageContent,
  updateActivePageTitle,
  addPageLocally,
  bumpAgentContentRevision,
  removePageLocally,
} = pageSlice.actions;
export default pageSlice.reducer;

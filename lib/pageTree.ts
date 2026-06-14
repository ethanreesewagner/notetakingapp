import type { Page } from "../store/pageSlice";

export interface PageNode extends Page {
  children: PageNode[];
}

export function buildPageTree(pages: Page[]): PageNode[] {
  const map = new Map<string, PageNode>();
  const roots: PageNode[] = [];

  for (const page of pages) {
    map.set(page.id, { ...page, children: [] });
  }

  for (const page of pages) {
    const node = map.get(page.id)!;
    const parentId = page.parentId ?? null;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function getPageBreadcrumbs(
  pages: Page[],
  pageId: string
): Page[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const crumbs: Page[] = [];
  let current = byId.get(pageId);

  while (current) {
    crumbs.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return crumbs;
}

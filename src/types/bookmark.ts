export interface BookmarkCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  categoryId?: string;
  tags: string[];
  createdAt: string;
  lastAccessed: string;
  accessCount: number;
  description?: string;
}

export interface BookmarkSearchResult {
  item: Bookmark;
  score?: number;
}

export interface BookmarkStats {
  totalBookmarks: number;
  categories: {
    [categoryId: string]: number;
  };
  tags: {
    [tag: string]: number;
  };
  recentAccesses: {
    [date: string]: number;
  };
}

export type BookmarkNode = {
  id: string;
  type: 'bookmark' | 'folder';
  title: string;
  url?: string; // Only for bookmarks
  parentId: string | null; // null for root
  categoryId?: string;
  tags?: string[];
  createdAt: string;
  lastAccessed?: string;
  accessCount?: number;
  description?: string;
}; 
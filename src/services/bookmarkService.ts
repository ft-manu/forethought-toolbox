import { BookmarkNode, BookmarkCategory } from '@/types/bookmark';

export class BookmarkService {
  private static readonly STORAGE_KEY = 'bookmarks';
  private static readonly CATEGORY_KEY = 'bookmark_categories';

  static async getBookmarks(): Promise<BookmarkNode[]> {
    try {
      const data = await chrome.storage.local.get([this.STORAGE_KEY]);
      const bookmarks = data[this.STORAGE_KEY];
      return Array.isArray(bookmarks) ? bookmarks : [];
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
      return [];
    }
  }

  static async addBookmarkOrFolder(node: Omit<BookmarkNode, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'> & { type: 'bookmark' | 'folder' }): Promise<BookmarkNode> {
    const bookmarks = await this.getBookmarks();
    const newNode: BookmarkNode = {
      ...node,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastAccessed: node.type === 'bookmark' ? new Date().toISOString() : undefined,
      accessCount: node.type === 'bookmark' ? 0 : undefined,
    };
    const updatedBookmarks = [...bookmarks, newNode];
    await chrome.storage.local.set({ [this.STORAGE_KEY]: updatedBookmarks });
    return newNode;
  }

  static async updateBookmarkNode(id: string, updates: Partial<BookmarkNode>): Promise<BookmarkNode | null> {
    const bookmarks = await this.getBookmarks();
    const index = bookmarks.findIndex(b => b.id === id);
    if (index === -1) {
      // If node doesn't exist, add it back
      const restoredNode = {
        ...updates,
        id,
        lastAccessed: updates.type === 'bookmark' ? new Date().toISOString() : undefined,
      } as BookmarkNode;
      const updatedBookmarks = [...bookmarks, restoredNode];
      await chrome.storage.local.set({ [this.STORAGE_KEY]: updatedBookmarks });
      return restoredNode;
    }
    const updatedNode = {
      ...bookmarks[index],
      ...updates,
      lastAccessed: bookmarks[index].type === 'bookmark' ? new Date().toISOString() : undefined,
    };
    bookmarks[index] = updatedNode;
    await chrome.storage.local.set({ [this.STORAGE_KEY]: bookmarks });
    return updatedNode;
  }

  static async deleteBookmarkNode(id: string): Promise<boolean> {
    let bookmarks = await this.getBookmarks();
    // Recursively delete all children if it's a folder
    const toDelete = new Set([id]);
    let changed = false;
    let found;
    do {
      found = false;
      for (const node of bookmarks) {
        if (node.parentId && toDelete.has(node.parentId)) {
          toDelete.add(node.id);
          found = true;
        }
      }
    } while (found);
    const updatedBookmarks = bookmarks.filter(b => !toDelete.has(b.id));
    changed = updatedBookmarks.length !== bookmarks.length;
    if (!changed) return false;
    await chrome.storage.local.set({ [this.STORAGE_KEY]: updatedBookmarks });
    return true;
  }

  static async getCategories(): Promise<BookmarkCategory[]> {
    try {
      const data = await chrome.storage.local.get([this.CATEGORY_KEY]);
      const categories = data[this.CATEGORY_KEY];
      return Array.isArray(categories) ? categories : [];
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      return [];
    }
  }

  static async addCategory(category: { name: string; color: string; icon: string }): Promise<string> {
    const id = crypto.randomUUID();
    const newCategory = { id, ...category };
    
    // Get existing categories
    const categories = await this.getCategories();
    
    // Add new category
    const updatedCategories = [...categories, newCategory];
    
    // Save to storage
    await chrome.storage.local.set({ [this.CATEGORY_KEY]: updatedCategories });
    
    return id;
  }

  static async updateCategory(id: string, updates: Partial<BookmarkCategory>): Promise<BookmarkCategory | null> {
    const categories = await this.getCategories();
    const index = categories.findIndex(c => c.id === id);
    
    if (index === -1) return null;

    const updatedCategory = {
      ...categories[index],
      ...updates
    };

    categories[index] = updatedCategory;
    await chrome.storage.local.set({ [this.CATEGORY_KEY]: categories });
    return updatedCategory;
  }

  static async deleteCategory(id: string): Promise<void> {
    const categories = await this.getCategories();
    const updatedCategories = categories.filter(cat => cat.id !== id);
    await chrome.storage.local.set({ [this.CATEGORY_KEY]: updatedCategories });
  }

  static async updateBookmarkCategory(bookmarkId: string, categoryId: string | null): Promise<void> {
    const bookmarks = await this.getBookmarks();
    const updatedBookmarks = bookmarks.map((bookmark: BookmarkNode) => {
      if (bookmark.id === bookmarkId) {
        return { ...bookmark, categoryId };
      }
      return bookmark;
    });
    await chrome.storage.local.set({ [this.STORAGE_KEY]: updatedBookmarks });
  }
} 
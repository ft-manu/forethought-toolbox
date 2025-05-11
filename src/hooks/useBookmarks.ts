import { useState, useEffect, useCallback } from 'react';
import { BookmarkNode } from '@/types/bookmark';
import { BookmarkService } from '@/services/bookmarkService';

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookmarks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await chrome.storage.local.get(['bookmarks']);
      const loadedBookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];
      setBookmarks(loadedBookmarks);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bookmarks');
    } finally {
      setLoading(false);
    }
  }, []);

  const addBookmarkOrFolder = useCallback(async (node: Omit<BookmarkNode, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'> & { type: 'bookmark' | 'folder' }) => {
    try {
      const newNode = await BookmarkService.addBookmarkOrFolder(node);
      setBookmarks(prev => [...prev, newNode]);
      return newNode;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bookmark or folder');
      throw err;
    }
  }, []);

  const updateBookmarkNode = useCallback(async (id: string, updates: Partial<BookmarkNode>) => {
    try {
      const updated = await BookmarkService.updateBookmarkNode(id, updates);
      if (updated) {
        setBookmarks(prev => {
          const exists = prev.some(b => b.id === id);
          if (exists) {
            return prev.map(b => b.id === id ? updated : b);
          } else {
            return [...prev, updated];
          }
        });
      }
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bookmark or folder');
      throw err;
    }
  }, []);

  const deleteBookmarkNode = useCallback(async (id: string) => {
    try {
      const success = await BookmarkService.deleteBookmarkNode(id);
      if (success) {
        setBookmarks(prev => prev.filter(b => b.id !== id && b.parentId !== id));
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bookmark or folder');
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  return {
    bookmarks,
    loading,
    error,
    addBookmarkOrFolder,
    updateBookmarkNode,
    deleteBookmarkNode,
    refresh: fetchBookmarks
  };
} 
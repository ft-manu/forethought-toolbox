import { useState, useEffect } from 'react';
import { BookmarkCategory } from '@/types/bookmark';
import { BookmarkService } from '@/services/bookmarkService';

export const useCategories = () => {
  const [categories, setCategories] = useState<BookmarkCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      const data = await BookmarkService.getCategories();
      setCategories(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async (category: Omit<BookmarkCategory, 'id'>) => {
    try {
      const newCategory = await BookmarkService.addCategory(category);
      setCategories(prev => [...prev, { ...category, id: newCategory }]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
      return false;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await BookmarkService.deleteCategory(id);
      setCategories(prev => prev.filter(cat => cat.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
      return false;
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return {
    categories,
    loading,
    error,
    refresh,
    addCategory,
    deleteCategory
  };
}; 
import React, { useState, useEffect, useRef } from 'react';
import { BookmarkNode } from '@/types/bookmark';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useCategories } from '@/hooks/useCategories';
import { useBookmarks } from '@/hooks/useBookmarks';

interface EditBookmarkModalProps {
  open: boolean;
  bookmark: BookmarkNode;
  onClose: () => void;
  onSave: (data: { title: string; url: string | undefined; categoryId?: string; tags: string[]; description: string }) => Promise<void>;
}

export const EditBookmarkModal: React.FC<EditBookmarkModalProps> = ({
  open,
  bookmark,
  onClose,
  onSave
}) => {
  const { categories, loading: categoriesLoading } = useCategories();
  const { bookmarks } = useBookmarks();
  const allTags = Array.from(new Set(bookmarks.flatMap(b => b.tags || [])));
  const [title, setTitle] = useState(bookmark.title);
  const [url, setUrl] = useState(bookmark.url);
  const [categoryId, setCategoryId] = useState(bookmark.categoryId || '');
  const [description, setDescription] = useState(bookmark.description || '');
  const [tags, setTags] = useState<string[]>(bookmark.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(bookmark.title);
      setUrl(bookmark.url);
      setCategoryId(bookmark.categoryId || '');
      setDescription(bookmark.description || '');
      setTags(bookmark.tags || []);
    }
  }, [open, bookmark]);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
      setShowSuggestions(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSuggestionClick = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
    setShowSuggestions(false);
    tagInputRef.current?.focus();
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
    setShowSuggestions(e.target.value.trim() === '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ 
      title: title || bookmark.title, 
      url: url || bookmark.url, 
      categoryId: categoryId || undefined,
      tags,
      description
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Bookmark</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-900 dark:text-gray-300">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`mt-1 block w-full rounded-md border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-green-400 ${
                document.documentElement.classList.contains('dark')
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-green-400'
              }`}
              required
            />
          </div>

          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-900 dark:text-gray-300">
              URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={`mt-1 block w-full rounded-md border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-green-400 ${
                document.documentElement.classList.contains('dark')
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-green-400'
              }`}
              required
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-900 dark:text-gray-300">
              Category
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`mt-1 block w-full rounded-md border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-green-400 ${
                document.documentElement.classList.contains('dark')
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-green-400'
              }`}
              disabled={categoriesLoading}
            >
              <option value="">—</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {categoriesLoading && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Loading categories...</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-900 dark:text-gray-300">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`mt-1 block w-full rounded-md border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-green-400 ${
                document.documentElement.classList.contains('dark')
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-green-400'
              }`}
              placeholder="Add a note or description (optional)"
              rows={2}
            />
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-900 dark:text-gray-300">
              Tags
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800 dark:bg-gray-800 dark:text-indigo-200"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 p-0 leading-none align-middle"
                    style={{ background: 'none', border: 'none', lineHeight: 1 }}
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                id="tags"
                ref={tagInputRef}
                value={tagInput}
                onChange={handleTagInputChange}
                onKeyDown={handleAddTag}
                onFocus={() => setShowSuggestions(tagInput.trim() === '')}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
                className={`mt-2 block w-full rounded-md border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-green-400 ${
                  document.documentElement.classList.contains('dark')
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-green-400'
                }`}
                placeholder="Type tag and press Enter or Comma"
              />
              {showSuggestions && allTags.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-32 overflow-y-auto">
                  {allTags.filter(tag => !tags.includes(tag)).map(tag => (
                    <div
                      key={tag}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                      onMouseDown={() => handleSuggestionClick(tag)}
                    >
                      {tag}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium rounded-md border transition focus:outline-none focus:ring-2 focus:ring-green-400 ${
                document.documentElement.classList.contains('dark')
                  ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600'
                  : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 
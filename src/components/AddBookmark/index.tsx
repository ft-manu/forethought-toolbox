import React, { useState, useRef, useEffect } from 'react';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useCategories } from '@/hooks/useCategories';
import { LoadingSpinner } from '../LoadingSpinner';

interface AddBookmarkProps {
  onClose: () => void;
  parentId?: string | null;
  onBookmarkAdded?: () => void;
}

export const AddBookmark: React.FC<AddBookmarkProps> = ({ onClose, parentId = null, onBookmarkAdded }) => {
  const { addBookmarkOrFolder, bookmarks } = useBookmarks();
  const { categories } = useCategories();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [categoryId, setCategoryId] = useState<string>('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Get all unique tags from existing bookmarks
  const allTags = Array.from(new Set(bookmarks.flatMap(b => b.tags || [])));

  // Analyze URL and title for smart suggestions
  const getSmartSuggestions = () => {
    const suggestions = {
      tags: new Set<string>(),
      category: ''
    };

    if (!url && !title) return suggestions;

    // Extract domain from URL
    let domain = '';
    try {
      if (url) {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        domain = urlObj.hostname.replace('www.', '');
      }
    } catch (e) {
      // Invalid URL, continue without domain
    }

    // Find similar bookmarks
    const similarBookmarks = bookmarks.filter(bm => {
      if (!bm.url) return false;
      try {
        const bmDomain = new URL(bm.url).hostname.replace('www.', '');
        return bmDomain === domain || 
               (title && bm.title.toLowerCase().includes(title.toLowerCase()));
      } catch {
        return false;
      }
    });

    // Get tags from similar bookmarks
    similarBookmarks.forEach(bm => {
      if (bm.tags) {
        bm.tags.forEach(tag => suggestions.tags.add(tag));
      }
      // If no category is selected yet, suggest the most common category
      if (!categoryId && bm.categoryId) {
        const categoryCount = similarBookmarks.filter(b => b.categoryId === bm.categoryId).length;
        if (categoryCount > 1) {
          suggestions.category = bm.categoryId;
        }
      }
    });

    return suggestions;
  };

  // Apply smart suggestions when URL or title changes
  useEffect(() => {
    const { tags: suggestedTags, category: suggestedCategory } = getSmartSuggestions();
    
    // Only suggest tags that aren't already added
    const newTags = Array.from(suggestedTags).filter(tag => !tags.includes(tag));
    if (newTags.length > 0) {
      setTags(prev => [...prev, ...newTags]);
    }

    // Suggest category if none is selected
    if (!categoryId && suggestedCategory) {
      setCategoryId(suggestedCategory);
    }
  }, [url, title]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url) return;

    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    setIsLoading(true);
    try {
      await addBookmarkOrFolder({
        type: 'bookmark',
        title: title || url,
        url: finalUrl,
        parentId,
        tags,
        categoryId: categoryId || undefined,
        description: description.trim(),
      });
      setUrl('');
      setTitle('');
      setDescription('');
      setTags([]);
      setCategoryId('');
      if (onBookmarkAdded) onBookmarkAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bookmark');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
      setShowTagSuggestions(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagSuggestionClick = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
    setShowTagSuggestions(false);
    tagInputRef.current?.focus();
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
    setShowTagSuggestions(e.target.value.trim() !== '');
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    setUrl(value);
  };

  const handleUrlBlur = () => {
    let value = url.trim();
    if (value && !/^https?:\/\//i.test(value)) {
      value = 'https://' + value;
      setUrl(value);
    }
  };

  return (
    <div className="p-4 rounded-lg shadow-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <h2 className="text-xl font-bold mb-4">Add New Bookmark</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
            placeholder="Bookmark title"
            aria-label="Bookmark title"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            URL
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={handleUrlChange}
            onBlur={handleUrlBlur}
            required
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
            placeholder="https://example.com"
            aria-label="Bookmark URL"
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Category
          </label>
          <div className="relative">
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              aria-label="Bookmark category"
            >
              <option value="">Select a category</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
            placeholder="Add a description"
            aria-label="Bookmark description"
          />
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tags
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 p-0 leading-none align-middle"
                  style={{ background: 'none', border: 'none', lineHeight: 1 }}
                  aria-label={`Remove tag ${tag}`}
                  title={`Remove tag ${tag}`}
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
              onFocus={() => setShowTagSuggestions(tagInput.trim() === '')}
              onBlur={() => setTimeout(() => setShowTagSuggestions(false), 100)}
              className="mt-2 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              placeholder="Type tag and press Enter or Comma"
              aria-label="Bookmark tags"
            />
            {showTagSuggestions && allTags.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-32 overflow-y-auto">
                {allTags
                  .filter(tag => !tags.includes(tag) && tag.toLowerCase().includes(tagInput.toLowerCase()))
                  .map(tag => (
                    <div
                      key={tag}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                      onMouseDown={() => handleTagSuggestionClick(tag)}
                    >
                      {tag}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium rounded-md border transition focus:outline-none focus:ring-2 focus:ring-green-400 ${
              document.documentElement.classList.contains('dark')
                ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600'
                : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
            }`}
            title="Cancel and close"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !url}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Add bookmark"
          >
            {isLoading ? <LoadingSpinner size="sm" /> : 'Add Bookmark'}
          </button>
        </div>
      </form>
    </div>
  );
}; 
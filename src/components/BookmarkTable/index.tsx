import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { EditBookmarkModal } from './EditBookmarkModal';
import { useCategories } from '@/hooks/useCategories';
import { BookmarkNode } from '@/types/bookmark';
import { Menu } from '@headlessui/react';
import { LoadingSpinner } from '../LoadingSpinner';
import { EmptyState } from '../EmptyState';

const ITEMS_PER_PAGE = 10;

interface BookmarkTableProps {
  bookmarks: BookmarkNode[];
  onUpdate: (id: string, data: Partial<BookmarkNode>) => Promise<void>;
  onDelete: (id: string, silent?: boolean) => Promise<void>;
  onDuplicate: (bookmark: BookmarkNode) => Promise<void>;
  viewMode: 'table' | 'card';
  clearToast: () => void;
  onBatchDeleteWithUndo: (bookmarks: BookmarkNode[]) => Promise<void>;
}

interface SearchFilter {
  query: string;
  tags: string[];
  categories: string[];
  dateRange: {
    start: string;
    end: string;
  };
  accessCount: {
    min: number;
    max: number;
  };
}

export const BookmarkTable: React.FC<BookmarkTableProps> = ({
  bookmarks,
  onUpdate,
  onDelete,
  onDuplicate,
  viewMode = 'table',
  clearToast,
  onBatchDeleteWithUndo
}) => {
  const { categories } = useCategories();
  const [sortKey, setSortKey] = useState<keyof BookmarkNode | 'category'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<BookmarkNode | null>(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchFilter>({
    query: '',
    tags: [],
    categories: [],
    dateRange: {
      start: '',
      end: ''
    },
    accessCount: {
      min: 0,
      max: Infinity
    }
  });
  const [savedFilters, setSavedFilters] = useState<{ name: string; filter: SearchFilter }[]>([]);
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<{ [key: string]: boolean }>({
    title: true,
    category: true,
    url: true,
    actions: true,
    tags: false,
    description: false,
    createdAt: false,
    lastAccessed: false,
    accessCount: false,
  });
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<{ url: string, ids: string[] }[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSelections, setMergeSelections] = useState<{ [url: string]: string }>({});
  const [mergeTags, setMergeTags] = useState(true);
  const [mergeCategories, setMergeCategories] = useState(true);
  const [mergeDescriptions, setMergeDescriptions] = useState(true);
  const defaultColumnOrder = [
    'title',
    'category',
    'url',
    'tags',
    'description',
    'createdAt',
    'lastAccessed',
    'accessCount',
    'actions',
  ];
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultColumnOrder);
  const dragCol = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [tableZoom, setTableZoom] = useState(1);
  const [isLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkCategory, setShowBulkCategory] = useState(false);
  const [showBulkAddTags, setShowBulkAddTags] = useState(false);
  const [showBulkRemoveTags, setShowBulkRemoveTags] = useState(false);
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [bulkMoveFolderId, setBulkMoveFolderId] = useState('');

  const safeBookmarks = Array.isArray(bookmarks) ? bookmarks : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  // Folders: all nodes of type 'folder'
  const allFolders = safeBookmarks.filter(b => b.type === 'folder');

  const handleSort = (key: keyof BookmarkNode | 'category') => {
    if (key === sortKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const filtered = useMemo(() => {
    return safeBookmarks.filter(bm => {
      // Basic search query
      const matchesQuery = !searchFilter.query || 
        bm.title.toLowerCase().includes(searchFilter.query.toLowerCase()) ||
        (bm.url || '').toLowerCase().includes(searchFilter.query.toLowerCase()) ||
        (safeCategories.find(c => c.id === bm.categoryId)?.name || '').toLowerCase().includes(searchFilter.query.toLowerCase());

      // Tags filter
      const matchesTags = searchFilter.tags.length === 0 || 
        searchFilter.tags.every(tag => bm.tags?.includes(tag));

      // Categories filter
      const matchesCategories = searchFilter.categories.length === 0 || 
        searchFilter.categories.includes(bm.categoryId || '');

      // Date range filter
      const createdAt = new Date(bm.createdAt || '').getTime();
      const startDate = searchFilter.dateRange.start ? new Date(searchFilter.dateRange.start).getTime() : 0;
      const endDate = searchFilter.dateRange.end ? new Date(searchFilter.dateRange.end).getTime() : Infinity;
      const matchesDateRange = createdAt >= startDate && createdAt <= endDate;

      // Access count filter
      const matchesAccessCount = (bm.accessCount || 0) >= searchFilter.accessCount.min && 
        (bm.accessCount || 0) <= searchFilter.accessCount.max;

      return matchesQuery && matchesTags && matchesCategories && matchesDateRange && matchesAccessCount;
    });
  }, [safeBookmarks, searchFilter, safeCategories]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA: any;
      let valB: any;
      switch (sortKey) {
        case 'title':
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
          break;
        case 'url':
          valA = (a.url || '').toLowerCase();
          valB = (b.url || '').toLowerCase();
          break;
        case 'category':
          valA = safeCategories.find(c => c.id === a.categoryId)?.name || '';
          valB = safeCategories.find(c => c.id === b.categoryId)?.name || '';
          break;
        case 'createdAt':
          valA = new Date(a.createdAt || '').getTime();
          valB = new Date(b.createdAt || '').getTime();
          break;
        case 'lastAccessed':
          valA = new Date(a.lastAccessed || '').getTime();
          valB = new Date(b.lastAccessed || '').getTime();
          break;
        case 'accessCount':
          valA = a.accessCount ?? 0;
          valB = b.accessCount ?? 0;
          break;
        default:
          valA = '';
          valB = '';
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortOrder, safeCategories]);

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE) || 1;
  const paginated = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const openEditModal = (bm: BookmarkNode) => {
    if (isBookmark(bm)) {
      setSelectedBookmark(bm);
      setEditModalOpen(true);
    }
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelectedBookmark(null);
  };

  const handleModalSave = async (updated: { title: string; url: string | undefined; categoryId?: string; tags: string[]; description: string }) => {
    if (selectedBookmark) {
      await onUpdate(selectedBookmark.id, updated);
      closeEditModal();
    }
  };

  const handleDelete = async (id: string, silent = false) => {
    const bm = safeBookmarks.find(b => b.id === id);
    if (!bm) return;
    if (!silent) {
      if (!window.confirm('Are you sure you want to delete this bookmark?')) return;
    }
    await onDelete(id);
  };

  const findDuplicates = () => {
    const urlMap = new Map<string, string[]>();
    safeBookmarks.forEach(bm => {
      if (!urlMap.has(bm.url || '')) urlMap.set(bm.url || '', []);
      urlMap.get(bm.url || '')!.push(bm.id);
    });
    const dups = Array.from(urlMap.values()).filter(ids => ids.length > 1).flat();
    setDuplicates(dups);
    // For modal: group by URL
    const groups = Array.from(urlMap.entries())
      .filter(([_, ids]) => ids.length > 1)
      .map(([url, ids]) => ({ url, ids }));
    setDuplicateGroups(groups);
    if (dups.length > 0) {
      alert('Duplicates found! Highlighted in yellow.');
    } else {
      alert('No duplicates found.');
    }
  };

  const openMergeModal = () => setShowMergeModal(true);
  const closeMergeModal = () => setShowMergeModal(false);

  // Handle selection of which bookmark to keep per group
  const handleSelectToKeep = (url: string, id: string) => {
    setMergeSelections(prev => ({ ...prev, [url]: id }));
  };

  // Batch delete with undo
  const handleBatchDeleteWithUndo = async (ids: string[]) => {
    clearToast();
    const toDelete = safeBookmarks.filter(b => ids.includes(b.id));
    // Remove from UI immediately
    for (const id of ids) {
      await onDelete(id, true); // Pass silent=true only
    }
    // Call the parent's batch delete with undo handler
    await onBatchDeleteWithUndo(toDelete);
  };

  // Handle merge duplicates
  const handleMerge = async () => {
    // Show a single confirmation dialog before merging
    const totalToDelete = duplicateGroups.reduce((sum, group) => sum + (group.ids.length - 1), 0);
    if (!window.confirm(`Are you sure you want to merge and delete ${totalToDelete} duplicate bookmark(s)? This action cannot be undone.`)) {
      return;
    }

    // For each group, keep the selected, merge fields, delete others
    let allToDelete: string[] = [];
    for (const group of duplicateGroups) {
      const toKeepId = mergeSelections[group.url] || group.ids[0];
      const toDelete = group.ids.filter(id => id !== toKeepId);
      const bookmarksInGroup = group.ids.map(id => safeBookmarks.find(b => b.id === id)).filter((b): b is typeof safeBookmarks[0] => !!b);
      if (bookmarksInGroup.length < 2) continue;
      let merged = { ...bookmarksInGroup.find(b => b.id === toKeepId)! };
      if (mergeTags) {
        merged.tags = Array.from(new Set(bookmarksInGroup.flatMap(b => b.tags || [])));
      }
      if (mergeCategories) {
        // Prefer the first non-empty category
        merged.categoryId = bookmarksInGroup.map(b => b.categoryId).find(Boolean) || merged.categoryId;
      }
      if (mergeDescriptions) {
        // Prefer the longest description
        merged.description = bookmarksInGroup.map(b => b.description || '').sort((a, b) => b.length - a.length)[0] || merged.description;
      }
      await onUpdate(toKeepId, merged);
      allToDelete = allToDelete.concat(toDelete);
    }

    // Delete all duplicates at once using the batch delete function
    await handleBatchDeleteWithUndo(allToDelete);
    
    // Clean up the merge state
    setShowMergeModal(false);
    setDuplicates([]);
    setDuplicateGroups([]);
    setMergeSelections({});
    setMergeTags(true);
    setMergeCategories(true);
    setMergeDescriptions(true);
  };

  // Persist columnVisibility to chrome.storage.local
  useEffect(() => {
    chrome.storage.local.get('columnVisibility', (data) => {
      if (data.columnVisibility) {
        // Migrate PascalCase keys to camelCase and ensure boolean values
        const migrated = Object.fromEntries(
          Object.entries(data.columnVisibility).map(([k, v]) => [k.charAt(0).toLowerCase() + k.slice(1), Boolean(v)])
        ) as { [key: string]: boolean };
        setColumnVisibility(migrated);
        chrome.storage.local.set({ columnVisibility: migrated });
      }
    });
  }, []);

  // Load columnOrder from chrome.storage.local, always fallback to defaultColumnOrder
  useEffect(() => {
    chrome.storage.local.get('columnOrder', (data) => {
      if (Array.isArray(data.columnOrder) && data.columnOrder.length > 0) {
        // Ensure all columns are present
        const loaded = data.columnOrder.filter(col => defaultColumnOrder.includes(col));
        const missing = defaultColumnOrder.filter(col => !loaded.includes(col));
        setColumnOrder([...loaded, ...missing]);
      } else {
        setColumnOrder(defaultColumnOrder);
      }
    });
  }, []);
  // Save columnOrder to chrome.storage.local
  useEffect(() => {
    chrome.storage.local.set({ columnOrder });
  }, [columnOrder]);

  // Persist sortKey and sortOrder to chrome.storage.local
  useEffect(() => {
    chrome.storage.local.get(['sortKey', 'sortOrder'], (data) => {
      if (data.sortKey) setSortKey(data.sortKey);
      if (data.sortOrder) setSortOrder(data.sortOrder);
    });
  }, []);
  useEffect(() => {
    chrome.storage.local.set({ sortKey, sortOrder });
  }, [sortKey, sortOrder]);

  // Load zoom level from storage on mount
  useEffect(() => {
    chrome.storage.local.get('tableZoom', (data) => {
      if (typeof data.tableZoom === 'number') {
        setTableZoom(data.tableZoom);
      }
    });
  }, []);
  // Save zoom level to storage when it changes
  useEffect(() => {
    chrome.storage.local.set({ tableZoom });
  }, [tableZoom]);

  // Load saved filters from storage
  useEffect(() => {
    chrome.storage.local.get('savedFilters', (data) => {
      if (data.savedFilters) {
        setSavedFilters(data.savedFilters);
      }
    });
  }, []);

  // Save filters to storage
  useEffect(() => {
    chrome.storage.local.set({ savedFilters });
  }, [savedFilters]);

  const handleSaveFilter = () => {
    if (filterName.trim()) {
      const newFilters = [...savedFilters, { name: filterName, filter: searchFilter }];
      setSavedFilters(newFilters);
      setShowSaveFilterModal(false);
      setFilterName('');
    }
  };

  const handleLoadFilter = (filter: SearchFilter) => {
    setSearchFilter(filter);
    setShowAdvancedSearch(true);
  };

  const handleDeleteFilter = (name: string) => {
    setSavedFilters(savedFilters.filter(f => f.name !== name));
  };

  // Add a type guard for bookmarks
  function isBookmark(node: BookmarkNode): node is BookmarkNode & { categoryId?: string } {
    return node.type === 'bookmark';
  }

  // Helper to get column label
  const columnLabels: { [key: string]: string } = {
    title: 'Title',
    url: 'Url',
    category: 'Category',
    tags: 'Tags',
    description: 'Description',
    createdAt: 'Created At',
    lastAccessed: 'Last Accessed',
    accessCount: 'Access Count',
    actions: 'Actions',
  };

  // Helper to get sort key
  const getSortKey = (col: string) => {
    if (col === 'actions') return null;
    return col as keyof BookmarkNode | 'category';
  };

  // Drag handlers
  const handleDragStart = (col: string) => {
    dragCol.current = col;
  };
  const handleDragOver = (e: React.DragEvent<HTMLTableHeaderCellElement>, col: string) => {
    e.preventDefault();
    setDragOverCol(col);
  };
  const handleDrop = (col: string) => {
    if (dragCol.current && dragCol.current !== col) {
      const fromIdx = columnOrder.indexOf(dragCol.current);
      const toIdx = columnOrder.indexOf(col);
      if (fromIdx !== -1 && toIdx !== -1) {
        const newOrder = [...columnOrder];
        // Remove dragged column
        newOrder.splice(fromIdx, 1);
        // Insert at new position (after if dragging right, before if left)
        newOrder.splice(toIdx, 0, dragCol.current);
        setColumnOrder(newOrder);
      }
    }
    dragCol.current = null;
    setDragOverCol(null);
  };
  const handleDragEnd = () => {
    dragCol.current = null;
    setDragOverCol(null);
  };

  // Helper to determine if a column is optional (can be hidden)
  const optionalColumns = ['category', 'url', 'tags', 'description', 'createdAt', 'lastAccessed', 'accessCount'];

  // Compute columns to render: all visible columns except 'actions', then 'actions' last
  const visibleColumns = columnOrder.filter(
    (col) => col !== 'actions' && (col === 'title' || columnVisibility[col])
  );
  const columnsToRender = [...visibleColumns, 'actions'];

  // Helper to clamp zoom
  const clampZoom = (z: number) => Math.max(0.5, Math.min(2, z));

  // Helper to select/deselect all on current page
  const allOnPageSelected = paginated.every(bm => selectedIds.includes(bm.id));
  const handleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(selectedIds.filter(id => !paginated.some(bm => bm.id === id)));
    } else {
      setSelectedIds(Array.from(new Set([...selectedIds, ...paginated.map(bm => bm.id)])));
    }
  };
  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const clearSelection = () => setSelectedIds([]);

  // Bulk action stubs
  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedIds.length} selected bookmarks?`)) {
      selectedIds.forEach(id => onDelete(id));
      clearSelection();
    }
  };

  // Bulk assign category
  const handleBulkAssignCategory = async () => {
    for (const id of selectedIds) {
      await onUpdate(id, { categoryId: bulkCategoryId });
    }
    setShowBulkCategory(false);
    setBulkCategoryId('');
    clearSelection();
  };
  // Bulk add tags
  const handleBulkAddTags = async () => {
    const tagsToAdd = bulkTags.split(',').map(t => t.trim()).filter(Boolean);
    for (const id of selectedIds) {
      const bm = safeBookmarks.find(b => b.id === id);
      if (!bm) continue;
      const newTags = Array.from(new Set([...(bm.tags || []), ...tagsToAdd]));
      await onUpdate(id, { tags: newTags });
    }
    setShowBulkAddTags(false);
    setBulkTags('');
    clearSelection();
  };
  // Bulk remove tags
  const handleBulkRemoveTags = async () => {
    const tagsToRemove = bulkTags.split(',').map(t => t.trim()).filter(Boolean);
    for (const id of selectedIds) {
      const bm = safeBookmarks.find(b => b.id === id);
      if (!bm) continue;
      const newTags = (bm.tags || []).filter(tag => !tagsToRemove.includes(tag));
      await onUpdate(id, { tags: newTags });
    }
    setShowBulkRemoveTags(false);
    setBulkTags('');
    clearSelection();
  };
  // Bulk move to folder
  const handleBulkMove = async () => {
    for (const id of selectedIds) {
      await onUpdate(id, { parentId: bulkMoveFolderId });
    }
    setShowBulkMove(false);
    setBulkMoveFolderId('');
    clearSelection();
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" className="mt-8" />;
  }

  if (bookmarks.length === 0) {
    return (
      <EmptyState
        icon="🔖"
        title="No Bookmarks Found"
        description="Try adjusting your search or filters to find what you're looking for."
      />
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4">
        {/* Advanced Search Controls */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {showAdvancedSearch ? 'Hide Advanced Search' : 'Show Advanced Search'}
          </button>
          {showAdvancedSearch && (
            <button
              onClick={() => setShowSaveFilterModal(true)}
              className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
            >
              Save Filter
            </button>
          )}
        </div>

        {showAdvancedSearch && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Tags Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
                <select
                  multiple
                  value={searchFilter.tags}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setSearchFilter(prev => ({ ...prev, tags: selected }));
                  }}
                  className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                >
                  {Array.from(new Set(safeBookmarks.flatMap(b => b.tags || []))).map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>

              {/* Categories Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categories</label>
                <select
                  multiple
                  value={searchFilter.categories}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setSearchFilter(prev => ({ ...prev, categories: selected }));
                  }}
                  className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                >
                  {safeCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={searchFilter.dateRange.start}
                    onChange={(e) => setSearchFilter(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                    className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                  <input
                    type="date"
                    value={searchFilter.dateRange.end}
                    onChange={(e) => setSearchFilter(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                    className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  >
                  </input>
                </div>
              </div>

              {/* Access Count Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Access Count</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={searchFilter.accessCount.min}
                    onChange={(e) => setSearchFilter(prev => ({
                      ...prev,
                      accessCount: { ...prev.accessCount, min: parseInt(e.target.value) || 0 }
                    }))}
                    placeholder="Min"
                    className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                  <input
                    type="number"
                    value={searchFilter.accessCount.max === Infinity ? '' : searchFilter.accessCount.max}
                    onChange={(e) => setSearchFilter(prev => ({
                      ...prev,
                      accessCount: { ...prev.accessCount, max: parseInt(e.target.value) || Infinity }
                    }))}
                    placeholder="Max"
                    className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                </div>
              </div>
            </div>

            {/* Saved Filters */}
            {savedFilters.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Saved Filters</h3>
                <div className="flex flex-wrap gap-2">
                  {savedFilters.map(({ name, filter }) => (
                    <div key={name} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded px-3 py-1">
                      <button
                        onClick={() => handleLoadFilter(filter)}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {name}
                      </button>
                      <button
                        onClick={() => handleDeleteFilter(name)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Filter Modal */}
        {showSaveFilterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 max-w-md w-full">
              <h2 className="text-lg font-bold mb-4">Save Search Filter</h2>
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Filter name"
                className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                  onClick={() => setShowSaveFilterModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                  onClick={handleSaveFilter}
                  disabled={!filterName.trim()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Existing Search Bar */}
        <div className="w-full mb-4">
          <div className="flex items-center w-full bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2 shadow-md">
            <span className="text-gray-400 dark:text-gray-500 mr-2">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 6.5 6.5a7.5 7.5 0 0 0 10.15 10.15Z"/></svg>
            </span>
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchFilter.query}
              onChange={(e) => setSearchFilter(prev => ({ ...prev, query: e.target.value }))}
              className={`flex-1 min-w-0 px-3 py-2 border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-green-400 text-base ${
                document.documentElement.classList.contains('dark')
                  ? 'text-white placeholder-gray-400'
                  : 'text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-4 p-3 mb-2 rounded bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 shadow">
            <span className="font-semibold text-green-700 dark:text-green-200">{selectedIds.length} selected</span>
            <button className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => setShowBulkCategory(true)}>Assign Category</button>
            <button className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setShowBulkAddTags(true)}>Add Tags</button>
            <button className="px-3 py-1 rounded bg-yellow-600 text-white hover:bg-yellow-700" onClick={() => setShowBulkRemoveTags(true)}>Remove Tags</button>
            {allFolders.length > 0 && (
              <button className="px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700" onClick={() => setShowBulkMove(true)}>Move to Folder</button>
            )}
            <button className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700" onClick={handleBulkDelete}>Delete</button>
            <button className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600" onClick={clearSelection}>Clear</button>
          </div>
        )}
        {/* Bulk Category Modal */}
        {showBulkCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 max-w-md w-full">
              <h2 className="text-lg font-bold mb-4">Assign Category</h2>
              <select
                value={bulkCategoryId}
                onChange={e => setBulkCategoryId(e.target.value)}
                className="block w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-4"
              >
                <option value="">Select a category</option>
                {safeCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => setShowBulkCategory(false)}>Cancel</button>
                <button className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700" onClick={handleBulkAssignCategory} disabled={!bulkCategoryId}>Assign</button>
              </div>
            </div>
          </div>
        )}
        {/* Bulk Add Tags Modal */}
        {showBulkAddTags && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 max-w-md w-full">
              <h2 className="text-lg font-bold mb-4">Add Tags</h2>
              <input
                type="text"
                value={bulkTags}
                onChange={e => setBulkTags(e.target.value)}
                className="block w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-4"
                placeholder="Comma-separated tags"
              />
              <div className="flex justify-end gap-2">
                <button className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => setShowBulkAddTags(false)}>Cancel</button>
                <button className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700" onClick={handleBulkAddTags} disabled={!bulkTags.trim()}>Add</button>
              </div>
            </div>
          </div>
        )}
        {/* Bulk Remove Tags Modal */}
        {showBulkRemoveTags && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 max-w-md w-full">
              <h2 className="text-lg font-bold mb-4">Remove Tags</h2>
              <input
                type="text"
                value={bulkTags}
                onChange={e => setBulkTags(e.target.value)}
                className="block w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-4"
                placeholder="Comma-separated tags to remove"
              />
              <div className="flex justify-end gap-2">
                <button className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => setShowBulkRemoveTags(false)}>Cancel</button>
                <button className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700" onClick={handleBulkRemoveTags} disabled={!bulkTags.trim()}>Remove</button>
              </div>
            </div>
          </div>
        )}
        {/* Bulk Move to Folder Modal */}
        {showBulkMove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 max-w-md w-full">
              <h2 className="text-lg font-bold mb-4">Move to Folder</h2>
              <select
                value={bulkMoveFolderId}
                onChange={e => setBulkMoveFolderId(e.target.value)}
                className="block w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-4"
              >
                <option value="">Select a folder</option>
                {allFolders.map(folder => (
                  <option key={folder.id} value={folder.id}>{folder.title}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => setShowBulkMove(false)}>Cancel</button>
                <button className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700" onClick={handleBulkMove} disabled={!bulkMoveFolderId}>Move</button>
              </div>
            </div>
          </div>
        )}
        {/* Controls Row */}
        <div className="flex items-center justify-between gap-4 mb-2 w-full">
          {/* Left side controls */}
          <div className="flex items-center gap-2">
            {/* Columns dropdown */}
            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button 
                aria-label="Toggle column visibility" 
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                title="Show/hide table columns"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-600 dark:text-gray-200">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
              </Menu.Button>
              <Menu.Items className="absolute left-0 mt-2 w-48 origin-top-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-10">
                {optionalColumns.map((key) => (
                  <Menu.Item key={key}>
                    {({ active }: { active: boolean }) => (
                      <div
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2
                          ${active ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'}
                          ${columnVisibility[key] ? 'font-semibold text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}
                        style={{ transition: 'background 0.2s' }}
                      >
                        <input
                          type="checkbox"
                          checked={!!columnVisibility[key]}
                          onChange={() => setColumnVisibility(v => ({ ...v, [key]: !v[key] }))}
                          className="mr-2 accent-green-600 dark:accent-green-400"
                        />
                        {columnLabels[key]}
                      </div>
                    )}
                  </Menu.Item>
                ))}
              </Menu.Items>
            </Menu>

            {/* Find Duplicates button */}
            <button
              aria-label="Find duplicate bookmarks"
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-yellow-900 dark:hover:bg-yellow-800 transition-colors"
              onClick={findDuplicates}
              title="Find and highlight duplicate bookmarks by URL"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-600 dark:text-yellow-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              </svg>
            </button>
            {duplicates.length > 0 && (
              <button
                className="ml-2 px-3 py-1 rounded bg-yellow-500 text-white hover:bg-yellow-600"
                onClick={openMergeModal}
                title="Review and merge duplicate bookmarks"
              >
                Review & Merge Duplicates
              </button>
            )}
          </div>

          {/* Right side zoom controls */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-full px-1 py-1 shadow-sm" title="Zoom table">
            <button
              aria-label="Zoom out"
              className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-lg font-bold"
              onClick={() => setTableZoom(z => clampZoom(z - 0.1))}
              disabled={tableZoom <= 0.5}
              title="Zoom out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-600 dark:text-gray-200">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
              </svg>
            </button>
            <span className="px-2 text-sm text-gray-600 dark:text-gray-300" style={{ minWidth: 36, textAlign: 'center' }}>{Math.round(tableZoom * 100)}%</span>
            <button
              aria-label="Zoom in"
              className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-lg font-bold"
              onClick={() => setTableZoom(z => clampZoom(z + 0.1))}
              disabled={tableZoom >= 2}
              title="Zoom in"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-600 dark:text-gray-200">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </div>

        {viewMode === 'card' ? (
          <div className="flex flex-col gap-3 mt-4">
            {paginated.map((bookmark) => (
              <div key={bookmark.id} className={`rounded-lg shadow p-4 flex flex-col gap-2 ${document.documentElement.classList.contains('dark') ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} ${duplicates.includes(bookmark.id) ? 'ring-2 ring-yellow-500' : ''}`}> 
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(bookmark.id)}
                    onChange={() => handleSelectOne(bookmark.id)}
                    className="mr-2 accent-green-600 dark:accent-green-400"
                    aria-label="Select bookmark"
                  />
                  <img src={`https://www.google.com/s2/favicons?domain=${bookmark.url || ''}`} alt="" className="w-4 h-4" />
                  <span className="font-semibold truncate" title={bookmark.title}>{bookmark.title}</span>
                </div>
                <a href={bookmark.url || ''} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate" title={bookmark.url || ''}>{bookmark.url || ''}</a>
                {isBookmark(bookmark) && bookmark.categoryId && (
                  <span className="inline-block px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100" style={{}}>{safeCategories.find(c => c.id === bookmark.categoryId)?.name || 'Uncategorized'}</span>
                )}
                {bookmark.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1" title={bookmark.description}>{bookmark.description}</div>
                )}
                {bookmark.tags && bookmark.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {bookmark.tags.map((tag: string) => (
                      <span key={tag} className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 dark:bg-gray-800 dark:text-indigo-200 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    aria-label="Edit bookmark"
                    onClick={() => openEditModal(bookmark)}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                    title="Edit bookmark"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    aria-label="Duplicate bookmark"
                    onClick={() => onDuplicate(bookmark)}
                    className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                    title="Duplicate bookmark"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                      <rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      <rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                  </button>
                  <button
                    aria-label="Delete bookmark"
                    onClick={() => handleDelete(bookmark.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    title="Delete bookmark"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ minWidth: 0 }}>
            <div style={{ width: 0, display: 'flex' }}>
              <div style={{ transform: `scale(${tableZoom})`, transformOrigin: 'top left', display: 'inline-block' }}>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className={document.documentElement.classList.contains('dark') ? 'bg-gray-800' : 'bg-gray-50'}>
                    <tr>
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={handleSelectAll}
                          aria-label="Select all bookmarks on page"
                          className="accent-green-600 dark:accent-green-400"
                        />
                      </th>
                      {columnsToRender.map((col) => (
                        <th
                          key={col}
                          className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer draggable-col${dragOverCol === col ? ' drag-over' : ''}`}
                          draggable={col !== 'actions'}
                          onDragStart={col !== 'actions' ? () => handleDragStart(col) : undefined}
                          onDragOver={col !== 'actions' ? (e) => handleDragOver(e, col) : undefined}
                          onDrop={col !== 'actions' ? () => handleDrop(col) : undefined}
                          onDragEnd={col !== 'actions' ? handleDragEnd : undefined}
                          onClick={getSortKey(col) ? () => handleSort(getSortKey(col)!) : undefined}
                          style={{ cursor: col !== 'actions' ? 'move' : 'default' }}
                        >
                          {columnLabels[col]} {getSortKey(col) && sortKey === getSortKey(col) && (<span>{sortOrder === 'asc' ? '↑' : '↓'}</span>)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={document.documentElement.classList.contains('dark') ? 'bg-gray-900 divide-y divide-gray-700' : 'bg-white divide-y divide-gray-200'}>
                    {paginated.map((bookmark) => (
                      <tr key={bookmark.id} className={`${document.documentElement.classList.contains('dark') ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} ${duplicates.includes(bookmark.id) ? 'bg-yellow-100 dark:bg-yellow-900' : ''}`}>
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(bookmark.id)}
                            onChange={() => handleSelectOne(bookmark.id)}
                            aria-label="Select bookmark"
                            className="accent-green-600 dark:accent-green-400"
                          />
                        </td>
                        {columnsToRender.map((col) => {
                          if (optionalColumns.includes(col) && !columnVisibility[col]) return null;
                          switch (col) {
                            case 'title':
                              return (
                                <td key="title" className="px-6 py-4 whitespace-nowrap max-w-xs truncate" title={bookmark.description || ''}>
                                  <div className="flex items-center">
                                    <img src={`https://www.google.com/s2/favicons?domain=${bookmark.url || ''}`} alt="" className="w-4 h-4 mr-2" />
                                    <span className="text-sm font-medium truncate" title={bookmark.title}>{bookmark.title}</span>
                                  </div>
                                  {bookmark.description && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={bookmark.description}>{bookmark.description}</div>
                                  )}
                                </td>
                              );
                            case 'url':
                              return (
                                <td key="url" className="px-6 py-4 whitespace-nowrap max-w-xs truncate">
                                  <a href={bookmark.url || ''} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block" title={bookmark.url || ''}>{bookmark.url || ''}</a>
                                </td>
                              );
                            case 'category':
                              return (
                                <td key="category" className="px-6 py-4 whitespace-nowrap">
                                  {isBookmark(bookmark) && bookmark.categoryId && (
                                    <span className="inline-block px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100" style={{}}>{safeCategories.find(c => c.id === bookmark.categoryId)?.name || 'Uncategorized'}</span>
                                  )}
                                </td>
                              );
                            case 'tags':
                              return (
                                <td key="tags" className="px-6 py-4 whitespace-nowrap">
                                  {bookmark.tags && bookmark.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {bookmark.tags.map((tag: string) => (
                                        <span key={tag} className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 dark:bg-gray-800 dark:text-indigo-200 rounded-full">{tag}</span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              );
                            case 'description':
                              return (
                                <td key="description" className="px-6 py-4 whitespace-nowrap" title={bookmark.description}>{bookmark.description}</td>
                              );
                            case 'createdAt':
                              return (
                                <td key="createdAt" className="px-6 py-4 whitespace-nowrap">{new Date(bookmark.createdAt || '').toLocaleDateString()}</td>
                              );
                            case 'lastAccessed':
                              return (
                                <td key="lastAccessed" className="px-6 py-4 whitespace-nowrap">{new Date(bookmark.lastAccessed || '').toLocaleDateString()}</td>
                              );
                            case 'accessCount':
                              return (
                                <td key="accessCount" className="px-6 py-4 whitespace-nowrap">{bookmark.accessCount ?? 0}</td>
                              );
                            case 'actions':
                              return (
                                <td key="actions" className="px-6 py-4 whitespace-nowrap text-right min-w-[90px]">
                                  <button onClick={() => openEditModal(bookmark)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-4" title="Edit bookmark"><PencilIcon className="h-5 w-5" /></button>
                                  <button onClick={() => onDuplicate(bookmark)} className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 mr-4" aria-label="Duplicate bookmark" title="Duplicate bookmark">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                                      <rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                      <rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                    </svg>
                                  </button>
                                  <button onClick={() => handleDelete(bookmark.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300" title="Delete bookmark"><TrashIcon className="h-5 w-5" /></button>
                                </td>
                              );
                            default:
                              return null;
                          }
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {paginated.length} of {sorted.length} bookmarks
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 border rounded-lg disabled:opacity-50 transition ${
                document.documentElement.classList.contains('dark')
                  ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 disabled:text-gray-500'
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 disabled:text-gray-400'
              }`}
              title="Previous page"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 border rounded-lg disabled:opacity-50 transition ${
                document.documentElement.classList.contains('dark')
                  ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 disabled:text-gray-500'
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 disabled:text-gray-400'
              }`}
              title="Next page"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {editModalOpen && selectedBookmark && isBookmark(selectedBookmark) && (
        <EditBookmarkModal
          open={editModalOpen}
          bookmark={selectedBookmark}
          onClose={closeEditModal}
          onSave={handleModalSave}
        />
      )}

      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 max-w-2xl w-full">
            <h2 className="text-lg font-bold mb-4">Review & Merge Duplicates</h2>
            {duplicateGroups.length === 0 ? (
              <div>No duplicate groups found.</div>
            ) : (
              <div className="space-y-6 max-h-[60vh] overflow-y-auto">
                {duplicateGroups.map(group => (
                  <div key={group.url} className="border-b pb-4 mb-4">
                    <div className="font-semibold mb-2">URL: <span className="text-blue-600 break-all">{group.url}</span></div>
                    <div className="flex flex-col gap-2">
                      {group.ids.map(id => {
                        const bm = safeBookmarks.find(b => b.id === id);
                        if (!bm) return null;
                        return (
                          <label key={id} className={`flex items-start gap-2 p-2 rounded border ${mergeSelections[group.url] === id ? 'border-green-500 bg-green-50 dark:bg-green-900' : 'border-gray-300 dark:border-gray-700'}`}>
                            <input
                              type="radio"
                              name={`keep-${group.url}`}
                              checked={mergeSelections[group.url] === id || (!mergeSelections[group.url] && group.ids[0] === id)}
                              onChange={() => handleSelectToKeep(group.url, id)}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{bm.title}</div>
                              <div className="text-xs text-gray-500">{bm.url}</div>
                              {bm.tags && bm.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {bm.tags.map(tag => (
                                    <span key={tag} className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 rounded-full">{tag}</span>
                                  ))}
                                </div>
                              )}
                              {bm.description && (
                                <div className="text-xs text-gray-400 mt-1">{bm.description}</div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 mt-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={mergeTags} onChange={e => setMergeTags(e.target.checked)} /> Merge tags
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={mergeCategories} onChange={e => setMergeCategories(e.target.checked)} /> Merge categories
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={mergeDescriptions} onChange={e => setMergeDescriptions(e.target.checked)} /> Merge descriptions
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600" onClick={closeMergeModal}>Cancel</button>
              <button className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700" onClick={handleMerge}>Merge Selected</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 
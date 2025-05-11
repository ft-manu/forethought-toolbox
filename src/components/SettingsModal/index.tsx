import React, { useRef, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { BookmarkService } from '@/services/bookmarkService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeChange: (theme: 'light' | 'dark') => void;
  currentTheme: 'light' | 'dark';
  onShowTour?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onThemeChange, currentTheme, onShowTour }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [backupFrequency, setBackupFrequency] = useState<string>('');
  const [lastBackup, setLastBackup] = useState<{ bookmarks: string | null; categories: string | null; automatic: string | null }>({ 
    bookmarks: null, 
    categories: null,
    automatic: null 
  });
  const [nextBackupTime, setNextBackupTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{
    current: number;
    total: number;
    currentFile: string;
  } | null>(null);
  const [restorePreview, setRestorePreview] = useState<{
    bookmarks: number;
    categories: number;
    retoolPages: number;
    notionPages: number;
    files: Array<{
      name: string;
      date: string;
      version: string;
      size: string;
      conflicts: {
        bookmarks: number;
        categories: number;
        retoolPages: number;
        notionPages: number;
      };
      validation: {
        isValid: boolean;
        warnings: string[];
        errors: string[];
      };
    }>;
    conflicts: {
      total: number;
      details: Array<{
        type: 'bookmarks' | 'categories' | 'retoolPages' | 'notionPages';
        count: number;
        files: string[];
      }>;
    };
  } | null>(null);
  const [shouldCancelRestore, setShouldCancelRestore] = useState(false);
  const [conflictResolution, setConflictResolution] = useState<'newest' | 'oldest' | 'merge'>('newest');
  const [restoreHistory, setRestoreHistory] = useState<Array<{
    timestamp: string;
    files: string[];
    dataTypes: string[];
    status: 'success' | 'failed' | 'cancelled';
  }>>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictOptions, setConflictOptions] = useState<{ total: number, details: any[] } | null>(null);
  const [conflictResolutionChoice, setConflictResolutionChoice] = useState<'newest' | 'oldest' | 'merge'>('newest');
  let resolveConflictPromise: ((value: 'newest' | 'oldest' | 'merge' | null) => void) | null = null;
  const backupOptions = [
    { label: '15M', value: '15m' },
    { label: '30M', value: '30m' },
    { label: '2H', value: '2h' },
    { label: '8H', value: '8h' },
    { label: '12H', value: '12h' },
    { label: '24H', value: '24h' },
    { label: '3D', value: '3d' },
    { label: '7D', value: '7d' },
  ];

  useEffect(() => {
    chrome.storage.local.get(['backupFrequency', 'lastBackup'], (data) => {
      if (data.backupFrequency) setBackupFrequency(data.backupFrequency);
      if (data.lastBackup) setLastBackup(data.lastBackup);
    });

    // Listen for toast messages from background script
    const handleMessage = (message: { type: string; payload: { message: string; type: 'success' | 'error' } }) => {
      if (message?.type === 'SHOW_TOAST') {
        toast[message.payload.type](message.payload.message, { duration: 4000 });
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [isOpen]);

  useEffect(() => {
    // On mount, load nextBackupTime from storage
    chrome.storage.local.get(['nextBackupTime'], (data) => {
      if (typeof data.nextBackupTime === 'number') {
        setNextBackupTime(data.nextBackupTime);
      }
    });
  }, []);

  useEffect(() => {
    if (!backupFrequency) {
      setNextBackupTime(null);
      chrome.storage.local.remove('nextBackupTime');
      return;
    }

    // Calculate initial time remaining
    const interval = getTimeRemaining(backupFrequency);
    const lastBackupTime = lastBackup.automatic ? new Date(lastBackup.automatic).getTime() : Date.now();
    let nextTime = lastBackupTime + interval;
    // If nextBackupTime is in the past, recalculate
    if (nextBackupTime && nextBackupTime > Date.now()) {
      nextTime = nextBackupTime;
    } else {
      nextTime = lastBackupTime + interval;
    }
    setNextBackupTime(nextTime);
    chrome.storage.local.set({ nextBackupTime: nextTime });

    // Update countdown every minute
    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = nextTime - now;
      if (remaining <= 0) {
        const newNextTime = now + interval;
        setNextBackupTime(newNextTime);
        chrome.storage.local.set({ nextBackupTime: newNextTime });
      }
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [backupFrequency, lastBackup.automatic]);

  useEffect(() => {
    // Whenever nextBackupTime changes, persist it
    if (nextBackupTime) {
      chrome.storage.local.set({ nextBackupTime });
    }
  }, [nextBackupTime]);

  const handleBackupFrequency = (value: string) => {
    setBackupFrequency(value);
    chrome.storage.local.set({ backupFrequency: value });
  };

  const handleManualBackup = async () => {
    try {
      // Get all data from storage
      const data = await chrome.storage.local.get([
        'bookmarks',
        'bookmark_categories',
        'retoolPages',
        'notionPages',
        'bookmarkClicks'
      ]);
      
      const timestamp = new Date().toISOString();
      const fileTimestamp = timestamp.replace(/[:.]/g, '-');
      let urls: string[] = [];

      // Create separate backup files for each type of data
      
      // 1. Bookmarks backup (includes all columns and click stats)
      const bookmarksBackup = {
        bookmarks: data.bookmarks || [],
        bookmarkClicks: data.bookmarkClicks || {},
        exportDate: timestamp,
        version: chrome.runtime.getManifest().version
      };
      const bookmarksBlob = new Blob([JSON.stringify(bookmarksBackup, null, 2)], { type: 'application/json' });
      const bookmarksUrl = URL.createObjectURL(bookmarksBlob);
      urls.push(bookmarksUrl);
      await chrome.downloads.download({
        url: bookmarksUrl,
        filename: `bookmarks_backup_${fileTimestamp}.json`,
        saveAs: true
      });

      // 2. Categories backup
      const categoriesBackup = {
        categories: data.bookmark_categories || [],
        exportDate: timestamp,
        version: chrome.runtime.getManifest().version
      };
      const categoriesBlob = new Blob([JSON.stringify(categoriesBackup, null, 2)], { type: 'application/json' });
      const categoriesUrl = URL.createObjectURL(categoriesBlob);
      urls.push(categoriesUrl);
      await chrome.downloads.download({
        url: categoriesUrl,
        filename: `categories_backup_${fileTimestamp}.json`,
        saveAs: true
      });

      // 3. Custom Pages backup (Retool and Notion)
      const customPagesBackup = {
        retoolPages: data.retoolPages || [],
        notionPages: data.notionPages || [],
        exportDate: timestamp,
        version: chrome.runtime.getManifest().version
      };
      const customPagesBlob = new Blob([JSON.stringify(customPagesBackup, null, 2)], { type: 'application/json' });
      const customPagesUrl = URL.createObjectURL(customPagesBlob);
      urls.push(customPagesUrl);
      await chrome.downloads.download({
        url: customPagesUrl,
        filename: `custom_pages_backup_${fileTimestamp}.json`,
        saveAs: true
      });

      // Update last backup timestamp (manual only)
      const newLastBackup = {
        bookmarks: timestamp,
        categories: timestamp,
        automatic: lastBackup.automatic || null
      };
      await chrome.storage.local.set({ lastBackup: newLastBackup });
      setLastBackup(newLastBackup);

      // Clean up object URLs
      urls.forEach(url => URL.revokeObjectURL(url));
      toast.success('Backup files downloaded!', { duration: 4000 });
    } catch (error) {
      console.error('Manual backup error:', error);
      toast.error('Failed to create backup. Please try again.');
    }
  };

  const validateBackupData = (data: any): { isValid: boolean; warnings: string[]; errors: string[] } => {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check if data is an object
    if (!data || typeof data !== 'object') {
      errors.push('Invalid backup format: data must be an object');
      return { isValid: false, warnings, errors };
    }

    // Check required fields
    if (!data.exportDate) {
      warnings.push('Missing export date');
    }

    if (!data.version) {
      warnings.push('Missing version information');
    }

    // Validate bookmarks if present
    if (data.bookmarks) {
      if (!Array.isArray(data.bookmarks)) {
        errors.push('Bookmarks must be an array');
      } else {
        data.bookmarks.forEach((bm: any, index: number) => {
          if (!bm.id) warnings.push(`Bookmark at index ${index} missing ID`);
          if (!bm.title) warnings.push(`Bookmark at index ${index} missing title`);
          if (!bm.url) warnings.push(`Bookmark at index ${index} missing URL`);
        });
      }
    }

    // Validate categories if present
    if (data.categories) {
      if (!Array.isArray(data.categories)) {
        errors.push('Categories must be an array');
      } else {
        data.categories.forEach((cat: any, index: number) => {
          if (!cat.name) warnings.push(`Category at index ${index} missing name`);
          if (!cat.color) warnings.push(`Category at index ${index} missing color`);
        });
      }
    }

    // Validate Retool pages if present
    if (data.retoolPages) {
      if (!Array.isArray(data.retoolPages)) {
        errors.push('Retool pages must be an array');
      }
    }

    // Validate Notion pages if present
    if (data.notionPages) {
      if (!Array.isArray(data.notionPages)) {
        errors.push('Notion pages must be an array');
      }
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors
    };
  };

  const detectConflicts = (files: Array<{ name: string; data: any }>): {
    total: number;
    details: Array<{
      type: 'bookmarks' | 'categories' | 'retoolPages' | 'notionPages';
      count: number;
      files: string[];
    }>;
  } => {
    const conflicts = {
      total: 0,
      details: [] as Array<{
        type: 'bookmarks' | 'categories' | 'retoolPages' | 'notionPages';
        count: number;
        files: string[];
      }>
    };

    // Check for bookmark conflicts
    const bookmarkIds = new Set<string>();
    const bookmarkConflicts = new Set<string>();
    files.forEach(file => {
      if (Array.isArray(file.data.bookmarks)) {
        file.data.bookmarks.forEach((bm: any) => {
          if (bm.id) {
            if (bookmarkIds.has(bm.id)) {
              bookmarkConflicts.add(bm.id);
            }
            bookmarkIds.add(bm.id);
          }
        });
      }
    });

    if (bookmarkConflicts.size > 0) {
      conflicts.details.push({
        type: 'bookmarks',
        count: bookmarkConflicts.size,
        files: files.map(f => f.name)
      });
      conflicts.total += bookmarkConflicts.size;
    }

    // Check for category conflicts
    const categoryNames = new Set<string>();
    const categoryConflicts = new Set<string>();
    files.forEach(file => {
      if (Array.isArray(file.data.categories)) {
        file.data.categories.forEach((cat: any) => {
          if (cat.name) {
            if (categoryNames.has(cat.name)) {
              categoryConflicts.add(cat.name);
            }
            categoryNames.add(cat.name);
          }
        });
      }
    });

    if (categoryConflicts.size > 0) {
      conflicts.details.push({
        type: 'categories',
        count: categoryConflicts.size,
        files: files.map(f => f.name)
      });
      conflicts.total += categoryConflicts.size;
    }

    return conflicts;
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsRestoring(true);
      setRestorePreview(null);
      setRestoreProgress(null);
      setShouldCancelRestore(false);

      // Read and parse all files first
      const fileData = await Promise.all(
        Array.from(files).map(async (file) => {
          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });
          return {
            file,
            data: JSON.parse(content)
          };
        })
      );

      // Sort files by date
      fileData.sort((a, b) => {
        const dateA = a.data.exportDate ? new Date(a.data.exportDate).getTime() : 0;
        const dateB = b.data.exportDate ? new Date(b.data.exportDate).getTime() : 0;
        return dateB - dateA; // Newest first
      });

      // Validate all files
      const validatedFiles = fileData.map(({ file, data }) => {
        const validation = validateBackupData(data);
        return {
          file,
          data,
          validation
        };
      });

      // Check for validation errors
      const hasErrors = validatedFiles.some(f => !f.validation.isValid);
      if (hasErrors) {
        const errorFiles = validatedFiles
          .filter(f => !f.validation.isValid)
          .map(f => f.file.name);
        throw new Error(`Validation failed for files: ${errorFiles.join(', ')}`);
      }

      // Detect conflicts
      const conflicts = detectConflicts(validatedFiles.map(({ file, data }) => ({ name: file.name, data })));

      // Create preview
      const preview = {
        bookmarks: 0,
        categories: 0,
        retoolPages: 0,
        notionPages: 0,
        files: validatedFiles.map(({ file, data, validation }) => ({
          name: file.name,
          date: data.exportDate ? new Date(data.exportDate).toLocaleString() : 'Unknown date',
          version: data.version || 'Unknown version',
          size: formatFileSize(file.size),
          conflicts: {
            bookmarks: 0,
            categories: 0,
            retoolPages: 0,
            notionPages: 0
          },
          validation
        })),
        conflicts
      };

      // Count items
      validatedFiles.forEach(({ data }) => {
        if (Array.isArray(data.bookmarks)) preview.bookmarks += data.bookmarks.length;
        if (Array.isArray(data.categories)) preview.categories += data.categories.length;
        if (Array.isArray(data.retoolPages)) preview.retoolPages += data.retoolPages.length;
        if (Array.isArray(data.notionPages)) preview.notionPages += data.notionPages.length;
      });

      setRestorePreview(preview);

      // Show confirmation dialog with conflict resolution options if needed
      if (conflicts.total > 0) {
        setConflictOptions(conflicts);
        setShowConflictModal(true);
        const resolution = await new Promise<'newest' | 'oldest' | 'merge' | null>((resolve) => {
          resolveConflictPromise = resolve;
        });
        setShowConflictModal(false);
        setConflictOptions(null);
        if (!resolution) return;
        setConflictResolution(resolution);
      } else if (!window.confirm(
        `Are you sure you want to restore the following data?\n\n` +
        `Files:\n${preview.files.map(f => `- ${f.name} (${f.date}, v${f.version}, ${f.size})`).join('\n')}\n\n` +
        `Data to restore:\n` +
        `- Bookmarks: ${preview.bookmarks}\n` +
        `- Categories: ${preview.categories}\n` +
        `- Retool Pages: ${preview.retoolPages}\n` +
        `- Notion Pages: ${preview.notionPages}\n\n` +
        `This will overwrite your current data.`
      )) {
        return;
      }

      // Create a backup of current data
      const currentData = await chrome.storage.local.get([
        'bookmarks',
        'bookmark_categories',
        'retoolPages',
        'notionPages',
        'bookmarkClicks'
      ]);
      const backupTimestamp = new Date().toISOString();
      await chrome.storage.local.set({
        [`restore_backup_${backupTimestamp}`]: currentData
      });

      // Process files according to conflict resolution strategy
      const updates: { [key: string]: any } = {};
      let hasRestoredData = false;

      for (let i = 0; i < validatedFiles.length; i++) {
        if (shouldCancelRestore) {
          throw new Error('Restore cancelled by user');
        }

        const { file, data } = validatedFiles[i];
        setRestoreProgress({
          current: i + 1,
          total: validatedFiles.length,
          currentFile: file.name
        });

        // Process data based on conflict resolution strategy
        if (Array.isArray(data.bookmarks)) {
          if (conflictResolution === 'merge') {
            updates.bookmarks = [...(updates.bookmarks || []), ...data.bookmarks];
          } else {
            updates.bookmarks = data.bookmarks;
          }
          hasRestoredData = true;
        }

        if (data.bookmarkClicks) {
          updates.bookmarkClicks = {
            ...(updates.bookmarkClicks || {}),
            ...data.bookmarkClicks
          };
          hasRestoredData = true;
        }

        if (Array.isArray(data.categories)) {
          if (i === 0) {
            const existingCategories = await BookmarkService.getCategories();
            for (const category of existingCategories) {
              await BookmarkService.deleteCategory(category.id);
            }
          }
          for (const category of data.categories) {
            await BookmarkService.addCategory({
              name: category.name,
              color: category.color,
              icon: category.icon
            });
          }
          if (conflictResolution === 'merge') {
            updates.bookmark_categories = [...(updates.bookmark_categories || []), ...data.categories];
          } else {
            updates.bookmark_categories = data.categories;
          }
          hasRestoredData = true;
        }

        if (Array.isArray(data.retoolPages)) {
          if (conflictResolution === 'merge') {
            updates.retoolPages = [...(updates.retoolPages || []), ...data.retoolPages];
          } else {
            updates.retoolPages = data.retoolPages;
          }
          hasRestoredData = true;
        }

        if (Array.isArray(data.notionPages)) {
          if (conflictResolution === 'merge') {
            updates.notionPages = [...(updates.notionPages || []), ...data.notionPages];
          } else {
            updates.notionPages = data.notionPages;
          }
          hasRestoredData = true;
        }
      }

      if (!hasRestoredData) {
        throw new Error('No valid data found in backup files');
      }

      // Update all data at once
      await chrome.storage.local.set(updates);

      // Update last backup timestamp
      const timestamp = new Date().toISOString();
      await chrome.storage.local.set({
        lastBackup: {
          bookmarks: timestamp,
          categories: timestamp,
          automatic: lastBackup.automatic
        }
      });

      // Add to restore history
      const historyEntry = {
        timestamp,
        files: validatedFiles.map(f => f.file.name),
        dataTypes: [
          ...(updates.bookmarks ? ['bookmarks'] : []),
          ...(updates.bookmark_categories ? ['categories'] : []),
          ...(updates.retoolPages ? ['retoolPages'] : []),
          ...(updates.notionPages ? ['notionPages'] : [])
        ],
        status: 'success' as const
      };
      setRestoreHistory(prev => [historyEntry, ...prev]);

      toast.success(`Successfully restored data from ${validatedFiles.length} backup file(s)!`, { duration: 4000 });
      // Force a reload to update all views
      window.location.reload();
    } catch (error) {
      console.error('Restore error:', error);
      if (error instanceof Error && error.message === 'Restore cancelled by user') {
        toast.error('Restore cancelled', { duration: 4000 });
      } else {
        toast.error(`Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`, { duration: 4000 });
      }
    } finally {
      setIsRestoring(false);
      setRestorePreview(null);
      setRestoreProgress(null);
      setShouldCancelRestore(false);
    }
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Export bookmarks as JSON
  const handleExport = () => {
    chrome.storage.local.get('bookmarks', (data) => {
      const bookmarks = data.bookmarks || [];
      const blob = new Blob([JSON.stringify(bookmarks, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bookmarks.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Bookmarks exported!', { duration: 3000 });
    });
  };

  // Import bookmarks from JSON
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target?.result) return;
      try {
        const imported = JSON.parse(e.target.result as string);
        if (Array.isArray(imported)) {
          // Ensure each bookmark has the required fields and tag as imported
          const processedBookmarks = imported.map(bm => ({
            id: bm.id || crypto.randomUUID(),
            type: bm.type || 'bookmark',
            title: bm.title || '',
            url: bm.url || '',
            parentId: bm.parentId || null,
            categoryId: bm.categoryId,
            tags: bm.tags || [],
            createdAt: bm.createdAt || new Date().toISOString(),
            lastAccessed: bm.lastAccessed,
            accessCount: bm.accessCount || 0,
            description: bm.description,
            imported: true // Tag as imported
          }));
          await chrome.storage.local.set({ bookmarks: processedBookmarks });
          toast.success('Bookmarks imported successfully ✅');
          // Force a reload of the bookmarks in all views
          window.location.reload();
        } else {
          toast.error('Invalid format. Expected an array of bookmarks.');
        }
      } catch (err) {
        toast.error('Failed to parse JSON: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  // Add this function to calculate time remaining
  const getTimeRemaining = (frequency: string): number => {
    const value = parseInt(frequency.slice(0, -1));
    const unit = frequency.slice(-1);
    let ms = 0;
    switch (unit) {
      case 'm':
        ms = value * 60 * 1000;
        break;
      case 'h':
        ms = value * 60 * 60 * 1000;
        break;
      case 'd':
        ms = value * 24 * 60 * 60 * 1000;
        break;
      default:
        return 0;
    }
    return ms;
  };

  useEffect(() => {
    if (!backupFrequency || !nextBackupTime) {
      setCountdown('');
      return;
    }
    const updateCountdown = () => {
      const ms = nextBackupTime - Date.now();
      if (ms <= 0) {
        setCountdown('0m 0.0s');
        return;
      }
      const totalSeconds = ms / 1000;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.floor(totalSeconds % 60);
      const tenths = Math.floor((ms % 1000) / 100);
      setCountdown(`${minutes}m ${seconds}.${tenths}s`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 100);
    return () => clearInterval(interval);
  }, [backupFrequency, nextBackupTime]);

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center ${isOpen ? '' : 'hidden'}`} onClick={onClose}>
      <div
        ref={modalRef}
        className={`bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 min-w-[320px] max-w-lg w-full max-h-screen overflow-y-auto relative ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        onClick={e => e.stopPropagation()}
        style={{ transition: 'background-color 0.2s' }}
      >
        <button className="absolute top-2 right-2 z-50 text-2xl text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 bg-white/80 dark:bg-gray-900/80 rounded-full w-8 h-8 flex items-center justify-center" onClick={onClose} title="Close settings">&times;</button>
        <h2 className="text-lg font-bold mb-4">Settings</h2>
        
        {/* Theme Section (always at the top) */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Theme</label>
          <div className="flex gap-2 items-center">
            <button
              className={`px-3 py-1 rounded ${currentTheme === 'light' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
              onClick={() => onThemeChange('light')}
              title="Switch to light theme"
            >☀️ Light</button>
            <button
              className={`px-3 py-1 rounded ${currentTheme === 'dark' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
              onClick={() => onThemeChange('dark')}
              title="Switch to dark theme"
            >🌙 Dark</button>
          </div>
        </div>

        {/* Import/Export Bookmarks Section (now below Theme, above Manual Backup) */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-gray-800 rounded-lg">
          <label className="block text-sm font-medium mb-2">📁 Import/Export Bookmarks</label>
          <div className="flex gap-3 flex-wrap w-full">
            <button
              className="flex-1 min-w-0 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
              onClick={handleExport}
              title="Export bookmarks as JSON file"
            >
              📤 Export Bookmarks as JSON
            </button>
            <label className="flex-1 min-w-0 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium relative overflow-hidden cursor-pointer" title="Import bookmarks from JSON file">
              📥 Import Bookmarks from JSON
              <input
                type="file"
                accept="application/json"
                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleImport}
              />
            </label>
            {/* Import Browser Bookmarks via HTML */}
            <label className="flex-1 min-w-0 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium relative overflow-hidden cursor-pointer" title="Import browser bookmarks from HTML file">
              🌐 Import Browser Bookmarks (HTML)
              <input
                type="file"
                accept=".html"
                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    console.log("Parsing HTML file:", file.name);
                    
                    // Add a debugging snippet to show the raw text content of the file
                    console.log("Raw file preview (first 1000 chars):", text.substring(0, 1000));
                    
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, 'text/html');
                    
                    // Debug the structure
                    console.log("HTML Structure:", doc.body ? doc.body.innerHTML.substring(0, 500) + "..." : "No body element found");
                    console.log("Number of DL elements:", doc.querySelectorAll('DL').length);
                    console.log("Number of DT elements:", doc.querySelectorAll('DT').length);
                    console.log("Number of A elements:", doc.querySelectorAll('A').length);
                    
                    // Try to output one link for debugging
                    const firstLink = doc.querySelector('A');
                    if (firstLink) {
                      console.dir(firstLink);
                      console.log("First link href:", firstLink.getAttribute('href'));
                      console.log("First link text:", firstLink.textContent);
                    } else {
                      console.warn("No links (<A> tags) found in the HTML file!");
                    }

                    // Robust HTML bookmark parser
                    function parseBookmarksFromHTML(doc: Document): { bookmarks: any[]; categories: string[]; categoryMap: {[key: string]: string} } {
                      const bookmarks: any[] = [];
                      const categories = new Set<string>(['Uncategorized']);
                      const categoryMap: {[key: string]: string} = {
                        'Uncategorized': 'uncategorized'
                      };
                      
                      // Extract all bookmark links with their folder structure
                      const allLinks = Array.from(doc.querySelectorAll('A'));
                      console.log(`Found ${allLinks.length} links total`);
                      
                      if (allLinks.length === 0) {
                        throw new Error("No bookmarks found in the HTML file.");
                      }
                      
                      // Process all links directly without trying to reconstruct folders
                      allLinks.forEach((link) => {
                        const href = link.getAttribute('href');
                        const title = link.textContent?.trim() || 'Untitled';
                        
                        // Skip links without hrefs or non-http(s) URLs
                        if (!href || (!href.startsWith('http://') && !href.startsWith('https://'))) {
                          console.log(`Skipping link: ${title} - Invalid URL: ${href}`);
                          return;
                        }
                        
                        // Create a bookmark object
                        const bookmark = {
                          id: crypto.randomUUID(),
                          type: 'bookmark',
                          title: title,
                          url: href,
                          categoryId: 'uncategorized', // Default to uncategorized
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                          tags: [] as string[],
                          parentId: null,
                          description: '',
                          icon: ''
                        };
                        
                        // Find parent folder if any
                        let parent = link.closest('DL')?.previousElementSibling;
                        if (parent && parent.tagName === 'DT') {
                          const folderHeader = parent.querySelector('H3');
                          if (folderHeader) {
                            const folderName = folderHeader.textContent?.trim() || 'Unnamed Folder';
                            
                            // Create category ID from folder name
                            const categoryId = folderName.toLowerCase().replace(/[^a-z0-9]/g, '_');
                            
                            // Add to categories if it doesn't exist
                            if (!categoryMap[folderName]) {
                              categoryMap[folderName] = categoryId;
                              categories.add(folderName);
                            }
                            
                            // Update bookmark with category ID
                            bookmark.categoryId = categoryId;
                            console.log(`Assigning bookmark "${title}" to category "${folderName}"`);
                          }
                        }
                        
                        bookmarks.push(bookmark);
                      });
                      
                      console.log(`Processed ${bookmarks.length} valid bookmarks`);
                      console.log(`Extracted ${categories.size} categories`);
                      
                      return { 
                        bookmarks, 
                        categories: Array.from(categories),
                        categoryMap
                      };
                    }

                    const result = parseBookmarksFromHTML(doc);
                    const newBookmarks = result.bookmarks;
                    const newCategories = result.categories;
                    const categoryMap = result.categoryMap;
                    
                    console.log(`Parsed ${newBookmarks.length} bookmarks and ${newCategories.length} categories`);
                    console.log("Sample bookmarks:", newBookmarks.slice(0, 3));
                    console.log("Categories:", newCategories);
                    console.log("Category map:", categoryMap);

                    // Get existing bookmarks and categories
                    const { bookmarks = [], bookmark_categories = [] } = await chrome.storage.local.get(['bookmarks', 'bookmark_categories']);
                    console.log(`Got ${bookmarks.length} existing bookmarks and ${bookmark_categories.length} categories`);

                    // Create any missing categories
                    const existingCategoryNames = new Set(bookmark_categories.map((cat: any) => cat.name));
                    const categoriesToAdd = [];
                    
                    for (const categoryName of newCategories) {
                      if (categoryName !== 'Uncategorized' && !existingCategoryNames.has(categoryName)) {
                        // Generate a random color for the category
                        const colors = ['red', 'green', 'blue', 'purple', 'yellow', 'pink', 'orange', 'teal'];
                        const randomColor = colors[Math.floor(Math.random() * colors.length)];
                        
                        categoriesToAdd.push({
                          id: categoryMap[categoryName],
                          name: categoryName,
                          color: randomColor
                        });
                      }
                    }
                    
                    // Add new categories
                    if (categoriesToAdd.length > 0) {
                      console.log(`Adding ${categoriesToAdd.length} new categories`);
                      const updatedCategories = [...bookmark_categories, ...categoriesToAdd];
                      await chrome.storage.local.set({ bookmark_categories: updatedCategories });
                    }

                    // Verify we have bookmarks to add
                    if (newBookmarks.length === 0) {
                      console.warn("No bookmarks were parsed from the HTML file!");
                      toast.error('No bookmarks found in the HTML file. Make sure it has the correct format.');
                      return;
                    }

                    // Check for duplicate bookmarks by URL
                    const existingUrls = new Set(bookmarks.map((bm: any) => bm.url));
                    const duplicates: any[] = [];
                    const uniqueBookmarks: any[] = [];

                    // Filter out duplicates
                    newBookmarks.forEach(bookmark => {
                      if (existingUrls.has(bookmark.url)) {
                        duplicates.push(bookmark);
                      } else {
                        uniqueBookmarks.push(bookmark);
                        existingUrls.add(bookmark.url); // Add to set to prevent duplicates within the import
                      }
                    });

                    console.log(`Found ${duplicates.length} duplicate bookmarks that will be skipped`);
                    console.log(`Adding ${uniqueBookmarks.length} unique bookmarks`);

                    // Merge and save bookmarks
                    const updatedBookmarks = [...bookmarks, ...uniqueBookmarks];
                    await chrome.storage.local.set({
                      bookmarks: updatedBookmarks
                    });
                    
                    // Double check that the save worked
                    const check = await chrome.storage.local.get(['bookmarks']);
                    console.log(`Storage verification: ${check.bookmarks.length} bookmarks saved`);
                    
                    // Successfully saved - now refresh without reloading
                    const message = uniqueBookmarks.length > 0
                      ? `Successfully imported ${uniqueBookmarks.length} bookmarks from HTML!${duplicates.length > 0 ? ` (${duplicates.length} duplicates skipped)` : ''}`
                      : `No new bookmarks imported. All ${duplicates.length} bookmarks already exist.`;

                    toast.success(message);
                    
                    // Dispatch custom event for other components to refresh
                    const event = new CustomEvent('bookmarks-updated');
                    document.dispatchEvent(event);
                    
                    // Force page refresh to ensure all components update
                    setTimeout(() => {
                      window.location.reload();
                    }, 500);
                  } catch (error) {
                    console.error('Import error:', error);
                    toast.error('Failed to import bookmarks. Please check the file format and console for details.');
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* Manual Backup & Restore Section */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <label className="block text-sm font-medium mb-2">Manual Backup & Restore</label>
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleManualBackup}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200 flex items-center justify-center gap-2"
              title="Create a manual backup now"
            >
              <span>💾</span> Create Backup Now
            </button>
            <div className="flex flex-col gap-2">
              <label className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer relative" title="Restore from backup file(s)">
                <span>{isRestoring ? '⏳' : '📥'}</span>
                {isRestoring ? 'Restoring...' : 'Restore from Backup'}
                <input
                  type="file"
                  accept="application/json"
                  multiple
                  className="hidden"
                  onChange={handleRestore}
                  disabled={isRestoring}
                />
                {isRestoring && (
                  <div className="absolute inset-0 bg-blue-700 bg-opacity-50 rounded flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  </div>
                )}
              </label>
              {isRestoring && restoreProgress && (
                <div className="w-full">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Processing {restoreProgress.currentFile}</span>
                    <span>{restoreProgress.current} of {restoreProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(restoreProgress.current / restoreProgress.total) * 100}%` }}
                    />
                  </div>
                  <button
                    className="mt-2 text-sm text-red-600 hover:text-red-700"
                    onClick={() => setShouldCancelRestore(true)}
                    title="Cancel restore process"
                  >
                    Cancel Restore
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="text-sm space-y-1 mt-2">
            <div>
              <span className="font-medium">Last Manual Backup:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">
                {lastBackup.bookmarks ? new Date(lastBackup.bookmarks).toLocaleString() : 'Never'}
              </span>
            </div>
            <div>
              <span className="font-medium">Last Automatic Backup:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">
                {lastBackup.automatic ? new Date(lastBackup.automatic).toLocaleString() : 'Never'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {backupFrequency ? (
                nextBackupTime ? (
                  <>Next automatic backup in {countdown}</>
                ) : (
                  'Calculating next backup time...'
                )
              ) : (
                'Automatic backups are disabled'
              )}
            </div>
          </div>
        </div>

        {restorePreview && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="font-medium mb-2">Restore Preview</h4>
            <div className="text-sm space-y-2">
              <div className="font-medium">Files:</div>
              {restorePreview.files.map((file, index) => (
                <div key={index} className="pl-4">
                  • {file.name}<br />
                  <span className="text-gray-500 text-xs">
                    Exported: {file.date}<br />
                    Version: {file.version}<br />
                    Size: {file.size}
                  </span>
                  {file.validation.warnings.length > 0 && (
                    <div className="text-yellow-600 text-xs mt-1">
                      Warnings:
                      <ul className="list-disc pl-4">
                        {file.validation.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
              {restorePreview.conflicts.total > 0 && (
                <div className="pt-2">
                  <div className="font-medium text-yellow-600">Conflicts Detected:</div>
                  <div className="pl-4">
                    {restorePreview.conflicts.details.map((conflict, index) => (
                      <div key={index}>
                        • {conflict.type}: {conflict.count} conflicts across {conflict.files.length} files
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-2">
                <div className="font-medium">Data to restore:</div>
                <div className="pl-4">
                  <div>Bookmarks: {restorePreview.bookmarks}</div>
                  <div>Categories: {restorePreview.categories}</div>
                  <div>Retool Pages: {restorePreview.retoolPages}</div>
                  <div>Notion Pages: {restorePreview.notionPages}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add restore history section */}
        {restoreHistory.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="font-medium mb-2">Restore History</h4>
            <div className="text-sm space-y-2">
              {restoreHistory.map((entry, index) => (
                <div key={index} className="pl-4">
                  • {new Date(entry.timestamp).toLocaleString()}<br />
                  <span className="text-gray-500 text-xs">
                    Files: {entry.files.join(', ')}<br />
                    Data Types: {entry.dataTypes.join(', ')}<br />
                    Status: <span className={entry.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                      {entry.status}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Backup Frequency Section */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Backup Frequency</label>
          <div className="flex gap-2 flex-wrap">
            {backupOptions.map(opt => (
              <button
                key={opt.value}
                className={`px-3 py-1 rounded border font-semibold transition-colors duration-150 ${backupFrequency === opt.value ? 'bg-green-600 text-white border-green-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-green-100 dark:hover:bg-green-900'}`}
                onClick={() => handleBackupFrequency(opt.value)}
                title={`Set backup frequency to ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Automatically backup bookmarks and categories to the backup folder at the selected interval.</p>
        </div>

        {onShowTour && (
          <button
            className="w-full px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium mb-2"
            onClick={onShowTour}
            title="Show onboarding tour"
          >
            Show Onboarding Tour
          </button>
        )}

        {showConflictModal && conflictOptions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-lg w-full">
              <h3 className="text-lg font-bold mb-4">Conflict Resolution Required</h3>
              <p className="mb-4">Found {conflictOptions.total} conflicts across {conflictOptions.details.length} data types.</p>
              <div className="space-y-4">
                <label className="flex items-center">
                  <input type="radio" name="resolution" value="newest" checked={conflictResolutionChoice === 'newest'} onChange={() => setConflictResolutionChoice('newest')} className="mr-2" />
                  Keep newest data (recommended)
                </label>
                <label className="flex items-center">
                  <input type="radio" name="resolution" value="oldest" checked={conflictResolutionChoice === 'oldest'} onChange={() => setConflictResolutionChoice('oldest')} className="mr-2" />
                  Keep oldest data
                </label>
                <label className="flex items-center">
                  <input type="radio" name="resolution" value="merge" checked={conflictResolutionChoice === 'merge'} onChange={() => setConflictResolutionChoice('merge')} className="mr-2" />
                  Merge data (may cause duplicates)
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => { if (resolveConflictPromise) resolveConflictPromise(null); }}>Cancel</button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={() => { if (resolveConflictPromise) resolveConflictPromise(conflictResolutionChoice); }}>Continue</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 
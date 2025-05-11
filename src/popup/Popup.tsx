import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BookmarkTable } from '@/components/BookmarkTable';
import { AddBookmark } from '@/components/AddBookmark';
import { CategoryManager } from '@/components/CategoryManager';
import { SettingsModal } from '@/components/SettingsModal';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useCategories } from '@/hooks/useCategories';
import { BellIcon } from '@heroicons/react/24/outline';
import { Toaster } from 'react-hot-toast';
import { BookmarkNode } from '@/types/bookmark';
import { BookmarkCategory } from '@/types/bookmark';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { BookmarkTree } from '@/components/BookmarkTree';
import { BookmarkService } from '@/services/bookmarkService';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 900); // Start fade before removal
    const remove = setTimeout(onClose, 1000); // Remove after 1000ms
    return () => {
      clearTimeout(timer);
      clearTimeout(remove);
    };
  }, [onClose]);

  return (
    <div
      className={`fixed left-1/2 bottom-6 transform -translate-x-1/2 px-6 py-3 rounded shadow-lg z-50 transition-all duration-200
        ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}
        ${visible ? 'opacity-100' : 'opacity-0'}`}
      role="alert"
      aria-live="polite"
      style={{ minWidth: 200, textAlign: 'center', pointerEvents: 'none' }}
    >
      {message}
    </div>
  );
};

const ITEMS_PER_PAGE = 5;

const DashboardView: React.FC<{ setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void }> = ({ setToast }) => {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [clickStats, setClickStats] = useState<[string, number, string][]>([]);
  const [recentPage, setRecentPage] = useState(1);
  const [clickedPage, setClickedPage] = useState(1);
  const { refresh: refreshCategories } = useCategories();
  const [categories, setCategories] = useState<BookmarkCategory[]>([]);

  useEffect(() => {
    chrome.storage.local.get(['bookmarks', 'retoolPages', 'notionPages', 'categories', 'bookmark_categories'], (data) => {
      setBookmarks(Array.isArray(data.bookmarks) ? data.bookmarks : []);
      // Try both keys for categories for compatibility
      setCategories(Array.isArray(data.bookmark_categories) ? data.bookmark_categories : (Array.isArray(data.categories) ? data.categories : []));
    });
  }, []);

  useEffect(() => {
    if (bookmarks.length === 0) return; // Don't process if bookmarks aren't loaded yet
    
    chrome.storage.local.get(['bookmarkClicks', 'bookmark_categories'], (res) => {
      const raw = res.bookmarkClicks || {};
      const categories = res.bookmark_categories || [];
      const sorted = Object.entries(raw)
        .map(([title, count]) => {
          // Find the bookmark to get its category
          const bookmark = bookmarks.find(bm => bm.title === title);
          const category = bookmark?.categoryId ? 
            categories.find((cat: { id: string; name: string }) => cat.id === bookmark.categoryId)?.name || 'Uncategorized' : 
            'Uncategorized';
          return [title, Number(count), category] as [string, number, string];
        })
        .sort((a, b) => b[1] - a[1]);
      setClickStats(sorted);
    });
  }, [bookmarks]); // Add bookmarks as a dependency

  // Pagination logic
  const userBookmarks = bookmarks.filter(bm => !('imported' in bm) || !bm.imported);
  const recentUserBookmarks = userBookmarks.slice(-20).reverse(); // Only consider the last 20
  const totalRecentPages = Math.ceil(recentUserBookmarks.length / ITEMS_PER_PAGE) || 1;
  const pagedRecent = recentUserBookmarks.slice((recentPage - 1) * ITEMS_PER_PAGE, recentPage * ITEMS_PER_PAGE);

  const totalClickedPages = Math.ceil(clickStats.length / ITEMS_PER_PAGE) || 1;
  const pagedClicked = clickStats.slice((clickedPage - 1) * ITEMS_PER_PAGE, clickedPage * ITEMS_PER_PAGE);

  const renderPagination = (page: number, setPage: (n: number) => void, totalPages: number) => (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      <button
        onClick={() => setPage(Math.max(1, page - 1))}
        className="px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
      >
        « Prev
      </button>
      {Array.from({ length: totalPages }, (_, i) => {
        const isActive = page === i + 1;
        return (
          <button
            key={i}
            onClick={() => setPage(i + 1)}
            className={`px-3 py-1 rounded border transition-all duration-200 ${
              isActive
                ? 'border-green-400 text-green-400 bg-gray-100 dark:bg-gray-700 font-semibold shadow-md scale-105'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 bg-gray-100 dark:text-white dark:bg-gray-800 hover:border-green-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {i + 1}
          </button>
        );
      })}
      <button
        onClick={() => setPage(Math.min(totalPages, page + 1))}
        className="px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
      >
        Next »
      </button>
      <span className="ml-2 text-sm text-gray-400 dark:text-gray-500">
        Page {page} of {totalPages}
      </span>
    </div>
  );

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">📊 Dashboard Overview</h2>
      <p>Total bookmarks: {bookmarks.length}</p>

      <h3 className="font-semibold mt-4">🕐 Recent Bookmarks</h3>
      <ul className="list-disc list-inside" role="list">
        {pagedRecent.map((bm, idx) => {
          const catObj = categories.find((cat) => cat.id === bm.categoryId);
          const catColor = catObj?.color || '#6366f1';
          const catName = catObj?.name || 'Uncategorized';
          return (
            <li key={idx} className="flex items-center gap-2 mb-1" role="listitem">
              <span style={{ background: catColor, color: '#fff', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, display: 'inline-block', minWidth: 0 }}>
                {catName}
              </span>
              <span className="mx-2">-</span>
              <span className="truncate" style={{ maxWidth: 220, display: 'inline-block', verticalAlign: 'middle' }}>{bm.title}</span>
            </li>
          );
        })}
      </ul>
      {totalRecentPages > 1 && renderPagination(recentPage, setRecentPage, totalRecentPages)}

      <h3 className="font-semibold mt-6">🔥 Most Clicked</h3>
      <ul className="list-disc list-inside" role="list">
        {pagedClicked.map(([title, count, category], idx) => {
          const catObj = categories.find((cat) => cat.name === category);
          const catColor = catObj?.color || '#6366f1';
          const catName = catObj?.name || category || 'Uncategorized';
          return (
            <li key={idx} className="flex items-center gap-2 mb-1" role="listitem">
              <span style={{ background: catColor, color: '#fff', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, display: 'inline-block', minWidth: 0 }}>
                {catName}
              </span>
              <span className="mx-2">-</span>
              <span className="truncate" style={{ maxWidth: 220, display: 'inline-block', verticalAlign: 'middle' }}>{title}</span>
              <span className="mx-2">-</span>
              <span className="text-gray-500 dark:text-gray-400">{count} click{count !== 1 ? 's' : ''}</span>
            </li>
          );
        })}
      </ul>
      {totalClickedPages > 1 && renderPagination(clickedPage, setClickedPage, totalClickedPages)}

      {/* New Analytics Component */}
      <div className="mt-6">
        <h3 className="font-semibold">📊 Analytics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <h4 className="text-sm font-medium mb-2">Most Clicked Bookmarks</h4>
            <Bar
              data={{
                labels: pagedClicked.map(([title]) => title),
                datasets: [
                  {
                    label: 'Clicks',
                    data: pagedClicked.map(([, count]) => count),
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  title: { display: false },
                },
              }}
            />
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Category Distribution</h4>
            <Pie
              data={{
                labels: categories.map((cat) => cat.name),
                datasets: [
                  {
                    data: categories.map((cat) => bookmarks.filter((bm) => bm.categoryId === cat.id).length),
                    backgroundColor: categories.map((cat) => cat.color),
                    borderWidth: 1,
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'right' },
                  title: { display: false },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 mb-8">
        <h3 className="font-semibold mt-6">⚙️ Quick Actions</h3>
        <div className="mt-2 flex gap-2">
          <button
            onClick={async () => {
              // Get all data from storage
              const data = await chrome.storage.local.get([
                'bookmarks',
                'bookmark_categories',
                'bookmarkClicks'
              ]);
              
              const exportData = {
                bookmarks: data.bookmarks || [],
                categories: data.bookmark_categories || [],
                bookmarkClicks: data.bookmarkClicks || {},
                exportDate: new Date().toISOString(),
                version: chrome.runtime.getManifest().version
              };
              
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'forethought-toolbox-backup.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="bg-gray-100 dark:bg-green-600 text-gray-700 dark:text-white px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-green-700 border border-gray-300 dark:border-green-700"
            title="Quick export all bookmarks, categories, and click stats"
          >
            📤 Quick Export
          </button>
          <label className="bg-gray-100 dark:bg-blue-600 text-gray-700 dark:text-white px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-blue-700 cursor-pointer border border-gray-300 dark:border-blue-700">
            📥 Quick Import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (e) => {
                  if (!e.target?.result) return;
                  try {
                    const backupData = JSON.parse(e.target.result as string);
                    
                    // Validate backup data structure
                    if (!backupData || typeof backupData !== 'object') {
                      throw new Error('Invalid backup file format');
                    }

                    // Store all updates in an object
                    const updates: { [key: string]: any } = {};

                    // Restore bookmarks if present
                    if (Array.isArray(backupData.bookmarks)) {
                      updates.bookmarks = backupData.bookmarks;
                    }

                    // Restore categories if present
                    if (Array.isArray(backupData.categories)) {
                      // First, clear existing categories
                      const existingCategories = await BookmarkService.getCategories();
                      for (const category of existingCategories) {
                        await BookmarkService.deleteCategory(category.id);
                      }
                      // Then add all categories from backup
                      for (const category of backupData.categories) {
                        await BookmarkService.addCategory({
                          name: category.name,
                          color: category.color,
                          icon: category.icon
                        });
                      }
                      // Store categories in local storage
                      updates.bookmark_categories = backupData.categories;
                    }

                    // Update all data at once
                    await chrome.storage.local.set(updates);

                    // Refresh categories to update the UI
                    await refreshCategories();

                    setToast({ message: 'Backup restored successfully!', type: 'success' });
                    // Force a reload to update all views
                    window.location.reload();
                  } catch (error) {
                    console.error('Restore error:', error);
                    setToast({ message: 'Failed to restore backup. Please check the file format.', type: 'error' });
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

const MAX_CUSTOM_PAGES = 10;
type DocMode = 'markup' | 'html';
interface CustomPage {
  name: string;
  mode: DocMode;
  content: string;
}

interface CustomDocPageProps {
  page: CustomPage;
  onEdit: (newPage: CustomPage) => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}

function CustomDocPage({ page, onEdit, onDelete, onRename, icon }: CustomDocPageProps & { icon: string }) {
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(page.name);
  const [editContent, setEditContent] = useState(page.content);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'text-blue-600 underline hover:text-blue-800',
        },
      }),
    ],
    content: editContent,
    editable: editMode,
    onUpdate: ({ editor }) => {
      setEditContent(editor.getHTML());
    },
  });

  useEffect(() => {
    setEditName(page.name);
    setEditContent(page.content);
    if (editor) editor.commands.setContent(page.content);
    // eslint-disable-next-line
  }, [page]);

  useEffect(() => {
    if (editor) editor.setEditable(editMode);
  }, [editMode, editor]);

  // Minimal toolbar for formatting
  const Toolbar = () => editor ? (
    <div className="flex gap-2 mb-2 bg-gray-100 dark:bg-gray-700 p-2 rounded">
      <button onClick={() => editor.chain().focus().undo().run()} className="px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition" aria-label="Undo" title="Undo (Cmd+Z)">↺</button>
      <button onClick={() => editor.chain().focus().redo().run()} className="px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition" aria-label="Redo" title="Redo (Cmd+Shift+Z)">↻</button>
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={`px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition ${editor.isActive('bold') ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`} aria-label="Bold" title="Bold (Cmd+B)">B</button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition ${editor.isActive('italic') ? 'italic text-blue-600 dark:text-blue-400' : ''}`} aria-label="Italic" title="Italic (Cmd+I)">I</button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition ${editor.isActive('strike') ? 'line-through text-blue-600 dark:text-blue-400' : ''}`} aria-label="Strikethrough" title="Strikethrough">S</button>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition ${editor.isActive('bulletList') ? 'text-blue-600 dark:text-blue-400' : ''}`} aria-label="Bullet List" title="Bullet List">• List</button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition ${editor.isActive('orderedList') ? 'text-blue-600 dark:text-blue-400' : ''}`} aria-label="Numbered List" title="Numbered List">1. List</button>
      <button onClick={() => editor.chain().focus().setParagraph().run()} className={`px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition ${editor.isActive('paragraph') ? 'text-blue-600 dark:text-blue-400' : ''}`} aria-label="Paragraph" title="Paragraph">P</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition ${editor.isActive('heading', { level: 1 }) ? 'text-blue-600 dark:text-blue-400' : ''}`} aria-label="Heading 1" title="Heading 1">H1</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition ${editor.isActive('heading', { level: 2 }) ? 'text-blue-600 dark:text-blue-400' : ''}`} aria-label="Heading 2" title="Heading 2">H2</button>
      <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition ${editor.isActive('codeBlock') ? 'text-blue-600 dark:text-blue-400' : ''}`} aria-label="Code Block" title="Code Block">{'</>'}</button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition ${editor.isActive('blockquote') ? 'text-blue-600 dark:text-blue-400' : ''}`} aria-label="Blockquote" title="Blockquote">""</button>
      <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className="px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition" aria-label="Horizontal Rule" title="Horizontal Rule">―</button>
      <button onClick={() => {
        const { state } = editor;
        const { from, to } = state.selection;
        if (from === to) {
          alert('Please select the text you want to turn into a link.');
          return;
        }
        const url = prompt('Enter URL');
        if (url) editor.chain().focus().setLink({ href: url }).run();
      }} className={`px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition ${editor.isActive('link') ? 'text-blue-600 dark:text-blue-400' : ''}`} aria-label="Link" title="Insert Link">🔗</button>
      <button onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className="px-2 py-1 rounded bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 transition" aria-label="Clear Formatting" title="Clear Formatting">Clear</button>
    </div>
  ) : null;

  if (!editMode) {
    return (
      <div className="flex flex-col h-full">
        <div className="mb-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">{icon} {page.name}</h2>
        </div>
        <div className="flex-1 overflow-auto p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700" style={{ minHeight: 120, maxHeight: 350 }}>
          <div dangerouslySetInnerHTML={{ __html: page.content }} />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => setEditMode(true)}>Edit</button>
          <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" onClick={onDelete}>Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <input
        className="mb-2 px-2 py-1 border rounded bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
        value={editName}
        onChange={e => setEditName(e.target.value)}
        placeholder="Page Name"
        maxLength={40}
      />
      <Toolbar />
      <div className="flex-1 mb-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700" style={{ minHeight: 200, maxHeight: 300, overflow: 'auto' }}>
        {editor && <EditorContent editor={editor} />}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400" onClick={() => setEditMode(false)}>Cancel</button>
        <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" onClick={() => {
          onEdit({ name: editName, mode: 'html', content: editContent });
          onRename(editName);
          setEditMode(false);
        }}>Save</button>
      </div>
    </div>
  );
}

export const Popup: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'bookmarks' | 'importExport' | 'custom-retool' | 'custom-notion'>('dashboard');
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const { bookmarks, updateBookmarkNode, deleteBookmarkNode, addBookmarkOrFolder, refresh: refreshBookmarks } = useBookmarks();
  const [showTour, setShowTour] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 'onboarding', text: 'View Onboarding Tour', unread: true },
  ]);
  const bellRef = useRef<HTMLDivElement>(null);
  const [lastDeleted, setLastDeleted] = useState<BookmarkNode | null>(null);
  const [undoExpire, setUndoExpire] = useState<number | null>(null);
  const [undoSeconds, setUndoSeconds] = useState(5);
  const [undoHovered, setUndoHovered] = useState(false);
  const undoPausedAt = useRef<number | null>(null);
  const [undoBatch, setUndoBatch] = useState<{ bookmarks: BookmarkNode[], expire: number } | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
  const [undoBatchSeconds, setUndoBatchSeconds] = useState(5);
  const UNDO_SECONDS = 5;
  const [retoolOpen, setRetoolOpen] = useState(false);
  const [notionOpen, setNotionOpen] = useState(false);
  const [activeRetoolPage, setActiveRetoolPage] = useState<number | null>(null);
  const [activeNotionPage, setActiveNotionPage] = useState<number | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card' | 'tree'>('table');
  const [retoolPages, setRetoolPages] = useState<CustomPage[]>([]);
  const [notionPages, setNotionPages] = useState<CustomPage[]>([]);

  // Load saved view and dropdown states on mount
  useEffect(() => {
    chrome.storage.local.get(['popup_activeView', 'popup_retoolOpen', 'popup_notionOpen', 'popup_activeRetoolPage', 'popup_activeNotionPage'], (data) => {
      // First set the dropdown states
      if (typeof data.popup_retoolOpen === 'boolean') {
        setRetoolOpen(data.popup_retoolOpen);
      }
      if (typeof data.popup_notionOpen === 'boolean') {
        setNotionOpen(data.popup_notionOpen);
      }
      if (typeof data.popup_activeRetoolPage === 'number') {
        setActiveRetoolPage(data.popup_activeRetoolPage);
      }
      if (typeof data.popup_activeNotionPage === 'number') {
        setActiveNotionPage(data.popup_activeNotionPage);
      }
      // Then set the view state
      if (data.popup_activeView) {
        // If it's a custom page view, ensure the corresponding dropdown is open
        if (data.popup_activeView === 'custom-retool' && typeof data.popup_retoolOpen === 'boolean') {
          setRetoolOpen(true);
        } else if (data.popup_activeView === 'custom-notion' && typeof data.popup_notionOpen === 'boolean') {
          setNotionOpen(true);
        }
        setView(data.popup_activeView);
      }
    });
  }, []);

  // Save view state when it changes
  useEffect(() => {
    chrome.storage.local.set({ popup_activeView: view });
  }, [view]);

  // Save dropdown states when they change
  useEffect(() => {
    chrome.storage.local.set({ 
      popup_retoolOpen: retoolOpen,
      popup_notionOpen: notionOpen,
      popup_activeRetoolPage: activeRetoolPage,
      popup_activeNotionPage: activeNotionPage
    });
  }, [retoolOpen, notionOpen, activeRetoolPage, activeNotionPage]);

  useEffect(() => {
    // Load theme from storage (use a separate key for popup)
    chrome.storage.local.get('popup_theme', (data) => {
      const savedTheme = data.popup_theme || 'dark';
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    });
  }, []);

  useEffect(() => {
    function handleError() {
      // No logs are set up to handle errors
    }
    function handleRejection() {
      // No logs are set up to handle rejections
    }
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Settings shortcut (s) - only on non-custom pages
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        if (view !== 'custom-retool' && view !== 'custom-notion') {
          setShowSettings(true);
          setToast({ message: 'Shortcut: Open Settings', type: 'success' });
        }
        return;
      }

      // Navigation shortcuts (1, 2, 3) work globally
      if (e.key === '1' && !e.metaKey && !e.ctrlKey) {
        setView('dashboard');
        setToast({ message: 'Shortcut: Go to Dashboard', type: 'success' });
        return;
      }
      if (e.key === '2' && !e.metaKey && !e.ctrlKey) {
        setView('bookmarks');
        setToast({ message: 'Shortcut: Go to Bookmarks', type: 'success' });
        return;
      }
      if (e.key === '3' && !e.metaKey && !e.ctrlKey) {
        setView('importExport');
        setToast({ message: 'Shortcut: Go to Import/Export', type: 'success' });
        return;
      }

      // Bookmarks-related shortcuts - only on Bookmarks page
      if (view === 'bookmarks') {
        if (['a', '/', 'd'].includes(e.key) && !e.metaKey && !e.ctrlKey) {
          if (e.key === 'a') {
            setShowAdd(true);
            setToast({ message: 'Shortcut: Add Bookmark', type: 'success' });
          } else if (e.key === '/') {
            const searchInput = document.querySelector('input[placeholder="Search bookmarks..."]') as HTMLInputElement;
            if (searchInput) searchInput.focus();
            setToast({ message: 'Shortcut: Focus Search', type: 'success' });
            e.preventDefault();
          } else if (e.key === 'd') {
            const findDuplicatesBtn = document.querySelector('button[aria-label="Find duplicate bookmarks"]') as HTMLButtonElement;
            if (findDuplicatesBtn) findDuplicatesBtn.click();
            setToast({ message: 'Shortcut: Find Duplicates', type: 'success' });
          }
        }
        // Pagination shortcuts (only on bookmarks page)
        if (e.key === 'ArrowLeft' && !e.metaKey && !e.ctrlKey) {
          const prevBtn = document.querySelector('button:contains("Previous")') as HTMLButtonElement;
          if (prevBtn && !prevBtn.disabled) {
            prevBtn.click();
            setToast({ message: 'Shortcut: Previous Page', type: 'success' });
          }
        }
        if (e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey) {
          const nextBtn = document.querySelector('button:contains("Next")') as HTMLButtonElement;
          if (nextBtn && !nextBtn.disabled) {
            nextBtn.click();
            setToast({ message: 'Shortcut: Next Page', type: 'success' });
          }
        }
      }
      // All other shortcuts are ignored on unrelated pages
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [view]);

  useEffect(() => {
    // Check if this is the first time the extension is installed
    chrome.storage.local.get(['seenOnboarding', 'extensionVersion'], (data) => {
      const currentVersion = chrome.runtime.getManifest().version;
      const shouldShowOnboarding = !data.seenOnboarding || 
                                 !data.extensionVersion || 
                                 data.extensionVersion !== currentVersion;

      if (shouldShowOnboarding) {
        setShowTour(true);
        setShowAnnouncement(true);
        // Save the current version and mark onboarding as seen
        chrome.storage.local.set({ 
          seenOnboarding: true,
          extensionVersion: currentVersion
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  // On mount, check for pending undo in storage
  useEffect(() => {
    chrome.storage.local.get(['lastDeletedBookmark', 'undoExpire'], (data) => {
      if (data.lastDeletedBookmark && data.undoExpire) {
        const now = Date.now();
        if (data.undoExpire > now) {
          setLastDeleted(data.lastDeletedBookmark);
          setUndoExpire(data.undoExpire);
          setUndoSeconds(Math.ceil((data.undoExpire - now) / 1000));
        } else {
          chrome.storage.local.remove(['lastDeletedBookmark', 'undoExpire']);
        }
      }
    });
  }, []);

  // Countdown logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (lastDeleted && !undoHovered && undoExpire) {
      interval = setInterval(() => {
        const now = Date.now();
        const secondsLeft = Math.ceil((undoExpire - now) / 1000);
        setUndoSeconds(secondsLeft);
        if (secondsLeft <= 0) {
          setLastDeleted(null);
          setUndoExpire(null);
          chrome.storage.local.remove(['lastDeletedBookmark', 'undoExpire']);
        }
      }, 200);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lastDeleted, undoHovered, undoExpire]);

  // Pause timer on hover, resume on leave
  const handleUndoMouseEnter = () => {
    setUndoHovered(true);
    if (undoExpire) {
      undoPausedAt.current = undoExpire - Date.now(); // ms left
    }
  };
  const handleUndoMouseLeave = () => {
    setUndoHovered(false);
    if (undoPausedAt.current && lastDeleted) {
      const newExpire = Date.now() + undoPausedAt.current;
      setUndoExpire(newExpire);
      chrome.storage.local.set({ undoExpire: newExpire });
      setUndoSeconds(Math.ceil(undoPausedAt.current / 1000));
      undoPausedAt.current = null;
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    chrome.storage.local.set({ popup_theme: newTheme });
  };

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 500);
  }, []);

  // When undo is clicked, clear everything
  const handleUndo = async () => {
    if (!lastDeleted) return;
    try {
      await updateBookmarkNode(lastDeleted.id, lastDeleted);
      setLastDeleted(null);
      setUndoExpire(null);
      chrome.storage.local.remove(['lastDeletedBookmark', 'undoExpire']);
      setTimeout(() => {
        showToast('Bookmark restored successfully ✅', 'success');
      }, 0);
    } catch (error) {
      setLastDeleted(null);
      setUndoExpire(null);
      chrome.storage.local.remove(['lastDeletedBookmark', 'undoExpire']);
      setTimeout(() => {
        showToast('Failed to restore bookmark ❌', 'error');
      }, 0);
    }
  };

  // Handle batch delete with undo
  const handleBatchDeleteWithUndo = async (bookmarks: BookmarkNode[]) => {
    clearToast();
    // Clear any existing single-delete undo state
    setLastDeleted(null);
    setUndoExpire(null);
    chrome.storage.local.remove(['lastDeletedBookmark', 'undoExpire']);
    
    // Set batch undo state
    const expire = Date.now() + UNDO_SECONDS * 1000;
    setUndoBatch({ bookmarks, expire });
    setUndoBatchSeconds(UNDO_SECONDS);
    if (undoTimeout) clearTimeout(undoTimeout);
    setUndoTimeout(setTimeout(() => {
      setUndoBatch(null);
    }, UNDO_SECONDS * 1000));
  };

  // Handle undo batch
  const handleUndoBatch = async () => {
    if (undoBatch) {
      for (const bm of undoBatch.bookmarks) {
        await updateBookmarkNode(bm.id, bm);
      }
      setUndoBatch(null);
      if (undoTimeout) clearTimeout(undoTimeout);
      setToast({ message: 'Bookmarks restored successfully ✅', type: 'success' });
    }
  };

  // Countdown for batch undo
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (undoBatch) {
      interval = setInterval(() => {
        const now = Date.now();
        const secondsLeft = Math.ceil((undoBatch.expire - now) / 1000);
        setUndoBatchSeconds(secondsLeft);
        if (secondsLeft <= 0) {
          setUndoBatch(null);
          if (undoTimeout) clearTimeout(undoTimeout);
        }
      }, 200);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [undoBatch, undoTimeout]);

  // Pass delete handler to BookmarkTable that persists undo info
  const handleDeleteWithUndo = async (id: string, silent = false) => {
    const bm = bookmarks.find(b => b.id === id);
    if (!bm) return;
    if (!silent && !window.confirm('Are you sure you want to delete this bookmark?')) {
      return;
    }
    // Clear any existing batch undo state
    setUndoBatch(null);
    if (undoTimeout) clearTimeout(undoTimeout);
    
    // Set single-delete undo state
    setLastDeleted(bm as any); // Accept BookmarkNode
    const expire = Date.now() + 5000;
    setUndoExpire(expire);
    setUndoSeconds(5);
    chrome.storage.local.set({ lastDeletedBookmark: bm, undoExpire: expire });
    await deleteBookmarkNode(id);
  };

  useEffect(() => {
    chrome.storage.local.get('bookmarkViewMode', (data) => {
      if (data.bookmarkViewMode === 'card' || data.bookmarkViewMode === 'table' || data.bookmarkViewMode === 'tree') {
        setViewMode(data.bookmarkViewMode);
      } else {
        setViewMode('table');
      }
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.set({ bookmarkViewMode: viewMode });
  }, [viewMode]);

  useEffect(() => {
    chrome.storage.local.get(['retoolPages', 'notionPages'], (data) => {
      if (Array.isArray(data.retoolPages)) setRetoolPages(data.retoolPages);
      if (Array.isArray(data.notionPages)) setNotionPages(data.notionPages);
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.set({ retoolPages });
  }, [retoolPages]);

  useEffect(() => {
    chrome.storage.local.set({ notionPages });
  }, [notionPages]);

  // Clear any existing toast
  const clearToast = () => setToast(null);

  return (
    <div className={`w-[800px] h-[600px] flex ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} font-sans`} style={{ overflow: 'hidden' }}>
      <Toaster position="bottom-center" />
      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onThemeChange={handleThemeChange}
        currentTheme={theme}
        onShowTour={() => setShowTour(true)}
      />
      <aside className={`w-48 border-r p-4 space-y-3 flex flex-col h-full ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <button
          onClick={() => setView('dashboard')}
          className={`block w-full text-left rounded px-3 py-2 font-medium transition focus:outline-none focus:ring-2 focus:ring-green-400 ${view === 'dashboard' ? (theme === 'dark' ? 'bg-gray-700 text-green-400' : 'bg-gray-100 text-green-700 border border-green-400') : (theme === 'dark' ? 'hover:bg-gray-700' : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200')}`}
          title="Go to Dashboard"
        >🏠 Dashboard</button>
        <button
          onClick={() => setView('bookmarks')}
          className={`block w-full text-left rounded px-3 py-2 font-medium transition focus:outline-none focus:ring-2 focus:ring-green-400 ${view === 'bookmarks' ? (theme === 'dark' ? 'bg-gray-700 text-green-400' : 'bg-gray-100 text-green-700 border border-green-400') : (theme === 'dark' ? 'hover:bg-gray-700' : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200')}`}
          title="Go to Bookmarks"
        >🔖 Bookmarks</button>
        {/* Retool Dropdown */}
        <div>
          <button onClick={() => setRetoolOpen(o => !o)} className="block w-full text-left rounded px-3 py-2 font-medium transition bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-between">
            <span>🛠️ Retool</span>
            <span>{retoolOpen ? '▲' : '▼'}</span>
          </button>
          {retoolOpen && (
            <div className="ml-2 mt-1 space-y-1">
              {retoolPages.map((page, idx) => (
                <button key={idx} className={`block w-full text-left px-2 py-1 rounded ${activeRetoolPage === idx ? 'bg-gray-200 dark:bg-blue-900' : ''}`} onClick={() => { setActiveRetoolPage(idx); setActiveNotionPage(null); setView('custom-retool'); }}>{page.name}</button>
              ))}
              {retoolPages.length < MAX_CUSTOM_PAGES && (
                <button className="block w-full text-left px-2 py-1 rounded bg-gray-100 dark:bg-green-800 text-gray-700 dark:text-green-300 mt-1" onClick={() => {
                  setRetoolPages(p => [...p, { name: `Custom Page ${p.length + 1}`, mode: 'markup', content: '' }]);
                  setActiveRetoolPage(retoolPages.length);
                  setActiveNotionPage(null);
                  setView('custom-retool');
                }}>+ Create Custom Page</button>
              )}
            </div>
          )}
        </div>
        {/* Notion Dropdown */}
        <div>
          <button onClick={() => setNotionOpen(o => !o)} className="block w-full text-left rounded px-3 py-2 font-medium transition bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-between">
            <span>📝 Notion</span>
            <span>{notionOpen ? '▲' : '▼'}</span>
          </button>
          {notionOpen && (
            <div className="ml-2 mt-1 space-y-1">
              {notionPages.map((page, idx) => (
                <button key={idx} className={`block w-full text-left px-2 py-1 rounded ${activeNotionPage === idx ? 'bg-gray-200 dark:bg-blue-900' : ''}`} onClick={() => { setActiveNotionPage(idx); setActiveRetoolPage(null); setView('custom-notion'); }}>{page.name}</button>
              ))}
              {notionPages.length < MAX_CUSTOM_PAGES && (
                <button className="block w-full text-left px-2 py-1 rounded bg-gray-100 dark:bg-green-800 text-gray-700 dark:text-green-300 mt-1" onClick={() => {
                  setNotionPages(p => [...p, { name: `Custom Page ${p.length + 1}`, mode: 'markup', content: '' }]);
                  setActiveNotionPage(notionPages.length);
                  setActiveRetoolPage(null);
                  setView('custom-notion');
                }}>+ Create Custom Page</button>
              )}
            </div>
          )}
        </div>
        <div className="flex-1" />
        <button
          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium"
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
          title="Open settings"
        >
          ⚙️ Settings
        </button>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto relative" style={{ maxHeight: '600px', paddingBottom: '3rem', marginLeft: '0.5rem' }}>
        {showAnnouncement && (
          <div className="absolute left-1/2 top-0 transform -translate-x-1/2 z-40 flex items-center justify-between bg-blue-50 text-blue-800 px-3 py-1 announcement-bar text-xs" style={{ 
            borderRadius: '0 0 8px 8px', 
            fontSize: '12px', 
            minHeight: '22px', 
            maxWidth: '400px', 
            width: '90%', 
            margin: 0, 
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            borderBottom: '1px solid rgba(59, 130, 246, 0.1)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            marginTop: '-1px'
          }}>
            <span className="flex-1 text-blue-700">Welcome! Need a quick tour?</span>
            <div className="flex items-center gap-1.5">
              <button
                className="px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs transition-colors duration-200"
                style={{ fontSize: '11px' }}
                onClick={() => { 
                  setShowTour(true); 
                  setShowAnnouncement(false); 
                  setNotifications(n => n.map(notif => notif.id === 'onboarding' ? { ...notif, unread: false } : notif)); 
                }}
              >
                Show Tour
              </button>
              <button
                className="text-blue-600 hover:text-blue-800 text-xs transition-colors duration-200"
                aria-label="Dismiss announcement"
                style={{ fontSize: '14px', lineHeight: '1', background: 'none', border: 'none', padding: '2px 4px' }}
                onClick={() => { 
                  setShowAnnouncement(false); 
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
        <header className="text-center mb-6 relative pt-6">
          <h1 className="text-2xl font-bold">Forethought Toolbox</h1>
          <div className="absolute top-2 right-0" ref={bellRef}>
            <button
              onClick={() => setShowNotifications(v => !v)}
              className="p-1.5 rounded-full border transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              title="Show notifications"
              aria-label="Notifications"
              style={{ zIndex: 60 }}
            >
              <BellIcon className="w-5 h-5 text-gray-600 dark:text-blue-500" />
              {notifications.some(n => n.unread) && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900" />
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 text-left overflow-hidden" style={{ zIndex: 70 }}>
                <div className="p-2.5 border-b border-gray-100 dark:border-gray-800 font-medium text-sm bg-gray-50 dark:bg-gray-800/50">Notifications</div>
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {notifications.map((notif) => (
                    <li key={notif.id} 
                      className={`p-2.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors duration-150 ${notif.unread ? 'font-medium' : ''}`}
                      onClick={() => {
                        if (notif.id === 'onboarding') setShowTour(true);
                        setNotifications(n => n.map(nf => nf.id === notif.id ? { ...nf, unread: false } : nf));
                        setShowNotifications(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{notif.text}</span>
                        {notif.unread && <span className="ml-2 inline-block w-1.5 h-1.5 bg-red-500 rounded-full" />}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </header>
        {showTour && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setShowTour(false)} aria-modal="true" role="dialog">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 min-w-[320px] max-w-[500px] w-full relative" onClick={e => e.stopPropagation()}>
              <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400" onClick={() => setShowTour(false)} aria-label="Close onboarding tour" title="Close onboarding tour">&times;</button>
              <h2 className="text-2xl font-bold mb-4 text-center">Welcome to Forethought Toolbox!</h2>
              <div className="max-h-96 overflow-y-auto pr-2">
                <ul className="list-disc pl-6 space-y-2 text-base text-gray-700 dark:text-gray-200">
                  <li>🔍 <b>Global Search</b> with <kbd>Cmd+K</kbd> or <kbd>Ctrl+K</kbd></li>
                  <li>📝 Add notes, tags, and categories to bookmarks</li>
                  <li>⚡ <b>Keyboard Navigation:</b>
                    <ul className="list-disc pl-6 mt-1 space-y-1 text-sm">
                      <li><kbd>1</kbd> Dashboard, <kbd>2</kbd> Bookmarks, <kbd>3</kbd> Import/Export</li>
                      <li><kbd>a</kbd> Add Bookmark, <kbd>/</kbd> Search, <kbd>d</kbd> Find Duplicates</li>
                      <li><kbd>←</kbd> Previous Page, <kbd>→</kbd> Next Page</li>
                      <li><kbd>s</kbd> Settings (works everywhere)</li>
                    </ul>
                  </li>
                  <li>🗂️ Organize with categories and tags (add, edit, delete, color, emoji)</li>
                  <li>🦄 Light/Dark mode and customizable columns (show/hide, drag-and-drop, tooltips)</li>
                  <li>🔍 Find and highlight duplicate bookmarks</li>
                  <li>🔎 Zoom in/out and drag columns in the bookmarks table</li>
                  <li>↩️ Undo accidental deletes (persistent across reloads for a few seconds)</li>
                  <li>👁️ Tooltips on all important buttons and controls</li>
                  <li>🗃️ Switch between Table, Card, and Tree view for bookmarks</li>
                  <li>📝 Create, edit, and manage custom Retool and Notion pages</li>
                </ul>
                <hr className="my-4 border-gray-300 dark:border-gray-700" />
                <ul className="list-disc pl-6 space-y-2 text-base text-gray-700 dark:text-gray-200">
                  <li>⭐ <b>Quick Export/Import:</b> Easily backup or restore your bookmarks using the Import/Export page.</li>
                  <li>🛡️ <b>Automatic & Manual Backup:</b> Automatic backups with real-time countdown, and manual backup/restore with preview, validation, and conflict resolution.</li>
                  <li>🕑 <b>Restore History:</b> See your restore history and cancel restores in progress.</li>
                  <li>⌨️ <b>Shortcuts Work Anywhere:</b> Use keyboard shortcuts on any page for fast navigation and actions.</li>
                  <li>🕑 <b>Recent & Most Clicked:</b> Dashboard shows your most recently added and most frequently used bookmarks.</li>
                  <li>🗑️ <b>Undo Deletion:</b> After deleting a bookmark, you have a few seconds to undo from any page.</li>
                  <li>🔔 <b>Notifications:</b> Click the bell icon for onboarding and future feature announcements.</li>
                  <li>🏷️ <b>Tag Suggestions:</b> When adding/editing a bookmark, start typing to see tag suggestions.</li>
                  <li>🖱️ <b>Right-Click Support:</b> Right-click a bookmark for quick actions (edit, delete, copy link).</li>
                  <li>🌙 <b>Theme Persistence:</b> Your light/dark mode preference is saved and restored automatically.</li>
                  <li>🧩 <b>Works with Chrome Sync:</b> Bookmarks are stored locally, but you can export/import to sync across devices.</li>
                  <li>🛠️ <b>Settings:</b> Customize your experience, including visible columns, backup frequency, and recent bookmark limits.</li>
                </ul>
              </div>
              <button className="mt-6 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 w-full text-base font-semibold" onClick={() => setShowTour(false)}>Got it!</button>
            </div>
          </div>
        )}
        {view === 'dashboard' && <DashboardView setToast={setToast} />}
        {view === 'bookmarks' && (
          <div className="flex h-full">
            <div className="w-full">
              {/* Add Bookmark Button and Modal for Table/Card Views */}
              {viewMode !== 'tree' && (
                <>
                  <button
                    className="mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    onClick={() => setShowAdd(true)}
                    title="Add a new bookmark"
                  >
                    + Add Bookmark
                  </button>
                  {showAdd && <AddBookmark onClose={() => setShowAdd(false)} parentId={selectedFolderId} onBookmarkAdded={refreshBookmarks} />}
                </>
              )}
              {/* View Mode Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  className={`px-3 py-1 rounded border font-semibold transition-colors duration-150 ${viewMode === 'table' ? 'bg-gray-100 dark:bg-green-600 text-gray-700 dark:text-white border-gray-300 dark:border-green-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-green-900'}`}
                  onClick={() => setViewMode('table')}
                  aria-pressed={viewMode === 'table'}
                  title="Table view"
                >
                  Table View
                </button>
                <button
                  className={`px-3 py-1 rounded border font-semibold transition-colors duration-150 ${viewMode === 'card' ? 'bg-gray-100 dark:bg-green-600 text-gray-700 dark:text-white border-gray-300 dark:border-green-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-green-900'}`}
                  onClick={() => setViewMode('card')}
                  aria-pressed={viewMode === 'card'}
                  title="Card view"
                >
                  Card View
                </button>
                <button
                  className={`px-3 py-1 rounded border font-semibold transition-colors duration-150 ${viewMode === 'tree' ? 'bg-gray-100 dark:bg-green-600 text-gray-700 dark:text-white border-gray-300 dark:border-green-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-green-900'}`}
                  onClick={() => setViewMode('tree')}
                  aria-pressed={viewMode === 'tree'}
                  title="Tree view"
                >
                  Tree View
                </button>
              </div>
              {/* Render based on viewMode */}
              {viewMode === 'tree' ? (
                <BookmarkTree
                  bookmarks={bookmarks}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={setSelectedFolderId}
                  onRenameFolder={async (id, newName) => {
                    await updateBookmarkNode(id, { title: newName });
                  }}
                  onDeleteFolder={async (id) => {
                    await deleteBookmarkNode(id);
                  }}
                  onMoveNode={async (nodeId, newParentId) => {
                    await updateBookmarkNode(nodeId, { parentId: newParentId });
                  }}
                />
              ) : (
                <>
                  <BookmarkTable
                    bookmarks={bookmarks.filter(b => b.parentId === selectedFolderId && b.type === 'bookmark')}
                    onUpdate={async (id, data) => { await updateBookmarkNode(id, data); }}
                    onDelete={handleDeleteWithUndo}
                    onDuplicate={async (bookmark) => {
                      const { id, createdAt, lastAccessed, accessCount, ...rest } = bookmark;
                      const newBookmark = {
                        ...rest,
                        title: bookmark.title + ' (Copy)',
                        type: 'bookmark' as const,
                      };
                      await addBookmarkOrFolder(newBookmark);
                      setToast({ message: 'Bookmark duplicated!', type: 'success' });
                    }}
                    viewMode={viewMode}
                    clearToast={() => setToast(null)}
                    onBatchDeleteWithUndo={handleBatchDeleteWithUndo}
                  />
                  <CategoryManager />
                </>
              )}
            </div>
          </div>
        )}
        {view === 'custom-retool' && activeRetoolPage !== null && (
          <div className="h-full max-h-[500px] overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <CustomDocPage
              page={retoolPages[activeRetoolPage]}
              icon="🛠️"
              onEdit={page => setRetoolPages(p => p.map((pg, i) => i === activeRetoolPage ? page : pg))}
              onDelete={() => {
                setRetoolPages(p => {
                  const newPages = p.filter((_, i) => i !== activeRetoolPage);
                  if (newPages.length > 0) {
                    setActiveRetoolPage(Math.max(0, Math.min(activeRetoolPage, newPages.length - 1)));
                  } else {
                    setActiveRetoolPage(null);
                    setRetoolOpen(false);
                    setView('dashboard');
                  }
                  return newPages;
                });
              }}
              onRename={name => setRetoolPages(p => p.map((pg, i) => i === activeRetoolPage ? { ...pg, name } : pg))}
            />
          </div>
        )}
        {view === 'custom-notion' && activeNotionPage !== null && (
          <div className="h-full max-h-[500px] overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <CustomDocPage
              page={notionPages[activeNotionPage]}
              icon="📝"
              onEdit={page => setNotionPages(p => p.map((pg, i) => i === activeNotionPage ? page : pg))}
              onDelete={() => {
                setNotionPages(p => {
                  const newPages = p.filter((_, i) => i !== activeNotionPage);
                  if (newPages.length > 0) {
                    setActiveNotionPage(Math.max(0, Math.min(activeNotionPage, newPages.length - 1)));
                  } else {
                    setActiveNotionPage(null);
                    setNotionOpen(false);
                    setView('dashboard');
                  }
                  return newPages;
                });
              }}
              onRename={name => setNotionPages(p => p.map((pg, i) => i === activeNotionPage ? { ...pg, name } : pg))}
            />
          </div>
        )}
        {toast && !lastDeleted && !undoBatch && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        {/* Single-delete Undo Toast */}
        {lastDeleted && !undoBatch && (
          <div
            className="fixed left-1/2 bottom-10 transform -translate-x-1/2 px-6 py-3 rounded shadow-lg z-50 bg-yellow-500 text-white flex items-center gap-4"
            onMouseEnter={handleUndoMouseEnter}
            onMouseLeave={handleUndoMouseLeave}
            style={{ cursor: 'pointer' }}
            aria-live="polite"
          >
            <span>Bookmark deleted.</span>
            <button
              className="px-3 py-1 bg-yellow-700 rounded hover:bg-yellow-800"
              onClick={handleUndo}
            >Undo</button>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.15)',
                fontWeight: 600,
                fontSize: 14,
                marginLeft: 4,
              }}
              title="Seconds left to undo"
            >
              {undoSeconds}
            </span>
          </div>
        )}
        {/* Batch Undo Toast */}
        {undoBatch && !lastDeleted && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded shadow-lg z-50 flex items-center gap-4">
            <span>{undoBatch.bookmarks.length} bookmark(s) deleted. </span>
            <button className="underline font-semibold" onClick={handleUndoBatch}>Undo</button>
            <span
              className="ml-2 text-sm inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-700"
              title="Seconds left to undo"
            >
              {undoBatchSeconds}
            </span>
          </div>
        )}
      </main>
    </div>
  );
}; 
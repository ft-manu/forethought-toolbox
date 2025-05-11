import React, { useState, useMemo } from 'react';
import { BookmarkNode } from '@/types/bookmark';

interface BookmarkTreeProps {
  bookmarks: BookmarkNode[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onRenameFolder: (id: string, newName: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onMoveNode: (nodeId: string, newParentId: string | null) => Promise<void>;
}

interface FolderTreeNode extends BookmarkNode {
  children: FolderTreeNode[];
  bookmarks: BookmarkNode[];
}

// Helper to build a tree from flat list
function buildTree(nodes: BookmarkNode[], parentId: string | null): FolderTreeNode[] {
  return nodes
    .filter(n => n.parentId === parentId && n.type === 'folder')
    .map(folder => ({
      ...folder,
      children: buildTree(nodes, folder.id),
      bookmarks: nodes.filter(n => n.parentId === folder.id && n.type === 'bookmark'),
    }));
}

export const BookmarkTree: React.FC<BookmarkTreeProps> = ({
  bookmarks,
  selectedFolderId,
  onSelectFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveNode
}) => {
  const tree = useMemo(() => buildTree(bookmarks, null), [bookmarks]);
  const [expanded, setExpanded] = useState<{ [id: string]: boolean }>({});
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const toggle = (id: string) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const handleRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditValue(currentTitle);
  };

  const handleRenameSubmit = async (id: string) => {
    if (editValue.trim() && editValue !== bookmarks.find(b => b.id === id)?.title) {
      await onRenameFolder(id, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this folder and all its contents?')) {
      await onDeleteFolder(id);
    }
  };

  const handleDragOver = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault();
    setDragOverId(targetId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault();
    const nodeId = draggedId;
    if (nodeId && nodeId !== targetId) {
      onMoveNode(nodeId, targetId);
    }
    setDragOverId(null);
    setDraggedId(null);
  };

  const renderTree = (folders: FolderTreeNode[]): React.ReactNode => (
    <ul className="pl-2">
      {folders.map(folder => (
        <li key={folder.id}
          onDragOver={e => handleDragOver(e, folder.id)}
          onDrop={e => handleDrop(e, folder.id)}
          style={{ background: dragOverId === folder.id ? '#e0f2fe' : undefined }}
        >
          <div className={`flex items-center gap-1 cursor-pointer ${selectedFolderId === folder.id ? 'font-bold text-green-600' : ''}`}
            onClick={() => onSelectFolder(folder.id)}>
            <span onClick={e => { e.stopPropagation(); toggle(folder.id); }} style={{ cursor: 'pointer' }}>
              {expanded[folder.id] ? '▼' : '▶'}
            </span>
            <span role="img" aria-label="folder">📁</span>
            {editingId === folder.id ? (
              <input
                className="px-1 py-0.5 rounded border text-sm"
                value={editValue}
                autoFocus
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => handleRenameSubmit(folder.id)}
                onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(folder.id); }}
                style={{ width: 80 }}
              />
            ) : (
              <span>{folder.title}</span>
            )}
            <button
              className="ml-1 text-xs text-blue-500 hover:text-blue-700"
              title="Rename folder"
              onClick={e => { e.stopPropagation(); handleRename(folder.id, folder.title); }}
            >✏️</button>
            <button
              className="ml-1 text-xs text-red-500 hover:text-red-700"
              title="Delete folder"
              onClick={e => { e.stopPropagation(); handleDelete(folder.id); }}
            >🗑️</button>
          </div>
          {expanded[folder.id] && (
            <>
              {folder.bookmarks.length > 0 && (
                <ul className="pl-6">
                  {folder.bookmarks.map((bm: BookmarkNode) => (
                    <li key={bm.id}
                      onDragOver={e => handleDragOver(e, folder.id)}
                      onDrop={e => handleDrop(e, folder.id)}
                      style={{ background: dragOverId === folder.id ? '#e0f2fe' : undefined }}
                      className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <span role="img" aria-label="bookmark">🔖</span>
                      {bm.title}
                    </li>
                  ))}
                </ul>
              )}
              {folder.children.length > 0 && renderTree(folder.children)}
            </>
          )}
        </li>
      ))}
    </ul>
  );

  // Root bookmarks (not in any folder)
  const rootBookmarks = bookmarks.filter(b => b.parentId === null && b.type === 'bookmark');

  return (
    <div>
      <div
        className={`flex items-center gap-1 cursor-pointer ${selectedFolderId === null ? 'font-bold text-green-600' : ''}`}
        onClick={() => onSelectFolder(null)}
        onDragOver={e => handleDragOver(e, null)}
        onDrop={e => handleDrop(e, null)}
        style={{ background: dragOverId === null ? '#e0f2fe' : undefined }}
      >
        <span role="img" aria-label="root">🏠</span> Root
      </div>
      {rootBookmarks.length > 0 && (
        <ul className="pl-6">
          {rootBookmarks.map(bm => (
            <li key={bm.id}
              style={{ background: dragOverId === bm.id ? '#e0f2fe' : undefined }}
              className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300"
            >
              <span role="img" aria-label="bookmark">🔖</span>
              {bm.title}
            </li>
          ))}
        </ul>
      )}
      {renderTree(tree)}
    </div>
  );
}; 
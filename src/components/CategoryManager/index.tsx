import React, { useState, useEffect } from 'react';
import { BookmarkCategory } from '@/types/bookmark';
import { BookmarkService } from '@/services/bookmarkService';
import { EditCategoryModal } from './EditCategoryModal';
import { StorageService } from '@/services/storageService';

const defaultIcons = ['📁', '🔖', '⭐', '📚', '🗂️', '📝', '💡', '🔗', '🔥', '💻', '🌐', '📅', '📊', '🛠️', '🎨', '🧩', '🧠', '🦄', '🚀', '🎵', '📷', '🧑‍💻', '🧑‍🏫', '🧑‍🔬', '🧑‍🎨', '🧑‍🚀', '🧑‍🍳', '🧑‍🌾', '🧑‍🎤', '🧑‍🎓', '🧑‍⚖️', '🧑‍✈️', '🧑‍🚒', '🧑‍🔧', '🧑‍🏭', '🧑‍💼', '🧑‍🔬', '🧑‍🎨', '🧑‍🚀', '🧑‍🍳', '🧑‍🌾', '🧑‍🎤', '🧑‍🎓', '🧑‍⚖️', '🧑‍✈️', '🧑‍🚒', '🧑‍🔧', '🧑‍🏭', '🧑‍💼'];

interface CategoryManagerProps {
  onCategoryChange?: () => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ onCategoryChange }) => {
  const [categories, setCategories] = useState<BookmarkCategory[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1'); // default indigo-500
  const [icon, setIcon] = useState(defaultIcons[0]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<BookmarkCategory | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    BookmarkService.getCategories().then(setCategories);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await BookmarkService.addCategory({ name: name.trim(), color, icon });
    setName('');
    setColor('#6366f1');
    setIcon(defaultIcons[0]);
    BookmarkService.getCategories().then(setCategories);
    if (onCategoryChange) onCategoryChange();
    setLoading(false);
  };

  const handleDelete = async (catId: string) => {
    const categoriesList = await BookmarkService.getCategories();
    const updatedCategories = categoriesList.filter(cat => cat.id !== catId);
    await StorageService.set('bookmark_categories', updatedCategories);
    BookmarkService.getCategories().then(setCategories);
    if (onCategoryChange) onCategoryChange();
  };

  const openEditModal = (cat: BookmarkCategory) => {
    setModalCategory(cat);
    setModalOpen(true);
  };

  const closeEditModal = () => {
    setModalOpen(false);
    setModalCategory(null);
  };

  const handleModalSave = async (updated: { name: string; color: string; icon: string }) => {
    if (modalCategory) {
      // Update logic: get all categories, update the one with modalCategory.id
      const categoriesList = await BookmarkService.getCategories();
      const updatedCategories = categoriesList.map(cat =>
        cat.id === modalCategory.id ? { ...cat, ...updated } : cat
      );
      await StorageService.set('bookmark_categories', updatedCategories);
      closeEditModal();
      BookmarkService.getCategories().then(setCategories);
      if (onCategoryChange) onCategoryChange();
    }
  };

  return (
    <div className="mt-8">
      <h3 className="font-semibold mb-2">Manage Categories</h3>
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="Category name"
          value={name}
          onChange={e => setName(e.target.value)}
          className={`px-2 py-1 border rounded transition focus:outline-none focus:ring-2 focus:ring-green-400 ${
            document.documentElement.classList.contains('dark')
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-green-400'
          }`}
        />
        <div className="flex items-center gap-1">
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="w-8 h-8 border rounded"
            title="Pick color"
          />
          <input
            type="text"
            value={color}
            onChange={e => setColor(e.target.value)}
            className={`w-20 px-2 py-1 border rounded transition focus:outline-none focus:ring-2 focus:ring-green-400 ${
              document.documentElement.classList.contains('dark')
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-green-400'
            }`}
            placeholder="#hex"
            maxLength={7}
          />
        </div>
        <div className="grid grid-cols-8 gap-1">
          {defaultIcons.map(i => (
            <button
              key={i}
              type="button"
              className={`text-2xl p-1 rounded transition ${icon === i ? 'ring-2 ring-green-500' : ''} ${document.documentElement.classList.contains('dark') ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              onClick={() => setIcon(i)}
              aria-label={i}
              title={`Select icon ${i}`}
            >
              {i}
            </button>
          ))}
        </div>
        <button type="submit" className="px-3 py-1 rounded transition text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400" title="Add category" disabled={loading}>
          {loading ? 'Adding...' : 'Add'}
        </button>
      </form>
      <ul className="space-y-2">
        {categories.map(cat => (
          <li key={cat.id} className="flex items-center gap-2">
            <span className="inline-block w-6 h-6 rounded-full flex items-center justify-center" style={{ background: cat.color }}>{cat.icon}</span>
            <span className="ml-2">{cat.name}</span>
            <button className="px-2 py-1 bg-blue-500 text-white rounded" onClick={() => openEditModal(cat)} title="Edit category">Edit</button>
            <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={() => handleDelete(cat.id)} title="Delete category">Delete</button>
          </li>
        ))}
      </ul>
      {modalOpen && (
        <EditCategoryModal
          open={modalOpen}
          onClose={closeEditModal}
          category={modalCategory}
          onSave={handleModalSave}
          defaultIcons={defaultIcons}
        />
      )}
    </div>
  );
}; 
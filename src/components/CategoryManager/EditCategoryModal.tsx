import React, { useState, useEffect } from 'react';
import { BookmarkCategory } from '@/types/bookmark';

interface EditCategoryModalProps {
  open: boolean;
  onClose: () => void;
  category: BookmarkCategory | null;
  onSave: (updated: { name: string; color: string; icon: string }) => void;
  defaultIcons: string[];
}

export const EditCategoryModal: React.FC<EditCategoryModalProps> = ({ open, onClose, category, onSave, defaultIcons }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState(defaultIcons[0]);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setColor(category.color);
      setIcon(category.icon);
    }
  }, [category, defaultIcons]);

  if (!open || !category) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 min-w-[320px] max-w-[90vw] relative" onClick={e => e.stopPropagation()}>
        <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" onClick={onClose} title="Close">&times;</button>
        <h2 className="text-lg font-bold mb-4">Edit Category</h2>
        <form onSubmit={e => { e.preventDefault(); onSave({ name, color, icon }); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input type="text" className={`w-full px-3 py-2 border rounded transition focus:outline-none focus:ring-2 focus:ring-green-400 ${document.documentElement.classList.contains('dark') ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-green-400'}`} value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 border rounded" title="Pick color" />
              <input type="text" value={color} onChange={e => setColor(e.target.value)} className={`w-20 px-2 py-1 border rounded transition focus:outline-none focus:ring-2 focus:ring-green-400 ${document.documentElement.classList.contains('dark') ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-green-400'}`} placeholder="#hex" maxLength={7} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Emoji</label>
            <div className="grid grid-cols-8 gap-1">
              {defaultIcons.map(i => (
                <button
                  key={i}
                  type="button"
                  className={`text-2xl p-1 rounded transition ${icon === i ? 'ring-2 ring-green-500' : ''} ${document.documentElement.classList.contains('dark') ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                  onClick={() => setIcon(i)}
                  aria-label={i}
                  title={`Select icon ${i}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500" onClick={onClose} title="Cancel editing">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" title="Save changes">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}; 
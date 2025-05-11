import React, { useState } from "react";

export default function BookmarkList({
  bookmarks,
  deleteBookmark,
  updateBookmark,
}) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const startEditing = (index, bookmark) => {
    setEditingIndex(index);
    setEditTitle(bookmark.title);
    setEditUrl(bookmark.url);
  };

  const saveEdit = (index) => {
    updateBookmark(index, { title: editTitle, url: editUrl });
    setEditingIndex(null);
  };

  return (
    <ul className="flex flex-col gap-2">
      {bookmarks.map((bm, idx) => (
        <li
          key={idx}
          className="flex justify-between items-center p-2 border rounded dark:border-gray-600"
        >
          {editingIndex === idx ? (
            <div className="flex-1 flex flex-col mr-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="p-1 mb-1 border rounded dark:bg-gray-800"
              />
              <input
                type="url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                className="p-1 border rounded dark:bg-gray-800"
              />
            </div>
          ) : (
            <a
              href={bm.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-blue-500 hover:underline"
            >
              {bm.title}
            </a>
          )}

          {editingIndex === idx ? (
            <button
              onClick={() => saveEdit(idx)}
              className="ml-2 bg-green-500 hover:bg-green-600 text-white p-1 rounded"
            >
              Save
            </button>
          ) : (
            <div className="flex gap-2 ml-2">
              <button
                onClick={() => startEditing(idx, bm)}
                className="text-yellow-500 hover:text-yellow-600"
              >
                Edit
              </button>
              <button
                onClick={() => deleteBookmark(idx)}
                className="text-red-500 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

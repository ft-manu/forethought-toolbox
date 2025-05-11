import React, { useState } from "react";

export default function BookmarkForm({ addBookmark }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !url) return;
    addBookmark({ title, url });
    setTitle("");
    setUrl("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4 mb-6">
      {/* Title Field */}
      <div className="flex flex-col">
        <label className="text-sm text-gray-400 mb-1">📌 Title</label>
        <input
          type="text"
          placeholder="Bookmark Title"
          className="px-3 py-2 rounded bg-gray-800 border border-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* URL Field */}
      <div className="flex flex-col">
        <label className="text-sm text-gray-400 mb-1">🔗 URL</label>
        <input
          type="url"
          placeholder="https://example.com"
          className="px-3 py-2 rounded bg-gray-800 border border-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="py-2 px-4 rounded text-white bg-purple-600 hover:bg-purple-700 transition"
      >
        ➕ Add Bookmark
      </button>
    </form>
  );
}

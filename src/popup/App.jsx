import React, { useState, useEffect } from "react";
import BookmarkForm from "./BookmarkForm";

export default function App() {
  const [bookmarks, setBookmarks] = useState([]);

  useEffect(() => {
    chrome.storage.local.get("bookmarks", (data) => {
      setBookmarks(data.bookmarks || []);
    });
  }, []);

  const addBookmark = (bookmark) => {
    const updated = [...bookmarks, bookmark];
    setBookmarks(updated);
    chrome.storage.local.set({ bookmarks: updated });
  };

  const deleteBookmark = (index) => {
    const updated = bookmarks.filter((_, idx) => idx !== index);
    setBookmarks(updated);
    chrome.storage.local.set({ bookmarks: updated });
  };

  const updateBookmark = (index, newBookmark) => {
    const updated = bookmarks.map((bm, idx) =>
      idx === index ? newBookmark : bm,
    );
    setBookmarks(updated);
    chrome.storage.local.set({ bookmarks: updated });
  };

  return (
    <div className="p-4 min-w-[320px] dark:bg-gray-900 dark:text-white space-y-6">
      <h1 className="text-xl font-bold mb-4">Bookmarks</h1>
      <BookmarkForm addBookmark={addBookmark} />
      <BookmarksTable
        bookmarks={bookmarks}
        deleteBookmark={deleteBookmark}
        updateBookmark={updateBookmark}
      />
    </div>
  );
}

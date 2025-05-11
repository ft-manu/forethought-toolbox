import React, { useState, useEffect } from "react";
import BookmarkForm from "./popup/BookmarkForm";
import BookmarksTable from "./popup/BookmarksTable";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { EmptyState } from "./components/EmptyState";
// import BookmarkList from "./popup/BookmarkList";

export default function App() {
  const [bookmarks, setBookmarks] = useState([]);
  const [view, setView] = useState("dashboard");
  const [clickStats, setClickStats] = useState([]);
  const [recentPage, setRecentPage] = useState(1);
  const [clickedPage, setClickedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const data = await chrome.storage.local.get(["bookmarks", "bookmarkClicks"]);
        setBookmarks(data.bookmarks || []);
        const raw = data.bookmarkClicks || {};
        const sorted = Object.entries(raw).sort((a, b) => b[1] - a[1]);
        setClickStats(sorted);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
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

  const exportBookmarks = () => {
    const blob = new Blob([JSON.stringify(bookmarks, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bookmarks.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const [toast, setToast] = useState({ message: "", type: "" });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 3000);
  };

  const importBookmarks = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          setBookmarks(imported);
          chrome.storage.local.set({ bookmarks: imported });
          showToast("Bookmarks imported successfully ✅", "success");
        } else {
          showToast("Invalid format. Expected an array of bookmarks.", "error");
        }
      } catch (err) {
        showToast("Failed to parse JSON: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  };

  const renderView = () => {
    if (isLoading) {
      return <LoadingSpinner size="lg" className="mt-8" />;
    }

    if (view === "dashboard") {
      const recentBookmarks = bookmarks.slice(-50).reverse();
      const totalRecentPages = Math.ceil(
        recentBookmarks.length / ITEMS_PER_PAGE,
      );
      const pagedRecent = recentBookmarks.slice(
        (recentPage - 1) * ITEMS_PER_PAGE,
        recentPage * ITEMS_PER_PAGE,
      );

      const totalClickedPages = Math.ceil(clickStats.length / ITEMS_PER_PAGE);
      const pagedClicked = clickStats.slice(
        (clickedPage - 1) * ITEMS_PER_PAGE,
        clickedPage * ITEMS_PER_PAGE,
      );

      if (bookmarks.length === 0) {
        return (
          <EmptyState
            icon="📚"
            title="No Bookmarks Yet"
            description="Start adding bookmarks to see them here. You can add bookmarks using the form below."
            action={{
              label: "Add First Bookmark",
              onClick: () => setView("bookmarks")
            }}
          />
        );
      }

      const renderPagination = (page, setPage, totalPages) => (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600"
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
                    ? "border-green-400 text-green-400 bg-gray-800 font-semibold shadow-md scale-105"
                    : "border-gray-700 text-white hover:border-green-400"
                }`}
              >
                {i + 1}
              </button>
            );
          })}

          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600"
          >
            Next »
          </button>

          <span className="ml-2 text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
        </div>
      );

      return (
        <div>
          <h2 className="text-lg font-semibold mb-2">📊 Dashboard Overview</h2>
          <p>Total bookmarks: {bookmarks.length}</p>

          <h3 className="font-semibold mt-4">🕐 Recent Bookmarks</h3>
          <ul className="list-disc list-inside">
            {pagedRecent.map((bm, idx) => (
              <li key={idx}>{bm.title}</li>
            ))}
          </ul>
          {totalRecentPages > 1 &&
            renderPagination(recentPage, setRecentPage, totalRecentPages)}

          <h3 className="font-semibold mt-6">🔥 Most Clicked</h3>
          <ul className="list-disc list-inside">
            {pagedClicked.map(([title, count], idx) => (
              <li key={idx}>
                {title} — {count} click{count !== 1 ? "s" : ""}
              </li>
            ))}
          </ul>
          {totalClickedPages > 1 &&
            renderPagination(clickedPage, setClickedPage, totalClickedPages)}

          <div className="mt-6 mb-8">
            <h3 className="font-semibold mt-6">⚙️ Quick Actions</h3>
            <div className="mt-2">
              <button
                onClick={exportBookmarks}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                📤 Quick Export
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (view === "bookmarks") {
      return (
        <div>
          <BookmarkForm addBookmark={addBookmark} />
          {/*<BookmarkList
            bookmarks={bookmarks}
            deleteBookmark={deleteBookmark}
            updateBookmark={updateBookmark}
          />*/}
          {bookmarks.length === 0 ? (
            <EmptyState
              icon="🔖"
              title="No Bookmarks"
              description="Add your first bookmark using the form above."
            />
          ) : (
            <BookmarksTable
              bookmarks={bookmarks}
              deleteBookmark={deleteBookmark}
              updateBookmark={updateBookmark}
            />
          )}
        </div>
      );
    }

    if (view === "importExport") {
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold mb-2">
            📁 Import/Export Bookmarks
          </h2>

          <div className="flex gap-3">
            {/* Export Button */}
            <button
              onClick={exportBookmarks}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
            >
              📤 Export Bookmarks as JSON
            </button>

            {/* Import Button Styled Identically */}
            <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium relative overflow-hidden">
              📥 Import Bookmarks from JSON
              <input
                type="file"
                accept="application/json"
                onChange={importBookmarks}
                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
              />
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <nav className="bg-gray-100 dark:bg-gray-800 p-4">
          <div className="flex gap-4">
            <button
              onClick={() => setView("dashboard")}
              className={`px-4 py-2 rounded ${
                view === "dashboard"
                  ? "bg-green-600 text-white"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
              aria-current={view === "dashboard" ? "page" : undefined}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView("bookmarks")}
              className={`px-4 py-2 rounded ${
                view === "bookmarks"
                  ? "bg-green-600 text-white"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
              aria-current={view === "bookmarks" ? "page" : undefined}
            >
              Bookmarks
            </button>
          </div>
        </nav>
        <main className="container mx-auto p-4">
          {renderView()}
        </main>
      </div>
    </ErrorBoundary>
  );
}

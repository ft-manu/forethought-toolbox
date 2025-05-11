import React, { useState, useEffect } from "react";

export default function BookmarksTable({
  bookmarks,
  deleteBookmark,
  updateBookmark,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("title");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  const filtered = bookmarks.filter(
    (bm) =>
      (bm.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      bm.url.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const sorted = [...filtered].sort((a, b) => {
    const valA = a[sortKey]?.toLowerCase() || "";
    const valB = b[sortKey]?.toLowerCase() || "";
    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / rowsPerPage);
  const paginated = sorted.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const handleEdit = (index) => {
    const updatedTitle = prompt("New title:", bookmarks[index].title);
    const updatedUrl = prompt("New URL:", bookmarks[index].url);
    if (updatedTitle && updatedUrl) {
      updateBookmark(index, { title: updatedTitle, url: updatedUrl });
    }
  };

  return (
    <div className="mt-6">
      <input
        type="text"
        placeholder="🔍 Search bookmarks..."
        className="w-full px-3 py-2 mb-6 border rounded dark:bg-gray-800"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setCurrentPage(1);
        }}
      />
      <table className="min-w-full text-sm text-left border table-fixed">
        <thead>
          <tr className="bg-gray-200 dark:bg-gray-700 dark:text-white">
            <th
              className="cursor-pointer px-3 py-2"
              onClick={() => handleSort("title")}
            >
              Title {sortKey === "title" && (sortOrder === "asc" ? "▲" : "▼")}
            </th>
            <th
              className="cursor-pointer px-3 py-2"
              onClick={() => handleSort("url")}
            >
              URL {sortKey === "url" && (sortOrder === "asc" ? "▲" : "▼")}
            </th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((bm, idx) => (
            <tr
              key={idx}
              className="border-t hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <td className="px-3 py-2">{bm.title}</td>
              <td className="px-3 py-2 max-w-xs break-words text-blue-600 dark:text-blue-400">
                <a
                  href={bm.url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-words"
                >
                  {bm.url}
                </a>
              </td>
              <td className="px-3 py-2 space-x-2">
                <button
                  className="text-sm px-2 py-1 bg-blue-500 text-white rounded"
                  onClick={() => handleEdit(bookmarks.indexOf(bm))}
                >
                  Edit
                </button>
                <button
                  className="text-sm px-2 py-1 bg-red-500 text-white rounded"
                  onClick={() => deleteBookmark(bookmarks.indexOf(bm))}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="mt-4 flex justify-center items-center space-x-2">
        <button
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Prev
        </button>
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i + 1)}
            className={`px-3 py-1 border rounded ${
              currentPage === i + 1
                ? "border-blue-500 bg-blue-100 dark:bg-blue-900 font-semibold"
                : "hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
          Page {currentPage} of {totalPages}
        </span>
      </div>

      <div className="space-y-4 mt-8">
        <h2 className="text-lg font-semibold mb-2">
          📁 Import/Export Bookmarks
        </h2>

        <div className="flex gap-3">
          {/* Export Button */}
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(bookmarks, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "bookmarks.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
          >
            📤 Export Bookmarks as JSON
          </button>

          {/* Import Button - now also a <button> for styling consistency */}
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium relative overflow-hidden">
            📥 Import Bookmarks from JSON
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const imported = JSON.parse(event.target.result);
                    if (Array.isArray(imported)) {
                      chrome.storage.local.set({ bookmarks: imported });
                      window.location.reload(); // Refresh after import
                    } else {
                      alert("Invalid format. Expected an array of bookmarks.");
                    }
                  } catch (err) {
                    alert("Failed to parse JSON: " + err.message);
                  }
                };
                reader.readAsText(file);
              }}
              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
            />
          </button>
        </div>
      </div>
    </div>
  );
}

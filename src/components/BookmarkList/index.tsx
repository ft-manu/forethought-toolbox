import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BookmarkNode } from '@/types/bookmark';
import { useBookmarks } from '@/hooks/useBookmarks';

interface BookmarkListProps {
  bookmarks: BookmarkNode[];
  onBookmarkClick?: (bookmark: BookmarkNode) => void;
  height?: number;
  itemHeight?: number;
}

export const BookmarkList: React.FC<BookmarkListProps> = ({
  bookmarks,
  onBookmarkClick,
  height = 400,
  itemHeight = 40
}) => {
  const { loading, error } = useBookmarks();
  const safeBookmarks = Array.isArray(bookmarks) ? bookmarks : [];
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: safeBookmarks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        {error}
      </div>
    );
  }

  if (!safeBookmarks.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No bookmarks found.
      </div>
    );
  }

  const handleBookmarkClick = (bookmark: BookmarkNode) => {
    if (bookmark.url) {
      onBookmarkClick?.(bookmark);
    }
  };

  return (
    <div ref={parentRef} style={{ height, overflow: 'auto' }}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const bookmark = safeBookmarks[virtualRow.index];
          return (
            <div
              key={bookmark.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${itemHeight}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="flex items-center px-4 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleBookmarkClick(bookmark)}
            >
              <img
                src={`https://www.google.com/s2/favicons?domain=${bookmark.url}`}
                alt=""
                className="w-4 h-4 mr-2"
              />
              <span className="truncate">{bookmark.title}</span>
              {bookmark.tags && bookmark.tags.length > 0 && (
                <div className="ml-2 flex gap-1">
                  {bookmark.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-gray-200 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}; 
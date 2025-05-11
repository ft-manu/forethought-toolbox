import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookmarkList } from '../index';
import { vi } from 'vitest';
import { BookmarkNode } from '@/types/bookmark';

const mockBookmarks: BookmarkNode[] = [
  {
    id: '1',
    type: 'bookmark',
    title: 'Test Bookmark',
    url: 'https://test.com',
    parentId: null,
    createdAt: new Date().toISOString(),
  }
];

describe('BookmarkList', () => {
  beforeEach(() => {
    vi.mock('@/hooks/useBookmarks', () => ({
      useBookmarks: () => ({
        loading: false,
        error: null
      })
    }));
  });

  it('renders without crashing', () => {
    render(<BookmarkList bookmarks={mockBookmarks} />);
  });

  it('shows loading state', () => {
    vi.mocked(useBookmarks).mockReturnValue({
      loading: true,
      error: null
    });
    render(<BookmarkList bookmarks={mockBookmarks} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    vi.mocked(useBookmarks).mockReturnValue({
      loading: false,
      error: new Error('Test error')
    });
    render(<BookmarkList bookmarks={mockBookmarks} />);
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it('calls onBookmarkClick when a bookmark is clicked', () => {
    const onBookmarkClick = vi.fn();
    render(<BookmarkList bookmarks={mockBookmarks} onBookmarkClick={onBookmarkClick} />);
    // Add click test implementation
  });
}); 
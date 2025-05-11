/// <reference types="chrome"/>

declare namespace chrome {
  namespace runtime {
    interface LastError {
      message?: string;
    }
    const lastError: LastError | undefined;
    function sendMessage(message: unknown, callback?: (response: unknown) => void): void;
  }

  namespace storage {
    namespace local {
      function get(keys: string | string[] | object | null, callback: (items: { [key: string]: unknown }) => void): void;
      function set(items: object, callback?: () => void): void;
      function remove(keys: string | string[], callback?: () => void): void;
      function clear(callback?: () => void): void;
    }
  }

  namespace bookmarks {
    function create(bookmark: { title?: string; url?: string }, callback?: (bookmark: unknown) => void): void;
    function remove(id: string, callback?: () => void): void;
    function getTree(callback: (bookmarkTreeNodes: unknown[]) => void): void;
  }
} 
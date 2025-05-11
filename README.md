# Forethought Toolbox

A powerful browser extension for advanced bookmark management, fuzzy search, workflow automation, and user experience enhancements. Built with React, Vite, and Chrome APIs.

---

## 🚀 Features

- **Bookmark Management:**
  - Merge duplicate bookmarks with a single confirmation dialog
  - Batch delete with undo (single toast, no redundant prompts)
  - Real-time column show/hide and persistent settings
  - Always-on actions column for quick edits/deletes
- **Fuzzy Search:**
  - Lightning-fast search with [Fuse.js](https://fusejs.io/)
  - Command+K global search modal
- **Workflow Automation:**
  - Bookmarklet support and custom workflow actions
  - Robust message passing between popup/content scripts
- **Import/Export:**
  - Export/import bookmarks and settings as JSON
- **User Experience:**
  - Responsive, accessible UI
  - Table zoom with no excessive gap space
  - Undo/redo for destructive actions
- **Persistence:**
  - All settings and state stored locally (no external servers)

---

## 🏁 Quick Install (No Build Required)

**For most users who just want to use the extension:**

1. **Download the latest release ZIP** from here: [forethought-toolbox.zip](https://github.com/user-attachments/files/20150692/forethought-toolbox.zip)
2. **Extract** the ZIP file on your computer.
3. **Go to** `chrome://extensions/`
4. **Enable** "Developer mode"
5. **Click** "Load unpacked" and select the extracted folder (should contain `manifest.json`).

---

## 🛠️ Developer Install (Build Required)

**For developers or advanced users who want to build from source:**

1. **Clone the repository:**
   ```sh
   git clone https://github.com/ft-manu/forethought-toolbox.git
   cd forethought-toolbox
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Build the extension:**
   ```sh
   npm run build
   ```
4. **Load in Chrome:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` folder

---

## 🧑‍💻 Usage

- **Bookmark Table:**
  - Show/hide columns in real time
  - Use the actions column for quick edits/deletes
- **Search:**
  - Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) for global search
- **Batch Actions:**
  - Select multiple bookmarks for batch delete/merge
  - Undo available for all destructive actions
- **Import/Export:**
  - Use the settings menu to export/import bookmarks and settings as JSON

---

## ⚙️ Advanced Features

- **Bookmarklet Automation:**
  - Add custom bookmarklets and automate workflows
- **Persistent Settings:**
  - All user preferences are saved in localStorage
- **Robust Error Handling:**
  - Graceful error messages and recovery for all actions

---

## 🧩 Code Structure

- `src/` — Main source code (React components, utilities, Chrome API wrappers)
- `public/` — Static assets and manifest
- `dist/` — Production build output
- `background.js` — Background script for Chrome extension
- `contentScript.js` — Content script for page interaction
- `manifest.json` — Chrome extension manifest

---

## 🐞 Troubleshooting

- **Extension not loading?**
  - Ensure you selected the correct `dist/` folder after building
- **UI issues or errors?**
  - Check the browser console for errors
  - Try rebuilding: `npm run build`
- **Settings not saving?**
  - Make sure Chrome sync/local storage is enabled

---

## 🤝 Contributing

1. Fork the repo and create your branch from `main`.
2. Add tests for new features if applicable.
3. Ensure code passes linting and tests.
4. Submit a pull request!

---

## 🛡️ Privacy & Security

- All data is stored locally in your browser.
- You control your data with import/export.
- No data is sent to any external server.

---

## 📄 License

[MIT](LICENSE)

---

## 🙋 FAQ

**Q: How do I reset all settings?**  
A: Remove the extension and reinstall, or clear data from the extension's settings.

**Q: How do I report a bug or request a feature?**  
A: Open an issue on [GitHub Issues](https://github.com/ft-manu/forethought-toolbox/issues).

---

## 📣 Credits

- Built with [React](https://reactjs.org/), [Vite](https://vitejs.dev/), and [Tailwind CSS](https://tailwindcss.com/)
- Fuzzy search by [Fuse.js](https://fusejs.io/)
- Icons by [Heroicons](https://heroicons.com/)
- Special thanks to all contributors and testers!

---

## 📬 Contact

For support or questions, open an issue or contact [ft-manu on GitHub](https://github.com/ft-manu).

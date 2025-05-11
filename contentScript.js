import Fuse from "fuse.js";

// Storage keys
const STORAGE_KEYS = {
  BOOKMARK_CLICKS: 'bookmarkClicks',
  SEARCH_HISTORY: 'searchHistory',
  SEARCH_FILTERS: 'searchFilters',
  SEARCH_SUGGESTIONS: 'searchSuggestions'
};

if (document.getElementById("forethought-shadow-host")) {
  console.log("Modal already exists. Skipping injection.");
} else {
  main();
}

function isExtensionContextValid() {
  return (
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    typeof chrome.runtime.sendMessage === "function"
  );
}

function safeSendMessage(message, callback, retryCount = 0) {
  if (!isExtensionContextValid()) {
    console.warn("Messaging skipped: Extension context invalid.");
    callback?.(null);
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError || !response) {
        const reason = chrome.runtime.lastError?.message || "No response";
        console.warn("Message failed:", reason);

        // Retry up to 2 times after 100ms
        if (retryCount < 2) {
          setTimeout(() => {
            safeSendMessage(message, callback, retryCount + 1);
          }, 100);
        } else {
          callback?.(null);
        }
        return;
      }

      callback?.(response);
    });
  } catch (err) {
    console.error("sendMessage threw exception:", err);
    callback?.(null);
  }
}

function handleMessagingFailure(modal) {
  const spinner = modal.querySelector("#spinner");
  const searchResults = modal.querySelector("#searchResults");
  if (spinner) spinner.style.display = "none";
  if (searchResults) {
    const errMsg = document.createElement("div");
    errMsg.textContent = "🚫 Extension messaging is not available.";
    searchResults.appendChild(errMsg);
  }
}

function safeStorageGet(keys, callback) {
  if (!isExtensionContextValid()) {
    console.warn("Messaging skipped: Extension context invalid.");
    return;
  }
  try {
    chrome.storage.local.get(keys, callback);
  } catch (err) {
    console.warn("Storage get failed:", err);
  }
}

function safeStorageSet(items, callback) {
  if (!isExtensionContextValid()) {
    console.warn("Storage set skipped: Extension context invalid.");
    return;
  }
  try {
    chrome.storage.local.set(items, callback);
  } catch (err) {
    console.warn("Storage set failed:", err);
  }
}

// Auto-run bookmarklet when on specific Forethought Dashboard URLs
function runAutoBookmarkletIfMatch() {
  const url = window.location.href;
  const params = new URLSearchParams(window.location.search);
  const orgName = params.get("org");

  if (url.includes("dashboard") && orgName && !window.__bookmarkletAlreadyRan) {
    window.__bookmarkletAlreadyRan = true;

    const maxAttempts = 20;
    const delay = 500;

    function waitForElement(selector, attempt = 0) {
      const el = document.querySelector(selector);
      if (el) return el;
      if (attempt >= maxAttempts) return null;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(waitForElement(selector, attempt + 1));
        }, delay);
      });
    }

    async function runAutomation() {
      const profileBtn = await waitForElement(
        'button[aria-label="Account Setting"]',
      );
      if (!profileBtn) {
        alert("❌ Profile button not found after waiting.");
        return;
      }

      profileBtn.click();

      waitForChangeOrg(0);
    }

    function waitForChangeOrg(attempt) {
      const changeOrgBtn = document.querySelector('[data-testid="change-org"]');
      if (changeOrgBtn) {
        changeOrgBtn.click();
        setTimeout(() => typeInSearchBar(0), delay);
      } else if (attempt < maxAttempts) {
        setTimeout(() => waitForChangeOrg(attempt + 1), delay);
      } else {
        alert("❌ 'Change Org' button not found after retries.");
      }
    }

    function typeInSearchBar(attempt) {
      const input = document.querySelector("input.SearchBar-input");
      if (input) {
        input.focus();
        input.value = orgName;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        setTimeout(() => waitForOrgAndConfirm(0), delay);
      } else if (attempt < maxAttempts) {
        setTimeout(() => typeInSearchBar(attempt + 1), delay);
      } else {
        alert("❌ Search bar not found.");
      }
    }

    function waitForOrgAndConfirm(attempt) {
      const orgOption = [
        ...document.querySelectorAll("button.ModalItem-container"),
      ].find((btn) => btn.innerText.includes(orgName));
      const confirmBtn = document.querySelector(
        ".BreakdownModal-applyBreakdownButton",
      );

      if (orgOption && confirmBtn) {
        orgOption.click();
        setTimeout(() => confirmBtn.click(), 300);
      } else if (attempt < maxAttempts) {
        setTimeout(() => waitForOrgAndConfirm(attempt + 1), delay);
      } else {
        alert("❌ Org or Confirm button not found.");
      }
    }

    runAutomation();
  }
}

function main() {
  // Create Shadow DOM
  const shadowHost = document.createElement("div");
  shadowHost.id = "forethought-shadow-host";
  document.body.appendChild(shadowHost);

  const shadow = shadowHost.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    #overlay {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100vw;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  pointer-events: none;
  z-index: 9998;
  backdrop-filter: blur(5px);
  transition: opacity 0.3s ease;
}

#overlay.active {
  opacity: 1;
  pointer-events: auto;
}

#modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.95);
  background: #1a1c23;
  padding: 20px;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  min-height: 200px;
  max-height: 90vh;
  overflow-y: auto;
  will-change: transform;
  opacity: 0;
  pointer-events: none;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  color: white;
  box-shadow: 0 10px 30px rgba(0,0,0,0.6);
  backdrop-filter: blur(10px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

#modal.active {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, -50%) scale(1);
}

#searchInput {
  width: 100%;
  padding: 12px 16px;
  margin-bottom: 12px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  background: #2e3138;
  color: white;
  outline: none;
  box-sizing: border-box;
  position: relative;
  z-index: 2;
}

.suggestion-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #2e3138;
  border-radius: 8px;
  margin-top: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  z-index: 1;
  max-height: 200px;
  overflow-y: auto;
  transform: translateY(0);
  transition: transform 0.2s ease;
}

#searchResults {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: calc(90vh - 120px);
  overflow-y: auto;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0px;
  position: relative;
  z-index: 1;
}

#searchResults li {
  background: #2e3138;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  border-radius: 0px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s ease, transform 0.2s ease, opacity 0.3s ease;
  opacity: 0;
  transform: translateY(10px);
}

#searchResults li.show {
  opacity: 1;
  transform: translateY(0);
}

    #searchResults li.active,
    #searchResults li.active:hover {
      background: #38404d !important;
    }

    #modal.light-mode #searchResults li.active,
    #modal.light-mode #searchResults li.active:hover {
      background: #e5e7eb !important;
      color: #222;
}

#settingsWrapper {
      position: fixed;
      bottom: 32px;
      right: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
      z-index: 10001;
}

#settingsButton {
  background: rgba(255,255,255,0.15);
  border: none;
  color: white;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 18px;
  z-index: 10000;
  transition: background 0.3s;
}

#settingsButton:hover {
  background: rgba(255,255,255,0.25);
}

#modal.light-mode {
  background: #ffffff;
  color: #222;
}

#modal.light-mode #searchInput {
  background: #f3f4f6;
  color: #222;
  border: 1px solid #ccc;
}

#searchResults li.light-mode {
  color: #222;
}

    .switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0;
  right: 0; bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #4caf50;
}

input:checked + .slider:before {
  transform: translateX(16px);
}

#opacitySlider {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  width: 140px;
  background: #888;
  border-radius: 5px;
  outline: none;
  margin-top: 4px;
  cursor: pointer;
  transition: box-shadow 0.3s ease;
}

#opacitySlider:hover {
  box-shadow: 0 0 8px 2px #4caf50;
}

#opacitySlider:active {
  box-shadow: 0 0 12px 4px #4caf50;
}

#opacitySlider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #4caf50;
  cursor: pointer;
  transition: background 0.3s ease;
}

#opacitySlider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #4caf50;
  cursor: pointer;
  transition: background 0.3s ease;
}

    #modal.light-mode #searchFilters select {
      background: #f3f4f6;
      color: #222;
      border: 1px solid #ccc;
    }

    #modal.light-mode .suggestion-list {
      background: #f3f4f6;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    #modal.light-mode .suggestion-list div:hover {
      background: #e5e7eb;
    }

    #modal.light-mode .suggestion-list div {
      color: #222;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
}
  `;
  shadow.appendChild(style);

  // Create elements
  const overlay = document.createElement("div");
  overlay.id = "overlay";

  const settingsWrapper = document.createElement("div");
  settingsWrapper.id = "settingsWrapper";
  settingsWrapper.innerHTML = `
  <button id="settingsButton">⚙️</button>
  <div id="settingsPanel" style="display: none; flex-direction: column; gap: 8px; margin-left: 8px; margin-top: 8px; min-width: 220px;">
    <div id="opacityControl" style="display: flex; flex-direction: column; gap: 4px;">
      <label for="opacitySlider" style="font-size: 12px; color: white;">Background Opacity</label>
      <input type="range" id="opacitySlider" min="0.5" max="1" step="0.05" value="0.8" style="width: 120px;" />
    </div>
    <div id="themeWrapper" style="display: flex; align-items: center; gap: 6px;">
      <span id="themeIcon" style="font-size: 18px;">🌙</span>
      <label class="switch">
        <input type="checkbox" id="themeToggle">
        <span class="slider"></span>
      </label>
      <span style="font-size: 13px; margin-left: 8px;">Light/Dark Mode</span>
    </div>
    <div id="expandRecentWrapper" style="display: flex; align-items: center; gap: 6px;">
  <span style="font-size: 16px;">📌 Expand Recent</span>
  <label class="switch">
    <input type="checkbox" id="expandRecentToggle">
    <span class="slider"></span>
  </label>
    <div id="recentLimitWrapper" style="display: flex; align-items: center; gap: 6px;">
  <span style="font-size: 14px;">🆕 Recent Limit</span>
  <input type="number" id="recentLimitInput" min="1" max="50" value="5" style="width: 50px; padding: 4px; border-radius: 4px; border: none; text-align: center;">
</div>
</div>
<div id="expandTopWrapper" style="display: flex; align-items: center; gap: 6px;">
  <span style="font-size: 16px;">📌 Expand Top</span>
  <label class="switch">
    <input type="checkbox" id="expandTopToggle">
    <span class="slider"></span>
  </label>
<div id="topLimitWrapper" style="display: flex; align-items: center; gap: 6px;">
  <span style="font-size: 14px;">🌟 Top Limit</span>
  <input type="number" id="topLimitInput" min="1" max="50" value="5" style="width: 50px; padding: 4px; border-radius: 4px; border: none; text-align: center;">
</div>
</div>
<button id="resetClicksButton" style="margin-top: 8px; padding: 6px 10px; font-size: 14px; border: none; border-radius: 8px; background: rgba(255,255,255,0.15); color: white; cursor: pointer;">
  🔄 Reset Click Stats
</button>
    <button id="onboardingTourButton" style="margin-top: 8px; padding: 6px 10px; font-size: 14px; border: none; border-radius: 8px; background: rgba(59,130,246,0.15); color: white; cursor: pointer; transition: background 0.2s ease;">
      🚀 Onboarding Tour
    </button>
  </div>
    
`;

  overlay.appendChild(settingsWrapper);

  const modal = document.createElement("div");
  modal.id = "modal";
  modal.innerHTML = `
  <input id="searchInput" type="text" placeholder="Search bookmarks..." />
  <div id="spinner" style="display: none; margin: 20px auto; width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid #4caf50; border-radius: 50%; animation: spin 1s linear infinite;"></div>
  <ul id="searchResults"></ul>
`;

  shadow.appendChild(overlay);
  shadow.appendChild(modal);

  const searchInput = modal.querySelector("#searchInput");
  const searchResults = modal.querySelector("#searchResults");
  const settingsButton = settingsWrapper.querySelector("#settingsButton");
  const settingsPanel = settingsWrapper.querySelector("#settingsPanel");
  const opacitySlider = settingsWrapper.querySelector("#opacitySlider");
  const themeToggle = settingsWrapper.querySelector("#themeToggle");
  const themeIcon = settingsWrapper.querySelector("#themeIcon");

  // Load saved theme
  function loadTheme() {
    chrome.storage.local.get("forethought_theme", (data) => {
      let theme = data.forethought_theme;

      if (!theme) {
        // Detect system preference if no saved theme
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        theme = prefersDark ? "dark" : "light";

        // Save detected theme to storage
        chrome.storage.local.set({ forethought_theme: theme });
      }

      // Apply the theme
      if (theme === "light") {
        modal.classList.add("light-mode");
        themeToggle.checked = true;
        themeIcon.textContent = "☀️";
      } else {
        modal.classList.remove("light-mode");
        themeToggle.checked = false;
        themeIcon.textContent = "🌙";
      }
    });
  }

  // Theme switch event
  themeToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
      modal.classList.add("light-mode");
      // localStorage.setItem("forethought_theme", "light");
      chrome.storage.local.set({ forethought_theme: "light" });
      themeIcon.textContent = "☀️";
    } else {
      modal.classList.remove("light-mode");
      // localStorage.setItem("forethought_theme", "dark");
      chrome.storage.local.set({ forethought_theme: "dark" });
      themeIcon.textContent = "🌙";
    }
  });

  loadTheme();

  // Load saved opacity setting
  function loadOpacity() {
    chrome.storage.local.get("forethought_overlay_opacity", (data) => {
      const saved = data.forethought_overlay_opacity;

      if (saved !== undefined && saved !== null) {
        overlay.style.background = `rgba(0, 0, 0, ${saved})`;
        opacitySlider.value = saved;
      } else {
        overlay.style.background = `rgba(0, 0, 0, 0.8)`;
      }
    });
  }

  opacitySlider.oninput = (e) => {
    const value = e.target.value;
    overlay.style.background = `rgba(0, 0, 0, ${value})`;
    // localStorage.setItem("forethought_overlay_opacity", value);
    chrome.storage.local.set({ forethought_overlay_opacity: value });
  };

  loadOpacity();

  // Helper to get the current recentList and topList DOM elements
  function getSectionLists() {
    const searchResults = modal.querySelector('#searchResults');
    let recentList = null, topList = null;
    if (searchResults) {
      const divs = searchResults.querySelectorAll('div');
      divs.forEach(div => {
        if (div.previousSibling && div.previousSibling.textContent?.includes('Recently Added')) recentList = div;
        if (div.previousSibling && div.previousSibling.textContent?.includes('Top Bookmarks')) topList = div;
      });
    }
    return { recentList, topList };
  }

  // Add this after loadOpacity() and before settingsButton.onclick
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['forethought_overlay_opacity']) {
      const newOpacity = changes['forethought_overlay_opacity'].newValue;
      if (newOpacity !== undefined && overlay) {
        overlay.style.background = `rgba(0, 0, 0, ${newOpacity})`;
        if (opacitySlider) opacitySlider.value = newOpacity;
      }
    }
    if (
      changes['forethought_expandRecent'] ||
      changes['forethought_expandTop'] ||
      changes['forethought_recentLimit'] ||
      changes['forethought_topLimit']
    ) {
      // If the modal is open, reload the suggestions section to reflect new settings
      if (modal.classList.contains('active')) {
        // Re-fetch bookmarks and clicks, then re-render suggestions
        safeSendMessage({ type: 'GET_BOOKMARKS' }, (response) => {
          const bookmarks = response?.bookmarks || [];
          safeStorageGet('bookmarkClicks', (data) => {
            const clicks = data?.bookmarkClicks || {};
            showSuggestions(bookmarks, clicks, modal);
            // After re-render, update expand/collapse state
            const { recentList, topList } = getSectionLists();
            if (changes['forethought_expandRecent'] && recentList) {
              recentList.style.display = changes['forethought_expandRecent'].newValue ? 'block' : 'none';
            }
            if (changes['forethought_expandTop'] && topList) {
              topList.style.display = changes['forethought_expandTop'].newValue ? 'block' : 'none';
            }
          });
        });
      }
      // Also update the toggles/inputs in the settings panel if open
      if (expandRecentToggle && changes['forethought_expandRecent']) {
        expandRecentToggle.checked = changes['forethought_expandRecent'].newValue === true || changes['forethought_expandRecent'].newValue === 'true';
      }
      if (expandTopToggle && changes['forethought_expandTop']) {
        expandTopToggle.checked = changes['forethought_expandTop'].newValue === true || changes['forethought_expandTop'].newValue === 'true';
      }
      if (recentLimitInput && changes['forethought_recentLimit']) {
        recentLimitInput.value = changes['forethought_recentLimit'].newValue;
      }
      if (topLimitInput && changes['forethought_topLimit']) {
        topLimitInput.value = changes['forethought_topLimit'].newValue;
      }
    }
  });

  settingsButton.onclick = (e) => {
    e.stopPropagation();
    settingsPanel.style.display =
      settingsPanel.style.display === "none" ? "flex" : "none";

    // Add rotation class
    settingsButton.classList.add("rotate");

    // Remove rotation class after animation completes (clean)
    setTimeout(() => {
      settingsButton.classList.remove("rotate");
    }, 500); // Match animation duration (0.5s)
  };

  // opacitySlider.oninput = (e) => {
  //   const value = e.target.value;
  //   modal.style.background = `rgba(30, 41, 59, ${value})`;
  //   localStorage.setItem("forethought_opacity", value);
  // };

  function showGlobalSearchOnboarding(shadow) {
    const onboarding = document.createElement('div');
    onboarding.id = 'global-search-onboarding';
    onboarding.style.position = 'fixed';
    onboarding.style.top = '50%';
    onboarding.style.left = '50%';
    onboarding.style.transform = 'translate(-50%, -50%)';
    onboarding.style.background = 'white';
    onboarding.style.color = '#222';
    onboarding.style.padding = '32px 28px';
    onboarding.style.borderRadius = '16px';
    onboarding.style.boxShadow = '0 8px 32px rgba(0,0,0,0.18)';
    onboarding.style.zIndex = '10001';
    onboarding.style.maxWidth = '90vw';
    onboarding.style.minWidth = '320px';
    onboarding.style.textAlign = 'center';
    onboarding.innerHTML = `
      <h2 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">Welcome to Global Search!</h2>
      <ul style="text-align: left; margin: 0 auto 1.5rem auto; max-width: 340px; font-size: 1rem; line-height: 1.6; color: #333;">
        <li>🔍 <b>Search bookmarks instantly</b> with <kbd style='background:#eee;padding:2px 6px;border-radius:4px;'>Cmd+K</kbd> or <kbd style='background:#eee;padding:2px 6px;border-radius:4px;'>Ctrl+K</kbd></li>
        <li>↔️ Navigate results with <kbd style='background:#eee;padding:2px 6px;border-radius:4px;'>↑</kbd> <kbd style='background:#eee;padding:2px 6px;border-radius:4px;'>↓</kbd> and <kbd style='background:#eee;padding:2px 6px;border-radius:4px;'>Enter</kbd></li>
        <li>📊 View your most used and recently added bookmarks</li>
        <li>⚙️ Customize settings in the bottom right</li>
        <li>🌗 Light/Dark mode support</li>
      </ul>
      <button id="closeOnboardingBtn" style="margin-top: 1rem; padding: 10px 24px; background: #22c55e; color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer;">Got it!</button>
    `;
    shadow.appendChild(onboarding);
    onboarding.querySelector('#closeOnboardingBtn').onclick = () => {
      onboarding.remove();
      safeStorageSet({ seenGlobalSearchOnboarding: true });
    };
  }

  function openModal() {
    overlay.classList.add("active");
    modal.classList.add("active");
    searchInput.focus();

    // Show onboarding if first time, after reinstall, or reload
    safeStorageGet(["seenGlobalSearchOnboarding", "extensionVersion"], (data) => {
      const currentVersion = chrome.runtime.getManifest().version;
      const shouldShowOnboarding = !data.seenGlobalSearchOnboarding || 
                                 !data.extensionVersion || 
                                 data.extensionVersion !== currentVersion;

      if (shouldShowOnboarding) {
        showGlobalSearchOnboarding(shadow);
        // Save the current version and mark onboarding as seen
        safeStorageSet({ 
          seenGlobalSearchOnboarding: true,
          extensionVersion: currentVersion
        });
      }
    });

    // Delay loading to let background script catch up
    setTimeout(() => {
      loadBookmarks(modal);
    }, 150);
  }

  function closeModal() {
    overlay.classList.remove("active");
    modal.classList.remove("active");
  }

  function loadBookmarks(modal) {
    const spinner = modal.querySelector("#spinner");
    const searchResults = modal.querySelector("#searchResults");
    const searchInput = modal.querySelector("#searchInput");

    if (spinner) spinner.style.display = "block";
    if (searchResults) searchResults.innerHTML = "";

    if (location.protocol === "chrome:") {
      console.warn("Cannot run extension on chrome:// pages.");
      if (spinner) spinner.style.display = "none";
      if (searchResults) {
        const errMsg = document.createElement("div");
        errMsg.textContent = "🚫 Not supported on chrome:// pages.";
        searchResults.appendChild(errMsg);
      }
      return;
    }

    try {
      safeSendMessage({ type: "GET_BOOKMARKS" }, (response) => {
        if (!response) {
          handleMessagingFailure(modal);
          return;
        }

        const bookmarks = response?.bookmarks || [];

        safeStorageGet(["bookmarkClicks", "bookmark_categories"], (data) => {
          const clicks = data?.bookmarkClicks || {};
          const categories = Array.isArray(data?.bookmark_categories) ? data.bookmark_categories : [];
          if (spinner) spinner.style.display = "none";
          if (searchResults) searchResults.innerHTML = "";

          const fuse = new Fuse(bookmarks, {
            keys: ["title", "url"],
            includeScore: true,
            threshold: 0.4,
            distance: 100,
            useExtendedSearch: true
          });

          function applyFilters(term, bookmarks) {
            let filtered = bookmarks;
            
            // Apply search term
            if (term.trim()) {
              const results = fuse.search(term);
              filtered = results.map(r => r.item);
            }

            return filtered;
          }

          searchInput.oninput = () => {
            const term = searchInput.value.toLowerCase();
            searchResults.innerHTML = "";
            currentResults = [];
            currentIndex = -1;

            // Update search history and suggestions
            updateSearchHistory(term);
            updateSearchSuggestions(term);

            if (term.trim() === "") {
              showSuggestions(bookmarks, clicks, modal);
              return;
            }

            const filteredResults = applyFilters(term, bookmarks);
            
            if (filteredResults.length === 0) {
              const noResult = document.createElement("div");
              noResult.textContent = "🔍 No bookmarks found.";
              searchResults.appendChild(noResult);
              return;
            }

            filteredResults.forEach((bm) => {
              const li = document.createElement("li");
              const title = bm.title;
              const clickCount = clicks[title] || 0;
              // Find category
              let catName = "Uncategorized";
              let catColor = "#6366f1";
              if (bm.categoryId) {
                const cat = categories.find(c => c.id === bm.categoryId);
                if (cat) {
                  catName = cat.name;
                  catColor = cat.color || "#6366f1";
                }
              }
              li.innerHTML = `
                <span style="background:${catColor};color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;display:inline-block;margin-right:10px;">${catName}</span>
              <img src="https://www.google.com/s2/favicons?domain=${bm.url}" style="width:16px; height:16px; margin-right:8px; vertical-align:middle; border-radius:4px;">
              <span class="bookmark-title">${bm.title}</span>
                <span class="bookmark-clicks" style="margin-left: 6px;">(${clickCount})</span>
            `;
              li.classList.add("show");
              // THEME-AWARE ROW STYLING
              const isLight = modal.classList.contains('light-mode');
              li.style.background = isLight ? '#f3f4f6' : '#23272f';
              li.style.color = isLight ? '#222' : '#fff';
              li.style.display = 'flex';
              li.style.alignItems = 'center';
              li.style.padding = '14px 18px';
              li.style.margin = '0 0 2px 0';
              li.style.borderRadius = '8px';
              li.style.fontSize = '16px';
              li.style.boxShadow = isLight ? '0 1px 4px rgba(0,0,0,0.04)' : '0 1px 4px rgba(0,0,0,0.18)';
              li.style.transition = 'background 0.2s, color 0.2s';
              li.onmouseenter = () => { li.style.background = isLight ? '#e5e7eb' : '#38404d'; };
              li.onmouseleave = () => { li.style.background = isLight ? '#f3f4f6' : '#23272f'; };
              // Click count color
              const clicksSpan = li.querySelector('.bookmark-clicks');
              if (clicksSpan) clicksSpan.style.color = isLight ? '#666' : '#bbb';
              li.onclick = () => {
                if (!isExtensionContextValid()) {
                  alert("🚫 Bookmark open failed. Extension context was lost.");
                  return;
                }
                chrome.storage.local.get("bookmarkClicks", (data) => {
                  const clicks = data.bookmarkClicks || {};
                  clicks[title] = (clicks[title] || 0) + 1;
                  chrome.storage.local.set({ bookmarkClicks: clicks }, () => {
                    window.open(bm.url, "_blank");
                    closeModal();
                  });
                });
              };
              searchResults.appendChild(li);
              currentResults.push({ element: li, data: bm });
            });
            currentIndex = currentResults.length > 0 ? 0 : -1;
            updateActiveResult && updateActiveResult();
          };

          showSuggestions(bookmarks, clicks, modal);
        });
      });
    } catch (err) {
      console.error("sendMessage threw exception:", err);
      handleMessagingFailure(modal);
    }
  }

  // --- ROBUST showSuggestions: always reads settings from storage ---
  function showSuggestions(bookmarks, clicks, modal) {
    chrome.storage.local.get([
      'forethought_expandRecent',
      'forethought_expandTop',
      'forethought_recentLimit',
      'forethought_topLimit',
    ], (data) => {
      const expandRecent = data.forethought_expandRecent === true || data.forethought_expandRecent === 'true';
      const expandTop = data.forethought_expandTop === true || data.forethought_expandTop === 'true';
      const recentLimit = parseInt(data.forethought_recentLimit) || 5;
      const topLimit = parseInt(data.forethought_topLimit) || 5;
      const searchResults = modal.querySelector('#searchResults');
    if (!searchResults) return;
    searchResults.innerHTML = "";
    currentResults = [];
    currentIndex = -1;
    if (bookmarks.length === 0) return;
        // Recently Added Section
        const recentHeader = document.createElement("div");
        recentHeader.textContent = "🆕 Recently Added";
        recentHeader.style =
          "padding: 8px 16px; font-size: 14px; font-weight: bold; color: gray; cursor: pointer;";
        searchResults.appendChild(recentHeader);
        const recentList = document.createElement("div");
        recentList.style.display = expandRecent ? "block" : "none";
        searchResults.appendChild(recentList);
        recentHeader.onclick = () => {
        recentList.style.display = recentList.style.display === "none" ? "block" : "none";
        };
        const recentBookmarks = bookmarks.slice(-recentLimit).reverse();
        recentBookmarks.forEach((bm) => {
          const li = document.createElement("li");
          const title = bm.title;
          const clickCount = clicks[title] || 0;
          li.innerHTML = `
        <img src="https://www.google.com/s2/favicons?domain=${bm.url}" style="width:16px; height:16px; margin-right:8px; vertical-align:middle; border-radius:4px;">
        <span class="bookmark-title">${bm.title}</span>
          <span class="bookmark-clicks" style="margin-left: 6px;">(${clickCount})</span>
      `;
          li.classList.add("show");
        // THEME-AWARE ROW STYLING
        const isLight = modal.classList.contains('light-mode');
        li.style.background = isLight ? '#f3f4f6' : '#23272f';
        li.style.color = isLight ? '#222' : '#fff';
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.padding = '14px 18px';
        li.style.margin = '0 0 2px 0';
        li.style.borderRadius = '8px';
        li.style.fontSize = '16px';
        li.style.boxShadow = isLight ? '0 1px 4px rgba(0,0,0,0.04)' : '0 1px 4px rgba(0,0,0,0.18)';
        li.style.transition = 'background 0.2s, color 0.2s';
        li.onmouseenter = () => { li.style.background = isLight ? '#e5e7eb' : '#38404d'; };
        li.onmouseleave = () => { li.style.background = isLight ? '#f3f4f6' : '#23272f'; };
        // Click count color
        const clicksSpan = li.querySelector('.bookmark-clicks');
        if (clicksSpan) clicksSpan.style.color = isLight ? '#666' : '#bbb';
          li.onclick = () => {
          if (!isExtensionContextValid()) {
            alert("🚫 Bookmark open failed. Extension context was lost.");
            return;
          }
            chrome.storage.local.get("bookmarkClicks", (data) => {
              const clicks = data.bookmarkClicks || {};
              clicks[title] = (clicks[title] || 0) + 1;
              chrome.storage.local.set({ bookmarkClicks: clicks }, () => {
                window.open(bm.url, "_blank");
                closeModal();
              });
            });
          };
          recentList.appendChild(li);
          currentResults.push({ element: li, data: bm });
        });
        // Top Bookmarks Section
        const topHeader = document.createElement("div");
        topHeader.textContent = "🌟 Top Bookmarks";
        topHeader.style =
          "padding: 8px 16px; font-size: 14px; font-weight: bold; color: gray; margin-top: 16px; cursor: pointer;";
        searchResults.appendChild(topHeader);
        const topList = document.createElement("div");
        topList.style.display = expandTop ? "block" : "none";
        searchResults.appendChild(topList);
        topHeader.onclick = () => {
        topList.style.display = topList.style.display === "none" ? "block" : "none";
        };
        const topBookmarks = bookmarks.slice(0, topLimit);
        topBookmarks.forEach((bm) => {
          const li = document.createElement("li");
          const title = bm.title;
          const clickCount = clicks[title] || 0;
          li.innerHTML = `
        <img src="https://www.google.com/s2/favicons?domain=${bm.url}" style="width:16px; height:16px; margin-right:8px; vertical-align:middle; border-radius:4px;">
        <span class="bookmark-title">${bm.title}</span>
          <span class="bookmark-clicks" style="margin-left: 6px;">(${clickCount})</span>
      `;
          li.classList.add("show");
        // THEME-AWARE ROW STYLING
        const isLight = modal.classList.contains('light-mode');
        li.style.background = isLight ? '#f3f4f6' : '#23272f';
        li.style.color = isLight ? '#222' : '#fff';
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.padding = '14px 18px';
        li.style.margin = '0 0 2px 0';
        li.style.borderRadius = '8px';
        li.style.fontSize = '16px';
        li.style.boxShadow = isLight ? '0 1px 4px rgba(0,0,0,0.04)' : '0 1px 4px rgba(0,0,0,0.18)';
        li.style.transition = 'background 0.2s, color 0.2s';
        li.onmouseenter = () => { li.style.background = isLight ? '#e5e7eb' : '#38404d'; };
        li.onmouseleave = () => { li.style.background = isLight ? '#f3f4f6' : '#23272f'; };
        // Click count color
        const clicksSpan = li.querySelector('.bookmark-clicks');
        if (clicksSpan) clicksSpan.style.color = isLight ? '#666' : '#bbb';
          li.onclick = () => {
          if (!isExtensionContextValid()) {
            alert("🚫 Bookmark open failed. Extension context was lost.");
            return;
          }
            chrome.storage.local.get("bookmarkClicks", (data) => {
              const clicks = data.bookmarkClicks || {};
              clicks[title] = (clicks[title] || 0) + 1;
              chrome.storage.local.set({ bookmarkClicks: clicks }, () => {
                window.open(bm.url, "_blank");
                closeModal();
              });
            });
          };
          topList.appendChild(li);
          currentResults.push({ element: li, data: bm });
        });
      if (recentList) applySectionTheme(recentList);
      if (topList) applySectionTheme(topList);
      currentIndex = currentResults.length > 0 ? 0 : -1;
      updateActiveResult && updateActiveResult();
    });
  }
  window.showSuggestions = showSuggestions;

  let currentIndex = -1;
  let currentResults = [];

  let hasBoundKeyboardEvents = false;

  function bindKeyboardEventsOnce() {
    if (hasBoundKeyboardEvents) return;
    hasBoundKeyboardEvents = true;

    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openModal();
      }

      if (overlay.classList.contains("active")) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeModal();
        }

        if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
          e.preventDefault();
          if (currentResults.length > 0) {
            currentIndex = (currentIndex + 1) % currentResults.length;
            updateActiveResult();
          }
        }

        if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
          e.preventDefault();
          if (currentResults.length > 0) {
            currentIndex =
              (currentIndex - 1 + currentResults.length) %
              currentResults.length;
            updateActiveResult();
          }
        }

        if (e.key === "Enter") {
          e.preventDefault();
          if (currentIndex >= 0 && currentResults[currentIndex]) {
            const { data } = currentResults[currentIndex];
            const title = data.title;
            chrome.storage.local.get("bookmarkClicks", (res) => {
              const clicks = res.bookmarkClicks || {};
              clicks[title] = (clicks[title] || 0) + 1;
              chrome.storage.local.set({ bookmarkClicks: clicks }, () => {
                if (e.metaKey || e.ctrlKey) {
                  // Command+Enter or Ctrl+Enter: open in new tab
                window.open(data.url, "_blank");
                } else {
                  // Enter: open in same tab
                  window.location.href = data.url;
                }
                closeModal();
              });
            });
          }
        }
      }
    });
  }

  bindKeyboardEventsOnce();

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  function updateActiveResult() {
    currentResults.forEach((r, idx) => {
      if (idx === currentIndex) {
        r.element.classList.add("active");
      } else {
        r.element.classList.remove("active");
      }
    });
  }

  const resetClicksButton = settingsWrapper.querySelector("#resetClicksButton");
  const onboardingTourButton = settingsWrapper.querySelector("#onboardingTourButton");

  resetClicksButton.onclick = () => {
    if (confirm("Are you sure you want to reset all bookmark click counts?")) {
      chrome.storage.local.remove("bookmarkClicks", () => {
        alert("Click stats reset successfully!");
        // Immediately update the UI to show all click counts as zero
        if (modal.classList.contains('active')) {
          safeSendMessage({ type: 'GET_BOOKMARKS' }, (response) => {
            const bookmarks = response?.bookmarks || [];
            showSuggestions(bookmarks, {}, modal); // Pass empty clicks object
          });
        }
      });
    }
  };

  onboardingTourButton.onclick = () => {
    // Remove any existing onboarding modal
    const existingOnboarding = shadow.querySelector('#global-search-onboarding');
    if (existingOnboarding) {
      existingOnboarding.remove();
    }
    
    // Add click feedback
    onboardingTourButton.style.background = 'rgba(59,130,246,0.25)';
    setTimeout(() => {
      onboardingTourButton.style.background = 'rgba(59,130,246,0.15)';
    }, 200);
    
    // Show the onboarding modal
    showGlobalSearchOnboarding(shadow);
  };

  const expandRecentToggle = settingsWrapper.querySelector(
    "#expandRecentToggle",
  );
  const expandTopToggle = settingsWrapper.querySelector("#expandTopToggle");

  // Load saved toggles
  const recentLimitInput = settingsWrapper.querySelector("#recentLimitInput");
  const topLimitInput = settingsWrapper.querySelector("#topLimitInput");

  function loadExpandSettings() {
    chrome.storage.local.get(
      [
        "forethought_expandRecent",
        "forethought_expandTop",
        "forethought_recentLimit",
        "forethought_topLimit",
      ],
      (data) => {
        const expandRecent = data.forethought_expandRecent === "true";
        const expandTop = data.forethought_expandTop === "true";
        const recentLimit = parseInt(data.forethought_recentLimit) || 5;
        const topLimit = parseInt(data.forethought_topLimit) || 5;

        expandRecentToggle.checked = expandRecent;
        expandTopToggle.checked = expandTop;
        recentLimitInput.value = recentLimit;
        topLimitInput.value = topLimit;
      },
    );
  }

  expandRecentToggle.addEventListener("change", (e) => {
    chrome.storage.local.set({ forethought_expandRecent: e.target.checked });
    // Immediately update the section if modal is open
    const { recentList } = getSectionLists();
    if (recentList) recentList.style.display = e.target.checked ? 'block' : 'none';
  });
  expandTopToggle.addEventListener("change", (e => {
    chrome.storage.local.set({ forethought_expandTop: e.target.checked });
    // Immediately update the section if modal is open
    const { topList } = getSectionLists();
    if (topList) topList.style.display = e.target.checked ? 'block' : 'none';
  }));
  recentLimitInput.addEventListener("input", (e) => {
    chrome.storage.local.set({ forethought_recentLimit: e.target.value });
  });
  topLimitInput.addEventListener("input", (e) => {
    chrome.storage.local.set({ forethought_topLimit: e.target.value });
  });

  runAutoBookmarkletIfMatch();

  // --- THEME-AWARE STYLES FOR EXPANDED SECTIONS ---
  function applySectionTheme(section) {
    if (!section) return;
    const isLight = modal.classList.contains('light-mode');
    section.style.background = isLight ? '#f3f4f6' : '#2e3138';
    section.style.color = isLight ? '#222' : '#fff';
    section.style.borderRadius = '10px';
    section.style.padding = '8px 0';
    section.style.marginBottom = '8px';
    section.style.boxShadow = isLight ? '0 2px 8px rgba(0,0,0,0.04)' : '0 2px 8px rgba(0,0,0,0.18)';
  }

  // --- RESTORE SETTINGS ON MODAL OPEN ---
  function restoreSettingsAndApply() {
    chrome.storage.local.get([
      'forethought_expandRecent',
      'forethought_expandTop',
      'forethought_recentLimit',
      'forethought_topLimit',
      'forethought_overlay_opacity',
      'forethought_theme',
    ], (data) => {
      // Set toggles/inputs
      expandRecentToggle.checked = data.forethought_expandRecent === true || data.forethought_expandRecent === 'true';
      expandTopToggle.checked = data.forethought_expandTop === true || data.forethought_expandTop === 'true';
      recentLimitInput.value = data.forethought_recentLimit || 5;
      topLimitInput.value = data.forethought_topLimit || 5;
      if (opacitySlider && data.forethought_overlay_opacity) {
        opacitySlider.value = data.forethought_overlay_opacity;
        overlay.style.background = `rgba(0, 0, 0, ${data.forethought_overlay_opacity})`;
      }
      if (data.forethought_theme === 'light') {
        modal.classList.add('light-mode');
        themeToggle.checked = true;
        themeIcon.textContent = '☀️';
      } else {
        modal.classList.remove('light-mode');
        themeToggle.checked = false;
        themeIcon.textContent = '🌙';
      }
      // Update sections if modal is open
      if (modal.classList.contains('active')) {
        const { recentList, topList } = getSectionLists();
        if (recentList) {
          recentList.style.display = expandRecentToggle.checked ? 'block' : 'none';
          applySectionTheme(recentList);
        }
        if (topList) {
          topList.style.display = expandTopToggle.checked ? 'block' : 'none';
          applySectionTheme(topList);
        }
      }
    });
  }

  // --- PATCH openModal TO RESTORE SETTINGS ---
  const origOpenModal = openModal;
  openModal = function() {
    restoreSettingsAndApply();
    origOpenModal();
  };

  // --- PATCH THEME TOGGLE TO UPDATE SECTIONS ---
  themeToggle.addEventListener('change', (e) => {
    setTimeout(() => {
      const { recentList, topList } = getSectionLists();
      if (recentList) applySectionTheme(recentList);
      if (topList) applySectionTheme(topList);
    }, 50);
  });

  // --- PATCH EXPAND TOGGLES TO SAVE AND UPDATE SECTIONS ---
  expandRecentToggle.addEventListener("change", (e) => {
    chrome.storage.local.set({ forethought_expandRecent: e.target.checked });
    const { recentList } = getSectionLists();
    if (recentList) {
      recentList.style.display = e.target.checked ? 'block' : 'none';
      applySectionTheme(recentList);
    }
  });
  expandTopToggle.addEventListener("change", (e) => {
    chrome.storage.local.set({ forethought_expandTop: e.target.checked });
    const { topList } = getSectionLists();
    if (topList) {
      topList.style.display = e.target.checked ? 'block' : 'none';
      applySectionTheme(topList);
    }
  });
  recentLimitInput.addEventListener("input", (e) => {
    chrome.storage.local.set({ forethought_recentLimit: e.target.value });
    // Re-render suggestions to update the number of rows
    if (modal.classList.contains('active')) {
      safeSendMessage({ type: 'GET_BOOKMARKS' }, (response) => {
        const bookmarks = response?.bookmarks || [];
        safeStorageGet('bookmarkClicks', (data) => {
          const clicks = data?.bookmarkClicks || {};
          showSuggestions(bookmarks, clicks, modal);
        });
      });
    }
  });
  topLimitInput.addEventListener("input", (e) => {
    chrome.storage.local.set({ forethought_topLimit: e.target.value });
    // Re-render suggestions to update the number of rows
    if (modal.classList.contains('active')) {
      safeSendMessage({ type: 'GET_BOOKMARKS' }, (response) => {
        const bookmarks = response?.bookmarks || [];
        safeStorageGet('bookmarkClicks', (data) => {
          const clicks = data?.bookmarkClicks || {};
          showSuggestions(bookmarks, clicks, modal);
        });
      });
    }
  });

  // --- ENSURE SETTINGS ARE RESTORED ON MODAL OPEN ---
  // Patch the original openModal if not already patched
  if (!openModal._patched) {
    const orig = openModal;
    openModal = function() {
      restoreSettingsAndApply();
      orig();
    };
    openModal._patched = true;
  }
}

function updateSearchHistory(term) {
  if (!term.trim()) return;
  chrome.storage.local.get(STORAGE_KEYS.SEARCH_HISTORY, (data) => {
    const history = data[STORAGE_KEYS.SEARCH_HISTORY] || [];
    // Add new term to front, remove duplicates, limit to 10
    const newHistory = [term, ...history.filter(t => t !== term)].slice(0, 10);
    chrome.storage.local.set({ [STORAGE_KEYS.SEARCH_HISTORY]: newHistory });
  });
}

function updateSearchSuggestions(term) {
  if (!term.trim()) return;
  chrome.storage.local.get(STORAGE_KEYS.SEARCH_SUGGESTIONS, (data) => {
    const suggestions = data[STORAGE_KEYS.SEARCH_SUGGESTIONS] || {};
    suggestions[term] = (suggestions[term] || 0) + 1;
    chrome.storage.local.set({ [STORAGE_KEYS.SEARCH_SUGGESTIONS]: suggestions });
  });
}

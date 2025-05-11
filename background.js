chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type === "GET_BOOKMARKS") {
		try {
			if (message.useSystemBookmarks) {
				chrome.bookmarks.getTree((tree) => {
					const flat = [];

					function walk(nodes) {
						for (const node of nodes) {
							if (node.url) {
								flat.push({ title: node.title, url: node.url });
							}
							if (node.children) {
								walk(node.children);
							}
						}
					}

					walk(tree);
					sendResponse({ bookmarks: flat });
				});
			} else {
				chrome.storage.local.get("bookmarks", (data) => {
					sendResponse({ bookmarks: data.bookmarks || [] });
				});
			}
			return true; // ✅ Keep sendResponse alive
		} catch (err) {
			console.error("Failed to fetch bookmarks:", err);
			sendResponse({ bookmarks: [] });
			return true;
		}
	}
});

// ✅ Add support for Command+K hotkey (or Command+Shift+K)
chrome.commands.onCommand.addListener((command) => {
	if (command === "toggle-command-k") {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			const tab = tabs[0];
			if (tab?.id) {
				chrome.scripting.executeScript({
					target: { tabId: tab.id },
					files: ["contentScript.js"],
				});
			}
		});
	}
});

// Automatic backup functionality
let backupInterval = null;

function getNextBackupTime(frequency) {
	let ms = 0;
	const value = parseInt(frequency.slice(0, -1));
	const unit = frequency.slice(-1);
	switch (unit) {
		case 'm':
			ms = value * 60 * 1000;
			break;
		case 'h':
			ms = value * 60 * 60 * 1000;
			break;
		case 'd':
			ms = value * 24 * 60 * 60 * 1000;
			break;
		default:
			return null;
	}
	return Date.now() + ms;
}

function scheduleBackup() {
	// Clear any existing interval
	if (backupInterval) {
		clearInterval(backupInterval);
	}

	// Get backup frequency from storage
	chrome.storage.local.get(['backupFrequency'], (data) => {
		const frequency = data.backupFrequency;
		if (!frequency) return;

		// Convert frequency to milliseconds
		let ms = 0;
		const value = parseInt(frequency.slice(0, -1));
		const unit = frequency.slice(-1);
		switch (unit) {
			case 'm':
				ms = value * 60 * 1000;
				break;
			case 'h':
				ms = value * 60 * 60 * 1000;
				break;
			case 'd':
				ms = value * 24 * 60 * 60 * 1000;
				break;
			default:
				return;
		}

		// Set nextBackupTime on schedule
		const nextBackupTime = Date.now() + ms;
		chrome.storage.local.set({ nextBackupTime });

		// Schedule the backup
		backupInterval = setInterval(async () => {
			try {
				// Get bookmarks and categories
				const { bookmarks, categories } = await chrome.storage.local.get(['bookmarks', 'categories']);
				const timestamp = new Date().toISOString();
				const fileTimestamp = timestamp.replace(/[:.]/g, '-');
				let urls = [];

				// Download bookmarks
				if (bookmarks) {
					const blob = new Blob([JSON.stringify(bookmarks, null, 2)], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					urls.push(url);
					await chrome.downloads.download({
						url,
						filename: `bookmarks_backup_${fileTimestamp}.json`,
						saveAs: false
					});
				}

				// Always download categories (even if empty or undefined)
				const categoriesToSave = Array.isArray(categories) ? categories : [];
				const catBlob = new Blob([JSON.stringify(categoriesToSave, null, 2)], { type: 'application/json' });
				const catUrl = URL.createObjectURL(catBlob);
				urls.push(catUrl);
				await chrome.downloads.download({
					url: catUrl,
					filename: `categories_backup_${fileTimestamp}.json`,
					saveAs: false
				});

				// Update last backup timestamp and nextBackupTime
				const newNextBackupTime = Date.now() + ms;
				await chrome.storage.local.set({ 
					lastBackup: {
						bookmarks: timestamp,
						categories: timestamp,
						automatic: timestamp
					},
					nextBackupTime: newNextBackupTime
				});

				// Clean up object URLs
				urls.forEach(url => URL.revokeObjectURL(url));

				// Show notification
				chrome.runtime.sendMessage({
					type: 'SHOW_TOAST',
					payload: {
						message: 'Automatic backup created successfully ✅',
						type: 'success'
					}
				});
			} catch (error) {
				console.error('Automatic backup error:', error);
				chrome.runtime.sendMessage({
					type: 'SHOW_TOAST',
					payload: {
						message: 'Failed to create automatic backup ❌',
						type: 'error'
					}
				});
			}
		}, ms);
	});
}

// Listen for backup frequency changes
chrome.storage.onChanged.addListener((changes) => {
	if (changes.backupFrequency) {
		scheduleBackup();
	}
});

// Schedule initial backup on startup
scheduleBackup();

// Default Chrome downloads folder:
// Windows: C:\Users\<YourUsername>\Downloads
// macOS: /Users/<YourUsername>/Downloads
// Linux: /home/<YourUsername>/Downloads

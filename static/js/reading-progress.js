/**
 * Reading Progress Tracking
 * Tracks scroll position, displays progress bar, saves progress to localStorage
 */
(function() {
	const progressBar = document.getElementById('reading-progress-bar');
	const progressFill = document.getElementById('reading-progress-fill');
	const markersContainer = document.getElementById('progress-header-markers');
	const positionIndicator = document.getElementById('progress-position-indicator');
	const article = document.querySelector('article.h-entry');
	const progressBackground = document.getElementById('reading-progress');

	if (!progressBar || !progressFill || !markersContainer || !positionIndicator || !article || !progressBackground) return;

	// Extract clean title without llms.txt link
	const titleElement = document.querySelector('h1.title.p-name');
	let articleTitle = '';
	if (titleElement) {
		const titleClone = titleElement.cloneNode(true);
		const llmsSpan = titleClone.querySelector('span');
		if (llmsSpan) llmsSpan.remove();
		articleTitle = titleClone.textContent.trim();
	}

	const currentPath = window.location.pathname;
	const STORAGE_KEY = 'readingProgress';
	const POSITION_INDICATOR_TIMEOUT = 15000;

	let saveTimeout = null;
	let resizeTimeout = null;
	let hasScrolled = false;
	let headers = [];
	let initialScrollPosition = window.pageYOffset;
	let hasScrolledSignificantly = false;
	let savedScrollPosition = null;
	let cachedProgress = null;
	let positionIndicatorBound = false;

	// Debounce utility
	function debounce(fn, delay) {
		let timeout;
		return function(...args) {
			clearTimeout(timeout);
			timeout = setTimeout(() => fn.apply(this, args), delay);
		};
	}

	// Find all headers in the article content
	function findHeaders() {
		const contentSection = article.querySelector('.body.e-content');
		if (!contentSection) return [];

		const headerElements = contentSection.querySelectorAll('h1, h2, h3, h4, h5, h6');
		return Array.from(headerElements).map((header, index) => {
			if (!header.id) header.id = `header-${index}`;
			return {
				element: header,
				id: header.id,
				text: header.textContent.trim(),
				level: parseInt(header.tagName.charAt(1))
			};
		});
	}

	// Create header markers on the progress bar
	function createHeaderMarkers() {
		if (headers.length === 0) return;

		const fragment = document.createDocumentFragment();
		const articleRect = article.getBoundingClientRect();
		const articleTop = articleRect.top + window.pageYOffset;
		const articleHeight = articleRect.height;

		headers.forEach(header => {
			const headerTop = header.element.getBoundingClientRect().top + window.pageYOffset;
			const relativePosition = (headerTop - articleTop) / articleHeight;
			const markerPosition = Math.max(0, Math.min(100, relativePosition * 100));

			const marker = document.createElement('div');
			marker.className = 'progress-header-marker';
			marker.style.top = `${markerPosition}%`;
			marker.setAttribute('data-title', header.text);
			marker.setAttribute('data-header-id', header.id);

			marker.addEventListener('click', () => {
				header.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});

			fragment.appendChild(marker);
		});

		markersContainer.innerHTML = '';
		markersContainer.appendChild(fragment);
	}

	// localStorage with caching
	function getReadingProgress() {
		if (cachedProgress !== null) return cachedProgress;
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			cachedProgress = stored ? JSON.parse(stored) : {};
			return cachedProgress;
		} catch (e) {
			cachedProgress = {};
			return cachedProgress;
		}
	}

	function invalidateCache() {
		cachedProgress = null;
	}

	function saveReadingProgress(progressData) {
		try {
			invalidateCache();
			const allProgress = getReadingProgress();
			allProgress[currentPath] = progressData;

			// Clean up old entries (older than 30 days)
			const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
			for (const path in allProgress) {
				if (allProgress[path].lastRead < thirtyDaysAgo) {
					delete allProgress[path];
				}
			}

			localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
			invalidateCache();
		} catch (e) {
			// Silent fail
		}
	}

	function removeFromStorage() {
		try {
			invalidateCache();
			const allProgress = getReadingProgress();
			if (allProgress[currentPath]) {
				delete allProgress[currentPath];
				localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
				invalidateCache();
			}
		} catch (e) {
			// Silent fail
		}
	}

	// Shared progress calculation
	function calculateProgress() {
		const rect = article.getBoundingClientRect();
		const articleTop = rect.top + window.pageYOffset;
		const articleHeight = rect.height;
		const windowHeight = window.innerHeight;
		const scrollTop = window.pageYOffset;
		const scrollableDistance = articleHeight - windowHeight;
		const minScrollableDistance = windowHeight * 0.5;

		if (scrollableDistance < minScrollableDistance) {
			return { progress: 0, scrollTop, isShortArticle: true };
		}

		const scrolledPastTop = Math.max(0, scrollTop - articleTop);
		let progress = (scrolledPastTop / scrollableDistance) * 100;
		progress = Math.max(0, Math.min(100, progress));

		return { progress, scrollTop, isShortArticle: false };
	}

	// Calculate and update progress
	function updateProgress() {
		const { progress, scrollTop, isShortArticle } = calculateProgress();

		if (isShortArticle) {
			progressBackground.classList.remove('visible');
			return;
		}

		progressFill.style.height = progress + '%';

		if (progress > 1) {
			progressBackground.classList.add('visible');
			hasScrolled = true;
		}

		// Hide position indicator when user scrolls significantly
		if (!hasScrolledSignificantly && Math.abs(window.pageYOffset - initialScrollPosition) > 200) {
			hasScrolledSignificantly = true;
			positionIndicator.classList.remove('visible');
		}

		// Save progress if significant (>5%) and user has scrolled
		if (progress > 5 && hasScrolled) {
			clearTimeout(saveTimeout);
			saveTimeout = setTimeout(() => {
				saveReadingProgress({
					title: articleTitle,
					progress: Math.round(progress),
					lastRead: Date.now(),
					scrollPosition: scrollTop
				});
			}, 2000);
		}

		// Remove from storage when article is completed (>95%)
		if (progress > 95) {
			removeFromStorage();
		}
	}

	// Position indicator click handler (bound once)
	function onPositionIndicatorClick() {
		if (savedScrollPosition) {
			window.scrollTo({ top: savedScrollPosition, behavior: 'smooth' });
			positionIndicator.classList.remove('visible');
		}
	}

	// Show position indicator for previous reading position
	function showPositionIndicator() {
		const allProgress = getReadingProgress();
		const savedProgress = allProgress[currentPath];

		if (savedProgress && savedProgress.progress > 5 && savedProgress.progress < 95) {
			savedScrollPosition = savedProgress.scrollPosition;
			positionIndicator.style.top = `${savedProgress.progress}%`;
			positionIndicator.classList.add('visible');

			// Bind click handler only once
			if (!positionIndicatorBound) {
				positionIndicator.addEventListener('click', onPositionIndicatorClick);
				positionIndicatorBound = true;
			}

			setTimeout(() => {
				positionIndicator.classList.remove('visible');
			}, POSITION_INDICATOR_TIMEOUT);
		}
	}

	// Scroll handler with rAF throttling
	let ticking = false;
	function onScroll() {
		if (!ticking) {
			requestAnimationFrame(() => {
				updateProgress();
				ticking = false;
			});
			ticking = true;
		}
	}

	// Debounced resize handler
	const onResize = debounce(() => {
		updateProgress();
		createHeaderMarkers();
	}, 150);

	// Check if coming from "Continue Reading" link
	function checkContinueFromHomepage() {
		const hash = window.location.hash;
		const continueMatch = hash.match(/^#continue=(\d+)$/);

		if (continueMatch) {
			const targetProgress = parseInt(continueMatch[1]);
			const allProgress = getReadingProgress();
			const savedProgress = allProgress[currentPath];

			if (savedProgress && savedProgress.scrollPosition && Math.abs(savedProgress.progress - targetProgress) < 5) {
				setTimeout(() => {
					window.scrollTo({ top: savedProgress.scrollPosition, behavior: 'smooth' });
					history.replaceState(null, null, window.location.pathname);
				}, 500);
				return true;
			}
		}
		return false;
	}

	// Event listeners
	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onResize);

	// Save progress when leaving page
	window.addEventListener('beforeunload', () => {
		if (!hasScrolled) return;

		const { progress, scrollTop, isShortArticle } = calculateProgress();
		if (isShortArticle) return;

		if (progress > 5 && progress < 95) {
			saveReadingProgress({
				title: articleTitle,
				progress: Math.round(progress),
				lastRead: Date.now(),
				scrollPosition: scrollTop
			});
		}
	});

	// Initialize
	headers = findHeaders();
	createHeaderMarkers();
	updateProgress();

	if (!checkContinueFromHomepage()) {
		showPositionIndicator();
	}
})();

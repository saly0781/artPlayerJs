// --- Global variables to hold instances for cleanup ---
let artInstance = null;
let resizeObserverInstance = null;
let resizeHandler = null;
let languageCode = 'en'; // Default language code, can be overridden

// --- New Episode Tracking Variables ---
let currentEpisodeIndex = 0;
let episodesList = [];
// --- Removed tempData, sData, eData ---

/**
 * @function destroyApp
 * @description Destroys the ArtPlayer instance, removes dynamically added styles,
 * and cleans up event listeners to prevent memory leaks and element duplication
 * when re-initializing the player.
 */
/**
 * @function cleanupCompletedMovies
 * @description Removes completed movies/episodes from localStorage continue watching list
 * based on completion criteria (>90% watched or watched past endTime for final episodes)
 */
function cleanupCompletedMovies() {
    const CONTINUE_WATCHING_KEY = 'continuewatching';
    try {
        const savedData = localStorage.getItem(CONTINUE_WATCHING_KEY);
        if (!savedData) {
            //console.log("No continue watching data found in localStorage");
            return;
        }
        let continueWatchingList = JSON.parse(savedData);
        if (!Array.isArray(continueWatchingList)) {
            //console.log("Invalid continue watching data format");
            return;
        }
        //console.log(`Found ${continueWatchingList.length} items in continue watching list`);
        // Filter out completed movies/episodes
        const filteredList = continueWatchingList.filter(item => {
            // Ensure required properties exist
            if (!item.continueWatching || typeof item.continueWatching.inPercentage !== 'number') {
                //console.warn("Item missing continueWatching data:", item.episodeId || item.movieId);
                return true; // Keep items with incomplete data for safety
            }
            const percentage = item.continueWatching.inPercentage;
            const watchedMinutes = item.continueWatching.inMinutes || 0;
            const endTime = item.time?.endTime ? parseInt(item.time.endTime, 10) : null;
            const type = item.type;
            const partName = item.partName;
            // Check completion criteria
            const isOverNinetyPercent = percentage > 90;
            const isWatchedPastEndTime = endTime && watchedMinutes > endTime;
            // For Movies (type 'M')
            if (type === 'M') {
                if (isOverNinetyPercent || isWatchedPastEndTime) {
                    //console.log(`Removing completed movie: ${item.title} (${percentage}% watched)`);
                    return false; // Remove this item
                }
            }
            // For Series/Episodes (type 'S')
            if (type === 'S') {
                // Check if it's a final episode/part
                const isFinalPart = partName && partName.toLowerCase().includes('final');
                if (isFinalPart && (isOverNinetyPercent || isWatchedPastEndTime)) {
                    //console.log(`Removing completed final episode: ${item.title} - ${partName} (${percentage}% watched)`);
                    return false; // Remove this item
                }
                // For non-final episodes, also remove if >90% to avoid clutter
                // You can comment this out if you want to keep non-final episodes
                if (isOverNinetyPercent || isWatchedPastEndTime) {
                    //console.log(`Removing completed episode: ${item.title} - EP${item.episode || ''}${partName || ''} (${percentage}% watched)`);
                    return false; // Remove this item
                }
            }
            return true; // Keep this item
        });
        const removedCount = continueWatchingList.length - filteredList.length;
        if (removedCount > 0) {
            //console.log(`Removed ${removedCount} completed items from continue watching list`);
            localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(filteredList));
        } else {
            //console.log("No completed items found to remove");
        }
    } catch (error) {
        console.error("Error cleaning up completed movies from localStorage:", error);
    }
}
/**
 * @function mergeSavedWithFreshEpisode
 * @description Merges saved episode data with fresh API data while preserving continueWatching info
 * @param {Object} savedEpisode - The saved episode data from localStorage (without video links)
 * @param {Object} freshEpisode - The fresh episode data from API (with video links)
 * @returns {Object} Merged episode data with fresh metadata and preserved continue watching
 */
const mergeSavedWithFreshEpisode = (savedEpisode, freshEpisode) => {
    if (!savedEpisode || !freshEpisode) return freshEpisode;
    // Preserve continue watching data from saved episode
    const preservedContinueWatching = savedEpisode.continueWatching || {
        inMinutes: 0,
        inPercentage: 0
    };
    // Use fresh episode as base (includes video links, updated metadata, etc.)
    // and merge with preserved continue watching data
    return {
        ...freshEpisode, // All fresh data from API (including video links)
        continueWatching: preservedContinueWatching // Preserved watching progress
    };
};
// Function to handle keypress events for S and E keys
async function saveMovieData(sData, eData) {
    // --- Simplified saveMovieData using currentMovieData ---
    // This assumes sData and eData are now derived from the global currentMovieData
    // when S/E keys are pressed.
    const currentMovieData = episodesList[currentEpisodeIndex]; // Get current episode
    if (!currentMovieData) {
        console.error("No current episode data found for save.");
        return;
    }

    const tempData = currentMovieData; // Use current episode data
    const sDataLocal = {
        databaseName: tempData.type == "S" ? "Season" + (Number(tempData.position?.seasonIndex) + 1) : "Items",
        _id: tempData.episodeId || tempData.movieId,
        startTime: sData?.startTime || artInstance?.currentTime || 0, // Get from passed sData or current time
        endTime: 0,
        totalTime: formatSecondsToHHMMSS(artInstance?.duration || 0),
    };
    const eDataLocal = {
        databaseName: tempData.type == "S" ? "Season" + (Number(tempData.position?.seasonIndex) + 1) : "Items",
        _id: tempData.episodeId || tempData.movieId,
        startTime: 0,
        endTime: eData?.endTime || artInstance?.currentTime || 0, // Get from passed eData or current time
        totalTime: formatSecondsToHHMMSS(artInstance?.duration || 0),
    };

    // Save the movie data to the global savingData object
    if (sDataLocal._id == eDataLocal._id) {
        const response = await fetch("https://api.rebamovie.com/updatedata", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "databaseName": eDataLocal.databaseName,
                "_id": eDataLocal._id,
                "startTime": sDataLocal.startTime,
                "endTime": eDataLocal.endTime,
                "totalTime": eDataLocal.totalTime
            })
        });
        const event = new CustomEvent('playerAction', {
            detail: {
                action: 'saveTime',
                data: {
                    databaseName: eDataLocal.databaseName,
                    _id: eDataLocal._id,
                    startTime: sDataLocal.startTime,
                    endTime: eDataLocal.endTime,
                    totalTime: eDataLocal.totalTime,
                }
            }
        });
        document.dispatchEvent(event); // dispatch globally
    }
    // --- End Simplified saveMovieData ---
}

function handleKeyPress(event) {
    // Convert to lowercase to handle both upper and lower case
    const key = event.key.toLowerCase();
    function formatSecondsToHHMMSS(inputSeconds) {
        const totalSeconds = Math.floor(Number(inputSeconds)); // Convert to number and remove any decimals
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const pad = (num) => String(num).padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    // --- Updated handleKeyPress to work with global currentMovieData ---
    const currentMovieData = episodesList[currentEpisodeIndex]; // Get current episode
    if (!currentMovieData) {
        console.error("No current episode data found for key press.");
        return;
    }
    const tempData = currentMovieData; // Use current episode data
    let sData = null; // Will be populated on 's' press
    let eData = null; // Will be populated on 'e' press
    // --- End Updated handleKeyPress ---

    switch (key) {
        case 's':
            // Add your logic for S key here
            sData = {
                startTime: artInstance?.currentTime || 0, // Capture current time on 's' press
            };
            // Temporarily store sData for 'e' press or pass directly to saveMovieData
            window._tempSData = sData;
            break;
        case 'e':
            // Add your logic for E key here
            eData = {
                endTime: artInstance?.currentTime || 0, // Capture current time on 'e' press
            };
            // Get sData from temporary storage
            sData = window._tempSData || { startTime: 0 };
            delete window._tempSData; // Clear temporary storage
            saveMovieData(sData, eData); // Pass captured data
            break;
        default:
            // Optional: handle other keys or do nothing
            break;
    }
}
// Updated function to determine which ad region the current time falls into
const getCurrentAdRegion = (percentage) => {
    if (percentage >= 19 && percentage < 49) {
        return 'preLoll';
    } else if (percentage >= 55 && percentage <= 75) {
        return 'midLoll';
    } else if (percentage >= 81 && percentage <= 100) {
        return 'postLoll';
    }
    return null;
};
function destroyApp() {
    //console.log("Destroying existing player instance if it exists...");
    // 1. Destroy the ArtPlayer instance if it exists
    document.removeEventListener('keydown', handleKeyPress);
    if (artInstance) {
        try {
            // The `true` argument also removes the player's root element from the DOM
            const movieTitleEl = artInstance.layers.bottomInfo.querySelector('#movie-title-display');
            if (movieTitleEl) {
                movieTitleEl.textContent = '';
            }
            const seasonEpInfoEl = artInstance.layers.bottomInfo.querySelector('#season-episode-info');
            if (seasonEpInfoEl) {
                seasonEpInfoEl.textContent = '';
            }
            const playerContainer = document.querySelector('.artplayer-app');
            //console.log("player container", playerContainer);
            if (playerContainer) {
                //console.log("Removing player container from DOM...", playerContainer);
                playerContainer.innerHTML = '';
            }
            artInstance.destroy(true);
            artInstance = null;
            //console.log("ArtPlayer instance destroyed.");
        } catch (e) {
            console.error("Error destroying ArtPlayer instance:", e);
        }
    }
    // 2. Disconnect the ResizeObserver to stop watching for element resizes
    if (resizeObserverInstance) {
        resizeObserverInstance.disconnect();
        resizeObserverInstance = null;
        //console.log("ResizeObserver disconnected.");
    }
    // 3. Remove the window resize event listener
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
        //console.log("Window resize listener removed.");
    }
    //console.log("Cleanup complete. Ready for re-initialization.");
}
Artplayer.NOTICE_TIME = 5000;
// --- Quality Preference Local Storage Helpers ---
// --- Global variable for video type ---
let videoType = 'm3u8'; // Default video type, can be overridden
/**
 * @function determinePlaybackQualityAndUrl
 * @description Determines the best quality URL to use for playback based on user preference and availability.
 *              Sets the global `videoType` based on the selected URL.
 *              If no user preference exists, it defaults playback to 'mid' (if available) without saving 'mid' as a preference.
 *              If the preferred quality URL is missing, it falls back to the best available without changing the saved preference.
 * @param {Object} movieData - The data object for the current movie/episode containing video URLs.
 * @param {string|null} preferredQuality - The user's preferred quality (from localStorage or explicit choice).
 * @returns {{url: string, quality: string}|null} Object containing the URL and the quality used for playback, or null if no URL found.
 */
function determinePlaybackQualityAndUrl(movieData, preferredQuality) {
    // --- End Update ---
    const qualityOrder = ['hd', 'mid', 'low'];
    const videoData = movieData.video;
    if (!videoData) {
        console.error("No video data found in movie ", movieData);
        // Reset videoType to default if no video data
        videoType = 'm3u8';
        return null;
    }
    let selectedUrl = null;
    let selectedQuality = null;
    // 1. If user has a specific preference saved, try to honor it first.
    if (preferredQuality) {
        const preferredUrlKey = `${preferredQuality}Video`;
        const preferredUrl = videoData[preferredUrlKey];
        if (preferredUrl && !preferredUrl.includes('not found')) {
            //console.log(`Using user's preferred quality URL: ${preferredQuality}`);
            selectedUrl = preferredUrl;
            selectedQuality = preferredQuality;
        } else {
            //console.log(`User's preferred quality '${preferredQuality}' not available. Finding fallback...`);
            // 2. Preferred quality not available, find fallback without changing preference.
            for (const quality of qualityOrder) {
                const urlKey = `${quality}Video`;
                const url = videoData[urlKey];
                if (url && !url.includes('not found')) {
                    //console.log(`Falling back to available quality: ${quality}`);
                    selectedUrl = url;
                    selectedQuality = quality;
                    break; // Use the first available fallback
                }
            }
        }
    } else {
        // 3. No saved preference. Default playback to 'low'.
        //console.log("No saved user preference found. Defaulting playback quality logic...");
        const lowUrl = videoData['lowVideo'];
        if (lowUrl && !lowUrl.includes('not found')) {
            //console.log("Defaulting playback to 'low' quality.");
            selectedUrl = lowUrl;
            selectedQuality = 'low';
        } else {
            // 'mid' (default) not available, fallback to HD or LOW for playback.
            //console.log("'mid' quality (default) not available. Finding alternative default...");
            for (const quality of qualityOrder) {
                if (quality === 'mid') continue; // Already checked
                const urlKey = `${quality}Video`;
                const url = videoData[urlKey];
                if (url && !url.includes('not found')) {
                    //console.log(`Defaulting playback to alternative quality: ${quality}`);
                    selectedUrl = url;
                    selectedQuality = quality;
                    break; // Use the first available alternative
                }
            }
        }
    }
    // --- Determine and Set videoType based on the selected URL ---
    if (selectedUrl) {
        const lowerSelectedUrl = selectedUrl.toLowerCase();
        if (lowerSelectedUrl.includes('.m3u8') || lowerSelectedUrl.includes('.rebacdn1')) {
            videoType = 'm3u8';
            //console.log(`Set videoType to 'm3u8' for URL: ${selectedUrl}`);
        } else if (lowerSelectedUrl.includes('.mpd') || lowerSelectedUrl.includes('.rebacdn2')) {
            videoType = 'mpd';
            //console.log(`Set videoType to 'mpd' for URL: ${selectedUrl}`);
        } else {
            // Fallback or error handling for unknown types
            console.warn(`Unknown video type for selected URL: ${selectedUrl}. Defaulting to 'm3u8'.`);
            videoType = ''; // Or handle error as needed
            // For stricter handling, you might consider returning null here if type is critical
        }
    } else {
        // No URL found at all
        console.error("No playable video sources found.", movieData);
        // Reset videoType to default if no playable source
        videoType = 'm3u8';
    }
    // --- End Determine and Set videoType ---
    if (selectedUrl && selectedQuality) {
        return { url: selectedUrl, quality: selectedQuality };
    } else {
        return null;
    }
}
// --- End Blob Management (No longer used for conversion) ---
// --- UI Component HTML Strings ---
const controlsPlayAndPauseElement = `
                                <div id="playbackControlsContainer">
                                    <button class="control-button" id="rewindButton" aria-label="Rewind 30 seconds" style="height: 70%;">
                                        <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
                                            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                                            <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="7px" font-weight="bold" fill="#FFFFFF">30</text>
                                        </svg>
                                    </button>
                                    <button class="control-button play-button" id="playPauseButton" aria-label="Play">
                                        <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
                                            <path d="M8 5v14l11-7z"/> </svg>
                                    </button>
                                    <button class="control-button" id="forwardButton" aria-label="Forward 30 seconds" style="height: 70%;">
                                        <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
                                            <path d="M12 5V1L17 6l-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6H20c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                                            <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="7px" font-weight="bold" fill="#FFFFFF">30</text>
                                        </svg>
                                    </button>
                                </div>`;
const mainTopControlsContainer = `
                <div id="mainControlsContainer">
                    <div class="primary-controls">
                        <button class="icon-button" id="backButton" aria-label="Go back">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                            </svg>
                        </button>
                        <div class="action-button-container" id="actionButtonContainer"></div>
                        <div class="right-icons-container" id="rightIconsContainer">
                            <button class="icon-button" id="volumeButton" aria-label="Mute">
                               <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                </svg>
                            </button>
                            <button class="icon-button" id="fullscreenButton" aria-label="Toggle fullscreen">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                </div>`;
// --- Inject CSS Styles ---
function injectComponentStyles() {
    const cssRules = `
                        #mainControlsContainer {
                            width: 100%;
                            height: auto;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 10px;
                            padding: 20px 50px 10px;
                            box-sizing: border-box;
                            font-family: 'Inter', sans-serif;
                            background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);
                            transition: transform 0.3s ease-out, opacity 0.3s ease-out;
                            position: relative;
                        }
                         #mainControlsContainer.hidden {
                            transform: translateY(-100%);
                            opacity: 0;
                            pointer-events: none;
                        }
                        .primary-controls {
                            display: flex;
                            width: 100%;
                            align-items: center;
                            gap: 12px;
                            justify-content: space-between;
                        }
                        .icon-button {
                            background-color: transparent;
                            border: none;
                            padding: 8px;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 8px;
                            flex-shrink: 0;
                        }
                        .icon-button svg {
                            width: 35px;
                            height: 35px;
                            fill: #E5E7EB;
                            transition: fill 0.2s ease-in-out;
                        }
                        .icon-button:hover svg {
                            fill: #FFFFFF;
                        }
                        #rightIconsContainer .icon-button svg {
                            width: 40px;
                            height: 27px;
                        }
                        #rightIconsContainer .icon-button {
                            padding: 6px;
                        }
                        .segmented-control-container, .right-icons-container {
                            background: rgba(170, 170, 170, 0.25);
                            -webkit-backdrop-filter: blur(10px);
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255, 255, 255, 0.2);
                            border-radius: 12px;
                            padding: 4px;
                            display: flex;
                            height: 50px;
                            box-sizing: border-box;
                        }
                        .segmented-control-container {
                              flex: 1;
                              min-width: 60px;
                              max-width: 240px;
                              margin: 0 auto;
                        }
                        .right-icons-container {
                              gap: 4px;
                              flex-shrink: 0;
                        }
                        .segment-button {
                            flex-grow: 1;
                            flex-basis: 0;
                            padding: 4px 5px;
                            border-radius: 8px;
                            margin: 0px 2px;
                            cursor: pointer;
                            font-weight: 500;
                            transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
                            color: #FFFFFF;
                            border: none;
                            background-color: transparent;
                            outline: none;
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            line-height: 1.2;
                        }
                        .quality-label { font-size: 13px; }
                        .quality-size { font-size: 10px; opacity: 0.7; }
                        .segment-button.active {
                            background-color: #1fdf67;
                            color: #000000;
                            font-weight: 600;
                        }
                        .segment-button.active .quality-size { opacity: 0.6; }
                        .segment-button.disabled {
                            background-color: transparent;
                            color: #4B5563;
                            cursor: not-allowed;
                        }
                        .segment-button:not(.active):not(.disabled):hover {
                            background-color: rgba(255, 255, 255, 0.1);
                            color: #FFFFFF;
                        }
                        .segment-button.disabled:hover {
                            background-color: transparent;
                            color: #4B5563;
                        }
                        @media (max-width: 480px) {
                            #volumeButton, #bottom-left-info { display: none !important; }
                            .art-controls-center { display: none; }
                            #rightIconsContainer { background-color: transparent; border: none; padding: 0; }
                            #fullscreenButton { padding: 8px; }
                            #fullscreenButton svg { width: 35px; height: 35px; }
                        }
                    `;
    const styleElement = document.createElement('style');
    styleElement.id = 'component-styles'; // Add ID for easy removal
    styleElement.type = 'text/css';
    styleElement.appendChild(document.createTextNode(cssRules));
    document.head.appendChild(styleElement);
}
injectComponentStyles();
function injectPlaybackStyles() {
    const cssRules = `
                        @keyframes rotate-360 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                        @keyframes rotate-minus-360 { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
                        .spin-forward { animation: rotate-360 0.5s linear; }
                        .spin-rewind { animation: rotate-minus-360 0.5s linear; }
                        #playbackControlsContainer {
                            width: 100%;
                            height: 100%;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            box-sizing: border-box;
                            font-family: 'Inter', sans-serif;
                            transition: opacity 0.3s ease-out;
                        }
                         #playbackControlsContainer.hidden {
                            opacity: 0;
                            pointer-events: none;
                        }
                        .control-button {
                            background: rgba(170, 170, 170, 0.25);
                            -webkit-backdrop-filter: blur(10px);
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255, 255, 255, 0.2);
                            border-radius: 50%;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin: 0 3.0vw;
                            padding: 0;
                            position: relative;
                            transition: background-color 0.2s ease-in-out, transform 0.1s ease-in-out;
                            aspect-ratio: 1 / 1;
                            box-sizing: border-box;
                            height: 100%;
                        }
                        .control-button .icon { fill: #FFFFFF; pointer-events: none; }
                        #rewindButton .icon, #forwardButton .icon { height: 60%; }
                        #rewindButton .icon text, #forwardButton .icon text { font-family: 'Inter', sans-serif; }
                        .play-button .icon { height: 60%; }
                        .control-button:hover { background: rgba(170, 170, 170, 0.4); }
                        .control-button:active { transform: scale(0.92); background-color: rgba(170, 170, 170, 0.5); }
                    `;
    const styleElement = document.createElement('style');
    styleElement.id = 'playback-styles'; // Add ID for easy removal
    styleElement.type = 'text/css';
    styleElement.appendChild(document.createTextNode(cssRules));
    document.head.appendChild(styleElement);
}
injectPlaybackStyles();
function injectDynamicButtonStyles() {
    const cssRules = `
                        @keyframes bounce-slide-out {
                            0% { transform: translateY(0) scale(1); opacity: 1; }
                            50% { transform: translateY(0) scale(1.05); opacity: 1; }
                            100% { transform: translateY(-50px) scale(0.8); opacity: 0; }
                        }
                        @keyframes bounce-only {
                            0%, 100% { transform: scale(1); }
                            50% { transform: scale(1.05); }
                        }
                        .action-button-container {
                            display: flex;
                            gap: 10px;
                            align-items: center;
                            justify-content: center;
                            pointer-events: auto;
                            height: 40px;
                        }
                        .action-button-wrapper {
                           width: 100%;
                           display: flex;
                           justify-content: center;
                           gap: 10px;
                        }
                        .action-button-wrapper.animate-out {
                            animation: bounce-slide-out 0.5s ease-out forwards;
                        }
                        .dynamic-action-button, .dismiss-button {
                            background: rgba(170, 170, 170, 0.25);
                            -webkit-backdrop-filter: blur(10px);
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255, 255, 255, 0.2);
                            color: #FFFFFF;
                            font-family: 'Inter', sans-serif;
                            cursor: pointer;
                            transition: all 0.2s ease;
                        }
                        .dynamic-action-button:hover, .dismiss-button:hover {
                            background: rgba(170, 170, 170, 0.4);
                            border-color: rgba(255, 255, 255, 0.3);
                        }
                        .dynamic-action-button {
                            font-size: 14px;
                            font-weight: 500;
                            padding: 10px 16px;
                            border-radius: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                            flex-grow: 1;
                        }
                        .dismiss-button {
                            border-radius: 50%;
                            width: 36px;
                            height: 36px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 20px;
                            font-weight: bold;
                            padding: 0;
                            line-height: 1;
                            flex-shrink: 0;
                        }
                        #bottom-left-info, #more-episodes-container {
                            transition: opacity 0.3s ease-out;
                        }
                        #bottom-left-info.hidden, #more-episodes-container.hidden {
                            opacity: 0;
                            pointer-events: none;
                        }
                        #bottom-left-info {
                            position: absolute;
                            bottom: 100px;
                            left: 50px;
                            z-index: 25;
                            pointer-events: none;
                            width: 350px;
                        }
                        #season-episode-info {
                            font-size: 1.1rem; /* Base size for Desktop */
                            font-weight: 500;
                            color: #E5E7EB;
                            text-shadow: 1px 1px 4px rgba(0,0,0,0.6);
                        }
                        #movie-title-display {
                            font-size: 2.5rem; /* Base size for Desktop */
                            font-weight: 700;
                            color: #fff;
                            text-shadow: 2px 2px 8px rgba(0,0,0,0.7);
                            margin-top: -5px;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            display: -webkit-box;
                            -webkit-line-clamp: 2;
                            -webkit-box-orient: vertical;
                        }
                        #more-episodes-container {
                            position: absolute;
                            right: 0;
                            padding: 50px;
                            bottom: 55px;
                        }
                        /* Responsive Font Sizes */
                        /* 4K+ Ultra-wide (2561px+) */
                        @media (min-width: 2561px) {
                            #season-episode-info {
                                font-size: 2.0rem;
                            }
                            #movie-title-display {
                                font-size: 4.5rem;
                            }
                            #bottom-left-info {
                                width: 700px;
                            }
                            #more-episodes-container {
                                padding: 50px;
                                bottom: 55px;
                            }
                            #bottom-left-info {
                                bottom: 100px;
                                left: 50px;
                            }
                            #mainControlsContainer {
                                padding: 20px 50px 10px;
                            }
                        }
                        /* 2K Display (1921px-2560px) */
                        @media (min-width: 1921px) and (max-width: 2560px) {
                            #season-episode-info {
                                font-size: 1.5rem;
                            }
                            #movie-title-display {
                                font-size: 3.5rem;
                            }
                            #bottom-left-info {
                                width: 700px;
                            }
                            #more-episodes-container {
                                padding: 50px;
                                bottom: 55px;
                            }
                            #bottom-left-info {
                                bottom: 100px;
                                left: 50px;
                            }
                            #mainControlsContainer {
                                padding: 20px 50px 10px;
                            }
                        }
                        /* Large Desktop (1441px-1920px) */
                        @media (min-width: 1441px) and (max-width: 1920px) {
                            #season-episode-info {
                                font-size: 1.25rem;
                            }
                            #movie-title-display {
                                font-size: 3.0rem;
                            }
                            #bottom-left-info {
                                width: 500px;
                            }
                            #more-episodes-container {
                                padding: 50px;
                                bottom: 55px;
                            }
                            #bottom-left-info {
                                bottom: 100px;
                                left: 50px;
                            }
                            #mainControlsContainer {
                                padding: 20px 50px 10px;
                            }
                        }
                        /* Tablet (769px-1024px) */
                        @media (min-width: 769px) and (max-width: 1024px) {
                            #season-episode-info {
                                font-size: 1.0rem;
                            }
                            #movie-title-display {
                                font-size: 2.0rem;
                            }
                            #bottom-left-info {
                                width: 500px;
                            }
                            #more-episodes-container {
                                padding: 50px;
                                bottom: 55px;
                            }
                            #bottom-left-info {
                                bottom: 100px;
                                left: 50px;
                            }
                            #mainControlsContainer {
                                padding: 20px 50px 10px;
                            }
                        }
                        /* Mobile (481px-768px) */
                        @media (min-width: 481px) and (max-width: 768px) {
                            #season-episode-info {
                                font-size: 0.8rem;
                            }
                            #movie-title-display {
                                font-size: 1.5rem;
                            }
                            #bottom-left-info {
                                width: 350px;
                            }
                            #more-episodes-container {
                                padding: 20px;
                                bottom: 55px;
                            }
                            #bottom-left-info {
                                bottom: 75px;
                                left: 20px;
                            }
                            #mainControlsContainer {
                                padding: 20px 20px 10px;
                            }
                        }
                        /* Small Mobile (¤480px) */
                        @media (max-width: 480px) {
                            #season-episode-info {
                                font-size: 0.7rem;
                            }
                            #movie-title-display {
                                font-size: 1.3rem;
                            }
                            #bottom-left-info {
                                width: 350px;
                            }
                            #more-episodes-container {
                                padding: 20px;
                                bottom: 55px;
                            }
                            #bottom-left-info {
                                bottom: 75px;
                                left: 20px;
                            }
                            #mainControlsContainer {
                                padding: 20px 20px 10px;
                            }
                        }
                        /* Optional: High DPI adjustment (can be refined based on testing) */
                        /* This slightly reduces the base font size on high DPI screens for visual consistency */
                            @media (min-resolution: 2dppx) {
                            #season-episode-info {
                                font-size: calc(1.1rem * 0.95);
                            }
                            #movie-title-display {
                                font-size: calc(2.5rem * 0.95);
                            }
                            @media (max-width: 480px) {
                                #season-episode-info { font-size: calc(0.7rem * 0.95); }
                                #movie-title-display { font-size: calc(1.3rem * 0.95); }
                            }
                            @media (min-width: 481px) and (max-width: 768px) {
                                #season-episode-info { font-size: calc(0.8rem * 0.95); }
                                #movie-title-display { font-size: calc(1.5rem * 0.95); }
                            }
                            @media (min-width: 769px) and (max-width: 1024px) {
                                 #season-episode-info { font-size: calc(1.0rem * 0.95); }
                                #movie-title-display { font-size: calc(2.0rem * 0.95); }
                            }
                            @media (min-width: 1441px) and (max-width: 1920px) {
                                #season-episode-info { font-size: calc(1.25rem * 0.95); }
                                #movie-title-display { font-size: calc(3.0rem * 0.95); }
                            }
                            @media (min-width: 1921px) and (max-width: 2560px) {
                                #season-episode-info { font-size: calc(1.5rem * 0.95); }
                                #movie-title-display { font-size: calc(3.5rem * 0.95); }
                            }
                            @media (min-width: 2561px) {
                                #season-episode-info { font-size: calc(2.0rem * 0.95); }
                                #movie-title-display { font-size: calc(4.5rem * 0.95); }
                            }
                        }
                        #more-episodes-card {
                            cursor: pointer;
                            pointer-events: auto;
                            background: rgba(40, 40, 40, 0.7);
                            -webkit-backdrop-filter: blur(10px);
                            backdrop-filter: blur(10px);
                            /* Initial border style - will be overridden by JS for countdown */
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            border-radius: 12px;
                            padding: 10px;
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            transition: all 0.2s ease;
                            /* Ensure box-sizing is correct for border calculations */
                            box-sizing: border-box;
                        }
                        #more-episodes-card:hover {
                            background: rgba(55, 55, 55, 0.8);
                            border-color: rgba(255, 255, 255, 0.2);
                        }
                        #more-episodes-card.bounce { animation: bounce-only 0.3s ease-out; }
                        .next-episode-text {
                            color: white;
                            font-family: 'Inter', sans-serif;
                            text-align: left;
                            line-height: 1.2;
                        }
                        .next-episode-text h3 { margin: 0; font-size: 1.1rem; font-weight: 600; }
                        .next-episode-text p { margin: 0; font-size: 0.9rem; font-weight: 500; color: #1fdf67; }
                        .next-episode-thumbnail { position: relative; width: 100px; height: 56px; }
                        .next-episode-thumbnail img { width: 100%; height: 100%; border-radius: 8px; object-fit: cover; }
                        .play-overlay {
                            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                            background: rgba(0,0,0,0.3); display: flex; align-items: center;
                            justify-content: center; border-radius: 8px; opacity: 0.8;
                        }
                        .play-overlay svg { width: 24px; height: 24px; fill: white; }
                    `;
    const styleElement = document.createElement('style');
    styleElement.id = 'dynamic-button-styles'; // Add ID for easy removal
    styleElement.type = 'text/css';
    styleElement.appendChild(document.createTextNode(cssRules));
    document.head.appendChild(styleElement);
}
injectDynamicButtonStyles();
function injectEpisodesOverlayStyles() {
    const cssRules = `
                        @keyframes bounce-click {
                            50% {
                                transform: scale(0.97);
                            }
                        }
                        @keyframes audio-wave {
                            0% { transform: scaleY(0.3); }
                            30% { transform: scaleY(1); }
                            60% { transform: scaleY(0.5); }
                            100% { transform: scaleY(0.3); }
                        }
                        .episode-card.bouncing {
                            animation: bounce-click 0.3s ease;
                        }
                        #episodesOverlay {
                            position: absolute;
                            bottom: 0;
                            left: 0;
                            width: 100%;
                            opacity: 0;
                            height: 250px;
                            background: linear-gradient(to top, rgba(0,0,0,0.9) 80%, transparent);
                            z-index: 30;
                            display: flex;
                            flex-direction: column;
                            font-family: 'Inter', sans-serif;
                            transition: opacity 0.3s ease-in-out;
                            overflow: hidden;
                            pointer-events: none;
                        }
                        #episodesOverlay.visible {
                            opacity: 1;
                            pointer-events: auto;
                        }
                        #episodesOverlay.no-transition {
                            transition: none;
                        }
                        #episodesView, #seasonCardOverlay {
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                            padding: 10px;
                            box-sizing: border-box;
                            transition: transform 0.4s ease-in-out;
                        }
                        #episodesView {
                            transform: translateY(0);
                        }
                        #seasonCardOverlay {
                            transform: translateY(100%);
                            background: transparent;
                            z-index: 32;
                        }
                        #episodesOverlay.seasons-active #episodesView {
                            transform: translateY(-100%);
                        }
                        #episodesOverlay.seasons-active #seasonCardOverlay {
                            transform: translateY(0);
                        }
                        .episodes-header, .seasons-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            width: 100%;
                            padding: 0 10px;
                            box-sizing: border-box;
                            flex-shrink: 0;
                            margin-bottom: 10px;
                        }
                        .season-selector-button {
                            background: rgba(170, 170, 170, 0.25);
                            -webkit-backdrop-filter: blur(10px);
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255, 255, 255, 0.2);
                            color: white;
                            padding: 8px 12px;
                            border-radius: 10px;
                            font-size: 0.9rem;
                            font-weight: 600;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        }
                         .season-selector-button svg {
                            transition: transform 0.3s ease-in-out;
                        }
                        .close-episodes-button, .close-seasons-button {
                            background: rgba(170, 170, 170, 0.25);
                            -webkit-backdrop-filter: blur(10px);
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255, 255, 255, 0.2);
                            color: white;
                            font-size: 1.5rem;
                            cursor: pointer;
                            line-height: 1;
                            width: 36px;
                            height: 36px;
                            border-radius: 50%;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                        }
                        #seasonCardList {
                            display: flex;
                            gap: 15px;
                            padding: 10px 0;
                            overflow-x: auto;
                            scroll-behavior: smooth;
                            scrollbar-width: none;
                            width: 100%;
                            justify-content: flex-start;
                            align-items: center;
                            flex-grow: 1;
                        }
                        #seasonCardList::-webkit-scrollbar {
                            display: none;
                        }
                        .season-card {
                            flex-shrink: 0;
                            width: 250px;
                            height: 150px;
                            background-size: cover;
                            background-position: center;
                            border-radius: 8px;
                            position: relative;
                            cursor: pointer;
                            overflow: hidden;
                            border: 0;
                            box-sizing: border-box;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: transform 0.2s;
                            color: white;
                        }
                        .season-card.active {
                            border: 3px solid #1fdf67;
                        }
                        .season-card::after {
                            content: '';
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background: rgba(0,0,0,0.5);
                            transition: background-color 0.2s;
                        }
                        .season-card:hover {
                            transform: scale(1.02);
                        }
                         .season-card.active .season-card-number {
                            color: #1fdf67;
                        }
                        .season-card-number {
                            font-size: 2rem;
                            font-weight: 700;
                            z-index: 2;
                        }
                        .episodes-list-container {
                            flex-grow: 1;
                            display: flex;
                            align-items: center;
                            position: relative;
                            width: 100%;
                            margin-top: 10px;
                        }
                        .episodes-list-inner {
                            width: 100%;
                            overflow: hidden;
                        }
                        #episodesList {
                            display: flex;
                            gap: 15px;
                            padding: 10px 0;
                            overflow-x: auto;
                            scroll-behavior: smooth;
                            scrollbar-width: none;
                        }
                        #episodesList::-webkit-scrollbar {
                            display: none;
                        }
                        .episode-card {
                            flex-shrink: 0;
                            width: 250px;
                            height: 150px;
                            background-size: cover;
                            background-position: center;
                            border-radius: 8px;
                            position: relative;
                            cursor: pointer;
                            overflow: hidden;
                            border: 0;
                            box-sizing: border-box;
                        }
                        .episode-card.active {
                            border: 3px solid #1fdf67;
                        }
                        .episode-card .audio-wave-container {
                            position: absolute;
                            bottom: 12px;
                            right: 12px;
                            display: none;
                            align-items: flex-end;
                            gap: 3px;
                            height: 20px;
                            z-index: 3;
                        }
                        .episode-card.active .audio-wave-container {
                            display: flex;
                        }
                        .audio-wave-bar {
                            width: 4px;
                            height: 100%;
                            background-color: #1fdf67;
                            border-radius: 2px;
                            animation: audio-wave 1.2s infinite ease-in-out;
                        }
                        .audio-wave-bar:nth-child(2) {
                            animation-delay: -0.2s;
                        }
                        .audio-wave-bar:nth-child(3) {
                            animation-delay: -0.4s;
                        }
                        .episode-card::after {
                            content: '';
                            position: absolute;
                            bottom: 0;
                            left: 0;
                            width: 100%;
                            height: 70%;
                            background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
                        }
                        .episode-info {
                            position: absolute;
                            bottom: 8px;
                            left: 8px;
                            color: white;
                            z-index: 2;
                        }
                        .episode-info .season-text {
                            font-size: 0.8rem;
                            font-weight: 500;
                        }
                        .episode-info .episode-number {
                            font-size: 2rem;
                            font-weight: 700;
                            line-height: 1;
                        }
                        .episode-info .title-text {
                            font-size: 0.8rem;
                            font-weight: 500;
                            opacity: 0.9;
                        }
                        .scroll-arrow {
                            position: absolute;
                            top: 50%;
                            transform: translateY(-50%);
                            background: rgba(170, 170, 170, 0.25);
                            -webkit-backdrop-filter: blur(10px);
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255, 255, 255, 0.2);
                            color: white;
                            font-size: 1.5rem;
                            border-radius: 50%;
                            width: 40px;
                            height: 40px;
                            cursor: pointer;
                            z-index: 10;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .scroll-arrow.left { left: -10px; }
                        .scroll-arrow.right { right: -10px; }
                        .lock-icon {
                            position: absolute;
                            top: 8px;
                            right: 8px;
                            width: 24px;
                            height: 24px;
                            z-index: 3;
                        }
                        .lock-icon svg {
                            width: 100%;
                            height: 100%;
                            fill: #fff;
                            filter: drop-shadow(0 0 2px rgba(0,0,0,0.7));
                        }
                        
                    `;
    const styleElement = document.createElement('style');
    styleElement.id = 'episodes-overlay-styles'; // Add ID for easy removal
    styleElement.type = 'text/css';
    styleElement.appendChild(document.createTextNode(cssRules));
    document.head.appendChild(styleElement);
}
injectEpisodesOverlayStyles();
function _m(video, url, art) {
    if (Hls.isSupported()) {
        if (art.hls) art.hls.destroy();
        const hls = new Hls(); hls.loadSource(url); hls.attachMedia(video); art.hls = hls;
        art.on("destroy", () => hls.destroy());
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
    } else {
        art.notice.show = "Unsupported playback format: m3u8";
    }
}
function _x(video, url, art) {
    if (dashjs.supportsMediaSource()) {
        if (art.dash) art.dash.destroy();
        const dash = dashjs.MediaPlayer().create(); dash.initialize(video, url, art.option.autoplay); art.dash = dash;
        art.on("destroy", () => dash.destroy());
    } else {
        art.notice.show = "Unsupported playback format: mpd";
    }
}
// --- Updated initializeApp function ---
async function initializeApp(optionData) {
    // Add cleanup at the very beginning of initialization
    cleanupCompletedMovies();
    window.language = optionData.language;
    window.device = optionData.device;
    languageCode = optionData.language == 'en' ? 'en' : 'rw';
    console.log("Initializing app with device:", optionData.device);
    let isVideoFill = true;

    // --- Updated Initialization Logic ---
    const { episodeId, episodes, deviceType, language, device } = optionData;

    // Store episodes list globally
    episodesList = episodes || [];

    // Find current episode index
    currentEpisodeIndex = episodesList.findIndex(ep => ep.episodeId === episodeId);
    if (currentEpisodeIndex === -1) currentEpisodeIndex = 0;

    // Set current movie data
    let currentMovieData = episodesList[currentEpisodeIndex];
    if (!currentMovieData) {
        console.error("No initial episode data found.");
        document.body.innerHTML = "Error: No episode data provided.";
        return;
    }
    // --- End Updated Initialization Logic ---
    // --- Updated episodesOverlayHtml ---
    const episodesOverlayHtml = `
                <div id="episodesOverlay">
                    <div id="episodesView">
                        <div class="episodes-header">
                            <h3>${languageCode === 'en' ? 'More Downloads' : 'Izindi Filme'}</h3>
                            <button id="closeEpisodesOverlay" class="close-episodes-button">&times;</button>
                        </div>
                        <div class="episodes-list-container">
                            <div class="episodes-list-inner">
                                <div id="episodesList"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
    // --- End Updated episodesOverlayHtml ---

    try {

        const CONTINUE_WATCHING_KEY = 'continuewatching';
        const getContinueWatchingList = () => {
            const savedData = localStorage.getItem(CONTINUE_WATCHING_KEY);
            try {
                const list = savedData ? JSON.parse(savedData) : [];
                return Array.isArray(list) ? list : [];
            } catch (e) {
                return [];
            }
        };

        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        // --- Determine Initial Playback Quality and URL (Now using Original URLs) ---
        const savedUserQuality = "low"; // Get saved preference or null
        //console.log("Saved user quality preference:", savedUserQuality);
        // Use the updated helper function to decide URL, playback quality, and set videoType
        // This will now use the original URLs from currentMovieData.video and set videoType
        const initialPlaybackInfo = determinePlaybackQualityAndUrl(currentMovieData, savedUserQuality);
        if (!initialPlaybackInfo && !currentMovieData.locked) {
            console.error("No valid video sources found for the initial episode.");
            document.body.innerHTML = "Error: No playable video found for this content.";
            return;
        }
        let initialUrl = ''; // This will now be the initial Original URL
        let activeQuality = ''; // This represents the quality actually used for playback
        if (initialPlaybackInfo) {
            initialUrl = initialPlaybackInfo.url; // This is now an Original URL
            activeQuality = initialPlaybackInfo.quality;
            //console.log(`Initial playback set to quality: ${activeQuality}, using Original URL: ${initialUrl}`);
            // videoType is already set by determinePlaybackQualityAndUrl
        } else if (!currentMovieData.locked) {
            // Should ideally not reach here due to earlier check, but safety net.
            console.error("No valid video sources found for the initial episode (fallback).");
            document.body.innerHTML = "Error: No playable video found for this content.";
            return;
        }
        // --- End Initial Playback Quality Selection (No more Blob Conversion) ---
        // Assign the new Artplayer instance to the global variable
        artInstance = new Artplayer({
            container: '.artplayer-app',
            url: initialUrl, // Use the original URL
            poster: currentMovieData.longCover,
            isLive: false, muted: false, autoplay: true, pip: false, autoSize: false, autoMini: true,
            screenshot: false, setting: false, loop: false, autoPlayback: false, autoOrientation: true,
            antiOverlap: true, flip: false, playbackRate: false, aspectRatio: true, miniProgressBar: true,
            backdrop: true, playsInline: true, airplay: false, fullscreenWeb: false, theme: "#1FDF67",
            type: videoType, // Use the global videoType set by determinePlaybackQualityAndUrl
            moreVideoAttr: { "webkit-playsinline": true },
            layers: [
                {
                    name: 'topControls', html: mainTopControlsContainer, style: { position: 'absolute', width: '100%', height: 'auto', pointerEvents: 'auto' },
                    mounted: function (...args) {
                        const backButton = args[0].querySelector('#backButton');
                        backButton.onclick = () => {
                            if (window.device == "web") {
                                const event = new CustomEvent('playerAction', {
                                    detail: {
                                        action: 'backButton',
                                        data: {}
                                    }
                                });
                                document.dispatchEvent(event);
                            } else {
                                window.flutter_inappwebview.callHandler('playerAction', {
                                    action: 'backButton',
                                    data: {}
                                });
                            }
                        };
                    },
                },
                { name: 'playback', html: controlsPlayAndPauseElement, style: { width: '100%', height: '65px', alignSelf: 'center', boxSizing: 'border-box', opacity: "1", transition: "opacity 3s ease-in-out", position: 'absolute', pointerEvents: 'auto', top: '45%' } },
                { name: 'bottomInfo', html: `<div id="bottom-left-info"><div id="season-episode-info"></div><div id="movie-title-display"></div></div><div id="more-episodes-container"></div>`, style: { position: 'absolute', inset: '0', pointerEvents: 'none' } },
                { name: 'episodes', html: episodesOverlayHtml, style: { display: 'none', position: 'absolute', width: '100%', height: '250px', bottom: '0px', overflowY: 'hidden' } },

            ],
            controls: [
                { name: 'currentTime', position: 'left', html: '00:00:00', style: { color: 'white', fontFamily: 'system-ui', fontSize: '1rem', paddingLeft: '10px' } },
                { name: 'totalTime', position: 'right', html: '00:00:00', style: { color: 'white', fontFamily: 'system-ui', fontSize: '1rem', paddingRight: '10px' } },
            ],
            plugins: [],
            customType: { m3u8: _m, mpd: _x }
        });
        // Use `artInstance` from now on
        const art = artInstance;
        art.video.style.width = '100%';
        art.video.style.objectPosition = 'center';
        art.on('ready', () => {

            art.aspectRatio = '16:9';
            // --- Touch Swipe Logic for Episodes Overlay ---
            // 1. Get the relevant DOM elements
            const episodesLayer = document.querySelector('.art-layer-episodes'); // Assuming this holds the overlay
            const episodesOverlay = episodesLayer ? episodesLayer.querySelector('#episodesOverlay') : null;
            // Add event listener to the document
            document.addEventListener('keydown', handleKeyPress);
            // --- DOM Element References from art.layers ---
            const actionButtonsContainer = art.layers.topControls.querySelector('#actionButtonContainer');
            const qualityControlContainer = art.layers.topControls.querySelector('#qualityControl');
            const rewindButton = art.layers.playback.querySelector('#rewindButton');
            const forwardButton = art.layers.playback.querySelector('#forwardButton');
            const playPauseButton = art.layers.playback.querySelector('#playPauseButton');
            const volumeButton = art.layers.topControls.querySelector('#volumeButton');
            const fullscreenButton = art.layers.topControls.querySelector('#fullscreenButton');
            const mainControlsContainer = art.layers.topControls.querySelector('#mainControlsContainer');
            const playbackControlsContainer = art.layers.playback.querySelector('#playbackControlsContainer');
            const bottomLeftInfo = art.layers.bottomInfo.querySelector('#bottom-left-info');
            const moreEpisodesContainer = art.layers.bottomInfo.querySelector('#more-episodes-container');
            const artBottom = document.querySelector('.art-bottom');
            const progressBar = document.querySelector('.art-control.art-control-progress');
            const progressBarInner = document.querySelector('.art-control-progress-inner');
            const centerControls = document.querySelector('.art-controls');
            const currentTimeDisplay = art.controls.currentTime;
            const totalTimeDisplay = art.controls.totalTime;
            let videoPlayedOnce = false; // Track if the video is played for once
            // --- Helper Functions ---
            const formatTime = (seconds) => new Date(seconds * 1000).toISOString().substr(11, 8);
            const animateAndRemove = (element) => {
                if (element && !element.classList.contains('animate-out')) {
                    element.classList.add('animate-out');
                    element.addEventListener('animationend', () => element.remove(), { once: true });
                }
            };
            // --- UI Update Functions ---
            const updateUIForNewEpisode = () => {
                const seasonEpInfoEl = art.layers.bottomInfo.querySelector('#season-episode-info');
                const movieTitleEl = art.layers.bottomInfo.querySelector('#movie-title-display');
                // --- Updated UI for Episode Info ---
                // Assuming currentMovieData now reflects the current episode from episodesList
                if (currentMovieData.type === 'M') { // If it's somehow a movie passed in the list
                    if (seasonEpInfoEl) {
                        seasonEpInfoEl.textContent = `Filme`;
                        seasonEpInfoEl.style.display = 'block';
                    }
                } else { // It's an episode
                    // Simplified display, no season index assumed in data structure
                    if (seasonEpInfoEl) {
                        // Fallback to index + 1 if episode number not present
                        const epNumber = currentMovieData.episode || (currentEpisodeIndex + 1);
                        seasonEpInfoEl.textContent = `Season 0${currentMovieData.position.seasonIndex + 1}, EP ${epNumber}${currentMovieData.partName || ''}`;
                        seasonEpInfoEl.style.display = 'block';
                    }
                }
                // --- End Updated UI for Episode Info ---
                if (movieTitleEl) movieTitleEl.textContent = currentMovieData.title;
                art.poster = currentMovieData.longCover;
            };
            const showSkipIntroButton = () => {
                const introEndTime = parseInt(currentMovieData.time.startTime, 10);
                if (actionButtonsContainer.querySelector('#skipIntroBtn') || !introEndTime || art.currentTime >= introEndTime) return;
                const wrapper = document.createElement('div');
                wrapper.id = 'skipIntroBtn';
                wrapper.className = 'action-button-wrapper';
                wrapper.innerHTML = `<button class="dynamic-action-button"><span>${languageCode != "en" ? "Taruka Indirimbo" : "Skip Intro"}</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg></button>`;
                wrapper.querySelector('button').onclick = () => { art.seek = introEndTime; art.play(); animateAndRemove(wrapper); };
                actionButtonsContainer.innerHTML = '';
                actionButtonsContainer.appendChild(wrapper);
            };
            const showContinueWatchingButton = () => {
                const continueTime = currentMovieData.continueWatching.inMinutes;
                if (actionButtonsContainer.querySelector('#continueWatchingContainer') || !continueTime) return;
                const wrapper = document.createElement('div');
                wrapper.id = 'continueWatchingContainer';
                wrapper.className = 'action-button-wrapper';
                function formatTime(seconds) {
                    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
                    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
                    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
                    return `${hrs}:${mins}:${secs}`;
                }
                const timeString = formatTime(currentMovieData.continueWatching.inMinutes);
                wrapper.innerHTML = `
                                <button class="dynamic-action-button">${languageCode != "en" ? "Komeza uhereye" : "Continue from -"} ${timeString}</button>
                            `;
                wrapper.querySelector('.dynamic-action-button').onclick = () => { art.seek = continueTime; art.play(); animateAndRemove(wrapper); };
                actionButtonsContainer.innerHTML = '';
                actionButtonsContainer.appendChild(wrapper);
            };
            // --- Episodes Overlay Setup ---
            const setupEpisodesOverlay = (ed) => {
                const artBottom = document.querySelector('.art-bottom');
                const closeEpisodesBtn = episodesLayer.querySelector('#closeEpisodesOverlay');
                const episodesListContainer = episodesLayer.querySelector('#episodesList'); // Updated selector

                hideOverlay = (ed) => {
                    ed.preventDefault();
                    ed.stopPropagation();
                    if (episodesOverlay) {
                        // --- Use Opacity for Fade Out ---
                        if (artBottom) artBottom.style.display = 'flex'; // Show art bottom if hidden
                        episodesOverlay.classList.remove('no-transition');
                        episodesOverlay.classList.remove('visible');
                        episodesOverlay.style.opacity = '0';
                        episodesOverlay.style.pointerEvents = 'none';
                        // Delay hiding the layer to let the transition finish (match CSS duration)
                        setTimeout(() => {
                            if (
                                episodesOverlay &&
                                episodesLayer &&
                                parseFloat(window.getComputedStyle(episodesOverlay).opacity) <= 0.1
                            ) {
                                episodesOverlay.style.display = 'none';
                                episodesLayer.style.display = 'none';
                                if (artBottom) artBottom.style.display = 'flex';
                            }
                        }, 300); // Match CSS transition duration
                    }
                };
                // --- Updated Episode Population ---
                const populateEpisodes = () => {
                    if (!episodesListContainer) return;

                    episodesListContainer.innerHTML = '';
                    episodesList.forEach((ep, index) => {
                        const card = document.createElement('div');
                        card.className = 'episode-card';
                        card.style.backgroundImage = `url(${ep.longCover})`;
                        if (index === currentEpisodeIndex) {
                            card.classList.add('active');
                        }
                        if (ep.locked) {
                            card.classList.add('locked');
                            card.innerHTML += `<div class="lock-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg></div>`;
                        }
                        // Simplified episode info display
                        const epNumber = ep.episode || (index + 1);
                        card.innerHTML += `<div class="episode-info"><div class="episode-number">${epNumber}${ep.partName || ''}</div><div class="title-text">${ep.title}</div></div><div class="audio-wave-container"><div class="audio-wave-bar"></div><div class="audio-wave-bar"></div><div class="audio-wave-bar"></div></div>`;
                        card.addEventListener('click', (e) => {
                            if (card.classList.contains('locked')) {
                                // showLockOverlay(); // Removed function call
                                return; // Do nothing or handle differently if needed
                            }
                            card.classList.add('bouncing');
                            card.addEventListener('animationend', () => card.classList.remove('bouncing'), { once: true });
                            closeEpisodesBtn.addEventListener('click', hideOverlay);
                            closeEpisodesBtn.dataset.listenerAttached = 'true';
                            // Use the new switch function
                            switchToEpisode(ep, index); // Pass episode object and its index
                            hideOverlay(e);
                        });
                        episodesListContainer.appendChild(card);
                    });
                };
                // --- End Updated Episode Population ---

                if (closeEpisodesBtn) {
                    const handleCloseClickEpisodes = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // console.log("Close Episodes Button Clicked - Animating Out");
                        // Animate the overlay OUT (swipe down)
                        hideOverlay(e); // Use the hideOverlay function to handle the animation
                    };
                    closeEpisodesBtn.removeEventListener('click', handleCloseClickEpisodes);
                    closeEpisodesBtn.addEventListener('click', handleCloseClickEpisodes);
                    // delete closeEpisodesBtn.dataset.listenerAttached;
                }

                populateEpisodes(); // Call updated populateEpisodes
                if (artBottom) artBottom.style.display = 'none';

                function handleMoreEpisodesClick(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (episodesLayer && episodesOverlay) {
                        // Ensure the layer and overlay are visible (flex display)
                        episodesLayer.style.display = 'flex';
                        episodesOverlay.style.display = 'flex'; // Or 'block', ensure it's not 'none'
                        episodesOverlay.classList.add('visible'); // Add class if needed for state
                        // --- Use Opacity for Fade In ---
                        // Ensure transition is enabled (check CSS)
                        episodesOverlay.classList.remove('no-transition');
                        // Set initial state for fade in (if not already set by CSS)
                        episodesOverlay.style.opacity = '0';
                        episodesOverlay.style.pointerEvents = 'auto'; // Make it interactive
                        // Trigger reflow to ensure initial state is applied before transition
                        // eslint-disable-next-line no-unused-vars
                        const _ = episodesOverlay.offsetHeight;
                        // Apply final state for fade in
                        episodesOverlay.style.opacity = '1';
                        // Optional: Scroll active card into view after fade-in (adjust delay if needed)
                        setTimeout(() => {
                            const activeCard = episodesOverlay.querySelector('#episodesList .episode-card.active');
                            if (activeCard) {
                                activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }, 300); // Match CSS transition duration or adjust
                    }
                }
                handleMoreEpisodesClick(ed);
            };
            // --- New Helper Functions for Next Episode Card and Switching ---
            /**
             * @function updateNextEpisodeCard
             * @description Updates or creates the next episode card based on the current state.
             *              If showNext is true and there's a next episode, it displays the "Next Episode" card with countdown.
             *              If showNext is false, it shows the standard "More Episodes" card.
             *              If there's no next episode or it's not a series, it hides the container.
             * @param {boolean} showNext - Flag indicating whether to show the next episode card or the more episodes card.
             */
            function updateNextEpisodeCard(showNext = false) {
                const moreEpisodesContainer = art.layers.bottomInfo.querySelector('#more-episodes-container');
                if (!moreEpisodesContainer) return;
                // Clear any existing content and timers
                moreEpisodesContainer.innerHTML = '';
                if (window.nextEpisodeCountdownTimer) {
                    clearInterval(window.nextEpisodeCountdownTimer);
                    window.nextEpisodeCountdownTimer = null;
                }
                if (window.nextEpisodeBorderAnimation) {
                    cancelAnimationFrame(window.nextEpisodeBorderAnimation);
                    window.nextEpisodeBorderAnimation = null;
                }
                // Reset any previous border animation styles
                const existingCard = moreEpisodesContainer.querySelector('#more-episodes-card');
                if (existingCard) {
                    existingCard.style.borderRadius = '12px'; // Reset if needed
                    existingCard.style.borderImage = '';
                    existingCard.style.borderImageSlice = '';
                    existingCard.style.borderImageWidth = '';
                    existingCard.style.borderImageRepeat = '';
                    existingCard.style.borderImageSource = '';
                    existingCard.style.border = '1px solid rgba(255, 255, 255, 0.1)'; // Reset to CSS default or initial
                }
                // --- Updated Next Episode Logic ---
                // Check if it's a series (list provided) and has more episodes
                const hasNextEpisode = episodesList.length > 0 && currentEpisodeIndex < episodesList.length - 1;
                let nextEpisodeData = null;
                if (hasNextEpisode) {
                    nextEpisodeData = episodesList[currentEpisodeIndex + 1];
                }
                // --- End Updated Next Episode Logic ---

                if (showNext && nextEpisodeData) {
                    // --- Show Next Episode Card with Countdown ---
                    let countdownValue = 5; // Start countdown from 5
                    const borderDuration = 5000; // 5 seconds in ms
                    const startTime = performance.now();
                    const cardId = 'next-episode-card'; // Use a different ID for clarity if needed
                    // Simplified episode display
                    const epNumber = nextEpisodeData.episode || (currentEpisodeIndex + 2);
                    const episodeDisplay = `EP ${epNumber}${nextEpisodeData.partName || ''}`;
                    moreEpisodesContainer.innerHTML = `
                        <div id="more-episodes-card">
                            <div class="next-episode-text">
                                <h3>${languageCode != "en" ? "Izindi" : "Next"}</h3>
                                <p>${episodeDisplay}</p>
                            </div>
                            <div class="next-episode-thumbnail">
                                <img src="${nextEpisodeData.image}" onerror="this.style.display='none'" alt="Next Episode">
                                <div class="play-overlay">
                                    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                </div>
                            </div>
                        </div>
                    `; // Reuse the same ID/class structure for styling
                    const nextEpisodeCard = moreEpisodesContainer.querySelector('#more-episodes-card');
                    if (nextEpisodeCard) {
                        // Ensure it's visible
                        moreEpisodesContainer.style.display = 'block';
                        // --- Countdown Timer Logic ---
                        const pElement = nextEpisodeCard.querySelector('.next-episode-text p');
                        if (pElement) {
                            pElement.textContent = `${episodeDisplay} | ${countdownValue}s`;
                        }
                        window.nextEpisodeCountdownTimer = setInterval(() => {
                            countdownValue--;
                            if (pElement) {
                                pElement.textContent = `${episodeDisplay} | ${countdownValue}s`;
                            }
                            if (countdownValue <= 0) {
                                clearInterval(window.nextEpisodeCountdownTimer);
                                window.nextEpisodeCountdownTimer = null;
                                // Trigger episode switch when countdown finishes
                                if (nextEpisodeData && nextEpisodeData.locked) {
                                    // showLockOverlay(); // Removed function call
                                    return; // Do nothing or handle differently if needed
                                }
                                switchToEpisode(nextEpisodeData, currentEpisodeIndex + 1); // Switch to next
                            }
                        }, 1000);
                        // --- Animated Border Logic ---
                        function animateBorder(timestamp) {
                            if (!startTime) startTime = timestamp;
                            const elapsed = timestamp - startTime;
                            const progress = Math.min(elapsed / borderDuration, 1);
                            const angle = 360 * progress;
                            // Update the border using conic-gradient
                            if (nextEpisodeCard) {
                                const gradient = `conic-gradient(#1fdf67 ${angle}deg, rgba(255, 255, 255, 0.1) ${angle}deg 359.9deg)`;
                                nextEpisodeCard.style.borderImage = gradient;
                                nextEpisodeCard.style.borderImageSlice = '1';
                                nextEpisodeCard.style.borderImageWidth = '2px'; // Adjust width
                                nextEpisodeCard.style.borderImageRepeat = 'stretch';
                                // Ensure original border is effectively removed by border-image
                                nextEpisodeCard.style.border = 'none';
                            }
                            if (progress < 1 && window.nextEpisodeCountdownTimer !== null) { // Continue animation if timer is still running
                                window.nextEpisodeBorderAnimation = requestAnimationFrame(animateBorder);
                            } else if (window.nextEpisodeCountdownTimer === null) {
                                // Countdown finished, ensure final state
                                if (nextEpisodeCard) {
                                    nextEpisodeCard.style.borderImage = `conic-gradient(#1fdf67 359.9deg, rgba(255, 255, 255, 0.1) 359.9deg)`;
                                }
                            }
                        }
                        window.nextEpisodeBorderAnimation = requestAnimationFrame(animateBorder);
                        // --- Click Handler for Manual Switch ---
                        nextEpisodeCard.addEventListener('click', () => {
                            // Clear timer and animation if clicked
                            if (window.nextEpisodeCountdownTimer) {
                                clearInterval(window.nextEpisodeCountdownTimer);
                                window.nextEpisodeCountdownTimer = null;
                            }
                            if (window.nextEpisodeBorderAnimation) {
                                cancelAnimationFrame(window.nextEpisodeBorderAnimation);
                                window.nextEpisodeBorderAnimation = null;
                            }
                            switchToEpisode(nextEpisodeData, currentEpisodeIndex + 1); // Switch to next
                        });
                    } else {
                        moreEpisodesContainer.style.display = 'none'; // Hide if card creation failed
                    }
                } else if (!showNext) {
                    // --- Show Standard "More Episodes" Card ---
                    // Only show if there are *other* episodes in the list
                    if (hasNextEpisode || currentEpisodeIndex > 0) {
                        moreEpisodesContainer.innerHTML = `
                            <div id="more-episodes-card">
                                <div class="next-episode-text">
                                    <h3>${languageCode != "en" ? "Izindi" : "More"}</h3>
                                    <p>${languageCode != "en" ? "Filme" : "Videos"}</p>
                                </div>
                                <div class="next-episode-thumbnail">
                                    <img src="${currentMovieData.image}" onerror="this.style.display='none'" alt="Current Episode">
                                    <div class="play-overlay">
                                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                    </div>
                                </div>
                            </div>
                        `;
                        const moreEpisodesCard = moreEpisodesContainer.querySelector('#more-episodes-card');
                        if (moreEpisodesCard) {
                            moreEpisodesCard.removeEventListener('click', setupEpisodesOverlay);
                            moreEpisodesCard.addEventListener('click', setupEpisodesOverlay);
                        }
                    } else {
                        moreEpisodesContainer.style.display = 'none'; // Hide if no other episodes
                    }
                } else {
                    // showNext is true but no nextEpisodeData -> Hide
                    moreEpisodesContainer.style.display = 'none';
                }
            }
            /**
             * @function switchToEpisode
             * @description Handles the logic for switching to a new episode.
             * @param {Object} ep - The episode data object to switch to.
             * @param {number} index - The index of the episode in the episodesList.
             */
            // async function switchToEpisode(ep) { // Remove async if no longer awaiting blob conversion
            function switchToEpisode(ep, index) {
                if (!ep || index === undefined || index < 0 || index >= episodesList.length) {
                    console.error("Invalid episode or index for switchToEpisode");
                    return;
                }
                // --- Reset Ad Tracking Flags for New Episode ---
                preAdShown = false;
                midAdShown = false;
                postAdShown = false;
                // Reset new ad region tracking variables
                currentAdRegion = null;
                pendingAdType = null;
                // --- End Reset Ad Tracking Flags ---
                // --- Clear any active timers related to ads for the previous episode ---
                if (window.adCountdownInterval) {
                    clearInterval(window.adCountdownInterval);
                    window.adCountdownInterval = null;
                }
                // --- End Clear Timers ---
                // --- Blob Cleanup for Previous Episode (Optional Cleanup) ---
                // Clear any active timers/borders related to the *previous* next episode card
                if (window.nextEpisodeCountdownTimer) {
                    clearInterval(window.nextEpisodeCountdownTimer);
                    window.nextEpisodeCountdownTimer = null;
                }
                if (window.nextEpisodeBorderAnimation) {
                    cancelAnimationFrame(window.nextEpisodeBorderAnimation);
                    window.nextEpisodeBorderAnimation = null;
                }
                // --- End Blob Cleanup (No more revoking needed) ---
                // --- Update Current Movie Data and Index ---
                currentMovieData = ep;
                currentEpisodeIndex = index;
                // --- End Update Current Movie Data ---
                // --- Determine Playback Quality and URL (Now using Original URLs) ---
                const savedUserQualityForSwitch = "low";
                //console.log("Saved user quality preference for episode switch:", savedUserQualityForSwitch);
                // determinePlaybackQualityAndUrl now uses the original URLs in currentMovieData.video
                // and sets the global videoType
                const switchPlaybackInfo = determinePlaybackQualityAndUrl(currentMovieData, savedUserQualityForSwitch);
                let newUrl = ''; // This should now be an Original URL
                activeQuality = ''; // Reset active quality tracker
                if (switchPlaybackInfo) {
                    newUrl = switchPlaybackInfo.url; // This is now an Original URL from currentMovieData.video
                    activeQuality = switchPlaybackInfo.quality;
                    //console.log(`Switching to episode with playback quality: ${activeQuality}, using Original URL: ${newUrl}`);
                    // videoType is already set by determinePlaybackQualityAndUrl
                } else if (!ep.locked) {
                    console.error("No valid URL for the selected episode.");
                    art.notice.show = "Error: No playable video found for the selected episode.";
                    return;
                }
                // --- End Playback Quality Selection (No more Blob Conversion) ---
                if (newUrl) {
                    // Use the original URL directly
                    art.switchUrl(newUrl, currentMovieData.title).then(() => {
                        // if (art.loading) art.loading.show = false; // Hide loading indicator
                        art.play();
                        updateUIForNewEpisode();
                        actionButtonsContainer.innerHTML = '';
                        // Reset the flag for showing the next episode card for the *new* episode
                        window.nextEpisodeCardShown = false;
                        // Show appropriate initial button for the new episode
                        if (currentMovieData.continueWatching.inMinutes > 0) showContinueWatchingButton();
                        else if (parseInt(currentMovieData.time.startTime, 10) > 0) showSkipIntroButton();
                        // Update the next episode card (now for the *new* current episode)
                        updateNextEpisodeCard(false); // Show standard card for the new episode
                    }).catch(err => {
                        // if (art.loading) art.loading.show = false; // Hide loading indicator
                        console.error("Failed to switch to new episode URL (Original):", err);
                        art.notice.show = "Failed to load the selected episode.";
                    });
                } else if (ep.locked) {
                    // showLockOverlay(); // Removed function call
                } else {
                    console.error("No valid Original URL for this episode (should have been caught earlier)");
                }
            }
            // --- Initial UI Setup ---
            if (artBottom) window.innerWidth >= 750 ? artBottom.style.padding = '30px 50px 30px' : artBottom.style.padding = '10px 20px 10px';
            if (progressBar) progressBar.style.height = '5px';
            if (progressBarInner) progressBarInner.style.backgroundColor = '#393939';
            if (centerControls) centerControls.style.paddingBottom = '20px';
            updateUIForNewEpisode();
            if (currentMovieData.continueWatching.inMinutes > 0) showContinueWatchingButton();
            else if (parseInt(currentMovieData.time.startTime, 10) > 0) showSkipIntroButton();
            // --- Modify the Initial Setup Section ---
            // Call the new function to set up the initial card
            updateNextEpisodeCard(false); // Initially show the standard card if applicable
            // --- Layout and Resize Handlers ---
            const syncWidths = () => { if (qualityControlContainer && actionButtonsContainer) { const qualityWidth = qualityControlContainer.offsetWidth; actionButtonsContainer.style.width = `${qualityWidth}px`; } };
            const updateActionButtonPosition = () => { if (actionButtonsContainer) { if (window.innerWidth > 480) { actionButtonsContainer.style.position = 'relative'; actionButtonsContainer.style.right = '33px'; } else { actionButtonsContainer.style.position = 'static'; actionButtonsContainer.style.right = 'auto'; } } };
            syncWidths();
            updateActionButtonPosition();
            // Assign instances and handlers to global variables for cleanup
            resizeObserverInstance = new ResizeObserver(syncWidths);
            if (qualityControlContainer) resizeObserverInstance.observe(qualityControlContainer);
            resizeHandler = updateActionButtonPosition;
            window.addEventListener('resize', resizeHandler);
            // --- End Ad Plugin Event Listeners ---
            // --- Event Listeners for Main Controls ---
            if (rewindButton) rewindButton.addEventListener('click', () => { art.seek = art.currentTime - 30; });
            if (forwardButton) forwardButton.addEventListener('click', () => { art.seek = art.currentTime + 30; });
            if (playPauseButton) playPauseButton.addEventListener('click', () => art.toggle());
            if (fullscreenButton) fullscreenButton.addEventListener('click', () => {
                art.video.style.height = '';
                // Apply styles via JS
                if (fullscreenButton) {
                    const fsIcon = fullscreenButton.querySelector('svg path');
                    const enterFsIcon = "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z";
                    const exitFsIcon = "M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z";

                    if (isVideoFill) {
                        art.video.style.objectFit = 'cover';
                        fsIcon.setAttribute('d', exitFsIcon);
                        isVideoFill = false;
                    } else {
                        art.video.style.objectFit = 'contain';
                        fsIcon.setAttribute('d', enterFsIcon);
                        isVideoFill = true;
                    }
                }

            });
            if (volumeButton) {
                const volumeIconPathEl = volumeButton.querySelector('svg path');
                const volumeOnIconPath = "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z";
                const volumeOffIconPath = "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z";
                volumeButton.addEventListener('click', () => { art.muted = !art.muted; });
                art.on('volume', (v) => {
                    const isMuted = art.muted || v === 0;
                    volumeIconPathEl.setAttribute('d', isMuted ? volumeOffIconPath : volumeOnIconPath);
                });
            }
            // --- Quality Control Removal ---

            // --- ArtPlayer Event Hooks ---
            art.on('play', () => {
                if (playPauseButton) playPauseButton.querySelector('svg path').setAttribute('d', "M6 19h4V5H6v14zm8-14v14h4V5h-4z");
            });
            art.on('pause', () => {
                //isPlaying = false; // Set the flag to false when the video is paused
                setTimeout(function () {
                    if (playPauseButton) playPauseButton.querySelector('svg path').setAttribute('d', "M8 5v14l11-7z");
                }, 100);
            });
            art.on('control', state => {

                mainControlsContainer.classList.toggle('hidden', !state);
                playbackControlsContainer.classList.toggle('hidden', !state);
                bottomLeftInfo.classList.toggle('hidden', !state);
                moreEpisodesContainer.classList.toggle('hidden', !state);
                if (state) {
                    if (artBottom) window.innerWidth >= 750 ? artBottom.style.padding = '30px 50px 30px' : artBottom.style.padding = '10px 20px 10px';
                } else {
                    if (artBottom) artBottom.style.padding = '0px 0px 0px'; // Adjust padding when controls are hidden
                }
            });
            art.on('fullscreen', (isFull) => {
                if (fullscreenButton) {
                    const fsIcon = fullscreenButton.querySelector('svg path');
                    const enterFsIcon = "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z";
                    const exitFsIcon = "M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z";
                    fsIcon.setAttribute('d', isFull ? exitFsIcon : enterFsIcon);
                }
            });
            let lastSaveTime = 0;
            let movieRemoved = false;

            art.on('video:timeupdate', () => {
                // Update time displays
                if (currentTimeDisplay) {
                    currentTimeDisplay.innerHTML = formatTime(art.currentTime);
                }
                if (totalTimeDisplay && art.duration) {
                    totalTimeDisplay.innerHTML = formatTime(art.duration);
                }
                if (videoPlayedOnce === false) {
                    videoPlayedOnce = true; // Set the flag to true after the first play
                    if (playPauseButton) playPauseButton.querySelector('svg path').setAttribute('d', "M6 19h4V5H6v14zm8-14v14h4V5h-4z");
                }
            });
            // --- End Modified art.on('video:timeupdate') ---

            // --- Add this block for handling video end ---
            // This will trigger if there's no endTime or if the user watches past the endTime
            art.on('video:ended', () => {
                // console.log("Video ended.");
                // --- Handle postLoll on video end ---
                if (currentMovieData.adstatus === true && !postAdShown) {
                    // console.log("Video ended, triggering postLoll ad");
                    postAdShown = true;
                }
                // --- End postLoll Handling ---
                updateNextEpisodeCard(true); // Show the next episode card with countdown
                window.nextEpisodeCardShown = true; // Set flag so it doesn't trigger repeatedly
            });
        });
    } catch (error) {
        const event = new CustomEvent('playerAction', {
            detail: {
                action: 'backButton',
                data: {}
            }
        });
        console.error('Failed to initialize player:', error);
    }
}
// Example of how to start the application
//initializeApp();
// destroyApp();
// --- Example of how to start the application (Updated) ---
// This is just an example structure for `optionData`.
// You would provide the actual `episodeId` and `episodes` array.

initializeApp({
    "episodeId": "$widget.episodeId",
    "episodes": JSON.parse("$escapedEpisodesJson"),
    "userId": "1441537e-ef35-4ca8-b9df-6ddbd7b5678c",
    "deviceType": "IOS",
    "language": "en", // or "rn"
    "device": "web", // or "mobile"
});
// destroyApp();



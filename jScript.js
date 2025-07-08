    // --- Global variables to hold instances for cleanup ---
        let artInstance = null;
        let resizeObserverInstance = null;
        let resizeHandler = null;

        /**
         * @function destroyApp
         * @description Destroys the ArtPlayer instance, removes dynamically added styles,
         * and cleans up event listeners to prevent memory leaks and element duplication
         * when re-initializing the player.
         */
        function destroyApp() {
            console.log("Destroying existing player instance if it exists...");

            // 1. Destroy the ArtPlayer instance if it exists
            if (artInstance) {
                try {
                    // The `true` argument also removes the player's root element from the DOM
                    artInstance.destroy(true);
                    artInstance = null;
                    console.log("ArtPlayer instance destroyed.");
                } catch (e) {
                    console.error("Error destroying ArtPlayer instance:", e);
                }
            }

            // 2. Disconnect the ResizeObserver to stop watching for element resizes
            if (resizeObserverInstance) {
                resizeObserverInstance.disconnect();
                resizeObserverInstance = null;
                console.log("ResizeObserver disconnected.");
            }

            // 3. Remove the window resize event listener
            if (resizeHandler) {
                window.removeEventListener('resize', resizeHandler);
                resizeHandler = null;
                console.log("Window resize listener removed.");
            }

            // 4. Remove injected CSS <style> elements by their unique IDs
            const styleIds = [
                'component-styles',
                'playback-styles',
                'dynamic-button-styles',
                'episodes-overlay-styles'
            ];
            styleIds.forEach(id => {
                const styleElement = document.getElementById(id);
                if (styleElement) {
                    styleElement.parentNode.removeChild(styleElement);
                    console.log(`Removed style element: #${id}`);
                }
            });

            // 5. Ensure the main player container is empty for the next initialization
            const playerContainer = document.querySelector('.artplayer-app');
            if (playerContainer) {
                playerContainer.innerHTML = '';
            }

            console.log("Cleanup complete. Ready for re-initialization.");
        }


        Artplayer.NOTICE_TIME = 5000;
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
                        <div class="segmented-control-container" id="qualityControl">
                           <button class="segment-button" id="hdButton" data-value="hd">
                                <span class="quality-label">HD</span>
                                <span class="quality-size" id="hdSize"></span>
                            </button>
                           <button class="segment-button" id="midButton" data-value="mid">
                                <span class="quality-label">MID</span>
                                <span class="quality-size" id="midSize"></span>
                            </button>
                           <button class="segment-button" id="lowButton" data-value="low">
                                <span class="quality-label">LOW</span>
                                <span class="quality-size" id="lowSize"></span>
                            </button>
                        </div>
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
                    <div class="action-button-container" id="actionButtonContainer"></div>
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
                            padding: 20px 10px 10px;
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
                            bottom: 90px;
                            left: 20px;
                            z-index: 25;
                            pointer-events: none;
                            width: 350px;
                        }
                        #season-episode-info {
                            font-size: 1.1rem;
                            font-weight: 500;
                            color: #E5E7EB;
                            text-shadow: 1px 1px 4px rgba(0,0,0,0.6);
                        }
                        #movie-title-display {
                            font-size: 2.5rem;
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
                            padding: 10px;
                            bottom: 80px;
                        }
                        #more-episodes-card {
                            cursor: pointer;
                            pointer-events: auto;
                            background: rgba(40, 40, 40, 0.7);
                            -webkit-backdrop-filter: blur(10px);
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            border-radius: 12px;
                            padding: 10px;
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            transition: all 0.2s ease;
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
                            height: 250px; 
                            background: linear-gradient(to top, rgba(0,0,0,0.9) 80%, transparent);
                            z-index: 30;
                            display: flex;
                            flex-direction: column;
                            font-family: 'Inter', sans-serif;
                            transform: translateY(100%);
                            transition: transform 0.4s ease-in-out;
                            overflow: hidden;
                        }
                        #episodesOverlay.visible {
                            transform: translateY(0);
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
                        .art-layer-lock {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                        }
                        #lockOverlayContent {
                            font-family: 'Inter', sans-serif;
                            color: white;
                            text-align: center;
                            max-width: 450px;
                            padding: 20px;
                        }
                        #lockOverlayContent h2 {
                            font-size: 1.8rem;
                            font-weight: 700;
                            color: #1fdf67;
                        }
                        #lockOverlayContent p {
                            font-size: 1rem;
                            margin: 15px 0 25px;
                            line-height: 1.5;
                        }
                        .lock-overlay-buttons {
                            display: flex;
                            gap: 15px;
                            justify-content: center;
                        }
                        .lock-overlay-buttons button {
                            font-family: 'Inter', sans-serif;
                            font-size: 1rem;
                            font-weight: 600;
                            padding: 12px 24px;
                            border-radius: 8px;
                            border: none;
                            cursor: pointer;
                            transition: background-color 0.2s;
                        }
                        #subscribeButton {
                            background-color: #1fdf67;
                            color: black;
                        }
                        #subscribeButton:hover {
                            background-color: #1bbf57;
                        }
                        #helpButton {
                            background-color: #fff;
                            color: black;
                        }
                        #helpButton:hover {
                            background-color: #e0e0e0;
                        }
                    `;
            const styleElement = document.createElement('style');
            styleElement.id = 'episodes-overlay-styles'; // Add ID for easy removal
            styleElement.type = 'text/css';
            styleElement.appendChild(document.createTextNode(cssRules));
            document.head.appendChild(styleElement);
        }
        injectEpisodesOverlayStyles();

        let allLolls = ["https://video.wixstatic.com/video/d7f9fb_e09d55d52f0e427c9891189606b4925b/1080p/mp4/file.mp4", "https://video.wixstatic.com/video/d7f9fb_fbbc3d184a5c4ff284da54cb2e72c453/1080p/mp4/file.mp4", "https://video.wixstatic.com/video/d7f9fb_08949df5483a4b1dbe9d36d7451994e9/1080p/mp4/file.mp4"];

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

        async function initializeApp(optionData) {

            const episodesOverlayHtml = `
                <div id="episodesOverlay">
                    <div id="episodesView">
                        <div class="episodes-header">
                            <button id="openSeasonsButton" class="season-selector-button">
                                <span>${optionData.language != "en" ? "Hitamo Season" : "Choose Season"}</span>
                                <svg class="arrow-down" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </button>
                            <button id="closeEpisodesOverlay" class="close-episodes-button">&times;</button>
                        </div>
                        <div class="episodes-list-container">
                            <button class="scroll-arrow left" id="scrollLeft">&lt;</button>
                            <div class="episodes-list-inner">
                                <div id="episodesList"></div>
                            </div>
                            <button class="scroll-arrow right" id="scrollRight">&gt;</button>
                        </div>
                    </div>
                    <div id="seasonCardOverlay">
                         <div class="seasons-header">
                            <button id="backToEpisodesButton" class="season-selector-button">
                                 <svg class="arrow-up" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                                <span>${optionData.language != "en" ? "Hitamo Episode" : "Choose Episode"}</span>
                            </button>
                            <button id="closeSeasonsOverlay" class="close-episodes-button">&times;</button>
                        </div>
                        <div class="episodes-list-container">
                            <button class="scroll-arrow left" id="seasonScrollLeft">&lt;</button>
                            <div class="episodes-list-inner">
                                <div id="seasonCardList"></div>
                            </div>
                            <button class="scroll-arrow right" id="seasonScrollRight">&gt;</button>
                        </div>
                    </div>
                </div>
            `;

            const lockOverlayHtml = `
                <div id="lockOverlayContent">
                    <h2>${optionData.language != "en" ? "NTA FATABUGUZI MUFITE!" : "YOU DON'T HAVE A SUBSCRIPTION !"}</h2>
                    <p>${optionData.language != "en" ? "Mukunzi wa rebamovie nta fatabuguzi mufitemo niba warurifite ukaba utarihawe, TWANDIKIRE cg urigure." : "Hello, rebamovie fan you don't currently own  a subscription , consult SUPPORT , or buy a new one."}</p>
                    <div class="lock-overlay-buttons">
                        <button id="subscribeButton">${optionData.language != "en" ? "Gura ifatabuguzi" : "Get Subscription"}</button>
                        <button id="helpButton">${optionData.language != "en" ? "Bona Ubufasha" : "Get Support"}</button>
                    </div>
                </div>
            `;

            const loadingOverlay = document.getElementById('loading-overlay');
            try {
                const response = await fetch("https://dataapis.wixsite.com/platformdata/_functions/cinemaData", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        "MovieId": optionData.movieId, //"6140f361-3a6e-4cbb-b7a3-6d81c1eca4c6",
                        "userId": optionData.userId, //"1441537e-ef35-4ca8-b9df-6ddbd7b5678c",
                        "deviceType": "IOS"
                    })
                });
                if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
                const apiData = await response.json();

                let seriesData = {
                    seasons: apiData.data.seasons.map((seasonName, index) => ({
                        season: index + 1,
                        seasonName: seasonName,
                        episodes: apiData.data.episodes[index]
                    }))
                };

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

                const saveEpisodeProgress = (episodeData) => {
                    if (!episodeData || !episodeData.movieId) return;
                    let list = getContinueWatchingList();
                    const existingIndex = list.findIndex(item => item.movieId === episodeData.movieId);

                    const dataToStore = { ...episodeData };
                    delete dataToStore.video;

                    if (existingIndex > -1) {
                        list[existingIndex] = dataToStore;
                    } else {
                        list.unshift(dataToStore);
                    }

                    if (list.length > 15) {
                        list = list.slice(0, 15);
                    }

                    localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(list));
                };

                const removeEpisodeProgress = (movieId) => {
                    let list = getContinueWatchingList();
                    const updatedList = list.filter(item => item.movieId !== movieId);
                    localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(updatedList));
                };

                const getSavedEpisode = (movieId) => {
                    const list = getContinueWatchingList();
                    return list.find(item => item.movieId === movieId) || null;
                };

                const movieId = seriesData.seasons[0].episodes[0].movieId;
                let savedEpisode = getSavedEpisode(movieId);
                let currentMovieData;

                if (savedEpisode) {
                    const freshEpisodeData = seriesData.seasons
                        .flatMap(s => s.episodes)
                        .find(ep => ep.episodeId === savedEpisode.episodeId);

                    if (freshEpisodeData) {
                        if (freshEpisodeData.locked) {
                            currentMovieData = freshEpisodeData;
                        } else {
                            currentMovieData = {
                                ...savedEpisode,
                                video: freshEpisodeData.video,
                                locked: freshEpisodeData.locked
                            };
                        }
                    } else {
                        currentMovieData = seriesData.seasons[0].episodes[0];
                    }
                } else {
                    currentMovieData = seriesData.seasons[0].episodes[0];
                }

                if (loadingOverlay) loadingOverlay.style.display = 'none';

                const defaultQualityOrder = ['hdVideo', 'midVideo', 'lowVideo'];
                let initialUrl = '';
                let activeQuality = '';
                for (const qualityKey of defaultQualityOrder) {
                    if (currentMovieData.video && currentMovieData.video[qualityKey] && !currentMovieData.video[qualityKey].includes('not found')) {
                        initialUrl = currentMovieData.video[qualityKey];
                        activeQuality = qualityKey.replace('Video', '');
                        break;
                    }
                }
                if (!initialUrl && !currentMovieData.locked) {
                    console.error("No valid video sources found for the initial episode.");
                    document.body.innerHTML = "Error: No playable video found for this content.";
                    return;
                }

                // Assign the new Artplayer instance to the global variable
                artInstance = new Artplayer({
                    container: '.artplayer-app', url: initialUrl, poster: currentMovieData.longCover,
                    isLive: false, muted: false, autoplay: true, pip: false, autoSize: false, autoMini: true,
                    screenshot: false, setting: false, loop: false, autoPlayback: false, autoOrientation: true,
                    antiOverlap: true, flip: false, playbackRate: false, aspectRatio: true, miniProgressBar: true,
                    backdrop: true, playsInline: true, airplay: false, fullscreenWeb: false, theme: "#1FDF67",
                    moreVideoAttr: { "webkit-playsinline": true },
                    layers: [
                        { name: 'topControls', html: mainTopControlsContainer, style: { position: 'absolute', width: '100%', height: 'auto', pointerEvents: 'auto' } },
                        { name: 'playback', html: controlsPlayAndPauseElement, style: { width: '100%', height: '65px', alignSelf: 'center', boxSizing: 'border-box', opacity: "1", transition: "opacity 3s ease-in-out", position: 'absolute', pointerEvents: 'auto', top: '45%' } },
                        { name: 'bottomInfo', html: `<div id="bottom-left-info"><div id="season-episode-info"></div><div id="movie-title-display"></div></div><div id="more-episodes-container"></div>`, style: { position: 'absolute', inset: '0', pointerEvents: 'none' } },
                        { name: 'episodes', html: episodesOverlayHtml, style: { display: 'none' } },
                        { name: 'lock', html: lockOverlayHtml, style: { display: 'none', zIndex: 50, width: '100%', height: '100%', left: '0px', borderRadius: '0px', backdropFilter: 'blur(10px)', backgroundColor: '#000000d9' } }
                    ],
                    controls: [
                        { name: 'currentTime', position: 'left', html: '00:00:00', style: { color: 'white', fontFamily: 'system-ui', fontSize: '15px' } },
                        { name: 'totalTime', position: 'right', html: '00:00:00', style: { color: 'white', fontFamily: 'system-ui', fontSize: '15px' } }
                    ],
                    plugins: currentMovieData.adstatus === false ? [] : [
                        artplayerPluginAds({
                            html: '<img src="" alt="Ad Poster">', video: allLolls[0], url: "", playDuration: 48, totalDuration: 50,
                            i18n: { close: optionData.language != 'en' ? 'Taruka' : 'Skip Ad', countdown: optionData.language != 'en' ? 'Kanda Hano' : 'Click Here', detail: optionData.language != 'en' ? 'Kwamamaza' : 'Ad', canBeClosed: optionData.language != 'en' ? '%s | Kwishyura?' : '%s | To Pay?' },
                        }),
                    ],
                    customType: { m3u8: _m, mpd: _x }
                });

                // Use `artInstance` from now on
                const art = artInstance;

                art.on('ready', () => {
                    // --- DOM Element References from art.layers ---
                    const actionButtonsContainer = art.layers.topControls.querySelector('#actionButtonContainer');
                    const qualityControlContainer = art.layers.topControls.querySelector('#qualityControl');
                    const rewindButton = art.layers.playback.querySelector('#rewindButton');
                    const forwardButton = art.layers.playback.querySelector('#forwardButton');
                    const playPauseButton = art.layers.playback.querySelector('#playPauseButton');
                    const volumeButton = art.layers.topControls.querySelector('#volumeButton');
                    const backButton = art.layers.topControls.querySelector('#backButton');
                    const fullscreenButton = art.layers.topControls.querySelector('#fullscreenButton');
                    const mainControlsContainer = art.layers.topControls.querySelector('#mainControlsContainer');
                    const playbackControlsContainer = art.layers.playback.querySelector('#playbackControlsContainer');
                    const bottomLeftInfo = art.layers.bottomInfo.querySelector('#bottom-left-info');
                    const moreEpisodesContainer = art.layers.bottomInfo.querySelector('#more-episodes-container');
                    const lockLayer = art.layers.lock;

                    const artBottom = document.querySelector('.art-bottom');
                    const progressBar = document.querySelector('.art-control.art-control-progress');
                    const progressBarInner = document.querySelector('.art-control-progress-inner');
                    const centerControls = document.querySelector('.art-controls');
                    const currentTimeDisplay = art.controls.currentTime;
                    const totalTimeDisplay = art.controls.totalTime;
                    const subscribeButton = lockLayer.querySelector('#subscribeButton');
                    const helpButton = lockLayer.querySelector('#helpButton');

                    // --- Helper Functions ---
                    const formatTime = (seconds) => new Date(seconds * 1000).toISOString().substr(11, 8);
                    const animateAndRemove = (element) => {
                        if (element && !element.classList.contains('animate-out')) {
                            element.classList.add('animate-out');
                            element.addEventListener('animationend', () => element.remove(), { once: true });
                        }
                    };

                    backButton.onclick = () => {
                        const event = new CustomEvent('playerAction', {
                            detail: {
                                action: 'backButton',
                                data: 'ready'
                            }
                        });

                        document.dispatchEvent(event); // dispatch globally
                    };

                    subscribeButton.onclick = () => {
                        const event = new CustomEvent('playerAction', {
                            detail: {
                                action: 'subscribeButton',
                                data: 'ready'
                            }
                        });

                        document.dispatchEvent(event); // dispatch globally
                    };

                    helpButton.onclick = () => {
                        const event = new CustomEvent('playerAction', {
                            detail: {
                                action: 'helpButton',
                                data: 'ready'
                            }
                        });

                        document.dispatchEvent(event); // dispatch globally
                    };

                    // --- UI Update Functions ---
                    const updateUIForNewEpisode = () => {
                        const seasonEpInfoEl = art.layers.bottomInfo.querySelector('#season-episode-info');
                        const movieTitleEl = art.layers.bottomInfo.querySelector('#movie-title-display');
                        if (currentMovieData.type === 'M' || !apiData.isSeason) {
                            if (seasonEpInfoEl) seasonEpInfoEl.style.display = 'none';
                        } else {
                            if (seasonEpInfoEl) {
                                seasonEpInfoEl.textContent = `Season ${currentMovieData.position.seasonIndex + 1}, EP ${currentMovieData.episode}${currentMovieData.partName || ''}`;
                                seasonEpInfoEl.style.display = 'block';
                            }
                        }
                        if (movieTitleEl) movieTitleEl.textContent = currentMovieData.title;
                        art.poster = currentMovieData.longCover;

                        const formatSize = (sizeString) => {
                            if (!sizeString || !sizeString.includes('MB')) return '';
                            const sizeNumber = parseFloat(sizeString);
                            if (isNaN(sizeNumber)) return '';
                            return `${Math.floor(sizeNumber)} MB`;
                        };

                        art.layers.topControls.querySelector('#hdSize').textContent = formatSize(currentMovieData.size.hdSize);
                        art.layers.topControls.querySelector('#midSize').textContent = formatSize(currentMovieData.size.midSize);
                        art.layers.topControls.querySelector('#lowSize').textContent = formatSize(currentMovieData.size.lowSize);

                        art.layers.topControls.querySelectorAll('#qualityControl .segment-button').forEach(button => {
                            const quality = button.dataset.value;
                            button.classList.remove('active', 'disabled');
                            const videoUrl = currentMovieData.video[`${quality}Video`];
                            if (!videoUrl || videoUrl.includes('not found')) {
                                button.classList.add('disabled');
                            }
                            if (activeQuality === quality && !button.classList.contains('disabled')) {
                                button.classList.add('active');
                            }
                        });
                    };

                    const showSkipIntroButton = () => {
                        const introEndTime = parseInt(currentMovieData.time.startTime, 10);
                        if (actionButtonsContainer.querySelector('#skipIntroBtn') || !introEndTime || art.currentTime >= introEndTime) return;
                        const wrapper = document.createElement('div');
                        wrapper.id = 'skipIntroBtn';
                        wrapper.className = 'action-button-wrapper';
                        wrapper.innerHTML = `<button class="dynamic-action-button"><span>${optionData.language != "en" ? "Taruka Indirimbo" : "Skip Intro"}</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg></button>`;
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
                                <button class="dynamic-action-button">${optionData.language != "en" ? "Komeza uhereye" : "Continue from -"} ${timeString}</button>
                            `;
                        wrapper.querySelector('.dynamic-action-button').onclick = () => { art.seek = continueTime; art.play(); animateAndRemove(wrapper); };

                        actionButtonsContainer.innerHTML = '';
                        actionButtonsContainer.appendChild(wrapper);
                    };

                    // --- Episodes Overlay Setup ---
                    const setupEpisodesOverlay = () => {
                        const episodesLayer = document.querySelector('.art-layer-episodes');
                        if (!episodesLayer) return;

                        const episodesOverlay = episodesLayer.querySelector('#episodesOverlay');
                        const artBottom = document.querySelector('.art-bottom');

                        const closeEpisodesBtn = episodesLayer.querySelector('#closeEpisodesOverlay');
                        const episodesList = episodesLayer.querySelector('#episodesList');
                        const scrollLeftBtn = episodesLayer.querySelector('#scrollLeft');
                        const scrollRightBtn = episodesLayer.querySelector('#scrollRight');

                        const openSeasonsBtn = episodesLayer.querySelector('#openSeasonsButton');
                        const seasonCardOverlay = episodesLayer.querySelector('#seasonCardOverlay');
                        const seasonCardList = episodesLayer.querySelector('#seasonCardList');
                        const backToEpisodesBtn = episodesLayer.querySelector('#backToEpisodesButton');
                        const closeSeasonsBtn = episodesLayer.querySelector('#closeSeasonsOverlay');

                        let selectedSeasonIndex = currentMovieData.position.seasonIndex;

                        const populateSeasonCards = () => {
                            if (!seriesData || !seasonCardList) return;
                            seasonCardList.innerHTML = '';
                            seriesData.seasons.forEach((season, index) => {
                                const card = document.createElement('div');
                                card.className = 'season-card';
                                const imageUrl = season.episodes[0]?.longCover || '';
                                card.style.backgroundImage = `url(${imageUrl})`;
                                card.innerHTML = `<div class="season-card-number">Season ${season.season}</div>`;
                                if (index === selectedSeasonIndex) {
                                    card.classList.add('active');
                                }
                                card.addEventListener('click', () => {
                                    selectedSeasonIndex = index;
                                    populateEpisodes(selectedSeasonIndex);
                                    seasonCardList.querySelector('.season-card.active')?.classList.remove('active');
                                    card.classList.add('active');
                                    episodesOverlay.classList.remove('seasons-active');
                                });
                                seasonCardList.appendChild(card);
                            });
                        };

                        const hideOverlay = () => {
                            episodesOverlay.classList.remove('visible');
                            if (artBottom) artBottom.style.visibility = 'visible';
                            episodesOverlay.addEventListener('transitionend', () => {
                                episodesLayer.style.display = 'none';
                                episodesOverlay.classList.remove('seasons-active');
                            }, { once: true });
                        };

                        const populateEpisodes = (seasonIndex) => {
                            if (!seriesData || !episodesList) return;
                            const season = seriesData.seasons[seasonIndex];
                            if (!season) return;
                            episodesList.innerHTML = '';
                            season.episodes.forEach((ep, index) => {
                                const isNextSeasonCard = index === season.episodes.length - 1 && ep.position.seasonIndex !== seasonIndex;

                                if (isNextSeasonCard) {
                                    const card = document.createElement('div');
                                    card.className = 'season-card';
                                    const imageUrl = ep.longCover || '';
                                    card.style.backgroundImage = `url(${imageUrl})`;
                                    card.innerHTML = `<div class="season-card-number">Season ${ep.position.seasonIndex + 1}</div>`;

                                    card.addEventListener('click', () => {
                                        currentMovieData = ep;
                                        selectedSeasonIndex = ep.position.seasonIndex;
                                        saveEpisodeProgress(currentMovieData);

                                        let newUrl = '';
                                        for (const qualityKey of defaultQualityOrder) {
                                            if (ep.video && ep.video[qualityKey] && !ep.video[qualityKey].includes('not found')) {
                                                newUrl = ep.video[qualityKey];
                                                activeQuality = qualityKey.replace('Video', '');
                                                break;
                                            }
                                        }
                                        if (newUrl) {
                                            art.switchUrl(newUrl, ep.title).then(() => {
                                                art.play();
                                                updateUIForNewEpisode();
                                                actionButtonsContainer.innerHTML = '';
                                                if (currentMovieData.continueWatching.inMinutes > 0) showContinueWatchingButton();
                                                else if (parseInt(currentMovieData.time.startTime, 10) > 0) showSkipIntroButton();
                                                hideOverlay();
                                            });
                                        } else if (ep.locked) {
                                            showLockOverlay();
                                        } else {
                                            console.error("No valid URL for this episode");
                                        }
                                    });
                                    episodesList.appendChild(card);
                                } else {
                                    const card = document.createElement('div');
                                    card.className = 'episode-card';
                                    card.style.backgroundImage = `url(${ep.longCover})`;
                                    if (ep.episodeId === currentMovieData.episodeId) {
                                        card.classList.add('active');
                                    }

                                    if (ep.locked) {
                                        card.classList.add('locked');
                                        card.innerHTML += `<div class="lock-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg></div>`;
                                    }

                                    card.innerHTML += `<div class="episode-info"><div class="season-text">${season.seasonName}</div><div class="episode-number">${ep.episode}${ep.partName || ''}</div><div class="title-text">${ep.title}</div></div><div class="audio-wave-container"><div class="audio-wave-bar"></div><div class="audio-wave-bar"></div><div class="audio-wave-bar"></div></div>`;
                                    card.addEventListener('click', () => {
                                        if (card.classList.contains('locked')) {
                                            showLockOverlay();
                                            return;
                                        }

                                        card.classList.add('bouncing');
                                        card.addEventListener('animationend', () => card.classList.remove('bouncing'), { once: true });

                                        currentMovieData = ep;
                                        saveEpisodeProgress(currentMovieData);

                                        let newUrl = '';
                                        for (const qualityKey of defaultQualityOrder) {
                                            if (currentMovieData.video[qualityKey] && !currentMovieData.video[qualityKey].includes('not found')) {
                                                newUrl = currentMovieData.video[qualityKey];
                                                activeQuality = qualityKey.replace('Video', '');
                                                break;
                                            }
                                        }
                                        if (newUrl) {
                                            art.switchUrl(newUrl, currentMovieData.title).then(() => {
                                                art.play();
                                                updateUIForNewEpisode();
                                                actionButtonsContainer.innerHTML = '';
                                                if (currentMovieData.continueWatching.inMinutes > 0) showContinueWatchingButton();
                                                else if (parseInt(currentMovieData.time.startTime, 10) > 0) showSkipIntroButton();
                                                hideOverlay();
                                            });
                                        } else { console.error("No valid URL for this episode"); }
                                    });
                                    episodesList.appendChild(card);
                                }
                            });
                        };

                        if (closeEpisodesBtn && !closeEpisodesBtn.dataset.listenerAttached) {
                            closeEpisodesBtn.addEventListener('click', hideOverlay);
                            closeEpisodesBtn.dataset.listenerAttached = 'true';
                        }

                        if (closeSeasonsBtn && !closeSeasonsBtn.dataset.listenerAttached) {
                            closeSeasonsBtn.addEventListener('click', hideOverlay);
                            closeSeasonsBtn.dataset.listenerAttached = 'true';
                        }

                        if (openSeasonsBtn && !openSeasonsBtn.dataset.listenerAttached) {
                            openSeasonsBtn.addEventListener('click', () => {
                                populateSeasonCards();
                                episodesOverlay.classList.add('seasons-active');
                            });
                            openSeasonsBtn.dataset.listenerAttached = 'true';
                        }

                        if (backToEpisodesBtn && !backToEpisodesBtn.dataset.listenerAttached) {
                            backToEpisodesBtn.addEventListener('click', () => {
                                episodesOverlay.classList.remove('seasons-active');
                            });
                            backToEpisodesBtn.dataset.listenerAttached = 'true';
                        }

                        if (scrollLeftBtn && !scrollLeftBtn.dataset.listenerAttached) {
                            scrollLeftBtn.addEventListener('click', () => { if (episodesList) episodesList.scrollBy({ left: -300, behavior: 'smooth' }); });
                            scrollLeftBtn.dataset.listenerAttached = 'true';
                        }
                        if (scrollRightBtn && !scrollRightBtn.dataset.listenerAttached) {
                            scrollRightBtn.addEventListener('click', () => { if (episodesList) episodesList.scrollBy({ left: 300, behavior: 'smooth' }); });
                            scrollRightBtn.dataset.listenerAttached = 'true';
                        }

                        episodesOverlay.classList.remove('seasons-active');
                        populateEpisodes(selectedSeasonIndex);

                        if (artBottom) artBottom.style.visibility = 'hidden';
                        episodesLayer.style.display = 'flex';
                        setTimeout(() => {
                            episodesOverlay.classList.add('visible');
                            const activeCard = episodesList.querySelector('.episode-card.active');
                            if (activeCard) {
                                activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                            }
                        }, 10);
                    };

                    const preventKeystrokes = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    };

                    const showLockOverlay = () => {
                        art.pause();
                        mainControlsContainer.style.display = 'none';
                        playbackControlsContainer.style.display = 'none';
                        bottomLeftInfo.style.display = 'none';
                        moreEpisodesContainer.style.display = 'none';
                        if (artBottom) artBottom.style.display = 'none';

                        const posterElement = document.querySelector('.artplayer-app .art-poster');
                        if (posterElement) {
                            posterElement.style.display = 'block';
                        }

                        lockLayer.style.display = 'flex';
                        document.addEventListener('keydown', preventKeystrokes, true);
                    };

                    // --- Initial UI Setup ---
                    if (artBottom) artBottom.style.padding = '30px 10px 0px';
                    if (progressBar) progressBar.style.height = '5px';
                    if (progressBarInner) progressBarInner.style.backgroundColor = '#393939';
                    if (centerControls) centerControls.style.paddingBottom = '20px';

                    updateUIForNewEpisode();
                    if (currentMovieData.locked) {
                        showLockOverlay();
                    } else {
                        if (currentMovieData.continueWatching.inMinutes > 0) showContinueWatchingButton();
                        else if (parseInt(currentMovieData.time.startTime, 10) > 0) showSkipIntroButton();
                    }


                    if (apiData.isSeason) {
                        const moreEpisodesContainer = art.layers.bottomInfo.querySelector('#more-episodes-container');
                        if (moreEpisodesContainer) {
                            moreEpisodesContainer.innerHTML = `<div id="more-episodes-card"><div class="next-episode-text"><h3>${optionData.language != "en" ? "Izindi" : "Next"}</h3><p>${optionData.language != "en" ? "Episode" : "Episode"}</p></div><div class="next-episode-thumbnail"><img src="${currentMovieData.image}" onerror="this.style.display='none'" alt="Next Episode"><div class="play-overlay"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div></div>`;
                            moreEpisodesContainer.querySelector('#more-episodes-card').addEventListener('click', setupEpisodesOverlay);
                        }
                    }

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

                    // --- Event Listeners for Main Controls ---
                    if (rewindButton) rewindButton.addEventListener('click', () => { art.seek = art.currentTime - 30; });
                    if (forwardButton) forwardButton.addEventListener('click', () => { art.seek = art.currentTime + 30; });
                    if (playPauseButton) playPauseButton.addEventListener('click', () => art.toggle());
                    if (fullscreenButton) fullscreenButton.addEventListener('click', () => art.fullscreen = !art.fullscreen);
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
                    if (qualityControlContainer) {
                        qualityControlContainer.querySelectorAll('.segment-button').forEach(button => {
                            button.addEventListener('click', () => {
                                if (button.classList.contains('disabled') || button.classList.contains('active')) return;
                                const newQuality = button.dataset.value;
                                const newUrl = currentMovieData.video[`${newQuality}Video`];
                                if (newUrl && !newUrl.includes('not found')) {
                                    art.switchQuality(newUrl, currentMovieData.title).then(() => {
                                        activeQuality = newQuality;
                                        updateUIForNewEpisode();
                                    });
                                }
                            });
                        });
                    }

                    // --- ArtPlayer Event Hooks ---
                    art.on('play', () => {
                        if (playPauseButton) playPauseButton.querySelector('svg path').setAttribute('d', "M6 19h4V5H6v14zm8-14v14h4V5h-4z");
                    });
                    art.on('pause', () => {
                        if (playPauseButton) playPauseButton.querySelector('svg path').setAttribute('d', "M8 5v14l11-7z");
                    });
                    art.on('control', state => {
                        if (lockLayer.style.display === 'flex') return;
                        mainControlsContainer.classList.toggle('hidden', !state);
                        playbackControlsContainer.classList.toggle('hidden', !state);
                        bottomLeftInfo.classList.toggle('hidden', !state);
                        moreEpisodesContainer.classList.toggle('hidden', !state);
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
                        if (currentMovieData.locked) {
                            art.pause();
                            showLockOverlay();
                            return;
                        }

                        if (currentTimeDisplay) currentTimeDisplay.innerHTML = formatTime(art.currentTime);
                        if (totalTimeDisplay && art.duration) totalTimeDisplay.innerHTML = formatTime(art.duration);

                        const currentTime = Date.now();
                        if (currentTime - lastSaveTime > 7000) {
                            if (art.duration > 0) {
                                currentMovieData.continueWatching.inMinutes = Math.trunc(art.currentTime);
                                currentMovieData.continueWatching.inPercentage = Math.round((art.currentTime / art.duration) * 100);
                                saveEpisodeProgress(currentMovieData);
                                lastSaveTime = currentTime;
                            }
                        }

                        if (!currentMovieData.isSeason && !movieRemoved && art.duration > 0 && (art.currentTime / art.duration) >= 0.8) {
                            removeEpisodeProgress(currentMovieData.movieId);
                            movieRemoved = true;
                        }

                        const skipBtn = actionButtonsContainer.querySelector('#skipIntroBtn');
                        const introEndTime = parseInt(currentMovieData.time.startTime, 10);
                        if (skipBtn && introEndTime && art.currentTime > introEndTime) animateAndRemove(skipBtn);

                        const continueContainer = actionButtonsContainer.querySelector('#continueWatchingContainer');
                        const continueTime = currentMovieData.continueWatching.inMinutes;
                        if (continueContainer && continueTime && art.currentTime > continueTime + 10) animateAndRemove(continueContainer);

                    });
                });

            } catch (error) {
                console.error('Failed to initialize player:', error);
                if (loadingOverlay) loadingOverlay.textContent = `Error: Could not load video data. ${error.message}`;
            }
        }

        // Example of how to start the application
        // initializeApp({ movieId: 'YOUR_MOVIE_ID', userId: 'YOUR_USER_ID', language: 'en' });
        // destroyApp();

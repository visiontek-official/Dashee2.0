document.addEventListener('DOMContentLoaded', () => {
    const pairingCode = new URLSearchParams(window.location.search).get('pairingCode');
    if (!pairingCode) {
        alert('Invalid pairing code.');
        return;
    }

    const ws = new WebSocket(`ws://visiontek.ddns.net:8100/?pairingCode=${pairingCode}`);

    ws.onopen = () => {
        console.log('WebSocket connection opened');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Received WebSocket message:', message);
        if (message.type === 'playlistUpdate') {
            console.log('Playlist update received:', message.playlist);
            displayContent(message.playlist);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
    };

    setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    }, 60000); // Close WebSocket after 60 seconds

    // Initial content fetch based on pairing code
    fetchContent(pairingCode);

    async function fetchContent(pairingCode) {
        try {
            const response = await fetch('/api/get-playlist-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pairing_code: pairingCode })
            });

            const text = await response.text();
            console.log('Server response:', text); // Log the raw response text

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = JSON.parse(text); // Parse the text as JSON

            if (data.success) {
                console.log('Fetched content:', data.content);
                displayContent(data.content);
            } else {
                showDefaultScreen();
            }
        } catch (error) {
            console.error('Error fetching content:', error);
            showDefaultScreen();
        }
    }

    function displayContent(content) {
        console.log('Playlists:', content); // Log the playlists array to understand its structure
        if (!content || content.length === 0) {
            showDefaultScreen();
            return;
        }

        const container = document.getElementById('content-container');
        container.innerHTML = ''; // Clear any existing content

        let currentIndex = 0;

        function showContent() {
            if (currentIndex >= content.length) {
                currentIndex = 0;
            }
            const item = content[currentIndex];
            console.log('Displaying content:', item);

            container.innerHTML = ''; // Clear previous content

            if (item.file_type === 'image/jpeg' || item.file_type === 'image/png') {
                const img = document.createElement('img');
                img.src = item.file_path;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                container.appendChild(img);

                const duration = item.displayDuration ? parseDuration(item.displayDuration) : 5000; // Default to 5 seconds if displayDuration is null
                setTimeout(() => {
                    currentIndex++;
                    showContent();
                }, duration);
            } else if (item.file_type === 'video/mp4') {
                const video = document.createElement('video');
                video.src = item.file_path;
                video.autoplay = true;
                video.loop = false; // Set to false to handle end event
                video.muted = true; // Ensure video is muted for autoplay to work
                video.controls = false; // Hide controls for full screen
                video.style.width = '100%';
                video.style.height = '100%';
                video.style.objectFit = 'cover';
                container.appendChild(video);
                video.play(); // Explicitly call play

                if (item.displayDuration) {
                    const duration = parseDuration(item.displayDuration); // Convert duration to milliseconds
                    setTimeout(() => {
                        currentIndex++;
                        showContent();
                    }, duration);
                } else {
                    video.addEventListener('ended', () => {
                        currentIndex++;
                        showContent();
                    });
                }
            }
        }

        showContent();
    }

    function parseDuration(hhmmss) {
        if (!hhmmss) {
            // Default to 5 seconds if displayDuration is null
            return 5000;
        }
        const [hours, minutes, seconds] = hhmmss.split(':').map(Number);
        return ((hours * 60 + minutes) * 60 + seconds) * 1000;
    }

    function showDefaultScreen() {
        const container = document.getElementById('content-container');
        container.innerHTML = ''; // Clear any existing content

        const defaultScreen = document.createElement('div');
        defaultScreen.style.width = '100%';
        defaultScreen.style.height = '100%';
        defaultScreen.style.display = 'flex';
        defaultScreen.style.justifyContent = 'center';
        defaultScreen.style.alignItems = 'center';
        defaultScreen.style.backgroundColor = '#304050'; // Updated background color
        defaultScreen.style.color = '#FFFFFF'; // Text color
        defaultScreen.style.fontSize = '2em';
        defaultScreen.style.fontFamily = 'Arial, sans-serif';
        defaultScreen.style.textAlign = 'center';
        defaultScreen.style.padding = '20px';
        defaultScreen.style.boxSizing = 'border-box';
        defaultScreen.innerText = 'Connected Screen - No Content Available';

        container.appendChild(defaultScreen);

        // Show logo and message
        const logoContainer = document.querySelector('.logo-container');
        const messageContainer = document.querySelector('.message-container');

        if (logoContainer) logoContainer.style.display = 'block';
        if (messageContainer) messageContainer.style.display = 'block';
    }
});

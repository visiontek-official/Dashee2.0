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

            const data = await response.json();

            if (data.success) {
                displayContent(data.content);
            } else {
                showDefaultScreen();
            }
        } catch (error) {
            console.error('Error fetching content:', error);
            showDefaultScreen();
        }
    }

    function displayContent(playlists) {
        if (playlists.length === 0) {
            showDefaultScreen();
            return;
        }

        const container = document.getElementById('content-container');
        container.innerHTML = ''; // Clear any existing content

        let currentIndex = 0;

        function showPlaylist() {
            const playlist = playlists[currentIndex];
            container.innerHTML = ''; // Clear previous content
            let contentIndex = 0;

            function showContent() {
                const content = playlist[contentIndex];
                container.innerHTML = ''; // Clear previous content

                if (content.file_type === 'image/jpeg') {
                    const img = document.createElement('img');
                    img.src = content.file_path;
                    container.appendChild(img);
                } else if (content.file_type === 'video/mp4') {
                    const video = document.createElement('video');
                    video.src = content.file_path;
                    video.autoplay = true;
                    video.loop = true;
                    video.muted = true; // Ensure video is muted for autoplay to work
                    video.controls = false; // Hide controls for full screen
                    container.appendChild(video);
                    video.play(); // Explicitly call play
                }

                const duration = content.displayDuration * 60000; // Convert minutes to milliseconds
                setTimeout(() => {
                    contentIndex = (contentIndex + 1) % playlist.length;
                    showContent();
                }, duration);
            }

            showContent();
            currentIndex = (currentIndex + 1) % playlists.length;
        }

        showPlaylist();
        setInterval(showPlaylist, playlists[currentIndex].reduce((acc, content) => acc + content.displayDuration * 60000, 0)); // Sum durations of all contents in the playlist
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
    }
});

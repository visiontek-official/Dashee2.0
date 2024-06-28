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

    function displayContent(contents) {
        if (contents.length === 0) {
            showDefaultScreen();
            return;
        }

        const container = document.getElementById('content-container');
        container.innerHTML = ''; // Clear any existing content

        let currentIndex = 0;

        function showContent() {
            const content = contents[currentIndex];
            container.innerHTML = ''; // Clear previous content

            if (content.file_type === 'image/jpeg') {
                const img = document.createElement('img');
                img.src = content.file_path;
                container.appendChild(img);
                setTimeout(showContent, 5000); // 5 seconds for images
            } else if (content.file_type === 'video/mp4') {
                const video = document.createElement('video');
                video.src = content.file_path;
                video.autoplay = true;
                video.loop = true;
                video.muted = true; // Ensure video is muted for autoplay to work
                video.controls = false; // Hide controls for full screen
                video.onended = showContent; // Move to next content after video ends
                container.appendChild(video);
                video.play(); // Explicitly call play
            }

            currentIndex = (currentIndex + 1) % contents.length;
        }

        showContent();
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

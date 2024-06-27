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
            playPlaylist(message.playlist);
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

    function playPlaylist(playlist) {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.backgroundColor = 'black';
        container.style.zIndex = '9999';

        document.body.innerHTML = ''; // Clear the current content
        document.body.appendChild(container);

        playlist.forEach(item => {
            if (item.file_type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = item.file_path;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                container.appendChild(img);
            } else if (item.file_type.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = item.file_path;
                video.style.width = '100%';
                video.style.height = '100%';
                video.style.objectFit = 'cover';
                video.autoplay = true;
                video.loop = true;
                container.appendChild(video);
            }
        });
    }
});

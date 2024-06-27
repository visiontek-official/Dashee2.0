document.addEventListener('DOMContentLoaded', () => {
    const pairingCodeElement = document.getElementById('pairing-code');
    const qrCodeElement = document.getElementById('qr-code-img');
    let pairingCode = '';

    if (pairingCodeElement) {
        fetchPairingCode();
    }

    async function fetchPairingCode() {
        const response = await fetch('/api/generate-pairing-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success) {
            pairingCode = data.pairingCode;
            if (pairingCodeElement) pairingCodeElement.innerText = pairingCode;
            if (qrCodeElement) qrCodeElement.src = `https://api.qrserver.com/v1/create-qr-code/?data=${pairingCode}&size=150x150`;
            storePairingCode(pairingCode);

            // Establish WebSocket connection
            const ws = new WebSocket(`ws://visiontek.ddns.net:8100/?pairingCode=${pairingCode}`);
            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (message.type === 'pairingSuccess') {
                    window.location.href = `connected.html?pairingCode=${pairingCode}`;
                }
            };
        } else {
            if (pairingCodeElement) pairingCodeElement.innerText = 'Error generating code';
        }
    }

    function storePairingCode(pairingCode) {
        fetch('/api/store-pairing-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pairingCode })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                console.error('Failed to store pairing code:', data.message);
            }
        })
        .catch(error => {
            console.error('Error storing pairing code:', error);
        });
    }
});

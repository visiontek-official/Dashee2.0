document.addEventListener('DOMContentLoaded', () => {
    const pairingCode = generatePairingCode();
    document.getElementById('pairingCode').textContent = pairingCode;

    // Generate QR Code URL
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${pairingCode}`;
    document.getElementById('qrCode').src = qrCodeUrl;

    document.getElementById('pairing-code-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pairingCode = document.getElementById('pairing-code-input').value;
        const response = await fetch('/api/validate-pairing-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pairingCode })
        });
        const data = await response.json();
        if (data.success) {
            alert('Pairing successful!');
            // Redirect to the connected page
            window.location.href = 'connected.html';
        } else {
            alert('Invalid or expired pairing code.');
        }
    });
    
    // Send pairing code to the server to store for validation
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
});

function generatePairingCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

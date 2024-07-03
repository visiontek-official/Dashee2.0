document.addEventListener('DOMContentLoaded', async () => {
    const pairingCodeElement = document.getElementById('pairing-code');
    const qrCodeElement = document.getElementById('qr-code-img');
    let pairingCode = '';

    const identity = await getDeviceIdentity(); // Function to get the device identity
    const userId = getUserId(); // Function to get the user ID

    console.log('Device Identity:', identity); // Debugging statement
    console.log('User ID:', userId); // Debugging statement

    if (typeof identity === 'string' && identity.includes('-')) {
        const [uuid, macAddress] = identity.split('-');
        if (pairingCodeElement) {
            checkDeviceInfo(uuid, macAddress, identity, userId);
        }
    } else {
        console.error('Invalid device identity:', identity);
    }

    async function checkDeviceInfo(uuid, macAddress, identity, userId) {
        try {
            const response = await fetch('/api/check-device-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid, macAddress, identity, userId })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Check Device Info Response:', data); // Debugging statement
            if (data.success) {
                window.location.href = `connected.html?pairingCode=${data.pairingCode}`;
            } else {
                fetchPairingCode(uuid, macAddress, userId, identity);
            }
        } catch (error) {
            console.error('Error checking device info:', error); // Debugging statement
        }
    }

    async function fetchPairingCode(uuid, macAddress, userId, identity) {
        try {
            console.log('Fetching pairing code...');
            const response = await fetch('/api/generate-pairing-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid, macAddress, userId, identity })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Generate Pairing Code Response:', data); // Debugging statement
            if (data.success) {
                pairingCode = data.pairingCode;
                console.log('Pairing Code:', pairingCode); // Debugging statement
                if (pairingCodeElement) pairingCodeElement.innerText = pairingCode;
                if (qrCodeElement) qrCodeElement.src = `https://api.qrserver.com/v1/create-qr-code/?data=${pairingCode}&size=150x150`;

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
        } catch (error) {
            console.error('Error generating pairing code:', error); // Debugging statement
            if (pairingCodeElement) pairingCodeElement.innerText = 'Error generating code';
        }
    }

    async function getDeviceIdentity() {
        const userAgent = navigator.userAgent;

        if (/Windows/.test(userAgent)) {
            return await getWindowsDeviceName();
        } else if (/Macintosh/.test(userAgent)) {
            return await getMacDeviceName();
        } else if (/Linux/.test(userAgent)) {
            return await getLinuxDeviceName();
        } else if (/Android/.test(userAgent)) {
            return await getAndroidDeviceName();
        } else if (/iPhone|iPad/.test(userAgent)) {
            return await getIOSDeviceName();
        }

        return 'default-identity';
    }

    async function getWindowsDeviceName() {
        console.log('Fetching Windows device name');
        return await fetchDeviceInfo('/api/get-windows-device-name');
    }

    async function getMacDeviceName() {
        console.log('Fetching Mac device name');
        return await fetchDeviceInfo('/api/get-mac-device-name');
    }

    async function getLinuxDeviceName() {
        console.log('Fetching Linux device name');
        return await fetchDeviceInfo('/api/get-linux-device-name');
    }

    async function getAndroidDeviceName() {
        console.log('Fetching Android device name');
        return await fetchDeviceInfo('/api/get-android-device-name');
    }

    async function getIOSDeviceName() {
        console.log('Fetching iOS device name');
        return await fetchDeviceInfo('/api/get-ios-device-name');
    }

    async function fetchDeviceInfo(apiEndpoint) {
        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (data.success) {
                return `${data.uuid}-${data.macAddress}`;
            } else {
                console.error(`Error fetching device info from ${apiEndpoint}:`, data.message);
                return 'DEVICE_NAME';
            }
        } catch (error) {
            console.error(`Error fetching device info from ${apiEndpoint}:`, error);
            return 'DEVICE_NAME';
        }
    }

    function getUserId() {
        return '1'; // Example user ID
    }
});

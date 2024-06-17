document.addEventListener('DOMContentLoaded', () => {
    loadScreens();
    loadUserDetails();

    const userMenu = document.querySelector('.user-menu');
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');

    dropdownToggle.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent the click from bubbling up
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (event) => {
        if (!userMenu.contains(event.target)) {
            dropdownMenu.style.display = 'none';
        }
    });
});

function loadScreens() {
    fetch('/getScreens')
        .then(response => response.json())
        .then(data => {
            const screensList = document.getElementById('screensList');
            screensList.innerHTML = '';

            data.screens.forEach(screen => {
                const screenElement = document.createElement('div');
                screenElement.className = 'screen-thumbnail';
                screenElement.innerHTML = `
                    <div class="screen-card" data-id="${screen.id}" data-name="${screen.screen_name}" onclick="openScreenDetails(${screen.id}, '${screen.screen_name}')">
                        <img src="uploads/screen-thumbnail.png" alt="${screen.screen_name}" class="screen-image">
                        <div class="screen-status ${screen.enabled ? 'online' : 'offline'}">${screen.enabled ? 'Online' : 'Offline'}</div>
                        <div class="screen-details">
                            <p class="screen-name">${screen.screen_name}</p>
                            <p class="last-seen">Last seen ${screen.last_connected}</p>
                        </div>
                        <div class="screen-options">
                            <i class="fas fa-ellipsis-v" onclick="toggleOptionsDropdown(event, ${screen.id})"></i>
                            <div class="options-dropdown" id="optionsDropdown-${screen.id}">
                                <a href="#" onclick="renameScreen(${screen.id})">Rename</a>
                                <a href="#" onclick="confirmAction('disable', ${screen.id})">Disable</a>
                                <a href="#" onclick="confirmAction('delete', ${screen.id})">Delete</a>
                            </div>
                        </div>
                    </div>
                `;
                screensList.appendChild(screenElement);
            });
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function openScreenDetails(screenId, screenName) {
    window.location.href = `screen-details.html?screenId=${screenId}&screenName=${encodeURIComponent(screenName)}`;
}

function loadUserDetails() {
    fetch('/getUserDetails')
        .then(response => response.json())
        .then(data => {
            document.getElementById('profilePic').src = data.profilePic;
            document.getElementById('userName').textContent = `${data.firstName} ${data.lastName}`;
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function showAddScreenPopup() {
    document.getElementById('addScreenPopup').style.display = 'flex';
}

function hideAddScreenPopup() {
    document.getElementById('addScreenPopup').style.display = 'none';
}

function addScreen() {
    const pairingCode = document.getElementById('pairingCode').value;
    const screenName = document.getElementById('screenName').value;

    if (!pairingCode || !screenName) {
        alert('Please enter both pairing code and screen name.');
        return;
    }

    fetch('/addScreen', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            pairingCode: pairingCode,
            screenName: screenName,
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            hideAddScreenPopup();
            loadScreens();
        } else {
            alert('Failed to add screen. Please try again.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function toggleOptionsDropdown(event, screenId) {
    event.stopPropagation(); // Prevent the click from bubbling up
    const dropdown = document.getElementById(`optionsDropdown-${screenId}`);
    const allDropdowns = document.querySelectorAll('.options-dropdown');

    allDropdowns.forEach(dd => {
        if (dd !== dropdown) {
            dd.style.display = 'none';
        }
    });

    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

document.addEventListener('click', (event) => {
    if (!event.target.matches('.fa-ellipsis-v')) {
        const allDropdowns = document.querySelectorAll('.options-dropdown');
        allDropdowns.forEach(dd => dd.style.display = 'none');
    }
});

function confirmAction(action, screenId) {
    const confirmation = confirm(`Are you sure you want to ${action} this screen?`);
    if (confirmation) {
        if (action === 'disable') {
            disableScreen(screenId);
        } else if (action === 'delete') {
            deleteScreen(screenId);
        }
    }
}

function disableScreen(screenId) {
    fetch('/disableScreen', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: screenId }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadScreens();
        } else {
            alert('Failed to disable screen. Please try again.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function deleteScreen(screenId) {
    fetch('/deleteScreen', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: screenId }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadScreens();
        } else {
            alert('Failed to delete screen. Please try again.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function renameScreen(screenId) {
    const newName = prompt('Enter new screen name:');
    if (newName) {
        fetch('/renameScreen', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: screenId, newName: newName }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadScreens();
            } else {
                alert('Failed to rename screen. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }
}

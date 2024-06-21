document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    fetchScreens();

    if (document.getElementById('addScreenForm')) {
        document.getElementById('addScreenForm').addEventListener('submit', function(event) {
            event.preventDefault();
            addScreen();
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
        const dropdownMenu = document.getElementById('dropdownMenu');
        if (!event.target.closest('.user-name') && !event.target.closest('.dropdown-menu')) {
            if (dropdownMenu.style.display === 'block') {
                dropdownMenu.style.display = 'none';
            }
        }
    });
});

function fetchScreens() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch('/api/get-screens', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(screens => {
        const screenList = document.getElementById('screenList');
        screenList.innerHTML = '';
        screens.forEach(screen => {
            const screenCard = document.createElement('div');
            screenCard.className = 'screen-card';
            screenCard.draggable = true;
            screenCard.ondragstart = (event) => {
                event.dataTransfer.setData('text/plain', screen.screen_id);
            };
            screenCard.onclick = (event) => {
                if (event.target.classList.contains('fas') || event.target.tagName === 'A') {
                    return; // Prevents opening screen when clicking on the options
                }
                openScreen(screen.screen_id);
            };
            screenCard.innerHTML = `
                <img src="uploads/default-screen.png" alt="Screen">
                <div class="screen-info">
                    <h3>${screen.screen_name}</h3>
                    <p>Last seen ${screen.last_seen} days ago</p>
                    <span class="status ${screen.enabled ? 'online' : 'offline'}">${screen.enabled ? 'Online' : 'Offline'}</span>
                    <div class="options" onclick="toggleOptionsMenu('${screen.screen_id}')">
                        <i class="fas fa-ellipsis-h"></i>
                    </div>
                    <div class="dropdown-options-menu" id="dropdown-options-menu-${screen.screen_id}" style="display:none;">
                        <a href="#" onclick="openScreen('${screen.screen_id}')">Open</a>
                        <a href="#" onclick="renameScreen('${screen.screen_id}', '${screen.screen_name}')">Rename</a>
                        <a href="#" onclick="deleteScreen('${screen.screen_id}')">Delete</a>
                    </div>
                </div>
            `;
            screenList.appendChild(screenCard);
        });
    })
    .catch(error => {
        console.error('Error fetching screens:', error);
    });
}

function toggleOptionsMenu(screenId) {
    const dropdownMenu = document.getElementById(`dropdown-options-menu-${screenId}`);
    const isVisible = dropdownMenu.style.display === 'block';

    // Hide all dropdown menus
    const dropdownMenus = document.querySelectorAll('.dropdown-options-menu');
    dropdownMenus.forEach(menu => menu.style.display = 'none');

    // Toggle the clicked menu
    if (!isVisible) {
        dropdownMenu.style.display = 'block';
    }
}

function addScreen() {
    const token = localStorage.getItem('token');
    const screenName = document.getElementById('screenName').value;
    const pairingCode = document.getElementById('pairingCode').value;

    fetch('/api/add-screen', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ screen_name: screenName, pairing_code: pairingCode })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Screen added successfully');
            hideAddScreenPopup();
            fetchScreens(); // Refresh screen list
        } else {
            alert('Error adding screen: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error adding screen:', error);
    });
}

function showAddScreenPopup() {
    document.getElementById('addScreenPopup').style.display = 'block';
}

function hideAddScreenPopup() {
    document.getElementById('addScreenPopup').style.display = 'none';
}

function openScreen(screenId) {
    window.location.href = `screen-details.html?screenId=${screenId}`;
}

function renameScreen(screenId, screenName) {
    const newScreenName = prompt('Enter new screen name', screenName);
    if (newScreenName) {
        const token = localStorage.getItem('token');
        fetch('/api/rename-screen', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ screen_id: screenId, new_screen_name: newScreenName })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Screen renamed successfully');
                fetchScreens(); // Refresh screen list
            } else {
                alert('Error renaming screen: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error renaming screen:', error);
        });
    }
}

function deleteScreen(screenId) {
    if (confirm('Are you sure you want to delete this screen?')) {
        const token = localStorage.getItem('token');
        fetch('/api/delete-screen', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ screen_id: screenId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Screen deleted successfully');
                fetchScreens(); // Refresh screen list
            } else {
                alert('Error deleting screen: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error deleting screen:', error);
        });
    }
}

function loadUserDetails() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch('/api/user-details', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        document.getElementById('userName').innerHTML = `${data.firstname} ${data.lastname} <i class="fas fa-caret-down"></i>`;
        document.getElementById('profilePic').src = data.profile_pic || 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png';

        if (data.role === 'admin') {
            document.getElementById('userMenuItem').style.display = 'block';
        }
    })
    .catch(error => {
        console.error('Error fetching user details:', error);
        window.location.href = 'index.html';
    });
}

function toggleDropdown() {
    var dropdownMenu = document.getElementById('dropdownMenu');
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
}

function handleSessionExpiration() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch('/api/check-session', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.sessionExpired) {
            logout();
        }
    })
    .catch(error => {
        console.error('Error checking session:', error);
        logout();
    });
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
    console.log('User logged out of Screen page due to session that expired');
}

function toggleOptionsMenu(event, screenId) {
    event.stopPropagation(); // Prevents the thumbnail click event
    const dropdownMenu = document.getElementById(`dropdown-options-menu-${screenId}`);
    const rect = event.target.getBoundingClientRect();

    // Close all other dropdown menus
    const dropdownMenus = document.querySelectorAll('.dropdown-options-menu');
    dropdownMenus.forEach(menu => {
        if (menu !== dropdownMenu) {
            menu.style.display = 'none';
        }
    });

    // Toggle the current dropdown menu
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    dropdownMenu.style.position = 'absolute';
    dropdownMenu.style.top = `${rect.bottom}px`;
    dropdownMenu.style.left = `${rect.left}px`;

    // Stop propagation to prevent the document click listener from closing it immediately
    dropdownMenu.addEventListener('click', (event) => {
        event.stopPropagation();
    });
}

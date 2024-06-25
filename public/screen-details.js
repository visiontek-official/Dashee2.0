document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    const screenId = getScreenIdFromURL();
    console.log('Extracted screen ID:', screenId); // Log the extracted screen ID
    if (screenId) {
        console.log('Calling updateScreenDetails with screenId:', screenId);
        updateScreenDetails(screenId);
        fetchPlaylists(screenId);
    } else {
        console.error('No screen ID found in the URL');
    }

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

    // Event listener to close the options dropdown when clicking outside
    document.addEventListener('click', (event) => {
        const dropdownMenus = document.querySelectorAll('.dropdown-options-menu');
        dropdownMenus.forEach(menu => {
            if (!menu.contains(event.target) && !menu.previousElementSibling.contains(event.target)) {
                menu.style.display = 'none';
            }
        });
    });
});

function getScreenIdFromURL() {
    console.log('Full URL:', window.location.href); // Log the full URL
    const params = new URLSearchParams(window.location.search);
    const screenId = params.get('screenId'); // Update to screenId
    console.log('URL parameters:', params.toString()); // Log URL parameters
    console.log('Screen ID from URL:', screenId); // Log extracted screen ID
    return screenId;
}

function updateScreenDetails(screenId) {
    console.log('Entering updateScreenDetails function with screenId:', screenId); // Log function entry
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No token found');
        return;
    }
    console.log('Token:', token); // Log token
    const url = `/api/screen-details/${screenId}`;
    console.log('Fetching data from URL:', url); // Log URL
    fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
        console.log('Fetch request initiated'); // Log fetch initiation
        console.log('Response status:', response.status); // Log response status
        return response.json(); // Get response as JSON
    })
    .then(data => {
        console.log('API response:', data); // Log the API response

        if (data.error) throw new Error(data.error);

        document.getElementById('screenTitle').textContent = data.title;
        document.getElementById('screenThumbnail').src = data.thumbnail || 'uploads/default-screen.png';
        document.getElementById('screenDescription').textContent = data.description || 'No description provided';

        // Set the screen name in both the title section and the breadcrumbs
        document.getElementById('screenName').textContent = data.screen_name;
        document.getElementById('breadcrumbScreenName').textContent = data.screen_name;

        const statusElement = document.getElementById('screenStatus');
        console.log('Online status:', data.online_status); // Log the online status

        if (data.online_status === 1) { // Adjusted condition to check for 1
            statusElement.textContent = 'Online';
            statusElement.classList.add('online');
            statusElement.classList.remove('offline');
        } else {
            statusElement.textContent = 'Offline';
            statusElement.classList.add('offline');
            statusElement.classList.remove('online');
        }
    })
    .catch(error => {
        console.error('Error fetching screen details:', error);
        document.getElementById('screenStatus').textContent = 'Error loading status';
    });
}

function fetchPlaylists(screenId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch(`/api/screen-playlists/${screenId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const playlistPromises = data.playlists.map(playlist => fetchContentDetails(playlist.contentId));
            Promise.all(playlistPromises)
                .then(contents => {
                    const detailedPlaylists = data.playlists.map((playlist, index) => ({
                        ...playlist,
                        contentDetails: contents[index]
                    }));
                    displayPlaylists(detailedPlaylists);
                });
        } else {
            console.error('Failed to fetch playlists:', data.message);
        }
    })
    .catch(error => {
        console.error('Error fetching playlists:', error);
    });
}

function fetchContentDetails(contentId) {
    const token = localStorage.getItem('token');
    return fetch(`/api/content-details/${contentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            return data.content;
        } else {
            console.error('Failed to fetch content details:', data.message);
            return null;
        }
    })
    .catch(error => {
        console.error('Error fetching content details:', error);
        return null;
    });
}

function displayPlaylists(playlists) {
    const playlistContent = document.querySelector('.playlist-content');
    playlistContent.innerHTML = playlists.map(playlist => {
        const { contentDetails } = playlist;
        if (!contentDetails) return '';

        return `
            <div class="playlist-item">
                <img src="${contentDetails.file_path}" alt="${contentDetails.file_name}">
                <div class="playlist-info">
                    <h3>${contentDetails.file_name}</h3>
                    <p>${contentDetails.file_type} • ${contentDetails.file_orientation} • ${playlist.last_seen} days ago</p>
                </div>
                <div class="playlist-duration">
                    <span>DURATION</span>
                    <div>${playlist.duration} Secs</div>
                </div>
                <div class="options">
                    <i class="fas fa-ellipsis-h" onclick="togglePlaylistOptionsMenu(event, '${playlist.id}')"></i>
                    <div class="dropdown-options-menu" id="playlist-options-menu-${playlist.id}" style="display:none;">
                        <a href="#" onclick="scheduleDisplayTimes('${playlist.id}')">Schedule display times</a>
                        <a href="#" onclick="setCustomTransition('${playlist.id}')">Set a custom transition</a>
                        <a href="#" onclick="moveItemUp('${playlist.id}')">Move item up</a>
                        <a href="#" onclick="moveItemDown('${playlist.id}')">Move item down</a>
                        <a href="#" onclick="duplicateItem('${playlist.id}')">Duplicate item</a>
                        <a href="#" onclick="removeFromPlaylist('${playlist.id}')">Remove from playlist</a>
                    </div>
                </div>
                <div class="delete-option">
                    <button onclick="confirmDelete('${playlist.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function confirmDelete(playlistId) {
    if (confirm('Are you sure you want to delete this content from the playlist?')) {
        deleteFromPlaylist(playlistId);
    }
}

function deleteFromPlaylist(playlistId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch(`/api/delete-playlist-item/${playlistId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Content deleted from the playlist successfully.');
            const screenId = getScreenIdFromURL();
            fetchPlaylists(screenId); // Refresh the playlist
        } else {
            alert('Failed to delete content from the playlist.');
        }
    })
    .catch(error => {
        console.error('Error deleting content from playlist:', error);
        alert('An error occurred while deleting the content.');
    });
}

function togglePlaylistOptionsMenu(event, playlistId) {
    event.stopPropagation(); // Prevents the thumbnail click event
    console.log(`Toggling dropdown menu for playlist item: ${playlistId}`); // Debug log
    const dropdownMenu = document.getElementById(`playlist-options-menu-${playlistId}`);

    // Close all other dropdown menus
    const dropdownMenus = document.querySelectorAll('.dropdown-options-menu');
    dropdownMenus.forEach(menu => {
        if (menu !== dropdownMenu) {
            menu.style.display = 'none';
        }
    });

    // Toggle the current dropdown menu
    console.log(`Before toggle: ${dropdownMenu.style.display}`);
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    console.log(`After toggle: ${dropdownMenu.style.display}`);

    // Stop propagation to prevent the document click listener from closing it immediately
    dropdownMenu.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    console.log(`Dropdown menu display style: ${dropdownMenu.style.display}`); // Debug log
}

function scheduleDisplayTimes(playlistId) {
    alert(`Schedule display times for playlist item: ${playlistId}`);
    // Implement your logic here
}

function setCustomTransition(playlistId) {
    alert(`Set a custom transition for playlist item: ${playlistId}`);
    // Implement your logic here
}

function moveItemUp(playlistId) {
    alert(`Move item up for playlist item: ${playlistId}`);
    // Implement your logic here
}

function moveItemDown(playlistId) {
    alert(`Move item down for playlist item: ${playlistId}`);
    // Implement your logic here
}

function duplicateItem(playlistId) {
    alert(`Duplicate item for playlist item: ${playlistId}`);
    // Implement your logic here
}

function removeFromPlaylist(playlistId) {
    alert(`Remove from playlist for item: ${playlistId}`);
    // Implement your logic here
}

function togglePlaylistOptionsMenu() {
    const menu = document.getElementById('playlist-options-menu');
    const icon = document.querySelector('.fas.fa-ellipsis-h');

    // Get the position of the ellipsis icon
    const rect = icon.getBoundingClientRect();

    // Toggle the visibility of the dropdown menu
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';

    // Set the position of the dropdown menu
    menu.style.position = 'absolute';
    menu.style.top = `${rect.bottom + window.scrollY}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;
}

function setPlaylistTransitions() {
    alert('Set Playlist Transitions');
}

function shufflePlay() {
    alert('Shuffle Play');
}

function copyPlaylistToOtherScreens() {
    alert('Copy Playlist to Other Screens');
}

function clearPlaylist() {
    alert('Clear Playlist');
}

function showTabContent(tabName) {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => button.classList.remove('active'));

    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.style.display = 'none');

    document.getElementById(tabName).style.display = 'block';
    document.querySelector(`.tab-button[onclick="showTabContent('${tabName}')"]`).classList.add('active');
}

function showDetailsSidebar() {
    const sidebar = document.getElementById('detailsSidebar');
    sidebar.style.width = '400px'; // Adjust width as needed
    sidebar.style.right = '0'; // Ensure it opens on the right
    sidebar.style.left = 'auto'; // Prevent it from opening on the left
}

function hideDetailsSidebar() {
    const sidebar = document.getElementById('detailsSidebar');
    sidebar.style.width = '0';
}

function showSidebarTabContent(tabName) {
    const tabButtons = document.querySelectorAll('.sidebar .tab-button');
    tabButtons.forEach(button => button.classList.remove('active'));

    const tabContents = document.querySelectorAll('.sidebar .tab-content');
    tabContents.forEach(content => content.style.display = 'none');

    document.getElementById(tabName).style.display = 'block';
    document.querySelector(`.sidebar .tab-button[onclick="showSidebarTabContent('${tabName}')"]`).classList.add('active');
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

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

window.onclick = function(event) {
    console.log(//console print logging
        '!event.target.matches(".user-name") && !event.target.matches(".fa-caret-down"):',//console print logging
        !event.target.matches('.user-name') && !event.target.matches('.fa-caret-down')
    );
    
    if (!event.target.matches('.user-name') && !event.target.matches('.fa-caret-down')) {
        var dropdownMenu = document.getElementById('dropdownMenu');
        if (dropdownMenu.style.display === 'block') {
            dropdownMenu.style.display = 'none';
        }
    }
}

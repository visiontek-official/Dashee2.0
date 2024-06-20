document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    const urlParams = new URLSearchParams(window.location.search);
    const screenId = urlParams.get('screenId');
    loadScreenDetails(screenId);
});

function loadScreenDetails(screenId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch(`/api/screen-details?screenId=${screenId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(screen => {
        document.getElementById('screenTitle').textContent = screen.screen_name;
        document.getElementById('currentScreenName').textContent = screen.screen_name;
        document.getElementById('screenDescription').textContent = screen.description;
        document.getElementById('lastSeen').textContent = `${screen.last_seen} days ago`;
        document.getElementById('screenThumbnail').src = screen.thumbnail || 'uploads/default-screen.png';
    })
    .catch(error => {
        console.error('Error fetching screen details:', error);
    });
}

function togglePlaylistOptionsMenu() {
    const menu = document.getElementById('playlist-options-menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
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
    document.getElementById('detailsSidebar').style.width = '400px'; // Adjust width as needed
}

function hideDetailsSidebar() {
    document.getElementById('detailsSidebar').style.width = '0';
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

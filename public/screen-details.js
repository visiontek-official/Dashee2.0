document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    const screenId = getScreenIdFromURL();
    console.log('Extracted screen ID:', screenId); // Log the extracted screen ID
    if (screenId) {
        console.log('Calling updateScreenDetails with screenId:', screenId);
        updateScreenDetails(screenId);
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

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
    console.log('User logged out of Screen-Detail page due to session that expired');
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
document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();

    const urlParams = new URLSearchParams(window.location.search);
    const screenId = urlParams.get('screenId');

    // Event listener to close the user dropdown when clicking outside
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

    loadScreenDetails(screenId);
});

function toggleOptionsMenu(screenId, element, event) {
    event.stopPropagation(); // Prevents the thumbnail click event
    const dropdownMenu = element.nextElementSibling;
    const rect = element.getBoundingClientRect();

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
    element.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    // Add event listeners to the cancel buttons in the dialog
    const cancelButtons = dropdownMenu.querySelectorAll('.cancel-button');
    cancelButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdownMenu.style.display = 'none'; // Close the dropdown menu
        });
    });
}

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
    console.log('User logged out');
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
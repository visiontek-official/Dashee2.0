document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    fetchUserPlaylists();
});

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
        if (data.error) throw new Error(data.error);

        document.querySelector('.user-name').innerHTML = `${data.firstname} ${data.lastname} <i class="fas fa-caret-down"></i>`;
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

function fetchUserPlaylists() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch('/api/user-playlists', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        displayPlaylists(data.playlists);
    })
    .catch(error => {
        console.error('Error fetching playlists:', error);
    });
}

function displayPlaylists(playlists) {
    const playlistContainer = document.getElementById('playlistContainer');
    if (!playlistContainer) {
        console.error('Playlist container not found');
        return;
    }

    playlistContainer.innerHTML = playlists.map(playlist => `
        <div class="playlist-group">
            <div class="playlist-header">
                <h3>${playlist.name}</h3>
                <p>Created on: ${new Date(playlist.createdAt).toLocaleDateString()}</p>
                <button class="delete-button" onclick="deletePlaylist(${playlist.ids.join(',')})">Delete</button>
            </div>
            <div class="playlist-items">
                ${playlist.file_paths.map(file_path => `
                    <div class="playlist-item">
                        <img src="${file_path}" alt="${playlist.name}" class="thumbnail">
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function deletePlaylist(ids) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch(`/api/delete-playlist`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
    })
    .then(response => {
        if (response.ok) {
            fetchUserPlaylists();
        } else {
            console.error('Failed to delete playlist');
        }
    })
    .catch(error => {
        console.error('Error deleting playlist:', error);
    });
}

function toggleDropdown() {
    var dropdownMenu = document.getElementById('dropdownMenu');
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
}

window.onclick = function(event) {
    if (!event.target.matches('.user-name') && !event.target.matches('.fa-caret-down')) {
        var dropdownMenu = document.getElementById('dropdownMenu');
        if (dropdownMenu.style.display === 'block') {
            dropdownMenu.style.display = 'none';
        }
    }
}
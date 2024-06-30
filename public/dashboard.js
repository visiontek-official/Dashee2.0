document.addEventListener('DOMContentLoaded', function() {
    loadDashboardData();
});

function toggleDropdown() {
    var dropdownMenu = document.getElementById('dropdownMenu');
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
}

function logout() {
    console.log('User logged out');
    localStorage.removeItem('token'); // Clear the token from local storage
    window.location.href = 'index.html';
}

window.onclick = function(event) {
    if (!event.target.matches('.user-name') && !event.target.matches('.fa-caret-down')) {
        var dropdownMenu = document.getElementById('dropdownMenu');
        if (dropdownMenu.style.display === 'block') {
            dropdownMenu.style.display = 'none';
        }
    }
}

function loadDashboardData() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = 'index.html';
        return;
    }

    fetch('/api/user-details', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch user details');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) throw new Error(data.error);

        const userNameElement = document.querySelector('.user-name');
        const profilePicElement = document.getElementById('profilePic');
        const userFullNameElement = document.getElementById('userFullName');
        const userMenuItemElement = document.getElementById('userMenuItem');

        if (userNameElement) {
            userNameElement.innerHTML = `${data.firstname} ${data.lastname} <i class="fas fa-caret-down"></i>`;
        }
        if (profilePicElement) {
            profilePicElement.src = data.profile_pic || 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png';
        }
        if (userFullNameElement) {
            userFullNameElement.innerText = `${data.firstname} ${data.lastname}`;
        }
        if (data.role === 'admin' && userMenuItemElement) {
            userMenuItemElement.style.display = 'block';
        }
    })
    .catch(error => {
        console.error('Error fetching user details:', error);
        window.location.href = 'index.html';
    });

    fetch('/api/statistics', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch statistics');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) throw new Error(data.error);

        const totalUsersElement = document.getElementById('totalUsers');
        const activeUsersElement = document.getElementById('activeUsers');
        const disabledUsersElement = document.getElementById('disabledUsers');
        const totalScreensElement = document.getElementById('totalScreens');
        const onlineScreensElement = document.getElementById('onlineScreens');
        const totalPlaylistsElement = document.getElementById('totalPlaylists');

        if (totalUsersElement) {
            totalUsersElement.textContent = data.totalUsers;
        }
        if (activeUsersElement) {
            activeUsersElement.textContent = data.activeUsers;
        }
        if (disabledUsersElement) {
            disabledUsersElement.textContent = data.disabledUsers;
        }
        if (totalScreensElement) {
            totalScreensElement.textContent = data.totalScreens;
        }
        if (onlineScreensElement) {
            onlineScreensElement.textContent = data.onlineScreens;
        }
        if (totalPlaylistsElement) {
            totalPlaylistsElement.textContent = data.totalPlaylists;
        }

        createChart('userChart', 'Total Users', data.dailyUsers, 'bar');
        createChart('screenChart', 'Total Screens', data.dailyScreens, 'line');
        createChart('playlistChart', 'Total Playlists', data.dailyPlaylists, 'bar');
    })
    .catch(error => {
        console.error('Error fetching statistics:', error);
    });
}

function createChart(chartId, label, data, type) {
    const ctx = document.getElementById(chartId).getContext('2d');
    new Chart(ctx, {
        type: type,
        data: {
            labels: data.map(item => new Date(item.date).toISOString().split('T')[0]), // Format date to yyyy-mm-dd
            datasets: [{
                label: label,
                data: data.map(item => item.count),
                backgroundColor: type === 'line' ? 'rgba(39, 144, 255, 0.2)' : '#263e4b', // Change bar color
                borderColor: '#263e4b',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    loadDashboardData();
    const token = localStorage.getItem('token');

    // Existing code...

    // Fetch past events and show notification icon if there are any
    fetchPastEvents();

    function fetchPastEvents() {
        fetch('/api/past-events', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                document.getElementById('notificationIcon').classList.add('has-notifications');
                updateNotificationList(data);
            } else {
                document.getElementById('notificationIcon').classList.remove('has-notifications');
            }
        })
        .catch(error => {
            console.error('Error fetching past events:', error);
        });
    }

    function updateNotificationList(events) {
        const notificationList = document.getElementById('notificationList');
        notificationList.innerHTML = '';

        events.forEach(event => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div class="event-info">
                    <span class="event-title">${event.title}</span>
                    <span class="event-time">${new Date(event.start).toLocaleString()}</span>
                    <span class="event-description">${event.description || ''}</span>
                </div>
                <span class="mark-as-read" onclick="markEventAsRead(${event.id})">&times;</span>
            `;
            listItem.dataset.eventId = event.id;
            notificationList.appendChild(listItem);
        });
    }

    function markEventAsRead(eventId) {
        fetch(`/api/mark-event-read/${eventId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (response.ok) {
                fetchPastEvents(); // Refresh notifications
                toggleNotificationDropdown();
            }
        })
        .catch(error => {
            console.error('Error marking event as read:', error);
        });
    }

    function clearAllNotifications() {
        fetch(`/api/mark-all-events-read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (response.ok) {
                fetchPastEvents(); // Refresh notifications
                toggleNotificationDropdown();
            }
        })
        .catch(error => {
            console.error('Error marking all events as read:', error);
        });
    }

    window.toggleNotificationDropdown = function() {
        const dropdown = document.getElementById('notificationDropdown');
        dropdown.classList.toggle('has-notifications');
    }

    window.toggleSidebar = function() {
        document.body.classList.toggle('sidebar-closed');
    }

    window.addEventListener('click', function(event) {
        const notificationIcon = document.getElementById('notificationIcon');
        const notificationDropdown = document.getElementById('notificationDropdown');

        if (!notificationDropdown.contains(event.target) && event.target !== notificationIcon) {
            notificationDropdown.classList.remove('has-notifications');
        }
    });
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

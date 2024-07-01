document.addEventListener('DOMContentLoaded', function() {
    loadTemplate('template-header', 'header-container');
    loadTemplate('template-sidebar', 'sidebar-container');

    // Fetch past events and show notification icon if there are any
    fetchPastEvents();
});

function loadTemplate(templateId, containerId) {
    fetch('template.html')
        .then(response => response.text())
        .then(data => {
            const template = document.createElement('div');
            template.innerHTML = data;
            const templateContent = template.querySelector(`#${templateId}`).innerHTML;
            document.getElementById(containerId).innerHTML = templateContent;

            // After loading the template, check user details
            if (templateId === 'template-sidebar') {
                loadUserDetails();
            }
        });
}

function loadUserDetails() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = 'index.html';
        return;
    }

    fetch('/api/user-details', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
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
}

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
    if (!event.target.matches('.user-name') && !event.target.matches('.fa-caret-down') && !event.target.matches('.notification-container')) {
        var dropdownMenu = document.getElementById('dropdownMenu');
        if (dropdownMenu.style.display === 'block') {
            dropdownMenu.style.display = 'none';
        }
        
        var notificationDropdown = document.getElementById('notificationDropdown');
        if (notificationDropdown.style.display === 'block') {
            notificationDropdown.style.display = 'none';
        }
    }
}

function toggleSidebar() {
    document.body.classList.toggle('sidebar-closed');
}

function fetchPastEvents() {
    const token = localStorage.getItem('token');
    fetch('/api/past-events', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        console.log('Fetched past events:', data);
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
            <span class="mark-as-read" onclick="markEventAsRead(${event.id})">x</span>
        `;
        notificationList.appendChild(listItem);
    });
}

function markEventAsRead(eventId) {
    const token = localStorage.getItem('token');
    fetch(`/api/mark-event-read/${eventId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
        if (response.ok) {
            fetchPastEvents(); // Refresh notifications
            const notificationList = document.getElementById('notificationList');
            if (notificationList.children.length === 1) {
                toggleNotificationDropdown(); // Close the dropdown
            }
        }
    })
    .catch(error => {
        console.error('Error marking event as read:', error);
    });
}

window.toggleNotificationDropdown = function() {
    const notificationDropdown = document.getElementById('notificationDropdown');
    notificationDropdown.classList.toggle('has-notifications');
};

window.clearAllNotifications = function() {
    console.log('Clear all notifications clicked');
    const token = localStorage.getItem('token');
    fetch(`/api/clear-all-notifications`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
        if (response.ok) {
            console.log('Notifications cleared successfully');
            fetchPastEvents(); // Refresh notifications
            const notificationDropdown = document.getElementById('notificationDropdown');
            notificationDropdown.style.display = 'none'; // Close the dropdown
        } else {
            console.error('Failed to clear notifications');
        }
    })
    .catch(error => {
        console.error('Error clearing notifications:', error);
    });
};

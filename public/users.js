function toggleDropdown() {
    var dropdownMenu = document.getElementById('dropdownMenu');
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
}

function logout() {
    console.log('User logged out');
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

window.onload = function() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = 'index.html';
        return;
    }

    console.log('Token found:', token);

    // Fetch user details
    fetch('/api/user-details', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);

        document.querySelector('.user-name').innerHTML = `${data.firstname} ${data.lastname} <i class="fas fa-caret-down"></i>`;
        document.getElementById('profilePic').src = data.profile_pic || 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png';

        if (data.role === 'admin') {
            document.getElementById('userMenuItem').innerHTML = '<a href="users.html"><i class="fas fa-user"></i> Users <i class="fas fa-arrow-right"></i></a>';
            loadUsers();
        } else {
            window.location.href = 'dashboard.html';
        }
    })
    .catch(error => {
        console.error('Error fetching user details:', error);
        window.location.href = 'index.html';
    });
};

function loadUsers() {
    const token = localStorage.getItem('token');

    fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);

        const userTableBody = document.querySelector('#userTable tbody');
        userTableBody.innerHTML = ''; // Clear existing rows

        data.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="user-data" data-id="${user.id}" data-field="firstname">${user.firstname}</td>
                <td class="user-data" data-id="${user.id}" data-field="lastname">${user.lastname}</td>
                <td class="user-data" data-id="${user.id}" data-field="email">${user.email}</td>
                <td class="user-data" data-id="${user.id}" data-field="role">${user.role}</td>
                <td class="user-data" data-id="${user.id}" data-field="enabled">${user.enabled}</td>
                <td class="user-data" data-id="${user.id}" data-field="profile_pic">
                    <img src="${user.profile_pic}" alt="Profile Pic" class="profile-pic-small">
                </td>
                <td>
                    <button class="edit-button" onclick="editUser(${user.id})">Edit</button>
                </td>
            `;
            userTableBody.appendChild(row);
        });
    })
    .catch(error => {
        console.error('Error fetching users:', error);
    });
}

function editUser(userId) {
    const token = localStorage.getItem('token');

    fetch(`/api/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(user => {
        if (user.error) throw new Error(user.error);

        console.log('Fetched user details:', user); // Log fetched user details

        if (!user.id) {
            throw new Error('Invalid user data received from server');
        }

        document.getElementById('editUserId').value = user.id;
        document.getElementById('editFirstname').value = user.firstname || '';
        document.getElementById('editLastname').value = user.lastname || '';
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('editRole').value = user.role || '';
        document.getElementById('editEnabled').value = user.enabled !== undefined ? user.enabled : '';

        document.getElementById('editUserModal').style.display = 'block';
    })
    .catch(error => {
        console.error('Error fetching user details:', error);
        alert('An error occurred. Please try again.');
    });
}

document.getElementById('editUserForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const token = localStorage.getItem('token');
    const formData = new FormData(this);

    fetch('/api/update-user', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        alert('User updated successfully');
        document.getElementById('editUserModal').style.display = 'none';
        loadUsers(); // Reload the users list
    })
    .catch(error => {
        console.error('Error updating user:', error);
        alert('An error occurred. Please try again.');
    });
});

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
        if (dropdownMenu && dropdownMenu.style.display === 'block') {
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
                <td class="user-data" data-id="${user.id}" data-field="firstname">
                    <span>${user.firstname}</span>
                    <input type="text" value="${user.firstname}" style="display: none;">
                </td>
                <td class="user-data" data-id="${user.id}" data-field="lastname">
                    <span>${user.lastname}</span>
                    <input type="text" value="${user.lastname}" style="display: none;">
                </td>
                <td class="user-data" data-id="${user.id}" data-field="email">
                    <span>${user.email}</span>
                    <input type="email" value="${user.email}" style="display: none;">
                </td>
                <td class="user-data" data-id="${user.id}" data-field="role">
                    <span>${user.role}</span>
                    <select style="display: none;">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td class="user-data" data-id="${user.id}" data-field="enabled">
                    <span>${user.enabled ? 'Yes' : 'No'}</span>
                    <select style="display: none;">
                        <option value="1" ${user.enabled ? 'selected' : ''}>Yes</option>
                        <option value="0" ${!user.enabled ? 'selected' : ''}>No</option>
                    </select>
                </td>
                <td class="user-data" data-id="${user.id}" data-field="profilePic">
                    <img src="${user.profile_pic}" alt="Profile Pic" class="profile-pic-small">
                    <input type="file" style="display: none;">
                </td>
                <td>
                    <button class="edit-button" onclick="toggleEditMode(${user.id})">Edit</button>
                    <button class="save-button" onclick="saveUser(${user.id})" style="display: none;">Save</button>
                </td>
            `;
            userTableBody.appendChild(row);
        });
    })
    .catch(error => {
        console.error('Error fetching users:', error);
    });
}

function toggleEditMode(userId) {
    const row = document.querySelector(`.user-data[data-id="${userId}"]`).parentNode;
    const isEditing = row.classList.contains('editing');

    if (isEditing) {
        row.classList.remove('editing');
        row.querySelectorAll('span').forEach(el => el.style.display = '');
        row.querySelectorAll('input, select').forEach(el => el.style.display = 'none');
        row.querySelector('.edit-button').style.display = '';
        row.querySelector('.save-button').style.display = 'none';
    } else {
        row.classList.add('editing');
        row.querySelectorAll('span').forEach(el => el.style.display = 'none');
        row.querySelectorAll('input, select').forEach(el => el.style.display = '');
        row.querySelector('.edit-button').style.display = 'none';
        row.querySelector('.save-button').style.display = '';
    }
}

function validateFile(file) {
    const allowedFormats = ['image/jpeg', 'image/png', 'video/mp4'];
    if (file && !allowedFormats.includes(file.type)) {
        alert('Invalid file format. Please upload a JPEG, PNG, or MP4 file.');
        return false;
    }
    return true;
}

function saveUser(userId) {
    const row = document.querySelector(`.user-data[data-id="${userId}"]`).parentNode;
    const token = localStorage.getItem('token');
    const formData = new FormData();

    formData.append('id', userId);
    let valid = true;

    row.querySelectorAll('.user-data').forEach(cell => {
        const field = cell.dataset.field;
        const input = cell.querySelector('input, select');

        if (input.type === 'file' && input.files.length > 0) {
            if (!validateFile(input.files[0])) {
                valid = false;
                return;
            }
            formData.append('profilePic', input.files[0]); // Ensure this matches the Multer configuration
        } else {
            formData.append(field, input.value);
        }
    });

    if (!valid) return;

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
        toggleEditMode(userId); // Exit edit mode
        location.reload(); // Refresh the page to show updated details
    })
    .catch(error => {
        console.error('Error updating user:', error);
        alert('An error occurred. Please try again.');
    });
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000); // Hide after 3 seconds
}

function validateFile(file) {
    const allowedFormats = ['image/jpeg', 'image/png', 'video/mp4'];
    if (file && !allowedFormats.includes(file.type)) {
        showNotification('Invalid file format. Please upload a JPEG, PNG, or MP4 file.');
        return false;
    }
    return true;
}

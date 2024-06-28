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
        document.getElementById('profileThumbnail').src = data.profile_pic || 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png';
        document.getElementById('firstname').value = data.firstname;
        document.getElementById('lastname').value = data.lastname;
        document.getElementById('email').value = data.email;

        if (data.role === 'admin') {
            document.getElementById('userMenuItem').innerHTML = '<a href="users.html"><i class="fas fa-user"></i> Users <i class="fas fa-arrow-right"></i></a>';
        }
    })
    .catch(error => {
        console.error('Error fetching user details:', error);
        window.location.href = 'index.html';
    });
};

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

// Add event listener for form submission to handle profile update
document.getElementById('profileForm').addEventListener('submit', function(event) {
    event.preventDefault();

    console.log('Profile form submitted');
    
    const token = localStorage.getItem('token');
    const formData = new FormData();

    // Retrieve the current values from the form
    const currentFirstname = document.getElementById('firstname').value || '';
    const currentLastname = document.getElementById('lastname').value || '';
    const currentEmail = document.getElementById('email').value || '';
    const currentPassword = document.getElementById('password').value || '';

    // Append the form values to formData, ensuring all fields are included
    formData.append('firstname', currentFirstname);
    formData.append('lastname', currentLastname);
    formData.append('email', currentEmail);
    formData.append('password', currentPassword);

    const profilePicInput = document.getElementById('profilePicInput');
    if (profilePicInput.files.length > 0) {
        if (!validateFile(profilePicInput.files[0])) {
            return; // Stop the form submission if file validation fails
        }
        formData.append('profilePic', profilePicInput.files[0]);
    }

    console.log('Form data prepared for submission:', formData);

    fetch('/api/update-profile', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        console.log('Profile updated successfully:', data);
        showNotification('Profile updated successfully');
        location.reload(); // Refresh the page to show updated details
    })
    .catch(error => {
        console.error('Error updating profile:', error);
        showNotification('Failed to update profile');
    });
});

// Add event listener for the clear button
document.getElementById('clearButton').addEventListener('click', function() {
    document.getElementById('firstname').value = '';
    document.getElementById('lastname').value = '';
    document.getElementById('email').value = '';
    document.getElementById('profilePicInput').value = '';
});

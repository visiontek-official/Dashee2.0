document.addEventListener('DOMContentLoaded', function() {
    loadTemplate('template-header', 'header-container');
    loadTemplate('template-sidebar', 'sidebar-container');
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
    if (!event.target.matches('.user-name') && !event.target.matches('.fa-caret-down')) {
        var dropdownMenu = document.getElementById('dropdownMenu');
        if (dropdownMenu.style.display === 'block') {
            dropdownMenu.style.display = 'none';
        }
    }
}

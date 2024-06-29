document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();

    document.getElementById('supportForm').addEventListener('submit', function (event) {
        event.preventDefault();
        sendSupportRequest();
    });
});

function toggleDropdown() {
    var dropdownMenu = document.getElementById('dropdownMenu');
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

window.onclick = function (event) {
    if (!event.target.matches('.user-name') && !event.target.matches('.fa-caret-down')) {
        var dropdownMenu = document.getElementById('dropdownMenu');
        if (dropdownMenu && dropdownMenu.style.display === 'block') {
            dropdownMenu.style.display = 'none';
        }
    }
}

function loadUserDetails() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

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
        }
    })
    .catch(error => {
        console.error('Error fetching user details:', error);
        window.location.href = 'index.html';
    });
}

function sendSupportRequest() {
    const form = document.getElementById('supportForm');
    const formData = new FormData(form);
    const sendButton = form.querySelector('button[type="submit"]');

    sendButton.textContent = 'Sending...';
    sendButton.disabled = true;

    const recaptchaResponse = grecaptcha.getResponse();

    if (!recaptchaResponse) {
        showNotification('Please complete the reCAPTCHA', 'error');
        sendButton.textContent = 'Send Request';
        sendButton.disabled = false;
        return;
    }

    formData.append('recaptcha', recaptchaResponse);

    fetch('/api/send-support-request', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        showNotification('Support request sent successfully.', 'success');
        form.reset();
        grecaptcha.reset();
    })
    .catch(error => {
        console.error('Error sending support request:', error);
        showNotification('Failed to send support request. Please try again later.', 'error');
    })
    .finally(() => {
        sendButton.textContent = 'Send Request';
        sendButton.disabled = false;
    });
}

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000); // Hide after 5 seconds
}

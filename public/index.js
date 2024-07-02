document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'true') {
        showNotification('Email verified successfully. You can now log in.');
    }
});

function closeNotification() {
    const notification = document.getElementById('notification');
    const body = document.body;
    notification.classList.remove('show');
    body.classList.remove('blurred'); // Remove blur effect
}

document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Change button text to "Logging in..."
    const loginButton = document.querySelector('#loginForm button[type="submit"]');
    loginButton.textContent = 'Logging in...';
    loginButton.disabled = true; // Optionally disable the button to prevent multiple clicks

    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            localStorage.setItem('token', data.token);
            window.location.href = 'dashboard.html';
        } else if (data.resendVerification) {
            showNotification(`Your email is not verified. Please check your inbox for the verification email. <button class="button" onclick="resendVerificationEmail('${email}')">Resend Verification Email</button>`);

            loginButton.textContent = 'Login'; // Reset button text if email is not verified
            loginButton.disabled = false; // Re-enable the button if email is not verified
        } else {
            document.getElementById('loginError').textContent = data.message;
            loginButton.textContent = 'Login'; // Reset button text if login fails
            loginButton.disabled = false; // Re-enable the button if login fails
        }
    })
    .catch(error => {
        console.error('Error:', error);
        loginButton.textContent = 'Login'; // Reset button text if an error occurs
        loginButton.disabled = false; // Re-enable the button if an error occurs
    });
});

function showNotification(message) {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
    const body = document.body;

    notificationMessage.innerHTML = message;
    notification.classList.add('show');
    body.classList.add('blurred'); // Blur the background
}

function resendVerificationEmail(email) {
    const resendButton = document.querySelector('.notification button');
    resendButton.innerText = 'Sending Email...';

    fetch('/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    })
    .then(response => response.json())
    .then(data => {
        const notificationMessage = document.getElementById('notificationMessage');
        notificationMessage.innerText = data.message;

        if (data.success) {
            setTimeout(() => {
                closeNotification();
            }, 3000); // Close the notification after 3 seconds
        } else {
            resendButton.innerText = 'Resend Verification Email';
        }
    })
    .catch(error => {
        console.error('Error resending verification email:', error);
        resendButton.innerText = 'Resend Verification Email';
    });
}
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const submitButton = document.querySelector('button[type="submit"]');

        submitButton.textContent = 'Sending password link...';
        submitButton.disabled = true;

        try {
            const response = await fetch('/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const result = await response.json();

            if (response.ok) {
                showNotification(result.message, 'success');
                document.getElementById('forgotPasswordError').innerText = '';
            } else {
                showNotification(result.message, 'error');
                document.getElementById('forgotPasswordError').innerText = result.message;
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('An error occurred while processing your request.', 'error');
            document.getElementById('forgotPasswordError').innerText = 'An error occurred while processing your request.';
        } finally {
            submitButton.textContent = 'Reset Password';
            submitButton.disabled = false;
        }
    });
});

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000); // Hide after 5 seconds
}

function toggleDropdown() {
    var dropdownMenu = document.getElementById('dropdownMenu');
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
}

function logout() {
    console.log('User logged out');//console print logging
    window.location.href = 'index.html';
}

window.onclick = function(event) {
    console.log(//console print logging
        '!event.target.matches(".user-name") && !event.target.matches(".fa-caret-down"):',//console print logging
        !event.target.matches('.user-name') && !event.target.matches('.fa-caret-down')
    );
    
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
        document.getElementById('userFullName').innerText = `${data.firstname} ${data.lastname}`;

        if (data.role === 'admin') {
            document.getElementById('userMenuItem').innerHTML = '<a href="users.html"><i class="fas fa-user"></i> Users <i class="fas fa-arrow-right"></i></a>';
        }
    })
    .catch(error => {
        console.error('Error fetching user details:', error);
        window.location.href = 'index.html';
    });

    // Fetch statistics
    fetch('/api/statistics', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);

        document.getElementById('totalUsers').textContent = data.totalUsers;
        document.getElementById('activeUsers').textContent = data.activeUsers;
        document.getElementById('disabledUsers').textContent = data.disabledUsers;
        document.getElementById('totalScreens').textContent = data.totalScreens;
    })
    .catch(error => {
        console.error('Error fetching statistics:', error);
        window.location.href = 'index.html';
    });
};

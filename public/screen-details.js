document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const screenId = params.get('screenId');
    const screenName = params.get('screenName');

    if (screenName) {
        document.getElementById('screenName').textContent = screenName;
    }

    if (screenId) {
        loadScreenDetails(screenId);
    }

    const userMenu = document.querySelector('.user-menu');
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');

    dropdownToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (event) => {
        if (!userMenu.contains(event.target)) {
            dropdownMenu.style.display = 'none';
        }
    });
});

function loadScreenDetails(screenId) {
    fetch(`/getScreenDetails?screenId=${screenId}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('screenStatus').textContent = data.enabled ? 'Online' : 'Offline';
            document.getElementById('lastSeen').textContent = `Last seen ${data.last_connected}`;
            document.getElementById('screenDetailsLink').href = `screen-details.html?screenId=${screenId}`;
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

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
    fetch('/getUserDetails')
        .then(response => response.json())
        .then(data => {
            document.getElementById('userName').innerHTML = data.firstName + ' ' + data.lastName + ' <i class="fas fa-caret-down"></i>';
            document.getElementById('profilePic').src = data.profilePic || 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png';

            if (data.role === 'admin') {
                document.getElementById('userMenuItem').innerHTML = '<a href="users.html"><i class="fas fa-user"></i> Users <i class="fas fa-arrow-right"></i></a>';
            }
        })
        .catch(error => console.error('Error fetching user details:', error));

    fetchFiles(); // Fetch files on load
};

function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const screenId = params.get('screenId');
    const screenName = params.get('screenName');

    if (screenName) {
        document.getElementById('screenName').textContent = screenName;
        document.getElementById('breadcrumbScreenName').textContent = screenName;
    }

    if (screenId) {
        loadScreenDetails(screenId);
    }

    const userMenu = document.querySelector('.user-menu');
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');

    dropdownToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (event) => {
        if (!userMenu.contains(event.target)) {
            dropdownMenu.style.display = 'none';
        }
    });
});


function loadScreenDetails(screenId) {
    fetch(`/getScreenDetails?screenId=${screenId}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('screenName').textContent = data.screen_name;
            document.getElementById('screenStatus').textContent = data.enabled ? 'Online' : 'Offline';
            document.getElementById('lastSeen').textContent = `Last seen ${data.last_connected}`;
            document.getElementById('screenDetailsLink').href = `screen-details.html?screenId=${screenId}`;
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

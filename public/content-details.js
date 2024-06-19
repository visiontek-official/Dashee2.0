document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    const urlParams = new URLSearchParams(window.location.search);
    const fileName = urlParams.get('file');
    loadFileDetails(fileName);
    updateBreadcrumb();

    const userMenu = document.querySelector('.user-menu');
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');

    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
        });

        document.addEventListener('click', (event) => {
            if (!userMenu.contains(event.target)) {
                dropdownMenu.style.display = 'none';
            }
        });
    }
});

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    const currentPage = document.getElementById('fileName').textContent;

    const breadcrumbHtml = `
        <a href="content.html">Content</a> / 
        <span>${currentPage}</span>
    `;

    breadcrumb.innerHTML = breadcrumbHtml;
}

function updateBreadcrumb(fileName) {
    console.log('Updating breadcrumb with file name:', fileName);
    const breadcrumb = document.getElementById('breadcrumb');

    const breadcrumbHtml = `
        <a href="content.html">Content</a> / 
        <span>${fileName}</span>
    `;

    breadcrumb.innerHTML = breadcrumbHtml;
}

function toggleDropdown() {
    var dropdownMenu = document.getElementById('dropdownMenu');
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
}

function logout() {
    console.log('User logged out');
    window.location.href = 'index.html';
}

function loadUserDetails() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch('/api/user-details', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        document.getElementById('userName').innerHTML = `${data.firstname} ${data.lastname} <i class="fas fa-caret-down"></i>`;
        document.getElementById('profilePic').src = data.profile_pic || 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png';

        if (data.role === 'admin') {
            document.getElementById('userMenuItem').style.display = 'block';
        }
    })
    .catch(error => {
        console.error('Error fetching user details:', error);
        window.location.href = 'index.html';
    });
}

function loadFileDetails(fileName) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch(`/api/file-details?file=${fileName}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }

        // Populate fields with fetched data
        document.getElementById('fileName').textContent = data.file_name;
        document.getElementById('fileImage').src = data.file_path;
        document.getElementById('title').value = data.file_name.split('.').slice(0, -1).join('.');
        document.getElementById('description').value = data.file_description;
        document.getElementById('tags').value = data.file_tags;
        document.getElementById('schedule-start').value = data.file_schedule_start;
        document.getElementById('schedule-end').value = data.file_schedule_end;

        // Calculate "Updated X days ago"
        const uploadedDate = new Date(data.upload_date);
        const now = new Date();
        const daysAgo = Math.floor((now - uploadedDate) / (1000 * 60 * 60 * 24));
        document.getElementById('uploaded').textContent = `Updated ${daysAgo} days ago`;

        // Display file size appropriately
        let displaySize = `${data.file_size} KB`;
        if (data.file_size > 1000) {
            displaySize = `${(data.file_size / 1000).toFixed(2)} MB`;
        }
        document.getElementById('size').textContent = displaySize;

        document.getElementById('type').textContent = data.file_type;
        document.getElementById('orientation').textContent = data.file_orientation;
        document.getElementById('dimensions').textContent = data.file_dimensions;

        updateBreadcrumb(data.file_name);
    })
    .catch(error => {
        console.error('Error fetching file details:', error);
        window.location.href = 'index.html';
    });
}

document.getElementById('saveChanges').addEventListener('click', () => {
    const fileName = new URLSearchParams(window.location.search).get('file');
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const tags = document.getElementById('tags').value;
    const scheduleStart = document.getElementById('schedule-start').value;
    const scheduleEnd = document.getElementById('schedule-end').value;
    const size = document.getElementById('size').textContent;
    const orientation = document.getElementById('orientation').textContent;
    const dimensions = document.getElementById('dimensions').textContent;

    const updatedFileName = `${title}.${fileName.split('.').pop()}`; // Add extension back to title

    const token = localStorage.getItem('token');
    fetch('/api/save-file-details', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            file: fileName,
            title: updatedFileName,
            description,
            tags,
            schedule_start: scheduleStart,
            schedule_end: scheduleEnd,
            size,
            orientation,
            dimensions
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('File details saved successfully');
            window.location.reload();
        } else {
            alert('Failed to save file details');
        }
    })
    .catch(error => {
        console.error('Error saving file details:', error);
    });
});

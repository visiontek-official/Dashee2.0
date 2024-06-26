document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    const urlParams = new URLSearchParams(window.location.search);
    const fileName = urlParams.get('file');
    loadFileDetails(fileName);
    updateBreadcrumb(fileName);

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
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

function loadUserDetails() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No token provided, redirecting to login');
        window.location.href = 'index.html';
        return;
    }

    fetch('/api/user-details', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch user details');
        }
        return response.json();
    })
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
        console.error('No token provided, redirecting to login');
        window.location.href = 'index.html';
        return;
    }

    fetch(`/api/file-details?file=${fileName}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch file details');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }

        // Log the entire response data to inspect its structure
        console.log('API response data:', data);

        // Check for the presence of file_type and file_path
        console.log('Keys in data:', Object.keys(data));

        // Log content type and file path
        console.log('Content type:', data.file_type);
        console.log('File path:', data.file_path);

        // Populate fields with fetched data
        document.getElementById('fileName').textContent = data.file_name;

        const fileImageContainer = document.getElementById('fileImageContainer');
        fileImageContainer.innerHTML = ''; // Clear existing content

        // Check if the file is a video
        if (data.file_type && data.file_type.startsWith('video/')) {
            const videoElement = document.createElement('video');
            videoElement.controls = true;
            videoElement.classList.add('content-video');
            videoElement.innerHTML = `
                <source src="${data.file_path}" type="${data.file_type}">
                Your browser does not support the video tag.
            `;
            fileImageContainer.appendChild(videoElement);
        } else {
            const imageElement = document.createElement('img');
            imageElement.id = 'fileImage';
            imageElement.src = data.file_path;
            imageElement.alt = 'File Image';
            imageElement.classList.add('content-image');
            fileImageContainer.appendChild(imageElement);
        }

        document.getElementById('title').value = data.file_name.split('.').slice(0, -1).join('.');
        document.getElementById('description').value = data.file_description;
        document.getElementById('tags').value = data.file_tags;

         // Fix date format issue
         document.getElementById('schedule-start').value = formatDateTime(data.file_schedule_start);
         document.getElementById('schedule-end').value = formatDateTime(data.file_schedule_end); 

        // Calculate "Updated X days ago"
        const uploadedDate = new Date(data.upload_date.split(' ')[0]); // Strip time
        const now = new Date();
        const daysAgo = Math.floor((now - uploadedDate) / (1000 * 60 * 60 * 24));
        document.getElementById('uploaded').textContent = `Updated ${daysAgo} days ago`;

        // Display file size appropriately
        let displaySize = `${data.file_size}`;
        if (data.file_size > 1000) {
            displaySize = `${(data.file_size / 1000).toFixed(2)}`;
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

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '';
    const dateTime = new Date(dateTimeString.replace(' ', 'T'));
    return dateTime.toISOString().slice(0, 16);
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

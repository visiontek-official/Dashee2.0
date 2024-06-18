document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    fetchFiles();

    const userMenu = document.querySelector('.user-menu');
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');

    dropdownToggle.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent the click from bubbling up
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (event) => {
        if (!userMenu.contains(event.target)) {
            dropdownMenu.style.display = 'none';
        }
    });
});

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
    .then(response => {
        if (response.status !== 200) {
            throw new Error('Failed to authenticate');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        document.getElementById('userName').innerHTML = `${data.firstName} ${data.lastName} <i class="fas fa-caret-down"></i>`;
        document.getElementById('profilePic').src = data.profilePic || 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png';

        if (data.role === 'admin') {
            document.getElementById('userMenuItem').innerHTML = '<a href="users.html"><i class="fas fa-user"></i> Users <i class="fas fa-arrow-right"></i></a>';
        }
    })
    .catch(error => {
        console.error('Error fetching user details:', error);
        window.location.href = 'index.html';
    });
}

let currentFolder = '';

function fetchFiles(folder = '') {
    currentFolder = folder;
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch('/api/files', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ folder: folder })
    })
    .then(response => {
        if (response.status !== 200) {
            throw new Error('Failed to fetch files');
        }
        return response.json();
    })
    .then(files => {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = ''; // Clear existing thumbnails
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'thumbnail';
            fileItem.draggable = true; // Make file item draggable
            fileItem.ondragstart = (event) => {
                event.dataTransfer.setData('text/plain', file.name);
            };
            let thumbnailContent;
            if (file.type === 'folder') {
                thumbnailContent = `<i class="fas fa-folder file-icon"></i>`;
                fileItem.onclick = () => {
                    openFolder(file.name);
                };
            } else if (file.type === 'image') {
                thumbnailContent = `<img src="${file.path}" alt="${file.name}">`;
            } else if (file.type === 'video') {
                thumbnailContent = `<video src="${file.path}" alt="${file.name}" controls></video>`;
            } else {
                thumbnailContent = `<i class="fas fa-file file-icon"></i>`;
            }
            fileItem.innerHTML = `
                ${thumbnailContent}
                <div class="file-info">
                    <div class="file-details">
                        <strong>${file.name}</strong>
                        <span>${file.uploadDate}</span>
                    </div>
                </div>
                <div class="options" onclick="toggleOptionsMenu('${file.name}', this)"><i class="fas fa-ellipsis-h"></i></div>
                <div class="dropdown-menu">
                    ${file.type !== 'folder' ? `
                    <a href="#" onclick="renameFile('${file.name}')">Rename</a>
                    <a href="#" onclick="deleteFile('${file.name}')">Delete</a>
                    ` : `
                    <a href="#" onclick="openFolder('${file.name}')">Open</a>
                    <a href="#" onclick="renameFile('${file.name}')">Rename</a>
                    <a href="#" onclick="deleteFile('${file.name}')">Delete</a>
                    `}
                </div>
            `;
            fileList.appendChild(fileItem);
        });

        updateBreadcrumb();
    })
    .catch(error => {
        console.error('Error fetching files:', error);
        window.location.href = 'index.html';
    });
}

function openFolder(folderName) {
    fetchFiles(`${currentFolder}/${folderName}`);
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    const folders = currentFolder.split('/').filter(Boolean);
    let path = '';
    breadcrumb.innerHTML = '';
    folders.forEach((folder, index) => {
        path += folder + '/';
        const breadcrumbItem = document.createElement('span');
        breadcrumbItem.textContent = folder;
        breadcrumbItem.style.cursor = 'pointer';
        breadcrumbItem.onclick = () => {
            fetchFiles(path.slice(0, path.length - 1));
        };
        breadcrumb.appendChild(breadcrumbItem);
        if (index < folders.length - 1) {
            const separator = document.createElement('span');
            separator.textContent = ' / ';
            breadcrumb.appendChild(separator);
        }
    });
}

function openUploadPopup() {
    document.getElementById('uploadPopup').style.display = 'flex';
}

function closeUploadPopup() {
    document.getElementById('uploadPopup').style.display = 'none';
}

function openFolderPopup() {
    document.getElementById('folderPopup').style.display = 'flex';
    document.getElementById('folderNameInput').style.display = 'block'; // Ensure the input is displayed
}

function closeFolderPopup() {
    document.getElementById('folderPopup').style.display = 'none';
}

document.getElementById('dragArea').addEventListener('dragover', function(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('dragArea').classList.add('drag-over');
});

document.getElementById('dragArea').addEventListener('dragleave', function(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('dragArea').classList.remove('drag-over');
});

document.getElementById('dragArea').addEventListener('drop', function(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('dragArea').classList.remove('drag-over');
    const files = event.dataTransfer.files;
    uploadFiles(files);
});

function uploadFiles(files) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i]);
    }
    formData.append('folder', currentFolder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload-file', true);

    xhr.upload.onprogress = function(event) {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            document.getElementById('progressBarFill').style.width = percentComplete + '%';
            document.getElementById('progressBarFill').textContent = Math.round(percentComplete) + '%';
        }
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            alert('File uploaded successfully');
            closeUploadPopup();
            fetchFiles(); // Refresh file list
        } else {
            alert('File upload failed');
        }
    };

    xhr.send(formData);
}

function createFolder() {
    const folderName = document.getElementById('folderNameInput').value;
    fetch('/api/create-folder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ folderName: folderName, currentFolder: currentFolder })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Folder created successfully');
            closeFolderPopup();
            fetchFiles(); // Refresh file list
        } else {
            alert('Failed to create folder: ' + data.message);
        }
    })
    .catch(error => console.error('Error creating folder:', error));
}

function renameFile(fileName) {
    const newName = prompt('Enter new name for the file/folder:', fileName);
    if (newName) {
        fetch('/api/rename-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ oldName: fileName, newName: newName, currentFolder: currentFolder })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('File renamed successfully');
                fetchFiles(); // Refresh file list
            } else {
                alert('Failed to rename file: ' + data.message);
            }
        })
        .catch(error => console.error('Error renaming file:', error));
    }
}

function deleteFile(fileName) {
    if (confirm('Are you sure you want to delete this file?')) {
        fetch('/api/delete-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ fileName: fileName, currentFolder: currentFolder })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('File deleted successfully');
                fetchFiles(); // Refresh file list
            } else {
                alert('Failed to delete file: ' + data.message);
            }
        })
        .catch(error => console.error('Error deleting file:', error));
    }
}

function toggleOptionsMenu(fileName, element) {
    const menu = element.nextElementSibling;
    const allDropdowns = document.querySelectorAll('.dropdown-menu');
    allDropdowns.forEach(dropdown => {
        if (dropdown !== menu) {
            dropdown.style.display = 'none';
        }
    });
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

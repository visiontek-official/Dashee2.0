document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    fetchFiles();

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

    document.getElementById('fileInput').addEventListener('change', function() {
        if (this.files.length > 0) {
            document.getElementById('dragArea').innerHTML = `<div class="file-selected">Selected: ${this.files[0].name}</div>`;
            document.getElementById('dragArea').classList.add('uploaded');
        }
    });

    // Event listener to close the options dropdown when clicking outside
    document.addEventListener('click', (event) => {
        const dropdownMenus = document.querySelectorAll('.dropdown-options-menu');
        dropdownMenus.forEach(menu => {
            if (!menu.contains(event.target) && !menu.previousElementSibling.contains(event.target)) {
                menu.style.display = 'none';
            }
        });
    });
});

function toggleOptionsMenu(screenId, element, event) {
    event.stopPropagation(); // Prevents the thumbnail click event
    const dropdownMenu = element.nextElementSibling;
    const rect = element.getBoundingClientRect();

    // Close all other dropdown menus
    const dropdownMenus = document.querySelectorAll('.dropdown-options-menu');
    dropdownMenus.forEach(menu => {
        if (menu !== dropdownMenu) {
            menu.style.display = 'none';
        }
    });

    // Toggle the current dropdown menu
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    dropdownMenu.style.position = 'absolute';
    dropdownMenu.style.top = `${rect.bottom}px`;
    dropdownMenu.style.left = `${rect.left}px`;

    // Stop propagation to prevent the document click listener from closing it immediately
    element.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    // Add event listeners to the cancel buttons in the dialog
    const cancelButtons = dropdownMenu.querySelectorAll('.cancel-button');
    cancelButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdownMenu.style.display = 'none'; // Close the dropdown menu
        });
    });
}

/*
function toggleOptionsMenu(fileName, element) {
    const dropdownMenu = element.nextElementSibling;
    const rect = element.getBoundingClientRect();

    // Close all other dropdown menus
    const dropdownMenus = document.querySelectorAll('.dropdown-options-menu');
    dropdownMenus.forEach(menu => {
        if (menu !== dropdownMenu) {
            menu.style.display = 'none';
        }
    });

    // Toggle the current dropdown menu
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    dropdownMenu.style.position = 'absolute';
    dropdownMenu.style.top = `${rect.bottom}px`;
    dropdownMenu.style.left = `${rect.left}px`;

    // Stop propagation to prevent the document click listener from closing it immediately
    element.addEventListener('click', (event) => {
        event.stopPropagation();
    });
}
*/

function fetchFiles() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch('/api/get-files', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(files => {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'thumbnail';
            fileItem.draggable = true;
            fileItem.ondragstart = (event) => {
                event.dataTransfer.setData('text/plain', file.name);
            };
            fileItem.onclick = (event) => {
                if (event.target.classList.contains('fas') || event.target.tagName === 'A') {
                    return; // Prevents opening file when clicking on the options
                }
                openFile(file.name);
            };
            let thumbnailContent;
            if (file.type.startsWith('image/')) {
                thumbnailContent = `<img src="${file.path}" alt="${file.name}">`;
            } else if (file.type.startsWith('video/')) {
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
                <div class="options" onclick="toggleOptionsMenu('${file.name}', this, event)">
                    <i class="fas fa-ellipsis-h"></i>
                </div>
                <div class="dropdown-options-menu">
                    <a href="content-details.html?file=${file.name}">Open</a>
                    <a href="#" onclick="renameFile('${file.name}')">Rename</a>
                    <a href="#" onclick="deleteFile('${file.name}')">Delete</a>
                </div>
            `;
            fileList.appendChild(fileItem);
        });
    })
    .catch(error => {
        console.error('Error fetching files:', error);
        window.location.href = 'index.html';
    });
}

function uploadFiles() {
    const files = document.getElementById('fileInput').files;
    if (files.length === 0) {
        alert('Please select a file to upload');
        return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i]);
    }

    const token = localStorage.getItem('token');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload-file', true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = function(event) {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            document.getElementById('progressBarFill').style.width = percentComplete + '%';
            document.getElementById('progressBarFill').textContent = Math.round(percentComplete) + '%';
        }
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
                alert('File uploaded successfully');
                closeUploadPopup();
                fetchFiles();  // Fetch files after successful upload
            } else {
                alert('File upload failed');
            }
        } else {
            alert('Error uploading file');
        }
    };

    xhr.send(formData);
}

function updateFiles() {
    const files = document.getElementById('fileInput').files;
    if (files.length === 0) {
        alert('Please select a file to upload');
        return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i]);
    }

    const token = localStorage.getItem('token');
    fetch('/api/upload-file', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('File updated successfully');
            document.getElementById('dragArea').innerHTML = `Uploaded: ${files[0].name}`;
            document.getElementById('dragArea').classList.add('uploaded');
            closeUploadPopup();
            fetchFiles();
        } else {
            alert('File update failed');
        }
    })
    .catch(error => {
        console.error('Error updating file:', error);
        alert('Error updating file');
    });
}

function openUploadPopup() {
    document.getElementById('uploadPopup').style.display = 'flex';
}

function closeUploadPopup() {
    document.getElementById('uploadPopup').style.display = 'none';
    document.getElementById('dragArea').innerHTML = `
        Drag & Drop to Upload File
        <br>or<br>
        <button class="browse-button" onclick="document.getElementById('fileInput').click()">Browse</button>
    `;
    document.getElementById('dragArea').classList.remove('uploaded');
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

let currentFolder = '';

function openFile(fileName) {
    window.location.href = `content-details.html?file=${fileName}`;
}

function renameFile(fileName) {
    const fileParts = fileName.split('.');
    const extension = fileParts.pop();
    const baseName = fileParts.join('.');

    const newBaseName = prompt('Enter new name for the file:', baseName);
    if (newBaseName) {
        const newName = `${newBaseName}.${extension}`;
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
                fetchFiles();
            } else {
                alert('Failed to rename file: ' + data.message);
            }
        })
        .catch(error => console.error('Error renaming file:', error));
    } else {
        // Close the dropdown menu if cancel is clicked
        closeDropdownMenu();
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
                fetchFiles();
            } else {
                alert('Failed to delete file: ' + data.message);
            }
        })
        .catch(error => console.error('Error deleting file:', error));
    } else {
        // Close the dropdown menu if cancel is clicked
        closeDropdownMenu();
    }
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

/*
function uploadFiles(files) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i]);
    }
    formData.append('folder', currentFolder);

    fetch('/api/upload-file', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('File uploaded successfully');
            closeUploadPopup();
            fetchFiles();
        } else {
            alert('File upload failed');
        }
    })
    .catch(error => {
        console.error('Error uploading file:', error);
        alert('Error uploading file');
    });
}
*/
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
            fetchFiles();
        } else {
            alert('Failed to create folder: ' + data.message);
        }
    })
    .catch(error => console.error('Error creating folder:', error));
}

function closeDropdownMenu() {
    const dropdownMenus = document.querySelectorAll('.dropdown-options-menu');
    dropdownMenus.forEach(menu => {
        menu.style.display = 'none';
    });
}
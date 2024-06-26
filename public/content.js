document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    fetchFiles();

    if (document.getElementById('addScreenForm')) {
        document.getElementById('addScreenForm').addEventListener('submit', function(event) {
            event.preventDefault();
            addScreen();
        });
    }

    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    const sortLink = document.getElementById('sortLink');
    const filtersLink = document.getElementById('filtersLink');
    const dropdownMenu = document.getElementById('dropdownMenu');

    if (searchButton) {
        searchButton.addEventListener('click', searchContent);
    }

    if (searchInput) {
        searchInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                searchContent();
            }
        });
    }

    if (sortLink) {
        sortLink.addEventListener('click', function(event) {
            event.preventDefault();
            const sortDropdown = document.getElementById('sortDropdown');
            if (sortDropdown) {
                sortDropdown.style.display = sortDropdown.style.display === 'block' ? 'none' : 'block';
            }
        });

        // Close sort dropdown when clicking outside
        document.addEventListener('click', (event) => {
            const sortDropdown = document.getElementById('sortDropdown');
            if (sortDropdown && !event.target.closest('#sortLink') && !event.target.closest('#sortDropdown')) {
                if (sortDropdown.style.display === 'block') {
                    sortDropdown.style.display = 'none';
                }
            }
        });
    }

    if (filtersLink) {
        filtersLink.addEventListener('click', showFilterPopup);
    }

    const closePopupButton = document.querySelector('.popup .close-btn');
    if (closePopupButton) {
        closePopupButton.addEventListener('click', hideFilterPopup);
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
        if (dropdownMenu && !event.target.closest('.user-name') && !event.target.closest('.dropdown-menu')) {
            if (dropdownMenu.style.display === 'block') {
                dropdownMenu.style.display = 'none';
            }
        }

        // Close all other dropdown menus
        const dropdownMenus = document.querySelectorAll('.dropdown-options-menu');
        dropdownMenus.forEach(menu => {
            if (!menu.contains(event.target) && !menu.previousElementSibling.contains(event.target)) {
                menu.style.display = 'none';
            }
        });
    });
});

function loadUserDetails() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return Promise.reject('No token found');
    }

    return fetch('/api/user-details', {
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
        return data;
    })
    .catch(error => {
        console.error('Error fetching user details:', error);
        window.location.href = 'index.html';
        return Promise.reject(error);
    });
}

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
            if (file.type && file.type.startsWith('image/')) {
                thumbnailContent = `<img src="${file.path}" alt="${file.name}">`;
            } else if (file.type && file.type.startsWith('video/')) {
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
                    <a href="#" onclick="addtoplalistFile('${file.name}')">Add to playlists of multiple screens</a>
                    <a href="#" onclick="removefromplalistFile('${file.name}')">Remove from all playlists</a>
                    <a href="#" onclick="movetofolderFile('${file.name}')">Move to a different folder</a>
                    <a href="#" onclick="filemanagementFile('${file.name}')">File Management</a>
                    <a href="#" onclick="renameFile('${file.name}')">Rename</a>
                    <a href="#" onclick="deleteFile('${file.name}')">Delete Content</a>
                </div>
            `;
            fileList.appendChild(fileItem);
        });
    })
    .catch(error => {
        console.error('Error fetching files:', error);
    });
}

function searchContent() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    console.log('Searching for:', searchTerm);
    
    loadUserDetails().then(user => {
        console.log('Current user:', user.firstname, user.lastname);

        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        fetch(`/api/search-content?query=${searchTerm}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(files => {
            displayFiles(files);
        })
        .catch(error => {
            console.error('Error fetching files:', error);
        });
    }).catch(error => {
        console.error('Error loading user details:', error);
    });
}

function displayFiles(files) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';

    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'thumbnail';
        fileItem.draggable = true;
        fileItem.ondragstart = (event) => {
            event.dataTransfer.setData('text/plain', file.file_name);
        };
        fileItem.onclick = (event) => {
            if (event.target.classList.contains('fas') || event.target.tagName === 'A') {
                return; // Prevents opening file when clicking on the options
            }
            openFile(file.file_name);
        };
        let thumbnailContent;
        if (file.file_type && file.file_type.startsWith('image/')) {
            thumbnailContent = `<img src="${file.file_path}" alt="${file.file_name}">`;
        } else if (file.file_type && file.file_type.startsWith('video/')) {
            thumbnailContent = `<video src="${file.file_path}" alt="${file.file_name}" controls></video>`;
        } else {
            thumbnailContent = `<i class="fas fa-file file-icon"></i>`;
        }
        fileItem.innerHTML = `
            ${thumbnailContent}
            <div class="file-info">
                <div class="file-details">
                    <strong>${file.file_name}</strong> 
                    <span>${file.upload_date}</span>
                </div>
            </div>
            <div class="options" onclick="toggleOptionsMenu('${file.file_name}', this, event)">
                <i class="fas fa-ellipsis-h"></i>
            </div>
            <div class="dropdown-options-menu">
                <a href="content-details.html?file=${file.file_name}">Open</a>
                <a href="#" onclick="addtoplalistFile('${file.file_name}')">Add to playlists of multiple screens</a>
                <a href="#" onclick="removefromplalistFile('${file.file_name}')">Remove from all playlists</a>
                <a href="#" onclick="movetofolderFile('${file.file_name}')">Move to a different folder</a>
                <a href="#" onclick="filemanagementFile('${file.file_name}')">File Management</a>
                <a href="#" onclick="renameFile('${file.file_name}')">Rename</a>
                <a href="#" onclick="deleteFile('${file.file_name}')">Delete Content</a>
            </div>
        `;
        fileList.appendChild(fileItem);
    });
}

function hideFilterPopup() {
    const filterPopup = document.getElementById('filterPopup');
    if (filterPopup) {
        filterPopup.style.display = 'none';
    }
}

function toggleOptionsMenu(fileName, element, event) {
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

function addtoplalistFile(fileName) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch(`/api/file-id?fileName=${encodeURIComponent(fileName)}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.contentId) {
            const popup = document.getElementById('addToMultipleScreensPopup');
            const fileNameElement = document.getElementById('fileName');
            fileNameElement.textContent = fileName;
            popup.dataset.contentId = data.contentId; // Store the contentId in the popup element
            fetchUserScreens(); // Fetch the screens for the current user
            popup.style.display = 'block';
        } else {
            console.error('Error fetching content ID:', data.message);
        }
    })
    .catch(error => {
        console.error('Error fetching content ID:', error);
    });
}

function hideAddToMultipleScreensPopup() {
    const popup = document.getElementById('addToMultipleScreensPopup');
    popup.style.display = 'none';
}

function fetchUserScreens() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    fetch('/api/get-screens', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(screens => {
        const screensList = document.getElementById('screensList');
        screensList.innerHTML = ''; // Clear the list
        screens.forEach(screen => {
            const screenItem = document.createElement('div');
            screenItem.className = 'screen-item';

            // Determine the status based on online_status field
            const statusText = screen.online_status === 1 ? 'Online' : 'Offline';
            const statusClass = screen.online_status === 1 ? 'online' : 'offline';

            screenItem.innerHTML = `
                <input type="checkbox" class="screen-checkbox" value="${screen.screen_id}" onclick="printContentAndScreenId('${screen.screen_id}')">
                <img src="uploads/default-screen.png" alt="Screen">
                <div>
                    <p>${screen.screen_name}</p>
                    <p>Screen ID: ${screen.screen_id}</p>
                </div>
                <span class="status ${statusClass}">${statusText}</span>
            `;
            screensList.appendChild(screenItem);
        });
    })
    .catch(error => {
        console.error('Error fetching screens:', error);
    });
}

function applyToMultipleScreens() {
    const selectedScreens = Array.from(document.querySelectorAll('.screen-checkbox:checked')).map(cb => cb.value);
    const contentId = document.getElementById('addToMultipleScreensPopup').dataset.contentId;

    if (selectedScreens.length === 0) {
        alert('Please select at least one screen.');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const requestBody = {
        contentId,
        selectedScreens
    };

    fetch('/api/add-to-playlists', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            alert('Content added to playlists successfully!');
            hideAddToMultipleScreensPopup();
        } else {
            alert('Failed to add content to playlists.');
        }
    })
    .catch(error => {
        console.error('Error adding content to playlists:', error);
    });
}

function printContentAndScreenId(screenId) {
    const popup = document.getElementById('addToMultipleScreensPopup');
    const contentId = popup.dataset.contentId; // Retrieve the contentId stored in the popup element
    console.log(`Content ID: ${contentId}, Screen ID: ${screenId}`);
}

// When opening the popup from the thumbnail options menu
function openAddToMultipleScreensPopup(fileName, contentId) {
    addtoplalistFile(fileName, contentId);
}

function updateUploadArea(maxFileSizeMB) {
    document.getElementById('dragArea').innerHTML = `
        Click here or Drag & Drop to Upload File (max file size ${maxFileSizeMB}MB)
        <br>or<br>
        <button class="browse-button" onclick="document.getElementById('fileInput').click()">Browse</button>
    `;
}
function closeUploadPopup() {
    const uploadPopup = document.getElementById('uploadPopup');
    uploadPopup.style.display = 'none';
    updateUploadArea(maxFileSizeMB);
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

const token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
        },
        events: fetchEvents,
        dateClick: function(info) {
            openAddEventPopup(info.dateStr);
        },
        eventClick: function(info) {
            openEditEventPopup(info.event);
        }
    });

    calendar.render();
    window.calendar = calendar;

    function fetchEvents(fetchInfo, successCallback, failureCallback) {
        fetch('/api/events', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(data => {
            const events = data.map(event => ({
                id: event.id,
                title: event.title,
                start: event.start,
                end: event.end,
                backgroundColor: getCategoryColor(event.category),
                borderColor: getCategoryColor(event.category),
                classNames: [event.category]
            }));
            successCallback(events);
            filterEvents();  // Ensure events are filtered initially
        })
        .catch(error => {
            console.error('Error fetching events:', error);
            failureCallback(error);
        });
    }

    function addEvent() {
        const title = document.getElementById('eventTitle').value;
        const start = document.getElementById('eventStart').value;
        const end = document.getElementById('eventEnd').value;
        const category = document.getElementById('eventCategory').value;
    
        if (title && start) {
            const event = {
                title: title,
                start: start,
                end: end,
                category: category,
                color: getCategoryColor(category)
            };
    
            fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(event)
            })
            .then(response => response.json())
            .then(data => {
                window.calendar.addEvent({
                    id: data.id,
                    title: data.title,
                    start: data.start,
                    end: data.end,
                    backgroundColor: getCategoryColor(data.category),
                    borderColor: getCategoryColor(data.category),
                    classNames: [data.category]
                });
                closeAddEventPopup();
            })
            .catch(error => {
                console.error('Error adding event:', error);
            });
        } else {
            alert('Title and start date are required.');
        }
    }

    function deleteEvent(eventId) {
        fetch(`/api/events/${eventId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to delete event');
            const calendarEvent = window.calendar.getEventById(eventId);
            calendarEvent.remove();
            closeDeleteEventPopup();
        })
        .catch(error => {
            console.error('Error deleting event:', error);
        });
    }

    function updateEvent() {
        const id = document.getElementById('editEventId').value;
        const title = document.getElementById('editEventTitle').value;
        const start = document.getElementById('editEventStart').value;
        const end = document.getElementById('editEventEnd').value;
        const category = document.getElementById('editEventCategory').value;
    
        if (title && start) {
            const event = {
                title: title,
                start: start,
                end: end,
                category: category,
                color: getCategoryColor(category)
            };
    
            fetch(`/api/events/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(event)
            })
            .then(response => response.json())
            .then(data => {
                const calendarEvent = window.calendar.getEventById(id);
                calendarEvent.setProp('title', data.title);
                calendarEvent.setStart(data.start);
                calendarEvent.setEnd(data.end);
                calendarEvent.setExtendedProp('category', data.category);
                calendarEvent.setProp('backgroundColor', getCategoryColor(data.category));
                calendarEvent.setProp('borderColor', getCategoryColor(data.category));
                closeEditEventPopup();
            })
            .catch(error => {
                console.error('Error updating event:', error);
            });
        } else {
            alert('Title and start date are required.');
        }
    }

    window.addEvent = addEvent;
    window.updateEvent = updateEvent;

    // Event filters
    const viewAllCheckbox = document.getElementById('viewAllCheckbox');
    const checkboxes = document.querySelectorAll('#calendar-filters .category-checkbox');
    
    viewAllCheckbox.addEventListener('change', function() {
        const checked = this.checked;
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
        filterEvents();
    });

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', filterEvents);
    });

    function filterEvents() {
        const activeCategories = Array.from(checkboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        window.calendar.getEvents().forEach(event => {
            if (activeCategories.includes(event.classNames[0])) {
                event.setProp('display', '');
            } else {
                event.setProp('display', 'none');
            }
        });

        // Update the "View All" checkbox based on the current state of other checkboxes
        const allChecked = activeCategories.length === checkboxes.length;
        viewAllCheckbox.checked = allChecked;
    }
});

function openAddEventPopup(date) {
    document.getElementById('addEventPopup').style.display = 'flex';
    if (date) {
        document.getElementById('eventStart').value = date + 'T00:00';
        document.getElementById('eventEnd').value = date + 'T00:00';
    }
}

function closeAddEventPopup() {
    document.getElementById('addEventPopup').style.display = 'none';
}

function openEditEventPopup(event) {
    document.getElementById('editEventPopup').style.display = 'flex';
    document.getElementById('editEventId').value = event.id;
    document.getElementById('editEventTitle').value = event.title;
    document.getElementById('editEventStart').value = event.start.toISOString().slice(0, 16);
    document.getElementById('editEventEnd').value = event.end ? event.end.toISOString().slice(0, 16) : '';

    // Fetch event details from the server to get the category
    fetch(`/api/events/${event.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('editEventCategory').value = data.category;
    })
    .catch(error => {
        console.error('Error fetching event details:', error);
    });
}

function closeEditEventPopup() {
    document.getElementById('editEventPopup').style.display = 'none';
}

function deleteEventPrompt() {
    document.getElementById('deleteEventPopup').style.display = 'flex';
}

function closeDeleteEventPopup() {
    document.getElementById('deleteEventPopup').style.display = 'none';
}

function confirmDeleteEvent() {
    const id = document.getElementById('editEventId').value;

    fetch(`/api/events/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to delete event');
        const calendarEvent = window.calendar.getEventById(id);
        calendarEvent.remove();
        closeDeleteEventPopup();
        closeEditEventPopup();
    })
    .catch(error => {
        console.error('Error deleting event:', error);
    });
}

function getCategoryColor(category) {
    switch (category) {
        case 'personal':
            return '#f14343';
        case 'business':
            return '#304050';
        case 'family':
            return '#07a053';
        case 'holiday':
            return '#f33df3';
        default:
            return '#3788d8';
    }
}

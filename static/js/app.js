/**
 * Smart Parking Management System - Clean White App Client
 * Handles Parking Location Search, Top-Down Diagram Map, 2-Minute Reservations,
 * Live Countdown Timers, Arrival Confirmation, Queue Management, and Admin Panel.
 */

const App = (function () {
    // Application State
    const state = {
        currentLocationId: 1,
        currentDistanceFilter: 1, // Default 1 km
        searchQuery: '',
        activeReservation: null, // Current user active reservation
        timerIntervalId: null,
        pollIntervalId: null,
        isAuthenticated: false,
        username: 'Admin',
        selectedSlotForModal: null,
        locations: []
    };

    // DOM Elements Cache
    const DOM = {};

    function init() {
        cacheDOM();
        bindEvents();
        checkAuthStatus();
        fetchLocations();
        checkActiveUserReservation();
        startPolling();
        console.log("✓ Clean White Smart Parking Client Initialized");
    }

    function cacheDOM() {
        // Nav
        DOM.navBtns = {
            locations: document.getElementById('nav-btn-locations'),
            map: document.getElementById('nav-btn-map'),
            queue: document.getElementById('nav-btn-queue'),
            camera: document.getElementById('nav-btn-camera'),
            admin: document.getElementById('nav-btn-admin')
        };
        DOM.navQueueCount = document.getElementById('nav-queue-count');
        DOM.userPill = document.getElementById('user-pill');
        DOM.adminOnlyControls = document.querySelectorAll('.admin-only-control');

        // Views
        DOM.views = {
            locations: document.getElementById('view-locations'),
            map: document.getElementById('view-map'),
            queue: document.getElementById('view-queue'),
            camera: document.getElementById('view-camera'),
            admin: document.getElementById('view-admin')
        };

        // User Reservation Banner
        DOM.userReservationBanner = document.getElementById('user-reservation-banner');
        DOM.resvBannerLoc = document.getElementById('resv-banner-loc');
        DOM.resvBannerSlot = document.getElementById('resv-banner-slot');
        DOM.resvBannerType = document.getElementById('resv-banner-type');
        DOM.resvBannerPlate = document.getElementById('resv-banner-plate');
        DOM.resvBannerTimer = document.getElementById('resv-banner-timer');

        // View 1: Locations
        DOM.parkingSearchInput = document.getElementById('parking-search-input');
        DOM.searchClearBtn = document.getElementById('search-clear-btn');
        DOM.locationsCardsContainer = document.getElementById('locations-cards-container');
        DOM.distPills = document.querySelectorAll('.dist-pill');
        DOM.locationViewSubtitle = document.getElementById('location-view-subtitle');

        // View 2: Parking Map (Top-Down Diagram)
        DOM.mapLocationTitle = document.getElementById('map-location-title');
        DOM.mapLocationMeta = document.getElementById('map-location-meta');
        DOM.mapStatAvail = document.getElementById('map-stat-avail');
        DOM.mapStatOcc = document.getElementById('map-stat-occ');
        DOM.mapStatResv = document.getElementById('map-stat-resv');
        DOM.diagramCarSlots = document.getElementById('diagram-car-slots');
        DOM.diagramBikeSlots = document.getElementById('diagram-bike-slots');
        DOM.carSlotsMeta = document.getElementById('car-slots-meta');
        DOM.bikeSlotsMeta = document.getElementById('bike-slots-meta');

        // View 3: Queue
        DOM.queueTableBody = document.getElementById('queue-table-body');

        // View 4: Live Camera & Slot Editor
        DOM.camCarsCount = document.getElementById('cam-cars-count');
        DOM.camBikesCount = document.getElementById('cam-bikes-count');
        DOM.camFreeCount = document.getElementById('cam-free-count');
        DOM.camOccCount = document.getElementById('cam-occ-count');
        DOM.camFpsCount = document.getElementById('cam-fps-count');
        DOM.cameraStream = document.getElementById('camera-stream');
        DOM.btnEditParkingSlots = document.getElementById('btn-edit-parking-slots');
        DOM.cameraLiveContainer = document.getElementById('camera-live-container');
        DOM.cameraSlotEditorContainer = document.getElementById('camera-slot-editor-container');
        DOM.slotEditorCanvas = document.getElementById('slot-editor-canvas');
        DOM.canvasScrollWrap = document.getElementById('canvas-scroll-wrap');
        DOM.inspectorSelectedTag = document.getElementById('inspector-selected-tag');
        DOM.inspectorFormWrap = document.getElementById('inspector-form-wrap');
        DOM.inspectorSlotId = document.getElementById('inspector-slot-id');
        DOM.inspectorSlotType = document.getElementById('inspector-slot-type');
        DOM.inspectorSlotX = document.getElementById('inspector-slot-x');
        DOM.inspectorSlotY = document.getElementById('inspector-slot-y');
        DOM.inspectorSlotW = document.getElementById('inspector-slot-w');
        DOM.inspectorSlotH = document.getElementById('inspector-slot-h');
        DOM.inspectorSlotsCount = document.getElementById('inspector-slots-count');
        DOM.inspectorSlotsChipsContainer = document.getElementById('inspector-slots-chips-container');

        // View 5: Admin
        DOM.adminResvCount = document.getElementById('admin-resv-count');
        DOM.adminResvTableBody = document.getElementById('admin-resv-table-body');
        DOM.historyTableBody = document.getElementById('history-table-body');

        // Modals
        DOM.reservationModal = document.getElementById('reservation-modal');
        DOM.modalSlotTitle = document.getElementById('modal-slot-title');
        DOM.modalResvLocation = document.getElementById('modal-resv-location');
        DOM.modalResvName = document.getElementById('modal-resv-name');
        DOM.modalResvPlate = document.getElementById('modal-resv-plate');
        DOM.resvTypeCar = document.getElementById('resv-type-car');
        DOM.resvTypeBike = document.getElementById('resv-type-bike');
        DOM.resvErrorBanner = document.getElementById('resv-error-banner');

        DOM.queueModal = document.getElementById('queue-modal');
        DOM.qDriverName = document.getElementById('q-driver-name');
        DOM.qPlateNumber = document.getElementById('q-plate-number');
        DOM.qVtypeSelect = document.getElementById('q-vtype-select');
        DOM.qLocationSelect = document.getElementById('q-location-select');
        DOM.queueErrorBanner = document.getElementById('queue-error-banner');

        DOM.loginModal = document.getElementById('login-modal');
        DOM.adminUserInput = document.getElementById('admin-user-input');
        DOM.adminPassInput = document.getElementById('admin-pass-input');
        DOM.loginErrorBanner = document.getElementById('login-error-banner');
    }

    function bindEvents() {
        // Search Input
        DOM.parkingSearchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.trim();
            if (state.searchQuery) {
                DOM.searchClearBtn.classList.remove('hidden');
                DOM.locationViewSubtitle.textContent = `Search results for "${state.searchQuery}"`;
            } else {
                DOM.searchClearBtn.classList.add('hidden');
                updateSubtitleForDistance();
            }
            fetchLocations();
        });

        // Discreet Admin Login Keybinding: Ctrl + Shift + A
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) || (e.altKey && (e.key === 'A' || e.key === 'a'))) {
                e.preventDefault();
                openLoginModal();
            }
            // Delete key in slot editor
            if ((e.key === 'Delete' || e.key === 'Backspace') && editorState.selectedIdx >= 0) {
                const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
                if (activeTag !== 'input' && activeTag !== 'select' && activeTag !== 'textarea') {
                    e.preventDefault();
                    deleteSelectedEditorSlot();
                }
            }
        });

        // Hash trigger check for #admin-login
        if (window.location.hash === '#admin-login') {
            openLoginModal();
        }
    }

    // ==================== VIEW SWITCHING ====================
    function setActiveView(viewName) {
        Object.keys(DOM.views).forEach(key => {
            if (key === viewName) {
                DOM.views[key].classList.add('active');
            } else {
                DOM.views[key].classList.remove('active');
            }
        });

        Object.keys(DOM.navBtns).forEach(key => {
            if (key === viewName) {
                DOM.navBtns[key].classList.add('active');
            } else {
                DOM.navBtns[key].classList.remove('active');
            }
        });

        if (viewName === 'locations') fetchLocations();
        if (viewName === 'map') fetchMapSlots();
        if (viewName === 'queue') fetchQueue();
        if (viewName === 'camera') fetchCameraStats();
        if (viewName === 'admin') fetchAdminData();
    }

    function showLocationsView() { setActiveView('locations'); }
    function showMapView() { setActiveView('map'); }
    function showQueueView() { setActiveView('queue'); }
    function showCameraView() { setActiveView('camera'); }
    function showAdminView() { setActiveView('admin'); }

    // ==================== POLLING & TIMERS ====================
    function startPolling() {
        if (state.pollIntervalId) clearInterval(state.pollIntervalId);
        state.pollIntervalId = setInterval(() => {
            if (DOM.views.map.classList.contains('active')) fetchMapSlots(true);
            if (DOM.views.admin.classList.contains('active')) fetchAdminData();
            if (DOM.views.camera.classList.contains('active')) fetchCameraStats();
            updateCountdownTick();
        }, 2000);

        // Tick countdown every second
        if (state.timerIntervalId) clearInterval(state.timerIntervalId);
        state.timerIntervalId = setInterval(() => {
            updateCountdownTick();
        }, 1000);
    }

    function updateCountdownTick() {
        if (state.activeReservation) {
            state.activeReservation.remaining_seconds = Math.max(0, state.activeReservation.remaining_seconds - 1);
            const s = state.activeReservation.remaining_seconds;
            const minStr = `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
            DOM.resvBannerTimer.textContent = minStr;

            if (s === 0) {
                // Expired!
                showToast("Reservation Expired: The parking slot is now available to other users.", "warning");
                state.activeReservation = null;
                DOM.userReservationBanner.classList.add('hidden');
                fetchMapSlots();
                fetchLocations();
            }
        }
    }

    // ==================== 1. PARKING LOCATIONS & NEARBY ====================
    async function fetchLocations() {
        try {
            let url = '/api/parking/locations';
            const params = [];
            if (state.searchQuery) {
                params.push(`search=${encodeURIComponent(state.searchQuery)}`);
            } else if (state.currentDistanceFilter !== 'all') {
                params.push(`max_distance=${state.currentDistanceFilter}`);
            }

            if (params.length > 0) url += `?${params.join('&')}`;

            const res = await fetch(url);
            const data = await res.json();
            if (!data.success) return;

            state.locations = data.locations;
            renderLocationsCards(data.locations);
        } catch (err) {
            console.error("Error fetching locations:", err);
        }
    }

    function filterByDistance(dist) {
        state.currentDistanceFilter = dist;
        state.searchQuery = '';
        DOM.parkingSearchInput.value = '';
        DOM.searchClearBtn.classList.add('hidden');

        DOM.distPills.forEach(pill => {
            if (pill.getAttribute('data-dist') === String(dist)) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });

        updateSubtitleForDistance();
        fetchLocations();
    }

    function updateSubtitleForDistance() {
        if (state.currentDistanceFilter === 'all') {
            DOM.locationViewSubtitle.textContent = 'Showing all 5 parking locations';
        } else {
            DOM.locationViewSubtitle.textContent = `Showing parking locations near you (within ${state.currentDistanceFilter} km)`;
        }
    }

    function clearSearch() {
        state.searchQuery = '';
        DOM.parkingSearchInput.value = '';
        DOM.searchClearBtn.classList.add('hidden');
        updateSubtitleForDistance();
        fetchLocations();
    }

    function renderLocationsCards(locs) {
        if (!locs || locs.length === 0) {
            DOM.locationsCardsContainer.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background:#fff; border:1px solid #e2e8f0; border-radius:10px;">
                    <i class="fa-solid fa-location-crosshairs" style="font-size:2rem; color:#94a3b8; margin-bottom:0.75rem;"></i>
                    <p style="color:#64748b; font-size:0.95rem;">No parking locations found matching your criteria.</p>
                    <button class="btn btn-sm btn-outline-primary" style="margin-top:1rem;" onclick="App.filterByDistance('all')">Show All Locations</button>
                </div>
            `;
            return;
        }

        DOM.locationsCardsContainer.innerHTML = locs.map(loc => {
            const isFull = loc.available_slots === 0;
            return `
                <div class="location-white-card">
                    <div>
                        <div class="card-loc-header">
                            <h2 class="card-loc-name">${loc.name}</h2>
                            <span class="card-loc-distance">📍 ${loc.distance_km || 0.4} km away</span>
                        </div>
                        <div class="card-counts-list">
                            <div class="count-row">
                                <i class="fa-solid fa-car-side" style="color:#2563eb"></i>
                                <span><strong>${loc.available_cars} / ${loc.total_cars}</strong> Cars Available</span>
                            </div>
                            <div class="count-row">
                                <i class="fa-solid fa-motorcycle" style="color:#7c3aed"></i>
                                <span><strong>${loc.available_bikes} / ${loc.total_bikes}</strong> Bikes Available</span>
                            </div>
                            <div class="count-row total-row ${isFull ? 'full' : ''}">
                                <i class="fa-solid ${isFull ? 'fa-circle-xmark' : 'fa-circle-check'}"></i>
                                <span>${isFull ? 'PARKING FULL (0 Available)' : `🟢 ${loc.available_slots} / ${loc.total_slots} Available`}</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-btn-wrap">
                        <button class="btn btn-primary" onclick="App.viewLocationMap(${loc.id})">
                            View Parking <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function viewLocationMap(locId) {
        state.currentLocationId = locId;
        showMapView();
    }

    // ==================== 2. TOP-DOWN PARKING MAP ====================
    async function fetchMapSlots(silent = false) {
        try {
            const loc = state.locations.find(l => l.id === state.currentLocationId);
            if (loc) {
                DOM.mapLocationTitle.textContent = loc.name;
                DOM.mapLocationMeta.textContent = `📍 ${loc.distance_km || 0.4} km away • Top-Down Parking Diagram`;
            }

            const res = await fetch(`/api/parking/locations/${state.currentLocationId}/slots`);
            const data = await res.json();
            if (!data.success) return;

            const carSlots = data.car_slots || [];
            const bikeSlots = data.bike_slots || [];
            const totalAvail = carSlots.filter(s => s.status === 'available').length + bikeSlots.filter(s => s.status === 'available').length;
            const totalOcc = carSlots.filter(s => s.status === 'occupied').length + bikeSlots.filter(s => s.status === 'occupied').length;
            const totalResv = carSlots.filter(s => s.status === 'reserved').length + bikeSlots.filter(s => s.status === 'reserved').length;

            DOM.mapStatAvail.textContent = totalAvail;
            DOM.mapStatOcc.textContent = totalOcc;
            DOM.mapStatResv.textContent = totalResv;
            DOM.carSlotsMeta.textContent = `${carSlots.filter(s => s.status === 'available').length} / ${carSlots.length} Available`;
            DOM.bikeSlotsMeta.textContent = `${bikeSlots.filter(s => s.status === 'available').length} / ${bikeSlots.length} Available`;

            renderDiagramSlots(DOM.diagramCarSlots, carSlots, 'Car');
            renderDiagramSlots(DOM.diagramBikeSlots, bikeSlots, 'Bike');
        } catch (err) {
            console.error("Error fetching map slots:", err);
        }
    }

    function renderDiagramSlots(container, slots, vtype) {
        if (!slots || slots.length === 0) {
            container.innerHTML = `<p style="color:#94a3b8;font-size:0.85rem;">No slots configured.</p>`;
            return;
        }

        container.innerHTML = slots.map(slot => {
            const isAvail = slot.status === 'available';
            const isOcc = slot.status === 'occupied';
            const isResv = slot.status === 'reserved';

            let topIconHtml = '';
            let statusText = '';
            let subInfo = slot.vehicle_number || '';

            if (isAvail) {
                topIconHtml = `<div class="slot-top-icon">P</div>`;
                statusText = `AVAILABLE`;
                subInfo = `Click to Reserve`;
            } else if (isOcc) {
                const iconClass = vtype === 'Car' ? 'fa-car' : 'fa-motorcycle';
                topIconHtml = `<div class="slot-top-icon"><i class="fa-solid ${iconClass}"></i></div>`;
                statusText = `OCCUPIED`;
            } else if (isResv) {
                topIconHtml = `<div class="slot-top-icon"><i class="fa-regular fa-clock"></i></div>`;
                statusText = `RESERVED`;
                subInfo = slot.remaining_formatted ? `${slot.remaining_formatted} left` : 'Reserved';
            }

            return `
                <div class="diagram-slot-box ${slot.status}" 
                     onclick="App.handleSlotClick(${slot.id}, '${slot.slot_number}', '${slot.status}', '${vtype}')">
                    <div class="slot-number-label">${slot.slot_number}</div>
                    ${topIconHtml}
                    <div>
                        <div class="slot-status-text">${statusText}</div>
                        <div class="slot-sub-info" title="${subInfo}">${subInfo}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==================== 3. 2-MINUTE RESERVATION ====================
    function handleSlotClick(slotId, slotNumber, status, vtype) {
        if (status === 'occupied') {
            showToast(`Slot ${slotNumber} is currently occupied.`, 'error');
            return;
        }

        if (status === 'reserved') {
            // Check if it's the current user's reservation
            if (state.activeReservation && state.activeReservation.slot_id === slotId) {
                // Focus user reservation banner
                DOM.userReservationBanner.scrollIntoView({ behavior: 'smooth' });
            } else {
                showToast(`Slot ${slotNumber} is reserved by another user. Please choose another slot.`, 'error');
            }
            return;
        }

        // Slot is AVAILABLE -> Open 2-minute reservation modal
        openReservationModal(slotId, slotNumber, vtype);
    }

    function openReservationModal(slotId, slotNumber, vtype) {
        state.selectedSlotForModal = { slotId, slotNumber, vtype };
        DOM.modalSlotTitle.textContent = slotNumber;
        
        const loc = state.locations.find(l => l.id === state.currentLocationId);
        DOM.modalResvLocation.value = loc ? loc.name : "NMIT Main Gate Parking";
        
        if (vtype === 'Bike') {
            DOM.resvTypeBike.checked = true;
        } else {
            DOM.resvTypeCar.checked = true;
        }

        DOM.resvErrorBanner.classList.add('hidden');
        DOM.reservationModal.classList.remove('hidden');
    }

    function closeReservationModal() {
        DOM.reservationModal.classList.add('hidden');
        state.selectedSlotForModal = null;
    }

    async function handleReservationSubmit(event) {
        event.preventDefault();
        DOM.resvErrorBanner.classList.add('hidden');

        if (!state.selectedSlotForModal) return;

        const slotId = state.selectedSlotForModal.slotId;
        const userName = DOM.modalResvName.value.trim();
        const vehiclePlate = DOM.modalResvPlate.value.trim().toUpperCase();
        const vehicleType = DOM.resvTypeCar.checked ? 'Car' : 'Bike';

        try {
            const res = await fetch(`/api/parking/slots/${slotId}/reserve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_name: userName,
                    vehicle_number: vehiclePlate,
                    vehicle_type: vehicleType,
                    duration_seconds: 120
                })
            });

            const data = await res.json();
            if (data.success) {
                const resv = data.reservation;
                state.activeReservation = resv;
                
                // Show user banner
                DOM.resvBannerLoc.textContent = DOM.modalResvLocation.value;
                DOM.resvBannerSlot.textContent = resv.slot_number;
                DOM.resvBannerType.textContent = resv.vehicle_type;
                DOM.resvBannerPlate.textContent = resv.vehicle_number;
                DOM.resvBannerTimer.textContent = "01:59";
                DOM.userReservationBanner.classList.remove('hidden');

                closeReservationModal();
                showToast(`Slot ${resv.slot_number} reserved for 2 minutes!`, 'success');
                fetchMapSlots();
                fetchLocations();
            } else {
                DOM.resvErrorBanner.textContent = data.error || 'Failed to reserve slot.';
                DOM.resvErrorBanner.classList.remove('hidden');
            }
        } catch (err) {
            DOM.resvErrorBanner.textContent = 'Network error while making reservation.';
            DOM.resvErrorBanner.classList.remove('hidden');
        }
    }

    async function confirmArrival() {
        if (!state.activeReservation) return;
        const slotId = state.activeReservation.slot_id;

        try {
            const res = await fetch(`/api/parking/slots/${slotId}/arrive`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast("Parking Confirmed ✓ (Slot is now Occupied)", "success");
                state.activeReservation = null;
                DOM.userReservationBanner.classList.add('hidden');
                fetchMapSlots();
                fetchLocations();
            } else {
                showToast(data.error || 'Failed to confirm arrival', 'error');
            }
        } catch (err) {
            showToast('Error confirming arrival', 'error');
        }
    }

    async function cancelReservation(slotIdToCancel) {
        const slotId = slotIdToCancel || (state.activeReservation ? state.activeReservation.slot_id : null);
        if (!slotId) return;

        if (!confirm('Are you sure you want to cancel this reservation?')) return;

        try {
            const res = await fetch(`/api/parking/slots/${slotId}/cancel-reservation`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast("Reservation cancelled. Slot is now available.", "warning");
                if (state.activeReservation && state.activeReservation.slot_id === slotId) {
                    state.activeReservation = null;
                    DOM.userReservationBanner.classList.add('hidden');
                }
                fetchMapSlots();
                fetchLocations();
                if (DOM.views.admin.classList.contains('active')) fetchAdminData();
            } else {
                showToast(data.error || 'Failed to cancel reservation', 'error');
            }
        } catch (err) {
            showToast('Error cancelling reservation', 'error');
        }
    }

    async function checkActiveUserReservation() {
        try {
            const res = await fetch('/api/reservations/active');
            const data = await res.json();
            if (data.success && data.reservations && data.reservations.length > 0) {
                // If there's an active reservation matching current user
                const first = data.reservations[0];
                state.activeReservation = first;
                DOM.resvBannerLoc.textContent = first.location_name || "NMIT Main Gate Parking";
                DOM.resvBannerSlot.textContent = first.slot_number;
                DOM.resvBannerType.textContent = first.vehicle_type;
                DOM.resvBannerPlate.textContent = first.vehicle_number;
                DOM.resvBannerTimer.textContent = first.minutes_remaining || "01:59";
                DOM.userReservationBanner.classList.remove('hidden');
            }
        } catch (err) {
            console.error(err);
        }
    }

    // ==================== 4. QUEUE MANAGEMENT ====================
    async function fetchQueue() {
        try {
            const res = await fetch('/api/queue');
            const data = await res.json();
            if (!data.success) return;

            DOM.navQueueCount.textContent = data.count || 0;
            renderQueueTable(data.queue);
        } catch (err) {
            console.error("Error fetching queue:", err);
        }
    }

    function renderQueueTable(queueList) {
        if (!queueList || queueList.length === 0) {
            DOM.queueTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:2rem; color:#64748b;">
                        No drivers currently waiting in queue.
                    </td>
                </tr>
            `;
            return;
        }

        DOM.queueTableBody.innerHTML = queueList.map(item => `
            <tr>
                <td><strong>#${item.position}</strong></td>
                <td>${item.user_name}</td>
                <td><code style="font-family:var(--font-mono);font-weight:700;">${item.vehicle_number}</code></td>
                <td>${item.vehicle_type === 'Car' ? '🚗 Car' : '🏍 Bike'}</td>
                <td>${item.location_name || 'Main Gate'}</td>
                <td>${item.joined_at}</td>
                <td><span class="badge-pill ${item.status === 'Waiting' ? 'orange' : 'green'}">${item.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="App.deleteQueueItem(${item.id})">
                        Remove
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function openQueueModal() {
        DOM.queueErrorBanner.classList.add('hidden');
        DOM.qLocationSelect.value = String(state.currentLocationId || 1);
        DOM.queueModal.classList.remove('hidden');
    }

    function closeQueueModal() {
        DOM.queueModal.classList.add('hidden');
    }

    async function handleQueueSubmit(event) {
        event.preventDefault();
        DOM.queueErrorBanner.classList.add('hidden');

        const driverName = DOM.qDriverName.value.trim();
        const plateNumber = DOM.qPlateNumber.value.trim().toUpperCase();
        const vtype = DOM.qVtypeSelect.value;
        const locId = DOM.qLocationSelect.value;

        try {
            const res = await fetch('/api/queue/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_name: driverName,
                    vehicle_number: plateNumber,
                    vehicle_type: vtype,
                    location_id: locId
                })
            });

            const data = await res.json();
            if (data.success) {
                showToast(`✓ ${driverName} joined queue at Position #${data.entry.position}`, 'success');
                closeQueueModal();
                fetchQueue();
            } else {
                DOM.queueErrorBanner.textContent = data.error || 'Failed to join queue.';
                DOM.queueErrorBanner.classList.remove('hidden');
            }
        } catch (err) {
            DOM.queueErrorBanner.textContent = 'Error joining queue.';
            DOM.queueErrorBanner.classList.remove('hidden');
        }
    }

    async function deleteQueueItem(queueId) {
        if (!confirm('Remove this driver from the queue?')) return;
        try {
            await fetch(`/api/queue/${queueId}`, { method: 'DELETE' });
            showToast('Queue entry removed', 'info');
            fetchQueue();
        } catch (err) {
            console.error(err);
        }
    }

    // ==================== 5. LIVE CAMERA & SLOT EDITOR ====================
    async function fetchCameraStats() {
        try {
            const res = await fetch('/api/live/stats');
            const data = await res.json();
            if (!data.success) return;

            const st = data.live_stats;
            DOM.camCarsCount.textContent = st.cars_detected || 0;
            DOM.camBikesCount.textContent = st.bikes_detected || 0;
            DOM.camFreeCount.textContent = st.available_slots || 0;
            DOM.camOccCount.textContent = st.occupied_slots || 0;
            DOM.camFpsCount.textContent = st.fps || 28.5;
        } catch (err) {
            console.error(err);
        }
    }

    function handleStreamError(img) {
        img.alt = "Live Camera stream active in background.";
    }

    // ==================== INTERACTIVE SLOT BOUNDARY EDITOR ====================
    const editorState = {
        slots: [],
        selectedIdx: -1,
        isDragging: false,
        isResizing: false,
        dragOffsetX: 0,
        dragOffsetY: 0,
        snapshotImg: null,
        ctx: null,
        handleSize: 12,
        canvasEventsBound: false
    };

    async function openSlotEditor() {
        if (!state.isAuthenticated) {
            showToast("Admin login required to edit parking slots.", "warning");
            openLoginModal();
            return;
        }

        DOM.cameraLiveContainer.classList.add('hidden');
        DOM.cameraSlotEditorContainer.classList.remove('hidden');

        initEditorCanvas();
        await loadEditorSlots();
        loadEditorSnapshot();
    }

    function closeSlotEditor() {
        DOM.cameraSlotEditorContainer.classList.add('hidden');
        DOM.cameraLiveContainer.classList.remove('hidden');
        // Refresh live camera stream
        DOM.cameraStream.src = '/video_feed?t=' + Date.now();
    }

    function initEditorCanvas() {
        const canvas = DOM.slotEditorCanvas;
        editorState.ctx = canvas.getContext('2d');

        if (!editorState.canvasEventsBound) {
            canvas.addEventListener('mousedown', onCanvasMouseDown);
            canvas.addEventListener('mousemove', onCanvasMouseMove);
            canvas.addEventListener('mouseup', onCanvasMouseUp);
            canvas.addEventListener('mouseleave', onCanvasMouseUp);
            editorState.canvasEventsBound = true;
        }
    }

    function loadEditorSnapshot() {
        editorState.snapshotImg = new Image();
        editorState.snapshotImg.onload = () => {
            drawEditorCanvas();
        };
        editorState.snapshotImg.src = '/api/camera/snapshot?t=' + Date.now();
    }

    async function loadEditorSlots() {
        try {
            const res = await fetch('/api/admin/parking-slots');
            const data = await res.json();
            if (data.success && Array.isArray(data.slots) && data.slots.length > 0) {
                editorState.slots = data.slots;
            } else {
                generateDefaultEditorSlots();
            }
        } catch (err) {
            console.error("Error loading editor slots:", err);
            generateDefaultEditorSlots();
        }

        editorState.selectedIdx = editorState.slots.length > 0 ? 0 : -1;
        updateInspectorPanel();
        drawEditorCanvas();
    }

    function generateDefaultEditorSlots() {
        const slots = [];
        // Car slots row 1: A01 to A06
        for (let i = 0; i < 6; i++) {
            slots.push({
                id: `A${String(i + 1).padStart(2, '0')}`,
                x: 50 + i * 140,
                y: 100,
                width: 107,
                height: 48,
                vehicle_type: 'Car'
            });
        }
        // Car slots row 2: A07 to A10
        for (let j = 0; j < 4; j++) {
            slots.push({
                id: `A${String(j + 7).padStart(2, '0')}`,
                x: 50 + j * 140,
                y: 240,
                width: 107,
                height: 48,
                vehicle_type: 'Car'
            });
        }
        // Bike slots row: B01 to B05
        for (let k = 0; k < 5; k++) {
            slots.push({
                id: `B${String(k + 1).padStart(2, '0')}`,
                x: 620 + k * 85,
                y: 240,
                width: 75,
                height: 48,
                vehicle_type: 'Bike'
            });
        }
        editorState.slots = slots;
    }

    function resetEditorDefaultSlots() {
        if (!confirm("Reset slot boundaries to default layout (A01-A10 Cars, B01-B05 Bikes)?")) return;
        generateDefaultEditorSlots();
        editorState.selectedIdx = 0;
        updateInspectorPanel();
        drawEditorCanvas();
        showToast("Reset to default 15-slot grid. Click 'Save Parking Slots' to apply.", "info");
    }

    function drawEditorCanvas() {
        const ctx = editorState.ctx;
        if (!ctx) return;
        const canvas = DOM.slotEditorCanvas;

        // 1. Clear background
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 2. Draw snapshot image if loaded
        if (editorState.snapshotImg && editorState.snapshotImg.complete) {
            ctx.drawImage(editorState.snapshotImg, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#64748b';
            ctx.font = '16px Inter, sans-serif';
            ctx.fillText('Loading camera snapshot...', 50, 50);
        }

        // 3. Draw dark backdrop overlay for better contrast
        ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 4. Draw each parking slot
        editorState.slots.forEach((slot, idx) => {
            const isSelected = idx === editorState.selectedIdx;
            const isBike = slot.vehicle_type === 'Bike';

            // Colors
            const strokeColor = isSelected ? '#38bdf8' : (isBike ? '#8b5cf6' : '#2563eb');
            const fillColor = isSelected ? 'rgba(56, 189, 248, 0.3)' : (isBike ? 'rgba(139, 92, 246, 0.22)' : 'rgba(37, 99, 235, 0.22)');

            // Fill
            ctx.fillStyle = fillColor;
            ctx.fillRect(slot.x, slot.y, slot.width, slot.height);

            // Border
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.setLineDash(isSelected ? [6, 3] : []);
            ctx.strokeRect(slot.x, slot.y, slot.width, slot.height);
            ctx.setLineDash([]);

            // Label tag above / inside slot
            const tagText = `${slot.id} [${slot.vehicle_type.toUpperCase()}]`;
            ctx.font = 'bold 12px Inter, sans-serif';
            const textMetrics = ctx.measureText(tagText);
            const tagW = textMetrics.width + 10;
            const tagH = 18;

            ctx.fillStyle = isSelected ? '#0284c7' : (isBike ? '#7c3aed' : '#1d4ed8');
            ctx.fillRect(slot.x, slot.y - tagH > 0 ? slot.y - tagH : slot.y, tagW, tagH);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(tagText, slot.x + 5, (slot.y - tagH > 0 ? slot.y - tagH : slot.y) + 13);

            // Resize handle at bottom-right corner for selected slot
            if (isSelected) {
                const handleSize = editorState.handleSize;
                const hx = slot.x + slot.width - handleSize / 2;
                const hy = slot.y + slot.height - handleSize / 2;

                ctx.fillStyle = '#38bdf8';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.fillRect(hx, hy, handleSize, handleSize);
                ctx.strokeRect(hx, hy, handleSize, handleSize);
            }
        });
    }

    function getCanvasCoords(e) {
        const rect = DOM.slotEditorCanvas.getBoundingClientRect();
        const scaleX = DOM.slotEditorCanvas.width / rect.width;
        const scaleY = DOM.slotEditorCanvas.height / rect.height;
        return {
            x: Math.round((e.clientX - rect.left) * scaleX),
            y: Math.round((e.clientY - rect.top) * scaleY)
        };
    }

    function isPointInHandle(px, py, slot) {
        const hs = editorState.handleSize;
        const hx = slot.x + slot.width - hs / 2;
        const hy = slot.y + slot.height - hs / 2;
        return px >= hx - 4 && px <= hx + hs + 4 && py >= hy - 4 && py <= hy + hs + 4;
    }

    function isPointInSlot(px, py, slot) {
        return px >= slot.x && px <= slot.x + slot.width && py >= slot.y && py <= slot.y + slot.height;
    }

    function onCanvasMouseDown(e) {
        const pt = getCanvasCoords(e);

        // 1. Check if clicked on resize handle of currently selected slot
        if (editorState.selectedIdx >= 0) {
            const selSlot = editorState.slots[editorState.selectedIdx];
            if (selSlot && isPointInHandle(pt.x, pt.y, selSlot)) {
                editorState.isResizing = true;
                return;
            }
        }

        // 2. Check if clicked inside any slot (iterate backwards so topmost selected)
        let foundIdx = -1;
        for (let i = editorState.slots.length - 1; i >= 0; i--) {
            if (isPointInSlot(pt.x, pt.y, editorState.slots[i])) {
                foundIdx = i;
                break;
            }
        }

        if (foundIdx >= 0) {
            editorState.selectedIdx = foundIdx;
            editorState.isDragging = true;
            const slot = editorState.slots[foundIdx];
            editorState.dragOffsetX = pt.x - slot.x;
            editorState.dragOffsetY = pt.y - slot.y;
        } else {
            editorState.selectedIdx = -1;
        }

        updateInspectorPanel();
        drawEditorCanvas();
    }

    function onCanvasMouseMove(e) {
        const pt = getCanvasCoords(e);
        const canvas = DOM.slotEditorCanvas;

        if (editorState.isDragging && editorState.selectedIdx >= 0) {
            const slot = editorState.slots[editorState.selectedIdx];
            slot.x = Math.max(0, Math.min(canvas.width - slot.width, pt.x - editorState.dragOffsetX));
            slot.y = Math.max(0, Math.min(canvas.height - slot.height, pt.y - editorState.dragOffsetY));
            syncInspectorFields(slot);
            drawEditorCanvas();
            return;
        }

        if (editorState.isResizing && editorState.selectedIdx >= 0) {
            const slot = editorState.slots[editorState.selectedIdx];
            slot.width = Math.max(30, Math.min(canvas.width - slot.x, pt.x - slot.x));
            slot.height = Math.max(20, Math.min(canvas.height - slot.y, pt.y - slot.y));
            syncInspectorFields(slot);
            drawEditorCanvas();
            return;
        }

        // Update hover cursor
        if (editorState.selectedIdx >= 0) {
            const selSlot = editorState.slots[editorState.selectedIdx];
            if (selSlot && isPointInHandle(pt.x, pt.y, selSlot)) {
                canvas.style.cursor = 'se-resize';
                return;
            }
        }

        const isOverAny = editorState.slots.some(s => isPointInSlot(pt.x, pt.y, s));
        canvas.style.cursor = isOverAny ? 'move' : 'crosshair';
    }

    function onCanvasMouseUp() {
        editorState.isDragging = false;
        editorState.isResizing = false;
    }

    function syncInspectorFields(slot) {
        if (!slot) return;
        DOM.inspectorSlotId.value = slot.id;
        DOM.inspectorSlotType.value = slot.vehicle_type;
        DOM.inspectorSlotX.value = slot.x;
        DOM.inspectorSlotY.value = slot.y;
        DOM.inspectorSlotW.value = slot.width;
        DOM.inspectorSlotH.value = slot.height;
    }

    function updateInspectorPanel() {
        DOM.inspectorSlotsCount.textContent = editorState.slots.length;

        // Render chips
        DOM.inspectorSlotsChipsContainer.innerHTML = editorState.slots.map((s, idx) => `
            <button type="button" class="slot-chip ${s.vehicle_type.toLowerCase()} ${idx === editorState.selectedIdx ? 'active' : ''}" onclick="App.selectEditorSlot(${idx})">
                ${s.id}
            </button>
        `).join('');

        if (editorState.selectedIdx >= 0 && editorState.slots[editorState.selectedIdx]) {
            const slot = editorState.slots[editorState.selectedIdx];
            DOM.inspectorFormWrap.classList.remove('disabled');
            DOM.inspectorSelectedTag.textContent = `${slot.id} (${slot.vehicle_type})`;
            DOM.inspectorSelectedTag.className = `badge-pill ${slot.vehicle_type === 'Bike' ? 'orange' : 'green'}`;
            syncInspectorFields(slot);
        } else {
            DOM.inspectorFormWrap.classList.add('disabled');
            DOM.inspectorSelectedTag.textContent = 'None Selected';
            DOM.inspectorSelectedTag.className = 'badge-pill gray';
            DOM.inspectorSlotId.value = '';
            DOM.inspectorSlotX.value = '';
            DOM.inspectorSlotY.value = '';
            DOM.inspectorSlotW.value = '';
            DOM.inspectorSlotH.value = '';
        }
    }

    function selectEditorSlot(idx) {
        if (idx >= 0 && idx < editorState.slots.length) {
            editorState.selectedIdx = idx;
            updateInspectorPanel();
            drawEditorCanvas();
        }
    }

    function onInspectorInputChange() {
        if (editorState.selectedIdx < 0 || !editorState.slots[editorState.selectedIdx]) return;
        const slot = editorState.slots[editorState.selectedIdx];

        slot.id = (DOM.inspectorSlotId.value || slot.id).trim().toUpperCase();
        slot.vehicle_type = DOM.inspectorSlotType.value;
        slot.x = Math.max(0, parseInt(DOM.inspectorSlotX.value) || 0);
        slot.y = Math.max(0, parseInt(DOM.inspectorSlotY.value) || 0);
        slot.width = Math.max(20, parseInt(DOM.inspectorSlotW.value) || 107);
        slot.height = Math.max(20, parseInt(DOM.inspectorSlotH.value) || 48);

        DOM.inspectorSelectedTag.textContent = `${slot.id} (${slot.vehicle_type})`;
        drawEditorCanvas();
    }

    function addEditorSlot(vehicleType = 'Car') {
        const prefix = vehicleType === 'Bike' ? 'B' : 'A';
        const existingNums = editorState.slots
            .filter(s => s.id.startsWith(prefix))
            .map(s => parseInt(s.id.slice(1)) || 0);
        const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
        const newId = `${prefix}${String(nextNum).padStart(2, '0')}`;

        const newSlot = {
            id: newId,
            x: 100 + (editorState.slots.length * 20) % 600,
            y: 150 + (editorState.slots.length * 15) % 400,
            width: vehicleType === 'Bike' ? 75 : 107,
            height: 48,
            vehicle_type: vehicleType
        };

        editorState.slots.push(newSlot);
        editorState.selectedIdx = editorState.slots.length - 1;
        updateInspectorPanel();
        drawEditorCanvas();
        showToast(`Added new slot ${newId} (${vehicleType})`, "info");
    }

    function deleteSelectedEditorSlot() {
        if (editorState.selectedIdx < 0) return;
        const removed = editorState.slots.splice(editorState.selectedIdx, 1);
        editorState.selectedIdx = editorState.slots.length > 0 ? Math.max(0, editorState.selectedIdx - 1) : -1;
        updateInspectorPanel();
        drawEditorCanvas();
        showToast(`Deleted slot ${removed[0]?.id || ''}`, "info");
    }

    function duplicateSelectedEditorSlot() {
        if (editorState.selectedIdx < 0) return;
        const base = editorState.slots[editorState.selectedIdx];
        const prefix = base.vehicle_type === 'Bike' ? 'B' : 'A';
        const existingNums = editorState.slots
            .filter(s => s.id.startsWith(prefix))
            .map(s => parseInt(s.id.slice(1)) || 0);
        const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
        const newId = `${prefix}${String(nextNum).padStart(2, '0')}`;

        const cloned = {
            ...base,
            id: newId,
            x: Math.min(DOM.slotEditorCanvas.width - base.width, base.x + 25),
            y: Math.min(DOM.slotEditorCanvas.height - base.height, base.y + 25)
        };

        editorState.slots.push(cloned);
        editorState.selectedIdx = editorState.slots.length - 1;
        updateInspectorPanel();
        drawEditorCanvas();
        showToast(`Duplicated as slot ${newId}`, "info");
    }

    async function saveEditedSlots() {
        if (!editorState.slots || editorState.slots.length === 0) {
            showToast("Cannot save empty parking slots list.", "warning");
            return;
        }

        try {
            const res = await fetch('/api/admin/parking-slots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slots: editorState.slots })
            });

            const data = await res.json();
            if (data.success) {
                showToast(`✓ Saved ${data.count} slot boundaries successfully! Live YOLO detection updated.`, "success");
                closeSlotEditor();
            } else {
                showToast(data.error || "Failed to save parking slots", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Server connection error while saving slots", "error");
        }
    }

    // ==================== 6. ADMIN PANEL ====================
    async function fetchAdminData() {
        try {
            // Active Reservations
            const resResv = await fetch('/api/reservations/active');
            const dataResv = await resResv.json();
            if (dataResv.success) {
                DOM.adminResvCount.textContent = `${dataResv.count} Active`;
                renderAdminReservations(dataResv.reservations);
            }

            // History
            const resHist = await fetch('/api/parking/history?limit=25');
            const dataHist = await resHist.json();
            if (dataHist.success) {
                renderHistoryTable(dataHist.history);
            }
        } catch (err) {
            console.error("Error fetching admin data:", err);
        }
    }

    function renderAdminReservations(resvs) {
        if (!resvs || resvs.length === 0) {
            DOM.adminResvTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:1.5rem; color:#64748b;">
                        No active 2-minute reservations at this moment.
                    </td>
                </tr>
            `;
            return;
        }

        DOM.adminResvTableBody.innerHTML = resvs.map(r => `
            <tr>
                <td><strong style="font-family:var(--font-mono);color:#d97706;">${r.slot_number}</strong></td>
                <td>${r.user_name}</td>
                <td><code style="font-family:var(--font-mono);">${r.vehicle_number}</code></td>
                <td>${r.vehicle_type}</td>
                <td>${r.location_name || 'Main Gate'}</td>
                <td><span class="badge-pill orange">🟠 Reserved</span></td>
                <td><strong class="text-orange" style="font-family:var(--font-mono);">${r.minutes_remaining}</strong></td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="App.cancelReservation(${r.slot_id})">
                        Cancel
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function renderHistoryTable(hist) {
        if (!hist || hist.length === 0) {
            DOM.historyTableBody.innerHTML = `
                <tr><td colspan="8" style="text-align:center; padding:1.5rem; color:#64748b;">No parking history recorded yet.</td></tr>
            `;
            return;
        }

        DOM.historyTableBody.innerHTML = hist.map(h => `
            <tr>
                <td>#${h.id}</td>
                <td>${h.location_name || 'Main Gate'}</td>
                <td><strong style="font-family:var(--font-mono);">${h.slot_number}</strong></td>
                <td>${h.vehicle_type}</td>
                <td><code style="font-family:var(--font-mono);">${h.vehicle_number || '-'}</code></td>
                <td>${h.previous_status === 'available' ? '🟢 Available' : h.previous_status === 'occupied' ? '🔴 Occupied' : '🟠 Reserved'}</td>
                <td><strong>${h.new_status === 'available' ? '🟢 Available' : h.new_status === 'occupied' ? '🔴 Occupied' : '🟠 Reserved'}</strong></td>
                <td style="font-size:0.8rem; color:#64748b;">${h.timestamp}</td>
            </tr>
        `).join('');
    }

    async function handleResetDemo() {
        if (!confirm('Reset all demo mock parking data to initial default state?')) return;
        try {
            const res = await fetch('/api/demo/reset', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast("Demo mock data reset successfully", "success");
                state.activeReservation = null;
                DOM.userReservationBanner.classList.add('hidden');
                fetchLocations();
                fetchAdminData();
            }
        } catch (err) {
            console.error(err);
        }
    }

    // ==================== 7. AUTH ====================
    async function checkAuthStatus() {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (data.authenticated) {
                state.isAuthenticated = true;
                if (DOM.adminOnlyControls) {
                    DOM.adminOnlyControls.forEach(el => el.classList.remove('hidden'));
                }
            } else {
                state.isAuthenticated = false;
                if (DOM.adminOnlyControls) {
                    DOM.adminOnlyControls.forEach(el => el.classList.add('hidden'));
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    function openLoginModal(e) {
        if (e && e.preventDefault) e.preventDefault();
        DOM.loginErrorBanner.classList.add('hidden');
        DOM.loginModal.classList.remove('hidden');
    }

    function closeLoginModal() {
        DOM.loginModal.classList.add('hidden');
    }

    function fillDemoLogin() {
        DOM.adminUserInput.value = 'admin';
        DOM.adminPassInput.value = 'admin123';
    }

    async function handleLoginSubmit(event) {
        event.preventDefault();
        DOM.loginErrorBanner.classList.add('hidden');

        const u = DOM.adminUserInput.value.trim();
        const p = DOM.adminPassInput.value.trim();

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });

            const data = await res.json();
            if (data.success) {
                showToast("Admin login successful", "success");
                closeLoginModal();
                await checkAuthStatus();
            } else {
                DOM.loginErrorBanner.textContent = data.error || 'Invalid username or password.';
                DOM.loginErrorBanner.classList.remove('hidden');
            }
        } catch (err) {
            DOM.loginErrorBanner.textContent = 'Server connection error.';
            DOM.loginErrorBanner.classList.remove('hidden');
        }
    }

    async function handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            showToast("Logged out", "info");
            await checkAuthStatus();
            showLocationsView();
        } catch (err) {
            console.error(err);
        }
    }

    // ==================== TOAST NOTIFICATIONS ====================
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'fa-circle-info';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-triangle-exclamation';
        if (type === 'warning') icon = 'fa-clock';

        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.style.transition = 'all 0.25s ease';
            setTimeout(() => toast.remove(), 250);
        }, 4000);
    }

    return {
        init,
        showLocationsView,
        showMapView,
        showQueueView,
        showCameraView,
        showAdminView,
        filterByDistance,
        clearSearch,
        viewLocationMap,
        handleSlotClick,
        openReservationModal,
        closeReservationModal,
        handleReservationSubmit,
        confirmArrival,
        cancelReservation,
        openQueueModal,
        closeQueueModal,
        handleQueueSubmit,
        deleteQueueItem,
        handleResetDemo,
        openLoginModal,
        closeLoginModal,
        fillDemoLogin,
        handleLoginSubmit,
        handleLogout,
        handleStreamError,
        // Slot Editor Exports
        openSlotEditor,
        closeSlotEditor,
        selectEditorSlot,
        onInspectorInputChange,
        addEditorSlot,
        deleteSelectedEditorSlot,
        duplicateSelectedEditorSlot,
        resetEditorDefaultSlots,
        saveEditedSlots
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

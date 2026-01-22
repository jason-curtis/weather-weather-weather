// App state
const state = {
    currentLocation: null,
    searchHistory: [],
    maxHistoryItems: 10,
    map: null,
    minimap: null,
    mapMarker: null,
    minimapMarker: null,
    isLoadingForecast: false,
    carouselMinimaps: [] // Store carousel minimap instances
};

// DOM elements
const locationSearch = document.getElementById('locationSearch');
const searchResults = document.getElementById('searchResults');
const useCurrentLocationBtn = document.getElementById('useCurrentLocation');
const showMapBtn = document.getElementById('showMapBtn');
const mapModal = document.getElementById('mapModal');
const closeMapBtn = document.getElementById('closeMapBtn');
const recentSearchesDiv = document.getElementById('recentSearches');
const currentLocationDiv = document.getElementById('currentLocation');
const forecastContainer = document.getElementById('forecastContainer');
const loadingIndicator = document.getElementById('loadingIndicator');

// Initialize app
function init() {
    loadSearchHistory();
    renderRecentSearches();

    // Check URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat');
    const lon = urlParams.get('lon');
    const name = urlParams.get('name');

    if (lat && lon) {
        // Load from URL parameters
        const location = {
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            name: name || `${lat}, ${lon}`
        };
        loadForecast(location);
    } else if (state.searchHistory.length > 0) {
        // Load most recent search if no URL parameters
        loadForecast(state.searchHistory[0]);
    }

    // Event listeners
    locationSearch.addEventListener('input', handleSearchInput);
    useCurrentLocationBtn.addEventListener('click', handleCurrentLocation);
    showMapBtn.addEventListener('click', () => showMapModal());
    closeMapBtn.addEventListener('click', closeMapModal);

    // Close map modal when clicking outside (but not when dragging)
    let modalMouseDownTarget = null;
    let modalMouseDownX = 0;
    let modalMouseDownY = 0;

    mapModal.addEventListener('mousedown', (e) => {
        modalMouseDownTarget = e.target;
        modalMouseDownX = e.clientX;
        modalMouseDownY = e.clientY;
    });

    mapModal.addEventListener('mouseup', (e) => {
        // Only close if mousedown and mouseup were on the modal background
        // and didn't move much (wasn't a drag)
        const dragDistance = Math.sqrt(
            Math.pow(e.clientX - modalMouseDownX, 2) +
            Math.pow(e.clientY - modalMouseDownY, 2)
        );

        if (e.target === mapModal &&
            modalMouseDownTarget === mapModal &&
            dragDistance < 10) {
            closeMapModal();
        }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResults.classList.remove('show');
        }
    });
}

// Load search history from localStorage
function loadSearchHistory() {
    const saved = localStorage.getItem('weatherSearchHistory');
    if (saved) {
        try {
            state.searchHistory = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading search history:', e);
            state.searchHistory = [];
        }
    }
}

// Save search history to localStorage
function saveSearchHistory() {
    localStorage.setItem('weatherSearchHistory', JSON.stringify(state.searchHistory));
}

// Add location to search history
function addToHistory(location) {
    // Check if location already exists (compare with same precision as URL params)
    const existingIndex = state.searchHistory.findIndex(
        item => item.lat.toFixed(4) === location.lat.toFixed(4) &&
                item.lon.toFixed(4) === location.lon.toFixed(4)
    );

    if (existingIndex !== -1) {
        // Location exists - update its name if changed, but don't reorder
        state.searchHistory[existingIndex].name = location.name;
        saveSearchHistory();
        renderRecentSearches();
        return;
    }

    // New location - add to beginning
    state.searchHistory.unshift(location);

    // Limit history size
    if (state.searchHistory.length > state.maxHistoryItems) {
        state.searchHistory = state.searchHistory.slice(0, state.maxHistoryItems);
    }

    saveSearchHistory();
    renderRecentSearches();
}

// Render recent searches carousel
function renderRecentSearches() {
    // Clean up old minimap instances
    state.carouselMinimaps.forEach(map => {
        if (map) {
            map.remove();
        }
    });
    state.carouselMinimaps = [];

    if (state.searchHistory.length === 0) {
        recentSearchesDiv.classList.remove('show');
        return;
    }

    recentSearchesDiv.classList.add('show');

    const carousel = document.createElement('div');
    carousel.className = 'carousel';

    const header = document.createElement('h3');
    header.textContent = 'Your Locations';

    state.searchHistory.forEach((location, index) => {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        if (state.currentLocation &&
            state.currentLocation.lat === location.lat &&
            state.currentLocation.lon === location.lon) {
            item.classList.add('active');
        }

        // Minimap container with fixed dimensions to prevent layout shift
        const minimapContainer = document.createElement('div');
        minimapContainer.className = 'carousel-minimap';
        minimapContainer.id = `carousel-minimap-${index}`;
        item.appendChild(minimapContainer);

        // Content container for name and controls
        const contentContainer = document.createElement('div');
        contentContainer.className = 'carousel-item-content';

        // Location name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'carousel-item-name';
        nameSpan.textContent = location.name;
        contentContainer.appendChild(nameSpan);

        // Controls container
        const controls = document.createElement('div');
        controls.className = 'carousel-item-controls';

        // Rename button
        const renameBtn = document.createElement('button');
        renameBtn.className = 'carousel-item-btn rename-btn';
        renameBtn.innerHTML = '✎';
        renameBtn.title = 'Rename';
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renameSearch(index);
        });
        controls.appendChild(renameBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'carousel-item-btn delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeSearch(index);
        });
        controls.appendChild(deleteBtn);

        contentContainer.appendChild(controls);
        item.appendChild(contentContainer);

        // Click to load forecast
        item.addEventListener('click', () => {
            loadForecast(location);
        });

        carousel.appendChild(item);
    });

    recentSearchesDiv.innerHTML = '';
    recentSearchesDiv.appendChild(header);
    recentSearchesDiv.appendChild(carousel);

    // Initialize minimaps after DOM is updated
    setTimeout(() => {
        state.searchHistory.forEach((location, index) => {
            initializeCarouselMinimap(index, location.lat, location.lon);
        });
    }, 100);
}

// Remove a search from history
function removeSearch(index) {
    state.searchHistory.splice(index, 1);
    saveSearchHistory();
    renderRecentSearches();
}

// Rename a search in history
function renameSearch(index) {
    const location = state.searchHistory[index];
    const newName = prompt('Enter a new name for this location:', location.name);

    if (newName && newName.trim() !== '') {
        location.name = newName.trim();
        saveSearchHistory();
        renderRecentSearches();

        // Update current location display if this is the active location
        if (state.currentLocation &&
            state.currentLocation.lat === location.lat &&
            state.currentLocation.lon === location.lon) {
            state.currentLocation.name = newName.trim();

            // Update URL
            const urlParams = new URLSearchParams();
            urlParams.set('lat', location.lat.toFixed(4));
            urlParams.set('lon', location.lon.toFixed(4));
            urlParams.set('name', newName.trim());
            const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
            window.history.pushState({ location: state.currentLocation }, '', newUrl);

            // Update page title
            document.title = `weather3.cloud - ${newName.trim()}`;

            // Update forecast title
            const forecastTitle = document.querySelector('.forecast-title');
            if (forecastTitle) {
                forecastTitle.textContent = `Forecast for ${newName.trim()}`;
            }
        }
    }
}

// Handle search input with debouncing
let searchTimeout;
function handleSearchInput(e) {
    const query = e.target.value.trim();

    clearTimeout(searchTimeout);

    if (query.length < 3) {
        searchResults.classList.remove('show');
        return;
    }

    searchTimeout = setTimeout(() => {
        searchLocation(query);
    }, 300);
}

// Search for location using Nominatim API
async function searchLocation(query) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'WeatherForecastApp/1.0'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const results = await response.json();
        displaySearchResults(results);
    } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = '<div class="search-result-item">Error searching location</div>';
        searchResults.classList.add('show');
    }
}

// Display search results
function displaySearchResults(results) {
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
        searchResults.classList.add('show');
        return;
    }

    searchResults.innerHTML = '';

    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.textContent = result.display_name;

        item.addEventListener('click', () => {
            const location = {
                name: result.display_name,
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon)
            };

            locationSearch.value = result.display_name;
            searchResults.classList.remove('show');

            loadForecast(location);
        });

        searchResults.appendChild(item);
    });

    searchResults.classList.add('show');
}

// Handle current location button
function handleCurrentLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    useCurrentLocationBtn.disabled = true;
    useCurrentLocationBtn.textContent = 'Getting location...';

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // Reverse geocode to get location name
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?` +
                    `format=json&lat=${lat}&lon=${lon}`,
                    {
                        headers: {
                            'User-Agent': 'WeatherForecastApp/1.0'
                        }
                    }
                );

                const data = await response.json();

                const location = {
                    name: data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                    lat: lat,
                    lon: lon
                };

                locationSearch.value = location.name;
                loadForecast(location);
            } catch (error) {
                console.error('Reverse geocoding error:', error);
                const location = {
                    name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                    lat: lat,
                    lon: lon
                };
                loadForecast(location);
            } finally {
                useCurrentLocationBtn.disabled = false;
                useCurrentLocationBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 4V2M10 18v-2M16 10h2M4 10H2M14.95 14.95l1.414 1.414M3.636 3.636L5.05 5.05M14.95 5.05l1.414-1.414M3.636 16.364L5.05 14.95M13 10a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
            }
        },
        (error) => {
            console.error('Geolocation error:', error);
            alert('Unable to get your location: ' + error.message);
            useCurrentLocationBtn.disabled = false;
            useCurrentLocationBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 4V2M10 18v-2M16 10h2M4 10H2M14.95 14.95l1.414 1.414M3.636 3.636L5.05 5.05M14.95 5.05l1.414-1.414M3.636 16.364L5.05 14.95M13 10a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
        }
    );
}

// Generate forecast URL for specific time offset
function generateForecastURL(lat, lon, hoursAhead = 0) {
    const params = new URLSearchParams({
        w0: 't',           // Temperature
        w1: 'td',          // Dewpoint
        w2: 'wc',          // Wind chill
        w3: 'sfcwind',     // Surface wind
        w3u: '1',
        w4: 'sky',         // Sky cover
        w5: 'pop',         // Probability of precipitation
        w6: 'rh',          // Relative humidity
        w7: 'rain',        // Rain
        w8: 'thunder',     // Thunder
        w9: 'snow',        // Snow
        w10: 'fzg',        // Freezing
        w11: 'sleet',      // Sleet
        w13u: '0',
        w14u: '1',
        w15u: '1',
        AheadHour: hoursAhead.toString(),
        Submit: 'Submit',
        FcstType: 'graphical',
        textField1: lat.toFixed(4),
        textField2: lon.toFixed(4),
        site: 'all',
        unit: '0',
        dd: '',
        bw: ''
    });

    return `https://forecast.weather.gov/MapClick.php?${params.toString()}`;
}

// Fetch the forecast page and extract the image URL
async function fetchForecastImage(pageUrl) {
    try {
        const response = await fetch(pageUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch forecast page');
        }

        const html = await response.text();

        // Check if NWS returned an error page
        if (html.includes('An error occurred while processing your request')) {
            console.error('NWS server error for this location');
            return 'NWS_ERROR';
        }

        // Extract the meteograms/Plotter.php URL from the HTML
        // The pattern is: meteograms/Plotter.php?lat=...&lon=...
        const match = html.match(/meteograms\/Plotter\.php\?[^"]+/);

        if (match) {
            const relativeUrl = match[0];
            return `https://forecast.weather.gov/${relativeUrl}`;
        }

        return null;
    } catch (error) {
        console.error('Error fetching forecast image:', error);
        return null;
    }
}

// Load forecast for a location
async function loadForecast(location) {
    // Prevent concurrent forecast loads
    if (state.isLoadingForecast) {
        console.log('Forecast already loading, ignoring request');
        return;
    }

    state.isLoadingForecast = true;
    state.currentLocation = location;

    try {
        // Update URL for sharing
        const urlParams = new URLSearchParams();
        urlParams.set('lat', location.lat.toFixed(4));
        urlParams.set('lon', location.lon.toFixed(4));
        urlParams.set('name', location.name);
        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        window.history.pushState({ location }, '', newUrl);

        // Update page title
        document.title = `weather3.cloud - ${location.name}`;

        // Add to history
        addToHistory(location);

        // Show loading
        loadingIndicator.style.display = 'block';
        forecastContainer.innerHTML = '';

        // Hide the separate current location div (we'll put title in forecast container)
        currentLocationDiv.style.display = 'none';

    // Generate forecast segments
    // NWS graphical forecast provides about 6.5 days (~155 hours)
    // Each segment shows 48 hours starting from AheadHour
    // To avoid gaps, we generate segments at 0, 48, 96, and 107
    // This gives us: 0-48, 48-96, 96-144, 107-155 (slight overlap with previous)
    const segments = [];
    const segmentStarts = [0, 48, 96, 107]; // Covers full forecast period without gaps

    for (const hours of segmentStarts) {
        segments.push({
            label: getSegmentLabel(hours),
            url: generateForecastURL(location.lat, location.lon, hours),
            hours: hours
        });
    }

    // Create forecast container
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'forecast-scroll';

    // Load each segment
    for (const segment of segments) {
        const segmentDiv = document.createElement('div');
        segmentDiv.className = 'forecast-segment';

        const label = document.createElement('div');
        label.className = 'segment-label';
        label.textContent = segment.label;

        // Add info icon to last segment
        if (segment.hours === 107) {
            const infoIcon = document.createElement('span');
            infoIcon.className = 'info-icon';
            infoIcon.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `;
            infoIcon.title = 'Why does this start at 107 hours?';

            const tooltip = document.createElement('div');
            tooltip.className = 'info-tooltip';
            tooltip.innerHTML = `
                <strong>Why does the last segment start at 107 hours?</strong><br><br>
                The National Weather Service's graphical forecast system provides data starting from
                any hour offset up to a maximum of <strong>hour 107</strong>. Each forecast shows a
                48-hour window from that starting point.<br><br>
                Our segments are positioned at:
                <ul>
                    <li>0-48 hours (first 2 days)</li>
                    <li>48-96 hours (days 2-4)</li>
                    <li>96-144 hours (days 4-6)</li>
                    <li>107-155 hours (days 4.5-6.5)</li>
                </ul>
                The last segment starts at hour 107 (not 144) because <strong>107 is the maximum
                starting offset available</strong> from the NWS. This gives us the longest possible
                forecast window, showing data up to about 155 hours (6.5 days) out.
            `;

            infoIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                tooltip.classList.toggle('show');
            });

            // Close tooltip when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.info-icon') && !e.target.closest('.info-tooltip')) {
                    tooltip.classList.remove('show');
                }
            });

            label.appendChild(infoIcon);
            label.appendChild(tooltip);
        }

        segmentDiv.appendChild(label);

        // Fetch the page and extract the image URL
        try {
            const imageUrl = await fetchForecastImage(segment.url);

            if (imageUrl === 'NWS_ERROR') {
                // NWS server returned an error
                const errorDiv = document.createElement('div');
                errorDiv.style.padding = '20px';
                errorDiv.style.textAlign = 'center';
                errorDiv.style.color = '#999';
                errorDiv.innerHTML = `
                    <p style="margin-bottom: 10px;">NWS graphical forecast temporarily unavailable</p>
                    <a href="https://forecast.weather.gov/MapClick.php?lat=${location.lat.toFixed(4)}&lon=${location.lon.toFixed(4)}"
                       target="_blank"
                       style="color: #667eea; text-decoration: underline;">
                        View text forecast on weather.gov
                    </a>
                `;
                segmentDiv.appendChild(errorDiv);
            } else if (imageUrl) {
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = segment.label;
                img.loading = 'lazy';

                img.onerror = () => {
                    const errorDiv = document.createElement('div');
                    errorDiv.style.padding = '20px';
                    errorDiv.style.textAlign = 'center';
                    errorDiv.style.color = '#999';
                    errorDiv.textContent = 'Forecast image not available';
                    segmentDiv.appendChild(errorDiv);
                };

                segmentDiv.appendChild(img);
            } else {
                const errorDiv = document.createElement('div');
                errorDiv.style.padding = '20px';
                errorDiv.style.textAlign = 'center';
                errorDiv.style.color = '#999';
                errorDiv.textContent = 'Forecast not available';
                segmentDiv.appendChild(errorDiv);
            }
        } catch (error) {
            console.error('Error loading forecast segment:', error);
            const errorDiv = document.createElement('div');
            errorDiv.style.padding = '20px';
            errorDiv.style.textAlign = 'center';
            errorDiv.style.color = '#999';
            errorDiv.textContent = 'Error loading forecast';
            segmentDiv.appendChild(errorDiv);
        }

        scrollContainer.appendChild(segmentDiv);
    }

    // Create forecast header with location name and minimap
    const forecastHeader = document.createElement('div');
    forecastHeader.className = 'forecast-header';

    const headerContent = document.createElement('div');
    headerContent.className = 'forecast-header-content';

    const locationTitle = document.createElement('h2');
    locationTitle.className = 'forecast-title';
    locationTitle.textContent = `Forecast for ${location.name}`;

    const minimapDiv = document.createElement('div');
    minimapDiv.id = 'forecast-minimap';
    minimapDiv.className = 'location-minimap clickable-minimap';
    minimapDiv.title = 'Click to edit location';

    // Make minimap clickable to open map modal
    minimapDiv.addEventListener('click', () => {
        showMapModal(location.lat, location.lon);
    });

    headerContent.appendChild(locationTitle);
    headerContent.appendChild(minimapDiv);
    forecastHeader.appendChild(headerContent);

    // Wrap scroll container in a wrapper for overflow
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'forecast-scroll-wrapper';
    scrollWrapper.appendChild(scrollContainer);

    forecastContainer.appendChild(forecastHeader);
    forecastContainer.appendChild(scrollWrapper);

    // Initialize minimap after DOM update
    setTimeout(() => {
        initializeForecastMinimap(location.lat, location.lon);
    }, 100);

    loadingIndicator.style.display = 'none';
    } finally {
        state.isLoadingForecast = false;
    }
}

// Get label for forecast segment based on hours ahead
function getSegmentLabel(hoursAhead) {
    if (hoursAhead === 0) {
        return 'First 48 hours';
    }

    const endHour = hoursAhead + 48;
    return `${hoursAhead}-${endHour} hours`;
}

// Map functions
function showMapModal(lat = null, lon = null) {
    mapModal.classList.add('show');

    // Initialize map if not already initialized
    if (!state.map) {
        setTimeout(() => {
            initializeMap(lat, lon);
        }, 100); // Small delay to ensure modal is visible
    } else {
        // If lat/lon provided, center on it and add/update marker
        if (lat !== null && lon !== null) {
            state.map.setView([lat, lon], 8);

            // Update or create marker (draggable)
            if (state.mapMarker) {
                state.mapMarker.setLatLng([lat, lon]);
            } else {
                state.mapMarker = L.marker([lat, lon], { draggable: true }).addTo(state.map);
                setupMarkerDragHandler();
            }
        }

        // Refresh map size
        state.map.invalidateSize();
    }
}

function closeMapModal() {
    mapModal.classList.remove('show');
}

function initializeMap(centerLat = null, centerLon = null) {
    // Use provided coordinates or default
    const lat = centerLat !== null ? centerLat : (state.currentLocation?.lat || 39.8283);
    const lon = centerLon !== null ? centerLon : (state.currentLocation?.lon || -98.5795);
    const zoom = (centerLat !== null) ? 8 : (state.currentLocation ? 8 : 4);

    // Initialize main map with topographic tiles
    // Disable double-click zoom since we use clicks to select locations
    state.map = L.map('map', {
        doubleClickZoom: false
    }).setView([lat, lon], zoom);

    // Add OpenTopoMap tiles (topographic)
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
    }).addTo(state.map);

    // If we have initial coordinates, add a draggable marker
    if (centerLat !== null && centerLon !== null) {
        state.mapMarker = L.marker([lat, lon], { draggable: true }).addTo(state.map);
        setupMarkerDragHandler();
    }

    // Add click handler
    state.map.on('click', async (e) => {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;

        // Update or create marker (draggable)
        if (state.mapMarker) {
            state.mapMarker.setLatLng(e.latlng);
        } else {
            state.mapMarker = L.marker(e.latlng, { draggable: true }).addTo(state.map);
            setupMarkerDragHandler();
        }

        // Reverse geocode to get location name
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?` +
                `format=json&lat=${lat}&lon=${lon}`,
                {
                    headers: {
                        'User-Agent': 'WeatherForecastApp/1.0'
                    }
                }
            );

            const data = await response.json();

            const location = {
                name: data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                lat: lat,
                lon: lon
            };

            // Load forecast and close modal
            closeMapModal();
            locationSearch.value = location.name;
            loadForecast(location);
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            const location = {
                name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                lat: lat,
                lon: lon
            };
            closeMapModal();
            loadForecast(location);
        }
    });
}

// Setup drag handler for map marker
function setupMarkerDragHandler() {
    if (!state.mapMarker) return;

    state.mapMarker.on('dragend', async (e) => {
        const marker = e.target;
        const latlng = marker.getLatLng();
        const lat = latlng.lat;
        const lon = latlng.lng;

        // Reverse geocode to get location name
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?` +
                `format=json&lat=${lat}&lon=${lon}`,
                {
                    headers: {
                        'User-Agent': 'WeatherForecastApp/1.0'
                    }
                }
            );

            const data = await response.json();

            const location = {
                name: data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                lat: lat,
                lon: lon
            };

            // Load forecast and close modal
            closeMapModal();
            locationSearch.value = location.name;
            loadForecast(location);
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            const location = {
                name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                lat: lat,
                lon: lon
            };
            closeMapModal();
            loadForecast(location);
        }
    });
}

function initializeMinimap(lat, lon) {
    const minimapContainer = document.getElementById('locationMinimap');

    // Clear previous minimap
    if (state.minimap) {
        state.minimap.remove();
    }

    // Create new minimap
    state.minimap = L.map('locationMinimap', {
        center: [lat, lon],
        zoom: 8,
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false
    });

    // Add OpenTopoMap tiles
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17
    }).addTo(state.minimap);

    // Add marker
    L.marker([lat, lon]).addTo(state.minimap);
}

function initializeForecastMinimap(lat, lon) {
    const minimapContainer = document.getElementById('forecast-minimap');

    if (!minimapContainer) {
        console.warn('Forecast minimap container not found');
        return;
    }

    // Clear previous minimap
    if (state.minimap) {
        state.minimap.remove();
    }

    // Create new minimap
    state.minimap = L.map('forecast-minimap', {
        center: [lat, lon],
        zoom: 8,
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false
    });

    // Add OpenTopoMap tiles
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17
    }).addTo(state.minimap);

    // Add marker
    L.marker([lat, lon]).addTo(state.minimap);
}

function initializeCarouselMinimap(index, lat, lon) {
    const containerId = `carousel-minimap-${index}`;
    const container = document.getElementById(containerId);

    if (!container) {
        console.warn(`Container ${containerId} not found`);
        return;
    }

    // Create new minimap for this carousel item
    const minimap = L.map(containerId, {
        center: [lat, lon],
        zoom: 6,
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false
    });

    // Add OpenTopoMap tiles
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17
    }).addTo(minimap);

    // No marker for carousel minimaps

    // Store the minimap instance
    state.carouselMinimaps[index] = minimap;
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

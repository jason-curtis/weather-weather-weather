// App state
const state = {
    currentLocation: null,
    searchHistory: [],
    maxHistoryItems: 10,
    map: null,
    minimap: null,
    mapMarker: null,
    minimapMarker: null
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

    // Event listeners
    locationSearch.addEventListener('input', handleSearchInput);
    useCurrentLocationBtn.addEventListener('click', handleCurrentLocation);
    showMapBtn.addEventListener('click', showMapModal);
    closeMapBtn.addEventListener('click', closeMapModal);

    // Close map modal when clicking outside
    mapModal.addEventListener('click', (e) => {
        if (e.target === mapModal) {
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
    // Remove if already exists
    state.searchHistory = state.searchHistory.filter(
        item => !(item.lat === location.lat && item.lon === location.lon)
    );

    // Add to beginning
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
    if (state.searchHistory.length === 0) {
        recentSearchesDiv.classList.remove('show');
        return;
    }

    recentSearchesDiv.classList.add('show');

    const carousel = document.createElement('div');
    carousel.className = 'carousel';

    const header = document.createElement('h3');
    header.textContent = 'Recent Searches';

    state.searchHistory.forEach((location, index) => {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        if (state.currentLocation &&
            state.currentLocation.lat === location.lat &&
            state.currentLocation.lon === location.lon) {
            item.classList.add('active');
        }
        item.textContent = location.name;
        item.addEventListener('click', () => {
            loadForecast(location);
        });
        carousel.appendChild(item);
    });

    recentSearchesDiv.innerHTML = '';
    recentSearchesDiv.appendChild(header);
    recentSearchesDiv.appendChild(carousel);
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
    state.currentLocation = location;

    // Update UI
    currentLocationDiv.innerHTML = `<span>Forecast for: ${location.name}</span><div id="locationMinimap" class="location-minimap"></div>`;
    currentLocationDiv.classList.add('show');

    // Initialize minimap
    setTimeout(() => {
        initializeMinimap(location.lat, location.lon);
    }, 100);

    // Add to history
    addToHistory(location);

    // Show loading
    loadingIndicator.style.display = 'block';
    forecastContainer.innerHTML = '';

    // Generate forecast segments
    // NWS provides about 7 days (168 hours) of forecast
    // Each segment shows ~48 hours, so we'll load multiple segments
    // To avoid gaps, we generate segments at 0, 48, 96, and 120
    // This gives us: 0-48, 48-96, 96-144, 120-168 (last one overlaps slightly)
    const segments = [];
    const segmentStarts = [0, 48, 96, 120]; // Adjusted to cover full 168 hours

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

        segmentDiv.appendChild(label);

        // Fetch the page and extract the image URL
        try {
            const imageUrl = await fetchForecastImage(segment.url);

            if (imageUrl) {
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = segment.label;
                img.loading = 'lazy';

                img.onerror = () => {
                    const errorDiv = document.createElement('div');
                    errorDiv.style.padding = '20px';
                    errorDiv.style.textAlign = 'center';
                    errorDiv.style.color = '#999';
                    errorDiv.textContent = 'Forecast not available';
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
            errorDiv.textContent = 'Forecast not available';
            segmentDiv.appendChild(errorDiv);
        }

        scrollContainer.appendChild(segmentDiv);
    }

    forecastContainer.appendChild(scrollContainer);
    loadingIndicator.style.display = 'none';
}

// Get label for forecast segment based on hours ahead
function getSegmentLabel(hoursAhead) {
    const now = new Date();
    const startTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 48 * 60 * 60 * 1000);

    const formatDate = (date) => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
    };

    if (hoursAhead === 0) {
        return `Now - ${formatDate(endTime)}`;
    }

    return `${formatDate(startTime)} - ${formatDate(endTime)}`;
}

// Map functions
function showMapModal() {
    mapModal.classList.add('show');

    // Initialize map if not already initialized
    if (!state.map) {
        setTimeout(() => {
            initializeMap();
        }, 100); // Small delay to ensure modal is visible
    } else {
        // Refresh map size
        state.map.invalidateSize();
    }
}

function closeMapModal() {
    mapModal.classList.remove('show');
}

function initializeMap() {
    // Default center (US center)
    const defaultLat = state.currentLocation?.lat || 39.8283;
    const defaultLon = state.currentLocation?.lon || -98.5795;
    const defaultZoom = state.currentLocation ? 8 : 4;

    // Initialize main map with topographic tiles
    state.map = L.map('map').setView([defaultLat, defaultLon], defaultZoom);

    // Add OpenTopoMap tiles (topographic)
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
    }).addTo(state.map);

    // Add click handler
    state.map.on('click', async (e) => {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;

        // Update or create marker
        if (state.mapMarker) {
            state.mapMarker.setLatLng(e.latlng);
        } else {
            state.mapMarker = L.marker(e.latlng).addTo(state.map);
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

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

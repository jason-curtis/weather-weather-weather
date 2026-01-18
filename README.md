# Weather Forecast Viewer

A web application that displays extended weather forecasts from the National Weather Service (NWS) in an easy-to-use, side-scrollable interface.

## Features

- **Extended Forecast Display**: View up to 7 days of weather forecast in a side-scrollable interface
- **Location Search**: Search for any location using type-ahead search powered by OpenStreetMap
- **Geolocation Support**: Use your current location with one click
- **Search History**: Recent searches are saved in local storage and displayed in a carousel for quick access
- **Responsive Design**: Works on desktop and mobile devices

## Deployment

This app is automatically deployed to GitHub Pages when changes are pushed to the main branch.

## How to Use

### Option 1: GitHub Pages (Recommended)

The app is deployed at the GitHub Pages URL for this repository.

### Option 2: Open Directly

Simply open `index.html` in your web browser.

### Option 3: Local Server

For better compatibility and to avoid CORS issues, run a local web server:

```bash
# Using Python 3
python3 -m http.server 8000

# Then open http://localhost:8000 in your browser
```

### Using the App

1. **Search for a Location**:
   - Type a location name in the search box (e.g., "San Francisco, CA")
   - Select from the dropdown results
   - The forecast will load automatically

2. **Use Current Location**:
   - Click the location icon button
   - Allow browser location access when prompted
   - The forecast for your current location will load

3. **Quick Access to Recent Searches**:
   - Previously searched locations appear in a carousel at the top
   - Click any recent search to reload that forecast

## How It Works

The app generates multiple forecast images from the NWS graphical forecast service:
- Each segment shows approximately 48 hours of forecast data
- Multiple segments are loaded to show the full 7-day forecast
- Images are displayed side-by-side in a scrollable container

## Technical Details

- **Frontend**: Pure HTML, CSS, and JavaScript (no frameworks required)
- **Geocoding**: OpenStreetMap Nominatim API
- **Weather Data**: National Weather Service (NOAA)
- **Storage**: Browser localStorage for search history

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Geolocation feature requires HTTPS (except on localhost)

## Privacy

- No data is sent to external servers except:
  - Location search queries to OpenStreetMap
  - Forecast image requests to weather.gov
- Search history is stored locally in your browser only
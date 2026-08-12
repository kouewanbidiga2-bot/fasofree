// Location service for calculating distances and delivery times
// Uses Google Maps Distance Matrix API

export const calculateDistanceAndTime = async (origin, destination) => {
  try {
    if (!window.google || !window.google.maps) {
      console.warn('Google Maps API not loaded');
      return { distance: 0, duration: 0 };
    }

    const service = new window.google.maps.DistanceMatrixService();
    
    return new Promise((resolve, reject) => {
      service.getDistanceMatrix(
        {
          origins: [origin],
          destinations: [destination],
          travelMode: window.google.maps.TravelMode.DRIVING,
          unitSystem: window.google.maps.UnitSystem.METRIC,
        },
        (response, status) => {
          if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
            const element = response.rows[0].elements[0];
            resolve({
              distance: element.distance.value, // in meters
              distanceText: element.distance.text,
              duration: element.duration.value, // in seconds
              durationText: element.duration.text,
            });
          } else {
            console.error('Distance calculation failed:', status);
            reject(new Error('Distance calculation failed'));
          }
        }
      );
    });
  } catch (error) {
    console.error('Error calculating distance:', error);
    return { distance: 0, duration: 0 };
  }
};

export const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

export const estimateDeliveryTime = (distanceInMeters) => {
  // Base calculation: 5 minutes preparation + 2 minutes per km
  const preparationTime = 5 * 60; // 5 minutes in seconds
  const averageSpeed = 30; // km/h in urban areas
  const distanceInKm = distanceInMeters / 1000;
  const travelTime = (distanceInKm / averageSpeed) * 3600; // seconds
  
  const totalSeconds = preparationTime + travelTime;
  const totalMinutes = Math.ceil(totalSeconds / 60);
  
  return {
    totalMinutes,
    preparationMinutes: 5,
    travelMinutes: Math.ceil(travelTime / 60),
  };
};

export const formatAddress = (lat, lng) => {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.maps) {
      resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    const latlng = { lat, lng };

    geocoder.geocode({ location: latlng }, (results, status) => {
      if (status === 'OK' && results[0]) {
        resolve(results[0].formatted_address);
      } else {
        resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    });
  });
};

// Fallback coordinates for Ouagadougou restaurants
export const restaurantCoordinates = {
  'Cesar': { lat: 12.3714, lng: -1.5197 },
  'Chitir': { lat: 12.3582, lng: -1.5341 },
  'Gusto': { lat: 12.3654, lng: -1.5234 },
  'BelChiken': { lat: 12.3801, lng: -1.5089 },
};

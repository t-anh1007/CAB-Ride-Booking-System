import { useState, useEffect, useCallback } from "react";

export function useGeolocation(options = {}) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [isWatching, setIsWatching] = useState(false);

  const requestPermission = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted' || result.state === 'prompt') {
          resolve(true);
        } else {
          reject(new Error("Permission denied"));
        }
      });
    });
  }, []);

  const getCurrentLocation = useCallback(async () => {
    try {
      await requestPermission();
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const loc = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              heading: position.coords.heading,
              speed: position.coords.speed
            };
            setLocation(loc);
            resolve(loc);
          },
          (err) => {
            setError(err.message);
            reject(err);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...options }
        );
      });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [options, requestPermission]);

  useEffect(() => {
    let watchId;
    
    if (isWatching && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            heading: position.coords.heading,
            speed: position.coords.speed
          });
          setError(null);
        },
        (err) => {
          setError(err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...options }
      );
    }
    
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isWatching, options]);

  return {
    location,
    error,
    isWatching,
    startWatching: () => setIsWatching(true),
    stopWatching: () => setIsWatching(false),
    getCurrentLocation
  };
}

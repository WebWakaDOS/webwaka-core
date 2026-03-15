import { describe, it, expect, beforeEach } from 'vitest';
import { GeolocationEngine } from './index';

describe('CORE-9: Geolocation & Mapping Engine', () => {
  let geoEngine: GeolocationEngine;

  beforeEach(() => {
    geoEngine = new GeolocationEngine('osm');
  });

  it('should calculate distance and ETA between two points', async () => {
    // Lagos coordinates
    const origin = { lat: 6.5244, lng: 3.3792 };
    // Abuja coordinates
    const destination = { lat: 9.0579, lng: 7.4951 };

    const route = await geoEngine.calculateRoute(origin, destination);

    // Distance should be roughly 536km
    expect(route.distanceMeters).toBeGreaterThan(500000);
    expect(route.distanceMeters).toBeLessThan(600000);
    expect(route.durationSeconds).toBeGreaterThan(0);
    expect(route.polyline).toBeDefined();
  });

  it('should correctly identify if a point is within a geofence', () => {
    const center = { lat: 6.5244, lng: 3.3792 }; // Lagos
    const pointInside = { lat: 6.5300, lng: 3.3800 }; // Very close
    const pointOutside = { lat: 9.0579, lng: 7.4951 }; // Abuja

    // 5km radius
    expect(geoEngine.isWithinGeofence(pointInside, center, 5000)).toBe(true);
    expect(geoEngine.isWithinGeofence(pointOutside, center, 5000)).toBe(false);
  });
});

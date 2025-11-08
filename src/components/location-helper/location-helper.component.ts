import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';

declare const google: any;
declare const mappls: any;

@Component({
  selector: 'app-location-helper',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './location-helper.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationHelperComponent {
  private geminiService = inject(GeminiService);

  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  
  // Google Maps properties
  private map: any;
  private directionsService: any;
  private directionsRenderer: any;
  
  // Mappls properties
  private mapplsMap: any;

  sourceLocation = signal('');
  destinationLocation = signal('Baddiha, Arkhango, Dhanwar, Giridih, Jharkhand');
  travelMode = signal<any>('DRIVING');
  responseStyle = signal<'Default' | 'Human'>('Default');

  directions = signal<any>(null);
  isLoading = signal(false);
  isGettingLocation = signal(false);
  error = signal<string | null>(null);
  mapProvider = signal<'google' | 'mappls' | 'none'>('none');

  travelModes = [
      { id: 'DRIVING', name: 'Driving', icon: 'fa-car' },
      { id: 'WALKING', name: 'Walking', icon: 'fa-person-walking' },
      { id: 'BICYCLING', name: 'Bicycling', icon: 'fa-bicycle' },
      { id: 'TRANSIT', name: 'Transit', icon: 'fa-train-subway' },
  ];

  constructor() {
    this.checkMapProvider();
  }

  private checkMapProvider() {
    const googleReady = typeof google !== 'undefined' && typeof google.maps !== 'undefined';
    const mapplsReady = typeof mappls !== 'undefined' && (window as any).mapplsApiKey && (window as any).mapplsApiKey !== 'YOUR_MAPPLS_API_KEY';

    if (googleReady) {
        this.mapProvider.set('google');
    } else if (mapplsReady) {
        this.mapProvider.set('mappls');
    } else {
        this.mapProvider.set('none');
    }
  }

  async getDirections() {
    if (!this.sourceLocation().trim() || !this.destinationLocation().trim()) {
      this.error.set('Please enter both source and destination locations.');
      return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    this.directions.set(null);

    try {
      if (this.responseStyle() === 'Human') {
          const responseText = await this.geminiService.getHumanDirections(this.sourceLocation(), this.destinationLocation(), this.travelMode());
          this.directions.set({ summary: 'Your friendly guide says...', steps: [responseText], isHuman: true });
      } else {
          const response = await this.geminiService.getStandardDirections(this.sourceLocation(), this.destinationLocation());
          const responseText = response.text;
          const parsedDirections = this.parseDirections(responseText);
          this.directions.set({ ...parsedDirections, isHuman: false });
      }

      if (this.mapProvider() !== 'none') {
        this.displayRouteOnMap();
      }
    } catch (e) {
      console.error('Error getting directions:', e);
      this.error.set('Could not fetch directions. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  getCurrentLocation(target: 'source' | 'destination') {
    if (!navigator.geolocation) {
      this.error.set('Geolocation is not supported by your browser.');
      return;
    }

    this.isGettingLocation.set(true);
    this.error.set(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.geocodeLatLng(lat, lng, target);
      },
      (geoError) => {
        let errorMessage = 'Could not get your location.';
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            errorMessage = 'You denied the request for Geolocation.';
            break;
          case geoError.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case geoError.TIMEOUT:
            errorMessage = 'The request to get user location timed out.';
            break;
        }
        this.error.set(errorMessage);
        this.isGettingLocation.set(false);
      }
    );
  }

  private geocodeLatLng(lat: number, lng: number, target: 'source' | 'destination') {
    // Geocoding still relies on Google Places API, which is loaded regardless of map rendering
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        this.error.set('Google Geocoding service is not available.');
        this.isGettingLocation.set(false);
        return;
    }
    const geocoder = new google.maps.Geocoder();
    const latlng = { lat, lng };

    geocoder.geocode({ location: latlng }, (results: any[], status: any) => {
        if (status === 'OK') {
            if (results && results[0]) {
                const address = results[0].formatted_address;
                if (target === 'source') {
                    this.sourceLocation.set(address);
                } else {
                    this.destinationLocation.set(address);
                }
            } else {
                this.error.set('No results found for your location.');
            }
        } else {
            this.error.set('Geocoder failed due to: ' + status);
        }
        this.isGettingLocation.set(false);
    });
  }

  private initGoogleMap() {
    if (this.map || !this.mapContainer) return;
    try {
        this.map = new google.maps.Map(this.mapContainer.nativeElement, {
        zoom: 7,
        center: { lat: 24.4, lng: 86.0 },
        mapTypeId: 'terrain',
        disableDefaultUI: true,
        });
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({
             polylineOptions: {
                strokeColor: '#8b5cf6',
                strokeWeight: 6,
                strokeOpacity: 0.8
            }
        });
        this.directionsRenderer.setMap(this.map);
    } catch (e) {
        console.error("Error initializing Google map: ", e);
        this.mapProvider.set('none');
    }
  }

  private initMapplsMap() {
    if (this.mapplsMap || !this.mapContainer) return;
    try {
        this.mapplsMap = new mappls.Map(this.mapContainer.nativeElement, {
            center: [24.4, 86.0],
            zoom: 7
        });
    } catch (e) {
        console.error("Error initializing Mappls map: ", e);
        this.mapProvider.set('none');
    }
  }

  private displayRouteOnMap() {
    const provider = this.mapProvider();

    if (provider === 'google') {
      this.initGoogleMap();
      this.directionsService.route(
        {
          origin: this.sourceLocation(),
          destination: this.destinationLocation(),
          travelMode: google.maps.TravelMode[this.travelMode()],
        },
        (response: any, status: any) => {
          if (status === 'OK') {
            this.directionsRenderer.setDirections(response);
          } else {
            this.error.set('Directions request failed due to ' + status);
          }
        }
      );
    } else if (provider === 'mappls') {
      this.initMapplsMap();
      // Use Google's geocoder to find the destination coordinates to center the map
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: this.destinationLocation() }, (results: any[], status: any) => {
          if (status === 'OK' && results?.[0]) {
              const location = results[0].geometry.location;
              const lat = location.lat();
              const lng = location.lng();
              this.mapplsMap.setCenter([lat, lng], 14);
              new mappls.Marker({
                  map: this.mapplsMap,
                  position: { lat, lng },
              });
          } else {
              console.warn('Could not geocode destination for Mappls map; using default center.');
          }
      });
    }
  }

  private parseDirections(text: string): { summary: string, steps: string[] } {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const summary = lines[0] || 'Directions Ready';
    const steps = lines.slice(1).filter(line => /^\d+\./.test(line.trim()));
    return { summary, steps };
  }
}
export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface LeafletMapEvent {
  latlng: LatLngLiteral;
}

export interface LeafletDragEvent {
  target: { getLatLng(): LatLngLiteral };
}

export interface LeafletTileOptions {
  attribution?: string;
  maxZoom?: number;
  maxNativeZoom?: number;
}

export interface LeafletLayer {
  addTo<T extends LeafletLayer>(this: T, map: LeafletMap): T;
}

export interface LeafletMap {
  setView(center: LatLngLiteral, zoom: number): LeafletMap;
  getZoom(): number;
  removeLayer(layer: LeafletLayer): LeafletMap;
  on(event: "click", handler: (e: LeafletMapEvent) => void): LeafletMap;
}

export interface LeafletMarker extends LeafletLayer {
  setLatLng(center: LatLngLiteral): LeafletMarker;
  bindPopup(text: string): LeafletMarker;
  openPopup(): LeafletMarker;
  on(event: "dragend", handler: (e: LeafletDragEvent) => void): LeafletMarker;
}

export interface LeafletMarkerOptions {
  draggable?: boolean;
}

export interface LeafletStatic {
  map(element: HTMLElement): LeafletMap;
  tileLayer(url: string, options?: LeafletTileOptions): LeafletLayer;
  marker(latlng: LatLngLiteral, options?: LeafletMarkerOptions): LeafletMarker;
}

declare global {
  interface Window {
    L: LeafletStatic;
  }
}
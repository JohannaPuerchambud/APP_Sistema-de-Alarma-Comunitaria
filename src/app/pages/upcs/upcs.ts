import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { UpcService } from '../../core/services/upc';
import { environment } from '../../../environments/environment';
import * as L from 'leaflet';

declare var bootstrap: any;

const iconDefault = L.icon({
  iconRetinaUrl: 'assets/marker-icon-2x.png',
  iconUrl: 'assets/marker-icon.png',
  shadowUrl: 'assets/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  tooltipAnchor: [16, -28], shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = iconDefault;

@Component({
  selector: 'app-upcs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upcs.html',
  styleUrl: './upcs.css',
})
export class UpcsComponent implements OnInit {
  upcs: any[] = [];
  selected: any = {};
  modalMode: 'add' | 'edit' = 'add';
  loading = false;

  // ── Wizard step ────────────────────────────────────────────────────────────
  public upcStep: 1 | 2 | 3 | 4 = 1;
  private modalInstance: any = null;

  // ── Mapa de cobertura (polígono) ────────────────────────────────────────────
  private coverageMap: L.Map | null = null;
  private coverageLayer: L.Polygon | null = null;
  public  drawingPoints: L.LatLng[] = [];
  private vertexMarkers: L.Marker[] = [];

  // ── Mapa de ubicación exacta (punto) ────────────────────────────────────────
  private locationMap: L.Map | null = null;
  private locationMarker: L.Marker | null = null;

  // ── Geocodificador ──────────────────────────────────────────────────────────
  addressQuery = '';
  geoLoading = false;
  geoResults: any[] = [];

  constructor(private upcService: UpcService, private http: HttpClient) {}

  ngOnInit(): void { this.load(); }

  load() {
    this.loading = true;
    this.upcService.getAll().subscribe({
      next: (res) => { this.upcs = res; this.loading = false; },
      error: (err) => { console.error(err); this.loading = false; },
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // WIZARD OPEN / CLOSE / NAVIGATE
  // ════════════════════════════════════════════════════════════════════════════

  openModal(mode: 'add' | 'edit', item?: any) {
    this.modalMode = mode;
    this.upcStep = 1;
    this.geoResults = [];

    if (mode === 'edit') {
      this.selected = { ...item };
      this.addressQuery = item?.address || '';
      // Restore drawing points from stored polygon
      this.drawingPoints = [];
      if (this.selected.coverage_polygon) {
        try {
          const coords = JSON.parse(this.selected.coverage_polygon);
          this.drawingPoints = coords.map((c: any) => L.latLng(c[0], c[1]));
        } catch {}
      }
    } else {
      this.selected = { name: '', description: '', address: '', phone: '', coverage_polygon: '', lat: null, lng: null };
      this.addressQuery = '';
      this.drawingPoints = [];
    }

    const el = document.getElementById('modalUpc')!;
    this.modalInstance = new bootstrap.Modal(el);
    this.modalInstance.show();
  }

  closeModal() {
    this.modalInstance?.hide();
    this.destroyCoveragemap();
    this.destroyLocationMap();
  }

  upcNext() {
    if (this.upcStep === 1) {
      if (!this.selected.name?.trim()) { alert('El nombre de la UPC es obligatorio.'); return; }
      this.upcStep = 2;
      setTimeout(() => this.initLocationMap(), 150);
      return;
    }
    if (this.upcStep === 2) {
      this.destroyLocationMap();
      this.upcStep = 3;
      setTimeout(() => this.initCoverageMap(), 150);
      return;
    }
    if (this.upcStep === 3) {
      if (this.drawingPoints.length > 0 && this.drawingPoints.length < 3) {
        alert('Debes dibujar al menos 3 puntos para el área de cobertura, o borra el dibujo para omitirlo.');
        return;
      }
      this.destroyCoveragemap();
      this.upcStep = 4;
      return;
    }
  }

  upcBack() {
    if (this.upcStep === 4) {
      this.upcStep = 3;
      setTimeout(() => this.initCoverageMap(), 150);
      return;
    }
    if (this.upcStep === 3) {
      this.destroyCoveragemap();
      this.upcStep = 2;
      setTimeout(() => this.initLocationMap(), 150);
      return;
    }
    if (this.upcStep === 2) {
      this.destroyLocationMap();
      this.upcStep = 1;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PASO 2 — Mapa de ubicación exacta (punto único)
  // ════════════════════════════════════════════════════════════════════════════

  private initLocationMap() {
    this.destroyLocationMap();
    const center: L.LatLngExpression =
      (this.selected.lat != null && this.selected.lng != null)
        ? [this.selected.lat, this.selected.lng]
        : [0.3517, -78.1223];

    this.locationMap = L.map('upc-location-map').setView(center, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.locationMap);

    if (this.selected.lat != null && this.selected.lng != null) {
      this.locationMarker = L.marker(center).addTo(this.locationMap);
    }

    this.locationMap.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      this.selected.lat = lat;
      this.selected.lng = lng;
      if (!this.locationMarker) {
        this.locationMarker = L.marker([lat, lng]).addTo(this.locationMap!);
      } else {
        this.locationMarker.setLatLng([lat, lng]);
      }
    });
  }

  private destroyLocationMap() {
    if (this.locationMap) { this.locationMap.remove(); this.locationMap = null; this.locationMarker = null; }
    this.geoResults = [];
  }

  // ── Geocodificador ──────────────────────────────────────────────────────────

  searchAddress() {
    const q = (this.addressQuery || '').trim();
    if (!q) return;
    this.geoLoading = true; this.geoResults = [];

    this.http.get<any[]>(`${environment.apiBaseUrl}/geocode?q=${encodeURIComponent(q)}`).subscribe({
      next: (data) => {
        this.geoResults = Array.isArray(data) ? data : [];
        if (this.geoResults.length === 1) this.applyGeocode(this.geoResults[0]);
        if (this.geoResults.length === 0) alert('No se encontraron resultados. Prueba con más detalle.');
        this.geoLoading = false;
      },
      error: () => { alert('No se pudo buscar la dirección.'); this.geoLoading = false; },
    });
  }

  pickGeocodeResult(event: any) {
    const idx = +event.target.value;
    if (!Number.isNaN(idx) && this.geoResults[idx]) this.applyGeocode(this.geoResults[idx]);
  }

  private applyGeocode(r: any) {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    this.selected.lat = lat; this.selected.lng = lng;
    if (this.locationMap) {
      this.locationMap.setView([lat, lng], 17);
      if (!this.locationMarker) this.locationMarker = L.marker([lat, lng]).addTo(this.locationMap);
      else this.locationMarker.setLatLng([lat, lng]);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PASO 3 — Mapa de área de cobertura (polígono)
  // ════════════════════════════════════════════════════════════════════════════

  private initCoverageMap() {
    this.destroyCoveragemap();

    // Decide center: use location pin if available, else default
    const center: L.LatLngExpression =
      (this.selected.lat != null && this.selected.lng != null)
        ? [this.selected.lat, this.selected.lng]
        : [0.35, -78.12];

    this.coverageMap = L.map('upc-map').setView(center, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.coverageMap);

    // Show location pin as reference (non-draggable)
    if (this.selected.lat != null && this.selected.lng != null) {
      L.marker([this.selected.lat, this.selected.lng])
        .bindTooltip('Ubicación UPC', { permanent: false })
        .addTo(this.coverageMap);
    }

    // Restore previously drawn polygon
    if (this.drawingPoints.length > 0) {
      this.redrawCoveragePolygon();
      if (this.coverageLayer) this.coverageMap.fitBounds(this.coverageLayer.getBounds());
    }

    this.coverageMap.on('click', (e: L.LeafletMouseEvent) => {
      this.drawingPoints.push(e.latlng);
      this.redrawCoveragePolygon();
    });
  }

  private redrawCoveragePolygon() {
    if (this.coverageLayer) { this.coverageMap!.removeLayer(this.coverageLayer); this.coverageLayer = null; }
    this.vertexMarkers.forEach(m => this.coverageMap!.removeLayer(m));
    this.vertexMarkers = [];

    if (this.drawingPoints.length > 0) {
      this.coverageLayer = L.polygon(this.drawingPoints, { color: '#dc3545', weight: 3 }).addTo(this.coverageMap!);

      this.drawingPoints.forEach((latlng, index) => {
        const marker = L.marker(latlng, { draggable: true }).addTo(this.coverageMap!);
        marker.on('drag', (e: any) => { this.drawingPoints[index] = e.latlng; this.redrawCoveragePolygon(); });
        marker.on('dblclick', () => { this.drawingPoints.splice(index, 1); this.redrawCoveragePolygon(); });
        this.vertexMarkers.push(marker);
      });
    }
  }

  clearCoverageMap() {
    this.drawingPoints = [];
    this.redrawCoveragePolygon();
  }

  private destroyCoveragemap() {
    if (this.coverageMap) { this.coverageMap.remove(); this.coverageMap = null; this.coverageLayer = null; }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GUARDAR
  // ════════════════════════════════════════════════════════════════════════════

  save() {
    this.selected.coverage_polygon = this.drawingPoints.length >= 3
      ? JSON.stringify(this.drawingPoints.map(p => [p.lat, p.lng]))
      : null;

    const call = this.modalMode === 'add'
      ? this.upcService.create(this.selected)
      : this.upcService.update(this.selected.upc_id, this.selected);

    call.subscribe({
      next: () => { this.load(); this.closeModal(); },
      error: (err) => alert(err.error?.error || err.error?.message || 'Error al guardar'),
    });
  }

  remove(id: number) {
    if (confirm('¿Eliminar esta UPC de forma permanente?')) {
      this.upcService.delete(id).subscribe({
        next: () => this.load(),
        error: (err) => alert(err.error?.error || 'Error al eliminar'),
      });
    }
  }
}

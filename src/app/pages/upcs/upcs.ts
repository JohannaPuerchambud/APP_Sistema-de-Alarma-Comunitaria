import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UpcService } from '../../core/services/upc';
import * as L from 'leaflet';

declare var bootstrap: any;

const iconDefault = L.icon({
  iconRetinaUrl: 'assets/marker-icon-2x.png',
  iconUrl: 'assets/marker-icon.png',
  shadowUrl: 'assets/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
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

  private map: L.Map | null = null;
  private coverageLayer: L.Polygon | null = null;
  private drawingPoints: L.LatLng[] = [];
  private vertexMarkers: L.Marker[] = [];

  constructor(private upcService: UpcService) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading = true;
    this.upcService.getAll().subscribe({
      next: (res) => {
        this.upcs = res;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      },
    });
  }

  openModal(mode: 'add' | 'edit', item?: any) {
    this.modalMode = mode;
    this.selected =
      mode === 'edit'
        ? { ...item }
        : { name: '', description: '', address: '', phone: '', coverage_polygon: '' };

    const modalEl = document.getElementById('modalUpc')!;
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    // 🛑 IMPORTANTE: Leaflet falla si se carga en un modal oculto.
    // Esperamos a que el modal se muestre completamente para inicializar el mapa.
    modalEl.addEventListener(
      'shown.bs.modal',
      () => {
        this.initMap();
      },
      { once: true },
    );
  }

  closeModal() {
    const modalEl = document.getElementById('modalUpc')!;
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  initMap() {
    if (this.map) this.map.remove();

    // Centrado directamente en Ibarra
    this.map = L.map('upc-map').setView([0.35, -78.12], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);

    this.drawingPoints = [];
    this.vertexMarkers = [];
    this.coverageLayer = null;

    if (this.selected.coverage_polygon) {
      try {
        const coords = JSON.parse(this.selected.coverage_polygon);
        this.drawingPoints = coords.map((c: any) => L.latLng(c[0], c[1]));
        this.drawPolygon();
        this.map.fitBounds(this.coverageLayer!.getBounds());
      } catch (e) {
        console.error(e);
      }
    }

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.drawingPoints.push(e.latlng);
      this.drawPolygon();
    });
  }

  drawPolygon() {
    if (this.coverageLayer) this.map!.removeLayer(this.coverageLayer);
    this.vertexMarkers.forEach((m) => this.map!.removeLayer(m));
    this.vertexMarkers = [];

    if (this.drawingPoints.length > 0) {
      this.coverageLayer = L.polygon(this.drawingPoints, { color: '#dc3545', weight: 3 }).addTo(
        this.map!,
      );

      this.drawingPoints.forEach((latlng, index) => {
        const marker = L.marker(latlng, { draggable: true }).addTo(this.map!);
        marker.on('drag', (e: any) => {
          this.drawingPoints[index] = e.latlng;
          this.drawPolygon();
        });
        marker.on('dblclick', () => {
          this.drawingPoints.splice(index, 1);
          this.drawPolygon();
        });
        this.vertexMarkers.push(marker);
      });
    }
  }

  clearMap() {
    this.drawingPoints = [];
    this.drawPolygon();
  }

  save() {
    if (this.drawingPoints.length > 0 && this.drawingPoints.length < 3) {
      alert('Debes dibujar al menos 3 puntos para cerrar el área de cobertura.');
      return;
    }

    if (this.drawingPoints.length >= 3) {
      this.selected.coverage_polygon = JSON.stringify(
        this.drawingPoints.map((p) => [p.lat, p.lng]),
      );
    } else {
      this.selected.coverage_polygon = null;
    }

    const serviceCall =
      this.modalMode === 'add'
        ? this.upcService.create(this.selected)
        : this.upcService.update(this.selected.upc_id, this.selected);

    serviceCall.subscribe({
      next: () => {
        this.load();
        this.closeModal();
      },
      error: (err) => console.error(err),
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

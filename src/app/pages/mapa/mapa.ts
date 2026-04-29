import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { NeighborhoodService } from '../../core/services/neighborhood';

// Arreglo para el bug de íconos de Leaflet
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
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa.html',
  styleUrl: './mapa.css',
})
export class Mapa implements OnInit, OnDestroy {
  map!: L.Map;
  neighborhoods: any[] = [];
  selectedNeighborhood: any = null;

  // Capa para el polígono que se está dibujando
  private drawingLayer: L.Polygon | null = null;
  private drawingPoints: L.LatLng[] = [];

  // Marcadores de vértice (para arrastrar / borrar)
  private vertexMarkers: L.Marker[] = [];

  private mapClickListener: any;

  // Estado de dibujo: true = aceptamos clics, false = polígono cerrado
  private isDrawing = true;

  constructor(private service: NeighborhoodService) {}

  ngOnInit(): void {
    this.initMap();
    this.loadNeighborhoods();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.off('click', this.mapClickListener);
      this.map.remove();
    }
  }

  initMap() {
    this.map = L.map('map').setView([0.3517, -78.1223], 13); // Centrado en Ibarra

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    // Listener de clics para añadir puntos
    this.mapClickListener = (e: L.LeafletMouseEvent) => {
      if (!this.selectedNeighborhood) {
        alert('Por favor, selecciona un barrio del menú antes de dibujar.');
        return;
      }

      if (!this.isDrawing) {
        // Si el polígono está cerrado, no aceptamos más puntos
        return;
      }

      this.addPoint(e.latlng);
    };

    this.map.on('click', this.mapClickListener);
  }

  /** Carga solo la lista de barrios para el dropdown */
  loadNeighborhoods() {
    this.service.getAll().subscribe({
      next: (res) => {
        this.neighborhoods = res;
      },
      error: (err) => console.error(err),
    });
  }

  /** Se activa al cambiar el <select> */
  selectNeighborhood(event: any) {
    const id = +event.target.value;
    this.selectedNeighborhood = this.neighborhoods.find((n) => n.neighborhood_id === id) || null;

    // Limpiar dibujo anterior
    this.clearDrawing();

    if (this.selectedNeighborhood && this.selectedNeighborhood.boundary) {
      try {
        const raw = this.selectedNeighborhood.boundary;
        const coords = typeof raw === 'string' ? JSON.parse(raw) : raw;

        if (!Array.isArray(coords)) return;

        // Añadir puntos usando addPoint (crea marcadores y polígono)
        coords.forEach((p: number[]) => {
          if (Array.isArray(p) && p.length === 2) {
            this.addPoint(L.latLng(p[0], p[1]));
          }
        });

        // Dibujar polígono en rojo y sin punteado
        if (this.drawingLayer) {
          this.drawingLayer.setStyle({ color: '#dc3545', dashArray: undefined });
        }

        this.isDrawing = false; // Polígono ya cerrado

        if (this.drawingLayer) {
          this.map.fitBounds(this.drawingLayer.getBounds());
        }
      } catch (e) {
        console.error(
          'Error al cargar polígono para editar:',
          e,
          this.selectedNeighborhood.boundary,
        );
        this.clearDrawing();
      }
    }
  }

  /** Añade un punto al dibujo (clic en mapa o al cargar desde BD) */
  private addPoint(latlng: L.LatLng) {
    this.drawingPoints.push(latlng);

    const marker = L.marker(latlng, {
      draggable: true,
      icon: L.divIcon({
        className: 'vertex-marker',
        iconSize: [12, 12],
      }),
    });

    // Arrastrar vértice → actualiza polígono
    marker.on('drag', (ev: any) => {
      const idx = this.vertexMarkers.indexOf(marker);
      if (idx >= 0) {
        this.drawingPoints[idx] = ev.target.getLatLng();
        this.redrawPolygon();
      }
    });

    // Click derecho → eliminar vértice
    marker.on('contextmenu', () => {
      const idx = this.vertexMarkers.indexOf(marker);
      if (idx >= 0) {
        this.map.removeLayer(marker);
        this.vertexMarkers.splice(idx, 1);
        this.drawingPoints.splice(idx, 1);
        this.redrawPolygon();
      }
    });

    marker.addTo(this.map);
    this.vertexMarkers.push(marker);

    this.redrawPolygon();
  }

  /** Redibuja el polígono con los puntos actuales */
  private redrawPolygon() {
    if (this.drawingLayer) {
      this.map.removeLayer(this.drawingLayer);
      this.drawingLayer = null;
    }

    if (this.drawingPoints.length < 2) return;

    this.drawingLayer = L.polygon(this.drawingPoints, {
      color: '#3388ff',
      weight: 3,
      dashArray: this.isDrawing ? '5, 5' : undefined, // punteado mientras dibujas
    }).addTo(this.map);
  }

  /** Limpia el polígono y los vértices (vuelve a modo dibujo) */
  clearDrawing() {
    if (this.drawingLayer) {
      this.map.removeLayer(this.drawingLayer);
      this.drawingLayer = null;
    }

    this.vertexMarkers.forEach((m) => this.map.removeLayer(m));
    this.vertexMarkers = [];

    this.drawingPoints = [];
    this.isDrawing = true;
  }

  /** Cierra el polígono (deja de aceptar puntos nuevos) */
  finishDrawing() {
    if (this.drawingPoints.length < 3) {
      alert('Necesitas al menos 3 puntos para cerrar el polígono.');
      return;
    }

    if (this.isSelfIntersecting()) {
      alert('El polígono tiene segmentos que se cruzan. Ajusta los puntos antes de cerrar.');
      return;
    }

    this.isDrawing = false;

    if (this.drawingLayer) {
      this.drawingLayer.setStyle({ dashArray: undefined }); // línea sólida
    }
  }

  /** Comprueba si el polígono se cruza a sí mismo (validación básica) */
  private isSelfIntersecting(): boolean {
    const pts = this.drawingPoints;
    if (pts.length < 4) return false;

    const segments: [L.LatLng, L.LatLng][] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length]; // último con primero
      segments.push([a, b]);
    }

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        // saltar segmentos adyacentes y el primero con el último
        if (Math.abs(i - j) <= 1 || (i === 0 && j === segments.length - 1)) {
          continue;
        }

        const [a1, a2] = segments[i];
        const [b1, b2] = segments[j];

        if (this.segmentsIntersect(a1, a2, b1, b2)) {
          return true;
        }
      }
    }
    return false;
  }

  private segmentsIntersect(p1: L.LatLng, p2: L.LatLng, p3: L.LatLng, p4: L.LatLng): boolean {
    const d = (p4.lng - p3.lng) * (p2.lat - p1.lat) - (p4.lat - p3.lat) * (p2.lng - p1.lng);
    if (d === 0) return false; // paralelos

    const ua = ((p4.lat - p3.lat) * (p1.lng - p3.lng) - (p4.lng - p3.lng) * (p1.lat - p3.lat)) / d;
    const ub = ((p2.lat - p1.lat) * (p1.lng - p3.lng) - (p2.lng - p1.lng) * (p1.lat - p3.lat)) / d;

    return ua > 0 && ua < 1 && ub > 0 && ub < 1;
  }

  /** Guarda el polígono que se está dibujando */
  saveBoundary() {
    if (!this.selectedNeighborhood) {
      alert('Selecciona un barrio primero.');
      return;
    }

    if (this.drawingPoints.length < 3) {
      alert('Debes dibujar al menos 3 puntos para guardar el polígono.');
      return;
    }

    if (this.isSelfIntersecting()) {
      alert('El polígono tiene segmentos que se cruzan. Corrige los puntos antes de guardar.');
      return;
    }

    // Usamos los puntos actuales para guardar
    const coordinates = this.drawingPoints.map((p: L.LatLng) => [p.lat, p.lng]);
    const boundaryJson = JSON.stringify(coordinates);

    const dataToSave = {
      ...this.selectedNeighborhood,
      boundary: boundaryJson,
    };

    this.service.update(this.selectedNeighborhood.neighborhood_id, dataToSave).subscribe({
      next: () => {
        alert('¡Límites guardados correctamente! 🗺️');

        // Actualizar en memoria
        this.selectedNeighborhood.boundary = boundaryJson;

        // Polígono ya cerrado
        this.isDrawing = false;
        if (this.drawingLayer) {
          this.drawingLayer.setStyle({ color: '#dc3545', dashArray: undefined });
        }
      },
      error: (err) => {
        console.error(err);
        alert('Error al guardar los límites.');
      },
    });
  }
}

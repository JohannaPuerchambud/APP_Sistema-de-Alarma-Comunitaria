import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { NeighborhoodService } from '../../core/services/neighborhood';

// Arreglo para el bug de íconos de Leaflet
const iconDefault = L.icon({
  iconRetinaUrl: 'assets/marker-icon-2x.png',
  iconUrl: 'assets/marker-icon.png',
  shadowUrl: 'assets/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  tooltipAnchor: [16, -28], shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;


@Component({
  selector: 'app-map-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-viewer.html',
  styleUrl: './map-viewer.css'
})
export class MapViewerComponent implements OnInit, OnDestroy {
  map!: L.Map;
  neighborhoods: any[] = [];
  
  // Capa para todos los polígonos verdes
  private allLayers = L.layerGroup();
  // Referencia para hacer zoom
  private layerMap: { [key: number]: L.Polygon } = {};

  constructor(private service: NeighborhoodService) { }

  ngOnInit(): void {
    this.initMap();
    this.loadAndDrawNeighborhoods();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  initMap() {
    this.map = L.map('map-viewer-id').setView([0.3517, -78.1223], 13); // Ibarra
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
  }

  loadAndDrawNeighborhoods() {
    this.service.getAll().subscribe({
      next: (neighborhoods) => {
        this.neighborhoods = neighborhoods;
        this.allLayers.clearLayers(); // Limpiar capas existentes
        this.layerMap = {}; // Limpiar referencias

        neighborhoods.forEach(n => {
          // El 'boundary' que viene de la BD (JSONB) ya es un objeto, no un string.
          // El `[null]` de "El Olivo" (image_7fbebe.png) se interpreta como 'null'
          if (n.boundary && Array.isArray(n.boundary)) {
            try {
              
              // ✅ INICIO DE LA CORRECCIÓN
              // Ya no necesitamos JSON.parse(), 'n.boundary' ES el array de coordenadas
              const coords = n.boundary; 
              // ✅ FIN DE LA CORRECCIÓN

              const polygon = L.polygon(coords.map((p: number[]) => L.latLng(p[0], p[1])), {
                color: '#28a745', // Verde
                weight: 2,
                opacity: 0.7,
              });

              polygon.bindPopup(`<b>${n.name}</b>`);
              this.allLayers.addLayer(polygon);
              this.layerMap[n.neighborhood_id] = polygon;
              
            } catch (e) {
              // El error que ves en la consola viene de aquí
              console.error(`Error al cargar polígono: ${n.name}`, e);
            }
          }
        });

        // Añadir todos los polígonos verdes al mapa
        this.map.addLayer(this.allLayers);
      },
      error: (err) => console.error(err)
    });
  }

  onSelectNeighborhood(event: any) {
    const id = +event.target.value;
    if (id && this.layerMap[id]) {
      // Si seleccionan un barrio, hacemos zoom a ese polígono
      const polygon = this.layerMap[id];
      this.map.fitBounds(polygon.getBounds());
      polygon.openPopup();
    } else {
      // Si seleccionan "Todos", centramos el mapa
      this.map.setView([0.3517, -78.1223], 13);
    }
  }
}
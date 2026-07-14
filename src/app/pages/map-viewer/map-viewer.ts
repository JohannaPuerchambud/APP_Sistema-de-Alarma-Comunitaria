import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import * as L from 'leaflet';
import { NeighborhoodService } from '../../core/services/neighborhood';
import { UserService } from '../../core/services/user';
import { ReportService } from '../../core/services/report';

// Corrección de los pines de Leaflet
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
  allUsers: any[] = [];
  allReports: any[] = [];
  
  // Variables para la interfaz
  selectedNeighborhoodInfo: any = null;
  neighborhoodUsers: any[] = [];
  representative: any = null;
  reportCount: number = 0;

  // Capas del mapa
  private allLayers = L.layerGroup();
  private userMarkersLayer = L.layerGroup();
  private layerMap: { [key: number]: L.Polygon } = {};

  private defaultStyle = { color: '#28a745', weight: 2, fillOpacity: 0.2 };
  private highlightStyle = { color: '#dc3545', weight: 4, fillOpacity: 0.4 };
  private selectedPolygon: L.Polygon | null = null;

  private createPopup(title: unknown, subtitle?: string): HTMLElement {
    const container = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = String(title ?? '');
    container.appendChild(heading);

    if (subtitle) {
      const lineBreak = document.createElement('br');
      const detail = document.createElement('span');
      detail.style.fontSize = '10px';
      detail.style.color = 'gray';
      detail.textContent = subtitle;
      container.append(lineBreak, detail);
    }

    return container;
  }

  constructor(
    private neighborhoodService: NeighborhoodService,
    private userService: UserService,
    private reportService: ReportService
  ) {}

  ngOnInit(): void {
    this.initMap();
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

  initMap() {
    this.map = L.map('map-viewer-id').setView([0.3517, -78.1223], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
    this.map.addLayer(this.userMarkersLayer); // Añadimos la capa de casitas
  }

  loadData() {
    forkJoin({
      neighborhoods: this.neighborhoodService.getAll(),
      users: this.userService.getAll(),
      reports: this.reportService.getAll(),
    }).subscribe({
      next: ({ neighborhoods, users, reports }) => {
        this.neighborhoods = neighborhoods;
        this.allUsers = users;
        this.allReports = reports;
        this.drawAllNeighborhoods();
      },
      error: (err) => console.error('Error al cargar los datos del mapa:', err),
    });
  }
  drawAllNeighborhoods() {
    this.allLayers.clearLayers();
    this.layerMap = {};

    this.neighborhoods.forEach(n => {
      if (n.boundary) {
        try {
          // ✅ Corrección: Parsear correctamente el polígono desde la BD
          const coords = typeof n.boundary === 'string' ? JSON.parse(n.boundary) : n.boundary;
          
          if (Array.isArray(coords)) {
            const polygon = L.polygon(
              coords.map((p: any[]) => L.latLng(p[0], p[1])),
              this.defaultStyle
            );

            polygon.bindPopup(this.createPopup(n.name));
            this.allLayers.addLayer(polygon);
            this.layerMap[n.neighborhood_id] = polygon;
          }
        } catch (e) {
          console.error(`Error al cargar polígono: ${n.name}`, e);
        }
      }
    });
    this.map.addLayer(this.allLayers);
  }

  onSelectNeighborhood(event: any) {
    const id = +event.target.value;

    // Resetear el mapa
    this.userMarkersLayer.clearLayers();
    if (this.selectedPolygon) {
      this.selectedPolygon.setStyle(this.defaultStyle);
      this.selectedPolygon = null;
    }

    // Si vuelve a "Ver Todos"
    if (id === 0) {
      this.selectedNeighborhoodInfo = null;
      this.neighborhoodUsers = [];
      this.representative = null;
      this.reportCount = 0;
      this.map.setView([0.3517, -78.1223], 13);
      setTimeout(() => this.map.invalidateSize(), 300);
      return;
    }

    // ✅ 1. Buscar info del barrio
    this.selectedNeighborhoodInfo = this.neighborhoods.find(n => n.neighborhood_id === id);

    // ✅ 2. Filtrar habitantes
    this.neighborhoodUsers = this.allUsers.filter(u => u.neighborhood_id === id);

    // ✅ 3. Encontrar al representante
    this.representative = this.neighborhoodUsers.find(u => u.role_id === 2);

    // ✅ 4. Contar la cantidad de reportes (alarmas) de este barrio
    this.reportCount = this.allReports.filter(r => Number(r.neighborhood_id) === id).length;

    // ✅ 5. Dibujar pines de usuarios en el mapa
    this.neighborhoodUsers.forEach(u => {
      if (u.home_lat && u.home_lng && !isNaN(u.home_lat)) {
        const marker = L.marker([u.home_lat, u.home_lng]);
        marker.bindPopup(
          this.createPopup(
            `${u.name ?? ''} ${u.last_name ?? ''}`.trim(),
            u.role_id === 2 ? 'Representante' : 'Habitante',
          ),
        );
        this.userMarkersLayer.addLayer(marker);
      }
    });

    // ✅ 6. Resaltar el polígono y hacer ZOOM
    if (this.layerMap[id]) {
      const polygon = this.layerMap[id];
      polygon.setStyle(this.highlightStyle);
      polygon.bringToFront();
      this.selectedPolygon = polygon;
      
      this.map.fitBounds(polygon.getBounds());
    }

    // Forzar actualización visual del mapa por el cambio de tamaño
    setTimeout(() => this.map.invalidateSize(), 300);
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { NeighborhoodService } from '../../core/services/neighborhood';
import { UserService } from '../../core/services/user'; // ✅ Importamos usuarios

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
  allUsers: any[] = []; // Todos los usuarios del sistema
  
  // ✅ Datos para mostrar cuando se selecciona un barrio
  selectedNeighborhoodInfo: any = null;
  neighborhoodUsers: any[] = [];
  representative: any = null;

  // Capas del mapa
  private allLayers = L.layerGroup();
  private userMarkersLayer = L.layerGroup(); // Capa para los pines de usuarios
  private layerMap: { [key: number]: L.Polygon } = {};

  private defaultStyle = { color: '#28a745', weight: 2, fillOpacity: 0.2 };
  private highlightStyle = { color: '#dc3545', weight: 4, fillOpacity: 0.4 };
  private selectedPolygon: L.Polygon | null = null;

  constructor(
    private neighborhoodService: NeighborhoodService,
    private userService: UserService // ✅ Inyectamos el servicio
  ) {}

  ngOnInit(): void {
    this.initMap();
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

  initMap() {
    this.map = L.map('map-viewer-id').setView([0.35, -78.12], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
    this.map.addLayer(this.userMarkersLayer); // Añadimos la capa de usuarios al mapa
  }

  loadData() {
    // 1. Cargar Barrios
    this.neighborhoodService.getAll().subscribe({
      next: (res) => {
        this.neighborhoods = res;
        this.drawAllNeighborhoods();
      },
      error: (err) => console.error(err)
    });

    // 2. Cargar Usuarios
    this.userService.getAll().subscribe({
      next: (res) => {
        this.allUsers = res;
      },
      error: (err) => console.error(err)
    });
  }

  drawAllNeighborhoods() {
    this.allLayers.clearLayers();
    this.layerMap = {};

    this.neighborhoods.forEach(n => {
      if (n.boundary && typeof n.boundary === 'string') {
        try {
          const coords = JSON.parse(n.boundary);
          const polygon = L.polygon(
            coords.map((p: number[]) => L.latLng(p[0], p[1])),
            this.defaultStyle
          );

          polygon.bindPopup(`<b>${n.name}</b>`);
          this.allLayers.addLayer(polygon);
          this.layerMap[n.neighborhood_id] = polygon;
        } catch (e) {
          console.error(`Error al cargar polígono: ${n.name}`, e);
        }
      }
    });
    this.map.addLayer(this.allLayers);
  }

  onSelectNeighborhood(event: any) {
    const id = +event.target.value;

    // Resetear el mapa y las vistas
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
      this.map.setView([0.35, -78.12], 13);
      return;
    }

    // ✅ 1. Buscar la info del barrio
    this.selectedNeighborhoodInfo = this.neighborhoods.find(n => n.neighborhood_id === id);

    // ✅ 2. Filtrar los usuarios que pertenecen a este barrio
    this.neighborhoodUsers = this.allUsers.filter(u => u.neighborhood_id === id);

    // ✅ 3. Encontrar al representante (Usuario con Rol 2 de este barrio)
    this.representative = this.neighborhoodUsers.find(u => u.role_id === 2);

    // ✅ 4. Dibujar los pines de los usuarios en el mapa
    this.neighborhoodUsers.forEach(u => {
      if (u.home_lat && u.home_lng) {
        const marker = L.marker([u.home_lat, u.home_lng]);
        marker.bindPopup(`
          <strong>${u.name} ${u.last_name || ''}</strong><br>
          📞 ${u.phone || 'Sin teléfono'}<br>
          🏠 ${u.address || 'Sin dirección'}<br>
          <span style="font-size:10px; color:gray;">${u.role_id === 2 ? 'Representante' : 'Usuario'}</span>
        `);
        this.userMarkersLayer.addLayer(marker);
      }
    });

    // 5. Resaltar el polígono del barrio y hacer zoom
    if (this.layerMap[id]) {
      const polygon = this.layerMap[id];
      polygon.setStyle(this.highlightStyle);
      polygon.bringToFront();
      this.selectedPolygon = polygon;
      this.map.fitBounds(polygon.getBounds());
    }
  }
}
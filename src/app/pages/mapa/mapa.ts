import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { NeighborhoodService } from '../../core/services/neighborhood';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa.html',
  styleUrl: './mapa.css'
})
export class Mapa implements OnInit {
  map!: L.Map;
  drawnPolygon: L.Polygon | null = null;
  neighborhoods: any[] = [];
  selectedNeighborhood: any = null;

  constructor(private service: NeighborhoodService) { }

  ngOnInit(): void {
    this.initMap();
    this.loadNeighborhoods();
  }

  initMap() {
    // Coordenadas iniciales de Ibarra
    this.map = L.map('map').setView([0.3517, -78.1223], 13);

    // Capa base de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    // Evento click para agregar vértices del polígono
    let points: L.LatLng[] = [];
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      points.push(e.latlng);

      // Si ya hay polígono dibujado, lo removemos
      if (this.drawnPolygon) {
        this.map.removeLayer(this.drawnPolygon);
      }

      // Dibujar el polígono con los puntos actuales
      this.drawnPolygon = L.polygon(points, { color: 'blue' }).addTo(this.map);
    });
  }

  loadNeighborhoods() {
    this.service.getAll().subscribe({
      next: (res) => this.neighborhoods = res,
      error: (err) => console.error(err)
    });
  }

  selectNeighborhood(event: any) {
    const id = +event.target.value;
    this.selectedNeighborhood = this.neighborhoods.find(n => n.neighborhood_id === id);
    this.map.closePopup();

    // Si el barrio ya tiene límites guardados, los mostramos
    if (this.selectedNeighborhood?.boundary) {
      try {
        const coords = JSON.parse(this.selectedNeighborhood.boundary);
        if (this.drawnPolygon) this.map.removeLayer(this.drawnPolygon);
        this.drawnPolygon = L.polygon(coords, { color: 'green' }).addTo(this.map);
        this.map.fitBounds(this.drawnPolygon.getBounds());
      } catch (err) {
        console.error('Error al cargar límites:', err);
      }
    }
  }

  saveBoundary() {
    if (!this.selectedNeighborhood) {
      alert('Selecciona un barrio primero.');
      return;
    }
    if (!this.drawnPolygon) {
      alert('Dibuja un polígono antes de guardar.');
      return;
    }

    //const coordinates = this.drawnPolygon.getLatLngs()[0].map((p: any) => [p.lat, p.lng]);

    const latlngs = this.drawnPolygon.getLatLngs() as L.LatLng[][];
    const coordinates = latlngs[0].map((p: L.LatLng) => [p.lat, p.lng]);


    this.service.update(this.selectedNeighborhood.neighborhood_id, {
      ...this.selectedNeighborhood,
      boundary: JSON.stringify(coordinates)
    }).subscribe({
      next: () => alert('Límites guardados correctamente 🗺️'),
      error: (err) => console.error(err)
    });
  }
}

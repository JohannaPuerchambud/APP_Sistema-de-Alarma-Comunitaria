import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa.html',
  styleUrl: './mapa.css'
})
export class Mapa implements OnInit, OnDestroy {
  map!: L.Map;
  neighborhoods: any[] = [];
  selectedNeighborhood: any = null;

  // Capa para el polígono que se está dibujando (azul o rojo)
  private drawingLayer: L.Polygon | null = null;
  private drawingPoints: L.LatLng[] = [];
  
  private mapClickListener: any;

  constructor(private service: NeighborhoodService) { }

  ngOnInit(): void {
    this.initMap();
    this.loadNeighborhoods();
  }

  ngOnDestroy(): void {
    // Limpiar el mapa y los eventos al salir
    if (this.map) {
      this.map.off('click', this.mapClickListener);
      this.map.remove();
    }
  }

  initMap() {
    this.map = L.map('map').setView([0.3517, -78.1223], 13); // Centrado en Ibarra
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    // Definir el listener de clic
    this.mapClickListener = (e: L.LeafletMouseEvent) => {
      // Si no hay un barrio seleccionado, no hacer nada
      if (!this.selectedNeighborhood) {
        alert('Por favor, selecciona un barrio del menú antes de dibujar.');
        return;
      }

      // Añadir punto para el polígono azul
      this.drawingPoints.push(e.latlng);
      
      // Quitar el polígono anterior (sea azul o rojo)
      if (this.drawingLayer) {
        this.map.removeLayer(this.drawingLayer);
      }
      
      // Dibujar el nuevo polígono azul
      this.drawingLayer = L.polygon(this.drawingPoints, { 
        color: '#3388ff', // Azul para "nuevo dibujo"
        weight: 3
      }).addTo(this.map);
    };

    // Activar el listener de clics
    this.map.on('click', this.mapClickListener);
  }

  /**
   * Carga solo la lista de barrios para el dropdown
   */
  loadNeighborhoods() {
    this.service.getAll().subscribe({
      next: (res) => {
        this.neighborhoods = res;
      },
      error: (err) => console.error(err)
    });
  }

  /**
   * Se activa al cambiar el <select>
   */
  selectNeighborhood(event: any) {
    const id = +event.target.value;
    this.selectedNeighborhood = this.neighborhoods.find(n => n.neighborhood_id === id) || null;
    
    // Limpiar cualquier dibujo anterior
    this.clearDrawing(); 
    
    if (this.selectedNeighborhood && this.selectedNeighborhood.boundary) {
      // Si tiene datos, mostrar el polígono guardado (en rojo)
      try {
        const coords = JSON.parse(this.selectedNeighborhood.boundary);
        
        // ✅ INICIO DE CORRECCIÓN 2 (Error TS2345)
        // Asignar los puntos del polígono guardado al dibujo actual (para editar)
        this.drawingPoints = coords.map((p: number[]) => L.latLng(p[0], p[1]));
        // ✅ FIN DE CORRECCIÓN 2
        
        this.drawingLayer = L.polygon(this.drawingPoints, { 
          color: '#dc3545', // Rojo para "polígono actual/editando"
          weight: 3
        }).addTo(this.map);
        
        this.map.fitBounds(this.drawingLayer.getBounds());
        
      } catch (e) {
        console.error('Error al cargar polígono para editar:', e);
        this.drawingPoints = []; // Resetear por si el JSON estaba corrupto
      }
    }
  }

  /**
   * ✅ INICIO DE CORRECCIÓN 1 (Error TS2554)
   * Limpia el polígono (el dibujo actual) - Sin argumentos
   */
  clearDrawing() {
  // ✅ FIN DE CORRECCIÓN 1
    if (this.drawingLayer) {
      this.map.removeLayer(this.drawingLayer);
      this.drawingLayer = null;
    }
    this.drawingPoints = [];
  }

  /**
   * Guarda el polígono que se está dibujando (azul o rojo)
   */
  saveBoundary() {
    if (!this.selectedNeighborhood) {
      alert('Selecciona un barrio primero.');
      return;
    }
    // Si no hay polígono en la capa de dibujo, no hay nada que guardar
    if (!this.drawingLayer || this.drawingPoints.length === 0) { 
      alert('Dibuja un polígono (haciendo clics en el mapa) antes de guardar.');
      return;
    }

    // Obtener coordenadas del polígono
    const latlngs = this.drawingLayer.getLatLngs() as L.LatLng[][];
    // Asegurarse de que sea un polígono simple
    if (!latlngs[0]) return; 

    const coordinates = latlngs[0].map((p: L.LatLng) => [p.lat, p.lng]);
    const boundaryJson = JSON.stringify(coordinates);

    // Preparamos los datos para la API
    const dataToSave = {
      ...this.selectedNeighborhood,
      boundary: boundaryJson // Sobrescribir el boundary
    };

    // Llamar a la API (que ya corregimos)
    this.service.update(this.selectedNeighborhood.neighborhood_id, dataToSave).subscribe({
      next: () => {
        alert('¡Límites guardados correctamente! 🗺️');
        
        // Actualizamos el polígono guardado en la lista local
        this.selectedNeighborhood.boundary = boundaryJson;
         
        // Limpiamos el dibujo y volvemos a cargar el polígono (ahora en rojo)
        this.clearDrawing();
        
        // ✅ INICIO DE CORRECCIÓN 2 (Error TS2345)
        this.drawingPoints = coordinates.map((p: number[]) => L.latLng(p[0], p[1]));
        // ✅ FIN DE CORRECCIÓN 2
        
        this.drawingLayer = L.polygon(this.drawingPoints, { 
          color: '#dc3545', // Rojo
          weight: 3
        }).addTo(this.map);

      },
      error: (err) => {
        console.error(err);
        alert('Error al guardar los límites.');
      }
    });
  }
}
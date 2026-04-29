import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NeighborhoodService } from '../../core/services/neighborhood';
import { UpcService } from '../../core/services/upc'; 
import * as L from 'leaflet';

declare var bootstrap: any;

// Solución al problema de los íconos de Leaflet en Angular
const iconDefault = L.icon({
  iconRetinaUrl: 'assets/marker-icon-2x.png',
  iconUrl: 'assets/marker-icon.png',
  shadowUrl: 'assets/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  tooltipAnchor: [16, -28], shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

@Component({
  selector: 'app-neighborhoods',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './neighborhoods.html',
  styleUrl: './neighborhoods.css'
})
export class Neighborhoods implements OnInit {
  selected: any = {};
  modalMode: 'add' | 'edit' = 'add';
  loading = false;

  public masterList: any[] = [];
  public filteredItems: any[] = [];
  public paginatedItems: any[] = [];
  
  public upcs: any[] = []; 

  public searchText: string = '';
  public currentPage: number = 1;
  public itemsPerPage: number = 5; 

  private map: L.Map | null = null;
  private drawingLayer: L.Polygon | null = null;
  private drawingPoints: L.LatLng[] = [];
  private vertexMarkers: L.Marker[] = [];
  private isDrawing = true;

  constructor(
    private service: NeighborhoodService,
    private upcService: UpcService 
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadUpcs();
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (res) => {
        this.masterList = res; 
        this.applyFilters(); 
        this.loading = false;
      },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }

  loadUpcs() {
    this.upcService.getAll().subscribe({
      next: (res) => this.upcs = res,
      error: (err) => console.error(err)
    });
  }

  applyFilters() {
    const st = this.searchText.toLowerCase();
    this.filteredItems = this.masterList.filter(item => 
      item.name.toLowerCase().includes(st) ||
      (item.description && item.description.toLowerCase().includes(st))
    );
    this.currentPage = 1;
    this.updatePaginatedItems();
  }

  updatePaginatedItems() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedItems = this.filteredItems.slice(startIndex, endIndex);
  }

  changePage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePaginatedItems();
  }

  get totalPages(): number {
    return Math.ceil(this.filteredItems.length / this.itemsPerPage) || 1;
  }

  get pageNumbers(): number[] {
    return Array(this.totalPages).fill(0).map((x, i) => i + 1);
  }

  openModal(mode: 'add' | 'edit', item?: any) {
    this.modalMode = mode;
    if (mode === 'edit') {
        this.selected = { ...item };
    } else {
        this.selected = { name: '', description: '', alarm_number: '', upc_id: '', boundary: '' };
    }
    
    const modalEl = document.getElementById('modalNeighborhood')!;
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    modalEl.addEventListener('shown.bs.modal', () => {
      this.initMap();
    }, { once: true });
  }

  closeModal() {
    const modalEl = document.getElementById('modalNeighborhood')!;
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();
    
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  initMap() {
    if (this.map) this.map.remove();
    this.map = L.map('neighborhood-map').setView([0.35, -78.12], 14); // Centro en Ibarra
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);

    this.clearMap();

    if (this.selected.boundary) {
      try {
        const raw = this.selected.boundary;
        const coords = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(coords)) {
            coords.forEach((p: any) => {
                if (Array.isArray(p) && p.length === 2) {
                    this.addPoint(L.latLng(p[0], p[1]));
                }
            });
            this.isDrawing = false;
            if (this.drawingLayer) {
                this.drawingLayer.setStyle({ color: '#dc3545', dashArray: undefined });
                this.map.fitBounds(this.drawingLayer.getBounds());
            }
        }
      } catch(e) { console.error(e); }
    }

    // Evento para agregar puntos al hacer clic
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.isDrawing) return;
      this.addPoint(e.latlng);
    });
  }

  private addPoint(latlng: L.LatLng) {
    this.drawingPoints.push(latlng);
    const marker = L.marker(latlng, { draggable: true }).addTo(this.map!);
    
    marker.on('drag', (ev: any) => {
      const idx = this.vertexMarkers.indexOf(marker);
      if (idx >= 0) {
        this.drawingPoints[idx] = ev.target.getLatLng();
        this.redrawPolygon();
      }
    });

    marker.on('dblclick', () => {
      const idx = this.vertexMarkers.indexOf(marker);
      if (idx >= 0) {
        this.map!.removeLayer(marker);
        this.vertexMarkers.splice(idx, 1);
        this.drawingPoints.splice(idx, 1);
        this.redrawPolygon();
      }
    });

    this.vertexMarkers.push(marker);
    this.redrawPolygon();
  }

  private redrawPolygon() {
    if (this.drawingLayer) {
      this.map!.removeLayer(this.drawingLayer);
      this.drawingLayer = null;
    }
    if (this.drawingPoints.length < 2) return;
    this.drawingLayer = L.polygon(this.drawingPoints, {
      color: '#3388ff', weight: 3, dashArray: this.isDrawing ? '5, 5' : undefined
    }).addTo(this.map!);
  }

  clearMap() {
    if (this.drawingLayer) {
      this.map?.removeLayer(this.drawingLayer);
      this.drawingLayer = null;
    }
    this.vertexMarkers.forEach(m => this.map?.removeLayer(m));
    this.vertexMarkers = [];
    this.drawingPoints = [];
    this.isDrawing = true;
  }

  finishDrawing() {
    if (this.drawingPoints.length < 3) {
      alert('Necesitas al menos 3 puntos para cerrar el polígono.');
      return;
    }
    this.isDrawing = false;
    if (this.drawingLayer) {
      this.drawingLayer.setStyle({ dashArray: undefined, color: '#dc3545' });
    }
  }

  save() {
    // Verificamos si se dibujó un mapa
    if (this.drawingPoints.length > 0) {
       if (this.drawingPoints.length < 3) {
          alert("Debes dibujar al menos 3 puntos para la delimitación del barrio.");
          return;
       }
       // Guardamos las coordenadas en formato JSON
       this.selected.boundary = JSON.stringify(this.drawingPoints.map(p => [p.lat, p.lng]));
    } else {
       this.selected.boundary = null;
    }

    const serviceCall = this.modalMode === 'add'
      ? this.service.create(this.selected)
      : this.service.update(this.selected.neighborhood_id, this.selected);

    serviceCall.subscribe({
      next: () => { 
        this.load();
        this.closeModal(); 
      },
      error: (err) => alert(err.error?.message || err.error?.error || "Error al guardar el barrio")
    });
  }

  remove(id: number) {
    if (confirm('¿Eliminar este barrio de forma permanente?')) {
      this.service.delete(id).subscribe({
        next: () => this.load(),
        error: (err) => alert(err.error?.error || 'Error al eliminar')
      });
    }
  }
}
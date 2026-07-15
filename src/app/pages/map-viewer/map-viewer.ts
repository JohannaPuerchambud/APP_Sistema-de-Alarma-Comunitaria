import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import * as L from 'leaflet';
import { NeighborhoodService } from '../../core/services/neighborhood';
import { ReportService } from '../../core/services/report';
import { UserService } from '../../core/services/user';

declare const bootstrap: any;

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
  selector: 'app-map-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-viewer.html',
  styleUrl: './map-viewer.css',
})
export class MapViewerComponent implements OnInit, OnChanges, OnDestroy {
  @Input() embedded = false;
  @Input() neighborhoodId: number | null = null;
  @Input() canManage = false;
  @Input() refreshKey = 0;

  map?: L.Map;
  neighborhoods: any[] = [];
  allUsers: any[] = [];
  allReports: any[] = [];
  loading = true;
  errorMessage = '';

  selectedNeighborhoodId = 0;
  selectedNeighborhoodInfo: any = null;
  neighborhoodUsers: any[] = [];
  neighborhoodReports: any[] = [];
  representative: any = null;
  activeTab: 'summary' | 'residents' | 'reports' = 'summary';

  residentSearch = '';
  residentsPage = 1;
  residentsPerPage = 10;

  assignmentSearch = '';
  selectedAssignmentIds = new Set<number>();
  savingAssignments = false;
  feedbackMessage = '';

  private allLayers = L.layerGroup();
  private userMarkersLayer = L.layerGroup();
  private layerMap: Record<number, L.Polygon> = {};
  private markerMap = new Map<number, L.Marker>();
  private selectedPolygon: L.Polygon | null = null;
  private assignmentModal: any = null;

  private readonly defaultStyle = { color: '#28a745', weight: 2, fillOpacity: 0.16 };
  private readonly highlightStyle = { color: '#667eea', weight: 4, fillOpacity: 0.28 };

  constructor(
    private neighborhoodService: NeighborhoodService,
    private userService: UserService,
    private reportService: ReportService,
  ) {}

  ngOnInit(): void {
    this.initMap();
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    if (changes['refreshKey'] && !changes['refreshKey'].firstChange) {
      this.loadData();
      return;
    }
    if (changes['neighborhoodId']) {
      this.selectNeighborhood(Number(this.neighborhoodId || 0));
    }
  }

  ngOnDestroy(): void {
    this.assignmentModal?.hide();
    this.map?.remove();
  }

  private initMap(): void {
    this.map = L.map('map-viewer-id').setView([0.3517, -78.1223], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    this.allLayers.addTo(this.map);
    this.userMarkersLayer.addTo(this.map);
  }

  loadData(): void {
    this.loading = true;
    this.errorMessage = '';
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
        const targetId = Number(this.neighborhoodId || this.selectedNeighborhoodId || 0);
        this.selectNeighborhood(targetId);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar el panel del barrio.';
        this.loading = false;
      },
    });
  }

  onSelectNeighborhood(event: Event): void {
    this.selectNeighborhood(Number((event.target as HTMLSelectElement).value));
  }

  selectNeighborhood(id: number): void {
    if (!this.map) return;
    this.selectedNeighborhoodId = id;
    this.userMarkersLayer.clearLayers();
    this.markerMap.clear();
    this.feedbackMessage = '';

    if (this.selectedPolygon) {
      this.selectedPolygon.setStyle(this.defaultStyle);
      this.selectedPolygon = null;
    }

    if (!id) {
      this.selectedNeighborhoodInfo = null;
      this.neighborhoodUsers = [];
      this.neighborhoodReports = [];
      this.representative = null;
      this.map.setView([0.3517, -78.1223], 13);
      setTimeout(() => this.map?.invalidateSize(), 100);
      return;
    }

    this.selectedNeighborhoodInfo = this.neighborhoods.find(
      (item) => Number(item.neighborhood_id) === id,
    );
    if (!this.selectedNeighborhoodInfo) {
      this.loadData();
      return;
    }

    this.neighborhoodUsers = this.allUsers.filter(
      (user) => Number(user.neighborhood_id) === id,
    );
    this.neighborhoodReports = this.allReports.filter(
      (report) => Number(report.neighborhood_id) === id,
    );
    this.representative = this.neighborhoodUsers.find(
      (user) => Number(user.role_id) === 2,
    );
    this.residentSearch = '';
    this.residentsPage = 1;

    for (const user of this.neighborhoodUsers) {
      const lat = Number(user.home_lat);
      const lng = Number(user.home_lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const marker = L.marker([lat, lng]).bindPopup(
        this.createPopup(
          `${user.name || ''} ${user.last_name || ''}`.trim(),
          Number(user.role_id) === 2 ? 'Representante' : 'Habitante',
        ),
      );
      marker.addTo(this.userMarkersLayer);
      this.markerMap.set(Number(user.user_id), marker);
    }

    const polygon = this.layerMap[id];
    if (polygon) {
      polygon.setStyle(this.highlightStyle);
      polygon.bringToFront();
      this.selectedPolygon = polygon;
      this.map.fitBounds(polygon.getBounds(), { padding: [24, 24] });
    } else if (this.markerMap.size > 0) {
      const group = L.featureGroup([...this.markerMap.values()]);
      this.map.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 17 });
    }
    setTimeout(() => this.map?.invalidateSize(), 150);
  }

  setTab(tab: 'summary' | 'residents' | 'reports'): void {
    this.activeTab = tab;
    if (tab === 'summary') setTimeout(() => this.map?.invalidateSize(), 100);
  }

  get filteredResidents(): any[] {
    const query = this.residentSearch.trim().toLowerCase();
    if (!query) return this.neighborhoodUsers;
    return this.neighborhoodUsers.filter((user) =>
      [user.name, user.last_name, user.email, user.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }

  get paginatedResidents(): any[] {
    const start = (this.residentsPage - 1) * this.residentsPerPage;
    return this.filteredResidents.slice(start, start + this.residentsPerPage);
  }

  get residentsTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredResidents.length / this.residentsPerPage));
  }

  get residentPageNumbers(): number[] {
    return Array.from({ length: this.residentsTotalPages }, (_, index) => index + 1);
  }

  changeResidentsPage(page: number): void {
    if (page < 1 || page > this.residentsTotalPages) return;
    this.residentsPage = page;
  }

  onResidentSearch(): void {
    this.residentsPage = 1;
  }

  get recentReports(): any[] {
    return this.neighborhoodReports.slice(0, 5);
  }

  focusResident(user: any): void {
    this.setTab('summary');
    setTimeout(() => {
      const marker = this.markerMap.get(Number(user.user_id));
      if (!marker || !this.map) return;
      this.map.setView(marker.getLatLng(), 18);
      marker.openPopup();
    }, 100);
  }

  get assignableUsers(): any[] {
    const query = this.assignmentSearch.trim().toLowerCase();
    return this.allUsers.filter((user) => {
      const isUnassignedResident = Number(user.role_id) === 3 && !user.neighborhood_id;
      const matches = !query || [user.name, user.last_name, user.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return isUnassignedResident && matches;
    });
  }

  openAssignmentModal(): void {
    this.assignmentSearch = '';
    this.selectedAssignmentIds.clear();
    const element = document.getElementById('assignResidentsModal');
    if (!element) return;
    this.assignmentModal = bootstrap.Modal.getOrCreateInstance(element);
    this.assignmentModal.show();
  }

  toggleAssignment(userId: number): void {
    if (this.selectedAssignmentIds.has(userId)) this.selectedAssignmentIds.delete(userId);
    else this.selectedAssignmentIds.add(userId);
  }

  saveAssignments(): void {
    if (!this.selectedNeighborhoodId || this.selectedAssignmentIds.size === 0) return;
    this.savingAssignments = true;
    this.neighborhoodService
      .updateUsers(this.selectedNeighborhoodId, [...this.selectedAssignmentIds], 'add')
      .subscribe({
        next: () => {
          this.assignmentModal?.hide();
          this.feedbackMessage = 'Habitantes asignados correctamente.';
          this.savingAssignments = false;
          this.loadData();
        },
        error: (error) => {
          this.feedbackMessage = error.error?.message || 'No se pudieron asignar los habitantes.';
          this.savingAssignments = false;
        },
      });
  }

  removeResident(user: any): void {
    if (Number(user.role_id) === 2) {
      this.feedbackMessage = 'Cambia primero el representante antes de retirarlo.';
      return;
    }
    const fullName = `${user.name || ''} ${user.last_name || ''}`.trim();
    if (!confirm(`¿Retirar a ${fullName} de este barrio?`)) return;
    this.neighborhoodService
      .updateUsers(this.selectedNeighborhoodId, [Number(user.user_id)], 'remove')
      .subscribe({
        next: () => {
          this.feedbackMessage = 'Habitante retirado correctamente.';
          this.loadData();
        },
        error: (error) => {
          this.feedbackMessage = error.error?.message || 'No se pudo retirar al habitante.';
        },
      });
  }

  private drawAllNeighborhoods(): void {
    this.allLayers.clearLayers();
    this.layerMap = {};
    for (const neighborhood of this.neighborhoods) {
      if (!neighborhood.boundary) continue;
      try {
        const coordinates = typeof neighborhood.boundary === 'string'
          ? JSON.parse(neighborhood.boundary)
          : neighborhood.boundary;
        if (!Array.isArray(coordinates)) continue;
        const polygon = L.polygon(
          coordinates.map((point: any[]) => L.latLng(point[0], point[1])),
          this.defaultStyle,
        );
        polygon.bindPopup(this.createPopup(neighborhood.name));
        polygon.addTo(this.allLayers);
        this.layerMap[Number(neighborhood.neighborhood_id)] = polygon;
      } catch {
        // Un perímetro inválido no debe impedir cargar los demás barrios.
      }
    }
  }

  private createPopup(title: unknown, subtitle?: string): HTMLElement {
    const container = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = String(title ?? '');
    container.appendChild(heading);
    if (subtitle) {
      const detail = document.createElement('div');
      detail.className = 'text-muted';
      detail.textContent = subtitle;
      container.appendChild(detail);
    }
    return container;
  }
}
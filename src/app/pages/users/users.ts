import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user';
import { NeighborhoodService } from '../../core/services/neighborhood';
import { AuthService } from '../../core/auth/auth.service';
import * as L from 'leaflet';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

declare var bootstrap: any;

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users implements OnInit {
  loading = false;
  neighborhoods: any[] = [];
  selected: any = {};
  modalMode: 'add' | 'edit' = 'add';
  userStep: 1 | 2 | 3 = 1;

  public masterUserList: any[] = [];
  public filteredUsers: any[] = [];
  public paginatedUsers: any[] = [];

  public searchText: string = '';
  public currentPage: number = 1;
  public itemsPerPage: number = 10;

  private homeMap: L.Map | null = null;
  private homeMarker: L.Marker | null = null;

  addressQuery: string = '';
  geoLoading: boolean = false;
  geoResults: any[] = [];
  showUserPassword = false;
  passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
  feedbackMessage = '';

  constructor(
    private userService: UserService,
    private neighborhoodService: NeighborhoodService,
    private auth: AuthService,
    private http: HttpClient,
  ) {}

  get isAdminGeneral(): boolean {
    return this.auth.isAdminGeneral();
  }

  get isAdminBarrio(): boolean {
    return this.auth.isAdminBarrio();
  }

  get assignedNeighborhoodId(): number {
    return Number(this.auth.neighborhood() || 0);
  }

  get assignedNeighborhoodName(): string {
    return (
      this.neighborhoods.find(
        (item) => Number(item.neighborhood_id) === this.assignedNeighborhoodId,
      )?.name || 'Sin barrio asignado'
    );
  }

  get canCreateResident(): boolean {
    return this.isAdminGeneral || this.assignedNeighborhoodId > 0;
  }

  get selectedNeighborhoodName(): string {
    if (this.isAdminBarrio) return this.assignedNeighborhoodName;
    return (
      this.neighborhoods.find(
        (item) => Number(item.neighborhood_id) === Number(this.selected.neighborhood_id),
      )?.name || 'Sin barrio'
    );
  }

  get selectedRoleLabel(): string {
    const role = Number(this.selected.role_id);
    if (role === 1) return 'Admin General';
    if (role === 2) return 'Representante';
    return 'Habitante';
  }

  canManageUser(user: any): boolean {
    return this.isAdminGeneral || Number(user?.role_id) === 3;
  }

  ngOnInit(): void {
    this.load();
    this.loadNeighborhoods();
  }

  load() {
    this.loading = true;
    this.feedbackMessage = '';
    this.userService.getAll().subscribe({
      next: (res) => {
        this.masterUserList = this.isAdminBarrio
          ? res.filter((user) => Number(user.role_id) === 3)
          : res;
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.feedbackMessage = err.error?.message || 'No se pudieron cargar los usuarios.';
        this.loading = false;
      },
    });
  }

  loadNeighborhoods() {
    this.neighborhoodService.getAll().subscribe({
      next: (res) => (this.neighborhoods = res),
      error: (err) => {
        this.feedbackMessage = err.error?.message || 'No se pudo cargar el barrio asignado.';
      },
    });
  }

  applyFilters() {
    const st = this.searchText.toLowerCase();

    this.filteredUsers = this.masterUserList.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(st)) ||
        (u.last_name && u.last_name.toLowerCase().includes(st)) ||
        (u.email && u.email.toLowerCase().includes(st)) ||
        (u.neighborhood_name && u.neighborhood_name.toLowerCase().includes(st)),
    );

    this.currentPage = 1;
    this.updatePaginatedUsers();
  }

  updatePaginatedUsers() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(startIndex, endIndex);
  }

  changePage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePaginatedUsers();
  }

  get totalPages(): number {
    const total = Math.ceil(this.filteredUsers.length / this.itemsPerPage);
    return total || 1;
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    return Array(total)
      .fill(0)
      .map((x, i) => i + 1);
  }

  openModal(mode: 'add' | 'edit', item?: any) {
    if (this.isAdminBarrio && !this.assignedNeighborhoodId) {
      this.feedbackMessage =
        'Tu cuenta de representante no tiene un barrio asignado. Contacta al administrador general.';
      return;
    }

    this.feedbackMessage = '';
    this.modalMode = mode;
    this.userStep = 1;
    this.destroyHomeMap();

    if (mode === 'edit' && item) {
      this.selected = { ...item };
      if (this.isAdminBarrio) {
        this.selected.role_id = 3;
        this.selected.neighborhood_id = this.assignedNeighborhoodId;
      }
      delete this.selected.password;
      this.addressQuery = this.selected.address || '';
    } else {
      this.selected = {
        user_id: null,
        name: '',
        last_name: '',
        email: '',
        password: '',
        address: '',
        phone: '',
        home_lat: null,
        home_lng: null,
        role_id: 3,
        neighborhood_id: this.isAdminBarrio
          ? this.assignedNeighborhoodId
          : this.neighborhoods.length === 1
            ? this.neighborhoods[0].neighborhood_id
            : null,
      };
      this.addressQuery = '';
    }

    this.geoResults = [];
    this.geoLoading = false;
    this.showUserPassword = false;

    const modalEl = document.getElementById('modalUser')!;
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  userNext(): void {
    if (this.userStep === 1) {
      if (!this.selected.name?.trim() || !this.selected.email?.trim()) {
        alert('El nombre y el correo son obligatorios.');
        return;
      }
      if (this.modalMode === 'add' && !this.passwordPattern.test(this.selected.password || '')) {
        alert('La contraseña debe tener mínimo 8 caracteres e incluir letras y números.');
        return;
      }
      this.userStep = 2;
      setTimeout(() => this.mountHomeMapSafely(), 150);
      return;
    }

    this.destroyHomeMap();
    this.userStep = 3;
  }

  userBack(): void {
    if (this.userStep === 3) {
      this.userStep = 2;
      setTimeout(() => this.mountHomeMapSafely(), 150);
      return;
    }

    this.destroyHomeMap();
    this.userStep = 1;
  }

  private destroyHomeMap(): void {
    this.homeMap?.remove();
    this.homeMap = null;
    this.homeMarker = null;
  }

  private mountHomeMapSafely() {
    const mapDiv = document.getElementById('home-map');
    if (!mapDiv) return;

    const rect = mapDiv.getBoundingClientRect();
    const looksHidden = rect.width === 0 || rect.height === 0;

    this.initHomeMap();

    setTimeout(
      () => {
        this.homeMap?.invalidateSize();

        if (this.selected.home_lat != null && this.selected.home_lng != null) {
          this.homeMap?.setView([this.selected.home_lat, this.selected.home_lng], 16);
        }
      },
      looksHidden ? 250 : 50,
    );
  }

  private initHomeMap() {
    const mapDiv = document.getElementById('home-map');
    if (!mapDiv) return;

    if (this.homeMap) {
      this.homeMap.remove();
      this.homeMap = null;
      this.homeMarker = null;
    }

    const defaultCenter: L.LatLngExpression = [0.3517, -78.1223]; // Ibarra
    const startCenter: L.LatLngExpression =
      this.selected.home_lat != null && this.selected.home_lng != null
        ? [this.selected.home_lat, this.selected.home_lng]
        : defaultCenter;

    this.homeMap = L.map('home-map', { zoomControl: true }).setView(startCenter, 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.homeMap);

    const iconDefault = L.icon({
      iconRetinaUrl: '/assets/marker-icon-2x.png',
      iconUrl: '/assets/marker-icon.png',
      shadowUrl: '/assets/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41],
    });
    (L.Marker.prototype as any).options.icon = iconDefault;

    if (this.selected.home_lat != null && this.selected.home_lng != null) {
      this.homeMarker = L.marker(startCenter).addTo(this.homeMap);
    }

    this.homeMap.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      this.selected.home_lat = lat;
      this.selected.home_lng = lng;

      if (!this.homeMarker) {
        this.homeMarker = L.marker([lat, lng]).addTo(this.homeMap!);
      } else {
        this.homeMarker.setLatLng([lat, lng]);
      }
    });
  }

  searchAddress() {
    const q = (this.addressQuery || '').trim();
    if (!q) return;

    this.geoLoading = true;
    this.geoResults = [];

    this.http.get<any[]>(`${environment.apiBaseUrl}/geocode?q=${encodeURIComponent(q)}`).subscribe({
      next: (data) => {
        this.geoResults = Array.isArray(data) ? data : [];

        if (this.geoResults.length === 1) {
          this.applyGeocode(this.geoResults[0]);
        }

        if (this.geoResults.length === 0) {
          alert(
            'No se encontraron resultados. Prueba con más detalle (ej: “Calle + número + ciudad”).',
          );
        }

        this.geoLoading = false;
      },
      error: (err) => {
        console.error(err);
        alert('No se pudo buscar la dirección.');
        this.geoLoading = false;
      },
    });
  }

  pickGeocodeResult(event: any) {
    const idx = +event.target.value;
    if (Number.isNaN(idx) || !this.geoResults[idx]) return;
    this.applyGeocode(this.geoResults[idx]);
  }

  private applyGeocode(r: any) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    this.selected.home_lat = lat;
    this.selected.home_lng = lng;

    this.mountHomeMapSafely();

    this.homeMap?.setView([lat, lng], 17);

    if (!this.homeMarker) {
      this.homeMarker = L.marker([lat, lng]).addTo(this.homeMap!);
    } else {
      this.homeMarker.setLatLng([lat, lng]);
    }
  }

  save() {
    const data = { ...this.selected };

    if (this.isAdminBarrio) {
      data.role_id = 3;
      data.neighborhood_id = this.assignedNeighborhoodId;
    }

    if (this.modalMode === 'edit' && !data.password) {
      delete data.password;
    }

    const serviceCall =
      this.modalMode === 'add'
        ? this.userService.create(data)
        : this.userService.update(this.selected.user_id, data);

    serviceCall.subscribe({
      next: () => {
        this.load();
        this.closeModal();
      },
      error: (err) => {
        this.feedbackMessage = err.error?.message || 'No se pudo guardar el usuario.';
      },
    });
  }

  remove(id: number) {
    const label = this.isAdminBarrio ? 'habitante' : 'usuario';
    if (confirm('¿Eliminar este ' + label + '?')) {
      this.userService.delete(id).subscribe({
        next: () => this.load(),
        error: (err) => {
          this.feedbackMessage = err.error?.message || 'No se pudo eliminar el ' + label + '.';
        },
      });
    }
  }

  closeModal() {
    const modalEl = document.getElementById('modalUser')!;
    bootstrap.Modal.getInstance(modalEl)?.hide();
    this.destroyHomeMap();
    this.geoResults = [];
    this.geoLoading = false;
    this.userStep = 1;
  }
}

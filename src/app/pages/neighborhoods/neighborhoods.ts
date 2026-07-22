import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NeighborhoodService } from '../../core/services/neighborhood';
import { UpcService } from '../../core/services/upc';
import { UserService } from '../../core/services/user';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import * as L from 'leaflet';
import { MapViewerComponent } from '../map-viewer/map-viewer';
import { AuthService } from '../../core/auth/auth.service';
import {
  isPointInsideNeighborhood,
  parseNeighborhoodBoundary,
} from '../../core/utils/neighborhood-boundary';

declare var bootstrap: any;

const iconDefault = L.icon({
  iconRetinaUrl: 'assets/marker-icon-2x.png',
  iconUrl: 'assets/marker-icon.png',
  shadowUrl: 'assets/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  tooltipAnchor: [16, -28], shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

export interface WizardUser {
  name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  address: string;
  home_lat: number | null;
  home_lng: number | null;
  role_id: number;
  neighborhood_id?: number;
}

@Component({
  selector: 'app-neighborhoods',
  standalone: true,
  imports: [CommonModule, FormsModule, MapViewerComponent],
  templateUrl: './neighborhoods.html',
  styleUrl: './neighborhoods.css'
})
export class Neighborhoods implements OnInit {

  // ── Edit modal ────────────────────────────────────────────────────────────
  selected: any = {};
  modalMode: 'add' | 'edit' = 'add';
  editStep: 1 | 2 | 3 = 1;
  loading = false;

  // ── Table list ────────────────────────────────────────────────────────────
  public masterList: any[] = [];
  public filteredItems: any[] = [];
  public paginatedItems: any[] = [];

  // ── Shared data ───────────────────────────────────────────────────────────
  public upcs: any[] = [];
  public admins: any[] = [];
  public selectedAdminId: number | null = null;

  // ── Search / pagination ───────────────────────────────────────────────────
  public searchText = '';
  public currentPage = 1;
  public itemsPerPage = 5;
  public selectedNeighborhoodId: number | null = null;
  public detailRefresh = 0;

  // ── Boundary map ──────────────────────────────────────────────────────────
  private map: L.Map | null = null;
  private drawingLayer: L.Polygon | null = null;
  public  drawingPoints: L.LatLng[] = [];
  private vertexMarkers: L.Marker[] = [];
  private isDrawing = true;

  // ════════════════════════════════════════════════════════════════════════
  // WIZARD STATE
  // ════════════════════════════════════════════════════════════════════════

  // Wizard has 4 main steps: 1=Barrio, 2=Mapa, 3=Usuarios, 4=Representante
  public wizardStep: 1 | 2 | 3 | 4 = 1;
  public wizardData: any = {};
  public wizardLoading = false;
  private wizardModalInstance: any = null;

  // ── Step 3: sub-steps inside "Usuarios" ───────────────────────────────────
  // 'list'     → shows the added users list + "add user" button
  // 'form'     → shows the new-user inline form
  // 'domicile' → shows the domicile map for the just-added user
  public userSubStep: 'list' | 'form' | 'domicile' = 'list';

  public wizardUsers: WizardUser[] = [];
  public assignableUsers: any[] = [];
  public selectedExistingUserIds = new Set<number>();
  public existingUserSearch = '';
  public existingUsersPage = 1;
  public existingUsersPerPage = 5;
  public wizardRepresentativeKey: string | null = null;
  public currentUserForm: WizardUser = this.emptyUserForm();
  public showWizardPassword = false;
  public passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
  public userFormError = '';

  // Index of the user whose domicile we are currently placing
  private domicilioUserIndex = -1;

  // ── Domicile map (step 3 / domicile sub-step) ─────────────────────────────
  private homeMap: L.Map | null = null;
  private homeMarker: L.Marker | null = null;
  public  geoQuery = '';
  public  geoLoading = false;
  public  geoResults: any[] = [];
  public domicileError = '';

  // ── Step 4: Representante search ─────────────────────────────────────────
  public wizardRepresentanteIdx: number | null = null;
  public repSearchText = '';

  // ════════════════════════════════════════════════════════════════════════

  constructor(
    private service: NeighborhoodService,
    private upcService: UpcService,
    private userService: UserService,
    private http: HttpClient,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.load();
    if (this.isAdminGeneral) {
      this.loadUpcs();
      this.loadAdmins();
      this.loadAssignableUsers();
    }
  }

  get isAdminGeneral(): boolean { return this.auth.isAdminGeneral(); }

  selectNeighborhood(id: number): void {
    this.selectedNeighborhoodId = id;
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (res) => {
        this.masterList = res;
        this.applyFilters();
        if (!this.selectedNeighborhoodId || !res.some((item: any) => Number(item.neighborhood_id) === Number(this.selectedNeighborhoodId))) {
          this.selectedNeighborhoodId = res[0]?.neighborhood_id ?? null;
        }
        this.detailRefresh++;
        this.loading = false;
      },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }

  loadUpcs() {
    this.upcService.getAll().subscribe({ next: (res) => this.upcs = res, error: console.error });
  }

  loadAdmins() {
    this.userService.getAdmins().subscribe({ next: (res) => this.admins = res, error: console.error });
  }

  loadAssignableUsers() {
    this.userService.getAll().subscribe({
      next: (users) => this.assignableUsers = users,
      error: (error) => console.error(error),
    });
  }

  get filteredAssignableUsers(): any[] {
    const query = this.existingUserSearch.trim().toLowerCase();
    return this.assignableUsers.filter((user) => {
      const available = Number(user.role_id) === 3 && !user.neighborhood_id;
      const matches = !query || [user.name, user.last_name, user.email, user.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return available && matches;
    });
  }

  get paginatedAssignableUsers(): any[] {
    const start = (this.existingUsersPage - 1) * this.existingUsersPerPage;
    return this.filteredAssignableUsers.slice(start, start + this.existingUsersPerPage);
  }

  get existingUsersTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredAssignableUsers.length / this.existingUsersPerPage));
  }

  changeExistingUsersPage(page: number): void {
    if (page < 1 || page > this.existingUsersTotalPages) return;
    this.existingUsersPage = page;
  }

  onExistingUserSearch(): void { this.existingUsersPage = 1; }

  toggleExistingUser(userId: number): void {
    if (this.selectedExistingUserIds.has(userId)) {
      this.selectedExistingUserIds.delete(userId);
      if (this.wizardRepresentativeKey === `existing:${userId}`) this.wizardRepresentativeKey = null;
    } else {
      this.selectedExistingUserIds.add(userId);
    }
  }

  get representativeCandidates(): any[] {
    const selectedExisting = this.assignableUsers
      .filter((user) => this.selectedExistingUserIds.has(Number(user.user_id)))
      .map((user) => ({ ...user, key: `existing:${user.user_id}`, source: 'existing' }));
    const pendingUsers = this.wizardUsers.map((user, index) => ({
      ...user,
      key: `new:${index}`,
      source: 'new',
      user_id: null,
    }));
    const existingAdmins = this.admins.map((user) => ({
      ...user,
      key: `admin:${user.user_id}`,
      source: 'admin',
    }));
    return [...selectedExisting, ...pendingUsers, ...existingAdmins];
  }

  get filteredRepresentativeCandidates(): any[] {
    const query = this.repSearchText.trim().toLowerCase();
    return this.representativeCandidates.filter((user) =>
      !query || [user.name, user.last_name, user.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }

  get selectedRepresentative(): any | null {
    return this.representativeCandidates.find((user) => user.key === this.wizardRepresentativeKey) || null;
  }

  selectRepresentative(candidateKey: string): void {
    const candidate = this.representativeCandidates.find((item) => item.key === candidateKey);
    if (!candidate) return;
    if (this.wizardRepresentativeKey === candidate.key) {
      this.wizardRepresentativeKey = null;
      return;
    }
    if (candidate.source === 'existing') {
      const accepted = confirm(
        'Este habitante cambiará al rol Representante (Admin Barrio). ' +
        'Conservará el acceso a la aplicación móvil, chat, reportes y alertas de su barrio. Después deberá iniciar sesión nuevamente para actualizar sus permisos. ¿Continuar?',
      );
      if (!accepted) return;
    }
    if (candidate.source === 'admin' && candidate.neighborhood_id) {
      const accepted = confirm(
        `Este representante está asignado a ${candidate.neighborhood_name || 'otro barrio'}. ` +
        'Se trasladará al nuevo barrio. ¿Continuar?',
      );
      if (!accepted) return;
    }
    this.wizardRepresentativeKey = candidate.key;
  }
  // ── Helpers ──────────────────────────────────────────────────────────────

  adminLabel(admin: any): string {
    const suffix = admin.neighborhood_name ? ' · ' + admin.neighborhood_name : '';
    return (admin.name + ' ' + (admin.last_name || '') + suffix).trim();
  }

  get selectedEditAdminLabel(): string {
    const admin = this.admins.find(
      (item) => Number(item.user_id) === Number(this.selectedAdminId),
    );
    return admin ? this.adminLabel(admin) : 'Sin representante';
  }

  getUpcName(upcId: any): string {
    if (!upcId) return '— Sin UPC';
    const f = this.upcs.find(u => String(u.upc_id) === String(upcId));
    return f ? f.name : '—';
  }

  emptyUserForm(): WizardUser {
    return { name: '', last_name: '', email: '', phone: '', password: '',
             address: '', home_lat: null, home_lng: null, role_id: 3 };
  }

  wizardUserLabel(u: WizardUser): string {
    return `${u.name} ${u.last_name}`.trim() || u.email || '(sin nombre)';
  }

  /** Filtered wizard users for the representante selector */
  get filteredWizardUsers(): { user: WizardUser; index: number }[] {
    const q = this.repSearchText.toLowerCase();
    return this.wizardUsers
      .map((u, i) => ({ user: u, index: i }))
      .filter(({ user }) =>
        !q ||
        user.name.toLowerCase().includes(q) ||
        user.last_name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      );
  }

  // ── Filters & pagination ─────────────────────────────────────────────────

  applyFilters() {
    const st = this.searchText.toLowerCase();
    this.filteredItems = this.masterList.filter(n =>
      (n.name?.toLowerCase().includes(st)) ||
      (n.description?.toLowerCase().includes(st)) ||
      (n.upc_name?.toLowerCase().includes(st)) ||
      (n.admin_name?.toLowerCase().includes(st)) ||
      (n.admin_last_name?.toLowerCase().includes(st)) ||
      (n.admin_email?.toLowerCase().includes(st)) ||
      (n.admin_phone?.toLowerCase().includes(st))
    );
    this.currentPage = 1;
    this.updatePaginated();
  }

  updatePaginated() {
    const s = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedItems = this.filteredItems.slice(s, s + this.itemsPerPage);
  }

  changePage(p: number) {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p; this.updatePaginated();
  }

  get totalPages() { return Math.ceil(this.filteredItems.length / this.itemsPerPage) || 1; }
  get pageNumbers() { return Array(this.totalPages).fill(0).map((_, i) => i + 1); }

  // ════════════════════════════════════════════════════════════════════════
  // WIZARD — OPEN / CLOSE / NAVIGATE
  // ════════════════════════════════════════════════════════════════════════

  openWizard() {
    this.wizardStep = 1;
    this.wizardData = { name: '', description: '', alarm_number: '', upc_id: '', boundary: '' };
    this.wizardUsers = [];
    this.wizardRepresentanteIdx = null;
    this.wizardRepresentativeKey = null;
    this.selectedExistingUserIds.clear();
    this.existingUserSearch = '';
    this.existingUsersPage = 1;
    this.repSearchText = '';
    this.wizardLoading = false;
    this.userSubStep = 'list';
    this.currentUserForm = this.emptyUserForm();
    this.userFormError = '';
    this.clearMapState();

    const el = document.getElementById('wizardModal')!;
    this.wizardModalInstance = new bootstrap.Modal(el);
    this.wizardModalInstance.show();
  }

  closeWizard() {
    this.wizardModalInstance?.hide();
    this.destroyBoundaryMap();
    this.destroyHomeMap();
  }

  wizardNext() {
    if (this.wizardStep === 1) {
      if (!this.wizardData.name?.trim()) { alert('El nombre del barrio es obligatorio.'); return; }
      this.wizardStep = 2;
      setTimeout(() => this.initBoundaryMap('wizard-map'), 150);
      return;
    }
    if (this.wizardStep === 2) {
      if (this.drawingPoints.length > 0 && this.drawingPoints.length < 3) {
        alert('Necesitas al menos 3 puntos para delimitar, o borra los puntos para omitir.'); return;
      }
      this.wizardData.boundary = this.drawingPoints.length >= 3
        ? JSON.stringify(this.drawingPoints.map(p => [p.lat, p.lng])) : null;
      this.destroyBoundaryMap();
      this.wizardStep = 3; this.userSubStep = 'list';
      return;
    }
    if (this.wizardStep === 3) {
      // Close any open form before advancing
      this.userSubStep = 'list';
      this.destroyHomeMap();
      this.wizardRepresentanteIdx = null;
      if (this.wizardRepresentativeKey && !this.selectedRepresentative) {
        this.wizardRepresentativeKey = null;
      }
      this.repSearchText = '';
      this.wizardStep = 4;
      return;
    }
  }

  wizardBack() {
    if (this.wizardStep === 4) {
      this.wizardStep = 3; this.userSubStep = 'list';
      return;
    }
    if (this.wizardStep === 3) {
      if (this.userSubStep === 'domicile') { this.destroyHomeMap(); this.userSubStep = 'list'; return; }
      if (this.userSubStep === 'form') { this.userSubStep = 'list'; return; }
      // Back from user list → go to step 2
      this.destroyBoundaryMap();
      this.wizardStep = 2;
      setTimeout(() => {
        this.initBoundaryMap('wizard-map');
        if (this.wizardData.boundary) {
          try {
            JSON.parse(this.wizardData.boundary).forEach((p: any) => this.addBoundaryPoint(L.latLng(p[0], p[1])));
            this.isDrawing = false;
            this.drawingLayer?.setStyle({ color: '#dc3545', dashArray: undefined });
          } catch {}
        }
      }, 150);
      return;
    }
    if (this.wizardStep === 2) { this.destroyBoundaryMap(); this.wizardStep = 1; }
  }

  // ════════════════════════════════════════════════════════════════════════
  // WIZARD STEP 3 — USER FORM
  // ════════════════════════════════════════════════════════════════════════

  openUserForm() {
    this.currentUserForm = this.emptyUserForm();
    this.userFormError = '';
    this.domicileError = '';
    this.showWizardPassword = false;
    this.userSubStep = 'form';
  }

  cancelUserForm() { this.userSubStep = 'list'; this.userFormError = ''; }

  confirmUserForm() {
    const u = this.currentUserForm;
    if (!u.name.trim())       { this.userFormError = 'El nombre es obligatorio.'; return; }
    if (!u.last_name.trim())  { this.userFormError = 'El apellido es obligatorio.'; return; }
    if (!u.email.trim())      { this.userFormError = 'El correo electrónico es obligatorio.'; return; }
    u.email = u.email.trim().toLowerCase();
    const duplicateExisting = this.assignableUsers.some(
      (user) => String(user.email || '').trim().toLowerCase() === u.email,
    );
    const duplicatePending = this.wizardUsers.some(
      (user) => String(user.email || '').trim().toLowerCase() === u.email,
    );
    if (duplicateExisting || duplicatePending) {
      this.userFormError = 'Este correo electrónico ya está registrado o fue agregado al asistente.';
      return;
    }
    if (!this.passwordPattern.test(u.password)) {
      this.userFormError = 'La contraseña debe tener mínimo 8 caracteres, con letras y números.'; return;
    }
    this.wizardUsers.push({ ...u });
    this.domicilioUserIndex = this.wizardUsers.length - 1;
    this.geoQuery = u.address || '';
    this.geoResults = [];
    this.userFormError = '';
    this.domicileError = '';
    this.userSubStep = 'domicile';
    setTimeout(() => this.initHomeMap(), 200);
  }

  removeWizardUser(index: number) {
    this.wizardUsers.splice(index, 1);
    if (this.wizardRepresentanteIdx === index) this.wizardRepresentanteIdx = null;
    else if (this.wizardRepresentanteIdx !== null && this.wizardRepresentanteIdx > index)
      this.wizardRepresentanteIdx--;

    if (this.wizardRepresentativeKey?.startsWith('new:')) {
      const selectedIndex = Number(this.wizardRepresentativeKey.split(':')[1]);
      if (selectedIndex === index) this.wizardRepresentativeKey = null;
      else if (selectedIndex > index) this.wizardRepresentativeKey = `new:${selectedIndex - 1}`;
    }
  }
  // ════════════════════════════════════════════════════════════════════════
  // WIZARD STEP 3 — DOMICILE SUB-STEP
  // ════════════════════════════════════════════════════════════════════════

  get hasWizardBoundary(): boolean {
    return parseNeighborhoodBoundary(this.wizardData.boundary).length >= 3;
  }

  get currentDomicilioUser(): WizardUser | null {
    return this.wizardUsers[this.domicilioUserIndex] ?? null;
  }

  skipDomicile() {
    this.domicileError = '';
    this.destroyHomeMap();
    this.userSubStep = 'list';
  }

  confirmDomicile() {
    if (!this.validateWizardDomicile()) return;
    this.domicileError = '';
    this.destroyHomeMap();
    this.userSubStep = 'list';
  }

  private initHomeMap() {
    this.destroyHomeMap();
    const user = this.currentDomicilioUser;
    if (!user) return;
    const mapDiv = document.getElementById('wizard-home-map');
    if (!mapDiv) return;

    const defaultCenter: L.LatLngExpression = [0.3517, -78.1223];
    const boundary = parseNeighborhoodBoundary(this.wizardData.boundary);
    const hasCoordinates = user.home_lat != null && user.home_lng != null;
    const coordinatesAllowed =
      !hasCoordinates ||
      isPointInsideNeighborhood(Number(user.home_lat), Number(user.home_lng), boundary);

    this.homeMap = L.map('wizard-home-map').setView(defaultCenter, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.homeMap);

    if (boundary.length >= 3) {
      const boundaryLayer = L.polygon(boundary, {
        color: '#667eea',
        weight: 3,
        fillColor: '#667eea',
        fillOpacity: 0.12,
      }).addTo(this.homeMap);
      this.homeMap.fitBounds(boundaryLayer.getBounds(), { padding: [22, 22] });
    }

    if (hasCoordinates && coordinatesAllowed) {
      this.homeMarker = L.marker([Number(user.home_lat), Number(user.home_lng)]).addTo(this.homeMap);
      this.homeMap.setView([Number(user.home_lat), Number(user.home_lng)], 16);
      this.domicileError = '';
    }

    this.homeMap.on('click', (event: L.LeafletMouseEvent) => {
      this.setWizardHomeLocation(event.latlng.lat, event.latlng.lng);
    });
  }

  private setWizardHomeLocation(lat: number, lng: number): boolean {
    if (!isPointInsideNeighborhood(lat, lng, this.wizardData.boundary)) {
      this.domicileError =
        `La ubicación debe estar dentro de ${this.wizardData.name || 'el barrio nuevo'}. ` +
        'El punto seleccionado está fuera del límite dibujado.';
      return false;
    }

    const user = this.currentDomicilioUser;
    if (!user) return false;
    user.home_lat = lat;
    user.home_lng = lng;
    this.domicileError = '';
    if (!this.homeMarker) this.homeMarker = L.marker([lat, lng]).addTo(this.homeMap!);
    else this.homeMarker.setLatLng([lat, lng]);
    return true;
  }

  private validateWizardDomicile(): boolean {
    const user = this.currentDomicilioUser;
    if (!user) return true;
    const hasLat = user.home_lat != null;
    const hasLng = user.home_lng != null;
    if (hasLat !== hasLng) {
      this.domicileError = 'La ubicación está incompleta. Selecciona nuevamente el domicilio.';
      return false;
    }
    if (
      hasLat &&
      !isPointInsideNeighborhood(Number(user.home_lat), Number(user.home_lng), this.wizardData.boundary)
    ) {
      this.domicileError = `La ubicación debe estar dentro de ${this.wizardData.name || 'el barrio nuevo'}.`;
      return false;
    }
    this.domicileError = '';
    return true;
  }

  searchAddress() {
    const q = this.geoQuery.trim();
    if (!q) return;
    this.geoLoading = true; this.geoResults = [];
    this.http.get<any[]>(`${environment.apiBaseUrl}/geocode?q=${encodeURIComponent(q)}`).subscribe({
      next: (data) => {
        this.geoResults = Array.isArray(data) ? data : [];
        if (this.geoResults.length === 1) this.applyGeocode(this.geoResults[0]);
        if (this.geoResults.length === 0) alert('No se encontraron resultados.');
        this.geoLoading = false;
      },
      error: () => { alert('No se pudo buscar la dirección.'); this.geoLoading = false; }
    });
  }

  pickGeoResult(e: Event) {
    const idx = +(e.target as HTMLSelectElement).value;
    if (!Number.isNaN(idx) && this.geoResults[idx]) this.applyGeocode(this.geoResults[idx]);
  }

  private applyGeocode(r: any) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (!this.setWizardHomeLocation(lat, lng)) return;
    this.homeMap?.setView([lat, lng], 17);
  }

  private destroyHomeMap() {
    if (this.homeMap) { this.homeMap.remove(); this.homeMap = null; this.homeMarker = null; }
    this.geoResults = [];
  }

  // ════════════════════════════════════════════════════════════════════════
  // WIZARD — SAVE
  // ════════════════════════════════════════════════════════════════════════

  wizardSave() {
    const boundary = parseNeighborhoodBoundary(this.wizardData.boundary);
    if (boundary.length >= 3) {
      const selectedExisting = this.assignableUsers.filter((user) =>
        this.selectedExistingUserIds.has(Number(user.user_id)),
      );
      const selectedAdmin = this.selectedRepresentative?.source === 'admin'
        ? [this.selectedRepresentative]
        : [];
      const invalidLocation = [...selectedExisting, ...selectedAdmin].find((user) => {
        const hasLat = user.home_lat != null && user.home_lat !== '';
        const hasLng = user.home_lng != null && user.home_lng !== '';
        return (
          hasLat !== hasLng ||
          (hasLat &&
            !isPointInsideNeighborhood(Number(user.home_lat), Number(user.home_lng), boundary))
        );
      });
      if (invalidLocation) {
        const userName = `${invalidLocation.name || ''} ${invalidLocation.last_name || ''}`.trim();
        alert(
          `El domicilio de ${userName || 'la persona seleccionada'} debe estar dentro de ${this.wizardData.name}. ` +
          'Corrige primero su ubicación antes de crear el barrio.',
        );
        this.wizardStep = 3;
        return;
      }
    }

    this.wizardLoading = true;
    this.service.create(this.wizardData).subscribe({
      next: (saved: any) => {
        const neighborhoodId = Number(saved?.neighborhood_id);
        this.assignExistingUsersAndContinue(neighborhoodId);
      },
      error: (error: any) => {
        this.wizardLoading = false;
        alert(error.error?.message || error.error?.error || 'Error al crear el barrio');
      },
    });
  }

  private assignExistingUsersAndContinue(neighborhoodId: number): void {
    const userIds = [...this.selectedExistingUserIds];
    if (userIds.length === 0) {
      this.createUsersSequentially(neighborhoodId, 0, []);
      return;
    }
    this.service.updateUsers(neighborhoodId, userIds, 'add').subscribe({
      next: () => this.createUsersSequentially(neighborhoodId, 0, []),
      error: (error: any) => {
        this.wizardLoading = false;
        alert(
          (error.error?.message || 'No se pudieron asignar los usuarios existentes.') +
          '\nEl barrio fue creado y puedes completar la asignación desde su detalle.',
        );
        this.selectedNeighborhoodId = neighborhoodId;
        this.load();
        this.closeWizard();
      },
    });
  }

  private createUsersSequentially(neighborhoodId: number, index: number, ids: number[]) {
    if (index >= this.wizardUsers.length) {
      this.finishWizard(neighborhoodId, ids);
      return;
    }
    const isNewRepresentative = this.wizardRepresentativeKey === `new:${index}`;
    const data = {
      ...this.wizardUsers[index],
      neighborhood_id: neighborhoodId,
      role_id: isNewRepresentative ? 2 : 3,
    };
    this.userService.create(data).subscribe({
      next: (response: any) => {
        ids.push(Number(response?.user_id));
        this.createUsersSequentially(neighborhoodId, index + 1, ids);
      },
      error: (error: any) => {
        this.wizardLoading = false;
        alert(
          (error.error?.message || `Error al crear usuario ${index + 1}`) +
          '\nEl barrio fue creado y puedes completar los usuarios desde su detalle.',
        );
        this.selectedNeighborhoodId = neighborhoodId;
        this.load();
        this.closeWizard();
      },
    });
  }

  private finishWizard(neighborhoodId: number, newUserIds: number[]) {
    const candidate = this.selectedRepresentative;
    let representativeId: number | null = null;
    let promote = false;

    if (candidate?.source === 'new') {
      const index = Number(String(candidate.key).split(':')[1]);
      representativeId = newUserIds[index] ?? null;
    } else if (candidate?.source === 'existing') {
      representativeId = Number(candidate.user_id);
      promote = true;
    } else if (candidate?.source === 'admin') {
      representativeId = Number(candidate.user_id);
    }

    const complete = () => {
      this.selectedNeighborhoodId = neighborhoodId;
      this.wizardLoading = false;
      this.loadAssignableUsers();
      this.loadAdmins();
      this.load();
      this.closeWizard();
    };

    if (!representativeId) {
      complete();
      return;
    }

    this.service.setAdmin(neighborhoodId, representativeId, promote).subscribe({
      next: complete,
      error: (error: any) => {
        alert(error.error?.message || 'El barrio fue creado, pero no se pudo asignar el representante.');
        complete();
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════  // EDIT MODAL (unchanged)
  // ════════════════════════════════════════════════════════════════════════

  openModal(mode: 'add' | 'edit', item?: any) {
    this.modalMode = mode;
    this.editStep = 1;
    this.destroyBoundaryMap();
    if (mode === 'edit') {
      this.selected = { ...item };
      this.selectedAdminId = item.admin_user_id ?? null;
    } else {
      this.selected = { name: '', description: '', alarm_number: '', upc_id: '', boundary: '' };
      this.selectedAdminId = null;
    }

    const element = document.getElementById('modalNeighborhood')!;
    bootstrap.Modal.getOrCreateInstance(element).show();
  }

  editNext(): void {
    if (this.editStep === 1) {
      if (!this.selected.name?.trim()) {
        alert('El nombre del barrio es obligatorio.');
        return;
      }
      this.editStep = 2;
      setTimeout(() => this.mountEditBoundaryMap(), 150);
      return;
    }

    if (this.drawingPoints.length > 0 && this.drawingPoints.length < 3) {
      alert('Debes dibujar al menos 3 puntos o borrar la delimitación.');
      return;
    }
    this.persistEditBoundary();
    this.destroyBoundaryMap();
    this.editStep = 3;
  }

  editBack(): void {
    if (this.editStep === 3) {
      this.editStep = 2;
      setTimeout(() => this.mountEditBoundaryMap(), 150);
      return;
    }

    this.persistEditBoundary();
    this.destroyBoundaryMap();
    this.editStep = 1;
  }

  private persistEditBoundary(): void {
    this.selected.boundary = this.drawingPoints.length
      ? JSON.stringify(this.drawingPoints.map((point) => [point.lat, point.lng]))
      : null;
  }

  private mountEditBoundaryMap(): void {
    this.initBoundaryMap('neighborhood-map');
    if (!this.selected.boundary) return;
    try {
      const coordinates = typeof this.selected.boundary === 'string'
        ? JSON.parse(this.selected.boundary)
        : this.selected.boundary;
      if (!Array.isArray(coordinates)) return;
      coordinates.forEach((point: any) => {
        if (Array.isArray(point) && point.length === 2) {
          this.addBoundaryPoint(L.latLng(point[0], point[1]));
        }
      });
      if (coordinates.length >= 3) {
        this.isDrawing = false;
        this.drawingLayer?.setStyle({ color: '#dc3545', dashArray: undefined });
      }
      if (this.drawingLayer) this.map?.fitBounds(this.drawingLayer.getBounds());
    } catch (error) {
      console.error(error);
    }
  }

  closeModal() {
    const el = document.getElementById('modalNeighborhood')!;
    bootstrap.Modal.getInstance(el)?.hide();
    this.destroyBoundaryMap();
    this.editStep = 1;
  }

  save() {
    if (this.drawingPoints.length > 0) {
      if (this.drawingPoints.length < 3) { alert('Debes dibujar al menos 3 puntos.'); return; }
      this.selected.boundary = JSON.stringify(this.drawingPoints.map(p => [p.lat, p.lng]));
    } else { this.selected.boundary = null; }

    const call = this.modalMode === 'add'
      ? this.service.create(this.selected)
      : this.service.update(this.selected.neighborhood_id, this.selected);

    call.subscribe({
      next: (saved: any) => {
        const nId = saved?.neighborhood_id ?? this.selected.neighborhood_id;
        if (this.selectedAdminId !== null && nId) {
          this.service.setAdmin(nId, this.selectedAdminId).subscribe({
            next: () => { this.load(); this.closeModal(); },
            error: (e) => { console.error(e); this.load(); this.closeModal(); }
          });
        } else if (this.selectedAdminId === null && this.modalMode === 'edit' && nId) {
          this.service.setAdmin(nId, null).subscribe({ next: () => { this.load(); this.closeModal(); }, error: () => { this.load(); this.closeModal(); } });
        } else { this.load(); this.closeModal(); }
      },
      error: (err) => alert(err.error?.message || err.error?.error || 'Error al guardar')
    });
  }

  remove(id: number) {
    if (confirm('¿Eliminar este barrio de forma permanente?')) {
      this.service.delete(id).subscribe({ next: () => this.load(), error: (e) => alert(e.error?.error || 'Error al eliminar') });
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // BOUNDARY MAP
  // ════════════════════════════════════════════════════════════════════════

  initBoundaryMap(id: string) {
    this.destroyBoundaryMap(); this.clearMapState();
    this.map = L.map(id).setView([0.35, -78.12], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
    this.map.on('click', (e: L.LeafletMouseEvent) => { if (this.isDrawing) this.addBoundaryPoint(e.latlng); });
  }

  private addBoundaryPoint(ll: L.LatLng) {
    this.drawingPoints.push(ll);
    const m = L.marker(ll, { draggable: true }).addTo(this.map!);
    m.on('drag', (ev: any) => { const i = this.vertexMarkers.indexOf(m); if (i >= 0) { this.drawingPoints[i] = ev.target.getLatLng(); this.redrawPolygon(); } });
    m.on('dblclick', () => { const i = this.vertexMarkers.indexOf(m); if (i >= 0) { this.map!.removeLayer(m); this.vertexMarkers.splice(i, 1); this.drawingPoints.splice(i, 1); this.redrawPolygon(); } });
    this.vertexMarkers.push(m); this.redrawPolygon();
  }

  private redrawPolygon() {
    if (this.drawingLayer) { this.map!.removeLayer(this.drawingLayer); this.drawingLayer = null; }
    if (this.drawingPoints.length < 2) return;
    this.drawingLayer = L.polygon(this.drawingPoints, { color: '#3388ff', weight: 3, dashArray: this.isDrawing ? '5,5' : undefined }).addTo(this.map!);
  }

  clearMap() { this.clearMapState(); }

  private clearMapState() {
    if (this.map && this.drawingLayer) { this.map.removeLayer(this.drawingLayer); }
    this.drawingLayer = null;
    if (this.map) { this.vertexMarkers.forEach(m => this.map!.removeLayer(m)); }
    this.vertexMarkers = []; this.drawingPoints = []; this.isDrawing = true;
  }

  private destroyBoundaryMap() { if (this.map) { this.map.remove(); this.map = null; } }

  finishDrawing() {
    if (this.drawingPoints.length < 3) { alert('Necesitas al menos 3 puntos.'); return; }
    this.isDrawing = false;
    if (this.drawingLayer) this.drawingLayer.setStyle({ dashArray: undefined, color: '#dc3545' });
  }
}
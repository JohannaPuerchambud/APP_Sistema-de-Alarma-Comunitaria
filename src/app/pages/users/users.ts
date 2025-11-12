import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user';
import { NeighborhoodService } from '../../core/services/neighborhood';

declare var bootstrap: any;

@Component({
  selector: 'app-users',
  standalone: true,
  // 1. Imports limpios (sin AG-Grid)
  imports: [CommonModule, FormsModule], 
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  
  // --- Estado del Componente ---
  loading = false;
  neighborhoods: any[] = [];
  selected: any = {};
  modalMode: 'add' | 'edit' = 'add';

  // --- Listas para la tabla ---
  public masterUserList: any[] = []; // Lista original de la API
  public filteredUsers: any[] = [];  // Lista después de aplicar el filtro de búsqueda
  public paginatedUsers: any[] = []; // Lista que se muestra en la tabla (la "rebanada")

  // --- Estado de Paginación y Búsqueda ---
  public searchText: string = '';
  public currentPage: number = 1;
  public itemsPerPage: number = 3; // Puedes cambiar esto (ej. 5, 10, 20)

  constructor(
    private userService: UserService,
    private neighborhoodService: NeighborhoodService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadNeighborhoods(); // Cargar barrios para el modal
  }

  /** Carga la lista maestra de usuarios desde la API */
  load() {
    this.loading = true;
    this.userService.getAll().subscribe({
      next: (res) => {
        this.masterUserList = res; // Guardar la lista maestra
        this.applyFilters(); // Aplicar filtros y paginación
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  /** Carga los barrios (para el modal) */
  loadNeighborhoods() {
    this.neighborhoodService.getAll().subscribe({
      next: (res) => this.neighborhoods = res,
      error: (err) => console.error(err)
    });
  }

  // --- Lógica de Filtro y Paginación ---

  /** Se llama cada vez que el usuario escribe en la barra de búsqueda */
  applyFilters() {
    const st = this.searchText.toLowerCase();

    // 1. Filtrar la lista maestra
    this.filteredUsers = this.masterUserList.filter(u => 
      u.name.toLowerCase().includes(st) || 
      u.email.toLowerCase().includes(st) ||
      (u.neighborhood_name && u.neighborhood_name.toLowerCase().includes(st))
    );

    // 2. Resetear a la página 1 (siempre que se filtra)
    this.currentPage = 1;

    // 3. Actualizar los datos de la tabla
    this.updatePaginatedUsers();
  }

  /** "Rebana" la lista filtrada para mostrar solo la página actual */
  updatePaginatedUsers() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(startIndex, endIndex);
  }

  /** Cambia la página actual y actualiza la tabla */
  changePage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePaginatedUsers();
  }

  // --- Getters para la UI de Paginación ---

  /** Calcula el número total de páginas */
  get totalPages(): number {
    return Math.ceil(this.filteredUsers.length / this.itemsPerPage);
  }

  /** Genera un array de números para los botones de la paginación */
  get pageNumbers(): number[] {
    return Array(this.totalPages).fill(0).map((x, i) => i + 1);
  }


  // --- Lógica del Modal (sin cambios, pero 'load' refresca la tabla) ---

  openModal(mode: 'add' | 'edit', item?: any) {
    this.modalMode = mode;
    this.selected = mode === 'edit' ? { ...item } : { name: '', email: '', password: '', address: '', role_id: 3, neighborhood_id: null };
    if (this.modalMode === 'edit') delete this.selected.password;

    const modal = document.getElementById('modalUser')!;
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }

  save() {
    const data = { ...this.selected };
    if (this.modalMode === 'edit' && !data.password) {
      delete data.password;
    }

    const serviceCall = this.modalMode === 'add'
      ? this.userService.create(data)
      : this.userService.update(this.selected.user_id, data);

    serviceCall.subscribe({
      next: () => { 
        this.load(); // Vuelve a cargar la lista maestra
        this.closeModal(); 
      },
      error: (err) => console.error(err)
    });
  }

  remove(id: number) {
    if (confirm('¿Eliminar este usuario?')) {
      this.userService.delete(id).subscribe({
        next: () => this.load(), // Vuelve a cargar la lista maestra
        error: (err) => console.error(err)
      });
    }
  }

  closeModal() {
    const modal = document.getElementById('modalUser')!;
    const bsModal = bootstrap.Modal.getInstance(modal);
    bsModal?.hide();
  }
}
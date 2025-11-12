import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NeighborhoodService } from '../../core/services/neighborhood';

declare var bootstrap: any;

@Component({
  selector: 'app-neighborhoods',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './neighborhoods.html',
  styleUrl: './neighborhoods.css'
})
export class Neighborhoods implements OnInit {
  
  // --- Estado del Componente ---
  selected: any = {};
  modalMode: 'add' | 'edit' = 'add';
  loading = false;

  // --- Listas para la tabla ---
  public masterList: any[] = [];      // Lista original de la API
  public filteredItems: any[] = [];   // Lista después de aplicar el filtro
  public paginatedItems: any[] = [];  // Lista que se muestra en la tabla

  // --- Estado de Paginación y Búsqueda ---
  public searchText: string = '';
  public currentPage: number = 1;
  public itemsPerPage: number = 3; // (Ahora ya sabes qué hace esto 😉)

  constructor(private service: NeighborhoodService) {}

  ngOnInit(): void {
    this.load();
  }

  /** Carga la lista maestra de barrios desde la API */
  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (res) => {
        this.masterList = res; // Guardar la lista maestra
        this.applyFilters(); // Aplicar filtros y paginación
        this.loading = false;
      },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }

  // --- Lógica de Filtro y Paginación ---

  /** Se llama cada vez que el usuario escribe en la barra de búsqueda */
  applyFilters() {
    const st = this.searchText.toLowerCase();

    // 1. Filtrar la lista maestra (buscamos por nombre y descripción)
    this.filteredItems = this.masterList.filter(item => 
      item.name.toLowerCase().includes(st) ||
      (item.description && item.description.toLowerCase().includes(st))
    );

    // 2. Resetear a la página 1
    this.currentPage = 1;

    // 3. Actualizar los datos de la tabla
    this.updatePaginatedItems();
  }

  /** "Rebana" la lista filtrada para mostrar solo la página actual */
  updatePaginatedItems() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedItems = this.filteredItems.slice(startIndex, endIndex);
  }

  /** Cambia la página actual y actualiza la tabla */
  changePage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePaginatedItems();
  }

  // --- Getters para la UI de Paginación ---

  get totalPages(): number {
    return Math.ceil(this.filteredItems.length / this.itemsPerPage);
  }

  get pageNumbers(): number[] {
    return Array(this.totalPages).fill(0).map((x, i) => i + 1);
  }

  // --- Lógica del Modal (sin cambios) ---

  openModal(mode: 'add' | 'edit', item?: any) {
    this.modalMode = mode;
    this.selected = mode === 'edit' ? { ...item } : { name: '', description: '' };
    const modal = document.getElementById('modalNeighborhood')!;
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }

  save() {
    const serviceCall = this.modalMode === 'add'
      ? this.service.create(this.selected)
      : this.service.update(this.selected.neighborhood_id, this.selected);

    serviceCall.subscribe({
      next: () => { 
        this.load(); // Vuelve a cargar la lista maestra
        this.closeModal(); 
      },
      error: (err) => console.error(err)
    });
  }

  remove(id: number) {
    if (confirm('¿Eliminar este barrio?')) {
      this.service.delete(id).subscribe({
        next: () => this.load(), // Vuelve a cargar la lista maestra
        error: (err) => console.error(err)
      });
    }
  }

  closeModal() {
    const modal = document.getElementById('modalNeighborhood')!;
    const bsModal = bootstrap.Modal.getInstance(modal);
    bsModal?.hide();
  }
}
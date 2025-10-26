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
  items: any[] = [];
  selected: any = {};
  modalMode: 'add' | 'edit' = 'add';
  loading = false;

  constructor(private service: NeighborhoodService) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (res) => { this.items = res; this.loading = false; },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }

  openModal(mode: 'add' | 'edit', item?: any) {
    this.modalMode = mode;
    this.selected = mode === 'edit' ? { ...item } : { name: '', description: '' };
    const modal = document.getElementById('modalNeighborhood')!;
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }

  save() {
    if (this.modalMode === 'add') {
      this.service.create(this.selected).subscribe({
        next: () => { this.load(); this.closeModal(); },
        error: (err) => console.error(err)
      });
    } else {
      this.service.update(this.selected.neighborhood_id, this.selected).subscribe({
        next: () => { this.load(); this.closeModal(); },
        error: (err) => console.error(err)
      });
    }
  }

  remove(id: number) {
    if (confirm('¿Eliminar este barrio?')) {
      this.service.delete(id).subscribe({
        next: () => this.load(),
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

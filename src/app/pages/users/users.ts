import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user';
import { NeighborhoodService } from '../../core/services/neighborhood';

declare var bootstrap: any;

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  users: any[] = [];
  neighborhoods: any[] = [];
  selected: any = {};
  modalMode: 'add' | 'edit' = 'add';
  loading = false;

  constructor(
    private userService: UserService,
    private neighborhoodService: NeighborhoodService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading = true;
    this.userService.getAll().subscribe({
      next: (res) => {
        this.users = res;
        this.loading = false;
        this.loadNeighborhoods();
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  loadNeighborhoods() {
    this.neighborhoodService.getAll().subscribe({
      next: (res) => this.neighborhoods = res,
      error: (err) => console.error(err)
    });
  }

  openModal(mode: 'add' | 'edit', item?: any) {
    this.modalMode = mode;
    this.selected = mode === 'edit' ? { ...item } : { name: '', email: '', password: '', address: '', role_id: 3, neighborhood_id: null };
    const modal = document.getElementById('modalUser')!;
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }

  save() {
    const data = { ...this.selected };
    if (this.modalMode === 'add') {
      this.userService.create(data).subscribe({
        next: () => { this.load(); this.closeModal(); },
        error: (err) => console.error(err)
      });
    } else {
      this.userService.update(this.selected.user_id, data).subscribe({
        next: () => { this.load(); this.closeModal(); },
        error: (err) => console.error(err)
      });
    }
  }

  remove(id: number) {
    if (confirm('¿Eliminar este usuario?')) {
      this.userService.delete(id).subscribe({
        next: () => this.load(),
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

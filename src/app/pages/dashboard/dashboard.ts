import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, RouterOutlet], // 👈 agrega RouterOutlet aquí
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard {}

import { Component } from '@angular/core';
import {RouterLink, RouterOutlet} from '@angular/router';
import {Sidebar} from '../sidebar/sidebar';

@Component({
  selector: 'app-main-layout',
  imports: [
    RouterOutlet,
    Sidebar,
    RouterLink
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {}

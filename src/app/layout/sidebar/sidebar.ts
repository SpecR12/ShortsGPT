import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Sidebar implements OnInit, OnDestroy {
  istoric: any[] = [];
  seIncarca = true;
  private abonamentRefresh!: Subscription;
  chatDeStersId: string | null = null;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef, private router: Router) {}

  ngOnInit() {
    void this.incarcaIstoric();
    this.abonamentRefresh = this.api.refreshIstoric$.subscribe(() => {
      void this.incarcaIstoric();
    });
  }

  ngOnDestroy() {
    if (this.abonamentRefresh) {
      this.abonamentRefresh.unsubscribe();
    }
  }

  async incarcaIstoric() {
    this.seIncarca = true;
    this.cdr.detectChanges();

    try {
      const response: any = await this.api.getIstoricProiecte();
      if (response && response.data) {
        this.istoric = response.data;
      }
    } catch (error) {
      console.error('❌ Eroare la încărcarea istoricului:', error);
    } finally {
      this.seIncarca = false;
      this.cdr.detectChanges();
    }
  }

  stergeProiect(id: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.chatDeStersId = id;
    this.cdr.detectChanges();
  }

  anuleazaStergerea() {
    this.chatDeStersId = null;
    this.cdr.detectChanges();
  }

  async confirmaStergerea() {
    if (!this.chatDeStersId) return;

    const id = this.chatDeStersId;
    this.chatDeStersId = null;

    const istoricBackup = [...this.istoric];
    this.istoric = this.istoric.filter(p => p._id !== id);
    this.cdr.detectChanges();

    try {
      await this.api.stergeChat(id);
      if (this.istoric.length === 0) {
        await this.router.navigate(['/']);
      }
      else if (this.router.url.includes(`/chat/${id}`)) {
        await this.router.navigate(['/chat/nou']);
      }

    } catch (error) {
      console.error('Eroare la ștergere pe server:', error);
      this.istoric = istoricBackup;
      this.cdr.detectChanges();
      alert('Nu s-a putut șterge proiectul din baza de date.');
    }
  }
}

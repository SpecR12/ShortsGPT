import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api';
import { Subscription, filter } from 'rxjs';

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
  chatDeStersId: string | null = null;

  private abonamentRefresh!: Subscription;
  private routerSub!: Subscription;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef, private router: Router) {}

  ngOnInit() {
    void this.incarcaIstoric(false);

    this.abonamentRefresh = this.api.refreshIstoric$.subscribe(() => {
      void this.incarcaIstoric(true);
    });

    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      if (event.url === '/' || event.url === '/chat/nou') {
        void this.incarcaIstoric(true);
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    if (this.abonamentRefresh) this.abonamentRefresh.unsubscribe();
    if (this.routerSub) this.routerSub.unsubscribe();
  }

  async incarcaIstoric(silent = false) {
    if (!silent) {
      this.seIncarca = true;
      this.cdr.markForCheck();
    }

    try {
      const response: any = await this.api.getIstoricProiecte();
      if (response && response.data) {
        this.istoric = response.data;
      }
    } catch (error) {
      console.error('❌ Eroare la încărcarea istoricului:', error);
    } finally {
      this.seIncarca = false;
      this.cdr.markForCheck();
    }
  }

  stergeProiect(id: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.chatDeStersId = id;
    this.cdr.markForCheck();
  }

  anuleazaStergerea() {
    this.chatDeStersId = null;
    this.cdr.markForCheck();
  }

  async confirmaStergerea() {
    if (!this.chatDeStersId) return;

    const id = this.chatDeStersId;
    this.chatDeStersId = null;

    const istoricBackup = [...this.istoric];
    this.istoric = this.istoric.filter(p => p._id !== id);
    this.cdr.markForCheck();

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
      this.cdr.markForCheck();
      alert('Nu s-a putut șterge proiectul din baza de date.');
    }
  }
}

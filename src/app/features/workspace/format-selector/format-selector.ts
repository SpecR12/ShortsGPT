import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api';

@Component({
  selector: 'app-format-selector',
  templateUrl: './format-selector.html',
  styleUrl: './format-selector.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormatSelector {
  seIncarca = false;

  constructor(private api: ApiService, private router: Router, private cdr: ChangeDetectorRef) {}

  async alegeFormat(format: string) {
    this.seIncarca = true;
    this.cdr.detectChanges();

    let promptAutomat = '';

    if (format === 'poveste_gta') {
      promptAutomat = "Generează o poveste horror sau amuzantă, la persoana a I-a (stil întâmplări din viața reală / Reddit). \n\nIMPORTANT: Povestea în sine NU trebuie să aibă nicio legătură cu jocul GTA V sau personajele din el. Povestea este complet separată și umană, GTA V va fi folosit exclusiv ca gameplay mut pe fundalul videoclipului.";
    }
    else if (format === 'documentar_istoric') {
      promptAutomat = `Generează un scenariu viral pentru un scurt documentar istoric (stil YouTube Shorts/TikTok).
Subiectul trebuie să fie un fapt istoric bizar, înfiorător (creepy) sau complet nebunesc (ex: decizii șocante ale împăraților romani, secrete întunecate din evul mediu, lucruri ciudate despre figuri istorice).

Reguli stricte:
1. Începe cu un HOOK exploziv sub formă de întrebare sau afirmație șocantă.
2. Folosește un ton misterios, dramatic și foarte captivant.
3. Fii concis, ritm alert, fără introduceri plictisitoare.
4. Scrie din perspectiva unui narator omniscient care dezvăluie secrete ascunse.`;
    }

    try {
      if (!localStorage.getItem('token')) {
        await this.api.loginRapid('salut2@shortsgpt.ro', 'parola_secreta');
      }

      await this.router.navigate(['/chat', 'nou'], {
        queryParams: {
          format: format,
          prompt: promptAutomat
        }
      });
    } catch (error) {
      console.error('Eroare login:', error);
    } finally {
      this.seIncarca = false;
      this.cdr.detectChanges();
    }
  }

  async incarcaVideoSplitScreen(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.seIncarca = true;
    this.cdr.detectChanges();

    try {
      if (!localStorage.getItem('token')) {
        await this.api.loginRapid('salut2@shortsgpt.ro', 'parola_secreta');
      }

      const initData = await this.api.initSplitScreenChat();
      await this.router.navigate(['/chat', initData.chatId]);

      this.api.uploadSplitScreenVideo(initData.chatId, file).catch(e => console.error(e));

    } catch (error) {
      console.error('Eroare upload:', error);
      alert('A apărut o problemă la încărcarea fișierului video.');
    } finally {
      this.seIncarca = false;
      this.cdr.detectChanges();
      event.target.value = '';
    }
  }
}

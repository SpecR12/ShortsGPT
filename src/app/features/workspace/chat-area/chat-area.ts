import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ApiService } from '../../../core/services/api';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat-area',
  imports: [NgOptimizedImage, FormsModule],
  templateUrl: './chat-area.html',
  styleUrl: './chat-area.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatArea implements OnInit, OnDestroy {
  chatId: string | null = null;
  chatData: any = null;
  seIncarca = true;
  aiGandeste = false;
  isDeepSeekModalOpen: boolean = false;
  isQwenModalOpen: boolean = false;

  baseUrl = 'http://localhost:3000';

  mesajCurent: string = '';
  mesajeNoi: any[] = [];

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  private refreshSub: Subscription | undefined;

  private isDestroyed = false;
  private sesiuneaCurenta = 0;

  constructor(private route: ActivatedRoute, private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.route.paramMap.subscribe(async (params) => {
      this.sesiuneaCurenta++;
      const sesiuneActiva = this.sesiuneaCurenta;

      this.seIncarca = true;
      this.aiGandeste = false;
      this.mesajeNoi = [];
      this.chatData = null;
      this.chatId = params.get('id');
      this.cdr.markForCheck();

      const formatNou = this.route.snapshot.queryParamMap.get('format');
      const promptDinUrl = this.route.snapshot.queryParamMap.get('prompt');

      if (this.chatId === 'nou') {
        if (!localStorage.getItem('token')) {
          this.api.loginRapid('salut2@shortsgpt.ro', 'parola_secreta').catch(err => console.error(err));
        }

        this.chatData = { formatVideo: formatNou || 'poveste_gta' };

        if (promptDinUrl) {
          this.seIncarca = false;
          this.mesajCurent = promptDinUrl;
          this.cdr.markForCheck();

          setTimeout(() => {
            if (this.sesiuneaCurenta === sesiuneActiva && !this.isDestroyed) {
              void this.trimiteMesaj(sesiuneActiva);
            }
          }, 50);
        }
        else {
          this.seIncarca = false;
          this.mesajeNoi = [{
            rol: 'ai',
            text: 'Salut! 🎬 Sunt Regizorul tău AI. Scrie-mi o idee sau o scurtă descriere și hai să creăm un videoclip viral!'
          }];
          this.cdr.markForCheck();
        }
      }
      else if (this.chatId && this.chatId !== 'nou') {
        await this.incarcaDateChatBaza(sesiuneActiva);
      } else {
        this.seIncarca = false;
        this.cdr.markForCheck();
      }

      if (this.chatId && this.chatId !== 'nou' && this.api.sarciniInFundal.has(this.chatId)) {
        this.aiGandeste = true;
        this.cdr.markForCheck();
        this.scrollToBottom();

        this.api.sarciniInFundal.get(this.chatId)!.then((raspuns: any) => {
          if (this.isDestroyed || this.sesiuneaCurenta !== sesiuneActiva) return;
          this.handleAiResponse(raspuns);
        }).catch(() => {
          if (!this.isDestroyed && this.sesiuneaCurenta === sesiuneActiva) {
            this.mesajeNoi = [...this.mesajeNoi, { rol: 'ai', text: 'Eroare de conexiune...' }];
          }
        }).finally(() => {
          if (!this.isDestroyed && this.sesiuneaCurenta === sesiuneActiva) {
            this.aiGandeste = false;
            this.cdr.markForCheck();
            this.scrollToBottom();
          }
        });
      }
    });

    this.refreshSub = this.api.refreshIstoric$.subscribe((actualizeazaSiChatul: boolean) => {
      if (!actualizeazaSiChatul || this.isDestroyed) return;

      if (this.chatId && this.chatId !== 'nou') {
        this.aiGandeste = false;
        void this.incarcaDateChatBaza(this.sesiuneaCurenta);
      }
    });
  }

  async incarcaDateChatBaza(sesiune: number) {
    try {
      this.chatData = await this.api.getChatData(this.chatId!);

      if (this.isDestroyed || this.sesiuneaCurenta !== sesiune) return;

      let mesajeReconstruite: any[] = [];
      const arePromptInIstoric = this.chatData.istoricInterviu &&
        this.chatData.istoricInterviu.length > 0 &&
        this.chatData.istoricInterviu[0].text === this.chatData.prompt;

      if (this.chatData && this.chatData.formatVideo !== 'split_screen' && !arePromptInIstoric) {
        if (this.chatData.prompt) {
          mesajeReconstruite.push({ rol: 'user', text: this.chatData.prompt });
        }
        if (this.chatData.scenariiGenerate && (!this.chatData.istoricInterviu || this.chatData.istoricInterviu.length === 0)) {
          mesajeReconstruite.push({
            rol: 'ai',
            text: 'Am generat două variante de scenariu pentru tine. Analizează-le mai jos și alege-o pe preferata ta:',
            scenarii: this.chatData.scenariiGenerate
          });
        }
      }

      if (this.chatData.istoricInterviu && this.chatData.istoricInterviu.length > 0) {
        const istoricMapat = this.chatData.istoricInterviu.map((m: any) => {
          const rolNormalizat = (m.rol || m.role || 'user').toLowerCase();
          return {
            rol: rolNormalizat === 'assistant' ? 'ai' : rolNormalizat,
            text: m.text || m.content || m.mesaj || '',
            videoUrl: m.videoUrl ? this.proceseazaLinkVideo(m.videoUrl) : null,
            scenarii: m.scenarii || null
          };
        });
        mesajeReconstruite = [...mesajeReconstruite, ...istoricMapat];
      }

      const areCarduriInIstoric = mesajeReconstruite.some(m => m.scenarii != null);
      if (!areCarduriInIstoric && this.chatData.scenariiGenerate) {
        for (let i = mesajeReconstruite.length - 1; i >= 0; i--) {
          if (mesajeReconstruite[i].rol === 'ai' && !mesajeReconstruite[i].videoUrl) {
            mesajeReconstruite[i].scenarii = this.chatData.scenariiGenerate;
            break;
          }
        }
      }

      let ultimulIndexCuCarduri = -1;
      for (let i = mesajeReconstruite.length - 1; i >= 0; i--) {
        if (mesajeReconstruite[i].scenarii) {
          ultimulIndexCuCarduri = i;
          break;
        }
      }

      mesajeReconstruite.forEach((m, index) => {
        m.isUltimulSetDeCarduri = (index === ultimulIndexCuCarduri);
      });

      this.mesajeNoi = mesajeReconstruite;

    } catch (error) {
      console.error('❌ Eroare MongoDB:', error);
    } finally {
      if (!this.isDestroyed && this.sesiuneaCurenta === sesiune) {
        this.seIncarca = false;
        this.cdr.markForCheck();
        this.scrollToBottom();
      }
    }
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    if (this.refreshSub) {
      this.refreshSub.unsubscribe();
    }
  }

  proceseazaLinkVideo(urlBrut: string): string {
    if (!urlBrut) return '';
    if (urlBrut.startsWith('http://') || urlBrut.startsWith('https://')) return urlBrut;
    let urlCurat = urlBrut.startsWith('/') ? urlBrut : '/' + urlBrut;
    return `${this.baseUrl}${urlCurat}`;
  }

  handleAiResponse(raspuns: any) {
    if (this.isDestroyed) return;

    const textAI = raspuns.reply || raspuns.raspuns || raspuns.mesaj || 'Am primit instrucțiunile!';
    const mesajNouAi: any = {rol: 'ai', text: textAI};

    if (raspuns.data && (raspuns.data.DeepSeek || raspuns.data.Qwen)) {
      mesajNouAi.scenarii = raspuns.data;
      mesajNouAi.isUltimulSetDeCarduri = true;

      this.mesajeNoi.forEach(m => m.isUltimulSetDeCarduri = false);

      if (this.chatData) {
        this.chatData.scenariiGenerate = raspuns.data;
        this.chatData.scenariuAles = null;
      }
    }

    if (raspuns.status === 'finalizat' && raspuns.videoUrl) {
      mesajNouAi.videoUrl = this.proceseazaLinkVideo(raspuns.videoUrl);
    }

    this.mesajeNoi = [...this.mesajeNoi, mesajNouAi];
    this.cdr.markForCheck();
    this.scrollToBottom();
  }

  onEnter(event: Event) {
    event.preventDefault();
    void this.trimiteMesaj();
  }

  async trimiteMesaj(sesiuneCurentaPredefinita?: number) {
    if (!this.mesajCurent.trim() || !this.chatId) return;

    const sesiune = sesiuneCurentaPredefinita || this.sesiuneaCurenta;
    const textTrimis = this.mesajCurent;
    this.mesajCurent = '';

    this.mesajeNoi = [...this.mesajeNoi, {rol: 'user', text: textTrimis}];
    this.aiGandeste = true;
    this.cdr.markForCheck();
    this.scrollToBottom();

    try {
      if (this.chatId === 'nou') {
        const formatSelectat = this.chatData?.formatVideo || 'poveste_gta';
        const response: any = await this.api.startProiect(textTrimis, formatSelectat);

        if (this.isDestroyed || this.sesiuneaCurenta !== sesiune) {
          this.api.notificaRefreshIstoric(true);
          return;
        }

        this.chatId = response.chatId;
        window.history.replaceState({}, '', `/chat/${this.chatId}`);
        this.api.notificaRefreshIstoric(false);

        this.chatData = {
          prompt: textTrimis,
          formatVideo: formatSelectat,
          scenariiGenerate: response.data
        };

        this.mesajeNoi = [...this.mesajeNoi, {
          rol: 'ai',
          text: 'Am generat două variante de scenariu pentru tine. Analizează-le mai jos și alege-o pe preferata ta:',
          scenarii: response.data,
          isUltimulSetDeCarduri: true
        }];

      }
      else {
        const request = this.api.trimiteMesajChat(this.chatId, textTrimis);
        const raspuns: any = await this.api.ruleazaInFundal(this.chatId, request);

        if (this.isDestroyed || this.sesiuneaCurenta !== sesiune) return;
        this.handleAiResponse(raspuns);
      }
    } catch (error) {
      console.error('Eroare trimitere mesaj:', error);
      if (!this.isDestroyed && this.sesiuneaCurenta === sesiune) {
        this.mesajeNoi = [...this.mesajeNoi, { rol: 'ai', text: 'Eroare de conexiune cu serverul...'}];
      }
    } finally {
      if (!this.isDestroyed && this.sesiuneaCurenta === sesiune) {
        this.aiGandeste = false;
        this.cdr.markForCheck();
        this.scrollToBottom();
      }
    }
  }

  async alegeScenariu(titlu: string, descriere: string) {
    if (this.aiGandeste || !this.chatId) return;

    const sesiune = this.sesiuneaCurenta;
    const textTrimis = `Am ales: ${titlu}. \n\nDetalii: ${descriere}`;
    this.mesajeNoi = [...this.mesajeNoi, {rol: 'user', text: textTrimis}];
    this.aiGandeste = true;
    this.cdr.markForCheck();
    this.scrollToBottom();

    try {
      const request = this.api.trimiteMesajChat(this.chatId, textTrimis);
      const raspuns: any = await this.api.ruleazaInFundal(this.chatId, request);

      if (this.isDestroyed || this.sesiuneaCurenta !== sesiune) return;
      this.handleAiResponse(raspuns);
    } catch (error) {
      if (!this.isDestroyed && this.sesiuneaCurenta === sesiune) {
        this.mesajeNoi = [...this.mesajeNoi, { rol: 'ai', text: 'A apărut o problemă...'}];
      }
    } finally {
      if (!this.isDestroyed && this.sesiuneaCurenta === sesiune) {
        this.aiGandeste = false;
        this.cdr.markForCheck();
        this.scrollToBottom();
      }
    }
  }

  scrollToBottom(): void {
    if (this.isDestroyed) return;
    try {
      setTimeout(() => {
        requestAnimationFrame(() => {
          const container = this.scrollContainer?.nativeElement;
          if (container) {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
          }
        });
      }, 100);
    } catch (err) {}
  }
}

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

  constructor(private route: ActivatedRoute, private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.route.paramMap.subscribe(async (params) => {
      this.chatId = params.get('id');

      const formatNou = this.route.snapshot.queryParamMap.get('format');
      const promptDinUrl = this.route.snapshot.queryParamMap.get('prompt');

      this.seIncarca = true;
      this.chatData = null;
      this.aiGandeste = false;
      this.mesajeNoi = [];

      if (this.chatId === 'nou') {
        if (!localStorage.getItem('token')) {
          this.api.loginRapid('salut2@shortsgpt.ro', 'parola_secreta').catch(err => console.error(err));
        }

        this.chatData = { formatVideo: formatNou || 'poveste_gta' };

        if (promptDinUrl) {
          this.seIncarca = false;
          this.mesajCurent = promptDinUrl;
          this.cdr.detectChanges();

          setTimeout(() => {
            this.trimiteMesaj().catch(err => console.error(err));
          }, 50);
        }
        else {
          this.seIncarca = false;
          this.mesajeNoi = [{
            rol: 'ai',
            text: 'Salut! 🎬 Sunt Regizorul tău AI. Scrie-mi o idee sau o scurtă descriere și hai să creăm un videoclip viral!'
          }];
          this.cdr.detectChanges();
        }
      }
      else if (this.chatId && this.chatId !== 'nou') {
        await this.incarcaDateChatBaza();
      } else {
        this.seIncarca = false;
      }

      const idSarcina = this.chatId === 'nou' ? 'nou' : this.chatId;

      if (idSarcina && this.api.sarciniInFundal.has(idSarcina)) {
        this.aiGandeste = true;
        this.cdr.detectChanges();
        this.scrollToBottom();

        this.api.sarciniInFundal.get(idSarcina)!.then((raspuns: any) => {
          if (idSarcina === 'nou') {
            this.chatId = raspuns.chatId;
            window.history.replaceState({}, '', `/chat/${this.chatId}`);
            this.api.notificaRefreshIstoric();

            this.chatData = {
              prompt: promptDinUrl || 'Ideea a fost trimisă...',
              formatVideo: formatNou || 'poveste_gta',
              scenariiGenerate: raspuns.data
            };
            this.mesajeNoi = [...this.mesajeNoi, {
              rol: 'ai',
              text: 'Am generat două variante de scenariu pentru tine. Analizează-le mai jos și alege-o pe preferata ta:',
              scenarii: raspuns.data
            }];
          } else {
            this.handleAiResponse(raspuns);
          }
        }).catch(err => {
          console.error("Eroare la reconectare:", err);
          this.mesajeNoi = [...this.mesajeNoi, { rol: 'ai', text: 'Eroare de conexiune...' }];
        }).finally(() => {
          this.aiGandeste = false;
          this.cdr.detectChanges();
          this.scrollToBottom();
        });
      }
    });

    this.refreshSub = this.api.refreshIstoric$.subscribe(() => {
      if (this.chatId && this.chatId !== 'nou') {
        console.log("🔄 Polling terminat în fundal! Reîncărcăm mesajele din chat...");
        this.aiGandeste = false;
        this.incarcaDateChatBaza().then(() => {
          this.cdr.detectChanges();
          this.scrollToBottom();
        });
      }
    });
  }

  async incarcaDateChatBaza() {
    try {
      this.chatData = await this.api.getChatData(this.chatId!);
      if (this.chatData.istoricInterviu) {
        let ultimulIndexAI = -1;
        for (let i = this.chatData.istoricInterviu.length - 1; i >= 0; i--) {
          if (this.chatData.istoricInterviu[i].rol === 'assistant' || this.chatData.istoricInterviu[i].role === 'assistant') {
            ultimulIndexAI = i;
            break;
          }
        }
        this.mesajeNoi = this.chatData.istoricInterviu.map((m: any, index: number) => {
          const trebuieCarduri = (index === ultimulIndexAI && !this.chatData.scenariuAles && this.chatData.scenariiGenerate);
          return {
            rol: m.rol || m.role,
            text: m.text || m.content,
            videoUrl: m.videoUrl ? this.proceseazaLinkVideo(m.videoUrl) : null,
            scenarii: trebuieCarduri ? this.chatData.scenariiGenerate : null
          };
        });
      }
    } catch (error) {
      console.error('❌ Eroare MongoDB:', error);
    } finally {
      this.seIncarca = false;
      this.cdr.detectChanges();
      this.scrollToBottom();
    }
  }

  ngOnDestroy() {
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
    const textAI = raspuns.reply || raspuns.raspuns || raspuns.mesaj || 'Am primit instrucțiunile!';
    const mesajNouAi: any = {rol: 'ai', text: textAI};

    if (raspuns.data && (raspuns.data.DeepSeek || raspuns.data.Qwen)) {
      mesajNouAi.scenarii = raspuns.data;
      this.chatData.scenariiGenerate = raspuns.data;
    }

    if (raspuns.status === 'finalizat' && raspuns.videoUrl) {
      mesajNouAi.videoUrl = this.proceseazaLinkVideo(raspuns.videoUrl);
    }

    this.mesajeNoi = [...this.mesajeNoi, mesajNouAi];
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  onEnter(event: Event) {
    event.preventDefault();
    this.trimiteMesaj().catch(err => console.error(err));
  }

  async trimiteMesaj() {
    if (!this.mesajCurent.trim() || !this.chatId) return;
    const textTrimis = this.mesajCurent;
    this.mesajCurent = '';

    this.mesajeNoi = [...this.mesajeNoi, {rol: 'user', text: textTrimis}];
    this.aiGandeste = true;
    this.cdr.detectChanges();
    this.scrollToBottom();

    try {
      if (this.chatId === 'nou') {
        const formatSelectat = this.chatData?.formatVideo || 'poveste_gta';

        const request = this.api.startProiect(textTrimis, formatSelectat);
        const response: any = await this.api.ruleazaInFundal('nou', request);

        this.chatId = response.chatId;
        window.history.replaceState({}, '', `/chat/${this.chatId}`);
        this.api.notificaRefreshIstoric();

        this.chatData = {
          prompt: textTrimis,
          formatVideo: formatSelectat,
          scenariiGenerate: response.data
        };

        this.mesajeNoi = [...this.mesajeNoi, {
          rol: 'ai',
          text: 'Am generat două variante de scenariu pentru tine. Analizează-le mai jos și alege-o pe preferata ta:',
          scenarii: response.data
        }];

      }
      else {
        const request = this.api.trimiteMesajChat(this.chatId, textTrimis);
        const raspuns: any = await this.api.ruleazaInFundal(this.chatId, request);
        this.handleAiResponse(raspuns);
      }
    } catch (error) {
      console.error('Eroare trimitere mesaj:', error);
      this.mesajeNoi = [...this.mesajeNoi, { rol: 'ai', text: 'Eroare de conexiune cu serverul...'}];
      this.cdr.detectChanges();
      this.scrollToBottom();
    } finally {
      this.aiGandeste = false;
      this.cdr.detectChanges();
    }
  }

  async alegeScenariu(titlu: string, descriere: string) {
    if (this.aiGandeste || !this.chatId) return;

    const textTrimis = `Am ales: ${titlu}. \n\nDetalii: ${descriere}`;
    this.mesajeNoi = [...this.mesajeNoi, {rol: 'user', text: textTrimis}];
    this.aiGandeste = true;
    this.cdr.detectChanges();
    this.scrollToBottom();

    try {
      const request = this.api.trimiteMesajChat(this.chatId, textTrimis);
      const raspuns: any = await this.api.ruleazaInFundal(this.chatId, request);
      this.handleAiResponse(raspuns);
    } catch (error) {
      console.error('Eroare la selectie:', error);
      this.mesajeNoi = [...this.mesajeNoi, { rol: 'ai', text: 'A apărut o problemă la comunicarea cu backend-ul...'}];
      this.cdr.detectChanges();
      this.scrollToBottom();
    } finally {
      this.aiGandeste = false;
      this.cdr.detectChanges();
    }
  }

  scrollToBottom(): void {
    try {
      setTimeout(() => {
        requestAnimationFrame(() => {
          const container = this.scrollContainer?.nativeElement;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });
      }, 50);
    } catch (err) {
      console.error('Eroare la auto-scroll', err);
    }
  }
}

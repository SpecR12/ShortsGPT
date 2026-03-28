import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:3000/api';

  private refreshIstoricSource = new Subject<boolean>();
  refreshIstoric$ = this.refreshIstoricSource.asObservable();
  public sarciniInFundal = new Map<string, Promise<any>>();

  constructor(private http: HttpClient) {}

  notificaRefreshIstoric(actualizeazaSiChatul = false) {
    this.refreshIstoricSource.next(actualizeazaSiChatul);
  }

  ruleazaInFundal(idChat: string, actiune: Promise<any>): Promise<any> {
    this.sarciniInFundal.set(idChat, actiune);
    actiune.finally(() => {
      this.sarciniInFundal.delete(idChat);
    }).catch(() => {});
    return actiune;
  }

  async loginRapid(email: string, parola: string) {
    const res: any = await firstValueFrom(
      this.http.post(`${this.baseUrl}/auth/login`, { email: email, password: parola })
    );
    localStorage.setItem('token', res.token);
    return res;
  }

  async startProiect(prompt: string, formatVideo: string) {
    const tokenSalvat = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${tokenSalvat}`);

    return firstValueFrom(
      this.http.post(`${this.baseUrl}/chat/start`, { prompt, formatVideo }, { headers })
    );
  }

  async getChatData(chatId: string) {
    const tokenSalvat = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${tokenSalvat}`);

    return firstValueFrom(
      this.http.get(`${this.baseUrl}/chat/${chatId}`, { headers })
    );
  }

  async trimiteMesajChat(chatId: string, mesaj: string) {
    const tokenSalvat = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${tokenSalvat}`);
    return firstValueFrom(
      this.http.post(`${this.baseUrl}/chat/${chatId}/mesaj`, { mesaj: mesaj }, { headers })
    );
  }

  async getIstoricProiecte() {
    const tokenSalvat = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${tokenSalvat}`);

    return firstValueFrom(
      this.http.get(`${this.baseUrl}/chat/istoric`, { headers })
    );
  }

  async stergeChat(chatId: string) {
    const tokenSalvat = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${tokenSalvat}`);

    return firstValueFrom(
      this.http.delete(`${this.baseUrl}/chat/${chatId}`, { headers })
    );
  }

  async initSplitScreenChat(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/chat/split-screen/init`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    return await response.json();
  }

  async uploadSplitScreenVideo(chatId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('mediaFile', file);

    const response = await fetch(`${this.baseUrl}/chat/split-screen/${chatId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });

    const data = await response.json();
    if (!data.success) throw new Error('Eroare la upload video');

    this.notificaRefreshIstoric(true);

    return {
      status: 'in_curs',
      reply: data.mesaj
    };
  }
}

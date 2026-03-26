import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';
import { FormatSelector } from './features/workspace/format-selector/format-selector';
import { ChatArea} from './features/workspace/chat-area/chat-area';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '', component: FormatSelector },
      { path: 'chat/:id', component: ChatArea }
    ]
  }
];

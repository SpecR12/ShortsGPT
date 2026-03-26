import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatArea } from './chat-area';

describe('ChatArea', () => {
  let component: ChatArea;
  let fixture: ComponentFixture<ChatArea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatArea],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatArea);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

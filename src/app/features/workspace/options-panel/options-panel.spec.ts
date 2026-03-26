import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OptionsPanel } from './options-panel';

describe('OptionsPanel', () => {
  let component: OptionsPanel;
  let fixture: ComponentFixture<OptionsPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OptionsPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(OptionsPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

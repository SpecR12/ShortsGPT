import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormatSelector } from './format-selector';

describe('FormatSelector', () => {
  let component: FormatSelector;
  let fixture: ComponentFixture<FormatSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormatSelector],
    }).compileComponents();

    fixture = TestBed.createComponent(FormatSelector);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

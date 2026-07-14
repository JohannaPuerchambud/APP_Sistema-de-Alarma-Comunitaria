import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Neighborhoods } from './neighborhoods';

describe('Neighborhoods', () => {
  let component: Neighborhoods;
  let fixture: ComponentFixture<Neighborhoods>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Neighborhoods],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Neighborhoods);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

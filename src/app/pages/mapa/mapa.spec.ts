import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Mapa } from './mapa';

describe('Mapa', () => {
  let component: Mapa;
  let fixture: ComponentFixture<Mapa>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Mapa],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Mapa);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

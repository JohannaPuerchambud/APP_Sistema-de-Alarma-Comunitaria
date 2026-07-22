import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Users } from './users';

describe('Users', () => {
  let component: Users;
  let fixture: ComponentFixture<Users>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Users],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Users);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('avanza de información a ubicación cuando los datos son válidos', fakeAsync(() => {
    component.modalMode = 'add';
    component.selected = { name: 'Ana', email: 'ana@test.local', password: 'Clave123' };
    spyOn<any>(component, 'mountHomeMapSafely');

    component.userNext();
    tick(150);

    expect(component.userStep).toBe(2);
    expect((component as any).mountHomeMapSafely).toHaveBeenCalled();
  }));
  it('avanza de ubicación al resumen antes de guardar', () => {
    component.userStep = 2;
    spyOn<any>(component, 'destroyHomeMap');

    component.userNext();

    expect(Number(component.userStep)).toBe(3);
    expect((component as any).destroyHomeMap).toHaveBeenCalled();
  });

  it('impide avanzar y explica cuando el correo ya existe', () => {
    component.masterUserList = [{ user_id: 8, email: 'vecino@test.local' }];
    component.modalMode = 'add';
    component.selected = {
      user_id: null,
      name: 'Vecino',
      email: 'VECINO@test.local',
      password: 'Clave123',
    };

    component.userNext();

    expect(component.userStep).toBe(1);
    expect(component.modalError).toContain('ya está registrado');
  });
});

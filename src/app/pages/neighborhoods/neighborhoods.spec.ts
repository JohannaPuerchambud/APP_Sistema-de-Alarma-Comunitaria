import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
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

  it('selecciona habitantes existentes sin perder la seleccion al paginar', () => {
    component.assignableUsers = [
      { user_id: 10, name: 'Ana', email: 'ana@test.local', role_id: 3, neighborhood_id: null },
      { user_id: 11, name: 'Luis', email: 'luis@test.local', role_id: 3, neighborhood_id: null },
    ];

    component.toggleExistingUser(10);
    component.changeExistingUsersPage(1);

    expect(component.selectedExistingUserIds.has(10)).toBeTrue();
    expect(component.filteredAssignableUsers.length).toBe(2);
  });

  it('incluye habitantes seleccionados y usuarios nuevos como candidatos a representante', () => {
    component.assignableUsers = [
      { user_id: 10, name: 'Ana', email: 'ana@test.local', role_id: 3, neighborhood_id: null },
    ];
    component.selectedExistingUserIds.add(10);
    component.wizardUsers = [component.emptyUserForm()];
    component.wizardUsers[0].name = 'Nuevo';

    expect(component.representativeCandidates.some((item) => item.key === 'existing:10')).toBeTrue();
    expect(component.representativeCandidates.some((item) => item.key === 'new:0')).toBeTrue();
  });

  it('avanza de información a delimitación cuando el barrio tiene nombre', fakeAsync(() => {
    component.selected = { name: 'La Victoria', boundary: null };
    spyOn<any>(component, 'mountEditBoundaryMap');

    component.editNext();
    tick(150);

    expect(component.editStep).toBe(2);
    expect((component as any).mountEditBoundaryMap).toHaveBeenCalled();
  }));
  it('avanza de delimitación al resumen antes de guardar', () => {
    component.editStep = 2;
    spyOn<any>(component, 'destroyBoundaryMap');

    component.editNext();

    expect(Number(component.editStep)).toBe(3);
    expect((component as any).destroyBoundaryMap).toHaveBeenCalled();
  });

  it('selecciona un representante mediante su clave estable', () => {
    component.admins = [
      { user_id: 7, name: 'Representante', email: 'representante@test.local', neighborhood_id: null },
    ];

    component.selectRepresentative('admin:7');

    expect(component.wizardRepresentativeKey).toBe('admin:7');
    expect(component.selectedRepresentative?.user_id).toBe(7);
  });

  it('muestra un mensaje antes de agregar un correo duplicado al asistente', () => {
    component.assignableUsers = [
      { user_id: 10, email: 'ana@test.local', role_id: 3 },
    ];
    component.currentUserForm = {
      ...component.emptyUserForm(),
      name: 'Ana',
      last_name: 'Prueba',
      email: 'ANA@test.local',
      password: 'Clave123',
    };

    component.confirmUserForm();

    expect(component.wizardUsers.length).toBe(0);
    expect(component.userFormError).toContain('ya está registrado');
  });
});

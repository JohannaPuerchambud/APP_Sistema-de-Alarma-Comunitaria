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
});

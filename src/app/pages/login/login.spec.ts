import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('redirige los roles administrativos al dashboard', () => {
    const auth = (component as any).auth;
    const router = TestBed.inject(Router);
    component.email = 'admin@test.local';
    component.password = 'Clave123';
    spyOn(auth, 'login').and.returnValue(of({ token: 'token-prueba' }));
    spyOn(auth, 'setToken');
    spyOn(auth, 'hasAny').and.returnValue(true);
    spyOn(router, 'navigate');

    component.onLogin();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });});

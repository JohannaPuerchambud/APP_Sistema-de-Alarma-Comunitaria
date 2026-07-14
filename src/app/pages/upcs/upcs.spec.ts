import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { UpcsComponent } from './upcs';

describe('Upcs', () => {
  let component: UpcsComponent;
  let fixture: ComponentFixture<UpcsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpcsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpcsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

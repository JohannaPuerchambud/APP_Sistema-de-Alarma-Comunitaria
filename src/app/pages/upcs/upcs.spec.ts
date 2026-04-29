import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpcsComponent } from './upcs';

describe('Upcs', () => {
  let component: UpcsComponent;
  let fixture: ComponentFixture<UpcsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpcsComponent]
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

import { MapViewerComponent } from './map-viewer';

describe('MapViewerComponent security', () => {
  it('renders popup content as text instead of executable HTML', () => {
    const component = new MapViewerComponent({} as any, {} as any, {} as any, authStub());
    const popup = (component as any).createPopup(
      '<img src=x onerror="window.__xss=true">',
      '<script>window.__xss=true</script>',
    ) as HTMLElement;

    expect(popup.querySelector('img')).toBeNull();
    expect(popup.querySelector('script')).toBeNull();
    expect(popup.textContent).toContain('<img src=x');
    expect(popup.textContent).toContain('<script>');
  });

  it('filtra y pagina habitantes del barrio seleccionado', () => {
    const component = new MapViewerComponent({} as any, {} as any, {} as any, authStub());
    component.neighborhoodUsers = [
      { user_id: 1, name: 'Ana', email: 'ana@test.local' },
      { user_id: 2, name: 'Luis', email: 'luis@test.local' },
    ];
    component.residentSearch = 'ana';
    component.residentsPerPage = 10;

    expect(component.filteredResidents.length).toBe(1);
    expect(component.paginatedResidents[0].user_id).toBe(1);
  });

  it('filtra, ordena y pagina los reportes compactos', () => {
    const component = new MapViewerComponent({} as any, {} as any, {} as any, authStub());
    component.neighborhoodReports = [
      { report_id: 1, title: 'Alarma antigua', name: 'Ana', created_at: '2026-01-01T10:00:00Z' },
      { report_id: 2, title: 'Alarma reciente', name: 'Luis', created_at: '2026-02-01T10:00:00Z' },
    ];
    component.reportSearch = 'alarma';
    component.reportSort = 'newest';
    component.reportsPerPage = 1;

    expect(component.filteredReports.map((report) => report.report_id)).toEqual([2, 1]);
    expect(component.paginatedReports[0].report_id).toBe(2);
    expect(component.reportsTotalPages).toBe(2);
  });

  it('expande y contrae un reporte por su clave estable', () => {
    const component = new MapViewerComponent({} as any, {} as any, {} as any, authStub());
    const report = { report_id: 7, title: 'Prueba' };

    component.toggleReport(report);
    expect(component.isReportExpanded(report)).toBeTrue();

    component.toggleReport(report);
    expect(component.isReportExpanded(report)).toBeFalse();
  });

  it('emite el barrio seleccionado para editarlo o eliminarlo', () => {
    const component = new MapViewerComponent({} as any, {} as any, {} as any, authStub());
    const neighborhood = { neighborhood_id: 9, name: 'La Victoria' };
    component.selectedNeighborhoodInfo = neighborhood;
    spyOn(component.editRequested, 'emit');
    spyOn(component.deleteRequested, 'emit');

    component.requestEdit();
    component.requestDelete();

    expect(component.editRequested.emit).toHaveBeenCalledWith(neighborhood);
    expect(component.deleteRequested.emit).toHaveBeenCalledWith(neighborhood);
  });
  function authStub(): any {
    return {
      isAdminGeneral: () => true,
      isAdminBarrio: () => false,
      neighborhood: () => null,
    };
  }
});
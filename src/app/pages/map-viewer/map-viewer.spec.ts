import { MapViewerComponent } from './map-viewer';

describe('MapViewerComponent security', () => {
  it('renders popup content as text instead of executable HTML', () => {
    const component = new MapViewerComponent({} as any, {} as any, {} as any);
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
    const component = new MapViewerComponent({} as any, {} as any, {} as any);
    component.neighborhoodUsers = [
      { user_id: 1, name: 'Ana', email: 'ana@test.local' },
      { user_id: 2, name: 'Luis', email: 'luis@test.local' },
    ];
    component.residentSearch = 'ana';
    component.residentsPerPage = 10;

    expect(component.filteredResidents.length).toBe(1);
    expect(component.paginatedResidents[0].user_id).toBe(1);
  });});

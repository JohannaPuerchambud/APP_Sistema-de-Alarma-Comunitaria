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
});

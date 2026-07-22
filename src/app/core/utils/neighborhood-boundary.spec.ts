import {
  isPointInsideNeighborhood,
  NeighborhoodBoundaryPoint,
  parseNeighborhoodBoundary,
} from './neighborhood-boundary';

describe('Neighborhood boundary utilities', () => {
  const boundary: NeighborhoodBoundaryPoint[] = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ];

  it('acepta puntos interiores y ubicados sobre el límite', () => {
    expect(isPointInsideNeighborhood(0.5, 0.5, boundary)).toBeTrue();
    expect(isPointInsideNeighborhood(0, 0.5, boundary)).toBeTrue();
  });

  it('rechaza puntos exteriores', () => {
    expect(isPointInsideNeighborhood(2, 2, boundary)).toBeFalse();
  });

  it('interpreta el perímetro almacenado como JSON', () => {
    expect(parseNeighborhoodBoundary(JSON.stringify(boundary))).toEqual(boundary);
  });
});

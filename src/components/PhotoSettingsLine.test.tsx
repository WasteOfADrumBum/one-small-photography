import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PhotoSettingsLine, { ApertureIcon } from './PhotoSettingsLine';

// What a screen reader reads: everything but the aria-hidden icons.
const text = (html: string) =>
  html
    .replace(/<svg.*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('PhotoSettingsLine', () => {
  it('lists each setting with a label for screen readers', () => {
    const html = renderToStaticMarkup(
      <PhotoSettingsLine
        settings={{
          camera: 'Nikon Z 7II',
          lens: 'NIKKOR Z 50mm f/1.8 S',
          aperture: '2.8',
          shutterSpeed: '1/250',
          iso: 1600,
        }}
      />,
    );
    expect(text(html)).toBe(
      'Camera: Nikon Z 7II Lens: NIKKOR Z 50mm f/1.8 S Aperture: ƒ/2.8 Shutter speed: 1/250s ISO: 1,600',
    );
    // Icons are decoration; the visible text and sr-only labels carry the meaning.
    expect(html.match(/<svg/g)).toHaveLength(5);
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(5);
  });

  it('shows only what is set', () => {
    const html = renderToStaticMarkup(<PhotoSettingsLine settings={{ iso: 100 }} />);
    expect(text(html)).toBe('ISO: 100');
  });

  it('renders nothing when no settings are set', () => {
    expect(renderToStaticMarkup(<PhotoSettingsLine settings={{}} />)).toBe('');
  });
});

describe('ApertureIcon', () => {
  const hole = (fNumber: number) => {
    const d = /<path d="M([\d.]+) ([\d.]+)/.exec(
      renderToStaticMarkup(<ApertureIcon fNumber={fNumber} />),
    )!;
    return Math.hypot(Number(d[1]) - 12, Number(d[2]) - 12);
  };

  it('draws a smaller opening for a narrower aperture', () => {
    expect(hole(0.95)).toBeCloseTo(7.5, 1);
    expect(hole(32)).toBeCloseTo(2, 1);
    expect(hole(2.8)).toBeGreaterThan(hole(8));
  });

  it('clamps f-numbers outside the list', () => {
    expect(hole(0.5)).toBeCloseTo(hole(0.95));
    expect(hole(64)).toBeCloseTo(hole(32));
  });
});

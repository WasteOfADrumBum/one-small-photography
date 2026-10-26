import { describe, expect, it } from 'vitest';
import {
  APERTURES,
  FAVORITE_ISOS,
  FAVORITE_SHUTTER_SPEEDS,
  ISOS,
  SHUTTER_SPEEDS,
  formatIso,
  formatShutter,
  settingsFromExif,
  shutterSeconds,
} from './camera-settings';

describe('shutterSeconds', () => {
  it('reads fractions and whole seconds', () => {
    expect(shutterSeconds('1/250')).toBeCloseTo(0.004);
    expect(shutterSeconds('1/1.3')).toBeCloseTo(0.769, 3);
    expect(shutterSeconds('2.5s')).toBe(2.5);
    expect(shutterSeconds('30s')).toBe(30);
  });

  it('runs longest to shortest through the list', () => {
    const seconds = SHUTTER_SPEEDS.map(shutterSeconds);
    expect([...seconds].sort((a, b) => b - a)).toEqual(seconds);
  });
});

describe('formatting', () => {
  it('adds an "s" to fractions only', () => {
    expect(formatShutter('1/250')).toBe('1/250s');
    expect(formatShutter('2.5s')).toBe('2.5s');
  });

  it('groups ISO thousands', () => {
    expect(formatIso(100)).toBe('100');
    expect(formatIso(12800)).toBe('12,800');
  });
});

describe('lists', () => {
  it('keeps apertures and ISOs in ascending order', () => {
    expect([...APERTURES].map(Number).sort((a, b) => a - b)).toEqual(APERTURES.map(Number));
    expect([...ISOS].sort((a, b) => a - b)).toEqual([...ISOS]);
  });

  it('only lists favorites that are in the full lists', () => {
    for (const s of FAVORITE_SHUTTER_SPEEDS) expect(SHUTTER_SPEEDS).toContain(s);
    for (const iso of FAVORITE_ISOS) expect(ISOS).toContain(iso);
  });
});

describe('settingsFromExif', () => {
  it('snaps camera values to the nearest list entry', () => {
    expect(settingsFromExif({ fNumber: 2.8, exposureTime: 1 / 250, iso: 100 })).toEqual({
      aperture: '2.8',
      shutterSpeed: '1/250',
      iso: 100,
    });
    expect(settingsFromExif({ fNumber: 1.75, exposureTime: 0.0041, iso: 110 })).toEqual({
      aperture: '1.8',
      shutterSpeed: '1/250',
      iso: 100,
    });
  });

  it('handles long exposures', () => {
    expect(settingsFromExif({ exposureTime: 2.4 }).shutterSpeed).toBe('2.5s');
  });

  it('leaves missing or nonsense values unset', () => {
    expect(settingsFromExif({})).toEqual({ aperture: null, shutterSpeed: null, iso: null });
    expect(settingsFromExif({ fNumber: 0, exposureTime: -1, iso: Number.NaN })).toEqual({
      aperture: null,
      shutterSpeed: null,
      iso: null,
    });
  });
});

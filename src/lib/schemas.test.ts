import { describe, expect, it } from 'vitest';
import { PhotoSettings, isGearKind } from './gear';
import { NewMessage } from './messages';

describe('PhotoSettings', () => {
  it('accepts values from the lists, or nothing', () => {
    expect(PhotoSettings.parse({ aperture: '2.8', shutterSpeed: '1/250', iso: 100 })).toEqual({
      aperture: '2.8',
      shutterSpeed: '1/250',
      iso: 100,
    });
    expect(PhotoSettings.parse({ cameraId: null, aperture: null })).toEqual({
      cameraId: null,
      aperture: null,
    });
  });

  it('rejects values that are not on the lists', () => {
    expect(PhotoSettings.safeParse({ aperture: '3' }).success).toBe(false);
    expect(PhotoSettings.safeParse({ shutterSpeed: '1/251' }).success).toBe(false);
    expect(PhotoSettings.safeParse({ iso: 101 }).error?.issues[0]?.message).toBe(
      'Pick an ISO from the list.',
    );
    expect(PhotoSettings.safeParse({ cameraId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('isGearKind', () => {
  it('only allows cameras and lenses', () => {
    expect(isGearKind('cameras')).toBe(true);
    expect(isGearKind('lenses')).toBe(true);
    expect(isGearKind('tripods')).toBe(false);
    expect(isGearKind(undefined)).toBe(false);
  });
});

describe('NewMessage', () => {
  const valid = { name: ' Ada ', email: 'ada@example.com', body: ' Hello ' };

  it('trims what people type', () => {
    expect(NewMessage.parse(valid)).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
      body: 'Hello',
    });
  });

  it('explains what is missing', () => {
    const message = (input: object) => NewMessage.safeParse(input).error?.issues[0]?.message;
    expect(message({ ...valid, name: '  ' })).toBe('Add your name.');
    expect(message({ ...valid, email: 'nope' })).toBe('That email address does not look right.');
    expect(message({ ...valid, body: '' })).toBe('Write a message.');
  });

  it('caps the message length', () => {
    expect(NewMessage.safeParse({ ...valid, body: 'x'.repeat(5001) }).success).toBe(false);
  });
});

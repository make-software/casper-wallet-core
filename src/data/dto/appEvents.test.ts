import { AppMarketingEventDto, AppReleaseEventDto } from './appEvents';
import { makeMarketingEvent, makeReleaseEvent } from '../../__test-utils__';

describe('AppMarketingEventDto', () => {
  it('maps response fields', () => {
    const dto = new AppMarketingEventDto(makeMarketingEvent());
    expect(dto.id).toBe(42);
    expect(dto.name).toBe('Promo');
    expect(dto.endAt).toBe('2099-01-01T00:00:00.000Z');
    expect(dto.startAt).toBe('2024-01-01T00:00:00.000Z');
    expect(dto.url).toBe('https://example.com/promo');
    expect(dto.image_url).toBeNull();
  });

  it('falls back to defaults', () => {
    const dto = new AppMarketingEventDto();
    expect(dto.id).toBe(0);
    expect(dto.name).toBe('');
    expect(dto.endAt).toBeNull();
  });
});

describe('AppReleaseEventDto', () => {
  it('maps response fields', () => {
    const dto = new AppReleaseEventDto(makeReleaseEvent());
    expect(dto.breaking).toBe(false);
    expect(dto.released).toBe(true);
    expect(dto.version).toBe('1.2.0');
    expect(dto.releaseNotes).toEqual(['First release']);
  });

  it('falls back to defaults', () => {
    const dto = new AppReleaseEventDto();
    expect(dto.breaking).toBe(false);
    expect(dto.released).toBe(false);
    expect(dto.version).toBe('');
    expect(dto.releaseNotes).toEqual([]);
  });
});

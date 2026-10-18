import { describe, it, expect } from 'vitest';
import { sectionFromLocation } from '@/lib/deepLink';

describe('deepLink: sectionFromLocation', () => {
  it('читает известный раздел из ?section=', () => {
    expect(sectionFromLocation('?section=habits')).toBe('habits');
    expect(sectionFromLocation('?section=workouts')).toBe('workouts');
    expect(sectionFromLocation('?section=sheets')).toBe('sheets');
    expect(sectionFromLocation('?section=dayplan')).toBe('dayplan');
    expect(sectionFromLocation('?section=dashboard')).toBe('dashboard');
  });

  it('находит section среди других параметров', () => {
    expect(sectionFromLocation('?x=1&section=sheets&y=2')).toBe('sheets');
  });

  it('неизвестный раздел — null', () => {
    expect(sectionFromLocation('?section=settings')).toBeNull();
    expect(sectionFromLocation('?section=')).toBeNull();
  });

  it('без параметра — null', () => {
    expect(sectionFromLocation('')).toBeNull();
    expect(sectionFromLocation('?x=1')).toBeNull();
  });
});

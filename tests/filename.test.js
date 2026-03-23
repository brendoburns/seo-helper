const { buildFilename, getExt } = require('../src/lib/filename');

describe('buildFilename', () => {
  test('basic keywords and location', () => {
    expect(buildFilename('30 ft rollout dumpster', 'Elkhart, IN', '.jpg')).toBe(
      '30-ft-rollout-dumpster-Elkhart-IN.jpg'
    );
  });

  test('strips special characters', () => {
    expect(buildFilename('hello & world!', 'City, ST', '.png')).toBe('hello-world-City-ST.png');
  });

  test('collapses multiple spaces and dashes', () => {
    expect(buildFilename('a  b', 'C  D', '.jpg')).toBe('a-b-C-D.jpg');
  });

  test('trims leading and trailing dashes', () => {
    expect(buildFilename('!hello!', 'City, ST', '.jpg')).toBe('hello-City-ST.jpg');
  });

  test('handles multi-word location without comma', () => {
    expect(buildFilename('dumpster', 'New York', '.jpg')).toBe('dumpster-New-York.jpg');
  });

  test('preserves mixed case', () => {
    expect(buildFilename('Roll-Off', 'Bristol, IN', '.jpg')).toBe('Roll-Off-Bristol-IN.jpg');
  });
});

describe('getExt', () => {
  test('returns lowercase extension', () => {
    expect(getExt('photo.JPG')).toBe('.jpg');
  });

  test('already lowercase is unchanged', () => {
    expect(getExt('photo.png')).toBe('.png');
  });

  test('returns empty string for no extension', () => {
    expect(getExt('noextension')).toBe('');
  });

  test('returns only the last extension for multi-dot names', () => {
    expect(getExt('archive.tar.gz')).toBe('.gz');
  });

  test('handles dotfiles', () => {
    expect(getExt('.hidden')).toBe('.hidden');
  });
});

import {
  buildFilter, buildReturn, joinConditions, parseFilter, getFiltersList, getAlias, getPath, stringifyQuery,
} from '.';
import { parseLocationSearch } from '../auxiliar-functions';

describe('filters', () => {
  it('translates paths and aliases', () => {
    expect(getAlias('references.proteins.organism')).toBe('uniprotOrganism');
    expect(getAlias('metadata.SNAPSHOTS')).toBe('metadata.SNAPSHOTS');
    expect(getPath('uniprotOrganism')).toBe('references.proteins.organism');
    expect(getPath('references.proteins.organism')).toBe('references.proteins.organism');
    expect(getPath('metadata.SNAPSHOTS')).toBe('metadata.SNAPSHOTS');
  });

  it('builds filters with aliases and operator words, quoting texts only', () => {
    expect(buildFilter('metadata.TYPE', '==', 'ensemble')).toBe("type=eq='ensemble'");
    expect(buildFilter('node', '!=', ['mmb', 'inria', null])).toBe("node=ne='mmb','inria',");
    expect(buildFilter('metadata.NAME', '~=', "it's \\o/")).toBe("name=ct='it\\'s \\\\o/'");
    expect(buildFilter('metadata.NAME', '!~=', 'spike')).toBe("name=nc='spike'");
    expect(buildFilter('metadata.SYSTATS', '>', 1000)).toBe('systemAtoms=gt=1000');
    expect(buildFilter('metadata.SYSTATS', '>=', 1000)).toBe('systemAtoms=ge=1000');
    expect(buildFilter('metadata.SYSTATS', '<', 1000)).toBe('systemAtoms=lt=1000');
    expect(buildFilter('metadata.SYSTATS', '<=', 1000)).toBe('systemAtoms=le=1000');
    expect(buildFilter('published', '==', true)).toBe('published=eq=true');
    expect(buildFilter('mds', '==', null)).toBe('mds=eq=');
    expect(() => buildFilter('metadata.TYPE', '=', 'x')).toThrow();
  });

  it('builds returned fields with aliases', () => {
    expect(buildReturn(['metadata.SYSKEYS', 'metadata.SNAPSHOTS'])).toBe('return=keyword&return=metadata.SNAPSHOTS');
  });

  it('joins conditions', () => {
    expect(joinConditions(['a=eq=1', "b=eq='x'"])).toBe("a=eq=1;b=eq='x'");
  });

  it('parses filters back to paths and operator symbols', () => {
    expect(parseFilter("node=eq='mmb','inria',")).toEqual([
      { path: 'node', operator: '==', values: ['mmb', 'inria', null] },
    ]);
    expect(parseFilter("name=nc='spike'")).toEqual([
      { path: 'metadata.NAME', operator: '!~=', values: ['spike'] },
    ]);
    expect(parseFilter("metadata.SYSTATS >= 10 ; name=ct='a;b, \\'c\\''")).toEqual([
      { path: 'metadata.SYSTATS', operator: '>=', values: ['10'] },
      { path: 'metadata.NAME', operator: '~=', values: ["a;b, 'c'"] },
    ]);
  });

  it('parses what it builds', () => {
    const value = "a,b;c 'd' \"e\" \\f =eq= &g";
    expect(parseFilter(buildFilter('metadata.NAME', '==', value))[0].values).toEqual([value]);
  });

  it('returns null for wrong filters', () => {
    for (const filter of ['type', "=eq='ensemble'", "type='ensemble'", "type=eq='ensemble",
      "type=eq='a' b", undefined, { a: 1 }])
      expect(parseFilter(filter)).toBe(null);
  });

  it('gets the filters list', () => {
    expect(getFiltersList(undefined)).toEqual([]);
    expect(getFiltersList('')).toEqual([]);
    expect(getFiltersList('a==b')).toEqual(['a==b']);
    expect(getFiltersList(['a==b', 'c==d'])).toEqual(['a==b', 'c==d']);
  });

  it('builds readable URLs which are parsed back', () => {
    const parameters = {
      search: 'a+b & c?',
      filter: ["uniprotOrganism=eq='Homo sapiens','Mus musculus';temperature=gt=300", "name=ct='50% #1'"],
    };
    const query = stringifyQuery(parameters);
    expect(query).toBe('search=a%2Bb%20%26%20c%3F' +
      "&filter=uniprotOrganism=eq='Homo%20sapiens','Mus%20musculus';temperature=gt=300" +
      "&filter=name=ct='50%25%20%231'");
    expect(parseLocationSearch('?' + query)).toEqual(parameters);
  });
});

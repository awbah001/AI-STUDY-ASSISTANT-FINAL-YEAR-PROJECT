const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise form validation without loading native file pickers in Node.
const filename = path.resolve(__dirname, '../src/components/staff/lecturer-workspace/courseTools.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject, require: id => {
  if (id === 'react-native') return { StyleSheet: { create: value => value } };
  if (id.endsWith('/colors')) return { colors: {} };
  return {};
}, Date, Number, Set, Error });
const { parseCourseDeadline, parseCourseRubric } = exportsObject;
assert.equal(parseCourseDeadline(''), undefined);
const leapDay = parseCourseDeadline('2028-02-29 14:30');
assert.equal(leapDay.getDate(), 29);
assert.equal(leapDay.getHours(), 14);
for (const invalid of ['2027-02-29 14:30', '2026-13-01 12:00', '2026-09-31 12:00', '2026-09-20 24:00', 'tomorrow']) {
  assert.throws(() => parseCourseDeadline(invalid), Error, invalid);
}
assert.equal(parseCourseRubric('  '), undefined);
assert.equal(JSON.stringify(parseCourseRubric('Research: 30, Analysis: 40')), JSON.stringify([{ criterion: 'Research', maxPoints: 30 }, { criterion: 'Analysis', maxPoints: 40 }]));
for (const invalid of ['Research', 'Research: 0', 'Research: -1', 'Research: Infinity', 'Research: 20, research: 30', Array.from({ length: 13 }, (_, i) => `Item ${i}: 1`).join(',')]) {
  assert.throws(() => parseCourseRubric(invalid), Error, invalid);
}
console.log('Lecturer deadline and rubric validation passed.');

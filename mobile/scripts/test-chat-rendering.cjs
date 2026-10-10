// Render native primitives as HTML to check message structure without a simulator.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function loadTs(filename) {
  const file = new Module(filename, module);
  file.filename = filename;
  file.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = file.require.bind(file);
  file.require = (id) => {
    if (id === 'react-native') return {
      Text: ({ children, style }) => React.createElement('span', { style: Object.assign({}, ...[style].flat().filter(Boolean)) }, children),
      View: ({ children }) => React.createElement('div', null, children),
      StyleSheet: { create: value => value },
      Platform: { OS: 'ios' },
      Alert: { alert() {} },
      Linking: { openURL() {} },
    };
    if (id === '../theme/colors') return loadTs(path.resolve(path.dirname(filename), '../theme/colors.ts'));
    return originalRequire(id);
  };
  file._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return file.exports;
}

const { AssistantMessage } = loadTs(path.resolve(__dirname, '../src/components/AssistantMessage.tsx'));
const render = content => renderToStaticMarkup(React.createElement(AssistantMessage, { content }));
const table = render('Week 3 covers GIS.\n\n| Topic | What you will learn |\n|---|---|\n| **Coordinate Systems** | Latitude and longitude |\n| **Map Projections** | Flattening Earth |\n\nKeep studying.');
assert.ok(!table.includes('**') && !table.includes('|'));
assert.ok(table.includes('font-weight:700'));
for (const text of ['Topic', 'What you will learn', 'Coordinate Systems', 'Latitude and longitude', 'Map Projections', 'Flattening Earth', 'Keep studying.']) assert.ok(table.includes(text), text);
assert.equal((table.match(/What you will learn/g) || []).length, 2);
const lists = render('# Summary\n\n3. First\n4. Second\n\n- **Nested**\n  - Detail');
assert.ok(lists.includes('3.') && lists.includes('4.') && lists.includes('Detail'));
assert.ok(!lists.includes('**') && !lists.includes('# Summary'));
const code = render('Use `a | b`.\n\n```js\nconst x = "**literal**";\n```');
assert.ok(code.includes('a | b') && code.includes('**literal**'));
assert.ok(render('| Value | Meaning |\n|---|---|\n| a \\| b | Either |').includes('a | b'));
assert.ok(render('An unfinished **response').includes('response'));
assert.ok(render('<script>alert("x")</script>').includes('&lt;script&gt;'));
assert.equal(render(''), '<div></div>');
console.log('Chat rendering checks passed: table cards, formatting, lists, code, escaped pipes, incomplete text, and inert HTML.');

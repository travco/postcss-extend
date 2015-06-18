'use strict';

var fs = require('fs');
var postcss = require('postcss');
var test = require('tape');
var simpleExtend = require('..');

function fixturePath(name) {
  return 'test/fixtures/' + name + '.css';
}

function fixture(name) {
  return fs.readFileSync(fixturePath(name), 'utf8').trim();
}

function compareFixtures(t, name) {
  var actualCss = postcss(simpleExtend)
    .process(fixture(name), { from: fixturePath(name) })
    .css
    .trim();

  fs.writeFile(fixturePath(name + '.actual'), actualCss);

  var expectedCss = fixture(name + '.expected');

  return t.equal(
    actualCss,
    expectedCss,
    'processed fixture ' + name + ' should be equal to expected output'
  );
}

function p(css) {
  return postcss(simpleExtend).process(css).css;
}

test('basically works', function(t) {
  compareFixtures(t, 'basic');
  compareFixtures(t, 'readme-examples');
  t.end();
});

test('works with several added selectors', function(t) {
  compareFixtures(t, 'several-additions');
  t.end();
});

test('works when adding selector groups', function(t) {
  compareFixtures(t, 'adding-groups');
  t.end();
});

test('treats whitespace as intended', function(t) {
  compareFixtures(t, 'whitespace');
  t.end();
});

test('works with a variety of selectors', function(t) {
  compareFixtures(t, 'selector-varieties');
  t.end();
});

test('works when the addto rule set is otherwise empty', function(t) {
  compareFixtures(t, 'only-addto');
  t.end();
});

test('works when invoked with () or without', function(t) {
  var someCss = '@define-placeholder bar { background: pink; } .foo { @extend bar; }';

  t.equal(
    postcss(simpleExtend).process(someCss).css,
    postcss(simpleExtend()).process(someCss).css
  );

  t.end();
});

test('accepts alternative at-rules', function(t) {
  var standard = p('@define-placeholder bar { background: pink; } .foo { @extend bar; }');
  t.equal(
    standard,
    p('@simple-extend-define bar { background: pink; } .foo { @simple-extend-addto bar; }')
  );
  t.equal(
    standard,
    p('@define-extend bar { background: pink; } .foo { @simple-extend-addto bar; }')
  );
  t.end();
});

test('eliminates unused definition', function(t) {
  // t.equal(p('@define-placeholder foo { background: pink; }'), '');
  t.end();
});

test('eliminates faulty extension', function(t) {
  t.equal(p('.foo { @extend baz; }'), '.foo { }');
  t.end();
});

require('./warnings');

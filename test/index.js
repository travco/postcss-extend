'use strict';

var fs = require('fs');
var postcss = require('postcss');
var test = require('tape');
var simpleMixin = require('..');

function fixturePath(name) {
  return 'test/fixtures/' + name + '.css';
}

function fixture(name) {
  return fs.readFileSync(fixturePath(name), 'utf8').trim();
}

function compareFixtures(t, name) {
  var actualCss = postcss(simpleMixin)
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
  var someCss = '@simple-extend-define bar { background: pink; } .foo { @simple-extend-addto bar; }';

  t.equal(
    postcss(simpleMixin).process(someCss).css,
    postcss(simpleMixin()).process(someCss).css
  );

  t.end();
});

function processCss(css) {
  return function() {
    return postcss(simpleMixin).process(css).css;
  };
}

test('throws location error', function(t) {

  var nonrootDefine = '.foo { @simple-extend-define bar { background: pink; } }';
  t.throws(
    processCss(nonrootDefine),
    /must occur at the root level/,
    'throws an error if definition is in non-root node'
  );

  var mediaDefine = (
    '@media (max-width: 700em) { @simple-extend-define foo { background: pink; } }'
  );
  t.throws(
    processCss(mediaDefine),
    /must occur at the root level/,
    'throws an error if definition is in non-root node'
  );

  var rootInclude = '@simple-extend-addto bar;';
  t.throws(
    processCss(rootInclude),
    /cannot occur at the root level/,
    'throws an error if include is in the root node'
  );

  t.end();
});

test('throws illegal nesting error', function(t) {

  var defineWithRule = '@simple-extend-define foo { .bar { background: pink; } }';
  t.throws(
    processCss(defineWithRule),
    /cannot contain statements/,
    'throws an error if definition contains a rule'
  );

  var defineWithMedia = (
    '@simple-extend-define foo { @media (max-width: 400px) {' +
    '.bar { background: pink; } } }'
  );
  t.throws(
    processCss(defineWithMedia),
    /cannot contain statements/,
    'throws an error if definition contains a rule'
  );

  t.end();
});

test('throws addto-without-definition error', function(t) {

  var extendUndefined = '.bar { @simple-extend-addto foo; }';
  t.throws(
    processCss(extendUndefined),
    /is not \(yet\) defined/,
    'throws an error if addto refers to undefined extendable'
  );

  var extendNotYetDefined = (
    '.bar { @simple-extend-addto foo; }' +
    '@simple-extend-define { background: pink; }'
  );
  t.throws(
    processCss(extendNotYetDefined),
    /is not \(yet\) defined/,
    'throws an error if addto refers to not-yet-defined extendable'
  );

  t.end();
});

test('throws addto-inside-media error', function(t) {
  var addInsideMedia = (
    '@simple-extend-define foo { background: pink; }' +
    '@media (max-width: 400px) { .bar { @simple-extend-addto foo; } }'
  );
  t.throws(
    processCss(addInsideMedia),
    /cannot occur inside a @media statement/,
    'throws an error if addto is inside a media statement'
  );
  t.end();
});

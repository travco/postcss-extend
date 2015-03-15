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

function runProcessor(css) {
  return function() {
    p(css);
  };
}

function p(css) {
  return postcss(simpleMixin).process(css).css;
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
    postcss(simpleMixin).process(someCss).css,
    postcss(simpleMixin()).process(someCss).css
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

test('throws location error', function(t) {

  var nonrootDefine = '.foo { @define-placeholder bar { background: pink; } }';
  t.throws(
    runProcessor(nonrootDefine),
    /must occur at the root level/,
    'throws an error if definition is in non-root node'
  );

  var mediaDefine = (
    '@media (max-width: 700em) { @define-placeholder foo { background: pink; } }'
  );
  t.throws(
    runProcessor(mediaDefine),
    /must occur at the root level/,
    'throws an error if definition is in non-root node'
  );

  var rootInclude = '@extend bar;';
  t.throws(
    runProcessor(rootInclude),
    /cannot occur at the root level/,
    'throws an error if include is in the root node'
  );

  t.end();
});

test('throws illegal nesting error', function(t) {

  var defineWithRule = '@define-placeholder foo { .bar { background: pink; } }';
  t.throws(
    runProcessor(defineWithRule),
    /cannot contain statements/,
    'throws an error if definition contains a rule'
  );

  var defineWithMedia = (
    '@define-placeholder foo { @media (max-width: 400px) {' +
    '.bar { background: pink; } } }'
  );
  t.throws(
    runProcessor(defineWithMedia),
    /cannot contain statements/,
    'throws an error if definition contains a rule'
  );

  t.end();
});

test('throws addto-without-definition error', function(t) {

  var extendUndefined = '.bar { @extend foo; }';
  t.throws(
    runProcessor(extendUndefined),
    /has not \(yet\) defined/,
    'throws an error if addto refers to undefined extendable'
  );

  var extendNotYetDefined = (
    '.bar { @extend foo; }' +
    '@define-placeholder { background: pink; }'
  );
  t.throws(
    runProcessor(extendNotYetDefined),
    /has not \(yet\) defined/,
    'throws an error if addto refers to not-yet-defined extendable'
  );

  t.end();
});

test('throws addto-inside-media error', function(t) {
  var addInsideMedia = (
    '@define-placeholder foo { background: pink; }' +
    '@media (max-width: 400px) { .bar { @extend foo; } }'
  );
  t.throws(
    runProcessor(addInsideMedia),
    /cannot occur inside a @media statement/,
    'throws an error if addto is inside a media statement'
  );
  t.end();
});

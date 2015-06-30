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

test('@define-placeholder basically works', function(t) {
  compareFixtures(t, 'basic');
  compareFixtures(t, 'readme-examples');
  t.end();
});

test('@define-placeholder works with several added selectors', function(t) {
  compareFixtures(t, 'several-additions');
  t.end();
});

test('@define-placeholder works when adding selector groups', function(t) {
  compareFixtures(t, 'adding-groups');
  t.end();
});

test('@define-placeholder treats whitespace as intended', function(t) {
  compareFixtures(t, 'whitespace');
  t.end();
});

test('@define-placeholder works with a variety of selectors', function(t) {
  compareFixtures(t, 'selector-varieties');
  t.end();
});

test('@define-placeholder works when the addto rule set is otherwise empty', function(t) {
  compareFixtures(t, 'only-addto');
  t.end();
});

test('%placeholder basically works', function(t) {
  compareFixtures(t, 'basic-silent');
  compareFixtures(t, 'readme-examples-silent');
  t.end();
});

test('%placeholder works with several added selectors', function(t) {
  compareFixtures(t, 'several-additions-silent');
  t.end();
});

test('%placeholder works when adding selector groups', function(t) {
  compareFixtures(t, 'adding-groups-silent');
  t.end();
});

test('%placeholder treats whitespace as intended', function(t) {
  compareFixtures(t, 'whitespace-silent');
  t.end();
});

test('%placeholder works with a variety of selectors', function(t) {
  compareFixtures(t, 'selector-varieties-silent');
  t.end();
});

test('%placeholder works when the addto rule set is otherwise empty', function(t) {
  compareFixtures(t, 'only-addto-silent');
  t.end();
});

test('extending rules directly basically works', function(t) {
  compareFixtures(t, 'basic-direct');
  compareFixtures(t, 'readme-examples-direct');
  t.end();
});

test('extending rules directly works with several added selectors', function(t) {
  compareFixtures(t, 'several-additions-direct');
  t.end();
});

test('extending rules directly works when adding selector groups', function(t) {
  compareFixtures(t, 'adding-groups-direct');
  t.end();
});

test('extending rules directly treats whitespace as intended', function(t) {
  compareFixtures(t, 'whitespace-direct');
  t.end();
});

test('extending rules directly works with a variety of selectors', function(t) {
  compareFixtures(t, 'selector-varieties-direct');
  t.end();
});

test('extending rules directly works when the addto rule set is otherwise empty', function(t) {
  compareFixtures(t, 'only-addto-direct');
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
  t.equal(p('@define-placeholder foo { background: pink; }'), '');
  t.end();
});

test('removes unused definition selector', function(t) {
  t.equal(p('@define-placeholder foo, .bar { background: pink; }'), '.bar { background: pink;\n}');
  t.end();
});

test('eliminates unused silent rule', function(t) {
  t.equal(p('%foo { background: pink; }'), '');
  t.end();
});

test('removes unused silent selector', function(t) {
  t.equal(p('%foo, .bar { background: pink; }'), '.bar { background: pink; }');
  t.end();
});

test('eliminates faulty extension', function(t) {
  t.equal(p('.foo { color: white; @extend baz; }'), '.foo { color: white; }');
  t.end();
});

/* TESTS THAT NEED TO BE MADE ('~' means indirectly tested, # means added):
# Works with silent '%' selectors
# Works with existing rules at root
@define doesn't work in anti-pattern, silent % does.
Eliminates duplicate selectors on extended rules
~ Removes otherwise empty code blocks
Acts recursively (both directions thanks to 'living log' behavior)
Targets pseudo classes and extends them with psuedo version of the extended
Acts recursively on pseudo classes
Finds it's exisiting pseudo classes (shared scope) and pulls declarations into them when possible
@extend finds it's existing pseudo classes (shared scope) and pulls, but continues to process the rest of the selectors in the target rule appropriately
@extend in @media finds it's exisiting pseudo classes (shared scope) and pulls declarations into them when possible
@extend inside @media does a declaration pull for anything outside @media
/\Correctly handles re-declarations, by ignoreing incoming via @extend (original overwrites)
@extend inside @media pulls&creates for targeted psuedo classes outside @media
@extend inside @media tacks onto those also inside the same @media
@extend inside @media does a declaration pull from other @media blocks
/\Correctly handles re-declarations, by ignoreing incoming via @extend (original overwrites)
@extend inside @media pulls&creates for targeted psuedo classes from other @media blocks
Order of naming remains predicatable add-to-tail fashion, and follows vertical order, then recursion in priority
*/

require('./warnings');

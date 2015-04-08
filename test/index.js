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

function p(css) {
  return postcss(simpleMixin).process(css).css;
}

function checkForWarnings(css, cb) {
  postcss(simpleMixin).process(css).then(function(result) {
    cb(result.warnings());
  }).catch(function(err) {
    console.log(err);
  });
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

test('registers location warning', function(t) {

  t.test('with non-root definition', function(st) {
    var nonrootDefine = '.foo { @define-placeholder bar { background: pink; } }';
    checkForWarnings(nonrootDefine, function(warnings) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/must occur at the root level/.test(warnings[0].text),
        'registers the right warning');
      st.end();
    });
  });

  t.test('with definition inside media query', function(st) {
    var mediaDefine = (
      '@media (max-width: 700em) { @define-placeholder foo { background: pink; } }'
    );
    checkForWarnings(mediaDefine, function(warnings) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/must occur at the root level/.test(warnings[0].text),
        'registers the right warning');
      st.end();
    });
  });

  t.test('with extension in the root node', function(st) {
    var rootExtend = '@extend bar;';
    checkForWarnings(rootExtend, function(warnings) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/cannot occur at the root level/.test(warnings[0].text),
        'registers the right warning');
      st.end();
    });
  });

  t.end();
});

test('register illegal nesting warning', function(t) {

  t.test('with a nested rule', function(st) {
    var defineWithRule = '@define-placeholder foo { .bar { background: pink; } }';
    checkForWarnings(defineWithRule, function(warnings) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/cannot contain statements/.test(warnings[0].text),
        'registers the right warning');
      st.end();
    });
  });

  t.test('with a nested media query', function(st) {
    var defineWithMedia = (
      '@define-placeholder foo { @media (max-width: 400px) {' +
      '.bar { background: pink; } } }'
    );
    checkForWarnings(defineWithMedia, function(warnings) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/cannot contain statements/.test(warnings[0].text),
        'registers the right warning');
      st.end();
    });
  });

  t.end();
});

test('registers extend-without-definition warning', function(t) {

  t.test('with an undefined placeholder', function(st) {
    var extendUndefined = '.bar { @extend foo; }';
    checkForWarnings(extendUndefined, function(warnings) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/has not \(yet\) defined/.test(warnings[0].text),
        'registers the right warning');
      st.end();
    });
  });

  t.test('with a not-yet-defined placeholder', function(st) {
    var extendNotYetDefined = (
      '.bar { @extend foo; }' +
      '@define-placeholder { background: pink; }'
    );
    checkForWarnings(extendNotYetDefined, function(warnings) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/has not \(yet\) defined/.test(warnings[0].text),
        'registers the right warning');
      st.end();
    });
  });

  t.end();
});

test('registers extend-inside-media warning', function(t) {
  var addInsideMedia = (
    '@define-placeholder foo { background: pink; }' +
    '@media (max-width: 400px) { .bar { @extend foo; } }'
  );
  checkForWarnings(addInsideMedia, function(warnings) {
    t.equal(warnings.length, 1, 'registers a warning');
    t.ok(/cannot occur inside a @media statement/.test(warnings[0].text),
      'registers the right warning');
    t.end();
  });
});

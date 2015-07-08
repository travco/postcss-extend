'use strict';

var test = require('tape');
var postcss = require('postcss');
var simpleExtend = require('..');

function checkForWarnings(css, cb) {
  postcss(simpleExtend).process(css).then(function(result) {
    cb(result.warnings(), result);
  }).catch(function(err) {
    console.log(err);
  });
}

test('registers location warning', function(t) {

  t.test('with non-root definition', function(st) {
    var nonrootDefine = '.foo { @define-placeholder bar { background: pink; } }';
    checkForWarnings(nonrootDefine, function(warnings, result) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/must occur at the root level/.test(warnings[0].text),
        'registers the right warning');
      st.equal(result.css, '.foo { }', 'bad definition is removed');
      st.end();
    });
  });

  t.test('with definition inside media query', function(st) {
    var mediaDefine = (
      '@media (max-width: 700em) { @define-placeholder foo { background: pink; } }'
    );
    checkForWarnings(mediaDefine, function(warnings, result) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/must occur at the root level/.test(warnings[0].text),
        'registers the right warning');
      st.equal(result.css, '@media (max-width: 700em) { }', 'bad definition is removed');
      st.end();
    });
  });

  t.test('with extension in the root node', function(st) {
    var rootExtend = '@extend bar;';
    checkForWarnings(rootExtend, function(warnings, result) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/cannot occur at the root level/.test(warnings[0].text),
        'registers the right warning');
      st.equal(result.css, '', 'bad extension is removed');
      st.end();
    });
  });

  t.end();
});

test('register illegal nesting warning', function(t) {

  t.test('with a nested rule', function(st) {
    var defineWithRule = '@define-placeholder foo { .bar { background: pink; } }';
    checkForWarnings(defineWithRule, function(warnings, result) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/cannot contain statements/.test(warnings[0].text),
        'registers the right warning');
      st.equal(result.css, '', 'bad definition is removed');
      st.end();
    });
  });

  t.test('with a nested media query', function(st) {
    var defineWithMedia = (
      '@define-placeholder foo { @media (max-width: 400px) {' +
      '.bar { background: pink; } } }'
    );
    checkForWarnings(defineWithMedia, function(warnings, result) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/cannot contain statements/.test(warnings[0].text),
        'registers the right warning');
      st.equal(result.css, '', 'bad definition is removed');
      st.end();
    });
  });

  t.end();
});

test('registers extend-without-definition warning', function(t) {

  t.test('with an undefined placeholder', function(st) {
    var extendUndefined = '.bar { @extend foo; }';
    checkForWarnings(extendUndefined, function(warnings, result) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/, has not been defined, so cannot be extended/.test(warnings[0].text),
        'registers the right warning');
      st.equal(result.css, '', 'bad extension is removed');
      st.end();
    });
  });

  t.end();
});

test('registers extend-without-target warning', function(t) {

  t.test('with whitespace as the target', function(st) {
    var extendUndefined = '.bar { @extend ; }';
    checkForWarnings(extendUndefined, function(warnings, result) {
      st.equal(warnings.length, 1, 'registers a warning');
      st.ok(/at-rules need a target/.test(warnings[0].text),
        'registers the right warning');
      st.equal(result.css, '', 'bad extension is removed');
      st.end();
    });
  });

  t.end();
});

test('registers extend-with-bad-parent warnings', function(t) {

  t.test('with an @define-placeholder as parent', function(st) {
    var extendUndefined = '@define-placeholder foo { @extend bar; float:right;} .who { @extend foo; }';
    checkForWarnings(extendUndefined, function(warnings, result) {
      st.equal(warnings.length, 2, 'registers both warnings');
      st.ok(/Defining at-rules cannot contain statements/.test(warnings[0].text),
        'registers the right warning for bad definition');
      st.ok(/at-rules cannot occur within \@define/.test(warnings[1].text),
        'registers the right warning for bad extension');
      st.equal(result.css, '.who { float:right;\n}', 'bad extension is removed, parent preserved');
      st.end();
    });
  });

  t.test('with whitespace as the parent selector', function(st) {
      var extendUndefined = '{ @extend foo; } .foo { float:left; }';
      checkForWarnings(extendUndefined, function(warnings, result) {
        st.equal(warnings.length, 1, 'registers a warning');
        st.ok(/at-rules cannot occur within unnamed/.test(warnings[0].text),
          'registers the right warning');
        st.equal(result.css, '.foo { float:left; }', 'bad extension is removed with parent');
        st.end();
      });
    });

  t.end();
});

test('registers infinite-recursion warning', function(t) {

  t.test('with two-point cyclic', function(st) {
    var extendUndefined = '.night {@extend #blackout; background: red;} #blackout {@extend .night; color: black;}';
    checkForWarnings(extendUndefined, function(warnings, result) {
      st.equal(warnings.length, 2, 'registers a warning');
      st.ok(/extention recursion detected/.test(warnings[0].text),
        'registers the right first warning');
      st.ok(/extention recursion detected/.test(warnings[1].text),
        'registers the right second warning');
      st.equal(result.css, '.night, #blackout { background: red;} #blackout, .night { color: black;}', 'avoids infinite-recursion without fouling css output');
      st.end();
    });
  });

  t.test('with n-point cyclic', function(st) {
    var extendUndefined = '.bravo {@extend .charlie; color: orange;} .alpha {@extend .bravo; color: yellow;} .charlie {@extend .alpha; color: red;}';
    checkForWarnings(extendUndefined, function(warnings, result) {
      st.equal(warnings.length, 3, 'registers a warning');
      st.ok(/extention recursion detected/.test(warnings[0].text),
        'registers the right first warning');
      st.ok(/extention recursion detected/.test(warnings[1].text),
        'registers the right second warning');
      st.ok(/extention recursion detected/.test(warnings[2].text),
        'registers the right third warning');
      st.equal(result.css, '.bravo, .alpha, .charlie { color: orange;} .alpha, .charlie, .bravo { color: yellow;} .charlie, .bravo, .alpha { color: red;}', 'avoids infinite-recursion without fouling css output');
      st.end();
    });
  });

  t.end();
});
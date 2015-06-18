'use strict';

var postcss = require('postcss');
var /*DEBUG*/ appendout = require('fs').appendFileSync; //FOR DEBUGGING

module.exports = postcss.plugin('postcss-simple-extend', function simpleExtend() {

  return function(css, result) {
    var definingAtRules = ['define-placeholder', 'define-extend', 'simple-extend-define'];
    var extendingAtRules = ['extend', 'simple-extend', 'simple-extend-addto'];
    var availablePlaceholders = {};
    var requestedExtends = {};

    css.eachAtRule(function(atRule) {
      if (definingAtRules.indexOf(atRule.name) !== -1) {
        processDefinition(atRule);
      } else if (extendingAtRules.indexOf(atRule.name) !== -1) {
        processExtension(atRule);
      }
    });

    function uniqreq(a) {
      var seen = {};
      return a.filter(function(item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
      });
    }

    // Act on requestedExtends
    css.eachRule(function(targetRule) {
      var tgtSaved = targetRule.selectors;
      // if (!targetRule.selectors.length) {
      //   tgtSaved = [targetRule.selector, 'dummybackstop'];
      // } else {
      //   tgtSaved = targetRule.selectors;
      //   tgtSaved.push('dummybackstop');
      // }
      for (var n = tgtSaved.length - 1; n >= 0; n--) {
        var tgtAccumulate = targetRule.selectors;
        if (requestedExtends[tgtSaved[n]] && targetRule.parent.type === 'root') {
          /*DEBUG*/ appendout('./test/errout.txt', '\nrequestedExtends[' + tgtSaved[n] + '] : ' + requestedExtends[tgtSaved[n]]);
          //Kill off duplicate selectors
          /*DEBUG*/ appendout('./test/errout.txt', '\nPre uniqreq :' + requestedExtends[tgtSaved[n]]);
          // uniqreq(requestedExtends[tgtSaved[n]]);
          /*DEBUG*/ appendout('./test/errout.txt', '\nPost uniqreq :' + requestedExtends[tgtSaved[n]]);

          tgtAccumulate.push.apply(tgtAccumulate, requestedExtends[tgtSaved[n]]);

          // for (var i = requestedExtends[tgtSaved[n]].length - 1; i >= 0; i--) {
          //   /*DEBUG*/ appendout('./test/errout.txt', '\n' + tgtSaved[n] + ' adding ' + requestedExtends[tgtSaved[n]][i] + ' \n');
          //   //Because all things were are expanding logically require an exisiting selector
          //   tgtAccumulate = requestedExtends[tgtSaved[n]][i] + ',\n' + tgtAccumulate;
          //   /*DEBUG*/ appendout('./test/errout.txt', ' tacked up to :\n--------------\n' + tgtAccumulate + '.\n');
          // }
          //Has ability to assigned directly
          // tgtAccumulate = tgtAccumulate.split(',\n');
          /*DEBUG*/ appendout('./test/errout.txt', '\nPre uniqreq2 :\n' + tgtAccumulate);
          tgtAccumulate = uniqreq(tgtAccumulate);
          tgtAccumulate = tgtAccumulate.toString();
          /*DEBUG*/ appendout('./test/errout.txt', '\nPost uniqreq2 :\n' + tgtAccumulate);
          tgtAccumulate = tgtAccumulate.replace(/,/g, ',\n');
          /*DEBUG*/ appendout('./test/errout.txt', '\nPost2 uniqreq2 :\n' + tgtAccumulate);

          targetRule.selector = tgtAccumulate;
          /*DEBUG*/ appendout('./test/errout.txt', '\nDeleting requestedExtends[' + tgtSaved[n] + ']');
          delete requestedExtends[tgtSaved[n]];
        }
      }
    });

    // might be race-casing with the callback above
    for (var selector in requestedExtends) {
      if (requestedExtends.hasOwnProperty(selector)) {
        result.warn('`' + selector + '`, has not been defined, so cannot be extended');
        /*DEBUG*/ appendout('./test/errout.txt', '\n' + selector + ' has not been defined!!!');
      }
    }

    // Remove placeholders that were never used
    for (var p in availablePlaceholders) {
      if (availablePlaceholders.hasOwnProperty(p) && !availablePlaceholders[p].selector) {
        availablePlaceholders[p].removeSelf();
      }
    }

    function processDefinition(atRule) {
      if (isBadDefinitionLocation(atRule)) {
        atRule.removeSelf();
        return;
      }

      var definition = postcss.rule();

      // Manually copy styling properties (semicolon, whitespace)
      // to newly created and cloned nodes,
      // cf. https://github.com/postcss/postcss/issues/85
      definition.semicolon = atRule.semicolon;
      atRule.nodes.forEach(function(node) {
        if (isBadDefinitionNode(node)) return;
        var clone = node.clone();
        clone.before = node.before;
        clone.after = node.after;
        clone.between = node.between;
        definition.append(clone);
      });

      atRule.parent.insertBefore(atRule, definition);
      availablePlaceholders[atRule.params] = definition;
      atRule.removeSelf();
    }

    function processExtension(atRule) {
      if (isBadExtensionLocation(atRule)) {
        if (!atRule.parent.nodes.length || atRule.parent.nodes.length === 1) {
          atRule.parent.removeSelf();
        } else {
          atRule.removeSelf();
        }
        return;
      }
      var selectorsToAdd = atRule.parent.selectors;
      var targetExt = getExtendable(atRule.params, selectorsToAdd);
      if (targetExt) {
        targetExt.selector = (targetExt.selector)
          ? targetExt.selector + ',\n' + selectorsToAdd.toString()
          : selectorsToAdd.toString();
      }
      /*DEBUG*/ appendout('./test/errout.txt', '\nParent: ' + atRule.parent.selector + ' nodes: ' + atRule.parent.nodes);
      if (!atRule.parent.nodes.length || atRule.parent.nodes.length === 1) {
        atRule.parent.removeSelf();
      } else {
        atRule.removeSelf();
      }
    }

    function isBadDefinitionNode(node) {
      if (node.type === 'rule' || node.type === 'atrule') {
        result.warn('Defining at-rules cannot contain statements', { node: node });
        return true;
      }
    }

    function getExtendable(extIdent, selectorsToAdd) {
      var targetExt = availablePlaceholders[extIdent];
      //assume find-behavior for extend if no Placeholder is availible
      if (!targetExt) {
        //avoid .indexOf undefined error
        /*DEBUG*/ appendout('./test/errout.txt', '\nRunning find-behavior');
        if (!requestedExtends[extIdent]) {
          requestedExtends[extIdent] = selectorsToAdd;
        } else if (requestedExtends[extIdent].indexOf(selectorsToAdd) === -1) {
          requestedExtends[extIdent].push.apply(requestedExtends[extIdent], selectorsToAdd);
        }
        /*DEBUG*/ appendout('./test/errout.txt', '\nrequestExt: ' + extIdent + ' : ' +
          selectorsToAdd);
        /*DEBUG*/ appendout('./test/errout.txt', '\ncreated: ' + requestedExtends[extIdent]);
      }
      return targetExt;
    }

    function isBadDefinitionLocation(atRule) {
      if (atRule.parent.type !== 'root') {
        result.warn('Defining at-rules must occur at the root level', { node: atRule });
        return true;
      }
    }

    function isBadExtensionLocation(atRule) {
      if (atRule.parent.type === 'root') {
        result.warn('Extending at-rules cannot occur at the root level', { node: atRule });
        return true;
      }

      return hasMediaAncestor(atRule);

      function hasMediaAncestor(node) {
        var parent = node.parent;
        if (parent.type === 'atrule' && parent.name === 'media') {
          result.warn('Extending at-rules cannot occur inside a @media statement', { node: node });
          return true;
        }
        if (parent.type !== 'root') {
          return hasMediaAncestor(parent);
        }
      }
    }
  };
});

'use strict';

var postcss = require('postcss');
/*DEBUG*/ var appendout = require('fs').appendFileSync;

module.exports = postcss.plugin('postcss-simple-extend', function simpleExtend() {

  return function(css, result) {
    var definingAtRules = ['define-placeholder', 'define-extend', 'simple-extend-define'];
    var extendingAtRules = ['extend', 'simple-extend', 'simple-extend-addto'];
    var requestedExtends = {};
    var fufilledExtends = [];

    css.eachAtRule(function(atRule) {
      if (definingAtRules.indexOf(atRule.name) !== -1) {
        processDefinition(atRule);
      } else if (extendingAtRules.indexOf(atRule.name) !== -1) {
        processExtension(atRule);
      }
    });

    // Act on requestedExtends
    css.eachRule(function(targetRule) {
      var tgtSaved = targetRule.selectors;
      //Strip all @define-placeholders and save slug-selectors into tgtSaved
      for (var i = tgtSaved.length - 1; i >= 0; i--) {
        if (tgtSaved[i].substring(0, 20) === '@define-placeholder ') {
          /*DEBUG*/ appendout('./test/errout.txt', '\nn[' + i + ']String = ' + tgtSaved[i] + ' Substring 0-20 = \'' + tgtSaved[i].substring(0, 20) + '\'');
          tgtSaved[i] = tgtSaved[i].substring(20, (tgtSaved[i].length));
          /*DEBUG*/ appendout('./test/errout.txt', '\nresString = \'' + tgtSaved[i] + '\'');
        }
      }
      var tgtAccumulate = [];
      for (var n = tgtSaved.length - 1; n >= 0; n--) {

        //Selectively disclude slugs from final accumulation for placeholders and silent classes
        if (targetRule.selectors.indexOf('@define-placeholder ' + tgtSaved[n]) === -1 &&
          tgtSaved[n].charAt(0) !== '%') {
          if (!tgtAccumulate) {
            tgtAccumulate = [ (tgtSaved[n]) ];
          } else {
            tgtAccumulate.push(tgtSaved[n]);
          }
        } /*DEBUG*/ else {
          /*DEBUG*/ appendout('./test/errout.txt', '\nSifted out placeholder/silent ' + tgtSaved[n]);
        /*DEBUG*/ }

        // Operate on normal extendables
        if (requestedExtends[tgtSaved[n]] && targetRule.parent.type === 'root') {
          /*DEBUG*/ appendout('./test/errout.txt', '\nrequestedExtends[' + tgtSaved[n] + '] : ' + requestedExtends[tgtSaved[n]]);

          tgtAccumulate.push.apply(tgtAccumulate, requestedExtends[tgtSaved[n]]);
          /*DEBUG*/ appendout('./test/errout.txt', '\nCombined selectors :\n' + tgtAccumulate);
          /*DEBUG*/ appendout('./test/errout.txt', '\nSaving fufilled [' + tgtSaved[n] + ']');
          if (!fufilledExtends) {
            fufilledExtends = [ (tgtSaved[n]) ];
          } else {
            fufilledExtends.push(tgtSaved[n]);
          }
        }
        //Operate on psuedo-elements of extendables (thus extending them)
        if (tgtSaved[n].indexOf(':') !== -1 && requestedExtends[ tgtSaved[n].substring(0, tgtSaved[n].indexOf(':')) ] && targetRule.parent.type === 'root') {

          var tgtBase = tgtSaved[n].substring(0, tgtSaved[n].indexOf(':'));
          var tgtPsuedo = tgtSaved[n].substring(tgtSaved[n].indexOf(':'), tgtSaved[n].length);
          var requestedExtArr = requestedExtends[tgtBase].toString().split(',');
          /*DEBUG*/ appendout('./test/errout.txt', '\nrequestedExtends[' + tgtSaved[n].substring(0, tgtSaved[n].indexOf(':')) + '] :\n' + tgtBase);

          for (var p = requestedExtArr.length - 1; p >= 0; p--) {
            tgtAccumulate.push(requestedExtArr[p] + tgtPsuedo);
            /*DEBUG*/ appendout('./test/errout.txt', '\nAdded Psuedo : ' + requestedExtArr[p] + tgtPsuedo);
          }
          /*DEBUG*/ appendout('./test/errout.txt', '\nSaving fufilled [' + tgtSaved[n] + ']');
          if (!fufilledExtends) {
            fufilledExtends = [ (tgtSaved[n]) ];
          } else {
            fufilledExtends.push(tgtSaved[n]);
          }
        }
      }
      /*DEBUG*/ appendout('./test/errout.txt', '\nStart uniqreq2 :\n' + tgtAccumulate);
      //Kill off duplicate selectors
      tgtAccumulate = uniqreq(tgtAccumulate).toString().replace(/,/g, ',\n');
      /*DEBUG*/ appendout('./test/errout.txt', '\nPost uniqreq2 :\n' + tgtAccumulate);
      targetRule.selector = tgtAccumulate;
    });

    for (var selector in requestedExtends) {
      if (requestedExtends.hasOwnProperty(selector) &&
          fufilledExtends.indexOf(selector) === -1) {
        result.warn('`' + selector + '`, has not been defined, so cannot be extended');
        /*DEBUG*/ appendout('./test/errout.txt', '\n' + selector + ' has not been defined!!!');
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
      definition.selector = '@define-placeholder ' + atRule.params.toString();
      atRule.parent.insertBefore(atRule, definition);
      atRule.removeSelf();
    }

    function processExtension(atRule) {
      if (!isBadExtensionLocation(atRule)) {
        var selectorsToAdd = atRule.parent.selectors;
        //assume find-behavior for extend if no Placeholder is availible
        /*DEBUG*/ appendout('./test/errout.txt', '\nRunning find-behavior');
        if (!requestedExtends[atRule.params]) {
          requestedExtends[atRule.params] = selectorsToAdd;
        } else if (requestedExtends[atRule.params].indexOf(selectorsToAdd) === -1) {
          requestedExtends[atRule.params].push.apply(requestedExtends[atRule.params], selectorsToAdd);
        }
        /*DEBUG*/ appendout('./test/errout.txt', '\nrequestExt: ' + atRule.params + ' : ' +
          selectorsToAdd + '\ncreated: ' + requestedExtends[atRule.params]);
      }
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

    function uniqreq(a) {
      var seen = {};
      return a.filter(function(item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
      });
    }
  };
});

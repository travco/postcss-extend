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
    css.eachRule(function(targetNode) {
      var tgtSaved = targetNode.selectors;
      //Strip all @define-placeholders and save slug-selectors into tgtSaved
      for (var i = tgtSaved.length - 1; i >= 0; i--) {
        if (tgtSaved[i].substring(0, 20) === '@define-placeholder ') {
          /*DEBUG*/ appendout('./test/debugout.txt', '\nn[' + i + ']String = ' + tgtSaved[i] + ' Substring 0-20 = \'' + tgtSaved[i].substring(0, 20) + '\'');
          tgtSaved[i] = tgtSaved[i].substring(20, (tgtSaved[i].length));
          /*DEBUG*/ appendout('./test/debugout.txt', '\nresString = \'' + tgtSaved[i] + '\'');
        }
      }
      var tgtAccumulate = [];
      for (var n = tgtSaved.length - 1; n >= 0; n--) {

        //Selectively disclude slugs from final accumulation for placeholders and silent classes
        if (targetNode.selectors.indexOf('@define-placeholder ' + tgtSaved[n]) === -1 &&
          tgtSaved[n].charAt(0) !== '%') {
          if (!tgtAccumulate) {
            tgtAccumulate = [ (tgtSaved[n]) ];
          } else {
            tgtAccumulate.push(tgtSaved[n]);
          }
        } /*DEBUG*/ else {
          /*DEBUG*/ appendout('./test/debugout.txt', '\nSifted out placeholder/silent ' + tgtSaved[n]);
        /*DEBUG*/ }

        // Operate on normal extendables
        if (requestedExtends[tgtSaved[n]]) { // && targetNode.parent.type === 'root'
          /*DEBUG*/ appendout('./test/debugout.txt', '\nrequestedExtends[' + tgtSaved[n] + '] : ' + requestedExtends[tgtSaved[n]]);

          tgtAccumulate.push.apply(tgtAccumulate, requestedExtends[tgtSaved[n]]);
          /*DEBUG*/ appendout('./test/debugout.txt', '\nCombined selectors :\n' + tgtAccumulate);
          /*DEBUG*/ appendout('./test/debugout.txt', '\nSaving fufilled [' + tgtSaved[n] + ']');
          if (!fufilledExtends) {
            fufilledExtends = [ (tgtSaved[n]) ];
          } else {
            fufilledExtends.push(tgtSaved[n]);
          }
        }
        //Operate on psuedo-elements of extendables (thus extending them)
        if (tgtSaved[n].indexOf(':') !== -1 && requestedExtends[ tgtSaved[n].substring(0, tgtSaved[n].indexOf(':')) ]) { // && targetNode.parent.type === 'root'

          var tgtBase = tgtSaved[n].substring(0, tgtSaved[n].indexOf(':'));
          var tgtPsuedo = tgtSaved[n].substring(tgtSaved[n].indexOf(':'), tgtSaved[n].length);
          var requestedExtArr = requestedExtends[tgtBase].toString().split(',');
          /*DEBUG*/ appendout('./test/debugout.txt', '\nrequestedExtends[' + tgtSaved[n].substring(0, tgtSaved[n].indexOf(':')) + '] :\n' + tgtBase);

          tgtAccumulate.push.apply(tgtAccumulate, formPsuedoSelector(requestedExtArr, tgtPsuedo));
          /*DEBUG*/ appendout('./test/debugout.txt', '\nSaving fufilled [' + tgtSaved[n] + ']');
          if (!fufilledExtends) {
            fufilledExtends = [ (tgtSaved[n]) ];
          } else {
            fufilledExtends.push(tgtSaved[n]);
          }
        }//END OF psuedo root-extentions
      }
      /*DEBUG*/ appendout('./test/debugout.txt', '\nStart uniqreq2 :\n' + tgtAccumulate);
      //Kill off duplicate selectors
      tgtAccumulate = uniqreq(tgtAccumulate).toString().replace(/,/g, ', ');
      /*DEBUG*/ appendout('./test/debugout.txt', '\nPost uniqreq2 :\n' + tgtAccumulate);
      targetNode.selector = tgtAccumulate;
    });

    for (var selector in requestedExtends) {
      if (requestedExtends.hasOwnProperty(selector) &&
          fufilledExtends.indexOf(selector) === -1) {
        result.warn('`' + selector + '`, has not been defined, so cannot be extended');
        /*DEBUG*/ appendout('./test/debugout.txt', '\n' + selector + ' has not been defined!!!');
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
        if (!hasMediaAncestor(atRule)) {
          //Work by adding our rule's selectors to be (later) added to the extended rule
          var selectorsToAdd = atRule.parent.selectors;
          /*DEBUG*/ appendout('./test/debugout.txt', '\nRunning find-behavior');
          if (!requestedExtends[atRule.params]) {
            requestedExtends[atRule.params] = selectorsToAdd;
          } else {
            requestedExtends[atRule.params].push.apply(requestedExtends[atRule.params], selectorsToAdd);
          }
          /*DEBUG*/ appendout('./test/debugout.txt', '\nrequestExt: ' + atRule.params + ' : ' + selectorsToAdd + '\ncreated: ' + requestedExtends[atRule.params]);
        } else {
          //Work by copying the declarations of our target rule
          /*DEBUG*/ appendout('./test/debugout.txt', '\nAttempting to fetch declarations for ' + atRule.params + '...');
          var psuedoFound;
          var psuedoTarget = {
            node: {},
            bool: false
          };
          var selectorRetainer;
          css.eachRule(function(targetNode) {
            if (targetNode.selectors.indexOf(atRule.params) !== -1) {
              if (targetNode.parent === atRule.parent.parent) {
                /*DEBUG*/ appendout('./test/debugout.txt', '\n...tacking onto targetNode :\n' + targetNode);
                selectorRetainer = targetNode.selector;
                targetNode.selector = selectorRetainer + ', ' + atRule.parent.selectors.join(', ');
              } else {
                /*DEBUG*/ appendout('./test/debugout.txt', '\n...grabbing targetNode :\n' + targetNode);
                safeCopyDeclarations(targetNode, atRule.parent);
              }
            }
            //Pull from psuedo-elements of target nodes (thus extending them)
            psuedoFound = false;
            psuedoTarget.bool = false;

            for (var n = targetNode.selectors.length - 1; n >= 0 && !psuedoFound; n--) {
              var tgtBase = targetNode.selectors[n].substring(0, targetNode.selectors[n].indexOf(':'));
              var tgtPsuedo = targetNode.selectors[n].substring(targetNode.selectors[n].indexOf(':'), targetNode.selectors[n].length);
              if (targetNode.selectors[n].indexOf(':') !== -1 && tgtBase === atRule.params) { // && targetNode.parent.type === 'root'
                psuedoFound = true;
                //check for prexisting psuedo classes before making one
                psuedoTarget = findBrotherPsuedoClass(atRule.parent, tgtPsuedo);
                if (psuedoTarget.bool) {
                  //utilize existing psuedoclass for extention
                  /*DEBUG*/ appendout('./test/debugout.txt', '\nUtilizing existing psuedoclass for extention:\n' + psuedoTarget);
                  safeCopyDeclarations(targetNode, psuedoTarget.node);
                } else if (targetNode.parent === atRule.parent.parent) {
                  /*DEBUG*/ appendout('./test/debugout.txt', '\nUtilizing existing brother psuedoclass for extention, as nothing matches: \n' + atRule.parent.selector + ' psuedo-' + tgtPsuedo);
                  selectorRetainer = targetNode.selector;
                  targetNode.selector = selectorRetainer + ', ' + formPsuedoSelector(atRule.parent.selectors, tgtPsuedo).join(', ');
                  //Use Tacking onto exiting selectors instead of new creation
                } else {
                  //create additional nodes below existing for each psuedoInstance
                  /*DEBUG*/ appendout('./test/debugout.txt', '\nUtilizing new psuedoclass for extention, as nothing matches: \n' + atRule.parent.selector + ' psuedo-' + tgtPsuedo);
                  var newNode = postcss.rule();
                  newNode.semicolon = atRule.semicolon;
                  safeCopyDeclarations(targetNode, newNode);
                  newNode.selector = formPsuedoSelector(atRule.parent.selectors, tgtPsuedo).join(', ');
                  atRule.parent.parent.insertAfter(atRule.parent, newNode);
                }
              }
            }
          });
          //end of each rule
        }
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
    }

    function hasMediaAncestor(node) {
      var parent = node.parent;
      if (parent.type === 'atrule' && parent.name === 'media') {
        return true;
      }
      if (parent.type !== 'root') {
        return hasMediaAncestor(parent);
      }
    }

    function uniqreq(a) {
      var seen = {};
      return a.filter(function(item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
      });
    }
    function safeCopyDeclarations(nodeOrigin, nodeDest) {
      nodeOrigin.nodes.forEach(function(node) {
        if (isBadDefinitionNode(node)) return;
        if (nodeDest.some(function(decl) { return decl.prop === node.prop; })) {
          /*DEBUG*/ appendout('./test/debugout.txt', '\nsafeIgnored : ' + node + ' for ' + nodeDest.selector);
          return;
        }
        /*DEBUG*/ appendout('./test/debugout.txt', '\nnodeDest Nodes:\n' + nodeDest.nodes);
        var clone = node.clone();
        //For lack of a better way to analyse how much tabbing is required:
        if (nodeOrigin.parent === nodeDest.parent) {
          clone.before = node.before;
        } else {
          clone.before = node.before + '\t';
        }
        clone.after = node.after;
        clone.between = node.between;
        nodeDest.append(clone);
      });
    }
    function formPsuedoSelector(selArr, tgtPsuedo) {
      var selectorRetainer = selArr;
      for (var i = selectorRetainer.length - 1; i >= 0; i--) {
        selectorRetainer[i] = selectorRetainer[i] + tgtPsuedo;
      }
      return selectorRetainer;
    }
    function findBrotherPsuedoClass(nodeOrigin, tgtPsuedo) {
      var foundNode = {};
      var foundBool = nodeOrigin.parent.some(function (node) {
        var seldiff = node.selectors;
        var selectorAccumulator = nodeOrigin.selectors;
        for (var x = selectorAccumulator.length - 1; x >= 0; x--) {
          selectorAccumulator[x] = selectorAccumulator[x] + tgtPsuedo;
        }
        if (node !== nodeOrigin && selectorAccumulator.length === node.selectors.length) {
          seldiff.push.apply(seldiff, selectorAccumulator);
          seldiff = uniqreq(seldiff);
          /*DEBUG*/ appendout('./test/debugout.txt', '\nseldiff : ' + seldiff + '\n\tBetween:\n' + node.selectors + '\n\tand:\n' + selectorAccumulator);
          if (seldiff.length === selectorAccumulator.length) {
            foundNode = node;
            return true;
          }
        }
      });
      return {
        node: foundNode,
        bool: foundBool
      };
    }
  };
});

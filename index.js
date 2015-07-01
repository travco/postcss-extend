'use strict';

var postcss = require('postcss');
/*DEBUG*/ var appendout = require('fs').appendFileSync;

module.exports = postcss.plugin('postcss-simple-extend', function simpleExtend() {

  return function(css, result) {
    var definingAtRules = ['define-placeholder', 'define-extend', 'simple-extend-define'];
    var extendingAtRules = ['extend', 'simple-extend', 'simple-extend-addto'];

    /*DEBUG*/ appendout('./test/debugout.txt', '\n----------------------------------------');

    css.eachAtRule(function(atRule) {
      if (definingAtRules.indexOf(atRule.name) !== -1) {
        processDefinition(atRule);
      } else if (extendingAtRules.indexOf(atRule.name) !== -1) {
        processExtension(atRule);
      }
    });

    // Selectively disclude silents and placeholders, find unused,
    // and exclude from the final output
    css.eachRule(function(targetNode) {
      var tgtSaved = targetNode.selectors;
      var selectorAccumulator;
      for (var i = 0; i < tgtSaved.length; i++) {
        if (tgtSaved[i].substring(0, 20) !== '@define-placeholder ' && tgtSaved[i].charAt(0) !== '%') {
          if (!selectorAccumulator) {
            selectorAccumulator = [ tgtSaved[i] ];
          } else {
            selectorAccumulator.push(tgtSaved[i]);
          }
        } else {
          if (tgtSaved.length === 1) {
            targetNode.removeSelf();
          }
          /*DEBUG*/ appendout('./test/debugout.txt', '\nSifted out placeholder/silent ' + tgtSaved[i]);
        }
      }
      if (selectorAccumulator) {
        targetNode.selector = selectorAccumulator.join(', ');
      }
    });
    //simplification process to find definitions in the future
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
      /*DEBUG*/ appendout('./test/debugout.txt', '\nDeclaring placeholder : ' + definition.selector);
      atRule.parent.insertBefore(atRule, definition);
      atRule.removeSelf();
    }

    function processExtension(atRule) {
      if (!isBadExtensionLocation(atRule)) {
        var originSels = atRule.parent.selectors;
        var selectorRetainer;
        var couldExtend = false;
        var pseudoTarget = {
          node: {},
          bool: false
        };

        if (!hasMediaAncestor(atRule)) {
          css.eachRule(function(targetNode) {
            var tgtSaved = targetNode.selectors;
            //Strip all @define-placeholders and save slug-selectors present in tgtSaved
            for (var i = 0; i < tgtSaved.length; i++) {
              if (tgtSaved[i].substring(0, 20) === '@define-placeholder ') {
                /*DEBUG*/ appendout('./test/debugout.txt', '\nn[' + i + ']String = ' + tgtSaved[i] + ' Substring 0-20 = \'' + tgtSaved[i].substring(0, 20) + '\'');
                tgtSaved[i] = tgtSaved[i].substring(20, (tgtSaved[i].length));
                /*DEBUG*/ appendout('./test/debugout.txt', '\nresString = \'' + tgtSaved[i] + '\'');
              }
            }
            var tgtAccumulate = targetNode.selectors;

            for (var n = 0; n < tgtSaved.length; n++) {

              //Add existing selector (that we're working with) to output list
              // if (!tgtAccumulate) {
              //   tgtAccumulate = [ targetNode.selectors[n] ];
              // } else {
              //   tgtAccumulate.push(targetNode.selectors[n]);
              // }
              // Operate on normal extendables
              if (atRule.params === tgtSaved[n]) {
                /*DEBUG*/ appendout('./test/debugout.txt', '\nfound and extending : ' + tgtSaved[n] + ' : ' + originSels);

                tgtAccumulate = tgtAccumulate.concat(originSels);
                /*DEBUG*/ appendout('./test/debugout.txt', '\nCombined selectors :\n' + tgtAccumulate);
                couldExtend = true;
                //Operate on pseudo-elements of extendables (thus extending them)
              } else if (tgtSaved[n].indexOf(':') !== -1) {
                var tgtBase = tgtSaved[n].substring(0, tgtSaved[n].indexOf(':'));
                var tgtPseudo = tgtSaved[n].substring(tgtSaved[n].indexOf(':'), tgtSaved[n].length);
                if (atRule.params === tgtBase) {
                  //check for prexisting pseudo classes before tacking
                  /*DEEP DEBUG*/ appendout('./test/debugout.txt', '\nCalling root-level findBrotherPseudoClass with :\n' + atRule.parent + ',\n' + tgtPseudo);
                  pseudoTarget = findBrotherPseudoClass(atRule.parent, tgtPseudo);
                  if (pseudoTarget.bool) {
                    //utilize existing pseudoclass for extention
                    /*DEBUG*/ appendout('./test/debugout.txt', '\nUtilizing existing pseudoclass for extention:\n' + pseudoTarget);
                    safeCopyDeclarations(targetNode, pseudoTarget.node);
                  } else {
                    //tack onto target node
                    /*DEBUG*/ appendout('./test/debugout.txt', '\nfound and extending : ' + tgtSaved[n].substring(0, tgtSaved[n].indexOf(':')) + ' :\n' + tgtBase + ' (' + tgtPseudo + ')');

                    /*DEBUG*/ appendout('./test/debugout.txt', '\nCalling formPseudoSelector with (\n' + originSels + ',\n' + tgtPseudo);
                    tgtAccumulate = tgtAccumulate.concat(formPseudoSelector(originSels, tgtPseudo));
                    /*DEBUG*/ appendout('./test/debugout.txt', '\nCombined selectors :\n' + tgtAccumulate);
                  }
                  couldExtend = true;
                }
              }//END OF pseudo root-extentions
            }
            if (couldExtend) {
              /*DEBUG*/ appendout('./test/debugout.txt', '\nStart uniqreq2 :\n' + tgtAccumulate);
              //Kill off duplicate selectors
              tgtAccumulate = uniqreq(tgtAccumulate).toString().replace(/,/g, ', ');
              /*DEBUG*/ appendout('./test/debugout.txt', '\nPost uniqreq2 :\n' + tgtAccumulate);
              targetNode.selector = tgtAccumulate;
            }
          });
        //hasMediaAncestor === true: ---------------
        } else {
          //Work by copying the declarations of our target rule
          /*DEBUG*/ appendout('./test/debugout.txt', '\nAttempting to fetch declarations for ' + atRule.params + '...');

          css.eachRule(function(targetNode) {
            if (targetNode.selectors.indexOf(atRule.params) !== -1) {
              if (targetNode.parent === atRule.parent.parent) {
                /*DEBUG*/ appendout('./test/debugout.txt', '\n...tacking onto targetNode :' + targetNode);
                selectorRetainer = targetNode.selector;
                targetNode.selector = selectorRetainer + ', ' + originSels.join(', ');
              } else {
                /*DEBUG*/ appendout('./test/debugout.txt', '\n...grabbing targetNode :\n' + targetNode);
                safeCopyDeclarations(targetNode, atRule.parent);
              }
              couldExtend = true;
            } else {
              //Pull from pseudo-elements of target nodes (thus extending them)
              for (var n = 0; n < targetNode.selectors.length; n++) {
                var tgtBase = targetNode.selectors[n].substring(0, targetNode.selectors[n].indexOf(':'));
                var tgtPseudo = targetNode.selectors[n].substring(targetNode.selectors[n].indexOf(':'), targetNode.selectors[n].length);
                if (targetNode.selectors[n].indexOf(':') !== -1 && tgtBase === atRule.params) {
                  //check for prexisting pseudo classes before making one
                  pseudoTarget = findBrotherPseudoClass(atRule.parent, tgtPseudo);
                  if (pseudoTarget.bool) {
                    //utilize existing pseudoclass for extention
                    /*DEBUG*/ appendout('./test/debugout.txt', '\nUtilizing existing pseudoclass for extention:\n' + pseudoTarget);
                    safeCopyDeclarations(targetNode, pseudoTarget.node);
                  } else if (targetNode.parent === atRule.parent.parent) {
                    //Use Tacking onto exiting selectors instead of new creation
                    /*DEBUG*/ appendout('./test/debugout.txt', '\nUtilizing existing brother pseudoclass for extention, as nothing matches: \n' + atRule.parent.selector + ' pseudo-' + tgtPseudo);
                    selectorRetainer = targetNode.selector;
                    targetNode.selector = selectorRetainer + ', ' + formPseudoSelector(originSels, tgtPseudo).join(', ');
                  } else {
                    //create additional nodes below existing for each instance of pseudos
                    /*DEBUG*/ appendout('./test/debugout.txt', '\nUtilizing new pseudoclass for extention, as nothing matches: \n' + atRule.parent.selector + ' pseudo-' + tgtPseudo);
                    var newNode = postcss.rule();
                    newNode.semicolon = atRule.semicolon;
                    safeCopyDeclarations(targetNode, newNode);
                    newNode.selector = formPseudoSelector(atRule.parent.selectors, tgtPseudo).join(', ');
                    atRule.parent.parent.insertAfter(atRule.parent, newNode);
                  }
                  couldExtend = true;
                }
              }
            }
          }); //end of each rule
        } //end of if hasMediaAncestor
        if (!couldExtend) {
          result.warn('\'' + atRule.params + '\', has not been defined, so cannot be extended');
          /*DEBUG*/ appendout('./test/debugout.txt', '\n\'' + atRule.params + '\' has not been defined!!!');
        }
      }
      if (!atRule.parent.nodes.length || (atRule.parent.nodes.length === 1 && atRule.parent.type !== 'root')) {
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
    function formPseudoSelector(selArr, tgtPseudo) {
      var selectorRetainer = selArr.slice();
      for (var i = 0; i < selectorRetainer.length; i++) {
        selectorRetainer[i] = selectorRetainer[i] + tgtPseudo;
      }
      return selectorRetainer;
    }
    function findBrotherPseudoClass(nodeOrigin, tgtPseudo) {
      var foundNode = {};
      var foundBool = nodeOrigin.parent.some(function (node) {
        if (node.selectors) {
          var seldiff = node.selectors;
          var selectorAccumulator = nodeOrigin.selectors;
          for (var x = 0; x < selectorAccumulator.length; x++) {
            selectorAccumulator[x] = selectorAccumulator[x] + tgtPseudo;
          }
          if (node !== nodeOrigin && selectorAccumulator.length === node.selectors.length) {
            seldiff = seldiff.concat(selectorAccumulator);
            seldiff = uniqreq(seldiff);
            /*DEBUG*/ appendout('./test/debugout.txt', '\nseldiff : ' + seldiff + '\n\tBetween:\n' + node.selectors + '\n\tand:\n' + selectorAccumulator);
            if (seldiff.length === selectorAccumulator.length) {
              foundNode = node;
              return true;
            }
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

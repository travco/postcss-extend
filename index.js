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
        } else if (tgtSaved.length === 1) {
          targetNode.removeSelf();
        /*DEBUG*/ } else {
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
      if (isBadExtension(atRule)) {
        if (!atRule.parent.nodes.length || (atRule.parent.nodes.length === 1 && atRule.parent.type !== 'root')) {
          atRule.parent.removeSelf();
        } else {
          atRule.removeSelf();
        }
        return;
      }
      var originSels = atRule.parent.selectors;
      var selectorRetainer;
      var couldExtend = false;
      var subTarget = {
        node: {},
        bool: false
      };
      var recursableRule = {
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
            // Operate on normal extendables
            if (atRule.params === tgtSaved[n]) {
              recursableRule = findUnresolvedExtendChild(targetNode);
              if (recursableRule.bool) {
                while (recursableRule.bool) {
                  /*DEBUG*/ appendout('./test/debugout.txt', '\nRecursing on: ' + recursableRule.node.parent + '\n^^^^^^^^^^^^^^');
                  processExtension(recursableRule.node);
                  recursableRule = findUnresolvedExtendChild(targetNode);
                }
                /*DEBUG*/ appendout('./test/debugout.txt', '\n!Bumping evaluation of :' + atRule.parent);
                // We need to re-evaluate the current atRule, as other classes (once passed over) may now be matching.
                // So we do a hasty-recall and exit (only happens with badly formed css)
                processExtension(atRule);
                return;
              }
              /*DEBUG*/ appendout('./test/debugout.txt', '\nfound and extending : ' + tgtSaved[n] + ' : ' + originSels);

              tgtAccumulate = tgtAccumulate.concat(originSels);
              /*DEBUG*/ appendout('./test/debugout.txt', '\nCombined selectors :\n' + tgtAccumulate);
              couldExtend = true;
              //Operate on sub-elements of extendables (thus extending them)
            } else if (tgtSaved[n].substring(1).search(/[\s.:#]/) + 1 !== -1) {
              var tgtBase = tgtSaved[n].substring(0, tgtSaved[n].substring(1).search(/[\s.:#]/) + 1);
              var tgtSub = tgtSaved[n].substring(tgtSaved[n].substring(1).search(/[\s.:#]/) + 1, tgtSaved[n].length);
              if (atRule.params === tgtBase) {
                //check if target rule has unresolved extentions, then extend them
                recursableRule = findUnresolvedExtendChild(targetNode);
                if (recursableRule.bool) {
                  while (recursableRule.bool) {
                    /*DEBUG*/ appendout('./test/debugout.txt', '\nRecursing on: ' + recursableRule.node.parent + '\n^^^^^^^^^^^^^^');
                    processExtension(recursableRule.node);
                    recursableRule = findUnresolvedExtendChild(targetNode);
                  }
                  /*DEBUG*/ appendout('./test/debugout.txt', '\n!Bumping evaluation of :' + atRule.parent);
                  // We need to re-evaluate the current atRule, as other classes (once passed over) may now be matching.
                  // So we do a hasty-recall and exit (only happens with badly formed css)
                  processExtension(atRule);
                  return;
                }
                //tack onto target node
                /*DEBUG*/ appendout('./test/debugout.txt', '\nfound and extending : ' + tgtSaved[n].substring(0, tgtSaved[n].substring(1).search(/[\s.:#]/) + 1) + ' :\n' + tgtBase + ' (' + tgtSub + ')');

                /*DEBUG*/ appendout('./test/debugout.txt', '\nCalling formSubSelector with (\n' + originSels + ',\n' + tgtSub);
                tgtAccumulate = tgtAccumulate.concat(formSubSelector(originSels, tgtSub));
                /*DEBUG*/ appendout('./test/debugout.txt', '\nCombined selectors :\n' + tgtAccumulate);
                couldExtend = true;
              }
            }//END OF sub root-extentions
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
        /*DEBUG*/ appendout('./test/debugout.txt', '\nAttempting to fetch declarations for ' + atRule.params + '...');
        var backFirstTargetNode;
        var targetNodeArray = [];
        css.eachRule(function(subRule) {
          //create a back-is-top stack so that we can efficiently operate on nodes in reverse
          //thus retaining priority when copying declarations if there are multiple matches
          if (!hasMediaAncestor(subRule) || subRule.parent === atRule.parent.parent) {
            targetNodeArray.push(subRule);
          } /*DEBUG*/ else {
            /*DEBUG*/ appendout('./test/debugout.txt', '\n\'' + atRule.params + '\' ignored possible target in another @media : \n' + subRule);
          /*DEBUG*/ }
        }); //end of each rule
        while (targetNodeArray.length > 0) {
          backFirstTargetNode = targetNodeArray.pop();
          if (backFirstTargetNode.selectors.indexOf(atRule.params) !== -1) {
            //check if rule has unresolved extentions, then extend them
            recursableRule = findUnresolvedExtendChild(backFirstTargetNode);
            if (recursableRule.bool) {
              while (recursableRule.bool) {
                /*DEBUG*/ appendout('./test/debugout.txt', '\nRecursing on: ' + recursableRule.node.parent + '\n^^^^^^^^^^^^^^');
                processExtension(recursableRule.node);
                recursableRule = findUnresolvedExtendChild(backFirstTargetNode);
              }
              /*DEBUG*/ appendout('./test/debugout.txt', '\n!Bumping evaluation of :' + atRule.parent);
              // We need to re-evaluate the current atRule, as other classes (once passed over) may now be matching.
              // So we do a hasty-recall and exit (only happens with badly formed css)
              processExtension(atRule);
              return;
            }
            //In scope, tack on selector to target rule
            if (backFirstTargetNode.parent === atRule.parent.parent) {
              /*DEBUG*/ appendout('./test/debugout.txt', '\n...tacking onto backFirstTargetNode :' + backFirstTargetNode);
              selectorRetainer = backFirstTargetNode.selector;
              backFirstTargetNode.selector = selectorRetainer + ', ' + originSels.join(', ');
            //Out of scope, direcly copy declarations
            } else {
              /*DEBUG*/ appendout('./test/debugout.txt', '\n...grabbing backFirstTargetNode :\n' + backFirstTargetNode);
              safeCopyDeclarations(backFirstTargetNode, atRule.parent);
            }
            couldExtend = true;
          } else {
            //Pull from sub-elements of target nodes (thus extending them)
            for (var m = 0; m < backFirstTargetNode.selectors.length; m++) {
              var extTgtBase = backFirstTargetNode.selectors[m].substring(0, backFirstTargetNode.selectors[m].substring(1).search(/[\s.:#]/) + 1);
              var extTgtSub = backFirstTargetNode.selectors[m].substring(backFirstTargetNode.selectors[m].substring(1).search(/[\s.:#]/) + 1, backFirstTargetNode.selectors[m].length);
              if (backFirstTargetNode.selectors[m].substring(1).search(/[\s.:#]/) + 1 !== -1 && extTgtBase === atRule.params) {
                //check if target rule has unresolved extentions, then extend them
                recursableRule = findUnresolvedExtendChild(backFirstTargetNode);
                if (recursableRule.bool) {
                  while (recursableRule.bool) {
                    /*DEBUG*/ appendout('./test/debugout.txt', '\nRecursing on: ' + recursableRule.node.parent + '\n^^^^^^^^^^^^^^');
                    processExtension(recursableRule.node);
                    recursableRule = findUnresolvedExtendChild(backFirstTargetNode);
                  }
                  /*DEBUG*/ appendout('./test/debugout.txt', '\n!Bumping evaluation of :' + atRule.parent);
                  // We need to re-evaluate the current atRule, as other classes (once passed over) may now be matching.
                  // So we do a hasty-recall and exit (only happens with badly formed css)
                  processExtension(atRule);
                  return;
                }
                if (backFirstTargetNode.parent === atRule.parent.parent) {
                  //Use Tacking onto exiting selectors instead of new creation
                  /*DEBUG*/ appendout('./test/debugout.txt', '\nUtilizing existing brother subclass for extention, as nothing matches: \n' + atRule.parent.selector + ' sub-' + extTgtSub);
                  selectorRetainer = backFirstTargetNode.selector;
                  backFirstTargetNode.selector = selectorRetainer + ', ' + formSubSelector(originSels, extTgtSub).join(', ');
                } else {
                  //check for prexisting sub classes before making one
                  subTarget = findBrotherSubClass(atRule.parent, extTgtSub);
                  if (subTarget.bool) {
                    //utilize existing subclass for extention
                    /*DEBUG*/ appendout('./test/debugout.txt', '\nUtilizing existing subclass for extention:\n' + subTarget);
                    safeCopyDeclarations(backFirstTargetNode, subTarget.node);
                  } else {
                    //create additional nodes below existing for each instance of subs
                    /*DEBUG*/ appendout('./test/debugout.txt', '\nUtilizing new subclass for extention, as nothing matches: \n' + atRule.parent.selector + ' sub-' + extTgtSub);
                    var newNode = postcss.rule();
                    newNode.semicolon = atRule.semicolon;
                    safeCopyDeclarations(backFirstTargetNode, newNode);
                    newNode.selector = formSubSelector(atRule.parent.selectors, extTgtSub).join(', ');
                    atRule.parent.parent.insertAfter(atRule.parent, newNode);
                  }
                }
                couldExtend = true;
              }
            }
          }
        }
      } //end of if hasMediaAncestor
      if (!couldExtend) {
        result.warn('\'' + atRule.params + '\', has not been defined, so cannot be extended');
        /*DEBUG*/ appendout('./test/debugout.txt', '\n\'' + atRule.params + '\' has not been defined!!!');
      }
      if (atRule.parent !== undefined) {
        if (!atRule.parent.nodes.length || atRule.parent.nodes.length === 1) {
          atRule.parent.removeSelf();
        } else {
          atRule.removeSelf();
        }
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

    function isBadExtension(atRule) {
      /*DEEPDEBUG*/ appendout('./test/debugout.txt', '\nisBadExtension -- atRule.parent : ' + atRule.parent + '\nparent.selectors : ' + atRule.parent.selectors);

      if (atRule === undefined) {
        result.warn('Extending at-rules need a target', { node: atRule });
        return true;
      }
      if (atRule.parent.type === 'root') {
        result.warn('Extending at-rules cannot occur at the root level', { node: atRule });
        return true;
      }
      if (atRule.parent.selector === undefined || atRule.parent.selector === '') {
        if (atRule.parent.name === 'define-placeholder') {
          result.warn('Extending at-rules cannot occur within @define statements, only within `%` silent classes', { node: atRule });
          /*DEEPDEBUG*/ appendout('./test/debugout.txt', '\nExtending at-rules cannot occur within @define statements, only within `%` silent classes');
        } else {
          result.warn('Extending at-rules cannot occur within unnamed rules', { node: atRule });
          /*DEEPDEBUG*/ appendout('./test/debugout.txt', '\nExtending at-rules cannot occur within unnamed rules');
        }
        return true;
      }
      if (atRule.params === '' || atRule.params.search(/\s*/) !== 0) {
        result.warn('Extending at-rules need a target', { node: atRule });
        return true;
      }
    }

    function hasMediaAncestor(node) {
      var parent = node.parent;
      if (parent === undefined) {
        return false;
      }
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

    function formSubSelector(selArr, tgtSub) {
      var selectorRetainer = selArr.slice();
      for (var i = 0; i < selectorRetainer.length; i++) {
        selectorRetainer[i] = selectorRetainer[i] + tgtSub;
      }
      return selectorRetainer;
    }

    function findUnresolvedExtendChild(nodeOrigin) {
      var foundNode = {};
      var foundBool = nodeOrigin.some(function (node) {
        if (node.type === 'atrule' && extendingAtRules.indexOf(node.name) !== -1) {
          foundNode = node;
          return true;
        }
      });
      return {
        node: foundNode,
        bool: foundBool
      };
    }

    function findBrotherSubClass(nodeOrigin, tgtSub) {
      var foundNode = {};
      var foundBool = nodeOrigin.parent.some(function (node) {
        if (node.selectors) {
          var seldiff = node.selectors;
          var selectorAccumulator = nodeOrigin.selectors;
          for (var x = 0; x < selectorAccumulator.length; x++) {
            selectorAccumulator[x] = selectorAccumulator[x] + tgtSub;
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

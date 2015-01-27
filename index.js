'use strict';

var postcss = require('postcss');

function simpleExtend() {

  return function(css) {
    var DEFINING_AT_RULE = 'simple-extend-define';
    var ADDING_AT_RULE = 'simple-extend-addto';
    var availableExtendables = {};

    css.eachAtRule(function(atRule) {
      if (atRule.name === DEFINING_AT_RULE) {
        checkDefinitionLocation(atRule);
        processDefinition(atRule);
      } else if (atRule.name === ADDING_AT_RULE) {
        checkAdditionLocation(atRule);
        processAddition(atRule);
      }
    });

    function processDefinition(atRule) {
      var extendableInstance = postcss.rule();

      // Manually copy styling properties (semicolon, whitespace)
      // to newly created and cloned nodes,
      // cf. https://github.com/postcss/postcss/issues/85
      extendableInstance.semicolon = atRule.semicolon;
      atRule.nodes.forEach(function(node) {
        var declOrComment = checkDefinitionNode(node);
        var clone = declOrComment.clone();
        clone.before = declOrComment.before;
        clone.after = declOrComment.after;
        clone.between = declOrComment.between;
        extendableInstance.append(clone);
      });

      atRule.parent.insertBefore(atRule, extendableInstance);
      availableExtendables[atRule.params] = extendableInstance;
      atRule.removeSelf();
    }

    function processAddition(atRule) {
      var targetExt = getExtendable(atRule.params, atRule);
      var selectorToAdd = atRule.parent.selector;
      targetExt.selector = (targetExt.selector)
        ? targetExt.selector + ',\n' + selectorToAdd
        : selectorToAdd;
      atRule.removeSelf();
    }

    function checkDefinitionNode(node) {
      if (node.type === 'rule' || node.type === 'atrule') {
        throw node.error(
          '@' + DEFINING_AT_RULE + ' cannot contain statements'
        );
      }
      return node;
    }

    function getExtendable(extIdent, node) {
      var targetExt = availableExtendables[extIdent];
      if (!targetExt) {
        throw node.error(
          'Attempted to @' + ADDING_AT_RULE + ' `' + extIdent + '`, ' +
          'which is not (yet) defined'
        );
      }
      return targetExt;
    }

    function checkDefinitionLocation(atRule) {
      if (atRule.parent.type !== 'root') {
        throw atRule.error(
          '@' + DEFINING_AT_RULE + ' must occur at the root level'
        );
      }
    }

    function checkAdditionLocation(atRule) {
      if (atRule.parent.type === 'root') {
        throw atRule.error(
          '@' + ADDING_AT_RULE + ' cannot occur at the root level'
        );
      }

      checkForMediaAncestor(atRule);

      function checkForMediaAncestor(node) {
        var parent = node.parent;
        if (parent.type === 'atrule' && parent.name === 'media') {
          throw atRule.error(
            '@' + ADDING_AT_RULE + ' cannot occur inside a @media statement'
          );
        }
        if (parent.type !== 'root') {
          checkForMediaAncestor(parent);
        }
      }
    }

    return css;
  };
}

simpleExtend.postcss = simpleExtend();

module.exports = simpleExtend;

'use strict';

var postcss = require('postcss');

module.exports = postcss.plugin('postcss-simple-extend', function simpleExtend() {

  return function(css, result) {
    var definingAtRules = ['define-placeholder', 'define-extend', 'simple-extend-define'];
    var extending = ['extend', 'simple-extend-addto'];
    var availablePlaceholders = {};

    css.eachAtRule(function(atRule) {
      if (definingAtRules.indexOf(atRule.name) !== -1) {
        if (isBadDefinitionLocation(atRule)) return;
        processDefinition(atRule);
      } else if (extending.indexOf(atRule.name) !== -1) {
        if (isBadAdditionLocation(atRule)) return;
        processAddition(atRule);
      }
    });

    function processDefinition(atRule) {
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

    function processAddition(atRule) {
      var targetExt = getExtendable(atRule.params, atRule);
      if (!targetExt) return;
      var selectorToAdd = atRule.parent.selector;
      targetExt.selector = (targetExt.selector)
        ? targetExt.selector + ',\n' + selectorToAdd
        : selectorToAdd;
      atRule.removeSelf();
    }

    function isBadDefinitionNode(node) {
      if (node.type === 'rule' || node.type === 'atrule') {
        result.warn('Defining at-rules cannot contain statements', { node: node });
        return true;
      }
    }

    function getExtendable(extIdent, node) {
      var targetExt = availablePlaceholders[extIdent];
      if (!targetExt) {
        result.warn('`' + extIdent + '`, has not (yet) defined, so cannot be extended', { node: node });
      }
      return targetExt;
    }

    function isBadDefinitionLocation(atRule) {
      if (atRule.parent.type !== 'root') {
        result.warn('Defining at-rules must occur at the root level', { node: atRule });
        return true;
      }
    }

    function isBadAdditionLocation(atRule) {
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
          hasMediaAncestor(parent);
        }
      }
    }
  };
});

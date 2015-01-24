[![Build Status](https://travis-ci.org/davidtheclark/postcss-simple-extend.svg?branch=master)](https://travis-ci.org/davidtheclark/postcss-simple-extend)

# postcss-simple-extend

A [PostCSS](https://github.com/postcss/postcss) plugin to enable *simple* extends in CSS.

(simple = no extending of real rule sets, only abstract ones --- much like Sass placeholders)

Use this plugin to **define an abstract, extendable rule set, to which you can, later on, add concrete selectors from other rule sets.**

*This plugin is compatible with PostCSS v4+.*

> **A Note on mixins & extends**: Mixins copy declarations from an abstract definition into a concrete rule set. Extends clone a concrete rule set's selector(s) and add them an extendable rule set that you have defined. *This* plugin enables simple extends. If you would like to use mixins, as well --- or instead --- have a look at [`postcss-simple-mixin`](https://github.com/davidtheclark/postcss-simple-mixin).

## Example Input-Output

Input:
```css
@simple-extend-define gigantic {
  font-size: 40em;
}

.foo {
  @simple-extend-addto gigantic;
  color: red;
}

.bar {
  @simple-extend-addto gigantic;
  color: orange;
}
```

Output:
```css
.foo,
.bar {
  font-size: 40em;
}

.foo {
  color: red;
}

.bar {
  color: orange;
}
```

## Usage

### Define an Abstract, Extendable Rule Set

With `@simple-extend-define`, you define the abstract, extendable rule set that you will later add selectors to. This rule set has no concrete selectors of its own.

```css
@simple-extend-define simple-list {
  list-style-type: none;
  margin: 0;
  padding: 0;
}
```

`@simple-extend-define` statements will be removed entirely from the generated CSS, replaced by a concrete rule set with the selectors you've added via `@simple-extend-addto` (see example above).

Some defining guidelines to obey (violations should throw errors):
- Definitions must occur at the root level (i.e. not inside statements, such as rule sets or `@media` statements).
- Definitions should only contain declarations and comments: no statements.

### Extend an Extendable --- Add Selectors To It

Use the at-rule `@simple-extend-addto` within a rule set to add that rule set's selector(s) to an extendable, which was defined via `@simple-extend-define`.

```css
.list-i-want-to-be-simple {
  @simple-extend-addto simple-list;
  font-size: 40em;
}
```

Some `addto` guidelines to obey (violations should throw errors):
- `addto` must *not* occur at the root level: only inside rule sets.
- `addto` must *not* occur within `@media` statements. (The generated code almost certainly would not match your intention.)
- The extendable must be defined *before* `@simple-extend-addto` can refer to it.

### Plug it in to PostCSS

Plug it in just like any other PostCSS plugin. There are no frills and no options, so integration should be straightforward. For example (as a node script):

```js
var fs = require('fs');
var postcss = require('postcss');
var simpleExtend = require('postcss-simple-extend');

var inputCss = fs.readFileSync('input.css', 'utf8');

var outputCss = postcss()
  .use(simpleExtend)
  .process(inputCss)
  .css;

console.log(outputCss);
```

Or take advantage of [any of the myriad other ways to consume PostCSS](https://github.com/postcss/postcss#usage), and follow the plugin instructions they provide.


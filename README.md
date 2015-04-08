# postcss-simple-extend [![Build Status](https://travis-ci.org/davidtheclark/postcss-simple-extend.svg?branch=master)](https://travis-ci.org/davidtheclark/postcss-simple-extend)

**A [PostCSS](https://github.com/postcss/postcss) plugin that enables you to extend placeholder selectors in CSS.**

Use this plugin to define a rule set with an abstract, extendable selector — a "placeholder selector" — to which you can, later on, add concrete selectors from other rule sets.

The functionality should mirror Sass's `@extend` with `%` placeholders (a.k.a. "silent classes").
Unlike Sass's `@extend`, however, *this plugin does not enable you to extend real selectors*: i.e. you cannot `@extend .classname` or `@extend ul > li + li > span a`.
That key difference makes this plugin *much* more simple, and therefore much less dangerous.
Many of the concerns people have with Sass's `@extend`, the problems that can arise from its use, simply do not apply to this, more *simple* version. Smart Sass users often recommend to only ever `@extend` placeholders (cf. [Harry Robert]((http://csswizardry.com/2014/01/extending-silent-classes-in-sass/) and [Hugo Giraudel](http://sass-guidelin.es/#extend)): *with this plugin, that recommendation is enforced*.

**`postcss-simple-extend` is compatible with PostCSS v4.1+.**

> **A Note on "mixins" & "extends"**: Mixins copy declarations from an abstract definition into a concrete rule set. Extends clone a concrete rule set's selector(s) and add them to an abstract placeholder selector. *This* plugin enables extends. If you would like to use mixins, as well — or instead — have a look at [`postcss-mixins`](https://github.com/postcss/postcss-mixins).

## Installation

```
npm install postcss-simple-extend --save
```

## Example Input-Output

Input:
```css
@define-placeholder gigantic {
  font-size: 40em;
}

.foo {
  @extend gigantic;
  color: red;
}

.bar {
  @extend gigantic;
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

### Define Your Placeholder

With `@define-placeholder`, you associate a rule set with a placeholder selector, which you will later extend with concrete selectors.

You can also use `@define-extend` or `@simple-extend-define`, if either of those better fits your mind and situation.

```css
@define-placeholder simple-list {
  list-style-type: none;
  margin: 0;
  padding: 0;
}
/* or @define-extend simple list {...} */
/* or @simple-extend-define list {...} */
```

`@define-placeholder` at-rules, and the placeholder names (e.g. `simple-list`, above), will be removed entirely from the generated CSS, replaced by the selectors you've added via `@extend` (see example above).

There are some defining guidelines to obey (violations should log warnings):
- Definitions must occur at the root level (i.e. not inside statements, such as rule sets or `@media` statements).
- Definitions should only contain declarations and comments: no statements.

### Extend a Placeholder (Add Selectors to It)

Use the at-rule `@extend` within a rule set to add that rule set's selector(s) to a placeholder (which was defined via `@define-placeholder`).

You can also use `@simple-extend-addto`, if that better fits your mind and situation.

```css
.list-i-want-to-be-simple {
  @extend simple-list;
  /* or @simple-extend-addto simple-list; */
  font-size: 40em;
}
```

And there are some `@extend` guidelines to obey (violations should log warnings):
- `@extend` must *not* occur at the root level: only inside rule sets.
- `@extend` must *not* occur within `@media` statements. (The generated code almost certainly would not match your intention.)
- The placeholder must be defined *before* `@extend` can refer to it.

### Plug it in to PostCSS

Plug it in just like any other PostCSS plugin. There are no frills and no options, so integration should be straightforward. For example (as a node script):

```js
var fs = require('fs');
var postcss = require('postcss');
var simpleExtend = require('postcss-simple-extend');

var inputCss = fs.readFileSync('input.css', 'utf8');

var outputCss = postcss()
  .use(simpleExtend())
  // or .use(simpleExtend)
  .process(inputCss)
  .css;

console.log(outputCss);
```

Or take advantage of [any of the myriad other ways to consume PostCSS](https://github.com/postcss/postcss#usage), and follow the plugin instructions they provide.

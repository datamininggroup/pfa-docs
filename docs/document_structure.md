---
layout: page
type: reference
title: Document structure
order: 10
noToc: true
---

<style>
table td {vertical-align: text-top}
</style>

## Format of a PFA document

A PFA document is a JSON document with additional constraints. The JSON content describes algorithms, data types, model parameters, and other aspects of the scoring engine. Some structures have no effect on the scoring procedure and are only intended for archival purposes.

The outermost structure of a PFA document is a JSON object, a collection of key-value pairs surrounded by curly brackets. We refer to these as the top-level fields: the field name (key) determines the allowed content (value). Some of those contents are recursively defined, so a PFA document may have arbitrary depth.

The following are all of the allowed top-level fields.

Name | Default | Constraints | Description
:----------|:--------|:------------|:-----------
`input` | _required_ | [Avro type](../avro_types) | Input data type. Input data that do not conform to this schema should be rejected before sending it to PFA.
`output` | _required_ | [Avro type](../avro_types) | Output data type. A valid PFA file will always produce data of this type (or an exception).
`begin` | `[]` | [expressions](#expressions) | Algorithm to be executed before evaluating any data. [See tutorial.](../tutorial3#begin-action-end)
`action` | _required_ | [expressions](#expressions) | Algorithm to be executed for each input datum. [See tutorial.](../tutorial3#begin-action-end)
`end` | `[]` | [expressions](#expressions) | Algorithm to be executed after evaluating all data (if such a time exists). [See tutorial.](../tutorial3#begin-action-end)
`fcns` | `{}` | JSON object of [functions](../special_forms/#function-definition-fcndef) | Named user-defined functions that can be called in any expression (including other functions).
`cells` | `{}` | JSON object of [cells](#cell-and-pool-structure) | Persistent storage containing model parameters, intermediate results, etc. [See tutorial.](../tutorial3#persistent-storage)
`pools` | `{}` | JSON object of [pools](#cell-and-pool-structure) | Like cells, but items can be created and destroyed at runtime and [concurrent access](../tutorial3#concurrent-access-of-shared-data) extends only to a pool item, not the entire pool. [See tutorial.](../tutorial3#persistent-storage)
`method` | `"map"` | `"map"`, `"emit"`, or `"fold"` | How results from the scoring engine will be served to the environment. [See tutorial.](../tutorial1#methods-of-output)
`zero` | _required_ when `method` is `"fold"` | JSON matching type `output` | The starting value for a `"fold"` tally. [See tutorial.](../tutorial1#fold)
`merge` | _required_ when `method` is `"fold"` | [expressions](#expressions) | Algorithm to combine two partial tallies.
`randseed` | _optional_ | integer | Global seed used to generate all random numbers. Multiple scoring engines derived from the same PFA file have different seeds generated from the global one.
`name` | _none_ | [name](#names) | An optional name for the scoring engine.
`version` | _optional_ | integer | Sequential version number for the model.
`doc` | _optional_ | string | Documentation string for archival purposes.
`metadata` | `{}` | JSON object of strings | Computer-readable documentation for archival purposes.
`options` | `{}` | JSON object; value types depend on option name | Initialization or runtime options to customize implementation (e.g. optimization switches). May be overridden or ignored by PFA consumer.

**Example 1:** The smallest possible PFA document (by number of bytes) is

    {"input":"int","output":"int","action":"input"}

It returns the integer you give it.

**Example 2:** The following example uses every kind of top-level field except `pools`, `zero`, and `merge` (which are similar to other fields and/or are only applicable to "fold" engines).

    {"input": "string",
     "output": {"type": "array", "items": "string"},
     "cells": {
       "accumulate": {"type": {"type": "array", "items": "string"},
                      "init": []}},
     "method": "map",
     "begin":
       {"log": {"rand.gaussian": [0.0, 1.0]}},
     "action":
       {"cell": "accumulate",
        "to": {"fcn": "u.addone", "fill": {"newitem": "input"}}},
     "end":
       {"log": {"rand.choice": {"cell": "accumulate"}}},
     "fcns":
       {"addone":
         {"params": [{"old": {"type": "array", "items": "string"}},
                     {"newitem": "string"}],
          "ret": {"type": "array", "items": "string"},
          "do": {"a.append": ["old", "newitem"]}}},
     "randseed": 12345,
     "name": "ExampleScoringEngine",
     "version": 1,
     "doc": "Doesn't do much.",
     "metadata": {"does": "notmuch"},
     "options": {"timeout": 1000}}

## Locator marks

Any JSON object in a PFA document may include `"@"` as a string-valued field. This string is used to provide a line number from the original source file so that errors can be traced back to their source. Consumers may read the PFA file progressively (interpreting it while reading it), so the `"@"` field is only useful if it comes _first_ in the JSON object.

**Example 3:** A function call with locator marks.

    {"@": "PrettyPFA line 1",
     "a.append": [
       {"@": "PrettyPFA line 2",
        "type": {"type": "array", "items": "string"},
        "value": []},
       {"@": "PrettyPFA line 3",
        "string": "mytext"}
     ]}

## Names

Following [Avro convention](http://avro.apache.org/docs/1.7.7/spec.html#Names), names of PFA identifiers

  * start with `[A-Za-z_]`
  * subsequently contain only `[A-Za-z0-9_]`

## Cell and pool structure

Cells and pools are both persistent storage, but cells are global variables that cannot be created or destroyed at runtime (only reassigned) and pools are like environments in R: collections of key-value pairs that can be created and destroyed at runtime, and the granularity of [concurrent access](../tutorial3#concurrent-access-of-shared-data) is at the level of a single pool item.

Cells and pools are both specified as JSON objects with the same fields, though `init` is required for cells and not for pools.

Name | Default | Constraints | Description
:----------|:--------|:------------|:-----------
`type` | _required_ | [Avro type](../avro_types) | The type of the value in the cell or the type of a single pool item.
`init` | _required_ for cells, `{}` for pools | JSON matching `type` or string | If `source` is `embedded`, the contents are the initial value of the cell or pool. Otherwise, the contents are a string URL pointing to a resource containing the initial value.
`shared` | `false` | boolean | If `true`, all scoring engines derived from this PFA file share a common, consistent value in the cell or pool.
`rollback` | `false` | boolean | If `true`, the value in the cell or pool reverts to the value it had at the beginning of an action when an action raises an exception. Incompatible with `shared`.
`source` | `"embedded"` | `"embedded"`, `"json"`, or `"avro"` | If `"embedded"`, the initial value is located within this PFA file (in `init`). Otherwise, `init` is a URL pointing to the data (including `"file://"` prefix for local files) with `"json"` or `"avro"` format.

**Example 4:** The following is repeated from example 2 above: a global variable that stores an array of strings. The initial value is `[]`, but it could also be `["one", "two", "three"]`.

    "cells": {"accumulate": {"type": {"type": "array", "items": "string"},
                             "init": []}}

**Example 5:** Pool types are implicitly maps--- the following maps a counter name to an integer. Counters can be created or destroyed at runtime.

    "pools": {"counters": {"type": "int", "shared": "true"}}

## Expressions

Expressions are the closest constructs PFA has to "code." They are evaluated in the context of predefined variables and most return a value.

There are four fundamental types of expressions:

   * **literal values** (constants)
   * **symbol references** (variables)
   * **special forms** (language constructs like `if` and `while`)
   * **function calls** (including operators like `+` and `-`)

Every top-level field that can take a single expression can take a JSON array of expressions--- the return value is the last expression in the array.

**Example 6:** All of the following return the number 3.

    3

    {"+": [2, 1]}

    {"+": [{"+": [1, 1]}, 1]}

    [{"let": {"x": 0}},
     {"set": {"x": {"+": ["x", 1]}}},
     {"set": {"x": {"+": ["x", 1]}}},
     {"x": {"+": ["x", 1]}}]

### Literal values

The following are all possible forms of literal values:

JSON form | Examples | Description
:---------|:---------|:--------
null | `null` | Only value of type "null".
boolean| `true`, `false` | Only values of type "boolean".
integer | `3`, `-3` | Easy way to express integers.
floating-point number | `3.0`, `-3.14`, `1e8` | Easy way to express double-precision numbers.
bracketed string | `["hello"]` | Easy way to express a string, but it can only be used in contexts where a JSON array of expressions is illegal (otherwise, `hello` would be interpreted as a variable name in a single-expression array).
singleton JSON object | `{"int":`&nbsp;`3}` | Explicit declaration of type.
 | `{"long":`&nbsp;`3}` |
 | `{"float":`&nbsp;`3}` |
 | `{"double":`&nbsp;`3}` |
 | `{"string":`&nbsp;`"hello"}` | More explicit than `["hello"]` and therefore less prone to error.
 | `{"base64":`&nbsp;`"aGVsbG8="}` | Base-64 may be a more convenient way to express binary sequences.
type-value special form | `{"type":`&nbsp;`"int",`&nbsp;`"value":`&nbsp;`3}` | Any [Avro type](../avro_types) can be used in the `"type"` field; works for arrays, maps, records, unions, etc.

The type-value special form may be used as an alternative to base-64 for binary sequences, since the JSON value of a [bytes type](../avro_types/#bytes-type) is a raw string:

    {"type": "bytes", "value": "hello"}

versus

    {"base64": "aGVsbG8="}

### Symbol references

A JSON string in a context where an expression is expected is always interpreted as a symbol reference.

**Example 7:** In the following, `"input"` is a variable and `"hello"` is a string.

    {"s.concat": ["input", {"string": "hello"}]}

or

    {"s.concat": ["input", ["hello"]]}

### Special forms

Special forms are JSON objects with specified structure. Each special form is unique: see the [special forms](../special_forms) page for details.

### Function calls

Function calls have the following forms for zero arguments, one argument, and more than one arguments.

    {"function.name": []}

or

    {"function.name": "argument"}

or

    {"function.name": ["arg1", "arg2", "arg3"]}

Library functions are built into PFA and user-defined functions are declared in the `fcns` section of a PFA document. See the [function library](../library) for a list of all predefined functions.

In the `fcns` section, user-defined functions must be declared with [names](#names) that have no dots (`.`), but when they are called, they are always prepended by `u.` to avoid collisions with library functions.

**Example 8:** A function declared as

     "fcns":
       {"addone":
         {"params": [{"old": {"type": "array", "items": "string"}},
                     {"newitem": "string"}],
          "ret": {"type": "array", "items": "string"},
          "do": {"a.append": ["old", "newitem"]}}}

would be accessed as

    {"u.addone": ["oldarray", "newitem"]}

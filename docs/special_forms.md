---
layout: page
type: reference
title: Special forms
order: 30
noToc: true
---

<style>
table td {vertical-align: text-top}
</style>

## Overview

PFA has four types of [expressions](../document_structure/#expressions): literal values, symbol references, function calls, and special forms. Special forms could be thought of as function calls with irregular constraints on their arguments and return values. The analogy in ordinary programming languages would be keywords like `if` and `while`.

Special forms are all represented by JSON objects with one or more key-value pairs. Other than that, they are all unique.

## Forms that call functions

### Ordinary function call

The majority of functionality in PFA is provided through functions with regular parameter lists, signatures that can be described in terms of Avro types, wildcards, and function references. An ordinary function call has the following structure:

    {FUNCTION-NAME: [EXPR1, EXPR2, ...]}

where `FUNCTION-NAME` is the name of the function and `EXPR` are zero or more expressions. The number of expressions and their types are determined by the function's signature. User-defined functions always start with "`u.`" (even though they are declared in the "fcns" section without the "`u.`").

Ordinary function calls are expressions and always return an Avro-typed value, even if that value is `null`.

**Example:** The following illustrate zero-argument, one-argument, and multi-argument function calls.

    {"m.pi": []}

    {"m.exp": "x"}

    {"m.exp": ["x"]}

    {"m.special.nChooseK": ["n", "k"]}

### Call a user-defined function that is specified at runtime

Ordinary function calls fix the choice of function while a scoring engine is being built--- there is no ability to change it at runtime. This is good because a PFA file can be statically analyzed to determine which functions can be accessed from a given scope (used to exclude the possibility of deadlock in concurrent transactions, for instance), but there are cases when you want this flexibility.

For instance, when you describe a ruleset as a data structure, you might want to associate actions with each rule in the data structure (e.g. in a cell's `"init"`) rather than in the code (e.g. in an if-then block in the code). The actions are defined as named functions in the "fcns" section, but we need to pick the function to run at runtime.

The following structure provides that ability:

    {"call": ENUM-EXPRESSION, "args": [EXPR1, EXPR2, ...]}

The `ENUM-EXPRESSION` is an expression that evaluates to an enumeration type whose symbols are all names of user-defined functions (without the "`u.`" prefix). The `EXPR` expressions are all supplied arguments.

The set of user-defined functions that could be called must all have signatures that accept the arguments: they must be drop-in replacements for one another. When the static analysis encounters this structure, it reports that any of the user-defined functions in the set could be called.

**Example:** Here is a PFA document that shows a complete example of a model that performs different actions based on the closest cluster. The important point is that the choice of action is bundled in the model parameters.

    {"input": {"type": "array", "items": "double"},
     "output": "double",
     "cells": {
       "clusters": {
         "type": {"type": "array", "items":
           {"type": "record",
            "name": "Rule",
            "fields": [
              {"name": "center", "type":
                {"type": "array", "items": "double"}},
              {"name": "act", "type":
                {"type": "enum",
                 "name": "Action",
                 "symbols": ["add", "sub", "mul", "div"]}},
              {"name": "param", "type": "double"}
             ]}},
         "init": [
           {"center": [0, 0, 0], "act": "add", "param": 1.0},
           {"center": [1, 0, 0], "act": "add", "param": 2.0},
           {"center": [0, 1, 0], "act": "sub", "param": 3.0},
           {"center": [0, 0, 1], "act": "sub", "param": 4.0},
           {"center": [1, 1, 0], "act": "mul", "param": 5.0},
           {"center": [1, 0, 1], "act": "mul", "param": 6.0},
           {"center": [0, 1, 1], "act": "div", "param": 7.0},
           {"center": [1, 1, 1], "act": "div", "param": 8.0}
         ]}},
     "action": [
       {"let": {
          "x": {"attr": "input", "path": [0]},
          "c": {"model.cluster.closest":
                  ["input", {"cell": "clusters"}]}}},
       {"call": "c.act", "args": ["x", "c.param"]}
     ],
     "fcns": {
       "add": {"params": [{"x": "double"}, {"y": "double"}],
               "ret": "double",
               "do": {"+": ["x", "y"]}},
       "sub": {"params": [{"x": "double"}, {"y": "double"}],
               "ret": "double",
               "do": {"-": ["x", "y"]}},
       "mul": {"params": [{"x": "double"}, {"y": "double"}],
               "ret": "double",
               "do": {"*": ["x", "y"]}},
       "div": {"params": [{"x": "double"}, {"y": "double"}],
               "ret": "double",
               "do": {"/": ["x", "y"]}}}
     }

## Special forms that provide function references (not expressions)

### Function definition (fcndef)

Functions may be defined and given names in the ["fcns" top-level field](../document_structure) and they may be defined without names within the argument list of some library functions and special forms. Technically, a function definition is not an expression because it does not return an Avro-typed value. A function cannot be defined and assigned to a variable, but it can be defined and passed to a generic algorithm that takes a callback.

The structure of a function definition is

    {"params": [{ARG1: TYPE1}, {ARG2: TYPE2}, ...],
     "ret": RETURN-TYPE,
     "do": EXPRESSION-OR-EXPRESSIONS}

The `"params"` can have any number of parameters, including zero. Each `ARG` is a string defining a variable that can be used in the `"do"` expressions. The `RETURN-TYPE` must be an [Avro type](../avro_types), though `"null"` can be used if the function doesn't return anything useful. `EXPRESSION-OR-EXPRESSIONS` may be a single [expression](../document_structure/#expressions) or a JSON array of them.

**Example:** The following computes an absolute difference:

    {"params": [{"x": "double"}, {"y": "double"}],
     "ret": "double",
     "do": {"m.abs": {"-": ["x", "y"]}}}

which could be passed as an argument to the [a.zipmap function](../library/#fcn:a.zipmap), for instance.

When used to create anonymous functions, those functions can access but not modify variables in the containing scope ([captured by value](http://en.wikipedia.org/wiki/Closure_(computer_programming))).

### Function reference (fcnref)

Named user-defined functions and library functions can be referenced in the argument list of some library functions and special forms. Technically, a function reference is not an expression because it does not return an Avro-typed value. A function cannot be assigned to a variable, but it can be passed to a generic algorithm that takes a callback.

The structure of a function reference is

    {"fcn": FUNCTION-NAME}

where `FUNCTION-NAME` is a string naming the function. User-defined functions always start with "`u.`" (even though they are declared in the "fcns" section without the "`u.`").

Library functions can only be referenced if they have exactly one signature and no wildcards. For instance, [s.len](../library/#fcn:s.len) can be referenced because its only signature takes one `"string"` argument, but [a.len](../library/#fcn:a.len) cannot because its signature takes an array of any `A` (array of strings, array of integers, array of records, etc.). A function reference must resolve the function's signature to a fixed sequence of Avro types.

**Example:** The following references `"s.len"`, which returns the length of a string.

    {"fcn": "s.len"}

Below is an example of wrapping `"a.len"` with a user-defined function so that it returns the length of an array of numbers.

    {"params": ["x": {"type": "array", "items": "double"}]
     "ret": "int",
     "do": {"a.len": "x"}}

The wrapped form can be used anywhere that a direct function reference can be used.

### Function reference with partial application (fcnref-fill)

Function references can also reduce the number of arguments in the function by [partially applying](http://en.wikipedia.org/wiki/Partial_application) some of the arguments.

The structure of a partially applied function reference is

    {"fcn": FUNCTION-NAME, "fill": {ARG1: EXPR1, ARG2: EXPR2, ...}}

where `FUNCTION-NAME` is a string naming the function and the `ARG` keys are a subset of the function's parameter names. The expressions `EXPR` provide values.

**Example:** To turn the two-argument [m.special.nChooseK](../library/#fcn:m.special.nChooseK) function into a one-argument function reference that computes 100 choose `k`, we can reference it like this:

    {"fcn": "m.special.nChooseK", "fill": {"n": 100}}

## Creating complex objects

Simple values, like numbers and booleans, can be [inserted directly into PFA](../document_structure/#literal-values) as JSON numbers and booleans. Strings require annotation to be distinguished from variable names. Complex objects, such as arrays, maps, records, enumeration symbols, etc., additionally require a type specification. Even an empty array has an `"items"` data type to specify what _could_ be inserted into the array.

PFA has a general mechanism for making any type of object from embedded JSON whose value is known at "compile-time" (when the scoring engine is constructed). However, that does not allow you to create arrays, maps, or records from variables, so a second special form exists for that case.

When constructing an array, map, or record whose value can be specified at compile-time, the embedded JSON method is preferable because more optimizations are possible (such as constructing exactly one copy of the object and referencing it). Common examples of this are empty arrays, empty maps, and initial value records.

### Creating compile-time constants from embedded JSON (type-value)

To make any type of object from embedded JSON, use the following structure:

    {"type": TYPE, "value": JSON-VALUE}

where `TYPE` is an [Avro type](../avro_types) and `JSON-VALUE` is a JSON representation of the object. This `JSON-VALUE` is not an [expression](../document_structure/#expressions), so variables and function calls can never appear in it.

**Example:** The following example illustrates the difference between this form and the "new" special form (below).

    {"type": {"type": "array", "items": "string"},
     "value": ["one", "two", "three"]}

creates an array of strings whose value is `["one", "two", "three"]`.

    {"type": {"type": "array", "items": "string"},
     "new": ["one", "two", "three"]}

creates an array of strings containing the contents of the variables _one_, _two_, and _three_. If _one_ is `"1"`, _two_ is `"2"`, and _three_ is `"3"`, the result would be `["1", "2", "3"]`.

### Creating arrays, maps, and records from runtime data (new)

The "new" special form creates arrays, maps, and records, taking expressions, rather than embedded JSON values. The array form has the following structure:

    {"type": ARRAY-TYPE, "new": [EXPR1, EXPR2, ...]}

where `ARRAY-TYPE` is an array [Avro type](../avro_types) and the `EXPR` are zero or more [expressions](../document_structure/#expressions) whose types can be accepted by the array's `"items"` type.

The map and record forms have the following structure:

    {"type": TYPE, "new": {KEY1: EXPR1, KEY2: EXPR2, ...}}

where `TYPE` is a map or record [Avro type](../avro_types), the `KEY` strings are keys for maps and field names for records, and the `EXPR` are [expressions](../document_structure/#expressions). For a record, all the fields of the record must be present. The types of the `EXPR` must be accepted by the map's `"values"` or the record's field types.

**Example:** This creates a record out of three expressions.

    {"type": {"type": "record",
              "name": "ExampleRecord",
              "fields": [
                  {"name": "one", "type": "int"},
                  {"name": "two", "type": "double"},
                  {"name": "three", "type": "string"}
              ]},
     "new": {
         "one": 1,
         "two": {"+": [2, 0.2]},
         "three": {"a.lower": "THREE"}
      }}

## Symbol assignment and reassignment

PFA has lexical, expression-level scope. You can create variables and access them in any contained expression, including inline functions. You can only modify them at the same level of scope or inside expressions that do not seal their scope from above, such as inline functions (this allows callbacks to be distributed or run in parallel).

All PFA values are immutable: you cannot change an element of an array in-place; you must replace the array. PFA variables are mutable: you can replace the value stored in a variable as long as it has the same type. Pure immutability for PFA values allows them to share structure and have non-blocking read access during shared data updates. Mutability of variable storage allows for straightforward implementation of iterative algorithms.

### Creating variables (let)

Variables are created with `"let"`, which has the following structure:

    {"let": {VAR1: EXPR1, VAR2: EXPR2, ...}}

where the `VAR` are new variable names and the `EXPR` are their initial values. The initial values set the type. More than one variable can be created at a time, but none of the variables are in scope inside the `"let"` block. In principle, they could be computed in parallel.

Variables can only be created once and variables in deeper scopes cannot shadow other variables of the same name.

**Example:** The following creates a union of `"null"` and `"double"` with an initial value of `null`.

    {"let": {"x": {"type": ["null", "double"], "value": null}}}

`x` can be set to a number later.

### Changing variable bindings (set)

Variables are changed with `"set"`, which has the following structure:

    {"set": {VAR1: EXPR1, VAR2: EXPR2, ...}}

where the `VAR` are existing variable names and the `EXPR` are their new values. The variables must accept the types of the `EXPR`. More than one variable can be changed at a time, but none of the changes are bound to the variables inside the `"set"` block (which makes swaps possible; see example). Taking advantage of immutability, these updates could be computed in parallel.

**Example:** The following swaps the values in `a` and `b`.

    {"set": {"a": "b", "b": "a"}}

## Extracting from and updating arrays, maps, and records

### Retrieving nested values (attr)

Arrays, maps, and records of arbitrary depth have a unified dereferencing special form. It can extract substructures of arbitrary depth in one pass, so that the equivalent of `x.y[2].z["hello"][4]` is a one form, not five. Its structure is:

    {"attr": EXPRESSION, "path": [INDEX1, INDEX2, ...]}

where `EXPRESSION` is an [expression](../document_structure/#expressions) and the `INDEX` are one or more expressions. At each level, if the substructure is an array, the corresponding `INDEX` must resolve to `"int"` type, if it is a map, the `INDEX` must resolve to `"string"` type, and if it is a record, the `INDEX` must be a literal string.

Arrays are zero-indexed, so `0` is the first element.

Variables that contain dots are a shortcut for record dereference. That is, a string with a form like:

    "FIRST.SECOND.THIRD"

gets expanded as

    {"attr": "FIRST", "path": [{"string": "SECOND"}, {"string": "THIRD"}]}

**Example:** The `x.y[2].z["hello"][4]` example would look like the following in PFA:

    {"attr": "x", "path": [
        {"string": "y"},
        2,
        {"string": "z"},
        {"s.lower": "HELLO"},
        {"+": [2, 2]}
    ]}

First, `x` (a record) is dereferenced to extract field `y` (an array), which is dereferenced to extract item `2` (a record), which is dereferenced to extract field `z` (a map), which is dereferenced to extract key `"hello"` (an array), which is dereferenced to extract item `4`.

The same could be done in stages:

    {"attr":
      {"attr":
        {"attr":
          {"attr":
            {"attr": "x",
             "path": [{"string": "y"}]},
           "path": [2]},
         "path": [{"string": "z"}]},
       "path": [{"s.lower": "HELLO"}]},
     "path": [{"+": [2, 2]}]}

The dot shortcut can only be used to simplify the innermost

    {"attr": "x", "path": [{"string": "y"}]}

to

    "x.y"

### Creating a copy with different nested values (attr-to)

A similar structure can be used to "modify" substructure. By "modify," we mean create a copy with that substructure altered.

    {"attr": EXPRESSION, "path": [INDEX1, INDEX2, ...],
     "to": VALUE-OR-FUNCTION}

where `EXPRESSION` is an [expression](../document_structure/#expressions) and the `INDEX` are one or more expressions. As above, the types of the `INDEX` must match the corresponding substructures.

The `VALUE-OR-FUNCTION` could be an expression with the right type to replace the substructure or it could be a function from that type to that type. If a function, the original value is passed to the function and the result of the function is taken to be the replacement.

**Example:** Both of the following update a counter, but the first accesses it twice.

    {"attr": "counters", "path": ["whichCounter"], "to":
      {"+": [{"attr": "counters", "path": ["whichCounter"]}, 1]}}

    {"attr": "counters", "path": ["whichCounter"], "to":
      {"params": [{"old": "int"}],
       "ret": "int",
       "do": {"+": ["old", 1]}}}

## Extracting from and updating cells and pools

The "cell", "cell-to", "pool", and "pool-to" special forms have nearly the same structure as "attr" and "attr-to", but they operate on global data (cells and pools). All access to global data must go through these special forms; there are no others.

The path extraction and function updates have more relevance for global data, which may be remote and shared. If the data structure is large and remote, specifying the full path to the substructure of interest reduces the necessary network bandwidth, since only the substructure needs to be returned, not the whole second level of the object.

If the data structure is shared, the update function defines a transaction in which one scoring engine gets an exclusive lock on the object, which is necessary for [correct concurrency](../tutorial3/#concurrent-access-of-shared-data).

### Retrieving cell values (cell)

Cells may be accessed with one of the following structures:

    {"cell": NAME}

or

    {"cell": NAME, "path": [INDEX1, INDEX2, ...]}

where `NAME` is a string, the name of the cell (not an [expression](../document_structure/#expressions)). The `INDEX` are expressions that follow the same rules as for "attr".

**Example:** Model parameters are often stored in cells.

    {"model.cluster.closest": ["input", {"cell": "clusters"}]}

### Changing cell values (cell-to)

Cells may be updated with one of the following structures:

    {"cell": NAME, "to": VALUE-OR-FUNCTION}

or

    {"cell": NAME, "path": [INDEX1, INDEX2, ...],
     "to": VALUE-OR-FUNCTION}

where `NAME` is a string (as above) and `VALUE-OR-FUNCTION` is either a new value or an update function (as above).

Unlike "attr-to", "cell-to" changes the value of the cell. Subsequent requests for the cell will see the new value.

The return value of this form is the new cell value, which can be used to avoid a second request.

**Example:** Both of the following are intended to update a counter, but the first can lead to data corruption if the cell is shared. Another scoring engine that shares the cell might update the counter value before this one is finished.

    {"cell": "counter", "to": {"+": [{"cell": "counter"}, 1]}}

    {"cell": "counter", "to":
        {"params": [{"old": "int"}],
         "ret": "int",
         "do": {"+": ["old", 1]}}}

### Retrieving pool values (pool)

Pools may be accessed with the following structure:

    {"pool": NAME, "path": [INDEX1, INDEX2, ...]}

where `NAME` is a string, the name of the pool (not an [expression](../document_structure/#expressions)). The `INDEX` are expressions that follow the same rules as for "attr".

**Example:** Segmented model parameters are often stored in pools.

    {"model.cluster.closest": [
         "input.vector",
         {"pool": "segmentsOfClusters",
          "path": ["input.segment"]}]}

### Changing pool values (pool-to)

Pool items may be updated with the following structure:

    {"pool": NAME, "path": [INDEX1, INDEX2, ...],
     "to": VALUE-OR-FUNCTION, "init": VALUE}

where `NAME` is a string (as above) and `VALUE-OR-FUNCTION` is either a new value or an update function (as above). The initialization `VALUE` is an expression, which is used if a particular pool item does not yet exist.

Unlike "attr-to", "pool-to" changes the value of the pool item. Subsequent requests for that pool item will see the new value.

The return value of this form is the new pool item (not the whole pool).

**Example:** The following updates a segmented exponentially weighted moving average (EWMA) or creates a new segment if one does not exist.

    {"pool": "segmentedEWMAs", "path": ["input.segment"],
     "to":
         {"params": [{"old": "EWMARecord"}],
          "ret": "EWMARecord",
          "do":
              {"stat.sample.updateEWMA":
                   ["input.value", 0.1, "old"]}},
     "init":
         {"type": "EWMARecord", "new": {"mean": "input.value"}}
    }

### Removing pool values (pool-del)

Pool items may be deleted with the following structure:

    {"pool": NAME, "del": EXPRESSION}

where `NAME` is a string (as above) and `EXPRESSION` evaluates to the name of the pool item to delete. Its return type is `"null"`.

**Example:** The following deletes a segment from a segmented model.

    {"pool": "segments", "del": "input.segmentToDelete"}

## Branching control structures

### Mini-program (do)

The `"do"` special form is for limiting scope in mini-programs. It is often used by automated code builders. The structure is:

    {"do": [EXPR1, EXPR2, ...]}

where `EXPR` may be any [expression](../document_structure/#expressions) and the return value is the value of the last expression.

**Example:** The intermediate variables in these blocks do not conflict.

    {"do": [
        {"do": [
            {"let": {"x": 1}},
            {"+": ["x", 1]},
        ],
        {"do": [
            {"let": {"x": 2}},
            {"+": ["x", 1]},
        ],
        {"do": [
            {"let": {"x": 3}},
            {"+": ["x", 1]},
        ]
    }

### Conditional (if)

PFA's `"if"` statement has two forms:

    {"if": CONDITION, "then": EXPRESSION-OR-EXPRESSIONS}

and

    {"if": CONDITION, "then": EXPRESSION-OR-EXPRESSIONS,
                      "else": EXPRESSION-OR-EXPRESSIONS}

where `CONDITION` is an [expression](../document_structure/#expressions) whose type resolves to `"boolean"` and EXPRESSION-OR-EXPRESSIONS is either a single expression or a JSON array of expressions.

The return value of the first form is `null`, so it acts as a statement: its influence comes from changing variables inside the `"then"` clause.

The return value of the second form is either the last expression in the `"then"` clause or the last expression in the `"else"` clause, so it can be used as an inline expression. It can influence the program through its return value, rather than changing variables.

The return type is the [narrowest possible supertype](../avro_types/#subtypes-and-supertypes) of the `"then"` clause and the `"else"` clause.

**Example:** Both of the following set `y` to `"yes"` if `x` is greater than 0 and `"no"` otherwise, but the first uses `"if"` as a statement, while the second uses it as an expression.

    {"do": [
        {"let": {"y": "no"}},
        {"if": {">": ["x", 0]},
         "then": {"set": {"y": "yes"}}}
    ]}

    {"let": {"y":
        {"if": {">": ["x", 0]},
         "then": "yes",
         "else": "no"}
    }}

### Conditional with many cases (cond)

Long "else if" chains could be constructed by nesting the simple `"if"` form above, but for flatter PFA files, an explicit chain is provided. Its structure is:

    {"cond": [IF-THEN-1, IF-THEN-2, ...]}

or

    {"cond": [IF-THEN-1, IF-THEN-2, ...],
     "else": EXPRESSION-OR-EXPRESSIONS}

where the `IF-THEN` are `"if"` forms with no `"else"` clause and the `EXPRESSION-OR-EXPRESSIONS` is either a single [expression](../document_structure/#expressions) or a JSON array of expressions.

Just like the simple `"if"` form, `"cond"` without `"else"` returns `null` and `"cond"` with `"else"` returns the [smallest possible supertype](../avro_types/#subtypes-and-supertypes) of the `"then"` clauses and the `"else"` clause.

**Example:** The following turns small numbers into English words.

    {"cond": [
        {"if": {"==": ["x", 1]}, "then": {"string": "one"}},
        {"if": {"==": ["x", 2]}, "then": {"string": "two"}},
        {"if": {"==": ["x", 3]}, "then": {"string": "three"}},
        {"if": {"==": ["x", 4]}, "then": {"string": "four"}},
        {"if": {"==": ["x", 5]}, "then": {"string": "five"}},
        {"if": {"==": ["x", 6]}, "then": {"string": "six"}},
        {"if": {"==": ["x", 7]}, "then": {"string": "seven"}},
        {"if": {"==": ["x", 8]}, "then": {"string": "eight"}},
        {"if": {"==": ["x", 9]}, "then": {"string": "nine"}},
        {"if": {"==": ["x", 10]}, "then": {"string": "ten"}}],
     "else": {"string": "unknown"}}

(For large look-up tables, it's better to fill a cell with a map because data can be arbitrarily large, while code is limited on some systems.)

## Loops

### Generic pre-test loop (while)

PFA has an ordinary `"while"` loop, which has the usual danger of not terminating. (The `timeout` option can prevent that, however.) Its structure is:

    {"while": CONDITION, "do": EXPRESSION-OR-EXPRESSIONS}

where `CONDITION` is an [expression](../document_structure/#expressions) that resolves to `"boolean"` and `EXPRESSION-OR-EXPRESSIONS` is either a single expression or a JSON array of expressions.

PFA has no "break", "continue", or "return" statement, so a while loop is often not the best way to do things.

**Example:** An infinite loop.

    {"while": true, "do": {"log": {"string": "Can't stop!"}}}

### Generic post-test loop (do-until)

The `"while"` loop tests its condition before executing its `"do"` expressions, and sometimes it's necessary to test the condition afterward (especially because there is no "break" statement). Its structure is:

    {"do": EXPRESSION-OR-EXPRESSIONS, "until": CONDITION}

where `CONDITION` is an [expression](../document_structure/#expressions) that resolves to `"boolean"` and `EXPRESSION-OR-EXPRESSIONS` is either a single expression or a JSON array of expressions.

**Example:** An iterative procedure that has a non-trivial stop condition.

    {"do": [
        {"set": {"state": {"u.doOneIteration": "state"}}},
        {"let": {
            "cond1": {"u.checkCondition1": "state"},
            "cond2": {"u.checkCondition2": "state"}}},
        ],
     "until": {"&&": ["cond1", "cond2"]}}

### Iteration with dummy variables (for)

PFA's `"for"` loop takes a `"let"`-like structure for its initializer and a `"set"`-like structure for its updator, but is otherwise like a for loop in C. Its structure is:

    {"for": {VAR1: EXPR1, VAR2: EXPR2, ...},
     "while": CONDITION,
     "step": {VAR1: EXPR1, VAR2: EXPR2, ...},
     "do": EXPRESSION-OR-EXPRESSIONS}

where the `VAR` are variable names and the `EXPR` are their initial or updated values. The initial values set the type and the updated values have to conform to that type. The `CONDITION` is an [expression](../document_structure/#expressions) that resolves to `"boolean", and `EXPRESSION-OR-EXPRESSIONS` is either a single expression or a JSON array of expressions.

**Example:** A for loop that applies a procedure to numbers from 1 to 10 (inclusive).

    {"for": {"i": 1},
     "while": {"<=": ["i", 10]},
     "step": {"i": {"+": ["i", 1]}},
     "do":
         {"u.procedure": "i"}}

### Iteration over arrays (foreach)

PFA has a `"foreach"` loop for iteration over arrays. This version should be familiar to users of Python or R. Its structure is:

    {"foreach": VAR, "in": ARRAY, "do": EXPRESSION-OR-EXPRESSIONS}

or

    {"foreach": VAR, "in": ARRAY, "do": EXPRESSION-OR-EXPRESSIONS,
     "seq": TRUE-OR-FALSE}

where `VAR` is a new variable name, `ARRAY` is an [expression](../document_structure/#expressions) that resolves to an array type, and `EXPRESSION-OR-EXPRESSIONS` is either a single expression or a JSON array of expressions.

The `"seq"` parameter, if provided must be a JSON `true` or `false` (default of `true`). If `true`, it indicates that the loop must be processed sequentially. If `false`, the PFA implementation may parallelize the loop. The consequence for the PFA author is that variables defined outside the `"foreach"` can only be _changed_ if elements are processed sequentially. If you get an error saying that a variable cannot be modified inside the scope of a `"foreach"` loop, make sure the `"seq"` parameter is `true` (although the cause could be another sealed scope between the `"foreach"` and the variable, such as an inline function declaration.)

**Example:** Apply a procedure to each element of an array.

    {"foreach": "x", "in": "input.myArray", "do":
        {"u.procedure": "x"}}

Allow the PFA consumer to perform the steps in parallel, which makes it impossible to modify any variables defined outside the `"foreach"`.

    {"foreach": "x", "in": "input.myArray", "do":
        {"u.procedure": "x"},
     "seq": false}

### Iteration over maps (forkey-forval)

PFA's `"forkey-forval"` is an extension of the `"foreach"` idea to iterating over the key-value pairs of a map. Its structure is:

    {"forkey": VAR1, "forval": VAR2, "in": MAP,
     "do": EXPRESSION-OR-EXPRESSIONS}

where `VAR1` is the name of a new variable for each key of the map, `VAR2` is the name of a new variable for each value of the map, `MAP` is an [expression](../document_structure/#expressions) that resolves to a map type, and `EXPRESSION-OR-EXPRESSIONS` is either a single expression or a JSON array of expressions.

The order of a loop over a map is never guaranteed.

**Example:** Apply a procedure to each key, value pair of a map.

    {"forkey": "k", "forval": "v", "in": "input.myMap", "do":
        {"u.procedure": ["k", "v"]}

## Type-safe casting

### Narrowing a type (cast-cases)

If an expression has a type with subtypes, such as a union, you sometimes need to cast it as one of those subtypes. In most languages, like C and Java, casting bypasses type-safety. Incorrect casts either lead to wrong results or raise exceptions. Some languages, like PFA, provide type-safe casts, which require the author to provide a contingency for every possible subtype. The structure for a type-safe cast in PFA is:

    {"cast": EXPRESSION, "cases": [
        {"as": TYPE1,
         "named": VAR1,
         "do": EXPRESSION-OR-EXPRESSIONS},
        {"as": TYPE2,
         "named": VAR2,
         "do": EXPRESSION-OR-EXPRESSIONS},
        ...
     ]}

or

    {"cast": EXPRESSION, "cases": [
        {"as": TYPE1,
         "named": VAR1,
         "do": EXPRESSION-OR-EXPRESSIONS},
        {"as": TYPE2,
         "named": VAR2,
         "do": EXPRESSION-OR-EXPRESSIONS},
        ...],
     "partial": TRUE-OR-FALSE}

where `EXPRESSION` is an [expression](../document_structure/#expressions), the `TYPE` are subtypes of the `EXPRESSION` type, the `VAR` are new variable names, and EXPRESSION-OR-EXPRESSIONS is either a single expression or a JSON array of expressions.

If the type of `EXPRESSION` is `TYPE1`, then the first `"do"` block is evaluated with `VAR1` defined as a variable with `TYPE1`. If, instead, it is `TYPE2`, then the second `"do"` block is evaluated.

If `"partial"` is not provided or `"partial"` is `false`, then the `TYPE` subtypes must cover all possibilities and the `"cast"` form returns the last expression of whichever block is evaluated. (The return type is the [narrowest possible supertype](../avro_types/#subtypes-and-supertypes) of the `"do"` blocks.)

If `"partial"` is `true`, then the `TYPE` subtypes do not have to cover all possibilities and the `"cast"` form returns `null`.

**Example:** Given a variable `x` that could be `"double"`, `"string"`, or `"null"`, the following expression returns the name of the type.

    {"cast": "x", "cases": [
        {"as": "double", "named": "y", "do": {"string": "double"}},
        {"as": "string", "named": "y", "do": {"string": "string"}},
        {"as": "null", "named": "y", "do": {"string": "null"}}]}

The following writes a log message for the first two cases, including the value of the variable.

    {"cast": "x", "cases": [
        {"double", "named": "y": "do":
             {"log": ["y", {"string": "double"}]}},
        {"string", "named": "y": "do":
             {"log": ["y", {"string": "string"}]}}],
     "partial": true}

### Widening a type (upcast)

The "cast-cases" form (above) is used for the usual case of casting a supertype to its subtypes. The other direction is rarely needed and always safe. Its structure is simple:

    {"upcast": EXPRESSION, "as": TYPE}

where `EXPRESSION` is an [expression](../document_structure/#expressions) and `TYPE` is a supertype of the `EXPRESSION` type.

**Example:** Casting an integer as a double.

    {"upcast": 3, "as": "double"}

### Checking for missing values (ifnotnull)

Checking for `null` is a special case of narrowing a type, so the "cast-cases" form could be used to handle it. However, PFA uses `null` to represent missing values, so it is a frequent special case and "cast-cases" is cumbersome. Moreover, "cast-cases" can only cast one expression at a time, and we frequently need to check for `null` in several expressions.

The "ifnotnull" special form handles this case, and its structure is:

    {"ifnotnull": {VAR1: EXPR1, VAR2: EXPR2, ...},
     "then": EXPRESSION-OR-EXPRESSIONS}

or

    {"ifnotnull": {VAR1: EXPR1, VAR2: EXPR2, ...},
     "then": EXPRESSION-OR-EXPRESSIONS,
     "else": EXPRESSION-OR-EXPRESSIONS}

where the `VAR` are new variable names that are in the scope of the `"then"` clause, the `EXPR` are single [expressions](../document_structure/#expressions) or JSON arrays of expressions to check. If all of them are not `null`, the `"then"` clause is evaluated. If any one is `null` and an `"else"` clause is provided, it is evaluated.

If an `"else"` clause is provided, the return value is the last expression of `"then"` or `"else"`. Its type is the [narrowest possible supertype](../avro_types/#subtypes-and-supertypes) of both clauses.

If an `"else"` is not provided, the return value is `null`.

**Example:** The following performs a procedure if all variables are present, and returns a substitute otherwise.

    {"ifnotnull": {"x": "input.x", "y": "input.y", "z": "input.z"},
     "then": {"u.procedure": ["x", "y", "z"]},
     "else": 0}

### Extracting values from binary (unpack)

Sometimes, it is necessary to extract data from a serialized `"bytes"` object. This is done with a special form, rather than a library function, because the return type depends on the interpretation of the `"bytes"` object. It has the following structure.

    {"unpack": BYTES,
     "format": [{VAR1: FORMAT1}, {VAR1: FORMAT1}, ...],
     "then": EXPRESSION-OR-EXPRESSIONS}

or

    {"unpack": BYTES,
     "format": [{VAR1: FORMAT1}, {VAR1: FORMAT1}, ...],
     "then": EXPRESSION-OR-EXPRESSIONS,
     "else": EXPRESSION-OR-EXPRESSIONS}

where `BYTES` is an [expression](../document_structure/#expressions) that resolves to `"bytes"` type, the `VAR` are new variable names that are in the scope of the `"then"` clause, the `FORMAT` are format strings (described below), and the `"then"` and optional `"else"` clauses are single expresions or JSON arrays of expressions.

If the `"bytes"` content conforms to the format, the `"then"` clause is evaluated. If not, and if an `"else"` clause is provided, the `"else"` clause is evaluated. With an `"else"` clause, the result is the last expression in either `"then"` or `"else"` whose type is the [narrowest possible supertype](../avro_types/#subtypes-and-supertypes) of the two. Without an `"else"`, the return value is `null`.

The format strings have the following values.

Format | Result | PFA type
:------|:-------|:--------
`pad` | skips one byte | `"null"`
`boolean` | one byte as true if nonzero | `"boolean"`
`int8` | one byte as signed integer | `"int"`
`int16` | two bytes as signed integer | `"int"`
`int32` | four bytes as signed integer | `"int"`
`int64` | eight bytes as signed integer | `"long"`
`float32` | four bytes as a floating-point number | `"float"`
`float64` | eight bytes as a floating-point number | `"double"`
`raw ##` | extract a fixed number of bytes | `"bytes"`
`null terminated` | extract bytes until terminated by zero (excluding terminus) | `"bytes"`
`length prefixed` | interpret first byte as a size, then extract that many bytes (excluding size byte) | `"bytes"`

The `int8`, `int16`, `int32`, and `int64` formats can also be preceded by `unsigned` to interpret the bytes as an unsigned integer.

The `int16`, `int32`, `int64`, `float32`, and `float64` formats can be preceded by `little` to interpret the bytes as little-endian. (The `unsigned` modifier comes first.)

**Example:** Extract three fields and use them to fill a record, with a default if the bytes are corrupted.

    {"unpack": "input", "format": [
        {"x": "int32"},
        {"y": "float64"},
        {"z": "null terminated"}],
     "then":
        {"type": {"type": "record",
                  "name": "MyRecord",
                  "fields": [
                      {"name": "one", "type": "int"},
                      {"name": "two", "type": "double"},
                      {"name": "three", "type": "string"}]},
         "new": {
             "one": "x",
             "two": "y",
             "three": {"bytes.decodeUtf8": "z"}}
        },
     "else":
        {"type": "MyRecord",
         "new": {"one": 0, "two": 0.0, "three": ""}}}

### Encoding values in binary (pack)

The opposite of the above is "pack", which serializes variables as a `"bytes"` object. Its structure is:

    {"pack": [{FORMAT1: EXPR1}, {FORMAT2: EXPR2}, ...]}

where `FORMAT` are format strings (described below), and `EXPR` are [expressions](../document_structure/#expressions). The return type of this form is a `"bytes"` object.

The format strings are the same as the "unpack" case, with one additional format.

Format | Result | PFA type
:------|:-------|:--------
raw | any number of bytes | `"bytes"`

**Example:** This serializes three variables.

    {"pack": [{"int32": "input.x"},
              {"float64": "input.y"},
              {"null terminated": "input.z"}]}

## Miscellaneous special forms

### Inline documentation (doc)

Since JSON has no comments, PFA provides an inert special form for comments. It takes a string and always returns `null`.

    {"doc": STRING}

where `STRING` is any string.

**Example:** A simple example.

    {"doc": "This is like those REM strings from BASIC."}

### User-defined exceptions (error)

The following special form raises an exception. It has no return type.

    {"error": STRING}

**Example:** When combined with other types as a [narrowest possible supertype](../avro_types/#subtypes-and-supertypes), the "error" form is ignored. The following has type `"int"`.

    {"if": "condition",
     "then": 3,
     "else": {"error": "no good"}}

It can be used to let special forms return a non-null value without constructing unwanted unions.

### Turning exceptions into missing values (try)

PFA has a "try" special form, but unlike most languages, it does not have a "catch" case. In PFA, "try" is used to turn exceptions into missing values (`null`). Its structure is

    {"try": EXPRESSION-OR-EXPRESSION}

or

    {"try": EXPRESSION-OR-EXPRESSION, "filter": ARRAY-OF-STRINGS}

The `EXPRESSION-OR-EXPRESSIONS` is a single [expression](../document_structure/#expressions) or a JSON array of expressions, and `ARRAY-OF-STRINGS` is a JSON array of simple strings (not expressions). If provided, the `"filter"` selects a subset of exception strings to catch.

The return type is a union of the expression's type and `"null"`. This makes it applicable for any impute function.

**Example:** The following gets the first element from an array or `null` if the array is empty.

    {"try": {"a.head": "input"}}

If the `"input"` array had type `{"type": "array", "items": "int"}`, then the type of the above expression is `["null", "int"]`.

A traditional try-catch block can be formed by combining "try" with "ifnotnull":

    {"ifnotnull": {"x": {"try": {"u.attempt": []}}},
     "then": {"u.workWithResult": "x"},
     "else": {"u.dealWithException": []}}

### Log messages (log)

A PFA scoring engine is connected to an input source, and output sink, and optionally a log file. The nature of this log file is outside the scope of PFA, but if it exists, the following special form writes text to it.

    {"log": EXPRESSION-OR-EXPRESSIONS}

or

    {"log": EXPRESSION-OR-EXPRESSIONS, "namespace": NAME}

where `EXPRESSION-OR-EXPRESSIONS` is a single [expression](../document_structure/#expressions) or a JSON array of expressions, and `NAME` is a string (not an expression).

The output of each call to `"log"` is a line of text, space-delimited JSON representations of the provided expressions. The `"namespace"` is optional; the external system may use it to send logs to different files, prefix the line of text with a marker, or ignore it.

The return value of "log" is `null`.

**Example:** The following writes the values of two variables, a number, and string to the logfile.

    {"log": ["x", "y", 3.14, {"string": "literal string"}]}

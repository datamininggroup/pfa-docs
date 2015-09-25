---
layout: page
type: reference
title: Special forms
order: 30
noToc: true
---

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

## Loops

### Generic pre-test loop (while)

### Generic post-test loop (do-until)

### Iteration with dummy variables (for)

### Iteration over arrays (foreach)

### Iteration over maps (forkey-forval)

## Type-safe casting

### Narrowing a type (cast-cases)

### Widening a type (upcast)

### Checking for missing values (ifnotnull)

### Extracting values from binary (unpack)

### Encoding values in binary (pack)

## Miscellaneous special forms

### Inline documentation (doc)

### User-defined exceptions (error)

### Turning exceptions into missing values (try)

### Log messages (log)


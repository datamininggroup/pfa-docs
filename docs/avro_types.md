---
layout: page
type: reference
title: Avro types
order: 20
noToc: true
---

<style>
table td {vertical-align: text-top}
</style>

## Inherited type system

Every programming language has an implicit or explicit type system, and most of these type systems are similar to one another. Rather than invent a new type system, PFA uses the same one as the [Avro serialization format](http://avro.apache.org/). Avro describes data types using strings and JSON objects, so PFA simply includes Avro as a language subset.

The Avro/PFA type system has

   * [boolean](#boolean), [integer](#integer-types), [floating-point](#floating-point-types), and [string](#string-type) primitives,
   * a [null type](#null-type), which PFA uses to represent missing data,
   * [arrays](#arrays) of homogeneous, sequential items,
   * [maps](#maps) of homogeneous, unordered key-value pairs,
   * named [records](#records) of heterogeneous named fields,
   * named [enumeration sets](#enumeration-sets),
   * [byte sequences](#bytes-type) (raw strings),
   * named, [fixed-width byte sequences](#fixed-width-byte-sequences),
   * and [tagged unions](#tagged-unions).

The same type system applies to input data, output data, persistent data structures like model parameters, and function signatures.

## Specification of all types

The [Avro specification page](http://avro.apache.org/docs/1.7.7/spec.html) fully describes this type system, but it is reproduced here with PFA-specific notes.

Since Avro is a serialization format, it does not raise the issue of whether its values are mutable (can be changed in-place) or immutable. All values in PFA are immutable.

In both Avro and PFA, values cannot contain circular references: all data structures are trees.

In both Avro and PFA, all values have a well-defined sort order: PFA inerits Avro sort order and equivalence when performing comparisons in functions such as `"<"`, `"max"`, and `"=="`.

### Null type

The null type is referred to as `"null"` (in quotes, as a string), and it has only one possible value (also `null`, but without quotes).

PFA variables cannot change type, so a variable of null type is not useful: it can only ever be null. The null type is used in [tagged unions](#tagged-unions) and as a return value for functions and special forms that have nothing to return (instead of introducing "void").

A union of any type, such as string, and null is represented as

    ["null", "string"]

and indicates that the string value may be missing. Since this type is distinct from `"string"`, the rigor of the type system enforces an action to be defined for the missing-string case.

### Boolean

The boolean type is referred to as `"boolean"` and it has only two possible values, `true` and `false` (without quotes).

Boolean is not a subclass of integers, so turning a boolean variable `x` into zero or one requires an expression like

    {"if": "x", "then": 1, "else": 0}

### Integer types

There are two integer types, `"int"` for 32-bit, signed integers and `"long"` for 64-bit, signed integers. The `"int"` form is default for most functions, and literal integers in JSON and [PFA expressions](#../document_structure/expressions) are interpreted as `"int"`.

### Floating point types

There are two floating-point types, `"float"` for 32-bit, [IEEE floating-point numbers](http://en.wikipedia.org/wiki/IEEE_floating_point) and `"double"` for 64-bit. The `"double"` form is default for most functions, and literal floating-point numbers in JSON and [PFA expressions](#../document_structure/expressions) are interpreted as `"double"`.

The `"int"`, `"long"`, `"float"`, and `"double"` types form a chain of subtypes:

This type | Can be used where this is expected
:---------|:----------------------------------
`"int"` | `"int"`, `"long"`, `"float"`, `"double"`
`"long"` | `"long"`, `"float"`, `"double"`
`"float"` | `"float"`, `"double"`
`"double"` | `"double"`

### String type

The string type is referred to as `"string"` and it can accept any valid Unicode sequence.

Strings are not arrays and they cannot be changed in-place (all PFA values are immutable).

There is no character type: characters are represented by strings of length 1.

In JSON, a value of type `"string"` is represented as a simple JSON string:

    "hello"

but in a [PFA expression](#../document_structure/expressions), it has to be qualified to avoid confusion with variable names:

    {"string": "hello"}

The appropriate form to use depends on context within the PFA document. A cell or pool's `"init"` section takes a value as JSON, while the `"action"` top-level field takes expressions. This allows large sets of model parameters to be expressed more concisely in a cell or pool while expressions that apply the model can be more expressive.

### Bytes type

The bytes type is referred to as `"bytes"` and it can accept any byte sequence. It is therefore a generalization of a string (though neither is a subtype of the other).

Values of type `"bytes"` are not arrays and cannot be changed in-place (all PFA values are immutable).

In JSON, a value of type `"bytes"` is a raw string:

    "hello"

but in a [PFA expression](#../document_structure/expressions), it has to be qualified, either using base-64 or as a wrapped string:

    {"type": "bytes", "value": "hello"}

or

    {"base64": "aGVsbG8="}

### Arrays

Arrays are homogeneous, ordered collections of items. For any type `X`, an array of `X` can be constructed by

    {"type": "array", "items": X}

For instance, an array of strings is

    {"type": "array", "items": "string"}

For an array to contain items of mixed type, they must be explicitly declared as a union. For instance, an array of nullable, floating-point numbers is

    {"type": "array", "items": ["null", "double"]}

When extracted from the array, these items would have to be further unpacked to handle both `"null"` and `"double"` cases.

The `"items"` may contain any type, no matter how complex. Two-dimensional arrays are formed by constructing an array of arrays:

    {"type": "array", "items":
        {"type": "array", "items": "double"}
    }

Since arrays, like all PFA values, are immutable, they have fixed length. To grow an array, you must replace short versions with longer versions using something like the [a.append](../library/#fcn:a.append) function. Functional programming with [a.map](../library/#fcn:a.map), [a.filter](../library/#fcn:a.filter), [a.reduce](../library/#fcn:a.reduce), etc., is a better match to array's immutability.

In JSON, an array object is represented by square brakets:

    ["one", "two", "three"]

The type of a JSON array is ambiguous without reference to the schema. (The above could be an array of strings, an array of bytes, or an array of enumeration symbols.)

In a [PFA expression](#../document_structure/expressions), a type must be given:

    {"type": {"type": "array", "items": "string"},
     "value": ["one", "two", "three"]}

### Maps

Maps are homogeneous, unordered key-value pairs in which the keys are strings. They may be thought of as arrays in which the index (key) is a string, rather than an integer (position). For any type `X`, a map from string to `X` can be constructed by

    {"type": "map", "values": X}

For instance, a map from strings to floating-point numbers is

    {"type": "map", "values": "double"}

Maps follow the same composition rules as [arrays](#arrays), and they are similarly immutable. Maps may be grown using [map.add](../library/#fcn:map.add) or transformed with [map.map](../library/#fcn:map.map), [map.filter](../library/#fcn:map.filter), etc., in direct analogy with arrays.

In JSON, a map object is represented by curly brackets:

    {"one": 1, "two": 2, "three": 3}

Like arrays, the type of a JSON map is ambiguous without reference to the schema. (The above could be a map of integers or a map of floating-point numbers.)

In a [PFA expression](#../document_structure/expressions), a type must be given:

    {"type": {"type": "map", "values": "int"},
     "value": {"one": 1, "two": 2, "three": 3}]}

### Records

Records are named, heterogeneous collections of a fixed set of named fields. Below is an example of a record with three fields: one (an int), two (a double), and three (a string).

    {"type": "record",
     "name": "MyRecord",
     "fields": [
         {"name": "one", "type": "int"},
         {"name": "two", "type": "double"},
         {"name": "three", "type": "string"}
     ]}

Records are similar to maps, but with three exceptions:

   * Maps can have any string-valued keys; records have specific fields that must always be present, and those field names are restricted to the following regular expression: `[A-Za-z_][A-Za-z0-9_]*`.
   * Map values must all have the same type; record field values can each be different.
   * Maps are unnamed; records have names to distinguish records with different sets of keys and to allow records to be recursively nested (see example below).

Like a map, a record in JSON is represented by curly brakets:

    {"one": 1, "two": 2.2, "three": "THREE"}

Again, the JSON is ambiguous without reference to the schema, since the above could be a record or a `{"type": "map", "values": ["double", "string"]}`.

As with all three named types ([record](#records), [enum](#enumeration-sets), and [fixed](#fixed-width-byte-sequences)), a `"name"` field must be present and a `"namespace"` is optional. Also, a specific record type can only be defined _once_ per PFA document; all other references must be by name (though the full declaration does not need to be first). The name of a record is fully-qualified: if it has a namespace, that namespace must precede the name with a dot.

Here is an example of a recursively defined record type: a binary tree with strings as leaves.

    {"type": "record",
     "name": "Node",
     "namespace": "tree",
     "fields": [
         {"name": "left", "type": ["tree.Node", "string"]},
         {"name": "right", "type": ["tree.Node", "string"]}
     ]}

The types of this record's fields refer to the record by reference: `"tree.Node"` is its fully-qualified name. The fields are unions of `"tree.Node"` with `"string"` so that the tree can terminate on values of a different type (and not be infinite). Here's what an example of such a tree would look like in JSON:

    {"left": {"tree.Node":
                 {"left":  {"string": "L-L"},
                  "right": {"string": "L-R"}}},
     "right": {"tree.Node":
                 {"left":  {"string": "R-L"},
                  "right": {"string": "R-R"}}}}

The `{"tree.Node": ...}` and `{"string": ...}` qualifiers are for [tagging the union values](#tagged-unions) in JSON.

Another way to form a recursive record is to give it [array](#arrays) or [map](#maps) subfields, since these containers may be empty, making it possible to terminate the tree.

    {"type": "record",
     "name": "Tree",
     "fields": [
         {"name": "children", "type": {"type": "array", "items": "Tree"}}
     ]}

Here is an example of such a tree in JSON:

    {"children": [{"children": []}, {"children": []}]}

As with all PFA values, records are immutable. To change one field in a record, use the [attr-to special form](../special_forms/#creating-a-copy-with-different-nested-values-attr-to). To change multiple fields, create a new record with the [new special form](../special_forms/#creating-arrays-maps-and-records-from-runtime-data-new).

Records have additional features that are primarily relevant for serialization and deserialization. See the [Avro specification](http://avro.apache.org/docs/1.7.7/spec.html#schema_record) for details. Only the sort order property affects processing in PFA (for functions such as `"<"`, `"max"`, and `"=="`).

### Enumeration sets

Enumeration sets or "enums" are small, finite sets of strings. The strings must be Avro names (`[A-Za-z_][A-Za-z0-9_]*`). Below is an example of an enum with five symbol values.

    {"type": "enum",
     "name": "SmallNumbers",
     "symbols": ["one", "two", "three", "four", "five"]}

As with all three named types ([record](#records), [enum](#enumeration-sets), and [fixed](#fixed-width-byte-sequences)), a `"name"` field must be present and a `"namespace"` is optional. Also, a specific enum type can only be defined _once_ per PFA document; all other references must be by name (though the full declaration does not need to be first). The name of an enum is fully-qualified: if it has a namespace, that namespace must precede the name with a dot.

To refer to an enumeration value in JSON, simply reference its symbol name:

    "three"

This is, of course, ambiguous, since it could also be a string (or a bytes).

PFA usually uses enumeration sets to specify categorical variables with a fixed set of categories. If sorted or compared using PFA's inequalities, the order is given by the order of the symbols in the type declaration. For example, the five symbols above would be sorted as

    "one", "two", "three", "four", "five"

not as

    "five", "four", "one", "three", "two"

### Fixed-width byte sequences

Avro also provides for named raw byte sequences with fixed length. A 6-byte MAC address type would be defined as

    {"type": "fixed",
     "name": "MACAddress",
     "size": 6}

As with all three named types ([record](#records), [enum](#enumeration-sets), and [fixed](#fixed-width-byte-sequences)), a `"name"` field must be present and a `"namespace"` is optional. Also, a specific enum type can only be defined _once_ per PFA document; all other references must be by name (though the full declaration does not need to be first). The name of an enum is fully-qualified: if it has a namespace, that namespace must precede the name with a dot.

Fixed-type values are not arrays and cannot be changed in-place (all PFA values are immutable).

They are primarily intended for tighter packing in Avro serialization and are not particularly useful in PFA.

### Tagged unions

To allow for variables that can take one of several types, Avro and PFA have tagged unions. They are "tagged" in the sense that a value's specific type is always available. A union of `X`, `Y`, and `Z` is represented as a list of these three types:

    [X, Y, Z]

For instance, a variable that could be `"null"`, `"string"`, or a map of `"int"` would be expressed as

    ["null", "string", {"type": "map", "values": "int"}]

At least two types must be provided, types may not be repeated, and directly nested unions are not allowed.

With the exception of `"null"`, union values in JSON are singleton JSON objects whose key is the type name and whose value is the value.

Type | Name | Example value in JSON
:----|:-----|:---------------------
null | _none_ | `null` (without quotes)
boolean | `"boolean"` | `{"boolean": true}`
int | `"int"` | `{"int": 3}`
long | `"long"` | `{"long": 3}`
float | `"float"` | `{"float": 3.14}`
double | `"double"` | `{"double": 3.14}`
string | `"string"` | `{"string": "hello"}`
bytes | `"bytes"` | `{"bytes": "hello"}`
array | `"array"` | `{"array": [1, 2, 3]}`
map | `"map"` | `{"map": {"one": 1, "two": 2, "three": 3}}`
record | _fully-qualified name_ | `{"MyRecord": {"one": 1, "two": 2, "three": 3}}`
enum | _fully-qualified name_ | `{"SmallNumbers": "three"}`
fixed | _fully-qualified name_ | `{"MACAddress": "^)=;T{"}`
union | _not allowed_ |

(Note that a union containing two types of arrays, such as an array of `"int"` and an array of `"string"`, cannot be disambiguated. An array of `["int", "string"]`, however, is unambiguous and less restrictive.)

PFA primarily uses unions to express the possibility of missing data. For instance, values of type `"double"` are never missing, but values of type `["double", "null"]` are either floating-point numbers or `null` (missing). The non-nullable and nullable types are not interchangeable. For example, you cannot add nullable numbers:

    [{"let": {"xornull": {"type": ["double", "null"],
                          "value": null},
              "yornull": {"type": ["double", "null"],
                          "value": {"double": 3.14}}}},
     {"+": ["xornull", "yornull"]}]

The above is invalid because the `"+"` function can only add numbers, not nullable numbers. Even if `xornull` and `yornull` are _usually_ numbers, a PFA consumer will not accept their sum because one of them might, at runtime, be `null`. To add them, you must provide for the null case, which is known as a type-safe null.

For example, the sum could be replaced with the [ifnotnull special form](../special_forms/#checking-for-missing-values-ifnotnull):

    {"ifnotnull": {"x": "xornull", "y": "yornull"},
     "then": {"+": ["x", "y"]},
     "else": 0}

Some functions, such as the ones in the [impute library](../library/#lib:impute), [three-state logic](../library/#fcn:&&&), and [missing value variants of the tree model](../library/#fcn:model.tree.missingTest), take nullable types directly.

Of course, null is not the only type that can be included in a union, so PFA has the [cast-cases special form](../special_forms/#narrowing-a-type-cast-cases) for unpacking general unions.

## Subtypes and supertypes

Although this type system has no classes, some types are subtypes of others. If `X` is a subtype of `Y`, a value of type `X` would be accepted where type `Y` is expected. In Avro, this is known as [schema resolution](https://avro.apache.org/docs/1.7.7/spec.html#Schema+Resolution).

The four number types form [a chain of subtypes](#floating-point-types) in which an `"int"` can be used where a `"double"` is expected, etc. A supertype can always be constructed using unions, since an instance of type `X` can be used where an `[X, Y, Z]` is expected.

A type describes a set of possible values; its subtype describes a subset of those values and its supertype describes a superset of those values. If a type `X` accepts values of type `Y` and `Y` accepts values of type `X`, then `X` and `Y` are exactly the same type.

Some special forms result in the "narrowest possible supertype" of their arguments, the smallest superset of possible values that can be described in the type system, to allow for return values from all code branches. For example, the return type of

    {"if": "predicate",
     "then": 3.14,
     "else": {"string": "hello"}}

is `["double", "string"]` since it might return a `"double"` and it might return a `"string"`. On the other hand,

    {"if": "predicate",
     "then": 3.14,
     "else": {"int": 3}}

returns a `"double"` since the `"int"` is already a subtype of `"double"`.

Expected | Accepts
:-------------|:-------
null | `"null"` or `["null"]`
boolean | `"boolean"` or `["boolean"]`
int | `"int"` or `["int"]`
long | `"long"` or a union of any subset of {`"int"`, `"long"`}
float | `"float"` or a union of any subset of {`"int"`, `"long"`, `"float"`}
double | `"double"` or a union of any subset of {`"int"`, `"long"`, `"float"`, `"double"`}
string | `"string"` or `["string"]`
bytes | `"bytes"` or `["bytes"]`
an array of `X` | an array of `Y` for which `X` accepts `Y` (arrays are [covariant](http://en.wikipedia.org/wiki/Covariance_and_contravariance_(computer_science)))
a map of `X` | a map of `Y` for which `X` accepts `Y` (maps are [covariant](http://en.wikipedia.org/wiki/Covariance_and_contravariance_(computer_science)))
a record type | the same record type, by name
an enum type | the same enum type, by name
a fixed type | the same fixed type, by name
a union of types `T` | either a union of types `T'` such that for all `t'` in `T'`, there exists a `t` in `T` for which `t` accepts `t'`, or a single type `t''` such that there exists a `t` in `T` for which `t` accepts `t''`.

## Function signatures

[Special forms](../special_forms) and [regular functions](../library) impose constraints on the types they are willing to accept. For instance, the [if special form](../special_forms/#conditional-if) requires a `"boolean"` predicate. All special forms are unique, but the types accepted by library functions follow prescribed patterns. User-defined functions are even more restrictive: only one explicit combination of types is accepted (along with their subtypes).

Library functions have one or more signatures, and these signatures include explicit types, wildcards, and function references. The explicit types found in type signatures are:

   * `"boolean"`
   * `"int"`
   * `"long"`
   * `"float"`
   * `"double"`
   * `"string"`
   * `"bytes"`
   * arrays of explicit types
   * maps of explicit types
   * unions of explicit types

For instance, the [m.round function](../library/#fcn:m.round) has two signatures, one takes a `"float"` and returns an `"int"`, the other takes a `"double"` and returns a `"long"`.

As another example, the [s.join function](../library/#fcn:s.join) function has one signature that takes a `{"type": "array", "items": "string"}` and a `"string"` delimiter and returns a single `"string"`.

### Wildcards in function signatures

Wildcards are parts of a function signature that could take different types. This is not like a union type, which accepts different types at runtime, because a wildcard gets resolved during the type-check when a PFA engine is being built. Once resolved, all values must conform to that resolved type.

Wildcards are labeled with letters and the same label may be repeated to indicate that whatever type one wildcard resolves to, all others with the same label must resolve to the same type.

For instance, the [== function](../library/#fcn:==) takes two arguments, both with the same wildcard, and returns `"boolean"`. If the first argument is a `"string"`, then the second argument must be a `"string"`. If one argument is an `"int"` and the other is a `"double"`, that is acceptable because the wildcard resolves to the supertype `"double"`.

As another example, the [a.last function](../library/#fcn:a.last) takes an array of some wildcard `A` and returns the last item in the array, which has type `A`.

### Records in function signatures

All record types in library function signatures are wildcards with an additional restriction: they must have a specified subset of fields.

For instance, the [stat.sample.updateEWMA function](../library/#fcn:stat.sample.updateEWMA) takes a record that must have a field named "mean" of type `"double"`. The function updates an exponentially weighted moving average (EWMA) and returns a new record with a new "mean".

The record type does not need to have any particular name and it is allowed to have other fields in addition to "mean." (Those other fields are passed through without modification.) Thus, the library function does not exclusively "own" its input data type: other library functions can operate on the same record type, requiring it to have other fields, as long as those requirements do not conflict.

As another example, the [model.tree.simpleTest](../library/#fcn:model.tree.simpleTest) and [model.tree.simpleWalk](../library/#fcn:model.tree.simpleWalk) functions each perform half of the job of evaluating a decision tree. The model.tree.simpleTest function decides how to step from one tree node to the next, and it requires the tree node to contain "field", "operator", and "value" fields. The model.tree.simpleWalk function repeatedly applies the test to different nodes until it gets to a leaf, and it requires the tree node to contain "pass" and "fail" fields. When the two functions are used together, they require all five fields. Alternate stepping functions and walking functions can be combined different functionality. The form of the tree data structure is determined by the set of functions that are to be used on it.

### Enumerated fields in function signatures

Some library functions require an enumeration set whose symbols are fields of another record (referenced by its wildcard label). This ensures that values passed to the function name a field.

An example of this is the "fields" field of [model.tree.simpleTest](../library/#fcn:model.tree.simpleTest), which requires the tree node to only name fields in the data records.

### Function references in function signatures

Some library functions require function references as arguments. Functions are not [first-class objects](http://en.wikipedia.org/wiki/First-class_function) in PFA, in part because the Avro type system cannot express them, but also because this restriction makes PFA algorithms subject to more thorough analysis offline. Accepting a function as an argument to another function is useful for building workflows from generic algorithms, so PFA has the ability to take function references as arguments, even though they cannot be assigned to values.

The parameter types and return types of these function references are restricted, and they share in the same set of wildcard labels as the rest of the calling function's signature. For instance, the [a.map function](../library/#fcn:a.map) takes the following arguments:

   * an array of any `A`
   * a function that maps `A` to any `B`

and returns:

   * an array of `B`

That is, a.map can apply a given function to arrays of any type, but the given function has to operate on that type. Whatever the given function returns, a.map returns an array of that type.

The function references may refer to named user-defined functions, inline (anonymous) user-defined functions, or library functions. Named user-defined functions are defined in the ["fcns" top-level field](../document_structure), and user-defined functions have the same syntax, but they can appear directly in the argument list. Both of the following examples square the elements of an array of numbers and round the results.

    {"a.map": ["arrayOfNumbers", {"fcn": "u.squareAndRound"}]}

where `"squareAndRound"` is defined in the "fcns" top-level field.

    {"a.map": ["arrayOfNumbers",
               {"params": [{"x": "double"}],
                "ret": "int",
                "do":
                    {"cast.int":
                        {"m.round":
                            {"**": ["x", 2]}}}}
              ]}

The parameter type of `"x"` has to accept the item type of `"arrayOfNumbers"` because they both resolve the same wildcard `A`. The function's return type `"int"` resolves `B`, so the final result of this operation is an array of `"int"`.

Library functions can be used as function references, but only if the library function has exactly one signature and no wildcards. For example, the [s.len function](../library/#fcn:s.len), which returns the length of a string, can be applied to an array of strings:

    {"a.map": "arrayOfStrings", {"fcn": "s.len"}}

but the [a.len function](../library/#fcn:a.len), which returns the length of an array of any type, cannot. (PFA employs a simple type inference algorithm that propagates upward from the leaves of an expression, so the type of `A` in the function reference would be ambiguous before it can be matched to `A` in the array.) However, we can always "wrap" a multi-signature or wildcarded library function in a user-defined function to resolve all the types:

    {"a.map": ["arrayOfArraysOfStrings",
               {"params": [{"x": {"type": "array",
                                  "items": "string"}}],
                "ret": "int",
                "do": {"a.len": "x"}}]}

Wrapping library functions is useful for resolving types, but it isn't needed if you only want to turn a two-argument function into a one-argument function by specifying one of the arguments ([partial application](http://en.wikipedia.org/wiki/Partial_application)). PFA has a [special form for this](../special_forms/#function-reference-with-partial-application-fcnref-fill). Below, we apply [m.special.nChooseK](../library/#fcn:m.special.nChooseK) to an array of "k" values with "n" fixed to 100.

    {"a.map": ["arrayOfK", {"fcn": "m.special.nChooseK",
                            "fill": {"n": 100}}]}

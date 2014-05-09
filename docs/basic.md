---
layout: page
type: tutorial
title: Basic examples
order: 20
---

## Running a scoring engine

In the previous section, I explained why you might want to use PFA to deploy your analytic.  In this section, I describe what it does and how to use it.

A PFA document is a JSON-based serialization of a scoring engine.  A scoring engine is an executable that has a well-defined input, a well-defined output, and performs a purely mathematical task.  That is, the calculation does not depend on the environment in which it is running--- it would produce the same result anywhere.

Since input must be collected from somewhere and output must be distributed somewhere, a part of your workflow must be aware of its environment.  This part, called the "pipeline framework," interprets data files or network protocols and funnels the data into and out of the scoring engine.  PFA must always be used in conjuction with such a system, which is also known as the "PFA host" because PFA runs within it as a virtual machine.

To illustrate this with a concrete example, a PFA-enabled [Hadoop](http://hadoop.apache.org/){:target="_blank"} job would look like this:

{% include figure.html url="hadoopExample.png" caption="" %}

Hadoop defines the map-reduce topology of the workflow, reads data from its distributed filesystem, delivers it to the mapper and reducer tasks, interprets the data format, and provides the data to PFA scoring engines.  The data analysis itself is performed by the scoring engines.

In a traditional Hadoop job, the mechanics of data handling and the logic of the data analysis are compiled together in an executable jar file.  In the PFA-enabled Hadoop job, the executable jar file only manages data and interprets PFA.  The logic of the data analysis is expressed in a PFA document, which is provided as a configuration file and may be changed without modifying the executable jar.

A similar story could be told for a PFA-enabled Storm application, or a PFA-enabled Spark application, or any other.  The point of PFA is that it is embedded into many different environments, so it has no single executable.  You may even build one yourself, starting from a [generic PFA library](https://github.com/scoringengine/pfa){:target="_blank"} or from scratch, following the [language specification](https://github.com/scoringengine/pfa/blob/master/doc/spec/PFA.pdf?raw=true).

For these examples, we will use a PFA-enabled servlet running in [Google App Engine](https://developers.google.com/appengine/){:target="_blank"} (see the [pfa-gae](https://github.com/scoringengine/pfa-gae){:target="_blank"} GitHub project).  Most examples respond quickly; if it's taking several seconds, Google App Engine is probably launching a new servlet instance for you.  Subsequent calls will be faster.

## Input, output, action!

The smallest possible PFA document is `{"input": "null", "output": "null", "action": null}`, which inputs nothing, outputs nothing, and does nothing.  The following "nearly minimal" document takes numbers as input and adds `100` to each.  Press the "play" triangle to run it.

{% include engine1.html %}
1
2
3
{% include engine2.html %}
input: double
output: double
action:
  - {+: [input, 100]}
{% include engine3.html %}

In this web applet, the input is represented as a stream of JSON data (one JSON object or value per line) and the PFA document is presented in [YAML](http://yaml.org/){:target="_blank"}.  YAML is like JSON but is easier to read--- nesting is indicated by indentation and quotes are only needed in cases of ambiguity.  The document above could have been written as pure JSON like this:

    {"input": "double",
     "output": "double",
     "action": [
       {"+": ["input", 100]}
     ]}

but it gets more crowded by quotation marks and brackets as we consider more complex examples.  The YAML is always converted into JSON before building a PFA scoring engine.

The above example has three parts: an input type schema, an output type schema, and a list of expressions to compute, returning the last one (or in this case, the only one).  These are the only _required_ top-level fields; I will present others later.

The action routine is called once for every input datum, and a symbol (variable) named `input` references that datum.  This action calls the "`+`" function and passes `input` and `100` as arguments: `{"+": ["input", 100]}`.  Much like [Lisp](http://www.cliki.net/){:target="_blank"}, PFA has no infix operators--- everything is laid out as a syntax tree in [Polish notation](http://en.wikipedia.org/wiki/Polish_notation){:target="_blank"}.  Just as with Lisp, this syntactic simplicity makes it much easier to write programs that generate or analyze PFA documents.

Here is a slightly more complex example:

{% include engine1.html %}
1
2
3
{% include engine2.html %}
input: double
output: double
action:
  - {m.round: {"*": [{m.sin: {+: [input, 100]}}, 100]}}
{% include engine3.html %}

Try mixing in one of these two-parameter functions: "`+`" (addition), "`-`" (subtraction), "`*`" (multiplication), "`/`" (floating-point division), "`//`" (integer division), "`u-`" (negation), "`%`" (modulo), "`%%`" (remainder), "`**`" (exponentiation).

Try mixing in one of these one-parameter functions: `m.sqrt`, `m.sin`, `m.cos`, `m.tan`, `m.exp`, `m.ln` (natural logarithm), `m.log10` (logarithm base 10), `m.floor`, `m.ceil`, `m.round`.  One-parameter functions do not need to enclose arguments in square brackets (`{m.sin: 3.14}` versus `{m.sin: [3.14]}`), but they may, for consistency.

Try adding one of these zero-parameter functions, which is to say, constants: `{"m.pi": []}` and `{"m.e": []}`.  There are many other functions in the [function library](/docs/library/){:target="_blank"}.

Alternatively, you could write it in YAML-indentation form to follow the nesting level more easily:

{% include engine1.html %}
1
2
3
{% include engine2.html %}
input: double
output: double
action:
  - m.round:
      - "*":
        - m.sin:
          - +:
            - input
            - 100
        - 100
{% include engine3.html %}

## Scoring methods

The simple engines presented above are mathematical functions in that they transform one input into one output.  Sometimes, though, you need to filter data (one input to zero or one outputs) or aggregate data (an entire dataset to one output).  To handle these cases, PFA has three methods: map, emit, and fold.

### Map

Map is the case we have seen:

{% include figure.html url="map.png" caption="" %}

but we can make it explicit by passing `"method": "map"` as a top-level field.

{% include engine1.html %}
1
2
3
4
5
{% include engine2.html %}
input: double
output: double
method: map
action:
  - {m.sqrt: input}
{% include engine3.html %}

### Emit

The emit method is a generalization that supplies a function named `emit` and ignores the result of the last expression.  The scoring engine must call `emit` to yield results.

{% include figure.html url="emit.png" caption="" %}

{% include engine1.html %}
1
2
3
4
5
{% include engine2.html %}
input: double
output: double
method: emit
action:
  - if:
      ==: [{"%": [input, 2]}, 0]
    then:
      emit: {/: [input, 2]}
{% include engine3.html %}

### Fold

The fold method is for aggregation--- use it to reduce a dataset to a single quantity.  Rather than wait for the end of the (potentially infinite) dataset, folding engines return a partial result with each call.  The previous partial result becomes available to the next action as a symbol `tally`.  If you are only interested in the total aggregate, ignore all but the last output.

{% include figure.html url="fold.png" caption="" %}

The `tally` for the first datum must be provided as a top-level field named `zero`.

{% include engine1.html %}
1
2
3
4
5
{% include engine2.html %}
input: double
output: double
method: fold
zero: 0
action:
  - {+: [input, tally]}
{% include engine3.html %}

Although the nomenclature suggests sums, any kind of incremental calculation may be performed.  For instance, this one finds the longest string:

{% include engine1.html %}
"hello"
"my"
"darling"
"hello"
"my"
"honey"
"hello"
"my"
"ragtime"
"gal"
{% include engine2.html %}
input: string
output: string
method: fold
zero: ""
action:
  - if:
      ">":
        - {s.len: input}
        - {s.len: tally}
    then:
      input
    else:
      tally
{% include engine3.html %}

## Avro types

PFA's types are equivalent to the types that can be serialized by [Avro](http://avro.apache.org/){:target="_blank"}.  Thus, inputs and outputs of PFA scoring engines can be readily converted to Avro's binary or JSON-based representation (since there is no translation involved), or other formats with some translation.  Avro is widely used in the Hadoop ecosystem, and its [types are specified in JSON](http://avro.apache.org/docs/1.7.6/spec.html){:target="_blank"}, so they can be included in a PFA document without special syntax.

### Input records with multiple fields

Most often, scoring engines receive data as records--- named, heterogeneous product types with named fields--- and occasionally a scoring engine returns output as a record as well.

Here is a semi-realistic example of input records (the 20 closest stars to the sun):

{% include engine1.html %}
{"name": "Sun", "x": 0.0, "y": 0.0, "z": 0.0, "spec": "G2 V", "planets": true, "mag": {"double": -26.72}}
{"name": "Proxima Centauri", "x": 2.94, "y": -3.05, "z": -0.14, "spec": "M5 Ve", "planets": false, "mag": {"double": 11.05}}
{"name": "Alpha Centauri A", "x": 3.13, "y": -3.05, "z": -0.05, "spec": "G2 V", "planets": false, "mag": {"double": 0.01}}
{"name": "Alpha Centauri B", "x": 3.13, "y": -3.05, "z": -0.05, "spec": "K0 V", "planets": false, "mag": {"double": 1.34}}
{"name": "Alpha Centauri Bb", "x": 3.13, "y": -3.05, "z": -0.05, "spec": "", "planets": false, "mag": null}
{"name": "Barnard's Star", "x": 4.97, "y": 2.99, "z": 1.45, "spec": "M3.5 V", "planets": false, "mag": {"double": 9.57}}
{"name": "Luhman 16 A", "x": 1.72, "y": -6.32, "z": 0.61, "spec": "L7.5", "planets": false, "mag": null}
{"name": "Luhman 16 B", "x": 1.72, "y": -6.32, "z": 0.61, "spec": "T0.5", "planets": false, "mag": null}
{"name": "Wolf 359", "x": -1.90, "y": -3.90, "z": 6.46, "spec": "M5.5 V", "planets": false, "mag": {"double": 13.53}}
{"name": "Lalande 21185", "x": -3.44, "y": -0.31, "z": 7.54, "spec": "M2 V", "planets": false, "mag": {"double": 7.47}}
{"name": "Sirius A", "x": -5.76, "y": -6.22, "z": -1.33, "spec": "A1 V", "planets": false, "mag": {"double": -1.43}}
{"name": "Sirius B", "x": -5.76, "y": -6.22, "z": -1.33, "spec": "DA2", "planets": false, "mag": {"double": 8.44}}
{"name": "Luyten 726-8 A", "x": -2.15, "y": 0.17, "z": -8.46, "spec": "M5.5 V", "planets": false, "mag": {"double": 12.61}}
{"name": "Luyten 726-8 B", "x": -2.15, "y": 0.17, "z": -8.46, "spec": "M6 V", "planets": false, "mag": {"double": 13.06}}
{"name": "WISEP J154151.66-225025.2", "x": 8.17, "y": -1.95, "z": 3.96, "spec": "Y0.5", "planets": false, "mag": null}
{"name": "Ross 154", "x": 9.33, "y": 1.87, "z": -1.73, "spec": "M3.5 Ve", "planets": false, "mag": {"double": 10.44}}
{"name": "WISEPC J205628.90+145953.3", "x": 4.34, "y": 8.16, "z": -3.22, "spec": "Y0", "planets": false, "mag": null}
{"name": "Ross 248", "x": -3.37, "y": 9.27, "z": -3.00, "spec": "M5.5 V", "planets": false, "mag": {"double": 12.29}}
{"name": "Epsilon Eridani", "x": -6.74, "y": -1.91, "z": -7.79, "spec": "K2 V", "planets": false, "mag": {"double": 3.73}}
{"name": "Epsilon Eridani b", "x": -6.74, "y": -1.91, "z": -7.79, "spec": "", "planets": true, "mag": null}
{"name": "Epsilon Eridani c", "x": -6.75, "y": -1.91, "z": -7.80, "spec": "", "planets": false, "mag": null}
{% include engine2.html %}
input:
  type: record
  name: Star
  fields:
    - {name: name, type: string}
    - {name: x, type: double}
    - {name: y, type: double}
    - {name: z, type: double}
    - {name: spec, type: string}
    - {name: planets, type: boolean}
    - {name: mag, type: [double, "null"]}
  doc: "http://www.johnstonsarchive.net/astro/nearstar.html"

output: double

action:
  # sum in quadrature
  - m.sqrt:
      a.sum:
        type: {type: array, items: double}
        new:
          - {"**": [input.x, 2]}
          - {"**": [input.y, 2]}
          - {"**": [input.z, 2]}
{% include engine3.html %}

Each record has seven fields: `name` (name of star), `x`, `y`, `z` (galactic coordinates, centered on the Sun), `spec` (spectral type), `planets` (at least one known planet in system), `mag` (the magnitude--- larger numbers are dimmer as seen from Earth).

The `x`, `y`, `z` coordinates are numerical, and thus we can add them in quadrature to compute the distance of the star from Earth (in light years).

### Type-safe null

The type of `mag` is a tagged union of `double` with `null`.  Null values are used to represent missing data, but a symbol cannot have a `null` value unless its type includes `null` as a union option.  Thus, types must be explicitly labeled as nullable.

The union of `double` and `null` is a different type than `double`, so `mag` cannot be passed to a function that expects a `double`, such as addition.  It must be type-cast as a `double`, and thus every case in which missing values are possible must be handled.  This is known as a "type-safe null," since the type check verifies that null pointer exceptions will not occur at run-time.

This filter only selects stars that have a non-null `mag` and returns its value.  Note that the return type is simply `double`; it can never be `null` because we have ensured this with the type-cast.

{% include engine1.html %}
{"name": "Sun", "x": 0.0, "y": 0.0, "z": 0.0, "spec": "G2 V", "planets": true, "mag": {"double": -26.72}}
{"name": "Proxima Centauri", "x": 2.94, "y": -3.05, "z": -0.14, "spec": "M5 Ve", "planets": false, "mag": {"double": 11.05}}
{"name": "Alpha Centauri A", "x": 3.13, "y": -3.05, "z": -0.05, "spec": "G2 V", "planets": false, "mag": {"double": 0.01}}
{"name": "Alpha Centauri B", "x": 3.13, "y": -3.05, "z": -0.05, "spec": "K0 V", "planets": false, "mag": {"double": 1.34}}
{"name": "Alpha Centauri Bb", "x": 3.13, "y": -3.05, "z": -0.05, "spec": "", "planets": false, "mag": null}
{"name": "Barnard's Star", "x": 4.97, "y": 2.99, "z": 1.45, "spec": "M3.5 V", "planets": false, "mag": {"double": 9.57}}
{"name": "Luhman 16 A", "x": 1.72, "y": -6.32, "z": 0.61, "spec": "L7.5", "planets": false, "mag": null}
{"name": "Luhman 16 B", "x": 1.72, "y": -6.32, "z": 0.61, "spec": "T0.5", "planets": false, "mag": null}
{% include engine2.html %}
input:
  type: record
  name: Star
  fields:
    - {name: name, type: string}
    - {name: x, type: double}
    - {name: y, type: double}
    - {name: z, type: double}
    - {name: spec, type: string}
    - {name: planets, type: boolean}
    - {name: mag, type: [double, "null"]}
output: double
method: emit
action:
  - cast: input.mag
    cases:
      # case 1: it's a double
      - as: double
        named: magDouble
        do:
          - {emit: magDouble}
      # case 2: it's null
      - as: "null"
        named: magNull
        do:
          - null   # do nothing; no emit
{% include engine3.html %}

### Type-safe cast

PFA documents include enough information to check all of their data types before execution, and most PFA engines should take advantage of this fact and actually check the types.  Type errors, especially `null` where a value is expected, are common causes of late-stage failures in a long-running workflow.  (That is, the analytic started up, appeared to be working fine, and then crashed hours later when no one was paying attention anymore.)

In some languages, type-casts are a means of subverting the type check.  For example, `(Cat)animal` in C or Java asserts that the `animal` object is a member of the `Cat` subclass, when the type system only knows that it's a generic `Animal`.  If this is not true at runtime, it can corrupt data (in C) or cause an exception (in Java).

The type-cast of `input.mag` in the example above has the form of an exhaustive pattern match, rather than a single assertion.  Any value that `mag` can take--- a number or `null`--- has an associated action.  This is known as a type-safe cast because there are no cases that corrupt data or raise runtime exceptions.

Try removing the second case or putting in a bogus case (`input.mag` is a `string`).  Also, try adding `"partial": true` at the same nesting level as `cast` and `cases`.  This allows the cast-cases to be non-exhaustive (at the price of the expression not having a return value, though the return value is not used in this example).

For a more realistic example of input types and missing value casting, see the [Exoplanets example](/docs/exoplanets).

## To-do

  * begin, action, end and flowTime.png
  * creating local variables, if statements, while/for loops
  * user-defined functions and callbacks
  * persistent storage
  * errors and logs


<!-- The execution of a scoring engine has two or three phases: begin, action, and possibly end.  Some real-time pipelines (such as [Storm](https://storm.incubator.apache.org/){:target="_blank"}) do not have a concept of an end to the data flow.  The begin routine is called once before encountering any data, action is called once for every datum of the same type in the dataset, and end is called after all data (like [awk](http://www.gnu.org/software/gawk/manual/gawk.html){:target="_blank"}). -->

<!-- {% include figure.html url="flowTime.png" caption="" %} -->

<!-- Cells and pools are illustrated with [interactive examples below](#cells-and-pools). -->

<!-- ### Input and output -->

<!-- The `input` and `output` sections of the PFA document are [Avro](http://avro.apache.org/){:target="_blank"} type schemae (represented as YAML, so we do not need to quote the schema string `"double"`).  These schemae impose constraints on the input data (they must be numbers) and the `action`--- it must perform legal operations on type `"double"` and result in type `"double"`. -->

<!-- The following yields an error (in the PFA host) when attempting to read the input: the third line is not a number. -->

<!-- {% include engine1.html %} -->
<!-- 1 -->
<!-- 2 -->
<!-- "Not a number." -->
<!-- {% include engine2.html %} -->
<!-- input: double -->
<!-- output: double -->
<!-- action: -->
<!--   - {+: [input, 100]} -->
<!-- {% include engine3.html %} -->

<!-- The following yields an error (in the PFA host) when attempting to compile the document: it returns a string. -->

<!-- {% include engine1.html %} -->
<!-- 1 -->
<!-- 2 -->
<!-- 3 -->
<!-- {% include engine2.html %} -->
<!-- input: double -->
<!-- output: double -->
<!-- action: -->
<!--   - {+: [input, 100]}   # intermediate calculation -->
<!--   - {string: "Actual output."} -->
<!-- {% include engine3.html %} -->

<!-- ### Action -->

<!-- The `action` section of the PFA document is a JSON array of expressions.  Expressions are JSON objects (key-value pairs).  Function calls are simple expressions--- they have only one key-value pair, the key is the function name, and the value is its arguments.  Zero or more than one arguments must be wrapped in a JSON array (for exactly one argument, it's optional).  Function calls may be nested. -->

<!-- {% include engine1.html %} -->
<!-- 1 -->
<!-- 2 -->
<!-- 3 -->
<!-- {% include engine2.html %} -->
<!-- input: double -->
<!-- output: double -->
<!-- action: -->
<!--   - {m.sin: {+: [input, 100]}} -->
<!-- {% include engine3.html %} -->

<!-- {% include engine1.html %} -->
<!-- 1 -->
<!-- 2 -->
<!-- 3 -->
<!-- {% include engine2.html %} -->
<!-- input: double -->
<!-- output: double -->
<!-- action: -->
<!--   - {m.round: {"*": [{m.sin: {+: [input, 100]}}, 100]}} -->
<!-- {% include engine3.html %} -->

<!-- In a JSON array of expressions, the last one (the tail position) is taken to be the return value. -->

<!-- {% include engine1.html %} -->
<!-- 1 -->
<!-- 2 -->
<!-- 3 -->
<!-- {% include engine2.html %} -->
<!-- input: double -->
<!-- output: double -->
<!-- action: -->
<!--   - {+: [input, 10]} -->
<!--   - {+: [input, 100]} -->
<!--   - {+: [input, 1000]} -->
<!-- {% include engine3.html %} -->

<!-- If this looks like [Lisp](http://www.cliki.net/){:target="_blank"} to you, it should.  Lisp is known for being excellent for metaprogramming, the ability to create programs with programs, in a large part because its syntax is so simple and regular that the generator-programs do not need to handle many cases.  PFA is also meant to be generated programmatically, so we take advantage of the same feature, building a tree from JSON objects and arrays, rather than parentheses. -->

<!-- Unlike Lisp, PFA's symbol types and function call graph can be determined by statically analyzing a PFA document, which makes it safer to use in production. -->

<!-- ### Symbols -->

<!-- Bare strings like `"input"` are references to previously defined symbols (variables).  When the action routine starts, `input` (and possibly `tally`) are the only available symbols. -->

<!-- New symbols can be created with `let`, which is not quite a function, so it is called a "special form".  Symbols have lexical scope, meaning that they are usable between the `let` form and the end of the enclosing block. -->

<!-- {% include engine1.html %} -->
<!-- 1 -->
<!-- 2 -->
<!-- 3 -->
<!-- {% include engine2.html %} -->
<!-- input: double -->
<!-- output: double -->
<!-- action: -->
<!--   - {let: {squared: {"**": [input, 2]}, cubed: {"**": [input, 3]}}} -->
<!--   - {"*": [squared, cubed]} -->
<!-- {% include engine3.html %} -->

<!-- The following causes an out-of-scope error--- `"squared"` is unknown because it is only defined within the `do` block. -->

<!-- {% include engine1.html %} -->
<!-- 1 -->
<!-- 2 -->
<!-- 3 -->
<!-- {% include engine2.html %} -->
<!-- input: double -->
<!-- output: double -->
<!-- action: -->
<!--   - do: -->
<!--     - {let: {squared: {"**": [input, 2]}, cubed: {"**": [input, 3]}}} -->
<!--   - {"*": [squared, cubed]} -->
<!-- {% include engine3.html %} -->

<!-- The `let` form can only declare new symbols.  To change the value of a pre-existing symbol, use `set`. -->

<!-- {% include engine1.html %} -->
<!-- 1 -->
<!-- 2 -->
<!-- 3 -->
<!-- {% include engine2.html %} -->
<!-- input: double -->
<!-- output: double -->
<!-- action: -->
<!--   - {let: {minusSquared: {"**": [input, 2]}, cubed: {"**": [input, 3]}}} -->
<!--   - {set: {minusSquared: {"u-": minusSquared}}} -->
<!--   - {"*": [minusSquared, cubed]} -->
<!-- {% include engine3.html %} -->

<!-- The distinction between `let` and `set` (1) emphasizes the fact that declaring a new symbol is conceptually different from updating an old one, (2) protects from accidental-overwrite errors (particularly when generating PFA automatically), and (3) makes it easy to scan a PFA document and determine whether the algorithm is purely functional (no re-assignments) or not. -->

<!-- ### Top-level fields -->

<!-- HERE -->

<!-- ## Cells and pools -->

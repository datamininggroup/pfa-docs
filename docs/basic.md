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

but JSON strings get more crowded by quotation marks and brackets as we consider more complex examples.  The YAML version is always converted into JSON before building a PFA scoring engine.

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

Try mixing in one of these one-parameter functions: `m.sqrt`, `m.sin`, `m.cos`, `m.tan`, `m.exp`, `m.ln` (natural logarithm), `m.log10` (logarithm base 10), `m.floor`, `m.ceil`, `m.round`.  One-parameter functions do not need to enclose arguments in square brackets (`{"m.sin": 3.14}` versus `{"m.sin": [3.14]}`), but they may, for consistency.

Try adding one of these zero-parameter functions, which is to say, constants: `{"m.pi": []}` and `{"m.e": []}`.  (A PFA host doesn't have to implement zero-parameter functions as functions--- it could implement them as inline constants or whatever is most appropriate for the environment it runs in.)  There are many other functions in the [function library](/docs/library/){:target="_blank"}.

Alternatively, you could write it in YAML-indentation form to see the nesting level more easily:

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

The fold method is for aggregation--- use it to reduce a dataset to a single quantity.  Rather than wait for the end of the (potentially infinite) dataset, folding engines return a partial result with each call.  The previous partial result becomes available to the next action as a symbol `tally`.  If you are only interested in the total, ignore all but the last output.

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

PFA's types are equivalent to the types that can be serialized by [Avro](http://avro.apache.org/){:target="_blank"}.  Thus, inputs and outputs of PFA scoring engines can be readily converted to Avro's binary or JSON-based representation (since no semantics-changing translations are needed).  PFA values can be converted to and from other formats, but some translation may be required.  Avro is widely used in the Hadoop ecosystem, and its [types are specified in JSON format](http://avro.apache.org/docs/1.7.6/spec.html){:target="_blank"}, so these type schemae can be included in a PFA document without any special syntax.

### Input records with multiple fields

Most often, scoring engines receive data as records--- named, heterogeneous product types with named fields--- and occasionally a scoring engine returns output as a record as well.  This subset of Avro can be naturally converted to and from CSV.

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
  # sum in quadrature of x, y, z
  - m.sqrt:
      a.sum:
        type: {type: array, items: double}
        new:
          - {"**": [input.x, 2]}
          - {"**": [input.y, 2]}
          - {"**": [input.z, 2]}
{% include engine3.html %}

Each record has seven fields: `name` (name of star), `x`, `y`, `z` (galactic coordinates, centered on the Sun), `spec` (spectral type), `planets` (true if there is at least one known planet in the system), `mag` (the magnitude--- larger numbers are dimmer as seen from Earth).

The `x`, `y`, `z` coordinates are numerical, and thus we can add them in quadrature to compute the distance of the star from Earth (in light years).

### Type-safe null

In the above example, the type of `mag` is a tagged union of `double` with `null`.  Null values are used to represent missing data, but a symbol cannot have a `null` value unless its type includes `null` as a union option.  Thus, types must be explicitly labeled as nullable.

The union of `double` and `null` is a different type than `double` by itself, so `mag` cannot be passed to a function that expects a `double`, such as addition.  It must be type-cast as a `double`, and thus every case in which missing values are possible must be handled.  This is known as a "type-safe null," since the type check verifies that null pointer exceptions will not occur at runtime.

This filter only selects stars that have a non-null `mag` and returns its value.  Note that the return type is simply `double`; return values won't ever be `null` because we have ensured this with the type-cast.

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

PFA documents include enough information to check all of their data types before execution, and most PFA engines should take advantage of this fact and actually check the types.  Type errors, especially `null` where a value is expected, are common causes of late-stage failures in a long-running workflow.  (That is, an analytic that started up, appeared to be working fine, and then crashed hours later when no one was paying attention.)

In some languages, type-casts are a means of subverting the type check.  For example, `(Cat)animal` in C or Java asserts that the `animal` object is a member of the `Cat` subclass, when the type system only knows that it's a generic `Animal`.  If this is not true at runtime, it can corrupt data (in C) or cause an exception (in Java).

The type-cast of `input.mag` in the PFA example above has the form of an exhaustive pattern match, rather than a single assertion.  Any value that `mag` can take--- a number or `null`--- has an associated action.  This is known as a type-safe cast because there are no cases that corrupt data or raise runtime exceptions.

Try removing the second case or putting in a bogus case (assert that `input.mag` is a `string`, for instance).  Also, try adding a "`"partial": true`" key-value pair at the same nesting level as `cast` and `cases` keys.  A partial match can be non-exhaustive (at the price of the expression not returning a value).

For a more realistic example of input types and missing value casting, see the [Exoplanets example](/docs/exoplanets).

## Programming constructs

The PFA documents we seen so far have single-expression actions.  Though these examples were considered for simplicity's sake, it would not be unusual for a complex statistical model to also be a single expression, if it is served by a library function.  For instance, the function `model.tree.simpleWalk` evaluates a conventional decision tree or regression tree in only one expression, though the tree may have many nodes and input predictors.  Even workflows with pre-processing and post-processing might be composed of only three expressions.  Most PFA engines are more like configuration files than programs.

But sometimes a particular algorithm cannot be expressed in one library function call, so PFA provides standard programming constructs to give the PFA author some flexibility.  These include local symbols (variables), conditionals, loops, and user-defined functions.  Many library functions accept user-defined callback functions, so a common route to implementing non-standard algorithms is to combine a standard function with a small user-defined function.

### Local symbols

Local symbols are declared with `let` and reassigned with `set`.  The scope is block-level: the symbol is accessible everywhere between its declaration and the end of the enclosing block.

{% include engine1.html %}
1
2
3
4
5
{% include engine2.html %}
input: double
output: double
action:
  - let: {x: input}
  - let: {y: {"*": [{+: [input, 1]}, input]}}
  - set: {y: {"/": [y, input]}}
  - {"-": [y, 1]}
{% include engine3.html %}

Notice that `let` and `set` take JSON objects mapping from names to expressions.  If you have several expressions to assign that don't depend on each other, they can be assigned in the same JSON object.  Since the PFA semantics require that they don't depend on one another (because the order of key-value pairs of a JSON object are not guaranteed), a PFA host that supports parallelization might run them in parallel.

{% include figure.html url="letTime.png" caption="" %}

{% include engine1.html %}
1
2
3
4
5
{% include engine2.html %}
input: int
output: double
action:
  - let:
      x: {+: [input, 1]}
      y: {+: [input, 2]}
      z: {+: [input, 3]}
  - let:
      a: {"-": [{"+": [x, y]}, z]}
      b: {"/": [{"*": [x, y]}, z]}
  - {/: [a, b]}
{% include engine3.html %}

Of course, a PFA host doesn't need to run them in parallel if it's not advantageous to do so in a particular environment.  This feature also allows closure compilers to optimize a PFA document by identifying the independent blocks and rearranging them into concurrent `let` expressions.

### Conditionals

If-then-else expressions work as statements:

{% include engine1.html %}
1
2
3
4
5
{% include engine2.html %}
input: int
output: int
method: emit
action:
  - if: {==: [{"%": [input, 2]}, 0]}
    then:
      - emit: input
{% include engine3.html %}

and as expressions:

{% include engine1.html %}
1
2
3
4
5
{% include engine2.html %}
input: int
output: string
action:
  - let:
      result:
        if: {==: [{"%": [input, 2]}, 0]}
        then: {string: "even"}
        else: {string: "odd"}
  - result
{% include engine3.html %}

If there is more than one predicate, the expression is flattened into a `cond` block, rather than chaining (and deeply nesting) else-ifs:

{% include engine1.html %}
0
1
2
3
4
5
{% include engine2.html %}
input: int
output: string
action:
  - cond:
      - if: {==: [{"%": [input, 3]}, 0]}
        then: {string: "off"}
      - if: {==: [{"%": [input, 3]}, 1]}
        then: {string: "on"}
    else:
      {string: "high impedance"}
{% include engine3.html %}

It is easier to pragmatically add or remove cases if the `if-then` pairs are a flat list like this.

### While loops

PFA has the standard pre-test and post-test loops:

{% include engine1.html %}
null
{% include engine2.html %}
input: "null"
output: int
method: emit
action:
  - let: {i: 0}
  - while: {"<": [i, 10]}
    do:
      - set: {i: {+: [i, 1]}}
      - emit: i
{% include engine3.html %}

{% include engine1.html %}
null
{% include engine2.html %}
input: "null"
output: int
method: emit
action:
  - let: {i: 0}
  - do:
      - set: {i: {+: [i, 1]}}
      - emit: i
    until: {==: [i, 10]}
{% include engine3.html %}

While loops expose the PFA host to the possibility that a user's algorithm will enter an infinite loop.  This would be bad in production, since a misconfigured PFA document could cause the system to hang.  PFA hosts have several ways to protect themselves:

  * they can refuse to execute PFA documents containing `while`, `do-until`, a generic `for`, or recursive cycles among user functions, or
  * they can stop a long-running `action` call with a timeout.

The Google App Engine PFA host behind these online examples uses the second option, applying a timeout of 1 second per `action`.  This method has the advantage that it also excludes long-running, but finite, calculations.  If you're thinking of testing it by running a `while` loop without incrementing the dummy variable, be forewarned: you'll get thousands of results back and your browser will be swamped trying to display them all.

### For loops

There are also three types of `for` loops.  The generic `for` is equivalent to a `while` loop (with a dummy variable in encapsulated scope), and the other two loop over arrays and maps.

{% include engine1.html %}
["hello", "my", "ragtime", "gal"]
{% include engine2.html %}
input: {type: array, items: string}
output: string
method: emit
action:
  - for: {i: 0}
    while: {"<": [i, 4]}
    step: {i: {+: [i, 1]}}
    do:
      - emit: {attr: input, path: [i]}

  - foreach: x
    in: input
    do:
      - emit: x

  - forkey: k
    forval: v
    in: {new: {one: 1, two: 2, three: 3}, type: {type: map, values: int}}
    do:
      - emit: k
{% include engine3.html %}

### Functions and callbacks

User-defined functions encapsulate logic in named, reusable units and they provide a way to deliver units of logic to a library function as a callback.  Here's a simple example:

{% include engine1.html %}
1
2
3
4
5
{% include engine2.html %}
input: int
output: int
action:
  - {u.squared: {u.cubed: input}}
fcns:
  squared:
    params: [{x: int}]
    ret: int
    do:
      - {"*": [x, x]}
  cubed:
    params: [{x: int}]
    ret: int
    do:
      - {"*": [x, {u.squared: x}]}
{% include engine3.html %}

Functions must declare the types of their parameters and their return type.  User-defined functions enter the global function namespace prefixed by "`u.`" so that they can't conflict with any library functions.  Other than that, user functions are used in the same way as library functions.

Some library functions accept functions as arguments.  The two most useful examples of this are sorting and finding extreme values of arrays:

{% include engine1.html %}
["hello", "my", "darling", "hello", "my", "honey", "hello", "my", "ragtime", "gal"]
{% include engine2.html %}
input: {type: array, items: string}
output: string
action:
  - a.maxLT: [input, {fcnref: u.customLessThan}]
fcns:
  customLessThan:
    params: [{x: string}, {y: string}]
    ret: boolean
    do:
      - {"<": [{s.len: x}, {s.len: y}]}
{% include engine3.html %}

You can also provide a function definition in-place, which is convenient for making closures.

{% include engine1.html %}
true
false
{% include engine2.html %}
input: boolean
output: {type: array, items: int}
action:
  - let:
      sortme:
        value: [23, 55, 18, 62, 4, 99]
        type: {type: array, items: int}

  - a.sortLT:
      - sortme
      - params: [{x: int}, {y: int}]
        ret: boolean
        do:
          # input comes from the enclosing scope
          # it can be accessed but not modified
          - if: input
            then: {"<": [x, y]}
            else: {">": [x, y]}
{% include engine3.html %}

These features are common in high-level languages, in which functions are first-class citizens that can be passed around as though they were values.  Low-level languages and limited environments (such as GPUs) don't allow first-class functions.  To support these environments, PFA functions are not first-class: they cannot be referred to by symbols or returned from a function, but they can appear in (and only in) function argument lists.  In a low-level environment, this translates to an explicit reference to a function, or even as inlined code.  Free symbols in a closure (such as `input` in the anonymous function above) would be implemented as additional parameters passed to the function (which is why `input` can be accessed but not modified in the example above).

### Realistic example

The first problem to be solved with a computer program was a calculation of the Bernoulli sequence (by [Ada Lovelace in 1842](http://people.maths.ox.ac.uk/kar/AdaLovelace.html){:target="_blank"}, a hundred years before the first electronic computer).  However, the PFA library (currently) does not have any specification for generating Bernoulli numbers, so if a particular application requires one, the PFA author would have to write it herself.

Algorithms like this are often found in old libraries, ported from language to language as needed.  I found the following implementation in Fortran:

~~~~~~
        SUBROUTINE BERNOA(N,BN)
        IMPLICIT DOUBLE PRECISION (A-H,O-Z)
        DIMENSION BN(0:N)
        BN(0)=1.0D0
        BN(1)=-0.5D0
        DO 30 M=2,N
           S=-(1.0D0/(M+1.0D0)-0.5D0)
           DO 20 K=2,M-1
              R=1.0D0
              DO 10 J=2,K
10               R=R*(J+M-K)/J
20            S=S-R*BN(K)
30         BN(M)=S
        DO 40 M=3,N,2
40         BN(M)=0.0D0
        RETURN
        END
~~~~~~
{: .language-fortran}

and converted it to PFA like this:

{% include engine1.html %}
5
25
{% include engine2.html %}
input: int
output: {type: array, items: double}
action:
  - u.bernoulli: input
fcns:
  bernoulli:
    params: [{N: int}]
    ret: {type: array, items: double}
    do:
      - let:
          BN:
            new: [1, -0.5]
            type: {type: array, items: double}
      - for: {M: 2}
        while: {"<=": [M, N]}
        step: {M: {+: [M, 1]}}
        do:
          - let:
              S: {u-: {-: [{/: [1, {+: [M, 1]}]}, 0.5]}}
          - for: {K: 2}
            while: {"!=": [K, M]}
            step: {K: {+: [K, 1]}}
            do:
              - let: {R: 1.0}
              - for: {J: 2}
                while: {"<=": [J, K]}
                step: {J: {+: [J, 1]}}
                do:
                  - set:
                      R:
                        "*":
                          - R
                          - {/: [{-: [{+: [J, M]}, K]}, J]}
              - set:
                  S: {-: [S, {"*": [R, {attr: BN, path: [K]}]}]}
          - set:
              BN: {a.append: [BN, S]}
      - for: {M: 3}
        while: {"<=": [M, N]}
        step:
          M: {+: [M, 2]}
        do:
          - set: {BN: {a.replace: [BN, M, 0]}}
      - BN
{% include engine3.html %}

Admittedly, the PFA is hard to read, even in its YAML form.  Embedding an entire language in JSON syntax makes it easier to manipulate programmatically, but harder to manipulate by hand.  In practice, one should rarely need to write something this complex by hand, since conventional languages can be easily converted into PFA.

Most languages have parsers that build abstract syntax trees (AST), and we can convert these trees into PFA fairly easily because PFA is itself a tree.  Below is an example of a conversion from Javascript into PFA, performed by your browser.  Edit the Javascript code, and the PFA will follow suit (whenever the Javascript becomes valid).

In a real application, user-defined functions would probably come from a language converter like this; the language choice depends on the audience.  New programmers might find it easiest to write Python, statisticians would probably prefer to write R code, engineers might like Matlab syntax, etc.

<script src="/public/js/esprima.js"></script>
<script src="/public/js/jsToPfa.js"></script>
<script src="/public/js/codemirror-4.1/mode/javascript/javascript.js"></script>

<div style="margin-bottom: 20px;">
  <div style="border: 2px solid #dddddd;"><div style="height: 0px;"><div style="padding-top: 4px; margin-left: auto; width: intrinsic; padding-left: 3px; padding-right: 3px; position: relative; top: -3px; z-index: 100; font-family: 'PT Sans', Helvetica, Arial, sans-serif; font-weight: bold;">Javascript syntax</div></div><textarea id="jsin">input = "int";
output = {type: "array", items: "double"};

action = function (input) { u.bernoulli(input); }

fcns = {
    bernoulli: function (N = "int") {
        var BN = new Array([1, -0.5], {type: "array", items: "double"});
        for (var M = 2;  M <= N;  M++) {
            var S = -(1/(M + 1) - 0.5);
            for (var K = 2;  K != M;  K++) {
                var R = 1;
                for (var J = 2;  J <= K;  J++)
                    R = R*(J + M - K)/J;
                S = S - R*BN[K];
            }
            BN[M] = S;
        }

        for (var M = 3;  M <= N;  M += 2)
            BN = a.replace(BN, M, 0);
        BN
    } >> {type: "array", items: "double"}
};</textarea><div style="height: 0px;"><div style="padding-top: 4px; margin-left: auto; width: intrinsic; padding-left: 3px; padding-right: 3px; position: relative; bottom: 80px; z-index: 100; font-family: 'PT Sans', Helvetica, Arial, sans-serif; font-weight: bold;">
    <label><input id="debuggingInfo" type="checkbox" name="debuggingInfo" value="toggle" onChange="updatePfa();"></input> debugging info</label><br>
    <label><input id="prettyPrint" type="checkbox" name="prettyPrint" value="toggle" onChange="updatePfa();"></input> pretty-print</label><br>
    <label><input id="showErrors" type="checkbox" name="showErrors" value="toggle" onChange="updatePfa();" checked></input> show errors</label>
  </div></div></div>
  <div style="border: 2px solid #dddddd; border-top: none;"><div style="height: 0px;"><div style="padding-top: 4px; margin-left: auto; width: intrinsic; padding-left: 3px; padding-right: 3px; position: relative; top: -3px; z-index: 100; font-family: 'PT Sans', Helvetica, Arial, sans-serif; font-weight: bold;">Generated PFA (JSON)</div></div><textarea id="pfaout"></textarea></div>
</div>

<script type="text/javascript">
$("#jsin, #pfaout").each(function (i, x) {
    var y = CodeMirror.fromTextArea(x,
                {mode: "javascript",
                 lineNumbers: true,
                 smartIndent: true,
                 tabSize: 2,
                 indentUnit: 2,
                 indentWithTabs: false,
                 electricChars: false,
                 lineWrapping: true,
                 readOnly: (x.id == "pfaout"),
                 showCursorWhenSelecting: true,
                 viewPortMargin: Infinity,
                 keyMap: "custom"
                });
    x.cm = y;
});

function updatePfa() {
    var cm = document.getElementById("jsin").cm;
    try {
        var result = jsToPfa(cm.getValue(), document.getElementById("debuggingInfo").checked);
        var stringy;
        if (document.getElementById("prettyPrint").checked)
            stringy = JSON.stringify(result, undefined, 2);
        else
            stringy = JSON.stringify(result);
        document.getElementById("pfaout").cm.setValue(stringy);
    }
    catch (err) {
        if (document.getElementById("showErrors").checked)
            document.getElementById("pfaout").cm.setValue(err + "");
    }
}

document.getElementById("jsin").cm.on("change", updatePfa);

$(document).ready(updatePfa);
</script>

If you're familiar with Javascript, you may have noticed that the above would not run as a standard Javascript program.  Syntax is easy to convert among languages, but semantics is more difficult.  For example,

  * PFA is statically typed for safety and speed, but Javascript checks types at runtime.  To support this, I added type annotations in the function parameter list ("`N = "int"`" rather than simply "`N`") and the function return value ("`>> {type: "array", items: "double"}`").
  * A new array can be constructed in Javascript with "`[1, -0.5]`", but I require it to be wrapped in a constructor to provide a slot for the type annotation.
  * Javascript allows functions to have multiple return points (with the "`return`" keyword) but instead I assumed PFA's convention of letting the last expression be a return value.
  * The library functions are taken from PFA's library, rather than Javascript's.  For instance, "`a.replace`" is from PFA's array library.

Other than these semantic reinterpretations, this is a complete mapping of the Javascript language onto the PFA language (in 760 [lines of code](/public/js/jsToPfa.js){:target="_blank"}).  More elaborate converters could attempt to preserve semantics as well.

A programming language is a user interface, which should be optimized for human efficiency.  PFA, on the other hand, is an intermediate representation for encoding what is essential to an analytic and deploying it anywhere.

## Data flow

### Begin, action, end

A PFA scoring engine processes a linear stream of data that has a beginning and possibly an end.  Each datum in the stream has the same type and comes from the same source, so if you want to combine data of different types from different sources, create two or more scoring engines and connect them in a pipeline system.

In some cases, you may want to perform special actions at the beginning and end of a data stream.  PFA has `begin` and `end` routines for this purpose (similar to [awk](http://www.gnu.org/software/gawk/manual/gawk.html){:target="_blank"}).

{% include figure.html url="flowTime.png" caption="" %}

The `begin` and `end` routines do not accept input and do not return output; they only manipulate persistent storage.

### Persistent storage

A PFA scoring engine has four types of persistent storage: cells and pools, both of which may be private or shared.  These storage areas are like local symbols in that they store Avro-typed data, but they are unlike local symbols in that they have global scope and are remembered between `action` invocations, and between the `begin` and `end`.  The syntax for accessing them is also different from local symbol references, to make it easier for a PFA host to statically analyze how they are used.

{% include figure.html url="flowData.png" caption="" %}

Cells store individual, named values of a specific type.  The scoring engine below reproduces the fold-method example by storing the tally in a cell of type _string._  It is somewhat more cumbersome to use a persistent cell rather than the fold method, but a few interacting cells can perform more complex tasks than the fold method alone.

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
cells:
  longest: {type: string, init: ""}
action:
  - if:
      ">":
        - {s.len: input}
        - {s.len: {cell: longest}}
    then:
      - {cell: longest, to: input}
      - input
    else:
      - {cell: longest}
{% include engine3.html %}

Cells cannot be created or destroyed at runtime, and they must be initialized before the `begin` method.  (In the case above, the initial value is an empty string.)  Pools are persistent storage elements without this restriction.  They can be used to gather data into tables.

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
output: int
pools:
  wordCount: {type: int}
action:
  - pool: wordCount
    path: [input]
    to:
      params: [{x: int}]
      ret: int
      do: {+: [x, 1]}
    init:
      0
  - {pool: wordCount, path: [{string: "hello"}]}
{% include engine3.html %}

The engine above creates a new entry in the `wordCount` table with value `0` when it encounters a new word and it increments the count when it encounters a previously seen word, then it outputs the number of occurrences of `"hello"`.  (There are library functions to manage count tables; it was done manually here for illustration.)

A pool of type `X` is like a cell of type `{"type": "map", "values": X}` except for how they are updated.  The value of a cell is entirely replaced in one atomic action, but only one item in a pool is replaced atomically, not the whole pool.  For private data (accessed by a single scoring engine), this difference is only seen in the runtime speed of very large pools.  Updating one pool-item at a time is faster than updating an entire cell with a single map value changed.  But it is especially relevant for shared data, since the granularity of atomic updates changes the behavior of the system.

### Concurrent access of shared data

Multiple scoring engines can share the same cells and pools.  This may be because the PFA host generates many instances of a scoring engine from a PFA document (mappers in Hadoop, for instance) or because different scoring engines are coordinated through a database.  The mechanism and reasons for sharing data are beyond the scope of the PFA specification, but the synchronization policy is not, since it affects how data are calculated.

PFA uses a read-copy-update policy to maximize availability of data for reading.  It can be implemented in any environment that supports locks.  In this policy, a write operation begins by locking the memory element in such a way that it can still be read, but only one writer has access to write.  The writer then copies the value and operates on the copied version.  When finished, the writer atomically swaps a pointer from the old version to the new version, and after that instant, readers see the new value.  It then releases the lock so that other writers can begin.

{% include figure.html url="concurrent.png" caption="" %}

To avoid the possibilitiy of deadlock, a PFA host should additionally verify that each write operation only writes to one cell or pool item.  This would be a rather draconian policy for general-purpose programming, but numerical calculations rarely need more structural complexity than this.

Although the Google App Engine PFA host does not actually implement sharing, it performs the deadlock check described above.  The PFA document below cannot be executed because of its violation of this policy.  It uses `changeOne` to change a cell, but this function has side-effects (changes another cell or pool) indirectly through `functionThatCallsChangeTwo`.

{% include engine1.html %}
null
{% include engine2.html %}
input: "null"
output: "null"
cells:
  one: {type: int, init: 1}
  two: {type: int, init: 2}
action:
  - {cell: one, to: {fcnref: u.changeOne}}
fcns:

  changeOne:
    params: [{x: int}]
    ret: int
    do:
      - {u.functionThatCallsChangeTwo: []}

  functionThatCallsChangeTwo:
    params: []
    ret: int
    do:
      - {cell: two, to: {fcnref: u.changeTwo}}
      - 1

  changeTwo:
    params: [{x: int}]
    ret: int
    do:
      - 2
{% include engine3.html %}

### Immutable data

All values in PFA (numbers, strings, arrays, maps, record structures, etc.) are immutable in the sense that PFA has no library functions to change them in-place.  Whenever you want to change one item of an array, one key-value pair in a map, or one field in a record, the entire array, map, or record must be replaced by a new one with the single item replaced.

For single-item replacements, this is slower than in-place updates because unaffected values must be copied.  But it is not as slow as you might think, since the assurance that a value will never be modified in place allows an implementation to share the value among many objects.  Siblings of the changed item only need to be shallow-copied, not deeply copied ([structural sharing](http://www.infoq.com/presentations/Value-Identity-State-Rich-Hickey){:target="_blank"}).  When one needs a copy of a whole data structure, it can simply be referenced (no copying at all).

For example, a general tree-like data structure with _N_ nodes can be updated and "copied" with the following time complexity.

| | update one element | obtain an independent copy |
|:--:| |:--:| |:--:|
| **mutable data** | _O(1)_ | _O(N)_ |
| **immutable data** | _O(log(N))_ | _O(1)_ |

Mutable data is faster if single-element updates vastly outnumber whole structure copies; immutable data is faster in the opposite extreme.  PFA uses immutable data for several reasons.

  * According to the concurrency policy, writes to shared memory must begin by copying the old version of a value.  These writes may be frequent, and the _O(1)_ versus _O(N)_ savings may be significant.
  * Cells and pools may also be labeled as `rollback` (details [below](#alternate-output-streams-exceptions-and-logs)).  Every `rollback` value must be copied at the beginning of every `action` event; this also benefits from the _O(1)_ versus _O(N)_.
  * Shared mutable data is a frequent source of bugs.  If `x` is a mutable data structure, constructing `y` from `x` causes `y` to depend on the value of `x` at all future times.  When `x` changes, `y` silently changes as well.  If, on the other hand, `x` is a symbol referring to an immutable value, then constructing `y` from `x` only causes `y` to depend on `x` at the time of its creation.  If the symbol `x` is redefined, then `y` is unchanged.
  * Circular references are impossible to construct (PFA has no lazy evaluation).  Building a new structure from an immutable `x`, like `x = new Record(x)`, only creates a new value with the old `x` nested within it, rather than a structure that includes itself.  This statement has a similar meaning to `x = x + 1`, which creates a new number based on the old value of `x`, rather than an infinite number.
  * PFA results need to be serialized, and most serialization formats (Avro included) do not support circular references.
  * All values are immutable, rather than just some of them, because these benefits would be lost if some data could be shared and naively copied while others could not.

### Model parameters

One common application of PFA is to represent statistical models.  Common model types, which are implemented by PFA library functions, can be expressed as structured sets of parameters for the library functions to interpret.  These parameter sets are often stored in persistent cells to ensure that they aren't re-created in every `action` and to allow the model to change.  (Some workflows update the model as they collect data; others do not.)

Here is an example of a small (4-leaf) decision tree.  The `Datum` record defines the format of incoming data to be scored by the tree and `TreeNode` defines the structure of the tree itself.  The `tree` in this example is initialized and never updated.

{% include engine1.html %}
{"one": 11, "two": 3.6, "three": "TEST"}
{"one": 11, "two": 3.4, "three": "TEST"}
{"one": 13, "two": 3.6, "three": "TEST"}
{"one": 13, "two": 3.6, "three": "NOT-TEST"}
{% include engine2.html %}
input:
  type: record
  name: Datum
  fields:
    - {name: one, type: int}
    - {name: two, type: double}
    - {name: three, type: string}

output: string

cells:
  tree:
    type:
      type: record
      name: TreeNode
      fields:
        - {name: field, type: string}
        - {name: operator, type: string}
        - {name: value, type: [double, string]}
        - {name: pass, type: [string, TreeNode]}
        - {name: fail, type: [string, TreeNode]}
    init:
      field: one
      operator: "<"
      value: {double: 12}
      pass:
        TreeNode:
          field: two
          operator: ">"
          value: {double: 3.5}
          pass: {string: "yes-yes"}
          fail: {string: "yes-no"}
      fail:
        TreeNode:
          field: three
          operator: "=="
          value: {string: "TEST"}
          pass: {string: "no-yes"}
          fail: {string: "no-no"}

action:
  - model.tree.simpleWalk: [input, {cell: tree}]
{% include engine3.html %}

This PFA document has a one-line `action` that simply applies the tree to the data.  Although `model.tree.simpleWalk` performs type-checks, its signature is generic, only requiring the record fields that are necessary to walk through a tree and placing minimal constraints on their types.

For instance, this tree is a decision tree because its `pass` and `fail` types are `[string, TreeNode]` (union of `string` and `TreeNode`), meaning that `pass` and `fail` may lead to `strings` (categorical scores) or additional `TreeNodes`.  If `string` were replaced with `double`, this would be a regression tree, and `model.tree.simpleWalk` would be just as capable of evaluating it.  If `string` were replaced with `{"type": "array", "items": "double"}`, it would be a multivariate regression tree.  Still other possibilities are left open because the `model.tree.simpleWalk` signature is generic.

## Alternate output streams: exceptions and logs

Although PFA is designed to minimize the number of things that can go wrong at runtime, some runtime errors are still possible.  For instance, accessing the thirteenth element of a twelve-element array is a runtime error, since type-checkers and static analyzers cannot determine the length of an array from the PFA document alone.  This kind of condition causes a non-local exit from the scoring procedure with an error message--- in other words, an exception.

All runtime exceptions that the library functions can throw are documented in the reference.  However, it is also possible for the PFA author to define exceptions as well.  User-defined exceptions are typically used to skip `action` events that present an invalid state (more specific than what the type-check eliminates and not an ordinary case of "missing data", which should be handled by a [type-safe null](#type-safe-null)).  The PFA language has no try-catch equivalent.

If some of the scoring engine's cells and pools would be invalidated by being partially updated, they can request `rollback`.  At the beginning of each `action`, cells and pools with `rollback` set to `true` are copied; if a library or user exception occurs during the `action`, their values are replaced by the initial value.  This example demonstrates exceptions and rollback:

{% include engine1.html %}
1
2
3
4
5
{% include engine2.html %}
input: int
output: int
cells:
  counter: {type: int, init: 0, rollback: true}
action:
  - cell: counter
    to:
      params: [{x: int}]
      ret: int
      do: {+: [x, 1]}

  - if: {"<": [input, 4]}
    then:
      - {error: "This one is too small."}

  - cell: counter
{% include engine3.html %}

The `counter` outputs `1`, `2` if `rollback` is `true`, and `4`, `5` if `rollback` is `false` or not present.

Since exceptions provide the host with information in a different way than ordinary output, exceptions may be considered an alternative form of output.  Another auxiliary output is the log output.

Logging in PFA is usually for debugging.  The `{"log": ["x", "y", "z"]}` form writes the values of `x`, `y`, and `z` in JSON form on the log output.  The PFA host has complete control over the way logs are handled, if at all.  Note that `x`, `y`, and `z` are expressions, not strings.  To write a plain string to the output file, enclose it in `{"string": ` ... `}` or `[` .. `]` to make a literal string expression.

{% include engine1.html %}
1
2
3
4
5
{% include engine2.html %}
input: int
output: int
action:
  - if: {">": [input, 3]}
    then: {u.callfunc: input}
  - input
fcns:
  callfunc:
    params: [{x: int}]
    ret: "null"
    do:
      - {log: [["enter callfunc"], x]}
{% include engine3.html %}

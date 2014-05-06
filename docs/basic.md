---
layout: page
type: tutorial
title: Basic examples
order: 20
---

## Structure of a scoring engine

In the previous section, I explained why you might want to use PFA to deploy your analytic.  In this section, I describe what it does and how to use it.

A PFA document is a JSON-based serialization of a scoring engine.  A scoring engine is an executable that has a well-defined input, a well-defined output, and performs a purely mathematical task.  That is, the calculation does not depend on the environment in which it is running--- it would produce the same result anywhere.

Since input must be collected from somewhere and output must be distributed somewhere, a part of the workflow must be aware of its environment.  This part, called the "pipeline framework," interprets data files or network protocols and funnels the data into and out of the scoring engine.  PFA must always be used in conjuction with such a system, which is also known as the "PFA host" because PFA runs within it as a virtual machine.

To illustrate this with a concrete example, a PFA-enabled [Hadoop](http://hadoop.apache.org/){:target="_blank"} job would look like this:

{% include figure.html url="hadoopExample.png" caption="" %}

Hadoop defines the mapper-reducer topology of the workflow, reads data from its distributed filesystem, delivers it to the mapper and reducer tasks, interprets the data format, and provides the data to PFA scoring engines.  The data analysis itself is performed by the scoring engines.

In a traditional Hadoop job, the mechanics of data handling and the logic of the data analysis are compiled together in an executable jar file.  In the PFA-enabled Hadoop job, the executable jar file only manages data and interprets PFA.  The logic of the data analysis is expressed in a PFA document, which is provided as a configuration file and may be changed without modifying the executable jar.

The execution of a scoring engine has two or three phases: begin, action, and possibly end.  Some real-time pipelines (such as [Storm](https://storm.incubator.apache.org/){:target="_blank"}) do not have a concept of an end to the data flow.  The begin routine is called once before encountering any data, action is called once for every datum of the same type in the dataset, and end is called after all data (like [awk](http://www.gnu.org/software/gawk/manual/gawk.html){:target="_blank"}).

{% include figure.html url="flowTime.png" caption="" %}

The action may be invoked in one of three methods: map, emit, or fold.  The map method treats the scoring engine like a mathematical function--- it takes a single input datum and returns a single output datum.  Thus, the map method cannot be used to filter data.

{% include figure.html url="map.png" caption="" %}

The emit method allows zero or more outputs by providing action with a callback function.  The action routine may call the emit function any number of times, including zero.  An action that calls emit zero or one times is a filter; an action that calls emit more than once expands upon the input.  (Despite its name, is what a Hadoop "mapper" does.)

{% include figure.html url="emit.png" caption="" %}

The fold method is used to aggregate data.  Each time it is called, it returns and a progressively more complete tally, and takes that tally with the next input.  For instance, to add all members of a dataset, a fold action would add the current input to the previous tally and return the result, which is used as the next tally.  To find the maximum datum, it would return the pairwise maximum of the input and the tally at each step.  (Despite its name, this is what a Hadoop "reducer" does.)

{% include figure.html url="fold.png" caption="" %}

The data flow includes the input, output, and possibly tally as described above, plus a collection of auxiliary data known as cells and pools.  Cells are constants or variables whose name and type are known before running the scoring engine and pools are variables that can be created and destroyed at run-time.  They may be private (accessible to only one instance of a scoring engine) or shared (accessible to many).

{% include figure.html url="flowData.png" caption="" %}

Cells and pools are illustrated with [interactive examples below](#cells-and-pools).

## Simple scoring engines

Let's begin with a nearly minimal PFA document.  (The most minimal document, `{"input": "null", "output": "null", "action": null}`, inputs nothing, outputs nothing, and does nothing.)

The scoring engine below takes numerical input and adds `100` to each value.  Press the "play" triangle to run it.

{% include engine1.html id="test1" %}
1
2
3
{% include engine2.html %}
input: double
output: double
action:
  - {+: [input, 100]}
{% include engine3.html %}

This applet uses a PFA-enabled servlet running in [Google App Engine](https://developers.google.com/appengine/){:target="_blank"} to evaluate PFA (the [pfa-gae](https://github.com/scoringengine/pfa-gae){:target="_blank"} project).  (If it's taking several seconds to respond, it's most likely because GAE is launching a new servlet instance.  Subsequent calls will be faster.)

For this demo, input data are represented as JSONS (a JSON string on each line of text) and the PFA document is represented as [YAML](http://yaml.org/){:target="_blank"}.  YAML is similar to JSON but with a more human-friendly syntax; the document is converted into JSON before interpreting it as PFA.  For our purposes, YAML is equivalent to JSON, but with indentation for nesting, lines starting with a hyphen (`-`) for JSON arrays, and most strings do not need to be quoted.

### Input and output

The `input` and `output` sections of the PFA document are [Avro](http://avro.apache.org/){:target="_blank"} type schemae (represented as YAML, so we do not need to quote the schema string `"double"`).  These schemae impose constraints on the input data (they must be numbers) and the `action`--- it must perform legal operations on type `"double"` and result in type `"double"`.

The following yields an error (in the PFA host) when attempting to read the input: the third line is not a number.

{% include engine1.html id="test1" %}
1
2
"Not a number."
{% include engine2.html %}
input: double
output: double
action:
  - {+: [input, 100]}
{% include engine3.html %}

The following yields an error (in the PFA host) when attempting to compile the document: it returns a string.

{% include engine1.html id="test1" %}
1
2
3
{% include engine2.html %}
input: double
output: double
action:
  - {+: [input, 100]}   # intermediate calculation
  - {string: "Actual output."}
{% include engine3.html %}

### Action

The `action` section of the PFA document is a JSON array of expressions.  Expressions are JSON objects (key-value pairs).  Function calls are simple expressions--- they have only one key-value pair, the key is the function name, and the value is its arguments.  Zero or more than one arguments must be wrapped in a JSON array (for exactly one argument, it's optional).  Function calls may be nested.

{% include engine1.html id="test1" %}
1
2
3
{% include engine2.html %}
input: double
output: double
action:
  - {m.sin: {+: [input, 100]}}
{% include engine3.html %}

{% include engine1.html id="test1" %}
1
2
3
{% include engine2.html %}
input: double
output: double
action:
  - {m.round: {"*": [{m.sin: {+: [input, 100]}}, 100]}}
{% include engine3.html %}

In a JSON array of expressions, the last one (the tail position) is taken to be the return value.

{% include engine1.html id="test1" %}
1
2
3
{% include engine2.html %}
input: double
output: double
action:
  - {+: [input, 10]}
  - {+: [input, 100]}
  - {+: [input, 1000]}
{% include engine3.html %}

If this looks like [Lisp](http://www.cliki.net/){:target="_blank"} to you, it should.  Lisp is known for being excellent for metaprogramming, the ability to create programs with programs, in a large part because its syntax is so simple and regular that the generator-programs do not need to handle many cases.  PFA is also meant to be generated programmatically, so we take advantage of the same feature, building a tree from JSON objects and arrays, rather than parentheses.

Unlike Lisp, PFA's symbol types and function call graph can be determined by statically analyzing a PFA document, which makes it safer to use in production.

### Symbols

Bare strings like `"input"` are references to previously defined symbols (variables).  When the action routine starts, `input` (and possibly `tally`) are the only available symbols.

New symbols can be created with `let`, which is not quite a function, so it is called a "special form".  Symbols have lexical scope, meaning that they are usable between the `let` form and the end of the enclosing block.

{% include engine1.html id="test1" %}
1
2
3
{% include engine2.html %}
input: double
output: double
action:
  - {let: {squared: {"**": [input, 2]}, cubed: {"**": [input, 3]}}}
  - {"*": [squared, cubed]}
{% include engine3.html %}

The following causes an out-of-scope error--- `"squared"` is unknown because it is only defined within the `do` block.

{% include engine1.html id="test1" %}
1
2
3
{% include engine2.html %}
input: double
output: double
action:
  - do:
    - {let: {squared: {"**": [input, 2]}, cubed: {"**": [input, 3]}}}
  - {"*": [squared, cubed]}
{% include engine3.html %}

The `let` form can only declare new symbols.  To change the value of a pre-existing symbol, use `set`.

{% include engine1.html id="test1" %}
1
2
3
{% include engine2.html %}
input: double
output: double
action:
  - {let: {minusSquared: {"**": [input, 2]}, cubed: {"**": [input, 3]}}}
  - {set: {minusSquared: {"u-": minusSquared}}}
  - {"*": [minusSquared, cubed]}
{% include engine3.html %}

The distinction between `let` and `set` (1) emphasizes the fact that declaring a new symbol is conceptually different from updating an old one, (2) protects from accidental-overwrite errors (particularly when generating PFA automatically), and (3) makes it easy to scan a PFA document and determine whether the algorithm is purely functional (no re-assignments) or not.

### Top-level fields

HERE


## Cells and pools

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.

Here's a bunch of text.


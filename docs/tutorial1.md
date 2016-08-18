---
layout: page
type: tutorial
title: "Tutorial 1: Scoring engines"
order: 20
noToc: true
---

## Running a scoring engine

In the previous section, I explained why you might want to use PFA to deploy your analytic.  In this section, I describe what it does and how to use it.

A PFA document is a JSON-based serialization of a scoring engine.  A scoring engine is an executable that has a well-defined input, a well-defined output, and performs a purely mathematical task.  That is, the calculation does not depend on the environment in which it is running--- it would produce the same result anywhere.

Since input must be collected from somewhere and output must be distributed somewhere, a part of your workflow must be aware of its environment.  This part, called the "pipeline framework," interprets data files or network protocols and funnels the data into and out of the scoring engine.  PFA must always be used in conjunction with such a system, which is also known as the "PFA host" because PFA runs within it as a virtual machine.

To illustrate this with a concrete example, a PFA-enabled [Hadoop](http://hadoop.apache.org/){:target="_blank"} job would look like this:

{% include figure.html url="hadoopExample.png" caption="" %}

Hadoop defines the map-reduce topology of the workflow, reads data from its distributed filesystem, delivers it to the mapper and reducer tasks, interprets the data format, and provides the data to PFA scoring engines.  The data analysis itself is performed by the scoring engines.

In a traditional Hadoop job, the mechanics of data handling and the logic of the data analysis are compiled together in an executable jar file.  In the PFA-enabled Hadoop job, the executable jar file only manages data and interprets PFA.  The logic of the data analysis is expressed in a PFA document, which is provided as a configuration file and may be changed without modifying the executable jar.

A similar story could be told for a PFA-enabled Storm application, or a PFA-enabled Spark application, or any other.  The point of PFA is that it is embedded into many different environments, so it has no single executable.  You may even build one yourself, starting from a [generic PFA library](https://github.com/scoringengine/pfa){:target="_blank"} or from scratch, following the [language specification](http://github.com/scoringengine/pfa/blob/master/pfa-specification.pdf?raw=true).

For these examples, we will use a PFA-enabled servlet running in [Google App Engine](https://developers.google.com/appengine/){:target="_blank"}.  Most examples respond quickly; if it's taking several seconds, Google App Engine is probably launching a new servlet instance for you.  Subsequent calls will be faster.

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

Try adding one of these zero-parameter functions, which is to say, constants: `{"m.pi": []}` and `{"m.e": []}`.  (A PFA host doesn't have to implement zero-parameter functions as functions--- it could implement them as inline constants or whatever is most appropriate for the environment it runs in.)  There are many other functions in the [function library](/pfa/docs/library/){:target="_blank"}.

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

## Methods of output

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

The map method is simply a mathematical function: one input yields one output.

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

Emit methods can be used to construct filters (emit zero or one outputs for every input) or table-generating functions (such as UDTFs for SQL lateral view clauses).

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
merge:
  - {+: [tallyOne, tallyTwo]}
{% include engine3.html %}

A folding engine must also have two methods for combining data: "action" combines an `input` (of type **input**) with a current running `tally` (of type **output**) and "merge" combines `tallyOne` and `tallyTwo` (both with type **output**).  In both cases, calling the method outputs the sum and replaces the running `tally`.

The two methods are needed so that instances of the scoring engine may be distributed to independent processors, which call "action" on the input data to obtain partial sums, and then these partial sums are returned and combined with "merge" to yield a final result.  This can be applied to any mathematical operation that obeys an associative law (i.e. a monoid).

The most common example of a fold is a sum of numbers, but any data type may be used as long as it obeys an associative law.  For instance, string concatenation is associative (e.g. free monoid over the alphabet).  In this example, we turn input integers into strings and concatenate strings.  This calculation may be distributed over a network because partial sums can be combined with the "merge" method.

{% include engine1.html %}
1
2
3
4
5
{% include engine2.html %}
input: int
output: string
method: fold
zero: ""
action:
  - {s.concat: [tally, {s.int: input}]}
merge:
  - {s.concat: [tallyOne, tallyTwo]}
{% include engine3.html %}

Note that `input` needs to be converted from an integer to a string (with `s.int`), but `tallyOne` and `tallyTwo` are already strings.

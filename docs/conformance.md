---
layout: page
type: reference
title: Testing
order: 50
noToc: true
---

## Conformance test suite

In addition to the human-readable [specification document](http://github.com/datamininggroup/pfa/releases/download/0.8.1/pfa-specification.pdf), a suite of coverage tests are provided to clarify the specification. Currently, these tests are not considered normative, but a future version of them may be.

PFA implementations may verify their conformance or degree of conformance by attempting to reproduce the results of these tests. The tests are provided as a [large JSON file](http://github.com/datamininggroup/pfa/releases/download/0.8.1/pfa-tests.json).

## Format of the file

Here is the beginning of the file, showing the top-level structure and an example of the "+" function.

<pre>
{"pfa-version": "0.8.1",
 "pfa-tests": [
     {"function": "+",
      "engine":
          {"input":
               {"type": "record",
                "name": "Input",
                "fields": [
                    {"name": "x", "type": "int"},
                    {"name": "y", "type": "int"}
                ]},
           "output":
               "int",
           "action":
               {"+": [
                   "input.x",
                   "input.y"
               ]}
          },
      "trials": [
          {"sample": {"x": 2147483640, "y": 10}, "error": 18000},
          {"sample": {"x": 0, "y": 0}, "result": 0},
          {"sample": {"x": 0, "y": 1}, "result": 1},
          {"sample": {"x": 0, "y": -1}, "result": -1},
          {"sample": {"x": 0, "y": 2}, "result": 2},
          {"sample": {"x": 0, "y": -2}, "result": -2},
          ...
</pre>

The indentation aids human-readability and parsing: you can rely on each function beginning with a newline and five spaces.

More formally, the file has the following structure (all-caps text and ellipsis are entities, all other characters are literal):

<pre>
{"pfa-version": VERSION, "pfa-tests": [TESTS...]}
</pre>

where <tt>VERSION</tt> is the PFA version number and each <tt>TEST</tt> is

<pre>
{"function": NAME, "engine": PFA, "trials": [TRIALS...]}
</pre>

with <tt>NAME</tt> being the name of the function under study, <tt>PFA</tt> is a complete PFA engine that calls that function, and <tt>TRIALS</tt> are sample inputs and expected outputs. The format of a <tt>TRIAL</tt> that should successfully produce a result is:

<pre>
{"sample": {INPUT-VARIABLES...}, "result": RESULT}
</pre>

and the format of a <tt>TRIAL</tt> that should fail with an error is:

<pre>
{"sample": {INPUT-VARIABLES...}, "error": CODE}
</pre>

<tt>INPUT-VARIABLES</tt> are key-value pairs, setting each field in the input record, <tt>RESULT</tt> is a JSON representation of the result, and <tt>CODE</tt> is the unique numeric code of the exception.

## Format of values

Input values and output values are represented in a way that is similar to Avro's JSON encoding, with numbers representing numbers, strings representing strings or enumerations, JSON objects representing maps or records, and JSON arrays representing arrays.

Tagged unions follow the Java-Avro convention:

<pre>
{TAG: VALUE}
</pre>

where <tt>TAG</tt> is the name of the type and <tt>VALUE</tt> is the value. This form is used for all types except <tt>null</tt>, which is represented as a simple JSON null.

Infinity and not-a-number, which are legal values for types <tt>float</tt> and <tt>double</tt>, cannot be represented in JSON without quotes. We therefore use the following convention:

   * Positive infinity: the string <tt>"inf"</tt>
   * Negative infinity: the string <tt>"-inf"</tt>
   * Not a number: the string <tt>"nan"</tt>
   * Any other number: an unquoted number, e.g. <tt>3.14</tt>

Non-unicode characters cannot be represented in JSON, so the <tt>bytes</tt> and <tt>fixed</tt> types are represented by a [Base-64 encoding](https://en.wikipedia.org/wiki/Base64).

Schemas are required to interpret the input and output, and these schemas can be found in the PFA itself (the <tt>input</tt> and <tt>output</tt> top-level fields).

## Helper functions

A Python file named [runTest.py](https://github.com/datamininggroup/pfa/blob/master/conformance-tests/runTest.py) is provided to interpret the conformance file and provide values to an implementation in Python. It also contains functions to check the output type and deeply compare output values.

Implementation-specific scripts are provided in the same directory, which show how it can be used.

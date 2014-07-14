---
layout: page
type: tutorial
title: "Tutorial 2: Programming"
order: 21
---

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

## Control flow

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

PFA has the standard pre-test loops:

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

And post-test loops:

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

Unconditional loops expose the PFA host to the possibility that a user's algorithm will run indefinitely.  This would be bad in production, since a misconfigured PFA document could cause the system to hang.  PFA hosts have several ways to protect themselves:

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

## Functions and callbacks

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

## Realistic example

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
  <div style="border: 2px solid #dddddd;"><div style="height: 0px;"><div style="padding-top: 4px; margin-left: auto; width: intrinsic; padding-left: 3px; padding-right: 3px; position: relative; top: -3px; z-index: 100; font-family: 'PT Sans', Helvetica, Arial, sans-serif; font-weight: bold;" class="label">Javascript syntax</div></div><textarea id="jsin">input = "int";
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
};</textarea><div style="height: 0px;"><div style="padding-top: 4px; margin-left: auto; width: intrinsic; padding-left: 3px; padding-right: 3px; position: relative; bottom: 80px; z-index: 100; font-family: 'PT Sans', Helvetica, Arial, sans-serif; font-weight: bold;" class="label">
    <label><input id="debuggingInfo" type="checkbox" name="debuggingInfo" value="toggle" onChange="updatePfa();"></input> debugging info</label><br>
    <label><input id="prettyPrint" type="checkbox" name="prettyPrint" value="toggle" onChange="updatePfa();"></input> pretty-print</label><br>
    <label><input id="showErrors" type="checkbox" name="showErrors" value="toggle" onChange="updatePfa();" checked></input> show errors</label>
  </div></div></div>
  <div style="border: 2px solid #dddddd; border-top: none;"><div style="height: 0px;"><div style="padding-top: 4px; margin-left: auto; width: intrinsic; padding-left: 3px; padding-right: 3px; position: relative; top: -3px; z-index: 100; font-family: 'PT Sans', Helvetica, Arial, sans-serif; font-weight: bold;" class="label">Generated PFA (JSON)</div></div><textarea id="pfaout"></textarea></div>
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

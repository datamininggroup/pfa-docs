---
layout: page
type: tutorial
title: Statistical models
order: 50
noToc: true
---

## Modeling strategy

The previous tutorials presented the breadth of PFA's features with simple calculations, but most real applications make use of advanced math, statistical models, and machine learning algorithms.  PFA provides these as a suite of built-in functions, organized in modules.  Complex models are not usually made by hand (like programming in conventional languages), but by a tool called a producer (software that produces PFA programs).  Once a model has been produced, it can be sent to another tool, called a consumer, whose purpose is to execute the scoring procedure implied by the model.  The producer and the consumer may be different or even unrelated software packages.

Producers are typically extensions to preexisting statistical packages or add-ons to statistical software that knows nothing about PFA. The producer only needs to know the PFA functions of interest, such as the ones that implement one model and any necessary pre- and post-processing. For instance, if an analyst has a favorite R package, he or she would only need to extract model parameters from that package and match them to the corresponding PFA data structures and function names. This could happen within a reusable script or as a one-off, following a cookbook example.

Consumers are typically specialized PFA engines. A PFA consumer needs to understand a large enough subset of the PFA language (or possibly the whole language) to implement several choices of models, as well as all likely pre- and post-processing functions. It may implement them as an interpreter, compiled bytecode, or even a circuit design, but that implementation must rigidly adhere to the PFA specification for the functions it covers. Such a project cannot be easily accomplished as a one-off, so most consumers are large, reusable libraries.

The general strategy is to use the most appropriate tool to produce a model, convert it to PFA, and then use a dedicated PFA consumer to integrate it into a production system.  This maximizes flexibility for the analysts and robustness for the production system.

## Examples of models in PFA

This tutorial shows how a few types of models can be described in PFA.  The PFA documents presented in this tutorial are examples of what a PFA producer (or conversion script) must construct.

### Clustering model

[K-means clustering](http://en.wikipedia.org/wiki/K-means){:target="_blank"} reduces a large set (_N_) of _d_-dimensional vectors to a small set (_k_) of _d_-dimensional cluster centers.  There are several variations of this technique (mostly different ways of seeding Lloyd's algorithm), but all partitional, centroid-based algorithms result in a set of cluster centers with the prescription that new vectors must be matched to the closest center.  This is what PFA encodes.

Here is an example cluster model with artificially positioned cluster centers.

{% include engine1.html %}
[1.2, 1.2, 1.2, 1.2, 1.2]
[1.8, 1.8, 1.8, 1.8, 1.8]
[2.2, 2.2, 2.2, 2.2, 2.2]
[5.0, 5.0, 5.0, 5.0, 5.0]
[-1000.0, -1000.0, -1000.0, -1000.0, -1000.0]
{% include engine2.html %}
input: {type: array, items: double}
output: string
cells:
  clusters:
    type:
      type: array
      items:
        type: record
        name: Cluster
        fields:
          - {name: center, type: {type: array, items: double}}
          - {name: id, type: string}
    init:
      - {id: one, center: [1, 1, 1, 1, 1]}
      - {id: two, center: [2, 2, 2, 2, 2]}
      - {id: three, center: [3, 3, 3, 3, 3]}
      - {id: four, center: [4, 4, 4, 4, 4]}
      - {id: five, center: [5, 5, 5, 5, 5]}
action:
  attr:
    model.cluster.closest:
      - input
      - cell: clusters
      - params:
          - x: {type: array, items: double}
          - y: {type: array, items: double}
        ret: double
        do:
          metric.euclidean:
            - fcn: metric.absDiff
            - x
            - y
  path: [[id]]
{% include engine3.html %}

The cluster centers are stored as a `cell` (see [Tutorial 3](../tutorial3)) whose `type` is an array of `Cluster` records and whose `init` (initial value) defines 5-dimensional centers labeled as "one" through "five".

The action is a call to the "model.cluster.closest" function, which takes a vector (`input`), a set of clusters (`cell: clusters`), and a metric, and returns the closest.  The specification of this function is the following:

{% include figure-frame.html url="model_cluster_closest.png" caption="" %}

Many library functions are polymorphic like this one.  The `datum` must be an array of objects whose type is not specified, but is labeled as `A`.  The `clusters` must be an array of records `C`, and the only requirement is that they have a field named `center`, which is an array of `B`.  In our example, the `Cluster` type also has a field named `id`, which we use as a score output.  The metric maps `A` and `B` to real numbers (`double`), and the function returns the closest cluster record `C`.

Thus, the data and clusters can be anything, even non-numeric objects, as long as there is a metric function that maps them to real numbers.  One application of this would be to perform clustering on categorical data, with `A` and `B` resolving to type `string` and a metric that yields `0.0` for different strings or `1.0` for the same string.  Another would be to perform clustering on sequences, with `A` and `B` resolving to arrays and a metric that yields the Levenshtein distance.  The type specification is restrictive enough to ensure that the data can be scored, but generic enough to allow for unforeseen uses.

In the above example, the metric is a inline function--- a special form with three keys: `params`, `ret`, and `do`.  The purpose of this is to partially apply the Euclidean metric function:

{% include figure-frame.html url="metric_euclidean.png" caption="" %}

with a reference (`fcn`) to absolute difference similarity:

{% include figure-frame.html url="metric_absDiff.png" caption="" %}

The "metric.absDiff" function defines how individual components are compared, and the "metric.euclidean" function defines how componentwise differences are combined and how missing values are handled.  The resulting function takes the absolute value of componentwise differences ("metric.absDiff") and combines them with the root sum of squares ("metric.euclidean").

In summary, the `action` calls a library function ("model.cluster.closest"), which has a callback to an inline function, which calls a library function ("metric.euclidean"), which has a callback to another library function ("metric.absDiff").  Each of these could be replaced by another function with a compatible signature, or even a user-defined function.  Although this is a long-winded way to ask for a very common distance metric, breaking it up like this maximizes flexibility.  Since PFA documents are usually constructed programmatically, this kind of complex nesting could be deligated to a subroutine.

### Tree model

[Classification and regression trees](http://en.wikipedia.org/wiki/Classification_and_regression_tree){:target="_blank"} make predictions about one feature based on a series of tests applied to the other features.  The tests are hierarchical, and thus form a tree-like flow chart.  There are many ways to optimize trees, many ways to define selections on numerical and categorical data, and many ways to prune overfitted trees.  PFA only represents the final tree and uses it as a machine to generate predictions.

Here is a hand-built example of a binary tree with four leaves.  In real applications, the trees would be built programmatically by a recursive function.

{% include engine1.html %}
{"one": 1, "two": 7, "three": "whatever"}
{"one": 1, "two": 0, "three": "whatever"}
{"one": 15, "two": 7, "three": "TEST"}
{"one": 15, "two": 7, "three": "ZEST"}
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
        - name: field
          type:
            type: enum
            name: Fields
            symbols: [one, two, three]
        - {name: operator, type: string}
        - {name: value, type: [int, double, string]}
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
          pass: {string: yes-yes}
          fail: {string: yes-no}
      fail:
        TreeNode:
          field: three
          operator: ==
          value: {string: TEST}
          pass: {string: no-yes}
          fail: {string: no-no}
action:
  - model.tree.simpleWalk:
      - input
      - cell: tree
      - params: [{d: Datum}, {t: TreeNode}]
        ret: boolean
        do: {model.tree.simpleTest: [d, t]}
{% include engine3.html %}

As in the clustering case, the tree type and value are stored in a `cell`, and the scoring procedure is a call to "model.tree.simpleWalk" in the `action` section.  This function takes one callback, "model.tree.simpleTest", which defines how to interpret a test at one node of the tree, while "model.tree.simpleWalk" defines how to take the results of the tests and walk through the tree.  Both of these are "simple" because there are more complex methods of computing predicates and walking through trees with missing data.

The two functions, "model.tree.simpleTest" and "model.tree.simpleWalk", are both polymorphic and they both put constraints on the `TreeNode` type.  The first requires `TreeNode` to have `field`, `operator`, and `value` fields, so that it can make a decision based on a field of the `Datum`, an operator like "<" or "==", and a value for comparison.  The second requires `TreeNode` to have `pass` and `fail` fields, which lead to another `TreeNode` or a score, and are followed based on whether the predicate passed or failed.

Here is the specification of "model.tree.simpleTest":

{% include figure-frame.html url="model_tree_simpleTest.png" caption="" %}

And here is the specification of "model.tree.simpleWalk":

{% include figure-frame.html url="model_tree_simpleWalk.png" caption="" %}

The fact that leaves must have scores is encoded in the type specification.  The `pass` and `fail` fields must both be unions of `T` (which resolves to `TreeNode`) and `S` (which resolves to `string` in this example).  Therefore, `pass` could be another `TreeNode` or it could be an object with the score type, and because trees are finite and have no loops, they all eventually lead to scores.  Since the score is not an additional field attached to the `TreeNode`, there is no ambiguity of whether the score pertains to this level of the tree or the next level down.

Trees provide a good illustration of the usefulness of generic functions.  The score is generic, so the function can be used for classification (`S` is `string`), regression (`S` is `double`), multivariate regression (`S` is an array of `double`), embedded models (`S` is another model type), and other cases not yet imagined.  But using the same type label `S` constrains the `pass` and `fail` branches to lead to the same score type and the output of the function to return that same score type.  The type specification is loose enough to allow for a broad and open-ended range of use-cases, but it is tight enough to ensure that the types match before running the scoring engine, and to have enough information to generate fast, compilable code or bytecode.

### Change detection

In the above examples, the model data was stored in a `cell` and never changed.  The only reason to change the model is if it were updating in response to incoming data.  This situation is rare for clusters and trees, but important for change detection.

[Change detection](http://en.wikipedia.org/wiki/Change_detection){:target="_blank"} is a set of techniques that try to identify when a dataset is no longer consistent with a given baseline model.  To maximize sensitivity and minimize false positives, many techniques make this decision on the basis of multiple observations.  To remember past observations, the state of the scoring engine must change.

Below is an example of a [cumulative sum (CUSUM)](http://en.wikipedia.org/wiki/CUSUM){:target="_blank"} scoring engine that detects a break where the data switch from 2.0 ± 5.0 to 10.0 ± 3.0 (after line 10).

{% include engine1.html %}
3.35
-1.37
-3.92
6.74
12.06
3.81
3.35
-1.18
-1.39
5.55
5.3
12.8
10.36
12.05
3.8
12.81
11.1
8.37
7.32
15.22
{% include engine2.html %}
input: double
output: boolean
cells:
  last:
    type: double
    init: 0.0
method: emit
action:
  cell: last
  to:
    params: [{oldValue: double}]
    ret: double
    do:
      - let:
          newValue:
            stat.change.updateCUSUM:
              - "-":
                  # alternate
                  - prob.dist.gaussianLL: [input, 10.0, 3.0]
                  # baseline
                  - prob.dist.gaussianLL: [input, 2.0, 5.0]
              - oldValue
              - 0.0  # resetValue
      - emit: {">": [newValue, 5.0]}
      - newValue
{% include engine3.html %}

The "stat.change.updateCUSUM" function takes a callback for the log likelihood, which could be a user-defined function to allow arbitrary probability distributions, but the above example simply requests the Gaussian log likelihood from the appropriate module: "prob.dist.gaussianLL".

{% include figure-frame.html url="stat_change_updateCUSUM.png" caption="" %}

Since PFA functions cannot change the value of data in-place, "stat.change.updateCUSUM" inputs the old cumulative sum and outputs the new one.  The value of the cell must be explicitly replaced with a `cell`-`to` special form.

The `to` part of the `cell`-`to` form takes a callback because cells may be shared, and thus writing to it must be an atomic operation (see [Tutorial 3](../tutorial3)).  The callback defines the granularity of the atomic operation: while this anonymous function is running, no other writers can operate on the cell.  (Readers, however, are not blocked and will get the old value until the operation is finished.)  Therefore, this small CUSUM example could be scaled up to many independent scoring engines, running in parallel, yet combining change-detection significance.

(Note: a large number of independent actors contending for the same resource frequently would result in latency.  Real examples of shared state are usually segmented so that the scoring engines are filling different, domain-relevant bins.  See below.)

### Segmented models

[Segmentation](http://en.wikipedia.org/wiki/Market_segmentation){:target="_blank"} is a simple way to make a model more local (more parameters, fewer assumptions, and requiring more data for significance).  One or more features is divided into segments and a separate, independent model is associated with each segment.

In PFA, all model types can be segmented by replacing a model in a `cell` (single value) with a collection of models in a `pool` (map from string-based keys to values).  In the example below, `Counters` accumulate a `count`, `mean`, and `variance` from data associated with one key each, and a new `Counter` is created whenever a new key is encountered.

{% include engine1.html %}
{"key": "one", "value": 100.1}
{"key": "one", "value": 101.3}
{"key": "one", "value": 100.9}
{"key": "one", "value": 101.1}
{"key": "one", "value": 101.0}
{"key": "two", "value": 202.1}
{"key": "two", "value": 202.3}
{"key": "two", "value": 202.9}
{"key": "two", "value": 202.1}
{"key": "two", "value": 202.0}
{"key": "one", "value": 100.1}
{"key": "one", "value": 101.3}
{"key": "one", "value": 100.9}
{"key": "one", "value": 101.1}
{"key": "one", "value": 101.0}
{"key": "two", "value": 202.1}
{"key": "two", "value": 202.3}
{"key": "two", "value": 202.9}
{"key": "two", "value": 202.1}
{"key": "two", "value": 202.0}
{% include engine2.html %}
input:
  type: record
  name: Input
  fields:
    - {name: key, type: string}
    - {name: value, type: double}
output:
  type: record
  name: Output
  fields:
    - {name: key, type: string}
    - {name: zValue, type: double}
pools:
  counters:
    type:
      type: record
      name: Counter
      fields:
        - {name: count, type: double}
        - {name: mean, type: double}
        - {name: variance, type: double}
method: emit
action:
  pool: counters
  path: [input.key]
  init:
    type: Counter
    value: {count: 0.0, mean: 0.0, variance: 0.0}
  to:
    params: [{oldCounter: Counter}]
    ret: Counter
    do:
      - let:
          newCounter:
            stat.sample.update:
              - input.value
              - 1.0  # weight
              - oldCounter
      - if: {">": [newCounter.count, 3]}
        then:
          emit:
            type: Output
            new:
              key: input.key
              zValue:
                stat.change.zValue:
                  - input.value
                  - newCounter
                  - false  # unbias
      - newCounter
{% include engine3.html %}

The semantics of a `pool` are almost the same as the semantics of a `cell`, so it's easy to turn a single model into a segmented model.  The main difference is that modifying a `pool` requires an `init` field, to handle the case of a non-existent key, as well as a `to` field, to handle the case of updating an existing key.  Modifications of `pools` are granular by key: if two scoring engines try to modify the same key of the same `pool`, one has to wait, but if they try to modify different keys, they can act in parallel.

In the example above, the scoring engine updates sampling statistics with "stat.sample.update" and if more than three values have been collected, it emits the z-value of the current instance.  It therefore acts as a change detection algorithm, segmented by `key`, that adapts its baseline to the observed data.  (A better implementation might use "stat.sample.updateWindow" to obtain sample statistics from a sliding time window and/or "stat.change.updateTrigger" to look for extended runs of anomalous values.)

The specification of "stat.sample.update" is:

{% include figure-frame.html url="stat_sample_update.png" caption="" %}

And the specification of "stat.change.zValue" is:

{% include figure-frame.html url="stat_change_zValue.png" caption="" %}

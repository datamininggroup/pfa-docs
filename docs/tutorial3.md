---
layout: page
type: tutorial
title: "Tutorial 3: Data flow"
order: 22
noToc: true
---

## Begin, action, end

A PFA scoring engine processes a linear stream of data that has a beginning and possibly an end.  Each datum in the stream has the same type and comes from the same source, so if you want to combine data of different types from different sources, create two or more scoring engines and connect them in a pipeline system.

In some cases, you may want to perform special actions at the beginning and end of a data stream.  PFA has `begin` and `end` routines for this purpose (similar to [awk](http://www.gnu.org/software/gawk/manual/gawk.html){:target="_blank"}).

{% include figure.html url="flowTime.png" caption="" %}

The `begin` and `end` routines do not accept input and do not return output; they only manipulate persistent storage.

## Persistent storage

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
output: int
cells:
  one: {type: int, init: 1}
  two: {type: int, init: 2}
action:
  - {cell: one, to: {fcn: u.changeOne}}

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
      - {cell: two, to: {fcn: u.changeTwo}}
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

## Model parameters

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
        - name: field
          type:
            type: enum
            name: TreeFields
            symbols: [one, two, three]
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
  - model.tree.simpleWalk:
      - input
      - cell: tree
      - params: [{d: Datum}, {t: TreeNode}]
        ret: boolean
        do: {model.tree.simpleTest: [d, t]}
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

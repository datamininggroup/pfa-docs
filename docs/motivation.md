---
layout: page
type: tutorial
title: What is PFA for?
order: 10
noToc: true
---

## Hardening a data analysis

Data analysis is not software development: a different set of best practices apply.  For a large software project, one should start by designing a maintainable architecture, but for data analysis, one should start by examining the dataset in as many ways as possible.  Sometimes, a simple observation in this exploratory phase dramatically changes one's analysis strategy.

The worlds of data analysis and software development clash when a poorly structured analytic procedure must be scaled up to a large production workflow.  The “try anything, get feedback quickly” mindset that was an asset in the development phase leads to failures in production.  As data analyses mature, they must be hardened— they must have fewer dependencies, a more maintainable structure, and they must be robust against errors.

{% include two-figure.html url1="messy_desk_contest_winner.jpg" caption1="Development: insight comes from exploratory tinkering." url2="BalticServers_data_center.jpg" caption2="Production: scalability comes from good design." %}

The Portable Format for Analytics (PFA) is a common language to help smooth the transition from development to production.  PFA-enabled analysis tools produce their results as JSON documents with a structure defined by the PFA specification.  For instance, suppose a machine learning algorithm produces a classifier that we wish to apply to a large cluster-bound dataset.  If it produces that classifier in PFA format, a PFA-enabled host running on the cluster can execute it in a safe, controlled way.

Developer tools that speak PFA can deploy their scoring engines (e.g. classifiers, predictors, smoothers, filters) on production environments that understand PFA.  The only connection between the two worlds is the PFA document, a human-readable text file.  In fact, this text file could have contributions from several statistical packages, or it could be modified by JSON-manipulating tools or by hand before it is delivered.

{% include figure.html url="pfatoeverything.png" caption="" %}

By contrast, scoring engines in custom formats present the system maintainers with three options: (a) try to install the data analyst's tool across the production environment, including all of its dependencies, (b) port the algorithm and spend weeks chasing small (but compounding) numerical errors, and (c) dumb-down the analytic.  None of these are good options.

## Separation of concerns

Analysis code only needs to be hardened if it will be executed often or at large scale.  A one-time study on an analyst's laptop does not need to adhere to software design principles.  But in this era of Big Data, many analyses are crossing the threshold from laptops to server farms, and so deployment issues are becoming more common than ever.

Tools such as Hadoop and Storm provide automated data pipelines, separating the data flow from the functions that are performed on data (mappers and reducers in Hadoop, spouts and bolts in Storm).  Ordinarily, these functions are written in code that has access to the pipeline internals, the host operating system, the remote filesystem, the network, etc.  However, all they should do is math.

{% include figure.html url="pipeline2.png" caption="" %}

PFA completes the abstraction by encapsulating these functions as PFA documents.  From the point of view of the pipeline system, the documents are configuration files that may be loaded or replaced independently of the pipeline code.

This separation of concerns allows the data analysis to evolve independently of the pipeline.  Since scoring engines written in PFA are not capable of accessing or manipulating their environment, they cannot jeopardize the production system.  Data analysts can focus on the mathematical correctness of their algorithms and security reviews are only needed when the pipeline itself changes.

This decoupling is important because statistical models usually change more quickly than pipeline frameworks.  Model details are often tweaked in response to discoveries about the data and models frequently need to be refreshed with new training samples.

## Flexibility and safety

Traditionally, scoring engines have been deployed in one of two ways: as a table of model parameters or as custom code.  A table of parameters needs to be interpreted before it can classify or predict anything, so it implicitly comes with a fixed executable, usually the statistical package that produced it.

The problem with a table of parameters is that it is inflexible: its associated executable can only perform the operation it was designed to do.  The problem with custom code is that it is too powerful, as explained in the previous section.

{% include figure.html url="spectrum2.png" caption="" %}

The [Predictive Model Markup Language (PMML)](http://www.dmg.org/){:target="_blank"} was an attempt to bridge this gap by standardizing several of the most common kinds of scoring engines.  Like PFA, PMML documents are intermediate text files (XML) produced by data analysis tools and consumed by an executable in the production environment.  New functionality has been added to PMML over the past 17 years, but it is still based on tables of model parameters.  Even a modest extension of a scoring engine requires a new version of PMML to be adopted, which can take years.

PFA serves this purpose with far more generality.  Unlike PMML, PFA has control structures to direct program flow, a true type system for both model parameters and data, and its statistical functions are much more finely grained and can accept callbacks to modify their behavior.  The author of a PFA document can construct new types of models from building blocks without waiting for the new model to be explicitly added to the specification.

PFA is more flexible than PMML, but safer than custom code.  In the language of optimizations, it is the most flexible way to describe a scoring engine subject to the constraint that it won't break the data pipeline.

## Overview of PFA capabilities

The following contribute to PFA's _flexibility:_

* It has control structures, such as conditionals, loops, and user-defined functions (like a typical programming language).
* It is entirely expressed within JSON, and can therefore be easily generated and manipulated by other programs.  This is important because PFA documents are usually generated from training data by a statistical package or a machine learning algorithm.
* Its library of functions is finely grained: multi-step processes are defined by chaining multiple functions.  A user with a new type of model in mind can mix and match these library functions as needed.
* Many library functions accept callbacks to further modify their behavior.
* Scoring engines can share data or update external variables, such as entries in a database.

The following contribute to PFA's _safety:_

* It has strict numerical compatibility: the same PFA document and the same input results in the same output, regardless of platform.
* The specification only defines functions that transform data.  All inputs and outputs are controlled by the host system.
* It has a type system that can be statically checked.  Specifically, PFA types are [Avro types](http://avro.apache.org/){:target="_blank"} (Avro is a data serialization format used to move data in several popular pipeline frameworks).  This system has a type-safe null and PFA only performs type-safe casting, which ensure that missing data never cause run-time errors.
* The callbacks that generalize PFA's statistical models are not first-class functions.  This means that the set of functions that a PFA document might call can be predicted before it runs.  A PFA host may choose to only allow certain functions.
* The semantics of shared data guarantee that data are never corrupted by concurrent access and scoring engines do not enter deadlock.  The host can also statically determine which shared variables may be modified by a scoring engine, rather than at run-time.

To learn more, read the tutorials (which have interactive examples, so that you can see PFA in action) or the complete reference, which are linked in the sidebar or at the <a href="#top-of-page" onclick="$('body').animate({scrollTop: 0}, 1000); return false;">top of this page</a>.

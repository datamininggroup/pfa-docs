---
layout: page
type: tutorial
title: What is PFA for?
order: 10
---

## Hardening a data analysis

Data analysis is not software development.  A different set of best practices apply: when starting a large software project, one should design a maintainable architecture, but when analyzing a dataset, one should begin by examining the data with as many tools as possible.  Sometimes, a simple observation in this exploratory phase dramatically changes one's analysis strategy.

The worlds of data analysis and software development clash when a poorly structured analytic procedure must be scaled up to a large production workflow.  The “try anything, get feedback quickly” mindset that was an asset in the development phase leads to failures in production.  As data analyses mature, they must be hardened— they must have fewer dependencies, a more maintainable structure, and they must be more robust against errors.

{% include two-figure.html url1="messy_desk_contest_winner.jpg" caption1="Development: insight comes from exploratory tinkering." url2="BalticServers_data_center.jpg" caption2="Production: scalability comes from good design." %}

The Portable Format for Analytics (PFA) is a common language to help smooth the transition between development and production.  PFA-enabled analysis tools produce results as JSON documents with structure specified by PFA.  For instance, a machine learning algorithm produces a classifier function that we wish to evaluate over a large cluster-bound dataset.  If it produces the classifier in PFA format, a PFA-enabled host running on the cluster can analyze it, check it for security and suitability, and then execute it.

Any complex tangle of specialized tools may have been used to create the PFA document— it could be generated automatically by one statistical package, modified by another, and even tweaked by hand.  However, these tools do not need to run in the production environment.  The PFA document describes an exact numerical procedure that can be executed anywhere.

## Separation of concerns

If a data analysis only needs to be executed once, it does not need to be hardened.  But in the era of Big Data, considerably more analyses crossed the threshold from workstation to cluster farm, making deployment issues more common than ever.

New tools were developed to manage pipelines of data, such as Hadoop map-reduce, Storm real-time processing, Spark for iterative workflows, etc.  PFA itself is not a data pipeline; it describes a function to be inserted in a pipeline, to help you use pipelines more effectively.

{% include figure.html url="pipeline2.png" caption="A topology with one input, three functions, and two outputs.  The functions are PFA scoring engines." %}

For instance, a workflow consisting of three functional steps can be implemented with a pipeline framework, possibly application-specific code to handle custom data formats, and three PFA scoring engines, one for each function.  The pipeline and data formats are unlikely to change.  The mathematical functions, on the other hand, may need to be updated frequently to respond to discoveries about the data or to refresh models with new training samples.

PFA allows these mathematical functions to be versioned and reviewed separately from the pipeline itself.  Since the PFA specification is strictly limited to mathematical operations, faulty PFA documents may result in erroneous calculations, but they cannot jeopardize the stability or security of the production environment.  This sandbox frees the data analysts to focus on the part they know best: data analysis.

## Why not use X?

There are many ways to encode a function; most pipeline frameworks expect the function to be written in Java, Python, or any traditional language that communicates via standard input/standard output.  However, a complete programming language gives the scoring engine powers beyond mathematical processing that could destabilize the production environment.

At the other extreme, many machine learning packages produce classifiers or predictors as tables of parameters.  A file full of numbers is completely safe, but cannot be executed without a special-purpose scoring engine.  One trades flexibility for safety.

{% include figure.html url="spectrum2.png" caption="" %}

The [Predictive Model Markup Language (PMML)](http://www.dmg.org/) was an attempt to standardize these tables of numbers so that the original model-building package is not needed to evaluate the model in production.  Over the past 17 years, new functionality has been included in the PMML specification, but it is still the case that even modest extensions of the models it contains must wait for new versions of the whole language.

PFA serves the same purpose, but far more generally.  New types of statistical processes can be implemented in PFA using primitives and highly factorized model components.  PFA has a suite of common flow control structures (e.g. control structures and loops) and most model functions accept user-specified callbacks.

On a scale from the most rigid to the most flexible, PFA is the most flexible option that also cannot harm the production environment.

## PFA in the development process

In a typical development process, the data analysts produce PFA documents, test them, and then send them to the production system.  The production system checks the consistency of the documents and decides whether to execute them.

FIXME: limited enough that it can be implemented in restricted settings: FPGAs, GPUs, and web browsers.

{% include figure.html url="pfatoeverything.png" caption="" %}

The remaining sections (see left sidebar) explain how to use PFA with executable code exampples.

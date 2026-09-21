# Example dataset

<!--
Replace every section below. This file is the prose half of the contract and is
required: a dataset published without it fails the suite. `dataset-contract.yaml`
states what the columns are; this states what they mean, what the provider does
that a reader would not expect, and what this table must not be used for.

Say nothing here about what any consumer draws. Under the layer contract in
AGENTS.md a dataset may describe the provider and the table, never a report or a
figure. Where a guarantee covers a subset, name what the provider or the world
lacks — an area it discontinued, a series it has never split — not what a
consumer wants.
-->

## What this table is

One sentence on the grain and the population: what one row is, and over what
set of entities and periods the table is complete.

## Where it comes from

The source package and snapshot this is built from, the provider's own name for
the collection, and the release the rows belong to.

## Definitions

Each indicator in its own terms: what the provider counts, its denominator
where it has one, and the unit as published. Where this package derives a
column, give the formula and the columns it reads.

## What the period means

What a row's period refers to — a stock at an instant, a flow over the year
ending at it, a provider convention that dates an annual figure to 1 January.
State the convention even when it looks obvious; it is the commonest source of
a silent off-by-one downstream.

## Provider quirks

What the provider does that the rows do not explain on their own: an identity
that does not close, a location whose composition differs from its name, a
series that starts or stops at a different year from its neighbours, a value
rounded before publication. Each one is a fact about the provider, so record it
here rather than smoothing it away in the model.

## Limitations

What this table cannot answer, and which comparisons it does not support —
against another provider's version of the same measure, across a definitional
break, or below the published grain.

## Licence and attribution

The licence as the provider states it, the attribution string, and any
restriction on modification or redistribution that a reader of this table
inherits.

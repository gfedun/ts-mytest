/**
 * @fileoverview Async Map/FlatMap Implementation Patterns
 *
 * This file demonstrates various patterns for implementing async map and flatMap
 * operations in TypeScript, which are commonly needed when working with arrays
 * of async operations.
 */
import { Either } from '@/either';

// Parallel Execution with Promise.all()
// Use when you want all operations to run concurrently
async function asyncMapParallel<T, R>(
  items: T[],
  asyncMapper: (
    item: T,
    index: number
  ) => Promise<R>
): Promise<R[]> {
  return Promise.all(items.map(asyncMapper));
}

// Sequential Execution
// Use when operations must run one after another (e.g., to avoid overwhelming an API)
async function asyncMapSequential<T, R>(
  items: T[],
  asyncMapper: (
    item: T,
    index: number
  ) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i++) {
    const result = await asyncMapper(items[i], i);
    results.push(result);
  }
  return results;
}

// Async FlatMap (Parallel)
// Maps and flattens the results in parallel
async function asyncFlatMapParallel<T, R>(
  items: T[],
  asyncMapper: (
    item: T,
    index: number
  ) => Promise<R[]>
): Promise<R[]> {
  const nestedResults = await Promise.all(items.map(asyncMapper));
  return nestedResults.flat();
}

// Async FlatMap (Sequential)
// Maps and flattens the results sequentially
async function asyncFlatMapSequential<T, R>(
  items: T[],
  asyncMapper: (
    item: T,
    index: number
  ) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i++) {
    const nestedResult = await asyncMapper(items[i], i);
    results.push(...nestedResult);
  }
  return results;
}

// Async Filter + Map (Parallel)
// Filters and maps in parallel, handling Maybe/Either types
async function asyncFilterMapParallel<T, R>(
  items: T[],
  asyncPredicate: (item: T) => Promise<boolean>,
  asyncMapper: (item: T) => Promise<R>
): Promise<R[]> {
  // First, check which items pass the filter
  const filterResults = await Promise.all(
    items.map(async (
      item,
      index
    ) => ({
      item,
      index,
      passes: await asyncPredicate(item)
    }))
  );
  
  // Then map only the items that passed
  const filteredItems = filterResults
    .filter(result => result.passes)
    .map(result => result.item);
  
  return Promise.all(filteredItems.map(asyncMapper));
}

// Batch Processing,
// Processing items in batches to control concurrency
async function asyncMapBatched<T, R>(
  items: T[],
  asyncMapper: (item: T) => Promise<R>,
  batchSize: number = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(asyncMapper));
    results.push(...batchResults);
  }
  
  return results;
}

// With Error Handling (Either pattern)
async function asyncMapWithErrors<T, R>(
  items: T[],
  asyncMapper: (item: T) => Promise<R>
): Promise<Either<string, Awaited<R>>[]> {
  return Promise.all(
    items.map(async (item): Promise<Either<string, Awaited<R>>> => {
      try {
        const result = await asyncMapper(item);
        return Either.right(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Either.left(message);
      }
    })
  );
}

// Reduce-style accumulation with async
async function asyncReduce<T, R>(
  items: T[],
  asyncReducer: (
    acc: R,
    item: T,
    index: number
  ) => Promise<R>,
  initialValue: R
): Promise<R> {
  let accumulator = initialValue;
  for (let i = 0; i < items.length; i++) {
    accumulator = await asyncReducer(accumulator, items[i], i);
  }
  return accumulator;
}

export {
  asyncMapParallel,
  asyncMapSequential,
  asyncFlatMapParallel,
  asyncFlatMapSequential,
  asyncFilterMapParallel,
  asyncMapBatched,
  asyncMapWithErrors,
  asyncReduce
};

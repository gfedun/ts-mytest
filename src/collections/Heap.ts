/**
 * @fileoverview Heap (Priority Queue) Data Structure Implementation
 *
 * This module provides a generic Heap implementation that supports both min-heap
 * and max-heap configurations with custom comparators and key extractors.
 *
 * @author
 * @version 1.0.0
 */

import { Maybe } from '@/maybe';

/**
 * Heap order configuration
 */
export enum HeapOrder {
  MIN = 'min',
  MAX = 'max'
}

/**
 * Configuration options for Heap
 */
export interface HeapConfig<T> {
  /** Heap order: min-heap or max-heap */
  order: HeapOrder | 'min' | 'max';
  /** Custom comparator function (a, b) => number */
  compareFn?: (
    a: T,
    b: T
  ) => number;
  /** Key extractor function to specify which property to sort by */
  keyExtractor?: (item: T) => number | string;
  /** Initial capacity for the internal array */
  initialCapacity?: number;
}

/**
 * Generic Heap (Priority Queue) implementation
 *
 * Supports both min-heap and max-heap with configurable comparison logic.
 * Elements are stored in a complete binary tree structure using an array.
 */
export class Heap<T> {
  private _elements: T[] = [];
  private readonly _order: HeapOrder;
  private readonly _compareFn: ((
    a: T,
    b: T
  ) => number) | undefined;
  private readonly _keyExtractor: ((item: T) => number | string) | undefined;
  
  constructor(config: HeapConfig<T>) {
    this._order = config.order === 'min' ? HeapOrder.MIN : HeapOrder.MAX;
    this._compareFn = config.compareFn;
    this._keyExtractor = config.keyExtractor;
    
    if (config.initialCapacity && config.initialCapacity > 0) {
      this._elements = new Array(config.initialCapacity);
      this._elements.length = 0; // Reset length but keep capacity
    }
  }
  
  /**
   * Add an element to the heap
   */
  add(element: T): void {
    this._elements.push(element);
    this._heapifyUp(this._elements.length - 1);
  }
  
  /**
   * Remove and return the top element (min or max depending on heap order)
   */
  remove(): Maybe<T> {
    if (this._elements.length === 0) {
      return Maybe.nothing();
    }
    
    if (this._elements.length === 1) {
      const element = this._elements.pop()!;
      return Maybe.just(element as T);
    }
    
    const top = this._elements[0];
    this._elements[0] = this._elements.pop()!;
    this._heapifyDown(0);
    
    return Maybe.just(top);
  }
  
  /**
   * View the top element without removing it
   */
  peek(): Maybe<T> {
    return this._elements.length > 0
      ? Maybe.just(this._elements[0])
      : Maybe.nothing();
  }
  
  /**
   * Get the number of elements in the heap
   */
  size(): number {
    return this._elements.length;
  }
  
  /**
   * Check if the heap is empty
   */
  isEmpty(): boolean {
    return this._elements.length === 0;
  }
  
  /**
   * Remove all elements from the heap
   */
  clear(): void {
    this._elements.length = 0;
  }
  
  /**
   * Convert heap to array (does not preserve heap order)
   */
  toArray(): T[] {
    return [...this._elements];
  }
  
  /**
   * Convert heap to sorted array
   */
  toSortedArray(): T[] {
    const result: T[] = [];
    const tempHeapConfig: HeapConfig<T> = {
      order: this._order,
      ...(this._compareFn && { compareFn: this._compareFn }),
      ...(this._keyExtractor && { keyExtractor: this._keyExtractor })
    };
    
    const tempHeap = new Heap<T>(tempHeapConfig);
    
    // Copy all elements to temporary heap
    for (const element of this._elements) {
      tempHeap.add(element);
    }
    
    // Extract all elements in order
    while (!tempHeap.isEmpty()) {
      const elementMaybe = tempHeap.remove();
      if (Maybe.isJust(elementMaybe)) {
        result.push(elementMaybe.value);
      }
    }
    
    return result;
  }
  
  /**
   * Check if the heap contains a specific element
   */
  contains(element: T): boolean {
    return this._elements.includes(element);
  }
  
  /**
   * Get heap information for debugging
   */
  toString(): string {
    return `Heap(${ this._order }, size: ${ this.size() }, elements: [${ this._elements.join(', ') }])`;
  }
  
  // Private helper methods
  
  /**
   * Move element up the heap to maintain heap property
   */
  private _heapifyUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      
      if (!this._shouldSwap(index, parentIndex)) {
        break;
      }
      
      this._swap(index, parentIndex);
      index = parentIndex;
    }
  }
  
  /**
   * Move element down the heap to maintain heap property
   */
  private _heapifyDown(index: number): void {
    while (true) {
      let targetIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      
      if (leftChild < this._elements.length && this._shouldSwap(leftChild, targetIndex)) {
        targetIndex = leftChild;
      }
      
      if (rightChild < this._elements.length && this._shouldSwap(rightChild, targetIndex)) {
        targetIndex = rightChild;
      }
      
      if (targetIndex === index) {
        break;
      }
      
      this._swap(index, targetIndex);
      index = targetIndex;
    }
  }
  
  /**
   * Determine if two elements should be swapped based on heap order
   */
  private _shouldSwap(
    childIndex: number,
    parentIndex: number
  ): boolean {
    const comparison = this._compare(this._elements[childIndex], this._elements[parentIndex]);
    return this._order === HeapOrder.MIN ? comparison < 0 : comparison > 0;
  }
  
  /**
   * Compare two elements using the configured comparison logic
   */
  private _compare(
    a: T,
    b: T
  ): number {
    // Use custom comparator if provided
    if (this._compareFn) {
      return this._compareFn(a, b);
    }
    
    // Use key extractor if provided
    if (this._keyExtractor) {
      const keyA = this._keyExtractor(a);
      const keyB = this._keyExtractor(b);
      
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      return 0;
    }
    
    // Default comparison for primitive types
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
  
  /**
   * Swap two elements in the heap array
   */
  private _swap(
    i: number,
    j: number
  ): void {
    [this._elements[i], this._elements[j]] = [this._elements[j], this._elements[i]];
  }
}

/**
 * Utility functions for creating common heap configurations
 */
export class HeapUtils {
  
  /**
   * Create a min-heap for numbers
   */
  static createMinHeap<T = number>(): Heap<T> {
    return new Heap<T>({ order: HeapOrder.MIN });
  }
  
  /**
   * Create a max-heap for numbers
   */
  static createMaxHeap<T = number>(): Heap<T> {
    return new Heap<T>({ order: HeapOrder.MAX });
  }
  
  /**
   * Create a min-heap with custom key extractor
   */
  static createMinHeapBy<T>(keyExtractor: (item: T) => number | string): Heap<T> {
    return new Heap<T>({
      order: HeapOrder.MIN,
      keyExtractor
    });
  }
  
  /**
   * Create a max-heap with custom key extractor
   */
  static createMaxHeapBy<T>(keyExtractor: (item: T) => number | string): Heap<T> {
    return new Heap<T>({
      order: HeapOrder.MAX,
      keyExtractor
    });
  }
  
  /**
   * Create a min-heap with custom comparator
   */
  static createMinHeapWith<T>(compareFn: (
    a: T,
    b: T
  ) => number): Heap<T> {
    return new Heap<T>({
      order: HeapOrder.MIN,
      compareFn
    });
  }
  
  /**
   * Create a max-heap with custom comparator
   */
  static createMaxHeapWith<T>(compareFn: (
    a: T,
    b: T
  ) => number): Heap<T> {
    return new Heap<T>({
      order: HeapOrder.MAX,
      compareFn
    });
  }
}

// Type aliases for convenience
export type MinHeap<T> = Heap<T>;
export type MaxHeap<T> = Heap<T>;
export type PriorityQueue<T> = Heap<T>;

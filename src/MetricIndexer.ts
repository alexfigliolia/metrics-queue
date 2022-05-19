import { AutoIncrementingID } from "./AutoIncrementingID";
import type { Listener, MetricEvent, BustPluginMetric, BustPerformanceMark, BustPerformanceMeasure } from "./types";

/**
 * Metric Indexer
 *
 * It's pretty much a queue. But it's special. It'll assign and return DB-like
 * identifiers to each item that get's added. This allows for O(1) access and removal.
 *
 * If someone tries to access an entry using a forloop I'm gonna lose it.
 */

export class MetricIndexer {
  private queue = new Map<string, MetricEvent>();
  private silenceWarnings = false;

  /**
   * Add and index an event listener callback
   *
   * @param {Function} listener - a callback
   * @returns {string}
   */
  public add(listener: Listener, keepAlive = false) {
    const nextID = AutoIncrementingID.nextID.toString();
    this.queue.set(nextID, { listener, keepAlive });
    return nextID;
  }

  /**
   * Remove an event listener callback by id
   *
   * @param {Function} id - a callback index returned from MetricIndexer.add
   * @returns {boolean}
   */
  public remove(id: string) {
    return this.queue.delete(id);
  }

  /**
   * Get a callback indexed at a particular ID
   *
   * @param {string} id - an ID returned from MetricIndexer.add
   * @returns {Function | undefined}
   */
  public get(id: string) {
    return this.queue.get(id);
  }

  /**
   * Empty the queue, execute all event listener callbacks
   *
   * @param {
   *   BustPluginMetric |
   *   BustPerformanceMark |
   *   BustPerformanceMeasure
   * } arguments - Forwarded from Metrics.queue[onMark | onMeasure] or MetricsQueue.plugins[pluginName]
   */
  public bust(...params: BustPluginMetric | BustPerformanceMark | BustPerformanceMeasure) {
    this.queue.forEach(({ listener, keepAlive }, id) => {
      listener(...params);
      if (!keepAlive) {
        this.queue.delete(id);
      }
    });
  }

  /**
   * Get the cardinality of the queue
   */
  get size() {
    return this.queue.size;
  }

  /**
   * Throw an error when emitters get clogged at runtime
   *
   * @param {string} event - The name of an event indexed on MetricsQueue.emitter
   */
  public chubbinessCheck(event: string) {
    if (!this.silenceWarnings && this.queue.size > 19) {
      throw new Error(`
        There are currently more than 20 listeners registered to "${event}".
        It may be worth adding a new marker or measure to avoid polluting this event's queue.

        To silence this error, set MetricIndexer.silenceWarnings to false.
      `);
    }
  }

  /**
   * Destory the MetricIndexer while maintaining the instance
   *  * For use during testing only
   */
  public destroy() {
    this.queue = new Map<string, MetricEvent>();
    this.silenceWarnings = false;
  }
}

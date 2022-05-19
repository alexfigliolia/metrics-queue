import { MetricIndexer } from "./MetricIndexer";
import type {
  Listener,
  HashTable,
  InitConfig,
  PluginOptions,
  ListenerConfig,
  ListenerArguments,
  PerformanceMarkMethod,
  PerformanceMeasureMethod,
  PerformanceMarkParameters,
  PerformanceMeasureParameters,
} from "./types";

/**
 * MetricsQueue
 *
 * Designed to be the backbone event emitter for performance metrics
 *
 * Use the MetricsQueue to subscribe and act upon your performance marks, measures,
 * and externally derived metrics. Use it to defer module loading, conditionally
 * render, or create priority task execution based on your products real performance
 * metrics.
 */
export class MetricsQueue {
  private static isDev = false;
  public static enabled = false;
  private static usePerformanceAPI = true;
  private static mark: null | typeof performance.mark = null;
  private static measure: null | typeof performance.measure = null;
  private static emitter: HashTable<MetricIndexer> = {};
  public static plugins: HashTable<(...args: any[]) => void> = {};

  /**
   * Enable the MetricsQueue, do it once and fuggettaboutit
   *
   * @param {Function} onReady - An optional callback to invoke once the MetricsQueue is initialized
   * @param {HashTable<PluginOptions>} plugins - optional support for external performance libraries libraries
   * @param {Boolean} usePerformanceAPI - whether to enable the MetricsQueue for native Performance.mark and measure
   */
  public static init({ onReady, plugins, usePerformanceAPI = true }: InitConfig = {}) {
    this.enabled = true;
    this.isDev = process.env.NODE_ENV !== "production";
    this.usePerformanceAPI = usePerformanceAPI;
    if (typeof onReady === "function") {
      onReady(this);
    }
    if (this.usePerformanceAPI && window.performance) {
      // Hold a copy of the default behaviors
      this.mark = performance.mark;
      this.measure = performance.measure;
      // Add a middleware to the mark and measure methods
      performance.mark = this.markMiddleware as unknown as PerformanceMarkMethod;
      performance.measure = this.measureMiddlware as unknown as PerformanceMeasureMethod;
    }
    if (typeof plugins === "object") {
      this.registerPlugins(plugins);
    }
  }

  /**
   * Create event emitters designed for usage with external libraries
   * * For internal use only
   *
   * @param {HashTable<PluginOptions>} plugins - A list of methods to expose as well as how to handle callback
   *                                             callback executions
   */
  private static registerPlugins(plugins: HashTable<PluginOptions>) {
    for (const plug in plugins) {
      const { processAfterCallStack } = plugins[plug];
      if (processAfterCallStack) {
        // eslint-disable-next-line arrow-body-style
        this.plugins[plug] = (...args: [metric: string, ...args: any[]]) => {
          return this.processAfterCallStack(this.onPluginEvent.bind(this, ...args));
        };
      } else {
        this.plugins[plug] = this.onPluginEvent.bind(this);
      }
    }
  }

  /**
   * Trigger listeners on performance marks (inherits native performance.mark arguments)
   * * For internal use only
   *
   * @param {string} markName - The native markName for performance.mark
   * @param {PerformanceMarkOptions | undefined} markOptions - the native mark options for performance.mark
   */
  private static markMiddleware(...args: PerformanceMarkParameters) {
    // Execute the default behavior, first, always
    let performanceMark: null | PerformanceMark = null;
    MetricsQueue.safetyWrap(() => {
      performanceMark = MetricsQueue.mark?.apply(this, args) ?? null;
    });
    // Allow performance.mark to return the mark before any registered
    // callbacks are called
    void MetricsQueue.processAfterCallStack(() => {
      // Emit the onMark event for the metric reached
      MetricsQueue.onMark(performanceMark, args);
    });
    // Return the default PerformanceMark
    return performanceMark;
  }

  /**
   * Trigger listeners on performance measures (inherits native performance.measure arguments)
   * * For internal use only
   *
   * @param {string} measureName - The native measure name for performance.measure
   * @param {string | PerformanceMeasureOptions} startOrMeasureOptions - the native measure options for performance.measure
   * @param {string} endMark - The native endMark for performance.measure
   */
  private static measureMiddlware(...args: PerformanceMeasureParameters) {
    // Execute the default behavior, first, always
    let performanceMeasure: null | PerformanceMeasure = null;
    MetricsQueue.safetyWrap(() => {
      performanceMeasure = MetricsQueue.measure?.apply(this, args) ?? null;
    });
    // Allow performance.measure to return the measure before any
    // registered callbacks are called
    void MetricsQueue.processAfterCallStack(() => {
      // Emit the onMeasure event for the metric reached
      MetricsQueue.onMeasure(performanceMeasure, args);
    });
    // Return the default PerformanceMeasure
    return performanceMeasure;
  }

  /**
   * Execute callbacks on listeners registered to a particular mark
   * * For internal use only
   *
   * @param {object | undefined} options - the options of a performance.mark
   * @param {PerformanceMark} performanceMark - the return value of the performance.mark
   */
  private static async onMark(
    performanceMark: PerformanceMark | null,
    performanceMarkParams: PerformanceMarkParameters
  ): Promise<void> {
    const [markName] = performanceMarkParams;
    if (markName in this.emitter) {
      await this.emitter[markName].bust(performanceMark, ...performanceMarkParams);
      this.checkForEmptyIndexer(markName);
    }
  }

  /**
   * Execute callbacks on listeners registered to a particular measure
   * * For internal use only
   *
   * @param {PerformanceMeasure} performanceMeasure - the return value of the performance.measure
   * @param {performanceMeasureParams} performanceMeasure - the options passed performance.measure
   */
  private static async onMeasure(
    performanceMeasure: PerformanceMeasure | null,
    performanceMeasureParams: PerformanceMeasureParameters
  ): Promise<void> {
    const [measureName] = performanceMeasureParams;
    if (measureName in this.emitter) {
      await this.emitter[measureName].bust(performanceMeasure, ...performanceMeasureParams);
      this.checkForEmptyIndexer(measureName);
    }
  }

  /**
   * Execute callbacks on listeners registered on an external performance library
   * * For internal use only
   *
   * @param {string} metric - the name of a custom library's performance metric
   * @param {any[]} args - any parameters to be forward to subscriptions
   */
  public static async onPluginEvent(metric: string, ...args: any[]): Promise<void> {
    if (metric in this.emitter) {
      await this.emitter[metric].bust(...args);
      this.checkForEmptyIndexer(metric);
    }
  }

  /**
   * Clean up empty MetricIndexer's as they bust
   * * For internal use only
   *
   * @param {string} key - an inded on the MetricsQueue's emitter
   */
  private static checkForEmptyIndexer(key: string) {
    if (this.emitter[key].size === 0) {
      delete this.emitter[key];
    }
  }

  /**
   * Register a callback as a microtask to be executed after the current callstack
   * * For internal use only
   *
   * @param {Function} callback - anything but ideally limited to O(n) or less
   */
  private static async processAfterCallStack(callback: () => any) {
    await Promise.resolve();
    return callback();
  }

  /**
   * Register an event listener on a performance mark/measure or an external performance event
   *
   * @param {string} event - The name a performance.mark, measure, or external performance event
   * @param {Function} callback - A callback to run once your mark is reached
   * @param {ListenerConfig} config - The config takes two optional paramenters - "passive" and "keepAlive" - 
   *    "passive": tells the MetricsQueue to run the callback after the current callstack has cleared. This
   *             can be ideal when your callbacks don't need to be run within 1ms of your metric being reached.
   *             It is true by default.
   *    "keepAlive": tells the MetricsQueue that this event listener should not be removed once called and instead
   *               be called each time the metric is reached. This behavior is mimical of "click" events on on the
   *               DOM as opposed to "onLoad" events on the window, which fire once.
   *               It is false by default.                      
   */
  public static addEventListener(event: string, callback: Listener, config?: ListenerConfig) {
    // TODO - document usage in readme
    if (this.isDev) {
      this.validateListener(event, callback, config);
    }
    if (event in this.emitter) {
      if (this.isDev) {
        this.emitter[event].chubbinessCheck(event);
      }
    } else {
      this.emitter[event] = new MetricIndexer();
    }
    return this.emitter[event].add(callback, config);
  }

  /**
   * Clean up event listeners for events that can't be reached
   *
   * @param {string} event - The name a performance.mark, measure, or external performance event
   * @param {string} callbackID - The ID returned from MetricsQueue.addEventListener
   */
  public static removeEventListener(event: string, callbackID: string) {
    if (event in this.emitter) {
      this.emitter[event].remove(callbackID);
      this.checkForEmptyIndexer(event);
      return true;
    }
    return null;
  }

  /**
   * When not running in production, provides developer feedback for error-prone arguments.
   * * For internal use only
   *
   * @param {ListenerArguments} args - inherited arguments from addEventListener
   */
  private static validateListener(...args: ListenerArguments) {
    if (!this.enabled) {
      throw new Error("Please initialize the Metrics Queue before registering performance listeners");
    }
    const [event, callback] = args;
    if (!event) {
      throw new Error(
        "To register an event listener, an event name must be provided. Events correspond to usages of the native Performance API or external performance libraries"
      );
    }
    if (typeof callback !== "function") {
      throw new Error(
        "To register a listener, please provide a callback function to be executed once your metric is reached"
      );
    }
  }

  /**
   * Designed to wrap performance api calls for environment safety
   *
   * @param {Function} func - a function to wrap in a try-catch
   * @param {any[]} args - arguments to apply to the function
   * @param {Function} catchFN - an optional handler for caught errors
   */
  public static safetyWrap(
    func: (...args: any[]) => any,
    args: any[] = [],
    catchFN?: (error: unknown) => any
  ) {
    try {
      return func(...args);
    } catch (e: unknown) {
      // Suppress error when performance API failed.
      // Note: in MicrosoftEdge version 18 and prior, performance.measure(name, startMark, endMark) API will throw SyntaxError if startMark is undefined.
      // That's why wrap with try catch statement.
      if (typeof catchFN === "function") {
        catchFN(e);
      }
    }
    return null;
  }

  /**
   * Resets the MetricsQueue
   * * For use during testing only
   */
  public static destroy() {
    if (this.enabled && this.usePerformanceAPI && window.performance) {
      performance.mark = this.mark as PerformanceMarkMethod;
      performance.measure = this.measure as PerformanceMeasureMethod;
    }
    this.enabled = false;
    this.usePerformanceAPI = true;
    this.mark = null;
    this.measure = null;
    this.emitter = {};
    this.isDev = process.env.NODE_ENV !== "production";
  }
}

import { MetricsQueue } from "../MetricsQueue";
import { MetricIndexer } from "../MetricIndexer";
import { PerfLibMetric } from "../testUtils";
import type { Listener, PerformanceMarkParameters, PerformanceMeasureParameters } from "../types";

Object.defineProperty(window, "performance", {
  writable: true,
  value: {
    now: () => Date.now(),
    mark: (name: string) => ({ name, time: Date.now() }),
    measure: (measure: string) => ({ name: measure, time: Date.now() }),
  },
});

describe("Metrics Queue:", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MetricsQueue.destroy();
  });

  it("Initializes with default property values", () => {
    expect(MetricsQueue.enabled).toEqual(false);
    expect(MetricsQueue["mark"]).toEqual(null);
    expect(MetricsQueue["measure"]).toEqual(null);
    expect(MetricsQueue["emitter"]).toEqual({});
    expect(MetricsQueue["isDev"]).toEqual(true);
  });

  describe("Init:", () => {
    it("marks MetricsQueue.enabled as true allowing it to receive event listeners", () => {
      MetricsQueue.init();
      expect(MetricsQueue.enabled).toEqual(true);
    });

    it("Caches the original mark and measure methods of the Performance API when MetricsQueue.usePerformanceAPI is true and the API is available on the window", () => {
      const mark = performance.mark;
      const measure = performance.measure;
      MetricsQueue.init();
      expect(MetricsQueue["mark"]).toEqual(mark);
      expect(MetricsQueue["measure"]).toEqual(measure);
    });

    it("Adds a middleware to the mark and measure methods Performance API when MetricsQueue.usePerformanceAPI is true and the API is available on the window", () => {
      MetricsQueue.init();
      expect(performance.mark).toEqual(MetricsQueue["markMiddleware"]);
      expect(performance.measure).toEqual(MetricsQueue["measureMiddlware"]);
    });

    it("Leaves the PerformanceAPI in tact when initializing with MetricsQueue.usePerformanceAPI equal to false", () => {
      MetricsQueue.init({
        usePerformanceAPI: false,
      });
      expect(performance.mark).toEqual(performance.mark);
      expect(performance.measure).toEqual(performance.measure);
      expect(MetricsQueue["mark"]).toEqual(null);
      expect(MetricsQueue["measure"]).toEqual(null);
    });

    it("When supplied with an 'onReady' function it will call it when initializing", () => {
      const onReady = jest.fn();
      MetricsQueue.init({ onReady });
      expect(onReady).toHaveBeenCalledWith(MetricsQueue);
    });
  });

  describe("Mark Middleware:", () => {
    it("Executes the default performance.mark behavior", () => {
      MetricsQueue.init();
      const cachedMark = jest.spyOn(MetricsQueue as any, "mark");
      performance.mark("example-mark");
      expect(cachedMark).toHaveBeenCalledWith("example-mark");
    });

    it("Emits the onMark event after running the default performance.mark behavior", async () => {
      MetricsQueue.init();
      const onMark = jest.spyOn(MetricsQueue as any, "onMark");
      const mark = performance.mark("example-mark");
      await new Promise(process.nextTick);
      const [perfMark, params] = onMark.mock.calls[0];
      expect(perfMark).toEqual(mark);
      expect((params as PerformanceMarkParameters)[0]).toEqual("example-mark");
    });

    it("Busts the queue of events listening for example-mark", async () => {
      MetricsQueue.init();
      const listenerSpy = jest.fn();
      const markSpy = jest.spyOn(MetricsQueue as any, "onMark");
      MetricsQueue.addEventListener("example-mark", listenerSpy);
      MetricsQueue.addEventListener("example-mark", listenerSpy);
      MetricsQueue.addEventListener("example-mark", listenerSpy);
      const bustSpy = jest.spyOn(MetricsQueue["emitter"]["example-mark"], "bust");
      performance.mark("example-mark");
      await new Promise(process.nextTick);
      expect(markSpy).toHaveBeenCalledTimes(1);
      expect(bustSpy).toHaveBeenCalledTimes(1);
      expect(listenerSpy).toHaveBeenCalledTimes(3);
      expect(MetricsQueue["emitter"]["example-mark"]).toEqual(undefined);
    });
  });

  describe("Measure Middleware:", () => {
    it("Executes the default performance.measure behavior", () => {
      MetricsQueue.init();
      const cachedMeasure = jest.spyOn(MetricsQueue as any, "measure");
      performance.measure("example-measure");
      expect(cachedMeasure).toHaveBeenCalledWith("example-measure");
    });

    it("Emits the onMeasure event after running the default performance.measure behavior", async () => {
      MetricsQueue.init();
      const onMeasure = jest.spyOn(MetricsQueue as any, "onMeasure");
      performance.mark("example-mark");
      const measure = performance.measure("example-measure", "example-mark");
      await new Promise(process.nextTick);
      const [perfMeasure, params] = onMeasure.mock.calls[0];
      expect(perfMeasure).toEqual(measure);
      expect((params as PerformanceMeasureParameters)[0]).toEqual("example-measure");
      expect((params as PerformanceMeasureParameters)[1]).toEqual("example-mark");
    });

    it("Busts the queue of events listening for example-measure", async () => {
      MetricsQueue.init();
      MetricsQueue.addEventListener("example-measure", () => {});
      const onMeasure = jest.spyOn(MetricsQueue as any, "onMeasure");
      const bustQueue = jest.spyOn(MetricsQueue["emitter"]["example-measure"], "bust");
      performance.mark("example-mark");
      const measure = performance.measure("example-measure", "example-mark");
      await new Promise(process.nextTick);
      const [perfMeasure, params] = onMeasure.mock.calls[0];
      expect(perfMeasure).toEqual(measure);
      const [measureName, markName] = params as PerformanceMeasureParameters;
      expect(measureName).toEqual("example-measure");
      expect(markName).toEqual("example-mark");
      expect(bustQueue).toHaveBeenCalledWith(measure, "example-measure", "example-mark");
      expect(MetricsQueue["emitter"]["example-measure"]).toEqual(undefined);
    });
  });

  describe("On Mark:", () => {
    it("Should bust the queue when event listeners are present for the mark", async () => {
      MetricsQueue.init();
      MetricsQueue.addEventListener("example-mark", () => {});
      const bustQueue = jest.spyOn(MetricsQueue["emitter"]["example-mark"], "bust");
      performance.mark("example-mark");
      await new Promise(process.nextTick);
      expect(bustQueue).toHaveBeenCalledTimes(1);
    });
  });

  describe("On Measure:", () => {
    it("Should bust the queue when event listeners are present for the measure", async () => {
      MetricsQueue.init();
      const listenerSpy = jest.fn();
      const measureSpy = jest.spyOn(MetricsQueue as any, "onMeasure");
      MetricsQueue.addEventListener("example-measure", listenerSpy);
      MetricsQueue.addEventListener("example-measure", listenerSpy);
      MetricsQueue.addEventListener("example-measure", listenerSpy);
      const bustSpy = jest.spyOn(MetricsQueue["emitter"]["example-measure"], "bust");
      performance.measure("example-measure");
      await new Promise(process.nextTick);
      expect(measureSpy).toHaveBeenCalledTimes(1);
      expect(bustSpy).toHaveBeenCalledTimes(1);
      expect(listenerSpy).toHaveBeenCalledTimes(3);
      expect(MetricsQueue["emitter"]["example-measure"]).toEqual(undefined);
    });
  });

  describe("Integration with external libraries:", () => {
    beforeEach(() => {
      MetricsQueue.init({
        plugins: {
          onPerformanceLibraryEvent: {
            processAfterCallStack: false,
          },
        },
      });
    });

    it("Should register a callable on the MetricsQueue's plugins", () => {
      expect(typeof MetricsQueue.plugins.onPerformanceLibraryEvent).toEqual("function");
    });

    it("The callable should trigger MetricsQueue.onPluginEvent", async () => {
      const callback = jest.fn();
      MetricsQueue.addEventListener("event", callback);
      MetricsQueue.plugins.onPerformanceLibraryEvent("event", {}, "stuff");
      await Promise.resolve(process.nextTick);
      expect(callback).toHaveBeenCalledWith({}, "stuff");
    });

    it("The callable should trigger MetricsQueue.onPluginEvent after the current callstack when 'processAfterCallStack' is true", async () => {
      MetricsQueue.destroy();
      MetricsQueue.init({
        plugins: {
          onPerformanceLibraryEvent: {
            processAfterCallStack: true,
          },
        },
      });
      const callback = jest.fn();
      const spy = jest.spyOn(MetricsQueue, "onPluginEvent");
      MetricsQueue.addEventListener("event", callback);
      MetricsQueue.plugins.onPerformanceLibraryEvent("event", {}, "stuff");
      expect(callback).toHaveBeenCalledTimes(0);
      await Promise.resolve(process.nextTick);
      expect(spy).toHaveBeenCalledTimes(1);
      await Promise.resolve(process.nextTick);
      expect(callback).toHaveBeenCalledWith({}, "stuff");
    });

    it("Should bust the queue when event listeners are present for declared plugins", async () => {
      const metric = new PerfLibMetric("example-metric");
      metric.subscribe((instance: PerfLibMetric) => {
        MetricsQueue.plugins.onPerformanceLibraryEvent(instance.name, instance);
      });
      const listenerSpy = jest.fn();
      MetricsQueue.addEventListener("example-metric", listenerSpy, { passive: false });
      MetricsQueue.addEventListener("example-metric", listenerSpy, { passive: false });
      MetricsQueue.addEventListener("example-metric", listenerSpy, { passive: false });
      const bustSpy = jest.spyOn(MetricsQueue["emitter"]["example-metric"], "bust");
      metric.stop();
      expect(bustSpy).toHaveBeenCalledTimes(1);
      await Promise.resolve(process.nextTick);
      expect(listenerSpy).toHaveBeenCalledTimes(3);
      listenerSpy.mock.calls.forEach((args) => {
        expect(args).toEqual([metric]);
      });
      expect(MetricsQueue["emitter"]["example-metric"]).toEqual(undefined);
    });

    it("Should bust the queue asynchronously when event listeners are present for declared plugins and passive is true", async () => {
      const metric = new PerfLibMetric("example-metric");
      metric.subscribe((instance: PerfLibMetric) => {
        MetricsQueue.plugins.onPerformanceLibraryEvent(instance.name, instance);
      });
      const listenerSpy = jest.fn();
      MetricsQueue.addEventListener("example-metric", listenerSpy);
      MetricsQueue.addEventListener("example-metric", listenerSpy);
      MetricsQueue.addEventListener("example-metric", listenerSpy);
      const bustSpy = jest.spyOn(MetricsQueue["emitter"]["example-metric"], "bust");
      metric.stop();
      expect(bustSpy).toHaveBeenCalledTimes(1);
      await Promise.resolve(process.nextTick);
      expect(listenerSpy).toHaveBeenCalledTimes(3);
      listenerSpy.mock.calls.forEach((args) => {
        expect(args).toEqual([metric]);
      });
      // One tick for each event listener
      await Promise.resolve(process.nextTick);
      await Promise.resolve(process.nextTick);
      await Promise.resolve(process.nextTick);
      expect(MetricsQueue["emitter"]["example-metric"]).toEqual(undefined);
    });

    it("Should do nothing when listeners are registered on an event", async () => {
      const metric = new PerfLibMetric("example-metric");
      metric.subscribe((...args: [name: string, time: number]) => {
        MetricsQueue.plugins.onPerformanceLibraryEvent(...args);
      });
      expect(MetricsQueue["emitter"]["example-metric"]).toEqual(undefined);
      metric.stop();
      expect(MetricsQueue["emitter"]["example-metric"]).toEqual(undefined);
    });
  });

  describe("Process After Call Stack", () => {
    it("Defers callback execution until after the callstack is cleared", async () => {
      const func = jest.fn();
      void MetricsQueue["processAfterCallStack"](func);
      expect(func).toHaveBeenCalledTimes(0);
      await new Promise(process.nextTick);
      expect(func).toHaveBeenCalledTimes(1);
    });
  });

  describe("Add Event Listener:", () => {
    it("Should initialize a MetricIndexer on the emitter for the first event registered", () => {
      MetricsQueue.init();
      expect(MetricsQueue["emitter"]).toEqual({});
      const callback = () => {};
      expect(MetricsQueue["emitter"]["time-to-interactive"]).toEqual(undefined);
      MetricsQueue.addEventListener("time-to-interactive", callback);
      expect(MetricsQueue["emitter"]["time-to-interactive"] instanceof MetricIndexer).toEqual(true);
      expect(MetricsQueue["emitter"]["time-to-interactive"].size).toEqual(1);
    });

    it("Should push a callback to a pre-existing MetricIndexer when subsequent listeners are added", () => {
      MetricsQueue.init();
      expect(MetricsQueue["emitter"]).toEqual({});
      const callback = () => {};
      MetricsQueue.addEventListener("time-to-interactive", callback);
      MetricsQueue.addEventListener("time-to-interactive", callback);
      expect(MetricsQueue["emitter"]["time-to-interactive"].size).toEqual(2);
    });

    it("Should validate event listeners when the environment is not production", () => {
      const env = process.env.NODE_ENV;
      process.env.NODE_ENV = "dev";
      MetricsQueue.init();
      const validate = jest.spyOn(MetricsQueue as any, "validateListener");
      const callback = () => {};
      MetricsQueue.addEventListener("time-to-interactive", callback);
      expect(validate).toHaveBeenCalledWith("time-to-interactive", callback, undefined);
      process.env.NODE_ENV = env;
    });

    it("Should not validate event listeners when the environment is production", () => {
      process.env.NODE_ENV = "production";
      MetricsQueue.init();
      const validate = jest.spyOn(MetricsQueue as any, "validateListener");
      MetricsQueue.addEventListener("time-to-interactive", () => {});
      expect(validate).toHaveBeenCalledTimes(0);
      process.env.NODE_ENV = "testing";
    });

    it("Should run a chubbiness when adding an event listener to a preexisting queue in non-production environments", () => {
      MetricsQueue.init();
      MetricsQueue.addEventListener("example-mark", () => {});
      const chubbinessCheck = jest.spyOn(MetricsQueue["emitter"]["example-mark"], "chubbinessCheck");
      MetricsQueue.addEventListener("example-mark", () => {});
      expect(chubbinessCheck).toHaveBeenCalledWith("example-mark");
    });

    it("Should not run a chubbiness when adding an event listener to a preexisting queue in production environments", () => {
      process.env.NODE_ENV = "production";
      MetricsQueue.init();
      MetricsQueue.addEventListener("example-mark", () => {});
      const chubbinessCheck = jest.spyOn(MetricsQueue["emitter"]["example-mark"], "chubbinessCheck");
      MetricsQueue.addEventListener("example-mark", () => {});
      expect(chubbinessCheck).toHaveBeenCalledTimes(0);
      process.env.NODE_ENV = "testing";
    });
  });

  describe("Remove Event Listener", () => {
    beforeEach(() => {
      MetricsQueue.init();
    });

    it("Returns true if the listener was not already executed", () => {
      const ID = MetricsQueue.addEventListener("example-mark", () => {});
      const removed = MetricsQueue.removeEventListener("example-mark", ID);
      expect(removed).toEqual(true);
    });

    it("Returns null if the listener was already removed", () => {
      const ID = MetricsQueue.addEventListener("example-mark", () => {});
      MetricsQueue.removeEventListener("example-mark", ID);
      const removed = MetricsQueue.removeEventListener("example-mark", ID);
      expect(removed).toEqual(null);
    });

    it("Returns null if the attempted removal doesn't exist", async () => {
      const removed = MetricsQueue.removeEventListener("example-mark", "123");
      expect(removed).toEqual(null);
    });
  });

  describe("Validate Listener:", () => {
    it("Should throw an error when the Metrics Queue is not enabled and an event listener is added", () => {
      expect(() => {
        MetricsQueue.addEventListener("example-mark", () => {});
      }).toThrow("Please initialize the Metrics Queue before registering performance listeners");
    });

    it("Should throw an error when an event is not provided", () => {
      MetricsQueue.init();
      expect(() => {
        MetricsQueue.addEventListener(undefined as unknown as string, () => {});
      }).toThrow(
        "To register an event listener, an event name must be provided. Events correspond to usages of the native Performance API or external performance libraries"
      );
    });

    it("Should throw an error when a callback is not provided", () => {
      MetricsQueue.init();
      expect(() => {
        MetricsQueue.addEventListener("example-event", "not a function" as unknown as Listener);
      }).toThrow(
        "To register a listener, please provide a callback function to be executed once your metric is reached"
      );
    });

    it("Should throw no errors when a valid event and callback are provided - and when the MetricsQueue is initialized", () => {
      MetricsQueue.init();
      expect(() => {
        MetricsQueue.addEventListener("example-event", () => {});
      }).not.toThrow();
    });
  });

  describe("Safety Wrap:", () => {
    it("Wraps calls to performance api methods in a try-catch statement and returns the value of the passed function", () => {
      const func = (args: IArguments) => args;
      const returnValue = MetricsQueue.safetyWrap(func, ["hello"]);
      expect(returnValue).toEqual("hello");
    });

    it("Catches and returns null when the passed function throws", () => {
      const func = (args: IArguments) =>
        // force function to throw
        (args as any).keyDoesntExist.thisAlsoDoesntExist;
      const returnValue = MetricsQueue.safetyWrap(func, ["hello"]);
      expect(returnValue).toEqual(null);
    });

    it("Calls the 'catchFN' (when supplied) and the passed function throws", () => {
      const spy = jest.fn();
      const func = (args: IArguments) =>
        // force function to throw
        (args as any).keyDoesntExist.thisAlsoDoesntExist;
      MetricsQueue.safetyWrap(func, ["hello"], spy);
      expect(spy.mock.calls[0][0] instanceof TypeError).toEqual(true);
    });
  });

  describe("Destroy:", () => {
    it("Should reset hacked performance API methods", () => {
      const mark = performance.mark;
      const measure = performance.measure;
      MetricsQueue.init();
      expect(performance.mark).not.toEqual(mark);
      expect(performance.measure).not.toEqual(measure);
      MetricsQueue.destroy();
      expect(performance.mark).toEqual(mark);
      expect(performance.measure).toEqual(measure);
    });

    it("Should reset all Metrics Queue statics", () => {
      MetricsQueue.init();
      MetricsQueue.destroy();
      expect(MetricsQueue.enabled).toEqual(false);
      expect(MetricsQueue["usePerformanceAPI"]).toEqual(true);
      expect(MetricsQueue["mark"]).toEqual(null);
      expect(MetricsQueue["measure"]).toEqual(null);
      expect(MetricsQueue["emitter"]).toEqual({});
    });
  });
});

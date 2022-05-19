import { MetricIndexer } from "../MetricIndexer";
import { AutoIncrementingID } from "../AutoIncrementingID";
import { PerfLibMetric } from "../testUtils";

const metricIndexer = new MetricIndexer();

describe("Metric Indexer:", () => {
  beforeEach(() => {
    metricIndexer.destroy();
    AutoIncrementingID.destroy();
  });

  describe("Add:", () => {
    it("Adds a callback to the queue", () => {
      const callback = () => {};
      metricIndexer.add(callback, { keepAlive: true, passive: true });
      metricIndexer.add(callback, { keepAlive: false, passive: false });
      expect(metricIndexer.get("0")).toEqual({ listener: callback, config: { keepAlive: true, passive: true } });
      expect(metricIndexer.get("1")).toEqual({ listener: callback, config: { keepAlive: false, passive: false } });
    });

    it("Returns the ID", () => {
      const ID = metricIndexer.add(() => {});
      expect(ID).toEqual("0");
    });
  });

  describe("Remove:", () => {
    it("Removes callback from the queue", () => {
      const ID = metricIndexer.add(() => {});
      expect(metricIndexer.size).toEqual(1);
      metricIndexer.remove(ID);
      expect(metricIndexer.size).toEqual(0);
    });
  });

  describe("Get:", () => {
    it("Returns null when receiving an unindexed ID", () => {
      const returnValue = metricIndexer.get("BLAH");
      expect(returnValue).toEqual(undefined);
    });
    it("Returns the callback corresponding to a particular ID", () => {
      const callback = () => {};
      const ID = metricIndexer.add(callback);
      const returnValue = metricIndexer.get(ID);
      expect(returnValue).toEqual({ listener: callback, config: { keepAlive: false, passive: true } });
    });
  });

  describe("Bust:", () => {
    it("Calls each of the callbacks in the queue",async () => {
      const callback = jest.fn();
      metricIndexer.add(callback);
      metricIndexer.add(callback);
      metricIndexer.add(callback);
      const metric = new PerfLibMetric("example-metric");
      metricIndexer.bust("example-metric", metric);
      await new Promise(process.nextTick);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it("Empties the queue", async () => {
      metricIndexer.add(() => {});
      expect(metricIndexer.size).toEqual(1);
      const metric = new PerfLibMetric("example-metric");
      metricIndexer.bust("example-metric", metric);
      await new Promise(process.nextTick);
      expect(metricIndexer.size).toEqual(0);  
    });
  });

  describe("Size:", () => {
    it("Returns the weight of the queue", () => {
      expect(metricIndexer.size).toEqual(0);
      metricIndexer.add(() => {});
      expect(metricIndexer.size).toEqual(1);
    });
  });

  describe("Chubbiness Check:", () => {
    it("Should not throw an error when 'silenceWarnings' is set to true", () => {
      metricIndexer["silenceWarnings"] = true;
      expect(() => {
        metricIndexer["chubbinessCheck"]("example-event");
      }).not.toThrow();
    });

    it("Should not throw an error when a queue has less than 20 callbacks", () => {
      for (let i = 0; i < 19; i++) {
        metricIndexer.add(() => {});
      }
      expect(() => {
        metricIndexer["chubbinessCheck"]("example-event");
      }).not.toThrow();
    });

    it("Should throw an error when a queue has 20 callbacks or more registered to it", () => {
      for (let i = 0; i < 20; i++) {
        metricIndexer.add(() => {});
      }
      expect(() => {
        metricIndexer["chubbinessCheck"]("example-event");
      }).toThrow(`
        There are currently more than 20 listeners registered to "example-event".
        It may be worth adding a new marker or measure to avoid polluting this event's queue.

        To silence this error, set MetricIndexer.silenceWarnings to false.
      `);
    });
  });

  describe("Destroy", () => {
    it("Resets the instance back to it's initial state", () => {
      const callback = () => {};
      metricIndexer.add(callback);
      metricIndexer.add(callback);
      metricIndexer.add(callback);
      metricIndexer["silenceWarnings"] = true;
      metricIndexer.destroy();
      expect(metricIndexer["queue"]).toEqual(new Map());
      expect(metricIndexer["silenceWarnings"]).toEqual(false);
    });
  });
});

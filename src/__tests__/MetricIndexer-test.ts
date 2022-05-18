import { MetricIndexer } from "../MetricIndexer";
import { AutoIncrementingID } from "../AutoIncrementingID";

const metricIndexer = new MetricIndexer();

describe("Metric Indexer:", () => {
  beforeEach(() => {
    metricIndexer.destroy();
    AutoIncrementingID.destroy();
  });

  describe("Add:", () => {
    it("adds a callback to the queue", () => {
      const callback = () => {};
      metricIndexer.add(callback, true);
      metricIndexer.add(callback, false);
      expect(metricIndexer.get("0")).toEqual({ listener: callback, keepAlive: true });
      expect(metricIndexer.get("1")).toEqual({ listener: callback, keepAlive: false });
    });

    it("returns the ID", () => {
      const ID = metricIndexer.add(() => {});
      expect(ID).toEqual("0");
    });
  });

  describe("Remove:", () => {
    it("removes callback from the queue", () => {
      metricIndexer.add(() => {});
      expect(metricIndexer.size).toEqual(1);
      metricIndexer.remove("0");
      expect(metricIndexer.size).toEqual(0);
    });
  });

  describe("Get:", () => {
    it("returns null when receiving an unindexed ID", () => {
      const returnValue = metricIndexer.get("BLAH");
      expect(returnValue).toEqual(undefined);
    });
    it("returns the callback corresponding to a particular ID", () => {
      const callback = () => {};
      const ID = metricIndexer.add(callback);
      const returnValue = metricIndexer.get(ID);
      expect(returnValue).toEqual({ listener: callback, keepAlive: false });
    });
  });

  // TODO rewrite:
  // describe("Bust:", () => {
  //   it("It calls each of the callbacks in the queue", () => {
  //     const callback = jest.fn();
  //     metricIndexer.add(callback);
  //     metricIndexer.add(callback);
  //     metricIndexer.add(callback);
  //     const BM = metrics.pageSegmentLoad({ key: "example-metric" });
  //     metricIndexer.bust("example-event", BM);
  //     expect(callback).toHaveBeenCalledTimes(3);
  //   });

  //   it("It empties the queue", () => {
  //     metricIndexer.add(() => {});
  //     expect(metricIndexer.size).toEqual(1);
  //     const BM = metrics.pageSegmentLoad({ key: "example-metric" });
  //     metricIndexer.bust("example-event", BM);
  //     expect(metricIndexer.size).toEqual(0);
  //   });
  // });

  describe("Size:", () => {
    it("returns the weight of the queue", () => {
      expect(metricIndexer.size).toEqual(0);
      metricIndexer.add(() => {});
      expect(metricIndexer.size).toEqual(1);
    });
  });

  describe("Chubbiness Check:", () => {
    it("should not throw an error when 'silenceWarnings' is set to true", () => {
      metricIndexer["silenceWarnings"] = true;
      expect(() => {
        metricIndexer["chubbinessCheck"]("example-event");
      }).not.toThrow();
    });

    it("should not throw an error when a queue has less than 20 callbacks", () => {
      for (let i = 0; i < 19; i++) {
        metricIndexer.add(() => {});
      }
      expect(() => {
        metricIndexer["chubbinessCheck"]("example-event");
      }).not.toThrow();
    });

    it("should throw an error when a queue has 20 callbacks or more registered to it", () => {
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

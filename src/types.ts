export type HashTable<T> = {
  [key: string]: T;
};

export type PerformanceMarkParameters = [mark: string, options: PerformanceMarkOptions];

export type BustPerformanceMark = [PerformanceMark, ...PerformanceMarkParameters];

export type PerformanceMeasureParameters = [
  measure: string,
  startOrMeasureOptions: StartOrMeasureOptions,
  startMark: string | undefined
];

export type BustPerformanceMeasure = [PerformanceMeasure, ...PerformanceMeasureParameters];

export type BustPluginMetric = [string, ...any[]];

export type MarkParameters = [
  startMark: PerformanceMark,
  mark: string,
  markOptions: PerformanceMarkOptions | undefined
];

export type MeasureParameters = [
  performanceMeasure: PerformanceMeasure,
  measure: string,
  startOrMeasureOptions: StartOrMeasureOptions,
  startMark: string | undefined
];

export type PerformanceMarkMethod = (
  markName: string,
  markOptions: PerformanceMarkOptions | undefined
) => PerformanceMark;

export type PerformanceMeasureMethod = (
  measureName: string,
  startOrMeasureOptions: StartOrMeasureOptions,
  endMark: string | undefined
) => PerformanceMeasure;

export type StartOrMeasureOptions = string | PerformanceMeasureOptions | undefined;

export type PluginOptions = {
  processAfterCallStack: boolean;
};

export type InitConfig = {
  onReady?: Function;
  usePerformanceAPI?: boolean;
  plugins?: HashTable<PluginOptions>;
};

export type MetricEvent = {
  listener: Function;
  keepAlive: boolean;
};

export type ListenerArguments = [event: string, callback: Function, keepAlive?: boolean];

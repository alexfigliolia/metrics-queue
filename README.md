# Metrics Queue

### Purpose

The Metrics Queue allows developers to react performance.marks and measures for the purpose of performance-tuning against performance goals

```JavaScript
// Somewhere in your application code
const measure = performance.measure("example-measure");

// In any other module
MetricsQueue.addEventListener("example-measure", measure => {
  // React to that measure being reached
});
```

#### Why do metrics need a subscription model?

The idea behind the Metrics Queue is to deliver the fastest possible user experience to all users - regardless of environment or device. By treating performance metrics as subscriptables, developers have the possibility to execute different behaviors based upon the speed at which metrics are reached. 

#### Example Recipes:

On-the-fly course correction - run a lighter-weight process when performance is below a certain thresholds:
```JavaScript
// Somewhere in your application code
const measure = performance.measure("time-to-first-byte", "initial-request");

// In any other module
import { MetricsQueue } from "metrics-queue";

let deferForFasterFirstPaint;
MetricsQueue.addEventListener("time-to-first-byte", (TTFB, ...measureOptions) => {
  if(TTFB.duration > 1000) {
    // if a user is experiencing lower-than-average download speeds
    // lets put off loading a secondary feature until after the first
    // paint completes 
    deferForFasterFirstPaint = true;
  } else {
    safeToLoadExpensiveFeature();
  }
});

MetricsQueue.addEventListener("first-meaningful-paint", FMP => {
  if(deferForFasterFirstPaint) {
    safeToLoadExpensiveFeature();
  }
});
```

"Pre-rendering" - render some offscreen content after time-to-interactive is reached:
```JavaScript
// Somewhere in your application code
const measure = performance.measure("time-to-interactive");

// In any other module
import { MetricSubscriber } from "metrics-queue";

// Any UI library:
export const AwesomeComponent = () => {
  const [eventEmitted, setEventEmitted] = useState(false);
  useEffect(() => {
    const listenerID = MetricsQueue.addEventListener(event, () => {
      setEventEmitted(true);
    });
    return () => {
      MetricsQueue.removeEventListener(event, listenerID);
    };
  }, []);
  if(eventEmitted) {
    return (
      <ExpensiveToRenderModule />;
    );
  }
  return <Skeleton />;
}
```

Load a secondary experience after a custom performance metric is reached:
```JavaScript
// Somewhere in your application code
import { createMetric } from "my-custom-metric-lib";

export const customMetric = createMetric("custom-metric");

// When your metric is reached
EXAMPLE_METRIC.onComplete(() => {
    MetricsQueue.plugins.onCustomMetric("custom-metric", customMetric);
});

// In any other module
import { MetricSubscriber } from "metrics-queue";

MetricsQueue.addEventListener("custom-metric", metricInstance => {
  if(metricInstance.stopTime < 500) {
    // If the user experienced a fast execution for example-metric,
    // lets preload an additional feature that would normally require
    // a certain user interaction before loading
    loadSecondaryExperience();
  } else {
    // The user experienced a slow execution for example-metric, so 
    // lets wait for a user-interaction for preloading additional content
    // or features
  }
})
```

#### Let's talk getting setup:

Before using the MetricsQueue, you have to initialize it. This can happen anywhere at anytime. But if you're planning on subscribing to things like initial-page-load's or the Performance API's resource-events, initializing before those metrics are reached is a great idea. Here's how:

```JavaScript
import { MetricsQueue } from "metrics-queue";

MetricsQueue.init();
// Bam...off to the races
```

##### Or, for the savvy fellow:

```JavaScript
import("metrics-queue").then(
  ({ MetricsQueue }) => {
    MetricsQueue.init();
    // nod to the critical path
  }
);
```

##### Now that we've _initted_, let's talk event listening!

There's a couple things to know here:

First, if your application is already using the native Performance API's marks and measures, then the `init` method is all you need to start subscribing to your metrics.

Simply add event listeners like this from anywhere in your code:

```JavaScript
// Somewhere in your app:
performance.mark("example-mark");
// ... 

// Somwehere in your feature module
import { MetricsQueue } from "metrics-queue";

MetricsQueue.addEventListener("example-mark", (performanceMark, ...markOptions) => {
  // Do great things in here
});
```

##### You're all set. Go improve some metric scores!

If you'd like to see a bit more of the API, please read on:

#### Let's talk about other Performance Libraries

In many code-bases, you'll find custom implementations of Performance Monitoring tools. These tools may exist for reasons such as:
  1. Monitoring performance before the Performance API was widely supported
  2. Sending monitoring data to external API's
  3. Creating monitoring implementations that more closely align with features and product goals

If you're wondering if the examples above will work with your team's custom library, the answer is yes!

To Subscribe to your custom library's events, you'll want to register a plugin when initializing the Metrics Queue

```JavaScript
import { MetricsQueue } from 'metrics-queue';

MetricsQueue.init({
  usePerformanceAPI: true, // or false
  plugins: {
    // This key can be any name you wish. You can also have any
    // number of plugins on this object
    onProprietaryEvent: {
      processAfterCallStack: true, // or false
    }
  }
});
```
This tells the Metrics Queue to do the following:
1. Expose an `onProprietaryEvent` method to invoke when events from an external library are reached
2. `processAfterCallStack` tells the MetricsQueue to invoke all callbacks registered to proprietary events *after* the current callstack has cleared. This allows for callbacks to be optionally non-blocking

With your plugin registered you'll want to invoke it anytime a metric that you're intending to listen to is reached:

```JavaScript
import { MetricsQueue } from "metrics-queue";
import { createMetric } from "external-metric-library";

const exampleMetric = createMetric("example-metric");

// At some point, you'll trigger the "stop" or "complete"
// method on your metric to indicate when it's finished:
exampleMetric.onComplete(() => {
  // When your metric completes, trigger the plugin you 
  //registered on the MetricsQueue
  MetricsQueue.plugins.onProprietaryEvent(
    "example-metric", 
    exampleMetric,
    // any other args
  );
});
```

With that setup, you can now listen to your `example-metric` like so:

```JavaScript
MetricsQueue.addEventListener(
  "example-metric", 
  (metricName, metric, ...args) => {
  // Run some logic when example-metric is reached
});
```

### Backstory

Have you ever wrote a nice chunk of JavaScript code only for it to degrade your first-meaningful-paint or time-to-interactive? Have you ever combed through the performance tab in your dev tools only to notice that an `async import()` is not making effective improvements? Or, have you ever discovered a seemingly harmess block of JavaScript code causing a delay to higher priority tasks? 

**Here's why!** Relying on the browser's ability to time your code's loading and execution can lead to heavy congestion on the JavaScript thread. This is most often highlighted during the parsing, execution, and initial render phase of a given route in your app. If you were to look at the early seconds of a complex page load, you'll notice a long period of time taken to parse and execute multiple (and sometimes very large) chunks of JavaScript. This period of time is blocking. By async loading some code or by delaying the execution of a task, we alleviate thread-pressure during this time.

When investigating how deferring task execution is commonly applied, we often come across successes and failures. There are cases where a code-split module effectively eleviates preasure on the parsing and execution phases by loading some code behind a specific user action or behavior. But, there are also cases where a code-split module is queued up by the browser immediately following a long running parsing or execution task - effectively doing nothing, but allowing for parallel loading for HTTP2 users.

This raises some questions. How can we code-split and execute tasks more effectively? Is it possible to make these approaches align more specifically with the performance goals of a given product?

This in essence, is what this package is all about. It's an effort towards an open source solution to help accomplish that with the smallest amount of code possible:

```JavaScript
MetricsQueue.addEventListener("time-to-interactive", async () => {
  const expensiveTask = await import("expensive.js");
  expensiveTask();
})
```

# Metrics Queue

### Purpose

The Metrics Queue allows you to subscribe performance marks and measures for the purpose of performance-tuning with the highest possible granularity.

#### Why do metrics need a subscription model?

The idea behind the Metrics Queue is to deliver the fastest possible user experience regardless of environment or device. By treating your performance marks and measures as subscriptables, you can:

1. Adapt to your metrics at runtime
2. Create explicit routines for high vs. low performance scenarios
3. Explicitely defer expersive tasks behind high-priority operations
4. Create task execution phases based on the needs of your product

#### Let's talk getting setup:

Before using the MetricsQueue, you have to initialize it:

```JavaScript
import { MetricsQueue } from "metrics-queue";

MetricsQueue.init();
// Bam...off to the races
```

`MetricsQueue.init` accepts an optional configuration object:

```JavaScript
{
  onReady: (MetricQueue) => {},
  /*
    An optional callback to execute once the MetricsQueue initializes. This can be
    helpful when lazy-loading the library

    onReady is undefined by default
  */
  usePerformanceAPI: true,
  /*
    This option can be used to enable or disable the MetricsQueue from allowing
    listeners to be registered on Performance API marks and measures.

    If your app is using something other than the Performance API to track metrics,
    you can switch this option to false
  */
 plugins: {
   ["yourPluginName"]: {
     processAfterCallStack: true // or false
   }
 }
 /*
    Plugins are the MetricsQueue's way of supporting other performance metric
    libraries the same way it does the Performance API.

    If you are tracking performance metrics in your app without the Performance
    API, simply create an entry on the plugins object with any name you wish

    You'll then be able to emit events using:

    MetricsQueue.plugins.yourPluginName("your-event");

    and listen to the events using:

    MetricsQueue.addEventListener("your-event", () => {});

    This option is undefined by default.
 */
}
```

##### Now that we've _initted_, let's talk event listening!

There's a couple things to know here:

First, if your application is already using the native Performance API's marks and measures, then `MetricsQueue.init()` is all you need to start subscribing to your metrics.

Simply add event listeners like this from anywhere in your code:

```JavaScript
// Somewhere in your app:
performance.mark("example-mark");
// ...

// Anywhere else:
import { MetricsQueue } from "metrics-queue";

MetricsQueue.addEventListener("example-mark", (performanceMark, ...markOptions) => {
  // Do great things in here
});
```

##### You're all set.

If you'd like to see a bit more of the API or usage examples, please read on:

#### Let's talk about other Performance Libraries

In many code-bases, you'll find custom Performance Monitoring tools. These tools may exist for reasons such as:

1. Monitoring performance before the Performance API was widely supported
2. Sending monitoring data to external API's
3. Creating monitoring implementations that more closely align with features and product goals

To Subscribe to your custom library's events, you'll want to register a plugin when initializing the Metrics Queue

```JavaScript
import { MetricsQueue } from 'metrics-queue';

MetricsQueue.init({
  usePerformanceAPI: true, // or false
  plugins: {
    onProprietaryEvent: { // Or any name you wish
      processAfterCallStack: true, // or false
    }
  }
});
```

Creating entries on the plugins object tells the MetricsQueue to do the following:

1. Expose the `onProprietaryEvent` method. You'll invoke this method whenever a metric from your performance library completes
2. The `processAfterCallStack` option tells the `MetricsQueue` to execute all your event listeners _after_ the current callstack has cleared. This allows for your callbacks to be non-blocking

Let's look at a working example using a fictionary performance library:

```JavaScript
import { MetricsQueue } from "metrics-queue";
import { PerfMetric } from "performance-library";

const Metric = new PerfMetric("my-metric");

/*
  Most Performance libs come with a method to stop the
  metric once it's completed.
*/
Metric.onComplete(() => {
  /*
    When your metric completes, make a call to your MetricsQueue
    plugin to emit the event:
  */
  MetricsQueue.plugins.onProprietaryEvent("my-metric" , Metric, /* any other args */);
  /*
    Pass the name of the metric along with any other
    arguments you want your listeners to receive
  */
});
```

With the above step complete, you can now register event listeners on `my-metric`:

```JavaScript
MetricsQueue.addEventListener("my-metric", (PerfMetric) => {
  /*
    Run some logic when my-metric is reached

    OR:

    Access metric timings and run some conditional logic:
  */
  if(PerfMetric.duration < 20) {
    console.log("That was quick!");
  } else {
    console.log(`
      Maybe we should postpone some lower-priority tasks
      to speed up "my-metric"
    `);
  }
});
```

#### Some Example Recipes:

1. Run a lighter-weight process when performance is below a certain thresholds:

```JavaScript
// Somewhere in your application code
performance.mark("initial-request");
performance.measure("time-to-first-byte", "initial-request");

// In any other module
import { MetricsQueue } from "metrics-queue";

let deferTasksForFasterPaint;
MetricsQueue.addEventListener("time-to-first-byte", (TTFB, ...measureOptions) => {
  if(TTFB.duration > 1000) {
    // if a user is experiencing lower-than-average download speeds
    // put off loading a secondary feature until after the first
    // paint completes
    deferTasksForFasterPaint = true;
  } else {
    safeToLoadExpensiveFeature();
  }
});

MetricsQueue.addEventListener("first-meaningful-paint", FMP => {
  if(deferTasksForFasterPaint) {
    safeToLoadExpensiveFeature();
  }
});
```

2. Render some offscreen content after interactivity is reached:

```JavaScript
// Somewhere in your application code
const measure = performance.measure("interactivity", "some-start-mark");

// In any other module
import { MetricSubscriber } from "metrics-queue";

// Any UI library:
export const AwesomeComponent = () => {
  const [eventEmitted, setEventEmitted] = useState(false);
  useEffect(() => {
    const listenerID = MetricsQueue.addEventListener("interactivity", () => {
      setEventEmitted(true);
    });
    return () => {
      MetricsQueue.removeEventListener("interactivity", listenerID);
    };
  }, []);
  if(eventEmitted) {
    return (
      <ExpensiveToRenderComponent />;
    );
  }
  return <Skeleton />;
}
```

3. Load a secondary experience after a custom performance metric is reached:

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
});
```

Feel free to submit PR's with more routines that worked for your project!

### The backstory

Frontend teams everywhere trade features for performance on a day-to-day basis. As such, we dedicate ourselves to techniques such as code-splitting, serverside rendering, aggressive caching, and code compression - all, so we can have our cake, and eat it too.

If you're anything like me, you've worked on products that take full advantage of these techniques, but still require even more granular performance optimizations to accomodate company goals or product features.

In my own case, the need arrose to definitively defer task execution behind performance measurements that were tracked by my team. The need for such granularity is what inspired the `MetricsQueue`.

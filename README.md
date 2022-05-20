# Metrics Queue

The Metrics Queue allows you to treat your performance marks and measures as subscribable events!

By creating subscriptions to your performance markers, you can take fine-grained control over task execution and adjust routines at runtime for users experiencing fast or slow performance.

## Installation

```bash
npm i -S metrics-queue
# or
yarn add metrics-queue
# or
bolt add metrics-queue
```

### Getting Started

Before using the MetricsQueue, you have to initialize it:

```JavaScript
import { MetricsQueue } from "metrics-queue";

MetricsQueue.init();
// off to the races
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
    listeners to be registered on `Performance API` marks and measures.

    If your app is using something other than the `Performance API` to track metrics,
    you can switch this option to false
  */
 plugins: {
   ["yourPluginName"]: {
     processAfterCallStack: true // or false
   }
 }
 /*
    Plugins are the MetricsQueue's way of supporting other performance
    libraries the same way it does the `Performance API`.

    If you are tracking performance metrics in your app without the Performance
    API, simply create an entry on the plugins object. Ideally, one
    entry for each performance library you wish to subscribe to.

    You'll then be able to emit events using:

    MetricsQueue.plugins.yourPluginName("your-event");

    and register event listeners using:

    MetricsQueue.addEventListener("your-event", () => {});

    This option is undefined by default.
 */
}
```

#### Now that we've _initted_, let's talk about event listening

There's a couple things to know here:

First, if your application is already using the native `Performance API`'s marks and measures, then `MetricsQueue.init()` is all you need to start subscribing to your metrics.

Simply add event listeners like this from anywhere in your code:

```JavaScript
// Somewhere in your app:
performance.mark("example-mark");

// Somewhere else in your app:
import { MetricsQueue } from "metrics-queue";

MetricsQueue.addEventListener("example-mark", (performanceMark, ...markOptions) => {
  // Run reactionary routines to that performance.mark
});
```

Similar to native `eventListeners` in the browser `MetricsQueue.addEventListener` accepts an optional configuration object to go along with your `event-name` and `callback`:

```JavaScript
const ID = MetricsQueue.addEventListener("event-name", callback, {
  passive: true,
  /*
    Tells the MetricsQueue to run the callback after the current
    callstack has cleared. This can be ideal in situations where
    callbacks don't need to be "blocking".

    Callbacks by default, will process asynchronously. This can be
    set to false when executing high-priority tasks in your callbacks
  */
  keepAlive: false
  /*
    Tells the MetricsQueue that this event listener should not be
    removed after it's called. When keepAlive is true, your callback
    will run each time the corresponding metric is reached - similar
    to that of a "click" event-handler on the DOM.

    When using keepAlive = true, eventListeners can be manually
    removed using:

    MetricsQueue.removeEventListener("event-name", ID);

    By default, keepAlive is false
  */
});
```

If the `Performance API` is the backbone of recording performance metrics in your project, please feel free to skip to the [Examples](#some-example-recipes) section. There are a few recipes designed to spur some thoughts on how to integrate the `MetricsQueue` into a process or feature within your app.

If you are using an external or proprietary library for recording your metrics, the next section is for you.

### Let's talk about other Performance Libraries

In many code-bases, you'll find custom Performance Monitoring tools. These tools may exist for reasons such as:

1. Monitoring performance before the `Performance API` was widely supported
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
2. The `processAfterCallStack` option tells the `MetricsQueue` to execute all your event listeners _after_ the current callstack has cleared. This can allow for your callbacks to be non-blocking

Let's look at a working example using a fictional performance library:

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

## Some Example Recipes

Use the `MetricsQueue` to run a lighter-weight process when performance is below a certain thresholds:

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

Using the UI library of your choice, render some offscreen content after interactivity is reached:

```JavaScript
// Somewhere in your application code
const measure = performance.measure("feature-interactive", "some-start-mark");

// In any other module
import { MetricsQueue } from "metrics-queue";

// Any UI library:
export const AwesomeComponent = () => {
  const [eventEmitted, setEventEmitted] = useState(false);
  useEffect(() => {
    const listenerID = MetricsQueue.addEventListener("feature-interactive", () => {
      setEventEmitted(true);
    });
    return () => {
      MetricsQueue.removeEventListener("feature-interactive", listenerID);
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

If this is the flavor of code you're writing these days, please feel free to checkout our [React Utilities](https://github.com/alexfigliolia/metrics-queue-react#readme). They make operations such this one a breeze.

Using an external Performance monitoring library, load a secondary experience after a "custom-metric" is reached:

```JavaScript
// Somewhere in your application code
import { createMetric } from "my-custom-metric-lib";

const customMetric = createMetric("custom-metric");

// When your metric is reached
customMetric.onComplete(() => {
  MetricsQueue.plugins.onCustomMetric("custom-metric", customMetric);
});

// In any other module
import { MetricsQueue } from "metrics-queue";

MetricsQueue.addEventListener("custom-metric", customMetric => {
  if(customMetric.stopTime < 500) {
    // If the user experiencing a fast runtime execution of "custom-metric",
    // lets preload an additional feature that would normally require
    // a user interaction before fetching
    loadSecondaryExperience();
  } else {
    // The user experienced a slow execution for example-metric, so
    // lets wait for a user-interaction for preloading additional content
    // or features
  }
});
```

Make assertions on performance metrics during integration tests

```JavaScript
// in your app
import { MetricsQueue } from "metrics-queue";

MetricsQueue.init();
window.__METRICS_QUEUE = MetricsQueue;
// .... When the home page becomes interactive
performance.mark("home-page-interactive");

// in your test file
it("The home-page becomes interactive in less than 5 seconds", () => {
  cy.visit("www.your-app.com/home", {
    onBeforeLoad: $win => {
      $win.__METRICS_QUEUE.addEventListener(
        "home-page-interactive",
        (metric) => {
          expect(metric.duration < 5000).equals(true);
        }
      )
    }
  })
});
```

Feel free to submit PR's with more routines that improved performance in your project!

## The backstory

Frontend teams everywhere trade features for performance on a day-to-day basis. As such, we dedicate ourselves to techniques such as code-splitting, serverside rendering, aggressive caching, and code compression - all, so we can have our cake, and eat it too.

If you're anything like me, you've worked on products that take full advantage of these techniques, but still require even more granular performance optimizations to accommodate company goals or product features.

The need for such granularity is what inspired the `MetricsQueue`

## Contributing

All contributions and PR's are welcome for this project. Please feel free to open issues, discuss architectural decisions, and help advance the project

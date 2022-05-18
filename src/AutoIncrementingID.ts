/**
 * Auto Incrementing ID
 *
 * This module is designed to maintain a global auto incrementing ID
 * across each of the event emitters present on the MetricsQueue.
 *
 * Auto incrementing integer ID's are the fastest known form of unique identification.
 * A common usage example can be found in SQL tables. By default, a table's primary
 * keys are generated using auto incrementing integers that continue to increment
 * for the life of the table.
 */
export class AutoIncrementingID {
  private static incrementor: number = 0;

  public static get nextID(): string {
    return (this.incrementor++).toString();
  }

  public static destroy() {
    this.incrementor = 0;
  }
}

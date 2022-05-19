import { AutoIncrementingID } from "../AutoIncrementingID";

describe("Auto Incrmenting ID", () => {
  beforeEach(() => {
    AutoIncrementingID.destroy();
  });

  it("Initializes with a default value of 0", () => {
    expect(AutoIncrementingID["incrementor"]).toEqual(0);
  });

  it("Returns a stringified next ID", () => {
    const firstID = AutoIncrementingID.nextID;
    expect(firstID).toEqual("0");
    expect(AutoIncrementingID.nextID).toEqual((parseInt(firstID) + 1).toString());
  });

  it("Resets back to 0", () => {
    expect(AutoIncrementingID.nextID).toEqual("0");
    expect(AutoIncrementingID.nextID).toEqual("1");
    AutoIncrementingID.destroy();
    expect(AutoIncrementingID.nextID).toEqual("0");
  });
});

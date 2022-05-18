import { AutoIncrementingID } from "../AutoIncrementingID";

describe("Auto Incrmenting ID", () => {
  beforeEach(() => {
    AutoIncrementingID.destroy();
  });

  it("It initializes with a default value of 0", () => {
    expect(AutoIncrementingID["incrementor"]).toEqual(0);
  });

  it("It returns a stringified next ID", () => {
    const firstID = AutoIncrementingID.nextID;
    expect(firstID).toEqual("0");
    expect(AutoIncrementingID.nextID).toEqual((parseInt(firstID) + 1).toString());
  });

  it("It resets back to 0", () => {
    expect(AutoIncrementingID.nextID).toEqual("0");
    expect(AutoIncrementingID.nextID).toEqual("1");
    AutoIncrementingID.destroy();
    expect(AutoIncrementingID.nextID).toEqual("0");
  });
});

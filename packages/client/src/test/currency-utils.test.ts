import { NETWORKS } from "@anthem/utils";
import BigNumber from "bignumber.js";
import {
  calculateTransactionAmount,
  convertCryptoToFiat,
  denomToUnit,
  findCurrencyFromCoinsList,
  formatCurrencyAmount,
  unitToDenom,
} from "tools/currency-utils";
import { coins } from "../../../utils/src/client/data/coins.json";
import prices from "../../../utils/src/client/data/prices.json";

describe("currency-utils", () => {
  test("formatCurrencyAmount", () => {
    let result = formatCurrencyAmount("5000");
    expect(result).toMatchInlineSnapshot(`"5,000.00"`);

    result = formatCurrencyAmount("10.1250");
    expect(result).toMatchInlineSnapshot(`"10.13"`);

    result = formatCurrencyAmount("1050090082.235");
    expect(result).toMatchInlineSnapshot(`"1,050,090,082.24"`);
  });

  test("findCurrencyFromCoinsList", () => {
    let result = findCurrencyFromCoinsList("uatom", coins);
    expect(result).toEqual({
      id: "cosmos",
      name: "Cosmos",
      symbol: "atom",
    });

    result = findCurrencyFromCoinsList("1mt", coins);
    expect(result).toEqual({
      id: "monarch-token",
      name: "Monarch Token",
      symbol: "mt",
    });

    result = findCurrencyFromCoinsList("zzz-unknown-coin", coins);
    expect(result).toEqual({
      id: "",
      name: "",
      symbol: "",
    });
  });

  test("denomToAtoms", () => {
    let result = denomToUnit(5000, 1e6, String);
    expect(result).toMatchInlineSnapshot(`"0.005"`);

    result = denomToUnit(0, 1e6, String);
    expect(result).toMatchInlineSnapshot(`"0"`);

    result = denomToUnit(5.9082649012634, 1e6, String);
    expect(result).toMatchInlineSnapshot(`"0.0000059082649012634"`);
  });

  test("convertAtomsToUsd", () => {
    let result = convertCryptoToFiat(
      prices.prices,
      new BigNumber(5000),
      NETWORKS.COSMOS,
    );
    expect(result).toMatchInlineSnapshot(`"0.0132"`);

    result = convertCryptoToFiat(
      prices.prices,
      new BigNumber(15),
      NETWORKS.COSMOS,
    );
    expect(result).toMatchInlineSnapshot(`"0.0000396"`);

    result = convertCryptoToFiat(
      prices.prices,
      new BigNumber(1000000),
      NETWORKS.COSMOS,
    );
    expect(result).toMatchInlineSnapshot(`"2.64"`);

    result = convertCryptoToFiat(
      prices.prices,
      new BigNumber(100000000),
      NETWORKS.COSMOS,
    );
    expect(result).toMatchInlineSnapshot(`"264"`);
  });

  test("atomsToDenom", () => {
    const result = unitToDenom("500", 1e6);
    expect(result).toMatchInlineSnapshot(`"500000000"`);
  });

  test("calculateTransactionAmount", () => {
    const result = calculateTransactionAmount(
      "500000",
      "1500",
      "150000",
      NETWORKS.COSMOS,
    );
    expect(result).toMatchInlineSnapshot(`"499775"`);
  });
});

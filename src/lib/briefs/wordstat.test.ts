import assert from "node:assert/strict";
import test from "node:test";
import { cloudFolderId, intentOf, phrasesFromTop, resolveRegion, seedPhrases, wordstatEnabled } from "./wordstat";

test("Podolsk wins over Moscow oblast in the same line", () => {
  assert.deepEqual(resolveRegion("Московская область, Подольск"), {
    id: "10747",
    label: "Подольск",
    exact: true,
  });
});

test("unknown city falls back to Russia and says so", () => {
  const region = resolveRegion("село Примерное");
  assert.equal(region.exact, false);
  assert.equal(region.id, "225");
});

test("seeds keep the niche and the city", () => {
  assert.deepEqual(seedPhrases("Производство спецодежды", "Московская область, Подольск"), [
    "спецодежды",
    "производство спецодежды",
    "спецодежды подольск",
  ]);
});

test("Wordstat stays off until the paid stage is switched on", () => {
  assert.equal(wordstatEnabled({ YANDEX_SEARCH_API_KEY: "present" }), false);
  assert.equal(wordstatEnabled({ YANDEX_SEARCH_API_KEY: "present", BRIEFS_WORDSTAT: "1" }), true);
  assert.equal(wordstatEnabled({ BRIEFS_WORDSTAT: "1" }), false);
});

test("folder id must be a catalog id", () => {
  assert.equal(cloudFolderId("b1g00000000000000000"), "b1g00000000000000000");
  assert.equal(cloudFolderId("aje00000000000000000"), "");
  assert.equal(cloudFolderId("  "), "");
});

test("counts come only from the API payload", () => {
  const rows = phrasesFromTop(
    {
      totalCount: "999999",
      results: [{ phrase: "спецодежда оптом", count: "1200" }],
      associations: [{ phrase: "роба", count: "80" }],
    },
    "Подольск",
  );
  assert.deepEqual(
    rows.map((row) => [row.phrase, row.count, row.intent]),
    [
      ["спецодежда оптом", 1200, "order"],
      ["роба", 80, "other"],
    ],
  );
  assert.equal(intentOf("спецодежда цена", "Подольск"), "price");
});

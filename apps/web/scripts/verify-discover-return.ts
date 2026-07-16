import assert from "node:assert/strict";

import {
  defaultDiscoverState,
  discoverFilterKey,
  nextDiscoverFeedLoad,
  readDiscoverStateFrom,
  serializeDiscoverHash,
} from "../src/components/discover/discoverState";
import { navigate, pageFromLocation } from "../src/lib/navigation";

const restoredState = {
  ...defaultDiscoverState(),
  selectedTags: [{
    id: 123,
    type: "tag",
    name: "schoolgirl",
    slug: "schoolgirl",
    display: "女学生",
  }],
  page: 7,
  scrollY: 1840,
};

const discoverHash = serializeDiscoverHash(restoredState);
const rawSession = JSON.stringify(restoredState);
const parsedFromDiscover = readDiscoverStateFrom(discoverHash, rawSession);

assert.equal(parsedFromDiscover.page, 7, "discover hash/session must preserve page 7");
assert.equal(parsedFromDiscover.scrollY, 1840, "discover session must preserve scroll position");
assert.equal(parsedFromDiscover.selectedTags[0]?.display, "女学生", "dictionary display tag should survive restore");

const filterKey = discoverFilterKey({
  activeQuery: parsedFromDiscover.submittedQuery,
  kind: parsedFromDiscover.kind,
  language: parsedFromDiscover.language,
  selectedTags: parsedFromDiscover.selectedTags,
  sort: parsedFromDiscover.sort,
  surface: parsedFromDiscover.surface,
  unimportedOnly: parsedFromDiscover.unimportedOnly,
});
const firstLoad = nextDiscoverFeedLoad(null, parsedFromDiscover.page);

assert.equal(firstLoad.page, 7, "first feed load after returning from detail must request restored page");
assert.equal(firstLoad.isInitialLoad, true, "first feed load must be treated as initial restore");

const changedFilterLoad = nextDiscoverFeedLoad(filterKey, parsedFromDiscover.page);
assert.equal(changedFilterLoad.page, 1, "subsequent real filter changes should still reset to page 1");

const windowStub = {
  location: { hash: discoverHash },
  history: {
    replaceState(_state: unknown, _title: string, url: string) {
      windowStub.location.hash = url;
    },
  },
};
(globalThis as { window?: typeof windowStub }).window = windowStub;

const returnTo = windowStub.location.hash.replace(/^#/, "");
navigate({ name: "gallery", galleryId: 657494, returnTo });

const galleryPage = pageFromLocation();
assert.equal(galleryPage.name, "gallery", "gallery route should parse after navigating to detail");
assert.equal(galleryPage.name === "gallery" ? galleryPage.returnTo : undefined, returnTo, "gallery route must carry exact discover return target");

windowStub.history.replaceState(null, "", `#${galleryPage.name === "gallery" ? galleryPage.returnTo : ""}`);
const parsedAfterReturn = readDiscoverStateFrom(windowStub.location.hash, rawSession);
const returnFirstLoad = nextDiscoverFeedLoad(null, parsedAfterReturn.page);

assert.equal(parsedAfterReturn.page, 7, "return target must restore original discover page");
assert.equal(parsedAfterReturn.scrollY, 1840, "return target must keep original scroll position");
assert.equal(returnFirstLoad.page, 7, "feed load after explicit return target must request original page");

console.log("discover return verification passed");

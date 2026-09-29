import { test, expect, type Page } from "@playwright/test";
import { readSharedRecommendation } from "../lib/share-recommendation";

const restaurants = [
  {
    id: "101",
    name: "봉평메밀 🍜",
    category: "한식",
    foodType: "국수",
    distanceMeters: 380,
    reason: "설정한 이동거리 안에 있어요.",
    address: "서울 성동구 성수일로 10",
    phone: "02-123-4567",
    placeUrl: "https://place.map.kakao.com/101",
  },
  {
    id: "102",
    name: "초밥집",
    category: "일식",
    foodType: "초밥",
    distanceMeters: 200,
    reason: "다른 음식 종류를 골랐어요.",
    address: "서울 성동구 성수일로 20",
    phone: "",
    placeUrl: "https://place.map.kakao.com/102",
  },
  {
    id: "103",
    name: "샐러드집",
    category: "샐러드",
    foodType: "샐러드",
    distanceMeters: 450,
    reason: "가벼운 식사 종류예요.",
    address: "서울 성동구 성수일로 30",
    phone: "",
    placeUrl: "https://place.map.kakao.com/103",
  },
];
const notices = [
  "거리는 직선거리예요. 실제 가격과 영업 여부는 카카오맵에서 확인해 주세요.",
];

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 37.5665, longitude: 126.978 });
});

async function openResults(page: Page, mode: "survey" | "random" = "survey") {
  await page.route(`**/api/v1/recommendations/${mode}`, (route) =>
    route.fulfill({
      json: {
        restaurants: mode === "survey" ? restaurants : [restaurants[0]],
        candidateCount: 3,
        exhausted: false,
        notices,
      },
    }),
  );
  await page.goto("/");
  if (mode === "survey") {
    await page.getByRole("button", { name: /맞춤 추천 시작하기/ }).click();
    await page.getByRole("button", { name: "내 점심 추천받기" }).click();
  } else await page.getByRole("button", { name: /랜덤으로 뽑기/ }).click();
  await expect(page.getByRole("article")).toHaveCount(
    mode === "survey" ? 3 : 1,
  );
}

async function clipboardFallback(page: Page, fail = false) {
  await page.addInitScript(
    ({ fail }) => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            if (fail)
              throw new DOMException("Permission denied", "NotAllowedError");
            (window as typeof window & { copiedUrl: string }).copiedUrl = text;
          },
        },
      });
    },
    { fail },
  );
}

async function copiedUrl(page: Page) {
  return page.evaluate(
    () => (window as typeof window & { copiedUrl: string }).copiedUrl,
  );
}

test("copied survey link opens the exact results in a fresh browser without location or API access", async ({
  page,
  browser,
}) => {
  await clipboardFallback(page);
  await openResults(page);
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "추천 링크를 복사했어요",
  );
  const url = await copiedUrl(page);
  const snapshot = readSharedRecommendation(new URL(url).hash);
  expect(snapshot?.restaurants).toEqual(restaurants);
  const raw = JSON.stringify(snapshot);
  expect(raw).not.toContain("latitude");
  expect(raw).not.toContain("longitude");
  expect(raw).not.toContain("37.5665");
  const recipient = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  let apiCalls = 0;
  await recipient.route("**/api/**", async (route) => {
    apiCalls++;
    await route.abort();
  });
  await recipient.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: () => {
          throw new Error("Must not ask for location");
        },
      },
    });
  });
  const otherPage = await recipient.newPage();
  await otherPage.goto(url);
  await expect(
    otherPage.getByRole("heading", { name: "함께 보는 점심 추천" }),
  ).toBeVisible();
  await expect(otherPage.getByRole("article").getByRole("heading")).toHaveText(
    restaurants.map((r) => r.name),
  );
  await expect(
    otherPage.getByText("추천 당시 위치 기준", { exact: false }),
  ).toBeVisible();
  await expect(
    otherPage.getByRole("link", { name: "카카오맵에서 보기" }).first(),
  ).toHaveAttribute("href", restaurants[0].placeUrl);
  expect(
    await otherPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await otherPage.reload();
  await expect(otherPage.getByRole("article")).toHaveCount(3);
  expect(apiCalls).toBe(0);
  await otherPage
    .getByRole("button", { name: "내 주변에서 새로 추천받기" })
    .click();
  expect(new URL(otherPage.url()).hash).toBe("");
  await otherPage.reload();
  await expect(
    otherPage.getByRole("heading", { name: "오늘 점심, 뭐 먹지?" }),
  ).toBeVisible();
  await recipient.close();
});

test("native share receives an Ohmeomuk result URL instead of the home or Kakao URL", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as typeof window & { sharedData: ShareData }).sharedData = data;
      },
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
  });
  await openResults(page, "random");
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  const data = await page.evaluate(
    () => (window as typeof window & { sharedData: ShareData }).sharedData,
  );
  expect(data.title).toContain("오머먹");
  expect(new URL(data.url!).origin).toBe(new URL(page.url()).origin);
  expect(
    readSharedRecommendation(new URL(data.url!).hash)?.restaurants,
  ).toEqual([restaurants[0]]);
  await page.goto(data.url!);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "다시 뽑기", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "/tmp/ohmeomuk-shared-random.png",
    fullPage: true,
  });
});

test("cancelling native share does not copy or display an error", async ({
  page,
}) => {
  await clipboardFallback(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
  });
  await openResults(page);
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "공유하기", exact: true }),
  ).toBeEnabled();
  expect(await copiedUrl(page)).toBeUndefined();
  await expect(page.locator(".share-message")).toHaveCount(0);
});

test("clipboard permission denial exposes a selectable result link", async ({
  page,
}) => {
  await clipboardFallback(page, true);
  await openResults(page);
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  const input = page.getByRole("textbox", { name: "추천 공유 링크" });
  await expect(input).toBeVisible();
  const snapshot = readSharedRecommendation(
    new URL(await input.inputValue()).hash,
  );
  expect(snapshot?.restaurants).toEqual(restaurants);
});

test("sharing again after redraw includes the new restaurant", async ({
  page,
}) => {
  await clipboardFallback(page);
  let calls = 0;
  await page.route("**/api/v1/recommendations/random", (route) =>
    route.fulfill({
      json: {
        restaurants: [restaurants[calls++]],
        candidateCount: 3,
        exhausted: false,
        notices,
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /랜덤으로 뽑기/ }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  const first = await copiedUrl(page);
  await page.getByRole("button", { name: "다시 뽑기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: restaurants[1].name }),
  ).toBeVisible();
  await expect(page.locator(".share-message")).toHaveCount(0);
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  const second = await copiedUrl(page);
  expect(first).not.toBe(second);
  expect(
    readSharedRecommendation(new URL(second).hash)?.restaurants[0].id,
  ).toBe("102");
});

test("malformed and oversized shared snapshots are rejected without rendering unsafe links", async ({
  page,
}) => {
  for (const hash of [
    "#recommendation=broken",
    "#recommendation=" + "a".repeat(16001),
  ]) {
    await page.goto("/" + hash);
    await expect(page.locator(".error")).toContainText(
      "공유 링크가 올바르지 않아요",
    );
    await expect(page.getByRole("article")).toHaveCount(0);
  }
  const payload = {
    v: 1,
    m: "survey",
    r: 500,
    p: [["javascript:alert(1)", "가짜", "한식", "밥", 100, "", "", ""]],
    n: [],
  };
  await page.goto(
    "/#recommendation=" +
      Buffer.from(JSON.stringify(payload)).toString("base64url"),
  );
  await expect(page.locator(".error")).toContainText(
    "공유 링크가 올바르지 않아요",
  );
  await expect(
    page.getByRole("link", { name: "카카오맵에서 보기" }),
  ).toHaveCount(0);
});

test("empty results do not have a share button", async ({ page }) => {
  await page.route("**/api/v1/recommendations/random", (route) =>
    route.fulfill({
      json: { restaurants: [], candidateCount: 0, exhausted: false, notices },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /랜덤으로 뽑기/ }).click();
  await expect(
    page.getByText("조건에 맞는 음식점을 찾지 못했어요."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "공유하기", exact: true }),
  ).toHaveCount(0);
});
